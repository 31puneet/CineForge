import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Project } from '../models/Project';
import { Approval } from '../models/Approval';
import { Job } from '../models/Job';
import { env } from '../config/env';
import { enqueueShotJob } from '../services/job.service';

const SendMessageSchema = z.object({
  content: z.string().trim().min(1, 'Message content is required'),
  attachments: z.array(z.record(z.string(), z.unknown())).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const RespondApprovalSchema = z.object({
  approved: z.boolean(),
  reason: z.string().optional().default(''),
  stage: z.string().optional().default('script'),
  version: z.number().int().positive().optional().default(1),
});

const RegenerateVoiceoverSchema = z.object({
  shotId: z.string().trim().min(1, 'shotId is required'),
  dialogue: z.string().trim().min(1).optional(),
  voiceId: z.string().trim().min(1).optional(),
});

const RegenerateShotSchema = z.object({
  shotId: z.string().trim().min(1, 'shotId is required'),
  feedback: z.string().optional().default(''),
});

const ApproveShotSchema = z.object({
  shotId: z.string().trim().min(1, 'shotId is required'),
  approved: z.boolean(),
  feedback: z.string().optional().default(''),
});

const WorkflowStateSchema = z.object({
  current_stage: z.string().nullable().optional(),
  script_data: z.record(z.string(), z.unknown()).nullable().optional(),
  script_version: z.number().optional(),
  script_history: z.array(z.record(z.string(), z.unknown())).optional(),
  characters: z.array(z.record(z.string(), z.unknown())).optional(),
  character_version: z.number().optional(),
  character_history: z.array(z.record(z.string(), z.unknown())).optional(),
  voiceovers: z.array(z.record(z.string(), z.unknown())).optional(),
  video_shots: z.array(z.record(z.string(), z.unknown())).optional(),
  final_film_url: z.string().nullable().optional(),
  final_video_url: z.string().nullable().optional(),
  manifest: z.record(z.string(), z.unknown()).nullable().optional(),
  total_film_duration: z.number().optional(),
  approval_states: z.record(z.string(), z.unknown()).optional(),
  messages: z.array(z.record(z.string(), z.unknown())).optional(),
}).passthrough();

function getInternalHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-internal-api-key': env.INTERNAL_API_KEY,
  };
}

function validateProjectId(projectId: unknown, res: Response): projectId is string {
  if (typeof projectId !== 'string' || !mongoose.Types.ObjectId.isValid(projectId)) {
    res.status(400).json({ error: 'Invalid projectId' });
    return false;
  }
  return true;
}

