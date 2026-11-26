import { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import type { Project, ScriptData, ScriptHistoryEntry, ScriptShot, WorkflowState } from '../../types/workflow';
import strings from '../../constants/strings.json';
import { Check, Clock } from 'lucide-react';

interface ScriptViewerProps {
  project: Project;
  workflowState: WorkflowState | null;
  onReject?: () => void;
  onApprove?: () => Promise<void>;
}

export function ScriptViewer({ workflowState }: ScriptViewerProps) {
  const { isDark } = useTheme();
  const currentVersion = workflowState?.script_version || 0;
  const scriptHistory = workflowState?.script_history || [];
  
  const [versionSelection, setVersionSelection] = useState<{ baseVersion: number; pickedVersion: number } | null>(null);
  const selectedVersion =
    versionSelection && versionSelection.baseVersion === currentVersion
      ? versionSelection.pickedVersion
      : currentVersion;
  const setSelectedVersion = (pickedVersion: number) => {
    setVersionSelection({ baseVersion: currentVersion, pickedVersion });
  };

  if (!workflowState || !workflowState.script_data) {
    return <div className="p-8 text-stone-500">{strings.workspace.scriptViewer.noScript}</div>;
  }

  // Get the script data for the selected version
  let scriptDataToRender: ScriptData | null = null;
  if (selectedVersion === currentVersion) {
    scriptDataToRender = workflowState.script_data as ScriptData;
  } else {
    const historical = scriptHistory.find((h: ScriptHistoryEntry) => h.version === selectedVersion);
    if (historical) {
      scriptDataToRender = historical.data;
    }
  }

  const isApproved = workflowState.approval_states?.script_approved && selectedVersion === currentVersion;

  return (
    <div className={`h-full flex flex-col transition-colors duration-300 ${isDark ? 'bg-[#0E111A] text-slate-100' : 'bg-white text-stone-900'}`}>
      {/* Version Selector Header */}
      {currentVersion > 1 && (
        <div className={`flex justify-between items-center border-b px-8 py-3 transition-colors ${isDark ? 'bg-[#0B0D15] border-white/10' : 'bg-stone-50 border-stone-200'}`}>
          <div className={`flex items-center gap-2 text-sm ${isDark ? 'text-slate-400' : 'text-stone-500'}`}>
            <Clock className="w-4 h-4" />
            <span>{strings.workspace.scriptViewer.historyTitle}</span>
          </div>
          <select 
            value={selectedVersion}
            onChange={(e) => setSelectedVersion(Number(e.target.value))}
            className={`border text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-medium ${
              isDark ? 'bg-[#141926] border-white/10 text-slate-200' : 'bg-white border-stone-200 text-stone-700'
            }`}
          >
            {scriptHistory.map((historyItem: ScriptHistoryEntry) => (
              <option key={historyItem.version} value={historyItem.version}>
                {strings.workspace.versioning.version} {historyItem.version} {historyItem.version === currentVersion ? strings.workspace.versioning.latest : ''}
              </option>
            )).reverse()}
            {/* If script_history doesn't contain the current version yet, show it */}
            {!scriptHistory.find((h: ScriptHistoryEntry) => h.version === currentVersion) && (
               <option value={currentVersion}>
                 {strings.workspace.versioning.version} {currentVersion} {strings.workspace.versioning.latest}
               </option>
            )}
          </select>
        </div>
      )}

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-8 font-sans max-w-3xl mx-auto w-full">
        <h1 className={`text-3xl font-bold mb-6 text-center tracking-tight ${isDark ? 'text-white' : 'text-stone-900'}`}>
          {strings.workspace.scriptViewer.title} {selectedVersion > 0 && <span className="text-stone-400 font-medium ml-2">v{selectedVersion}</span>}
        </h1>
        
        {scriptDataToRender?.global_narrative && (
          <div className={`mb-8 p-4 rounded-xl border shadow-sm italic text-lg leading-relaxed ${
            isDark ? 'bg-[#141926] border-white/10 text-slate-200' : 'bg-[#F3ECE5] border-stone-200 text-stone-800'
          }`}>
            {scriptDataToRender.global_narrative}
          </div>
        )}

        <div className="space-y-8">
          {scriptDataToRender?.shots?.map((shot: ScriptShot, index: number) => (
            <div key={shot.shot_id || shot.id || index} className={`border-t pt-6 ${isDark ? 'border-white/10' : 'border-stone-200'}`}>
              <div className="flex justify-between items-end mb-4">
                <h3 className={`font-bold uppercase tracking-widest text-sm ${isDark ? 'text-orange-400' : 'text-stone-900'}`}>
                  {strings.workspace.scriptViewer.scene} {index + 1}
                </h3>
                <span className={`text-xs font-mono px-2 py-1 rounded ${isDark ? 'bg-white/10 text-slate-300' : 'bg-stone-100 text-stone-600'}`}>
                  {shot.duration_seconds ?? shot.duration_sec}s
                </span>
              </div>
              
              <div className={`leading-relaxed mb-4 whitespace-pre-wrap font-medium ${isDark ? 'text-slate-300' : 'text-stone-800'}`}>
                {shot.visual_description || shot.description}
              </div>

              {shot.dialogue && (
                <div className="max-w-md mx-auto mt-4 mb-4">
                  <div className={`text-center font-bold uppercase tracking-wide text-sm mb-1 ${isDark ? 'text-slate-200' : 'text-stone-900'}`}>
                    {shot.speaker || strings.workspace.scriptViewer.unknownSpeaker}
                  </div>
                  <div className={`text-center italic font-serif ${isDark ? 'text-[#F5E6D3]' : 'text-[#5C3D24]'}`}>
                    "{shot.dialogue}"
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      
      {isApproved && (
        <div className="bg-green-50 border-t border-green-200 p-4 text-center text-green-800 font-medium flex items-center justify-center gap-2">
          <Check className="w-5 h-5" />
          {strings.workspace.scriptViewer.scriptApproved}
        </div>
      )}
      
      {!isApproved && selectedVersion !== currentVersion && (
        <div className="bg-orange-50 border-t border-orange-200 p-4 text-center text-orange-800 font-medium flex items-center justify-center gap-2">
          You are viewing an older version of the script.
        </div>
      )}
    </div>
  );
}
