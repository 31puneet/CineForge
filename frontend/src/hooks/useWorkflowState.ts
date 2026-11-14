import { useState, useEffect, useCallback } from 'react';
import apiClient from '../api/client';

export interface Character {
  id?: string;
  character_id?: string;
  name: string;
  role?: string;
  gender?: string;
  description?: string;
  visual_description?: string;
  image_url?: string;
  image_prompt?: string;
}

export interface Voiceover {
  shot_id: string;
  speaker: string;
  gender?: string;
  dialogue: string;
  voice_name?: string;
  voice_id?: string;
  audio_url: string;
  duration_seconds?: number;
}

export interface VideoShot {
  shot_id: string;
  video_url: string;
  thumbnail_url?: string;
  speaker?: string;
  dialogue?: string;
  prompt?: string;
  duration_seconds?: number;
  duration_sec?: number;
  status?: 'queued' | 'rendering' | 'completed' | 'failed' | 'failed_quota' | 'needs_attention';
  padding_applied?: 'loop' | 'hold' | null;
  static_fallback?: boolean;
  error_message?: string;
}

export interface WorkflowState {
  current_stage: string | null;
  script_data: any | null;
  script_version?: number;
  script_history?: any[];
  characters?: Character[];
  character_version?: number;
  character_history?: any[];
  voiceovers?: Voiceover[];
  video_shots?: VideoShot[];
  final_video_url?: string;
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
