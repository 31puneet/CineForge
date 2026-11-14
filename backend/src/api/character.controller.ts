import { Request, Response } from 'express';
import { Project } from '../models/Project';

export const regenerateCharacter = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId, charId } = req.params;
    const userId = req.user?.id;
    const { feedback } = req.body;

    const project = await Project.findOne({ _id: projectId, userId });
    if (!project) {
      res.status(404).json({ error: 'Project not found or unauthorized' });
      return;
    }

    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    const response = await fetch(`${aiServiceUrl}/api/workflow/regenerate-character`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: projectId,
        character_id: charId,
        feedback: feedback || ''
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      res.status(response.status).json({ error: `AI Service error: ${errText}` });
      return;
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error regenerating character:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
