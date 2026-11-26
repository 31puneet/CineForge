import { useState, useEffect } from 'react';
import apiClient from '../api/client';
import type { Project } from '../types/workflow';

export function useProject(id: string | undefined) {
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const fetchProject = async () => {
      if (!id) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const response = await apiClient.get<{ project: Project }>(`/projects/${id}`);
        if (active) {
          setProject(response.data.project);
        }
      } catch (err) {
        console.error('Failed to load project:', err);
        if (active) {
          setProject(null);
          setError('Project not found or you do not have access.');
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    fetchProject();
    return () => {
      active = false;
    };
  }, [id]);

  return { project, isLoading, error };
}
