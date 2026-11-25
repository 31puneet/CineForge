import { useState, useEffect } from 'react';
import apiClient from '../api/client';

const DEMO_PROJECTS = [
  {
    _id: 'demo-1',
    id: 'demo-1',
    title: 'Neon Odyssey: Chronicles of Neo-Kyoto',
    status: 'active',
    createdAt: new Date().toISOString(),
    settings: { aspectRatio: '16:9', targetDurationSeconds: 60 }
  },
  {
    _id: 'demo-2',
    id: 'demo-2',
    title: 'Solaris Protocol: The Void Reclaimer',
    status: 'completed',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    settings: { aspectRatio: '16:9', targetDurationSeconds: 45 }
  }
];

export function useProjects() {
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const getStoredProjects = () => {
    try {
      const stored = localStorage.getItem('cineforge_local_projects');
      if (stored) return JSON.parse(stored);
    } catch {}
    return DEMO_PROJECTS;
  };

  const saveStoredProjects = (projs: any[]) => {
    try {
      localStorage.setItem('cineforge_local_projects', JSON.stringify(projs));
    } catch {}
  };

  const fetchProjects = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get('/projects');
      const loaded = response.data.projects;
      if (Array.isArray(loaded) && loaded.length > 0) {
        setProjects(loaded);
      } else {
        setProjects(getStoredProjects());
      }
    } catch (error) {
      console.warn('Backend unavailable, using demo projects:', error);
      setProjects(getStoredProjects());
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
      console.warn('Backend unavailable, creating local demo project:', error);
      const newProj = {
        _id: 'demo-' + Date.now(),
        id: 'demo-' + Date.now(),
        title,
        status: 'active',
        createdAt: new Date().toISOString(),
        settings: { aspectRatio: '16:9', targetDurationSeconds: 60 }
      };
      const updated = [newProj, ...projects];
      setProjects(updated);
      saveStoredProjects(updated);
      return newProj;
    } finally {
      setIsCreating(false);
    }
  };

  const deleteProject = async (id: string) => {
    try {
      await apiClient.delete(`/projects/${id}`);
    } catch (err) {
      console.warn('Backend unavailable, deleting local project:', err);
    } finally {
      const updated = projects.filter(p => p._id !== id && p.id !== id);
      setProjects(updated);
      saveStoredProjects(updated);
    }
  };

  const updateProject = async (id: string, updates: any) => {
    try {
      await apiClient.patch(`/projects/${id}`, updates);
    } catch (err) {
      console.warn('Backend unavailable, updating local project:', err);
    } finally {
      const updated = projects.map(p => (p._id === id || p.id === id) ? { ...p, ...updates } : p);
      setProjects(updated);
      saveStoredProjects(updated);
    }
  };

  return { projects, isLoading, isCreating, createProject, deleteProject, updateProject };
}
