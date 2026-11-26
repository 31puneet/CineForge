import { useState, useEffect } from 'react';
import type { WorkflowState, Character } from '../../hooks/useWorkflowState';
import { useTheme } from '../../context/ThemeContext';
import { Users, Sparkles, CheckCircle2, RefreshCw, Loader2, Clock, User } from 'lucide-react';
import apiClient from '../../api/client';
import strings from '../../constants/strings.json';

interface CharacterViewerProps {
  workflowState: WorkflowState | null;
  projectId?: string;
  onRefreshState?: () => Promise<void>;
}

export function CharacterViewer({ workflowState, projectId, onRefreshState }: CharacterViewerProps) {
  const { isDark } = useTheme();
  const currentVersion = workflowState?.character_version || 0;
  const characterHistory = workflowState?.character_history || [];
  const [selectedVersion, setSelectedVersion] = useState<number>(currentVersion);

  useEffect(() => {
    if (currentVersion > 0) {
      setSelectedVersion(currentVersion);
    }
  }, [currentVersion]);

  let charactersToRender: any[] = [];
  if (selectedVersion === currentVersion) {
    charactersToRender = workflowState?.characters || [];
  } else {
    const historical = characterHistory.find((h: any) => h.version === selectedVersion);
    if (historical) {
      charactersToRender = historical.data.characters || [];
    }
  }

  const isViewingHistory = currentVersion > 0 && selectedVersion !== currentVersion;
  const isApproved = workflowState?.approval_states?.characters_approved && !isViewingHistory;
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [feedbackPrompt, setFeedbackPrompt] = useState('');
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);

  const handleApproveCast = async () => {
    if (!projectId || isViewingHistory) return;
    setIsApproving(true);
    try {
      await apiClient.post(`/projects/${projectId}/messages/respond`, {
        approved: true,
        stage: 'character',
        version: currentVersion || 1
      });
      if (onRefreshState) await onRefreshState();
    } catch (err) {
      console.error('Failed to approve character cast', err);
    } finally {
      setIsApproving(false);
    }
  };

  const handleRegenerate = async (charId: string) => {
    if (!projectId || !charId || isViewingHistory) return;
    setIsRegenerating(true);
    try {
      const res = await apiClient.post(`/projects/${projectId}/characters/${charId}/regenerate`, {
        feedback: feedbackPrompt
      });
      if (res.data?.character) {
        setSelectedCharacter(prev => (prev && (prev.id === charId || (prev as any).character_id === charId) ? res.data.character : prev));
      }
      setFeedbackPrompt('');
      setShowFeedbackInput(false);
      if (onRefreshState) await onRefreshState();
    } catch (err) {
      console.error('Failed to regenerate character portrait', err);
    } finally {
      setIsRegenerating(false);
    }
  };

  if (!charactersToRender || charactersToRender.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-[#FAF7F2]">
        <div className="w-16 h-16 rounded-2xl bg-orange-100 flex items-center justify-center text-orange-500 mb-4 shadow-sm">
          <Users className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-serif font-bold text-stone-800 mb-2">{strings.workspace.characterViewer.title}</h3>
        <p className="text-stone-500 text-sm max-w-sm leading-relaxed">
          {strings.workspace.characterViewer.noCharacters}
        </p>
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col overflow-hidden transition-colors duration-300 ${isDark ? 'bg-[#0E111A] text-slate-100' : 'bg-white text-stone-900'}`}>
      {/* Header Banner */}
      <div className={`flex justify-between items-center border-b px-8 py-3.5 flex-shrink-0 transition-colors ${isDark ? 'bg-[#0B0D15] border-white/10' : 'bg-stone-50 border-stone-200'}`}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-600">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h2 className={`text-sm font-semibold flex items-center gap-2 ${isDark ? 'text-white' : 'text-stone-900'}`}>
              {strings.workspace.characterViewer.title}
              <span className={`text-xs px-2 py-0.5 rounded-full font-normal ${isDark ? 'bg-white/10 text-slate-300' : 'bg-stone-200 text-stone-700'}`}>
                {charactersToRender.length} {charactersToRender.length === 1 ? 'Character' : 'Characters'}
              </span>
            </h2>
            <p className="text-[11px] text-stone-500">Visual references and concept art generated from the script</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {currentVersion > 1 && (
            <div className="flex items-center gap-2 text-stone-500 text-xs">
              <Clock className="w-3.5 h-3.5" />
              <select
                value={selectedVersion}
                onChange={(e) => setSelectedVersion(Number(e.target.value))}
                className={`text-xs rounded-md px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-orange-500 border ${
                  isDark ? 'bg-[#141926] border-white/10 text-slate-200' : 'bg-white border-stone-300 text-stone-900'
                }`}
              >
                {[...Array(currentVersion)].map((_, i) => {
                  const v = currentVersion - i;
                  return (
                    <option key={v} value={v}>
                      {strings.workspace.versioning.version} {v} {v === currentVersion ? strings.workspace.versioning.latest : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {isApproved ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full border border-green-200">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {strings.workspace.characterViewer.approved}
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 text-xs font-medium rounded-full border border-amber-200">
                <Sparkles className="w-3.5 h-3.5" />
                In Review
              </span>
              {projectId && (
                <button
                  onClick={handleApproveCast}
                  disabled={isApproving}
                  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isApproving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Approve Characters
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Characters Grid */}
      <div className={`flex-1 overflow-y-auto p-8 transition-colors duration-300 ${isDark ? 'bg-[#0A0D14]' : 'bg-[#FAF7F2]'}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {charactersToRender.map((char: any, idx: number) => {
            const charId = char.character_id || char.id || `char_${idx + 1}`;
            return (
              <div
                key={charId}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedCharacter({ ...char, id: charId })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedCharacter({ ...char, id: charId });
                  }
                }}
                className={`group rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col cursor-pointer border ${
                  isDark ? 'bg-[#121622] border-white/10 hover:border-orange-500/50' : 'bg-white border-stone-200/80 hover:border-orange-300'
                }`}
              >
                {/* Concept Portrait */}
                <div className="relative aspect-[3/4] w-full bg-stone-900 overflow-hidden">
                  {char.image_url ? (
                    <img
                      src={char.image_url}
                      alt={char.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-stone-400 p-4 text-center">
                      <User className="w-12 h-12 mb-2 opacity-40" />
                      <span className="text-xs">Concept art portrait</span>
                    </div>
                  )}

                  {char.role && (
                    <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md text-white text-[11px] font-medium px-2.5 py-1 rounded-md border border-white/10 shadow-sm">
                      {char.role}
                    </div>
                  )}
                </div>

                {/* Character Details */}
                <div className="p-5 flex flex-col flex-1">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h3 className={`font-serif font-bold text-base transition-colors ${
                      isDark ? 'text-white group-hover:text-orange-400' : 'text-stone-900 group-hover:text-orange-600'
                    }`}>
                      {char.name}
                    </h3>
                    <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border ${
                      isDark ? 'text-slate-400 bg-white/5 border-white/10' : 'text-stone-400 bg-stone-50 border-stone-200'
                    }`}>
                      {charId}
                    </span>
                  </div>

                  <p className={`text-xs leading-relaxed line-clamp-3 mb-4 ${isDark ? 'text-slate-300' : 'text-stone-600'}`}>
                    {char.visual_description || char.description}
                  </p>

                  <div className={`mt-auto pt-3 border-t flex items-center justify-between text-[11px] ${
                    isDark ? 'border-white/10 text-slate-500' : 'border-stone-100 text-stone-400'
                  }`}>
                    <span className="flex items-center gap-1 text-orange-500 font-medium">
                      <Sparkles className="w-3 h-3" /> Click to inspect
                    </span>
                    <span>HD Concept</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Character Detail Modal */}
      {selectedCharacter && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSelectedCharacter(null)}
        >
          <div 
            className={`rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[85vh] border ${
              isDark ? 'bg-[#121622] border-white/10 text-slate-100' : 'bg-white border-stone-200 text-stone-900'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="md:w-1/2 bg-stone-950 aspect-[3/4] md:aspect-auto relative">
              {selectedCharacter.image_url ? (
                <img 
                  src={selectedCharacter.image_url} 
                  alt={selectedCharacter.name} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-stone-500">
                  <User className="w-16 h-16 opacity-30" />
                </div>
              )}
            </div>

            <div className="p-6 md:w-1/2 flex flex-col overflow-y-auto">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-700">
                  {selectedCharacter.role || 'Character'}
                </span>
                <button 
                  onClick={() => setSelectedCharacter(null)}
                  className="text-stone-400 hover:text-stone-600 text-sm font-bold w-6 h-6 rounded-full hover:bg-stone-100 flex items-center justify-center"
                >
                  ✕
                </button>
              </div>

              <h2 className={`text-2xl font-serif font-bold mb-4 ${isDark ? 'text-white' : 'text-stone-900'}`}>
                {selectedCharacter.name}
              </h2>

              <div className="mb-4">
                <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">
                  Visual Profile
                </h4>
                <p className={`text-xs leading-relaxed p-3 rounded-xl border ${
                  isDark ? 'bg-[#0E111A] border-white/10 text-slate-300' : 'bg-stone-50 border-stone-200 text-stone-700'
                }`}>
                  {selectedCharacter.visual_description || selectedCharacter.description}
                </p>
              </div>

              {selectedCharacter.image_prompt && (
                <div className="mb-6">
                  <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">
                    Concept Art Prompt
                  </h4>
                  <p className={`text-[11px] font-mono p-2.5 rounded-lg border leading-normal ${
                    isDark ? 'bg-[#0E111A] border-white/10 text-slate-400' : 'bg-stone-100 border-stone-200 text-stone-600'
                  }`}>
                    {selectedCharacter.image_prompt}
                  </p>
                </div>
              )}

              <div className={`mt-auto pt-4 border-t flex items-center justify-between gap-2 ${
                isDark ? 'border-white/10' : 'border-stone-100'
              }`}>
                {projectId && (
                  <button
                    type="button"
                    onClick={() => setShowFeedbackInput(!showFeedbackInput)}
                    className="text-xs text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
                    {showFeedbackInput ? 'Cancel' : 'Regenerate Portrait'}
                  </button>
                )}
                <button
                  onClick={() => {
                    setSelectedCharacter(null);
                    setShowFeedbackInput(false);
                  }}
                  className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors ml-auto cursor-pointer ${
                    isDark ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-stone-900 hover:bg-stone-800 text-white'
                  }`}
                >
                  Close
                </button>
              </div>

              {showFeedbackInput && projectId && (
                <div className="mt-3 p-3 bg-stone-50 rounded-xl border border-stone-200 flex flex-col gap-2">
                  <textarea
                    placeholder="Tweak character appearance..."
                    value={feedbackPrompt}
                    onChange={(e) => setFeedbackPrompt(e.target.value)}
                    className="w-full text-xs p-2 bg-white border border-stone-200 rounded-lg resize-none h-16 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                  <button
                    onClick={() => handleRegenerate(selectedCharacter.id || selectedCharacter.character_id || '')}
                    disabled={isRegenerating}
                    className="self-end px-3 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    {isRegenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    Regenerate
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