export const getMessages = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    if (!validateProjectId(projectId, res)) return;

    const userId = req.user?.id;
    const project = await Project.findOne({ _id: projectId, userId });
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    let messages = project.messages || [];

    if (messages.length === 0) {
      try {
        const response = await fetch(`${env.AI_SERVICE_URL}/api/workflow/state/${projectId}`, {
          headers: getInternalHeaders(),
          signal: AbortSignal.timeout(5000),
        });
        if (response.ok) {
          const liveState = (await response.json()) as Record<string, unknown>;
          const reconstructed: NonNullable<typeof project.messages> = [];

          if (Array.isArray(liveState.messages)) {
            for (const m of liveState.messages) {
              if (m && typeof m === 'object' && 'content' in m && m.content) {
                const msgObj = m as { role?: string; content: unknown };
                const role = msgObj.role === 'assistant' || msgObj.role === 'system' ? msgObj.role : 'user';
                const textContent = typeof msgObj.content === 'string' ? msgObj.content : JSON.stringify(msgObj.content);
                reconstructed.push({
                  role,
                  content: textContent,
                  timestamp: new Date(),
                });
              }
            }
          }

          if (reconstructed.length === 0 && liveState.script_data) {
            const scriptVer = typeof liveState.script_version === 'number' ? liveState.script_version : 1;
            reconstructed.push({
              role: 'assistant',
              content: `I have generated the movie script (v${scriptVer}). Take a look here:`,
              metadata: { link: { label: `v${scriptVer}_script.json`, target: 'script' } },
              timestamp: new Date(),
            });
          }

          if (reconstructed.length > 0) {
            await Project.updateOne(
              { _id: projectId, userId },
              { $set: { messages: reconstructed } }
            );
            messages = reconstructed;
          }
        }
      } catch (err) {
        console.error('Failed to reconstruct messages from AI state:', err);
      }
    }

    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const sendMessage = async (req: Request, res: Response): Promise<void> => {
  const abortController = new AbortController();
  req.on('close', () => {
    if (!res.writableEnded) {
      abortController.abort();
    }
  });

  try {
    const { projectId } = req.params;
    if (!validateProjectId(projectId, res)) return;

    const parsedBody = SendMessageSchema.safeParse(req.body);
    if (!parsedBody.success) {
      res.status(400).json({ error: parsedBody.error.issues[0]?.message || 'Invalid message payload' });
      return;
    }

    const { content, attachments, metadata } = parsedBody.data;
    const userId = req.user?.id;

    const project = await Project.findOne({ _id: projectId, userId });
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const resolvedAttachments = attachments || (Array.isArray(metadata?.attachments) ? (metadata.attachments as Record<string, unknown>[]) : []);
    const targetDuration = typeof metadata?.targetDurationSeconds === 'number'
      ? metadata.targetDurationSeconds
      : project.settings?.targetDurationSeconds || 60;

    const userMessage = {
      role: 'user' as const,
      content,
      attachments: resolvedAttachments,
      timestamp: new Date(),
    };
    await Project.updateOne(
      { _id: projectId, userId },
      { $push: { messages: userMessage }, $set: { status: 'active' } }
    );

    const aiResponse = await fetch(`${env.AI_SERVICE_URL}/api/workflow/start`, {
      method: 'POST',
      headers: getInternalHeaders(),
      signal: abortController.signal,
      body: JSON.stringify({
        project_id: projectId,
        user_prompt: content,
        metadata: {
          title: project.title,
          targetDurationSeconds: targetDuration,
          aspectRatio: project.settings?.aspectRatio || '16:9',
          attachments: resolvedAttachments,
        },
      }),
    });

    if (!aiResponse.ok || !aiResponse.body) {
      const errBody = await aiResponse.text().catch(() => aiResponse.statusText);
      res.status(aiResponse.status >= 400 && aiResponse.status < 500 ? aiResponse.status : 502).json({
        error: errBody || 'AI service failed to start workflow',
      });
      return;
    }

    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Transfer-Encoding', 'chunked');

    const reader = aiResponse.body.getReader();
    const decoder = new TextDecoder();
    let lineBuffer = '';
    const assistantMessages: NonNullable<typeof project.messages> = [];

    const processLine = (rawLine: string) => {
      const trimmed = rawLine.trim();
      if (!trimmed) return;
      try {
        const parsed = JSON.parse(trimmed) as { type?: string; content?: string; link?: Record<string, unknown> };
        if (parsed.type === 'message' && parsed.content) {
          assistantMessages.push({
            role: 'assistant',
            content: parsed.content,
            metadata: parsed.link ? { link: parsed.link } : {},
            timestamp: new Date(),
          });
        }
      } catch {
        // Non-JSON or malformed event line ignored for DB persistence
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);

      lineBuffer += decoder.decode(value, { stream: true });
      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop() ?? '';
      for (const line of lines) {
        processLine(line);
      }
    }

    lineBuffer += decoder.decode();
    if (lineBuffer.trim()) {
      processLine(lineBuffer);
    }

    if (assistantMessages.length > 0) {
      await Project.updateOne(
        { _id: projectId, userId },
        { $push: { messages: { $each: assistantMessages } } }
      );
    }

    res.end();
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') {
      if (!res.writableEnded) res.end();
      return;
    }
    console.error('Error sending message:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    } else if (!res.writableEnded) {
      res.write(JSON.stringify({ type: 'error', content: 'Stream interrupted' }) + '\n');
      res.end();
    }
  }
};

