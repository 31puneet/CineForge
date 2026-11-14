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

    res.json(project.messages || []);
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
    project.messages.push(userMessage);
    await project.save();

    // Start background agent execution via AI service
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    
    // Call AI Service /start asynchronously
    fetch(`${aiServiceUrl}/api/workflow/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: projectId,
        user_prompt: content,
        metadata: {
          title: project.title,
          targetDurationSeconds: project.targetDurationSeconds,
          aspectRatio: project.aspectRatio,
          genre: project.genre,
          attachments: attachments || []
        }
      })
    }).catch(err => console.error('Error triggering AI workflow:', err));

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

    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    const response = await fetch(`${aiServiceUrl}/api/workflow/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: projectId,
        approved,
        reason
      })
    });

    if (!response.ok) {
      throw new Error(`AI Service /approve failed: ${response.statusText}`);
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
