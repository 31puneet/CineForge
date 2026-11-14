import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { Message } from '../models/Message';
import { Project } from '../models/Project';
import { Approval } from '../models/Approval';

export const getMessages = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    const uid = req.user?.id || req.user?._id;

    if (!Types.ObjectId.isValid(projectId)) {
      res.status(400).json({ error: 'Invalid project ID' });
      return;
    }

    const project = await Project.findOne({ 
      _id: new Types.ObjectId(projectId), 
      userId: new Types.ObjectId(uid) 
    });
    if (!project) {
      res.status(404).json({ error: 'Project not found or unauthorized' });
      return;
    }

    const messages = await Message.find({ projectId: projectId as string }).sort({ createdAt: 1 });
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const sendMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    const uid = req.user?.id || req.user?._id;
    const { content, metadata } = req.body;

    if (!content) {
      res.status(400).json({ error: 'Content is required for messages' });
      return;
    }

    if (!Types.ObjectId.isValid(projectId)) {
      res.status(400).json({ error: 'Invalid project ID' });
      return;
    }

    const project = await Project.findOne({ 
      _id: new Types.ObjectId(projectId), 
      userId: new Types.ObjectId(uid) 
    });
    if (!project) {
      res.status(404).json({ error: 'Project not found or unauthorized' });
      return;
    }

    // 1. Save user message to MongoDB
    await Message.create({
      projectId: projectId as string,
      role: 'user',
      content,
      metadata: metadata || {},
    });

    // 2. Call FastAPI AI Service
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://ai-service:8000';
    const endpoint = '/api/workflow/start';
    
    // We start the workflow for this project. If it's already started, AI service should handle it, 
    // but in our simplified model, we always call start which will restart it or we should just pass it.
    // For now we will just call start.
    const payload = { 
      project_id: projectId as string, 
      user_prompt: content, 
      metadata: { ...(metadata || {}), title: project.title } 
    };

    const response = await fetch(`${aiServiceUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok || !response.body) {
      throw new Error(`AI Service ${endpoint} failed: ${response.statusText}`);
    }

    // Set headers for SSE-like chunked response
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Transfer-Encoding', 'chunked');

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunkString = decoder.decode(value, { stream: true });
      res.write(chunkString);

      // Parse chunk to accumulate content and save messages
      const lines = chunkString.split('\n').filter(l => l.trim().length > 0);
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.type === 'message') {
            await Message.create({
              projectId: projectId as string,
              role: 'assistant',
              content: parsed.content,
              metadata: { link: parsed.link }
            });
          }
        } catch (e) {
          console.error("Failed to parse chunk", e);
        }
      }
    }

    res.end();
  } catch (error) {
    console.error('Error sending message:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    } else {
      res.end();
    }
  }
};

export const respondToApproval = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    const uid = req.user?.id || req.user?._id;
    const { approved, reason, stage, version } = req.body;

    if (!Types.ObjectId.isValid(projectId)) {
      res.status(400).json({ error: 'Invalid project ID' });
      return;
    }

    const project = await Project.findOne({ 
      _id: new Types.ObjectId(projectId), 
      userId: new Types.ObjectId(uid) 
    });
    if (!project) {
      res.status(404).json({ error: 'Project not found or unauthorized' });
      return;
    }

    // Persist approval to MongoDB
    await Approval.create({
      projectId: projectId as string,
      stage: stage || 'script',
      version: version || 1,
      approved,
      reason: reason || ''
    });

    // Proxy to AI Service
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://ai-service:8000';
    const response = await fetch(`${aiServiceUrl}/api/workflow/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId as string, approved, reason: reason || '' })
    });

    if (!response.ok) {
      throw new Error(`AI Service /respond failed: ${response.statusText}`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error responding to approval:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getWorkflowState = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    
    const response = await fetch(`${aiServiceUrl}/api/workflow/state/${projectId as string}`);
    
    if (!response.ok) {
      res.status(response.status).json({ error: 'Failed to fetch workflow state' });
      return;
    }
    
    const data = await response.json();
    res.json(data);
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
