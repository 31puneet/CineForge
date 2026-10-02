import { useState, useEffect } from 'react';
import apiClient from '../api/client';

export function useProjects() {
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get('/projects');
      setProjects(response.data.projects || []);
    } catch (error) {
      console.error('Failed to fetch projects', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createProject = async (title: string) => {
    setIsCreating(true);
    try {
      const response = await apiClient.post('/projects', { title });
      setProjects([response.data.project, ...projects]);
      return response.data.project;
    } catch (error) {
      console.error('Failed to create project', error);
      throw error;
    } finally {
      setIsCreating(false);
    }
  };

  const deleteProject = async (id: string) => {
    try {
      await apiClient.delete(`/projects/${id}`);
      setProjects(projects.filter(p => p._id !== id && p.id !== id));
    } catch (err) {
      console.error('Failed to delete project', err);
      throw err;
    }
  };

  const updateProject = async (id: string, updates: any) => {
    try {
      await apiClient.patch(`/projects/${id}`, updates);
      setProjects(projects.map(p => (p._id === id || p.id === id) ? { ...p, ...updates } : p));
    } catch (err) {
      console.error('Failed to update project', err);
      throw err;
    }
  };

  return { projects, isLoading, isCreating, createProject, deleteProject, updateProject };
}
