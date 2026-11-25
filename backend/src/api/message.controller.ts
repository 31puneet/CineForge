import { Request, Response } from 'express';
import { Project } from '../models/Project';

// Simple in-memory fallback for approval responses if SSE isn't fully routed
const approvalResolvers = new Map<string, (val: any) => void>();

export const getMessages = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    const userId = req.user?.id;

    const project = await Project.findOne({ _id: projectId as string, userId });
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    let messages = project.messages || [];

    // If no messages stored yet or missing assistant responses, reconstruct conversation from AI workflow state
    if (messages.length === 0) {
      const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
      try {
        const response = await fetch(`${aiServiceUrl}/api/workflow/state/${projectId as string}`);
        if (response.ok) {
          const liveState = await response.json();
          const reconstructed: any[] = [];

          // Reconstruct user prompt
          if (liveState.messages && Array.isArray(liveState.messages)) {
            for (const m of liveState.messages) {
              if (m.role === 'user' && m.content) {
                const textContent = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
                if (!reconstructed.some(existing => existing.content === textContent)) {
                  reconstructed.push({
                    role: 'user',
                    content: textContent,
                    timestamp: new Date()
                  });
                }
              }
            }
          }

          // If script is present, add the script assistant message
          if (liveState.script_data) {
            reconstructed.push({
              role: 'assistant',
              content: `I have generated the movie script (v${liveState.script_version || 1}). Take a look here:`,
              metadata: { link: { label: `v${liveState.script_version || 1}_script.json`, target: 'script_tab' } },
              timestamp: new Date()
            });
            if (liveState.approval_states?.script_approved) {
              reconstructed.push({
                role: 'assistant',
                content: '✅ Script approved! Ready for Character Design.',
                timestamp: new Date()
              });
            }
          }

          // If characters are present, add the character assistant message
          if (liveState.characters && liveState.characters.length > 0) {
            reconstructed.push({
              role: 'assistant',
              content: `I have designed the characters (${liveState.characters.length} characters). Take a look here:`,
              metadata: { link: { label: `Character Cards (${liveState.characters.length})`, target: 'characters_tab' } },
              timestamp: new Date()
            });
            if (liveState.approval_states?.characters_approved) {
              reconstructed.push({
                role: 'assistant',
                content: '✅ Characters approved! Proceeding to Voiceover & Video generation.',
                timestamp: new Date()
              });
            }
          }

          // If voiceovers are present
          if (liveState.voiceovers && liveState.voiceovers.length > 0) {
            reconstructed.push({
              role: 'assistant',
              content: `I've generated studio voiceovers for all ${liveState.voiceovers.length} dialogue lines. Take a listen in the Audio tab:`,
              metadata: { link: { label: `Audio Tracks (${liveState.voiceovers.length})`, target: 'audio_tab' } },
              timestamp: new Date()
            });
          }

          if (reconstructed.length > 0) {
            project.messages = reconstructed;
            await project.save();
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
  try {
    const { projectId } = req.params;
    const { content, attachments } = req.body;
    const userId = req.user?.id;

    const project = await Project.findOne({ _id: projectId as string, userId });
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Append user message
    const userMessage = {
      role: 'user',
      content,
      attachments: attachments || [],
      timestamp: new Date()
    };
    project.messages = project.messages || [];
    project.messages.push(userMessage);
    await project.save();

    // Call AI Service /start
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    const aiResponse = await fetch(`${aiServiceUrl}/api/workflow/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: projectId,
        user_prompt: content,
        metadata: {
          title: project.title,
          targetDurationSeconds: project.settings?.targetDurationSeconds || 60,
          aspectRatio: project.settings?.aspectRatio || '16:9',
          attachments: attachments || []
        }
      })
    });

    if (aiResponse.ok && aiResponse.body) {
      res.setHeader('Content-Type', 'application/x-ndjson');
      res.setHeader('Transfer-Encoding', 'chunked');

      const reader = aiResponse.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);

        // Parse message events to persist assistant messages in MongoDB
        try {
          const textChunk = decoder.decode(value, { stream: true });
          const lines = textChunk.split('\n').filter(l => l.trim().length > 0);
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.type === 'message' && parsed.content) {
                project.messages.push({
                  role: 'assistant',
                  content: parsed.content,
                  metadata: parsed.link ? { link: parsed.link } : {},
                  timestamp: new Date()
                });
                await project.save();
              }
            } catch {}
          }
        } catch {}
      }
      res.end();
      return;
    }

    res.status(201).json(userMessage);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const respondToApproval = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    const { approved, reason } = req.body;
    const userId = req.user?.id;

    const project = await Project.findOne({ _id: projectId as string, userId });
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Persist approval action in project messages
    project.messages = project.messages || [];
    project.messages.push({
      role: 'user',
      content: approved ? 'Yes, proceed' : (reason ? `Revise: ${reason}` : 'No, revise'),
      timestamp: new Date()
    });
    await project.save();

    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    const response = await fetch(`${aiServiceUrl}/api/workflow/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: projectId,
        approved,
        reason
      })
    });

    if (!response.ok) {
      throw new Error(`AI Service /respond failed: ${response.statusText}`);
    }

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
    const userId = req.user?.id;

    const project = await Project.findOne({ _id: projectId as string, userId });
    if (!project) {
      res.status(404).json({ error: 'Project not found or unauthorized' });
      return;
    }
    
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    try {
      const response = await fetch(`${aiServiceUrl}/api/workflow/state/${projectId as string}`, {
        signal: AbortSignal.timeout(2000)
      });
      if (response.ok) {
        const liveState = await response.json();
        res.json(liveState);
        return;
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
      approval_states: {}
    };

    const stored = project.workflowState;
    res.json(stored && Object.keys(stored).length > 0 ? { ...defaultState, ...stored } : defaultState);
  } catch (error) {
    console.error('Error fetching workflow state:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const regenerateShot = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    const { shotId, feedback } = req.body;
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';

    const response = await fetch(`${aiServiceUrl}/api/workflow/regenerate-shot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, shot_id: shotId, feedback })
    });

    if (!response.ok) {
      throw new Error(`AI Service /regenerate-shot failed: ${response.statusText}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error regenerating shot:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateWorkflowState = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    
    const project = await Project.findOne({ _id: projectId as string });
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    project.workflowState = req.body;
    project.markModified('workflowState');
    await project.save();

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating workflow state:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
