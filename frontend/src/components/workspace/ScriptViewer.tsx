import { useState, useEffect } from 'react';
import type { WorkflowState } from '../../hooks/useWorkflowState';
import strings from '../../constants/strings.json';
import { Check, Clock } from 'lucide-react';

interface ScriptViewerProps {
  project: any;
  workflowState: WorkflowState | null;
  onReject?: () => void;
  onApprove?: () => Promise<void>;
}

interface Shot {
  shot_id: string;
  visual_description: string;
  duration_seconds: number;
  dialogue?: string;
  speaker?: string;
}

interface ScriptData {
  global_narrative: string;
  shots: Shot[];
}

export function ScriptViewer({ workflowState }: ScriptViewerProps) {
  const currentVersion = workflowState?.script_version || 0;
  const scriptHistory = workflowState?.script_history || [];
  
  const [selectedVersion, setSelectedVersion] = useState<number>(currentVersion);
  
  // Update selected version if current version changes
  useEffect(() => {
    if (currentVersion > 0) {
      setSelectedVersion(currentVersion);
    }
  }, [currentVersion]);

  if (!workflowState || !workflowState.script_data) {
    return <div className="p-8 text-stone-500">{strings.workspace.scriptViewer.noScript}</div>;
  }

  // Get the script data for the selected version
  let scriptDataToRender: ScriptData | null = null;
  if (selectedVersion === currentVersion) {
    scriptDataToRender = workflowState.script_data as ScriptData;
  } else {
    const historical = scriptHistory.find((h: any) => h.version === selectedVersion);
    if (historical) {
      scriptDataToRender = historical.data as ScriptData;
    }
  }

  const isApproved = workflowState.approval_states?.script_approved && selectedVersion === currentVersion;

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Version Selector Header */}
      {currentVersion > 1 && (
        <div className="flex justify-between items-center bg-stone-50 border-b border-stone-200 px-8 py-3">
          <div className="flex items-center gap-2 text-stone-500 text-sm">
            <Clock className="w-4 h-4" />
            <span>{strings.workspace.scriptViewer.historyTitle}</span>
          </div>
          <select 
            value={selectedVersion}
            onChange={(e) => setSelectedVersion(Number(e.target.value))}
            className="bg-white border border-stone-200 text-stone-700 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-medium"
          >
            {scriptHistory.map((historyItem: any) => (
              <option key={historyItem.version} value={historyItem.version}>
                {strings.workspace.versioning.version} {historyItem.version} {historyItem.version === currentVersion ? strings.workspace.versioning.latest : ''}
              </option>
            )).reverse()}
            {/* If script_history doesn't contain the current version yet, show it */}
            {!scriptHistory.find((h: any) => h.version === currentVersion) && (
               <option value={currentVersion}>
                 {strings.workspace.versioning.version} {currentVersion} {strings.workspace.versioning.latest}
               </option>
            )}
          </select>
        </div>
      )}

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-8 font-sans max-w-3xl mx-auto w-full">
        <h1 className="text-3xl font-bold text-stone-900 mb-6 text-center tracking-tight">
          {strings.workspace.scriptViewer.title} {selectedVersion > 0 && <span className="text-stone-400 font-medium ml-2">v{selectedVersion}</span>}
        </h1>
        
        {scriptDataToRender?.global_narrative && (
          <div className="mb-8 p-4 bg-[#F3ECE5] rounded-xl border border-stone-200 shadow-sm text-stone-800 italic text-lg leading-relaxed">
            {scriptDataToRender.global_narrative}
          </div>
        )}

        <div className="space-y-8">
          {scriptDataToRender?.shots?.map((shot: Shot, index: number) => (
            <div key={shot.shot_id || index} className="border-t border-stone-200 pt-6">
              <div className="flex justify-between items-end mb-4">
                <h3 className="font-bold text-stone-900 uppercase tracking-widest text-sm">
                  {strings.workspace.scriptViewer.scene} {index + 1}
                </h3>
                <span className="text-xs font-mono bg-stone-100 text-stone-600 px-2 py-1 rounded">
                  {shot.duration_seconds}s
                </span>
              </div>
              
              <div className="text-stone-800 leading-relaxed mb-4 whitespace-pre-wrap font-medium">
                {shot.visual_description}
              </div>

              {shot.dialogue && (
                <div className="max-w-md mx-auto mt-4 mb-4">
                  <div className="text-center font-bold text-stone-900 uppercase tracking-wide text-sm mb-1">
                    {shot.speaker || strings.workspace.scriptViewer.unknownSpeaker}
                  </div>
                  <div className="text-center text-stone-700 italic">
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
