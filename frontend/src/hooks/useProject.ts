import { useState, useEffect } from 'react';
import apiClient from '../api/client';

export function useProject(id: string | undefined) {
  const [project, setProject] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error] = useState<string | null>(null);

  useEffect(() => {
    const fetchProject = async () => {
      if (!id) return;
      
      try {
        setIsLoading(true);
        const response = await apiClient.get(`/projects/${id}`);
        setProject(response.data.project);
      } catch (err) {
        console.warn('Backend unavailable, finding local demo project:', err);
        try {
          const stored = localStorage.getItem('cineforge_local_projects');
          if (stored) {
            const list = JSON.parse(stored);
            const found = list.find((p: any) => p._id === id || p.id === id);
            if (found) {
              setProject(found);
              setIsLoading(false);
              return;
            }
          }
        } catch {}

        // Fallback demo project
        setProject({
          _id: id,
          id: id,
          title: id.includes('2') ? 'Solaris Protocol: The Void Reclaimer' : 'Neon Odyssey: Chronicles of Neo-Kyoto',
          status: 'active',
          settings: { aspectRatio: '16:9', targetDurationSeconds: 60 },
          createdAt: new Date().toISOString()
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchProject();
  }, [id]);

  return { project, isLoading, error };
}
