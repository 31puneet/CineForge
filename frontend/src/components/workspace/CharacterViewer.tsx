import { useState } from 'react';
import type { WorkflowState, Character } from '../../hooks/useWorkflowState';
import { Users, Sparkles, CheckCircle2, RefreshCw, Loader2 } from 'lucide-react';
import apiClient from '../../api/client';

interface CharacterViewerProps {
  workflowState: WorkflowState | null;
  projectId?: string;
  onRefreshState?: () => Promise<void>;
}

export function CharacterViewer({ workflowState, projectId, onRefreshState }: CharacterViewerProps) {
  const characters = workflowState?.characters || [];
  const isApproved = workflowState?.approval_states?.characters_approved;
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [feedbackPrompt, setFeedbackPrompt] = useState('');
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);

  const handleApproveCast = async () => {
    if (!projectId) return;
    setIsApproving(true);
    try {
      await apiClient.post(`/projects/${projectId}/messages/respond`, {
        approved: true,
        stage: 'character',
        version: 1
      });
      if (onRefreshState) await onRefreshState();
    } catch (err) {
      console.error('Failed to approve character cast', err);
    } finally {
      setIsApproving(false);
    }
  };

  const handleRegenerate = async (charId: string) => {
    if (!projectId) return;
    setIsRegenerating(true);
    try {
      const res = await apiClient.post(`/projects/${projectId}/characters/${charId}/regenerate`, {
        feedback: feedbackPrompt
      });
      if (res.data?.character) {
        setSelectedCharacter(res.data.character);
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


  if (!characters || characters.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-[#FAF7F2]">
        <div className="w-16 h-16 rounded-2xl bg-orange-100 flex items-center justify-center text-orange-500 mb-4 shadow-sm">
          <Users className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-serif font-bold text-stone-800 mb-2">No Characters Designed Yet</h3>
        <p className="text-stone-500 text-sm max-w-sm leading-relaxed">
          Once your script is approved, the Character Agent will automatically analyze the cast, design visual concept sheets, and generate character portraits.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      {/* Header Banner */}
      <div className="flex justify-between items-center bg-stone-50 border-b border-stone-200 px-8 py-3.5 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-600">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
              Character Concept Sheets
              <span className="text-xs px-2 py-0.5 rounded-full bg-stone-200 text-stone-700 font-normal">
                {characters.length} {characters.length === 1 ? 'Cast Member' : 'Cast Members'}
              </span>
            </h2>
            <p className="text-[11px] text-stone-500">Visual references and concept art generated from the script</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isApproved ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full border border-green-200">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Cast Approved
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 text-xs font-medium rounded-full border border-amber-200">
                <Sparkles className="w-3.5 h-3.5" />
                In Review
              </span>
              <button
                onClick={handleApproveCast}
                disabled={isApproving}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isApproving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Approve Cast & Proceed
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Characters Grid */}
      <div className="flex-1 overflow-y-auto p-8 bg-[#FAF7F2]">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {characters.map((char) => (
            <div
              key={char.id}
              onClick={() => setSelectedCharacter(char)}
              className="group bg-white rounded-2xl border border-stone-200/80 hover:border-orange-300 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col cursor-pointer"
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
                    <Users className="w-12 h-12 mb-2 opacity-40" />
                    <span className="text-xs">Concept art rendering...</span>
                  </div>
                )}

                {/* Role Badge Overlay */}
                {char.role && (
                  <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md text-white text-[11px] font-medium px-2.5 py-1 rounded-md border border-white/10 shadow-sm">
                    {char.role}
                  </div>
                )}
              </div>

              {/* Character Details */}
              <div className="p-5 flex flex-col flex-1">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="font-serif font-bold text-stone-900 text-base group-hover:text-orange-600 transition-colors">
                    {char.name}
                  </h3>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-stone-400 bg-stone-50 px-2 py-0.5 rounded border border-stone-200">
                    {char.id}
                  </span>
                </div>

                <p className="text-stone-600 text-xs leading-relaxed line-clamp-3 mb-4">
                  {char.description}
                </p>

                <div className="mt-auto pt-3 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-400">
                  <span className="flex items-center gap-1 text-orange-500 font-medium">
                    <Sparkles className="w-3 h-3" /> Click to inspect
                  </span>
                  <span>Cinematic 8K</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Character Detail Modal */}
      {selectedCharacter && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSelectedCharacter(null)}
        >
          <div 
            className="bg-white rounded-2xl max-w-2xl w-full border border-stone-200 shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Image */}
            <div className="md:w-1/2 bg-stone-950 aspect-[3/4] md:aspect-auto relative">
              {selectedCharacter.image_url ? (
                <img 
                  src={selectedCharacter.image_url} 
                  alt={selectedCharacter.name} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-stone-500">
                  No image available
                </div>
              )}
            </div>

            {/* Modal Details */}
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

              <h2 className="text-2xl font-serif font-bold text-stone-900 mb-4">
                {selectedCharacter.name}
              </h2>

              <div className="mb-4">
                <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">
                  Visual & Personality Profile
                </h4>
                <p className="text-xs text-stone-700 leading-relaxed bg-stone-50 p-3 rounded-xl border border-stone-200">
                  {selectedCharacter.description}
                </p>
              </div>

              {selectedCharacter.image_prompt && (
                <div className="mb-6">
                  <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">
                    Concept Art Prompt
                  </h4>
                  <p className="text-[11px] font-mono text-stone-600 bg-stone-100 p-2.5 rounded-lg border border-stone-200 leading-normal">
                    {selectedCharacter.image_prompt}
                  </p>
                </div>
              )}

              <div className="mt-auto pt-4 border-t border-stone-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setShowFeedbackInput(!showFeedbackInput)}
                  className="text-xs text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
                  {showFeedbackInput ? 'Cancel' : 'Regenerate Portrait'}
                </button>
                <button
                  onClick={() => {
                    setSelectedCharacter(null);
                    setShowFeedbackInput(false);
                  }}
                  className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  Close Profile
                </button>
              </div>

              {showFeedbackInput && (
                <div className="mt-3 p-3 bg-stone-50 rounded-xl border border-stone-200 flex flex-col gap-2">
                  <textarea
                    placeholder="Optional: How would you like to tweak this character's look? (e.g. darker armor, glowing eyes)"
                    value={feedbackPrompt}
                    onChange={(e) => setFeedbackPrompt(e.target.value)}
                    className="w-full text-xs p-2 bg-white border border-stone-200 rounded-lg resize-none h-16 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                  <button
                    onClick={() => handleRegenerate(selectedCharacter.id)}
                    disabled={isRegenerating}
                    className="self-end px-3 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    {isRegenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    Generate New Concept
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
