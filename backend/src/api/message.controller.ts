import { Request, Response } from 'express';
import { Message } from '../models/Message';
import { Project } from '../models/Project';

export const getMessages = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    const userId = req.user?.id;

    const project = await Project.findOne({ _id: projectId, userId });
    if (!project) {
      res.status(404).json({ error: 'Project not found or unauthorized' });
      return;
    }

    const messages = await Message.find({ projectId }).sort({ createdAt: 1 });
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const sendMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    const userId = req.user?.id;
    const { content } = req.body;

    if (!content) {
      res.status(400).json({ error: 'Content is required' });
      return;
    }

    const project = await Project.findOne({ _id: projectId, userId });
    if (!project) {
      res.status(404).json({ error: 'Project not found or unauthorized' });
      return;
    }

    // 1. Save user message to MongoDB
    const userMessage = await Message.create({
      projectId,
      role: 'user',
      content,
    });

    // Determine if it's the first message or if we are resuming
    const messageCount = await Message.countDocuments({ projectId });
    const isFirstMessage = messageCount <= 1; // since we just created one

    // 2. Call FastAPI AI Service
    let aiResponseContent = '';
    
    // Use container name "ai-service" inside docker network
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://ai-service:8000';
    
    if (isFirstMessage) {
      const response = await fetch(`${aiServiceUrl}/api/workflow/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          user_prompt: content
        })
      });
      
      if (!response.ok) {
        throw new Error(`AI Service /start failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      // Extract the last message from the state
      const messages = data.state?.messages || [];
      const lastMsg = messages[messages.length - 1];
      aiResponseContent = lastMsg?.content || 'AI finished processing.';
    } else {
      // It's a resume action (for now we assume 'message' or we can pass the action from the frontend)
      const action = req.body.action || 'message';
      const response = await fetch(`${aiServiceUrl}/api/workflow/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          action: action,
          data: { content }
        })
      });
      
      if (!response.ok) {
        throw new Error(`AI Service /resume failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      const messages = data.state?.messages || [];
      const lastMsg = messages[messages.length - 1];
      aiResponseContent = lastMsg?.content || 'AI finished processing.';
    }

    // 3. Save AI response to MongoDB
    const assistantMessage = await Message.create({
      projectId,
      role: 'assistant',
      content: aiResponseContent,
    });

    res.status(201).json({
      userMessage,
      assistantMessage
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
