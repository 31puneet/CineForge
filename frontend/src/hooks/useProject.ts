import { useState, useEffect } from 'react';
import apiClient from '../api/client';

export function useProject(id: string | undefined) {
  const [project, setProject] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProject = async () => {
      if (!id) return;
      
      try {
        setIsLoading(true);
        const response = await apiClient.get(`/projects/${id}`);
        setProject(response.data.project);
      } catch (err) {
        console.error('Failed to fetch project', err);
        setError('Failed to load project.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProject();
  }, [id]);

  return { project, isLoading, error };
}