export const respondToApproval = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    if (!validateProjectId(projectId, res)) return;

    const parsedBody = RespondApprovalSchema.safeParse(req.body);
    if (!parsedBody.success) {
      res.status(400).json({ error: parsedBody.error.issues[0]?.message || 'Invalid approval payload' });
      return;
    }

    const { approved, reason, stage, version } = parsedBody.data;
    const userId = req.user?.id;

    const project = await Project.findOne({ _id: projectId, userId });
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    if (!approved && !reason.trim()) {
      res.status(400).json({ error: 'Feedback reason is required when requesting changes' });
      return;
    }

    // Idempotency: prevent duplicate identical approval submission for the same stage/version
    if (approved) {
      const existingApproval = await Approval.findOne({ projectId, stage, version, approved: true });
      if (existingApproval) {
        res.json({ status: 'ok', duplicate: true });
        return;
      }
    }

    const response = await fetch(`${env.AI_SERVICE_URL}/api/workflow/respond`, {
      method: 'POST',
      headers: getInternalHeaders(),
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        project_id: projectId,
        approved,
        reason,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => response.statusText);
      res.status(response.status >= 400 && response.status < 500 ? response.status : 502).json({
        error: errText || 'AI Service /respond failed',
      });
      return;
    }

    await Approval.create({
      projectId,
      stage,
      version,
      approved,
      reason,
    });

    const approvalMsg = {
      role: 'user' as const,
      content: approved ? 'Yes, proceed' : `Revise: ${reason}`,
      timestamp: new Date(),
    };
    await Project.updateOne({ _id: projectId, userId }, { $push: { messages: approvalMsg } });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error responding to approval:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getWorkflowState = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    if (!validateProjectId(projectId, res)) return;

    const userId = req.user?.id;
    const project = await Project.findOne({ _id: projectId, userId });
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    try {
      const response = await fetch(`${env.AI_SERVICE_URL}/api/workflow/state/${projectId}`, {
        headers: getInternalHeaders(),
        signal: AbortSignal.timeout(3000),
      });
      if (response.ok) {
        const liveState = (await response.json()) as Record<string, unknown>;
        const hasLiveState = Boolean(
          liveState?.current_stage ||
          liveState?.script_data ||
          (Array.isArray(liveState?.characters) && liveState.characters.length > 0) ||
          (Array.isArray(liveState?.voiceovers) && liveState.voiceovers.length > 0) ||
          (Array.isArray(liveState?.video_shots) && liveState.video_shots.length > 0)
        );
        if (hasLiveState) {
          res.json(liveState);
          return;
        }
      }
    } catch {
      // Fall back to Mongo stored state
    }

    const defaultState = {
      current_stage: null,
      script_data: null,
      script_version: 0,
      script_history: [],
      characters: [],
      character_version: 0,
      character_history: [],
      voiceovers: [],
      video_shots: [],
      final_video_url: null,
      approval_states: {},
    };

    const stored = project.workflowState;
    res.json(stored && Object.keys(stored).length > 0 ? { ...defaultState, ...stored } : defaultState);
  } catch (error) {
    console.error('Error fetching workflow state:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const regenerateVoiceover = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    if (!validateProjectId(projectId, res)) return;

    const parsedBody = RegenerateVoiceoverSchema.safeParse(req.body);
    if (!parsedBody.success) {
      res.status(400).json({ error: parsedBody.error.issues[0]?.message || 'Invalid voiceover payload' });
      return;
    }

    const userId = req.user?.id;
    const project = await Project.findOne({ _id: projectId, userId });
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const { shotId, dialogue, voiceId } = parsedBody.data;
    const response = await fetch(`${env.AI_SERVICE_URL}/api/workflow/regenerate-voiceover`, {
      method: 'POST',
      headers: getInternalHeaders(),
      signal: AbortSignal.timeout(60000),
      body: JSON.stringify({
        project_id: projectId,
        shot_id: shotId,
        dialogue,
        voice_id: voiceId,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => response.statusText);
      res.status(response.status >= 400 && response.status < 500 ? response.status : 502).json({
        error: errText || 'AI Service /regenerate-voiceover failed',
      });
      return;
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error regenerating voiceover:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const regenerateShot = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    if (!validateProjectId(projectId, res)) return;

    const parsedBody = RegenerateShotSchema.safeParse(req.body);
    if (!parsedBody.success) {
      res.status(400).json({ error: parsedBody.error.issues[0]?.message || 'Invalid regenerate shot payload' });
      return;
    }

    const { shotId, feedback } = parsedBody.data;
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const project = await Project.findOne({ _id: projectId, userId });
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    await enqueueShotJob({
      projectId,
      userId,
      shotId,
      version: Date.now(),
      payloadRef: { feedback },
    });

    const response = await fetch(`${env.AI_SERVICE_URL}/api/workflow/regenerate-shot`, {
      method: 'POST',
      headers: getInternalHeaders(),
      signal: AbortSignal.timeout(180000),
      body: JSON.stringify({ project_id: projectId, shot_id: shotId, feedback }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => response.statusText);
      res.status(response.status >= 400 && response.status < 500 ? response.status : 502).json({
        error: errText || 'AI Service /regenerate-shot failed',
      });
      return;
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error regenerating shot:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const approveShot = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    if (!validateProjectId(projectId, res)) return;

    const parsedBody = ApproveShotSchema.safeParse(req.body);
    if (!parsedBody.success) {
      res.status(400).json({ error: parsedBody.error.issues[0]?.message || 'Invalid shot approval payload' });
      return;
    }

    const userId = req.user?.id;
    const project = await Project.findOne({ _id: projectId, userId });
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const { shotId, approved, feedback } = parsedBody.data;
    const response = await fetch(`${env.AI_SERVICE_URL}/api/workflow/approve-shot`, {
      method: 'POST',
      headers: getInternalHeaders(),
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        project_id: projectId,
        shot_id: shotId,
        approved,
        feedback,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => response.statusText);
      res.status(response.status >= 400 && response.status < 500 ? response.status : 502).json({
        error: errText || 'AI Service /approve-shot failed',
      });
      return;
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error approving shot:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getProjectJobs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    if (!validateProjectId(projectId, res)) return;

    const userId = req.user?.id;
    const project = await Project.findOne({ _id: projectId, userId });
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const jobs = await Job.find({ projectId }).sort({ createdAt: -1 }).limit(100);
    res.json({ jobs });
  } catch (error) {
    console.error('Error fetching project jobs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateWorkflowState = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    if (!validateProjectId(projectId, res)) return;

    const parsedState = WorkflowStateSchema.safeParse(req.body);
    if (!parsedState.success) {
      res.status(400).json({ error: 'Invalid workflow state payload' });
      return;
    }

    const statePayload = parsedState.data;
    const nextStatus = statePayload.current_stage === 'completed' ? 'completed' : 'active';

    const result = await Project.updateOne(
      { _id: projectId },
      { $set: { workflowState: statePayload, status: nextStatus } }
    );

    if (result.matchedCount === 0) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating workflow state:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
