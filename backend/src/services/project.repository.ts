import { Types } from 'mongoose';
import { Project, IProject } from '../models/Project';
import { NotFoundError } from '../utils/errors';

export class ProjectRepository {
  /**
   * Finds all projects belonging to a specific user.
   */
  async findByUserId(userId: string): Promise<IProject[]> {
    return Project.find({ userId: new Types.ObjectId(userId) }).sort({ updatedAt: -1 });
  }

  /**
   * Finds a specific project, strictly verifying that the user owns it.
   */
  async findByIdAndUserId(projectId: string, userId: string): Promise<IProject> {
    const project = await Project.findOne({ 
      _id: new Types.ObjectId(projectId),
      userId: new Types.ObjectId(userId) 
    });

    if (!project) {
      throw new NotFoundError('Project not found or you do not have permission to access it');
    }

    return project;
  }

  /**
   * Creates a new project securely attached to the user.
   */
  async create(userId: string, data: Partial<IProject>): Promise<IProject> {
    const project = new Project({
      ...data,
      userId: new Types.ObjectId(userId)
    });
    return project.save();
  }

  /**
   * Updates an existing project, strictly verifying ownership first.
   */
  async update(projectId: string, userId: string, data: Partial<IProject>): Promise<IProject> {
    const project = await this.findByIdAndUserId(projectId, userId);
    
    // Prevent updating protected fields
    delete data.userId;
    delete (data as any)._id;

    Object.assign(project, data);
    return project.save();
  }

  /**
   * Deletes a project, strictly verifying ownership first.
   */
  async delete(projectId: string, userId: string): Promise<void> {
    const result = await Project.deleteOne({ 
      _id: new Types.ObjectId(projectId),
      userId: new Types.ObjectId(userId) 
    });

    if (result.deletedCount === 0) {
      throw new NotFoundError('Project not found or you do not have permission to delete it');
    }
  }
}

export const projectRepository = new ProjectRepository();
