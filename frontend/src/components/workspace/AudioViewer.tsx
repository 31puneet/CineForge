import { useState, useRef, useEffect } from 'react';
import type { Character, Voiceover, WorkflowState } from '../../types/workflow';
import { useTheme } from '../../context/ThemeContext';
import { Volume2, Play, Pause, Sparkles, CheckCircle2, RotateCcw, Loader2, Music2, User, Users, Edit3 } from 'lucide-react';
import apiClient from '../../api/client';

interface AudioViewerProps {
  workflowState: WorkflowState | null;
  projectId?: string;
  onRefreshState?: () => Promise<void>;
}

const VOICE_OPTIONS = [
  { id: 'en-US-ChristopherNeural', label: 'Christopher (Male)' },
  { id: 'en-US-GuyNeural', label: 'Guy (Male)' },
  { id: 'en-US-BrianNeural', label: 'Brian (Tactical Male)' },
  { id: 'en-US-EricNeural', label: 'Eric (Youth Male)' },
  { id: 'en-US-JennyNeural', label: 'Jenny (Female)' },
  { id: 'en-US-AvaNeural', label: 'Ava (Female)' },
  { id: 'en-US-AriaNeural', label: 'Aria (Dramatic Female)' },
  { id: 'en-US-AnaNeural', label: 'Ana (Bright Youth)' },
];

