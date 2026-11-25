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

const DEMO_WORKFLOW_STATE: WorkflowState = {
  current_stage: 'editor_agent',
  script_data: {
    title: 'Neon Odyssey: Chronicles of Neo-Kyoto',
    genre: 'Cyberpunk Sci-Fi',
    scenes: [
      {
        scene_number: 1,
        title: 'The Edge of The Grid',
        setting: 'Rain-soaked rooftop overlooking towering neon spires.',
        shots: [
          {
            shot_id: 'shot_1',
            camera_movement: 'Cinematic slow drone dolly forward',
            visual_prompt: 'Cyberpunk cityscape in heavy rain, neon reflections, ultra high definition 8K.',
            speaker: 'Kaelen',
            dialogue: 'In the shadows of Neo-Kyoto, memory is the only currency that matters.'
          },
          {
            shot_id: 'shot_2',
            camera_movement: 'Tight close-up with lens flare',
            visual_prompt: 'Cyborg renegade with glowing cybernetic eye standing in neon drizzle.',
            speaker: 'Kaelen',
            dialogue: 'They tried to wipe my slate clean. But some ghosts refuse to die.'
          }
        ]
      }
    ]
  },
  characters: [
    {
      character_id: 'char_1',
      name: 'Commander Solaris',
      role: 'Protagonist / Vanguard Leader',
      visual_description: 'Stoic commander clad in obsidian cyber-armor with ambient orange energy veins.',
      image_url: '/solaris.jpg'
    },
    {
      character_id: 'char_2',
      name: 'Malakor The Exile',
      role: 'Antagonist / Shadow Operative',
      visual_description: 'Rogue operative shrouded in holographic carbon cloak and dual-visored neural helmet.',
      image_url: '/malakor.jpg'
    },
    {
      character_id: 'char_3',
      name: 'Aero Vanguard',
      role: 'Aerial Specialist',
      visual_description: 'High-speed combat pilot with sleek visor and aerofoil battle suit.',
      image_url: '/aero.jpg'
    }
  ],
  voiceovers: [
    {
      shot_id: 'shot_1',
      speaker: 'Kaelen',
      dialogue: 'In the shadows of Neo-Kyoto, memory is the only currency that matters.',
      audio_url: '',
      duration_seconds: 4.5
    },
    {
      shot_id: 'shot_2',
      speaker: 'Kaelen',
      dialogue: 'They tried to wipe my slate clean. But some ghosts refuse to die.',
      audio_url: '',
      duration_seconds: 5.2
    }
  ],
  video_shots: [
    {
      shot_id: 'shot_1',
      video_url: '/Card_1_Video.mp4',
      thumbnail_url: '/solaris.jpg',
      prompt: 'Cinematic slow drone dolly forward into cyberpunk skyline with neon rain.',
      duration_seconds: 4.5,
      status: 'completed'
    },
    {
      shot_id: 'shot_2',
      video_url: '/Card_2_Video.mp4',
      thumbnail_url: '/malakor.jpg',
      prompt: 'Tight close-up of cyborg renegade in neon rain.',
      duration_seconds: 5.2,
      status: 'completed'
    }
  ],
  final_video_url: '/Card_1_Video.mp4',
  approval_states: {
    script_approved: true,
    characters_approved: true,
    voiceovers_approved: true,
    video_approved: true
  }
};

export function useWorkflowState(projectId: string | undefined) {
  const [workflowState, setWorkflowState] = useState<WorkflowState | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchState = useCallback(async () => {
    if (!projectId) return;
    try {
      setIsLoading(true);
      const res = await apiClient.get(`/projects/${projectId}/messages/state`);
      if (res.data && res.data.script_data) {
        setWorkflowState(res.data);
      } else {
        setWorkflowState(DEMO_WORKFLOW_STATE);
      }
    } catch (error) {
      console.warn('Backend unavailable, using demo studio state:', error);
      setWorkflowState(DEMO_WORKFLOW_STATE);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  return { workflowState, isLoading, fetchState };
}
