import { useState, useEffect, useCallback } from 'react';
import apiClient from '../api/client';
import type { Project } from '../types/workflow';

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiClient.get<{ projects: Project[] }>('/projects');
      setProjects(Array.isArray(response.data.projects) ? response.data.projects : []);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
      setError('Unable to load projects. Please check your connection or sign in again.');
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<{ projects: Project[] }>('/projects')
      .then((response) => {
        if (!cancelled) {
          setProjects(Array.isArray(response.data.projects) ? response.data.projects : []);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Failed to fetch projects:', err);
          setError('Unable to load projects. Please check your connection or sign in again.');
          setProjects([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const createProject = async (title: string): Promise<Project> => {
    setIsCreating(true);
    setError(null);
    try {
      const response = await apiClient.post<{ project: Project }>('/projects', { title });
      const created = response.data.project;
      setProjects((prev) => [created, ...prev]);
      return created;
    } catch (err) {
      console.error('Failed to create project:', err);
      setError('Failed to create project');
      throw err;
    } finally {
      setIsCreating(false);
    }
  };

  const deleteProject = async (id: string): Promise<void> => {
    setError(null);
    try {
      await apiClient.delete(`/projects/${id}`);
      setProjects((prev) => prev.filter((p) => p._id !== id && p.id !== id));
    } catch (err) {
      console.error('Failed to delete project:', err);
      setError('Failed to delete project');
      throw err;
    }
  };

  const updateProject = async (id: string, updates: Partial<Pick<Project, 'title' | 'status' | 'settings'>>): Promise<void> => {
    setError(null);
    try {
      const response = await apiClient.patch<{ project: Project }>(`/projects/${id}`, updates);
      const updatedProject = response.data.project;
      setProjects((prev) =>
        prev.map((p) => (p._id === id || p.id === id ? { ...p, ...updatedProject } : p))
      );
    } catch (err) {
      console.error('Failed to update project:', err);
      setError('Failed to update project');
      throw err;
    }
  };

  return { projects, isLoading, isCreating, error, createProject, deleteProject, updateProject, refreshProjects: fetchProjects };
}
