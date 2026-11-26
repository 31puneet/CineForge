import { useState, useEffect, useCallback } from 'react';
import apiClient from '../api/client';
import type { WorkflowState } from '../types/workflow';

export type {
  Character,
  Voiceover,
  VideoShot,
  WorkflowState,
  ApprovalStates,
} from '../types/workflow';

export function useWorkflowState(projectId: string | undefined) {
  const [stateRecord, setStateRecord] = useState<{ projectId: string; data: WorkflowState } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const workflowState = projectId && stateRecord?.projectId === projectId ? stateRecord.data : null;

  const fetchState = useCallback(async () => {
    if (!projectId) return;
    try {
      setIsLoading(true);
      setError(null);
      const res = await apiClient.get<WorkflowState>(`/projects/${projectId}/messages/state`);
      setStateRecord({ projectId, data: res.data });
    } catch (err) {
      console.error('Failed to fetch workflow state:', err);
      setError('Failed to load workflow state.');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    apiClient
      .get<WorkflowState>(`/projects/${projectId}/messages/state`)
      .then((res) => {
        if (!cancelled) {
          setStateRecord({ projectId, data: res.data });
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Failed to fetch workflow state:', err);
          setError('Failed to load workflow state.');
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
  }, [projectId]);

  return { workflowState, isLoading, error, fetchState };
}
