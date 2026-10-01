import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { projectRepository } from '../services/project.repository';
import { ValidationError } from '../utils/errors';

const CreateProjectSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100),
  settings: z.object({
    aspectRatio: z.enum(['16:9', '9:16', '1:1', '4:3']).optional(),
    targetDurationSeconds: z.number().min(5).max(3600).optional(),
  }).optional()
});

const UpdateProjectSchema = CreateProjectSchema.partial().extend({
  status: z.enum(['draft', 'active', 'completed', 'archived']).optional()
});

export const getProjects = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projects = await projectRepository.findByUserId(req.user!.id);
    res.json({ projects });
  } catch (error) {
    next(error);
  }
};

export const getProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = await projectRepository.findByIdAndUserId(req.params.id, req.user!.id);
    res.json({ project });
  } catch (error) {
    next(error);
  }
};

export const createProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = CreateProjectSchema.parse(req.body);
    const project = await projectRepository.create(req.user!.id, validatedData);
    res.status(201).json({ project });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ValidationError('Invalid project data', error.errors));
    } else {
      next(error);
    }
  }
};

export const updateProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = UpdateProjectSchema.parse(req.body);
    const project = await projectRepository.update(req.params.id, req.user!.id, validatedData);
    res.json({ project });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ValidationError('Invalid project data', error.errors));
    } else {
      next(error);
    }
  }
};

export const deleteProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await projectRepository.delete(req.params.id, req.user!.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
