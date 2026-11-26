export interface ProjectSettings {
  aspectRatio: string;
  targetDurationSeconds: number;
}

export interface ProjectAttachment {
  name: string;
  type: string;
  url: string;
  mimeType?: string;
}

export interface ProjectMessageMetadata {
  link?: {
    label: string;
    target: string;
  };
  attachments?: ProjectAttachment[];
}

export interface ProjectMessage {
  _id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt?: string;
  timestamp?: string;
  metadata?: ProjectMessageMetadata;
}

export interface Project {
  _id: string;
  id?: string;
  title: string;
  status: 'draft' | 'active' | 'completed' | 'archived';
  settings: ProjectSettings;
  createdAt: string;
  updatedAt?: string;
  workflowState?: WorkflowState;
}

export interface ScriptShot {
  shot_id?: string;
  id?: string;
  visual_description?: string;
  description?: string;
  duration_seconds?: number;
  duration_sec?: number;
  dialogue?: string;
  speaker?: string;
  characters?: string[];
}

export interface ScriptData {
  global_narrative: string;
  shots: ScriptShot[];
}

export interface ScriptHistoryEntry {
  version: number;
  data: ScriptData;
}

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
  reference_urls?: string[];
}

export interface CharacterHistoryEntry {
  version: number;
  data: {
    characters: Character[];
  };
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
  approved?: boolean;
  version?: number;
  padding_applied?: 'loop' | 'hold' | null;
  static_fallback?: boolean;
  error_message?: string | null;
}

export interface ApprovalStates {
  script_approved?: boolean;
  characters_approved?: boolean;
  voiceovers_approved?: boolean;
  video_approved?: boolean;
  assembly_confirmed?: boolean;
  editor_approved?: boolean;
}

export interface WorkflowState {
  current_stage: string | null;
  script_data: ScriptData | null;
  script_version?: number;
  script_history?: ScriptHistoryEntry[];
  characters?: Character[];
  character_version?: number;
  character_history?: CharacterHistoryEntry[];
  voiceovers?: Voiceover[];
  video_shots?: VideoShot[];
  final_video_url?: string | null;
  final_film_url?: string | null;
  total_film_duration?: number;
  approval_states: ApprovalStates;
}

export type WorkflowEvent =
  | { type: 'ping' }
  | { type: 'status'; content: string }
  | { type: 'thinking'; content: string }
  | { type: 'plan'; steps: string[]; current: string }
  | { type: 'plan_update'; current: string }
  | { type: 'message'; content: string; link?: { label: string; target: string } }
  | { type: 'approval_request'; stage: string }
  | { type: 'voiceovers_ready'; content: { count: number } }
  | { type: 'error'; content?: string; message?: string }
  | { type: 'done' };
