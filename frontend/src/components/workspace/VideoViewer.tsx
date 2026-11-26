import { useState, useRef } from 'react';
import type { WorkflowState } from '../../types/workflow';
import { useTheme } from '../../context/ThemeContext';
import { Film, Play, CheckCircle2, Download, Clapperboard, RotateCcw, Loader2 } from 'lucide-react';
import apiClient from '../../api/client';

interface VideoViewerProps {
  workflowState: WorkflowState | null;
  projectId?: string;
  onRefreshState?: () => Promise<void>;
}

function isSafeMediaUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.startsWith('/') || url.startsWith('https://') || url.startsWith('http://');
}

export function VideoViewer({ workflowState, projectId, onRefreshState }: VideoViewerProps) {
  const { isDark } = useTheme();
  const videoShots = workflowState?.video_shots || [];
  const rawFinalVideoUrl = workflowState?.final_film_url || workflowState?.final_video_url || null;
  const finalVideoUrl = isSafeMediaUrl(rawFinalVideoUrl) ? rawFinalVideoUrl : null;
  const isApproved = Boolean(workflowState?.approval_states?.video_approved);
  const isAssemblyConfirmed = Boolean(workflowState?.approval_states?.assembly_confirmed);

  const [selectedShotId, setSelectedShotId] = useState<string | null>(null);
  const [, setIsPlayingMain] = useState(false);
  const [activeViewMode, setActiveViewMode] = useState<'film' | 'shots'>(finalVideoUrl ? 'film' : 'shots');
  const mainVideoRef = useRef<HTMLVideoElement | null>(null);

  const [regeneratingShotIds, setRegeneratingShotIds] = useState<Set<string>>(new Set());
  const [approvingShotId, setApprovingShotId] = useState<string | null>(null);
  const [isApprovingAll, setIsApprovingAll] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const currentSelectedShot = videoShots.find((s) => s.shot_id === selectedShotId) || videoShots[0] || null;
  const totalDuration = videoShots.reduce((acc, s) => acc + (Number(s.duration_seconds || s.duration_sec) || 0), 0);

  const handleRegenerateShot = async (shotId: string) => {
    if (!projectId) return;
    setErrorMsg(null);
    setRegeneratingShotIds((prev) => new Set(prev).add(shotId));
    try {
      await apiClient.post(`/projects/${projectId}/messages/regenerate-shot`, {
        shotId,
        feedback: 'Regenerate high-motion shot preserving scene continuity',
      });
      await onRefreshState?.();
    } catch (err) {
      console.error('Failed to regenerate shot', err);
      setErrorMsg(`Failed to regenerate ${shotId}.`);
    } finally {
      setRegeneratingShotIds((prev) => {
        const next = new Set(prev);
        next.delete(shotId);
        return next;
      });
    }
  };

  const handleApproveSingleShot = async (shotId: string, approved: boolean) => {
    if (!projectId) return;
    setErrorMsg(null);
    setApprovingShotId(shotId);
    try {
      await apiClient.post(`/projects/${projectId}/messages/approve-shot`, {
        shotId,
        approved,
      });
      await onRefreshState?.();
    } catch (err) {
      console.error('Failed to update shot approval', err);
      setErrorMsg(`Failed to update approval for ${shotId}.`);
    } finally {
      setApprovingShotId(null);
    }
  };

  const handleApproveVideoOrAssembly = async () => {
    if (!projectId) return;
    setIsApprovingAll(true);
    setErrorMsg(null);
    try {
      await apiClient.post(`/projects/${projectId}/messages/respond`, {
        approved: true,
        stage: isApproved ? 'assembly' : 'video',
        reason: isApproved ? 'Confirmed final film assembly' : 'Video shots approved by Director',
      });
      await onRefreshState?.();
    } catch (err) {
      console.error('Failed to approve video', err);
      setErrorMsg('Failed to submit approval. Ensure all shots are completed.');
    } finally {
      setIsApprovingAll(false);
    }
  };

  if (!videoShots || videoShots.length === 0) {
    return (
      <div className={`h-full flex flex-col items-center justify-center p-8 text-center transition-colors duration-300 ${
        isDark ? 'bg-[#08090D] text-slate-300' : 'bg-[#FAF7F2] text-stone-800'
      }`}>
        <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600 mb-4 shadow-sm">
          <Film className="w-8 h-8" />
        </div>
        <h3 className={`text-lg font-serif font-bold mb-2 ${isDark ? 'text-white' : 'text-stone-800'}`}>No Video Shots Rendered Yet</h3>
        <p className="text-stone-500 text-sm max-w-sm leading-relaxed mb-6">
          Once dialogue tracks and character concepts are ready, the Video Agent renders cinematic camera shots and stitches the final film.
        </p>
      </div>
    );
  }

  const activeVideoSrc =
    activeViewMode === 'film' && finalVideoUrl
      ? finalVideoUrl
      : (isSafeMediaUrl(currentSelectedShot?.video_url) ? currentSelectedShot?.video_url : finalVideoUrl);

  return (
    <div className={`h-full flex flex-col overflow-hidden transition-colors duration-300 ${isDark ? 'bg-[#0E111A] text-slate-100' : 'bg-white text-stone-900'}`}>
      <div className={`flex flex-wrap justify-between items-center border-b px-8 py-3.5 gap-4 flex-shrink-0 transition-colors ${isDark ? 'bg-[#0B0D15] border-white/10' : 'bg-stone-50 border-stone-200'}`}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-600">
            <Film className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-stone-900'}`}>
                Video & Master Film Studio
              </h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-stone-200 text-stone-700 font-normal">
                {videoShots.length} Shots ({totalDuration.toFixed(1)}s)
              </span>
            </div>
            <p className="text-[11px] text-stone-500">
              Review each shot independently before confirming final film assembly
            </p>
          </div>
        </div>

        <div className={`flex items-center p-1 rounded-xl text-xs font-medium ${isDark ? 'bg-white/10' : 'bg-stone-200/70'}`}>
          {finalVideoUrl && (
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
          )}
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

          {isApproved && isAssemblyConfirmed ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full border border-green-200">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Film Assembled
            </span>
          ) : (
            <button
              onClick={handleApproveVideoOrAssembly}
              disabled={isApprovingAll}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              {isApprovingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              {isApproved ? 'Confirm & Assemble Master Film' : 'Approve All Shots'}
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="mx-8 mt-4 px-4 py-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
          {errorMsg}
        </div>
      )}

      <div className={`flex-1 flex flex-col lg:flex-row overflow-hidden transition-colors duration-300 ${
        isDark ? 'bg-[#08090D]' : 'bg-[#FAF7F2]'
      }`}>
        <div className="flex-1 flex flex-col p-6 items-center justify-center overflow-y-auto">
          <div className={`w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl flex flex-col border ${
            isDark ? 'bg-[#0E111A] border-white/10 shadow-black/60' : 'bg-stone-900 border-stone-800'
          }`}>
            <div className="relative aspect-video w-full bg-black flex items-center justify-center group">
              {activeVideoSrc ? (
                <video
                  key={activeVideoSrc}
                  ref={mainVideoRef}
                  src={activeVideoSrc}
                  className="w-full h-full object-contain"
                  controls
                  onPlay={() => setIsPlayingMain(true)}
                  onPause={() => setIsPlayingMain(false)}
                  onEnded={() => setIsPlayingMain(false)}
                />
              ) : (
                <div className="text-stone-400 text-sm">Select a completed shot to preview</div>
              )}
            </div>

            <div className="p-4 bg-stone-900 text-stone-200 border-t border-stone-800 flex items-center justify-between">
              <div>
                <h3 className="font-serif font-bold text-white text-base">
                  {activeViewMode === 'film' && finalVideoUrl
                    ? 'Master Assembled Film'
                    : `${currentSelectedShot?.shot_id?.toUpperCase() || 'SHOT'} — ${currentSelectedShot?.speaker || 'Narrator'}`}
                </h3>
                <p className={`text-xs mt-0.5 line-clamp-1 italic ${
                  isDark ? 'text-[#F5E6D3]' : 'text-stone-300'
                }`}>
                  {activeViewMode === 'film' && finalVideoUrl
                    ? 'All shots stitched with synchronized character dialogue and 24fps CFR motion.'
                    : `"${currentSelectedShot?.dialogue || ''}"`}
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

        <div className={`w-full lg:w-96 border-l flex flex-col overflow-hidden flex-shrink-0 transition-colors ${
          isDark ? 'bg-[#0B0D15] border-white/10' : 'bg-white border-stone-200'
        }`}>
          <div className={`px-5 py-3.5 border-b flex items-center justify-between transition-colors ${
            isDark ? 'bg-[#0E111A] border-white/10' : 'bg-stone-50/70 border-stone-200'
          }`}>
            <span className={`font-serif font-bold text-sm ${isDark ? 'text-white' : 'text-stone-800'}`}>Shot Timeline Sequence</span>
            <span className="text-[11px] font-mono text-stone-500">{totalDuration.toFixed(1)}s Total</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {videoShots.map((shot, idx) => {
              const isSelected = currentSelectedShot?.shot_id === shot.shot_id && activeViewMode === 'shots';
              const isFailedQuota = shot.status === 'failed_quota';
              const isNeedsAttention = shot.status === 'needs_attention';
              const isFailed = shot.status === 'failed';
              const isPendingJob = shot.status === 'queued' || shot.status === 'rendering';
              const isRegenerating = regeneratingShotIds.has(shot.shot_id);
              const isShotApproved = Boolean(shot.approved);
              const safeThumb = isSafeMediaUrl(shot.thumbnail_url) ? shot.thumbnail_url : null;

              return (
                <div
                  key={shot.shot_id}
                  onClick={() => {
                    setSelectedShotId(shot.shot_id);
                    setActiveViewMode('shots');
                    setIsPlayingMain(false);
                  }}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    isFailedQuota || isNeedsAttention || isFailed
                      ? isDark ? 'bg-red-950/40 border-red-500/50 ring-1 ring-red-500/30' : 'bg-red-50/60 border-red-300 ring-1 ring-red-400/30'
                      : isSelected
                        ? isDark ? 'bg-orange-500/15 border-orange-500 ring-2 ring-orange-500/30 shadow-xs' : 'bg-orange-50/60 border-orange-400 ring-2 ring-orange-400/20 shadow-xs'
                        : isDark
                          ? 'bg-[#121622] border-white/10 hover:border-orange-500/40 text-slate-200'
                          : 'bg-stone-50/50 border-stone-200/80 hover:bg-stone-50 hover:border-stone-300'
                  }`}
                >
                  <div className="flex gap-3 items-start">
                    <div className="relative w-24 aspect-video rounded-lg overflow-hidden bg-black flex-shrink-0 border border-stone-200 shadow-2xs">
                      {safeThumb ? (
                        <img src={safeThumb} alt={shot.speaker || shot.shot_id} className="w-full h-full object-cover" />
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

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-[10px] uppercase font-bold text-stone-400">
                          Shot {idx + 1}
                        </span>
                        <span className={`text-[11px] font-semibold ${isDark ? 'text-white' : 'text-stone-800'}`}>
                          {shot.speaker || 'Narrator'}
                        </span>
                      </div>
                      <p className={`text-[11px] line-clamp-2 italic font-serif leading-tight mb-1.5 ${
                        isDark ? 'text-[#F5E6D3]' : 'text-[#5C3D24]'
                      }`}>
                        "{shot.dialogue || ''}"
                      </p>

                      <div className="flex flex-wrap gap-1 mb-1">
                        {isPendingJob && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-800 border border-cyan-300 font-medium">
                            {shot.status}
                          </span>
                        )}
                        {isFailedQuota && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-100 text-red-800 border border-red-300 font-medium">
                            ZeroGPU Quota Exceeded
                          </span>
                        )}
                        {isShotApproved && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-100 text-green-800 border border-green-300 font-medium">
                            Approved
                          </span>
                        )}
                      </div>

                      <div className="mt-1 pt-1 border-t border-white/10 flex items-center justify-end gap-1.5">
                        {shot.status === 'completed' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleApproveSingleShot(shot.shot_id, !isShotApproved);
                            }}
                            disabled={approvingShotId === shot.shot_id}
                            className={`px-2 py-0.5 text-[10px] font-medium rounded shadow-2xs transition-colors cursor-pointer ${
                              isShotApproved
                                ? 'bg-green-600 text-white hover:bg-green-700'
                                : 'bg-stone-700 text-white hover:bg-green-600'
                            }`}
                          >
                            {isShotApproved ? 'Approved ✓' : 'Approve Shot'}
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRegenerateShot(shot.shot_id);
                          }}
                          disabled={isRegenerating}
                          className="px-2 py-0.5 text-[10px] font-medium bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded shadow-2xs transition-colors cursor-pointer flex items-center gap-1"
                        >
                          {isRegenerating ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <RotateCcw className="w-2.5 h-2.5" />}
                          {isRegenerating ? 'Regenerating...' : 'Regenerate'}
                        </button>
                      </div>
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
