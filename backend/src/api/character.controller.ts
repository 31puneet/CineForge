import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Project } from '../models/Project';
import { env } from '../config/env';

const RegenerateCharacterSchema = z.object({
  feedback: z.string().optional().default(''),
});

export const regenerateCharacter = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId, charId } = req.params;
    const userId = req.user?.id;

    if (typeof projectId !== 'string' || !mongoose.Types.ObjectId.isValid(projectId)) {
      res.status(400).json({ error: 'Invalid projectId' });
      return;
    }
    if (typeof charId !== 'string' || !charId.trim()) {
      res.status(400).json({ error: 'Invalid charId' });
      return;
    }

    const parsedBody = RegenerateCharacterSchema.safeParse(req.body);
    if (!parsedBody.success) {
      res.status(400).json({ error: 'Invalid regeneration request' });
      return;
    }

    const project = await Project.findOne({ _id: projectId, userId });
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const response = await fetch(`${env.AI_SERVICE_URL}/api/workflow/regenerate-character`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-api-key': env.INTERNAL_API_KEY,
      },
      signal: AbortSignal.timeout(60000),
      body: JSON.stringify({
        project_id: projectId,
        character_id: charId,
        feedback: parsedBody.data.feedback || '',
      }),
    });

    if (!response.ok) {
      const status = response.status >= 400 && response.status < 500 ? response.status : 502;
      res.status(status).json({ error: 'Failed to regenerate character portrait' });
      return;
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error regenerating character:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
