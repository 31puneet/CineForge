import { useState, useRef } from 'react';
import type { WorkflowState, VideoShot } from '../../hooks/useWorkflowState';
import { Film, Play, CheckCircle2, Download, Clapperboard } from 'lucide-react';
import apiClient from '../../api/client';

interface VideoViewerProps {
  workflowState: WorkflowState | null;
  projectId?: string;
  onRefreshState?: () => Promise<void>;
}

export function VideoViewer({ workflowState, projectId, onRefreshState }: VideoViewerProps) {
  // Built-in fallback shots for active project
  const defaultShots: VideoShot[] = projectId ? [
    { shot_id: 'shot_1', video_url: `/renders/${projectId}/shot_1.mp4`, thumbnail_url: '/solaris.jpg', speaker: 'Solaris', dialogue: 'The dimensional breach is expanding! Assemble at the citadel!', duration_seconds: 10.0 },
    { shot_id: 'shot_2', video_url: `/renders/${projectId}/shot_2.mp4`, thumbnail_url: '/malakor.jpg', speaker: 'Malakor', dialogue: 'Mortal heroes... your light will drown in eternal darkness!', duration_seconds: 10.0 },
    { shot_id: 'shot_3', video_url: `/renders/${projectId}/shot_3.mp4`, thumbnail_url: '/shadow_weaver.jpg', speaker: 'Shadow Weaver', dialogue: 'Dimensional wards are failing! I will weave the binding nexus!', duration_seconds: 10.0 },
    { shot_id: 'shot_4', video_url: `/renders/${projectId}/shot_4.mp4`, thumbnail_url: '/titaness.jpg', speaker: 'Titaness', dialogue: 'Let them come! They\'ll break against my gauntlets!', duration_seconds: 10.0 },
    { shot_id: 'shot_5', video_url: `/renders/${projectId}/shot_5.mp4`, thumbnail_url: '/aero.jpg', speaker: 'Aero', dialogue: 'Flanking maneuver in three... two... strike now!', duration_seconds: 10.0 },
    { shot_id: 'shot_6', video_url: `/renders/${projectId}/shot_6.mp4`, thumbnail_url: '/solaris.jpg', speaker: 'Solaris', dialogue: 'United, we stand against the night! Supernova strike!', duration_seconds: 10.0 },
  ] : [];

  const videoShots = (workflowState?.video_shots && workflowState.video_shots.length > 0) 
    ? workflowState.video_shots 
    : defaultShots;

  const finalVideoUrl = workflowState?.final_video_url || (projectId ? `/renders/${projectId}/final_film.mp4` : null);
  const isApproved = workflowState?.approval_states?.video_approved;

  const [selectedShot, setSelectedShot] = useState<VideoShot | null>(null);
  const [, setIsPlayingMain] = useState(false);
  const [activeViewMode, setActiveViewMode] = useState<'film' | 'shots'>('film');
  const mainVideoRef = useRef<HTMLVideoElement | null>(null);

  const [regeneratingShotId, setRegeneratingShotId] = useState<string | null>(null);

  const handleRegenerateShot = async (shotId: string) => {
    if (!projectId) return;
    setRegeneratingShotId(shotId);
    try {
      await apiClient.post(`/projects/${projectId}/messages/regenerate-shot`, {
        shotId,
        feedback: 'Generate high-motion animation for this character'
      });
      if (onRefreshState) await onRefreshState();
    } catch (err) {
      console.error('Failed to regenerate shot', err);
    } finally {
      setRegeneratingShotId(null);
    }
  };

  const currentSelectedShot = selectedShot || videoShots[0] || null;

  const handleApproveVideo = async () => {
    if (!projectId) return;
    try {
      await apiClient.post(`/projects/${projectId}/messages/respond`, {
        approved: true,
        reason: 'Final cinematic movie and video shots approved by Director!'
      });
      if (onRefreshState) await onRefreshState();
    } catch (err) {
      console.error('Failed to approve video', err);
    }
  };

  if (!videoShots || videoShots.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-[#FAF7F2]">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600 mb-4 shadow-sm">
          <Film className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-serif font-bold text-stone-800 mb-2">No Video Shots Rendered Yet</h3>
        <p className="text-stone-500 text-sm max-w-sm leading-relaxed mb-6">
          Once dialogue tracks and character concepts are ready, the Video Agent renders cinematic camera shots and stitches the final film.
        </p>
      </div>
    );
  }

  const activeVideoSrc = activeViewMode === 'film' && finalVideoUrl ? finalVideoUrl : (currentSelectedShot?.video_url || finalVideoUrl);

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      {/* Header Banner */}
      <div className="flex flex-wrap justify-between items-center bg-stone-50 border-b border-stone-200 px-8 py-3.5 gap-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-600">
            <Film className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-stone-900">
                Cinematic Video Output
              </h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-stone-200 text-stone-700 font-normal">
                {videoShots.length} Shots + Master Film
              </span>
            </div>
            <p className="text-[11px] text-stone-500">
              HD 720p 24fps motion camera clips synchronized with dialogue tracks
            </p>
          </div>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center bg-stone-200/70 p-1 rounded-xl text-xs font-medium">
          <button
            onClick={() => {
              setActiveViewMode('film');
              setIsPlayingMain(false);
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all cursor-pointer ${
              activeViewMode === 'film'
                ? 'bg-orange-600 text-white shadow-xs font-semibold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Clapperboard className="w-3.5 h-3.5" />
            Master Movie Film
          </button>
          <button
            onClick={() => {
              setActiveViewMode('shots');
              setIsPlayingMain(false);
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all cursor-pointer ${
              activeViewMode === 'shots'
                ? 'bg-orange-600 text-white shadow-xs font-semibold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            Individual Shots ({videoShots.length})
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {finalVideoUrl && (
            <a
              href={finalVideoUrl}
              download="cineforge_final_film.mp4"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-stone-200 hover:border-stone-300 text-stone-700 hover:text-stone-900 text-xs font-medium rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-stone-500" />
              Download MP4
            </a>
          )}

          {isApproved ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full border border-green-200">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Film Approved
            </span>
          ) : (
            <button
              onClick={handleApproveVideo}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-medium rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Approve Master Film
            </button>
          )}
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-[#FAF7F2]">
        
        {/* Left: Master Video Stage */}
        <div className="flex-1 flex flex-col p-6 items-center justify-center overflow-y-auto">
          <div className="w-full max-w-4xl bg-stone-900 rounded-2xl overflow-hidden shadow-xl border border-stone-800 flex flex-col">
            {/* Player Container */}
            <div className="relative aspect-video w-full bg-black flex items-center justify-center group">
              <video
                key={activeVideoSrc}
                ref={mainVideoRef}
                src={activeVideoSrc || ''}
                className="w-full h-full object-contain"
                controls
                onPlay={() => setIsPlayingMain(true)}
                onPause={() => setIsPlayingMain(false)}
                onEnded={() => setIsPlayingMain(false)}
              />
            </div>

            {/* Video Info Sub-bar */}
            <div className="p-4 bg-stone-900 text-stone-200 border-t border-stone-800 flex items-center justify-between">
              <div>
                <h3 className="font-serif font-bold text-white text-base">
                  {activeViewMode === 'film' ? 'Master Assembled Film (Complete 1-Minute Cut)' : `${currentSelectedShot?.shot_id.toUpperCase()} — ${currentSelectedShot?.speaker}`}
                </h3>
                <p className="text-xs text-stone-400 mt-0.5 line-clamp-1 italic">
                  {activeViewMode === 'film' 
                    ? 'All shots stitched with synchronized character dialogue and 24fps CFR motion.' 
                    : `"${currentSelectedShot?.dialogue}"`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono px-2.5 py-1 bg-stone-800 text-stone-300 rounded-md border border-stone-700">
                  720p HD • 24fps CFR
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Shots Reel Gallery */}
        <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-stone-200 bg-white flex flex-col h-full overflow-hidden">
          <div className="p-4 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
            <h3 className="font-semibold text-xs text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
              <Clapperboard className="w-3.5 h-3.5 text-orange-500" />
              Shot Timeline ({videoShots.length})
            </h3>
            <span className="text-[11px] text-stone-500 font-mono">
              Total 60.0s (1 Minute)
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {videoShots.map((shot, idx) => {
              const isSelected = currentSelectedShot?.shot_id === shot.shot_id && activeViewMode === 'shots';
              const isFailedQuota = shot.status === 'failed_quota';
              const isNeedsAttention = shot.status === 'needs_attention';
              const isFailed = shot.status === 'failed';
              const hasProblem = isFailedQuota || isNeedsAttention || isFailed;

              return (
                <div
                  key={shot.shot_id}
                  onClick={() => {
                    setSelectedShot(shot);
                    setActiveViewMode('shots');
                    setIsPlayingMain(false);
                  }}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    hasProblem
                      ? 'bg-red-50/60 border-red-300 ring-1 ring-red-400/30'
                      : isSelected
                      ? 'bg-orange-50/60 border-orange-400 ring-2 ring-orange-400/20 shadow-xs'
                      : 'bg-stone-50/50 border-stone-200/80 hover:bg-stone-50 hover:border-stone-300'
                  }`}
                >
                  <div className="flex gap-3 items-start">
                    {/* Thumbnail */}
                    <div className="relative w-24 aspect-video rounded-lg overflow-hidden bg-black flex-shrink-0 border border-stone-200 shadow-2xs">
                      {shot.thumbnail_url ? (
                        <img src={shot.thumbnail_url} alt={shot.speaker} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-stone-800 flex items-center justify-center text-stone-500 text-xs">
                          {shot.shot_id}
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center group-hover:bg-black/10">
                        <Play className="w-4 h-4 text-white drop-shadow-md" />
                      </div>
                      <span className="absolute bottom-1 right-1 bg-black/70 text-[9px] font-mono text-white px-1 rounded">
                        {shot.duration_seconds || shot.duration_sec}s
                      </span>
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-[10px] uppercase font-bold text-stone-400">
                          Shot {idx + 1}
                        </span>
                        <span className="text-[11px] font-semibold text-stone-800">
                          {shot.speaker}
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-600 line-clamp-2 italic font-serif leading-tight mb-1.5">
                        "{shot.dialogue}"
                      </p>

                      {/* Problem Badges */}
                      <div className="flex flex-wrap gap-1 mb-1">
                        {shot.padding_applied === 'loop' && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 font-medium">
                            Loop Padded
                          </span>
                        )}
                        {shot.padding_applied === 'hold' && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-300 font-medium">
                            Hold Padded
                          </span>
                        )}
                        {shot.static_fallback && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-300 font-medium">
                            2.5D Fallback
                          </span>
                        )}
                        {isFailedQuota && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-100 text-red-800 border border-red-300 font-medium">
                            ZeroGPU Quota Exceeded
                          </span>
                        )}
                        {isNeedsAttention && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 border border-orange-300 font-medium">
                            Needs Attention
                          </span>
                        )}
                      </div>

                      {/* Regenerate Action Button */}
                      {hasProblem && (
                        <div className="mt-1 pt-1 border-t border-red-200 flex justify-end">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRegenerateShot(shot.shot_id);
                            }}
                            disabled={regeneratingShotId === shot.shot_id}
                            className="px-2 py-0.5 text-[10px] font-medium bg-red-600 hover:bg-red-700 text-white rounded shadow-2xs transition-colors cursor-pointer"
                          >
                            {regeneratingShotId === shot.shot_id ? 'Regenerating...' : 'Regenerate Shot'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
