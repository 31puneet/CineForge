import { useState, useEffect, useCallback } from 'react';
import apiClient from '../api/client';

export interface WorkflowState {
  current_stage: string | null;
  script_data: any | null;
  script_version?: number;
  script_history?: any[];
  approval_states: {
    script_approved?: boolean;
    characters_approved?: boolean;
    voiceovers_approved?: boolean;
    video_approved?: boolean;
  };
}

export function useWorkflowState(projectId: string | undefined) {
  const [workflowState, setWorkflowState] = useState<WorkflowState | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchState = useCallback(async () => {
    if (!projectId) return;
    try {
      setIsLoading(true);
      const res = await apiClient.get(`/projects/${projectId}/messages/state`);
      setWorkflowState(res.data);
    } catch (error) {
      console.error('Failed to fetch workflow state', error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  return { workflowState, isLoading, fetchState };
}