export function AudioViewer({ workflowState, projectId, onRefreshState }: AudioViewerProps) {
  const { isDark } = useTheme();
  const voiceovers = workflowState?.voiceovers || [];
  const isApproved = Boolean(workflowState?.approval_states?.voiceovers_approved);
  const [playingShotId, setPlayingShotId] = useState<string | null>(null);
  const [regeneratingShotId, setRegeneratingShotId] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all');
  const [editingShotId, setEditingShotId] = useState<string | null>(null);
  const [editedDialogue, setEditedDialogue] = useState('');
  const [editedVoiceId, setEditedVoiceId] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});

  useEffect(() => {
    const refs = audioRefs.current;
    return () => {
      Object.values(refs).forEach((audio) => {
        if (audio) audio.pause();
      });
    };
  }, []);

  const charactersMap = (workflowState?.characters || []).reduce<Record<string, Character>>((acc, c) => {
    if (c.name) acc[c.name.toLowerCase()] = c;
    if (c.id) acc[c.id.toLowerCase()] = c;
    return acc;
  }, {});

  const togglePlay = async (shotId: string) => {
    const audio = audioRefs.current[shotId];
    if (!audio) return;

    if (playingShotId === shotId) {
      audio.pause();
      setPlayingShotId(null);
    } else {
      if (playingShotId && audioRefs.current[playingShotId]) {
        audioRefs.current[playingShotId]?.pause();
      }
      try {
        await audio.play();
        setPlayingShotId(shotId);
      } catch (err) {
        console.error('Audio playback failed:', err);
        setPlayingShotId(null);
      }
    }
  };

  const handleAudioEnded = () => {
    setPlayingShotId(null);
  };

  const handleRegenerate = async (shotId: string, dialogue?: string, voiceId?: string) => {
    if (!projectId) return;
    setRegeneratingShotId(shotId);
    setErrorMsg(null);
    try {
      await apiClient.post(`/projects/${projectId}/messages/regenerate-voiceover`, {
        shotId,
        dialogue: dialogue?.trim() || undefined,
        voiceId: voiceId || undefined,
      });
      setEditingShotId(null);
      await onRefreshState?.();
    } catch (err) {
      console.error('Failed to regenerate voiceover', err);
      setErrorMsg(`Failed to regenerate voiceover for ${shotId}.`);
    } finally {
      setRegeneratingShotId(null);
    }
  };

  const handleApproveAll = async () => {
    if (!projectId) return;
    setIsApproving(true);
    setErrorMsg(null);
    try {
      await apiClient.post(`/projects/${projectId}/messages/respond`, {
        approved: true,
        stage: 'voiceover',
        reason: 'Audio & voiceovers approved by Director',
      });
      await onRefreshState?.();
    } catch (err) {
      console.error('Failed to approve voiceovers', err);
      setErrorMsg('Failed to approve voiceover tracks.');
    } finally {
      setIsApproving(false);
    }
  };

  const getGender = (vo: Voiceover) => {
    if (vo.gender) return vo.gender.toLowerCase();
    const speakerKey = (vo.speaker || '').toLowerCase();
    const char = speakerKey ? charactersMap[speakerKey] : undefined;
    if (char?.gender) return char.gender.toLowerCase();
    const s = `${vo.speaker || ''} ${vo.voice_name || ''}`.toLowerCase();
    if (s.includes('female') || s.includes('ava') || s.includes('jenny')) {
      return 'female';
    }
    return 'male';
  };

  const boyCount = voiceovers.filter((v) => getGender(v) === 'male').length;
  const girlCount = voiceovers.filter((v) => getGender(v) === 'female').length;

  const filteredVoiceovers = voiceovers.filter((vo) => {
    if (genderFilter === 'all') return true;
    return getGender(vo) === genderFilter;
  });

  if (!voiceovers || voiceovers.length === 0) {
    return (
      <div className={`h-full flex flex-col items-center justify-center p-8 text-center transition-colors duration-300 ${isDark ? 'bg-[#0E111A] text-slate-300' : 'bg-[#FAF7F2]'}`}>
        <div className="w-16 h-16 rounded-2xl bg-cyan-100 flex items-center justify-center text-cyan-600 mb-4 shadow-sm">
          <Volume2 className="w-8 h-8" />
        </div>
        <h3 className={`text-lg font-serif font-bold mb-2 ${isDark ? 'text-white' : 'text-stone-800'}`}>No Dialogue Tracks Generated Yet</h3>
        <p className="text-stone-500 text-sm max-w-sm leading-relaxed mb-6">
          Once your character cast is approved, the Voiceover Agent will automatically cast neural voices and record audio for every line of dialogue in your script.
        </p>
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col overflow-hidden transition-colors duration-300 ${isDark ? 'bg-[#0E111A] text-slate-100' : 'bg-white text-stone-900'}`}>
      <div className={`flex flex-wrap justify-between items-center border-b px-8 py-3.5 gap-4 flex-shrink-0 transition-colors ${isDark ? 'bg-[#0B0D15] border-white/10' : 'bg-stone-50 border-stone-200'}`}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-600">
            <Volume2 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-stone-900'}`}>
                Voiceover & Dialogue Tracks
              </h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-stone-200 text-stone-700 font-normal">
                {voiceovers.length} Tracks
              </span>
            </div>
            <p className="text-[11px] text-stone-500">
              Classified neural voices ({boyCount} Male / {girlCount} Female)
            </p>
          </div>
        </div>

        <div className={`flex items-center p-1 rounded-xl text-xs font-medium ${isDark ? 'bg-white/10' : 'bg-stone-200/70'}`}>
          <button
            onClick={() => setGenderFilter('all')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all cursor-pointer ${
              genderFilter === 'all'
                ? isDark ? 'bg-[#141926] text-white shadow-xs font-semibold' : 'bg-white text-stone-900 shadow-xs font-semibold'
                : isDark ? 'text-slate-400 hover:text-white' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            All ({voiceovers.length})
          </button>
          <button
            onClick={() => setGenderFilter('male')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all cursor-pointer ${
              genderFilter === 'male'
                ? 'bg-blue-600 text-white shadow-xs font-semibold'
                : 'text-stone-600 hover:text-blue-700'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            Boys / Male ({boyCount})
          </button>
          <button
            onClick={() => setGenderFilter('female')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all cursor-pointer ${
              genderFilter === 'female'
                ? 'bg-purple-600 text-white shadow-xs font-semibold'
                : 'text-stone-600 hover:text-purple-700'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            Girls / Female ({girlCount})
          </button>
        </div>

        <div className="flex items-center gap-3">
          {isApproved ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full border border-green-200">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Audio Approved
            </span>
          ) : (
            <>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 text-xs font-medium rounded-full border border-amber-200">
                <Sparkles className="w-3.5 h-3.5" />
                In Review
              </span>
              <button
                onClick={handleApproveAll}
                disabled={isApproving}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                {isApproving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Approve Audio Tracks
              </button>
            </>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="mx-8 mt-4 px-4 py-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
          {errorMsg}
        </div>
      )}

      <div className={`flex-1 overflow-y-auto p-8 transition-colors duration-300 ${isDark ? 'bg-[#0A0D14]' : 'bg-[#FAF7F2]'}`}>
        <div className="max-w-4xl mx-auto space-y-4">
          {filteredVoiceovers.map((vo, idx) => {
            const speakerName = vo.speaker || 'Narrator';
            const char = charactersMap[speakerName.toLowerCase()];
            const isPlaying = playingShotId === vo.shot_id;
            const isRegen = regeneratingShotId === vo.shot_id;
            const isEditing = editingShotId === vo.shot_id;
            const gender = getGender(vo);
            const isFemale = gender === 'female';

            return (
              <div
                key={vo.shot_id || idx}
                className={`rounded-2xl border transition-all duration-200 p-5 shadow-sm hover:shadow-md ${
                  isPlaying ? 'border-orange-400 ring-2 ring-orange-400/20' : isDark ? 'bg-[#121622] border-white/10' : 'bg-white border-stone-200/80'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`relative w-14 h-14 rounded-xl overflow-hidden bg-stone-900 flex-shrink-0 shadow-xs border ${
                    isDark ? 'border-white/10' : 'border-stone-200'
                  }`}>
                    {char?.image_url ? (
                      <img src={char.image_url} alt={speakerName} className="w-full h-full object-cover" />
                    ) : (
                      <div className={`w-full h-full flex items-center justify-center text-white font-bold text-lg bg-gradient-to-br ${
                        isFemale ? 'from-purple-500 to-pink-600' : 'from-blue-500 to-indigo-700'
                      }`}>
                        {speakerName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <h4 className={`font-serif font-bold text-base ${isDark ? 'text-white' : 'text-stone-900'}`}>{speakerName}</h4>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          isFemale
                            ? 'bg-purple-50 text-purple-700 border-purple-200/70'
                            : 'bg-blue-50 text-blue-700 border-blue-200/70'
                        }`}>
                          {isFemale ? '♀ Girl / Female' : '♂ Boy / Male'}
                        </span>
                        {vo.voice_name && (
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                            isDark ? 'bg-white/10 text-slate-300 border-white/10' : 'bg-stone-100 text-stone-700 border-stone-200'
                          }`}>
                            {vo.voice_name}
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-mono uppercase tracking-wider text-stone-400">
                        {(vo.shot_id || `shot_${idx + 1}`).replaceAll('_', ' ').toUpperCase()}
                      </span>
                    </div>

                    {isEditing ? (
                      <div className="mb-3 space-y-2">
                        <textarea
                          value={editedDialogue}
                          onChange={(e) => setEditedDialogue(e.target.value)}
                          className={`w-full p-2.5 text-sm rounded-lg border focus:outline-none focus:ring-1 focus:ring-orange-500 ${
                            isDark ? 'bg-[#0E111A] border-white/10 text-white' : 'bg-stone-50 border-stone-200 text-stone-900'
                          }`}
                          rows={2}
                        />
                        <div className="flex items-center gap-2">
                          <select
                            value={editedVoiceId}
                            onChange={(e) => setEditedVoiceId(e.target.value)}
                            className={`text-xs px-2.5 py-1.5 rounded-lg border ${
                              isDark ? 'bg-[#0E111A] border-white/10 text-slate-200' : 'bg-white border-stone-200 text-stone-700'
                            }`}
                          >
                            {VOICE_OPTIONS.map((opt) => (
                              <option key={opt.id} value={opt.id}>{opt.label}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleRegenerate(vo.shot_id, editedDialogue, editedVoiceId)}
                            disabled={isRegen || !editedDialogue.trim()}
                            className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg cursor-pointer"
                          >
                            Save & Regenerate
                          </button>
                          <button
                            onClick={() => setEditingShotId(null)}
                            className="px-2.5 py-1.5 text-xs text-stone-400 hover:text-stone-600 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className={`text-sm italic font-serif leading-relaxed mb-3 ${
                        isDark ? 'text-[#F5E6D3]' : 'text-[#5C3D24]'
                      }`}>
                        "{vo.dialogue}"
                      </p>
                    )}

                    <div className={`flex items-center gap-4 rounded-xl px-4 py-2 border transition-colors ${
                      isDark ? 'bg-black/40 border-white/10' : 'bg-[#FAF7F2] border-stone-200/60'
                    }`}>
                      <button
                        onClick={() => togglePlay(vo.shot_id)}
                        disabled={!vo.audio_url}
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer disabled:opacity-40 ${
                          isPlaying
                            ? isFemale ? 'bg-purple-600 text-white shadow-md scale-105' : 'bg-blue-600 text-white shadow-md scale-105'
                            : isDark
                              ? 'bg-white/10 text-white hover:text-orange-400 border border-white/10 shadow-xs'
                              : 'bg-white text-stone-800 hover:text-orange-600 shadow-xs border border-stone-200'
                        }`}
                      >
                        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                      </button>

                      <div className="flex-1 flex items-center gap-1 h-6">
                        {[40, 65, 85, 30, 95, 60, 45, 90, 70, 50, 80, 40, 75, 55, 90, 65, 35, 85, 50, 70].map((h, i) => (
                          <div
                            key={i}
                            className={`flex-1 rounded-full transition-all duration-300 ${
                              isPlaying
                                ? isFemale ? 'bg-purple-500 animate-pulse' : 'bg-blue-500 animate-pulse'
                                : isDark ? 'bg-white/20' : 'bg-stone-300'
                            }`}
                            style={{
                              height: isPlaying ? `${Math.max(20, h * (i % 2 === 0 ? 1 : 0.8))}%` : '30%',
                            }}
                          />
                        ))}
                      </div>

                      <div className="flex items-center gap-2 text-xs font-mono text-stone-500">
                        <Music2 className="w-3.5 h-3.5 text-stone-400" />
                        <span>{vo.duration_seconds || 3.0}s</span>
                      </div>

                      <button
                        onClick={() => {
                          setEditingShotId(vo.shot_id);
                          setEditedDialogue(vo.dialogue || '');
                          setEditedVoiceId(vo.voice_id || VOICE_OPTIONS[0].id);
                        }}
                        className="p-1.5 text-stone-400 hover:text-orange-500 rounded-lg transition-colors cursor-pointer"
                        title="Edit dialogue or voice"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleRegenerate(vo.shot_id)}
                        disabled={isRegen}
                        className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                        title="Regenerate voiceover line"
                      >
                        {isRegen ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                      </button>

                      {vo.audio_url && (
                        <audio
                          ref={(el) => {
                            audioRefs.current[vo.shot_id] = el;
                          }}
                          src={vo.audio_url}
                          onEnded={handleAudioEnded}
                          preload="auto"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
