import { useState, useEffect } from 'react';
import type { WorkflowState } from '../../hooks/useWorkflowState';
import { User, Clock } from 'lucide-react';
import strings from '../../constants/strings.json';

interface CharacterViewerProps {
  workflowState: WorkflowState | null;
}

export function CharacterViewer({ workflowState }: CharacterViewerProps) {
  const currentVersion = workflowState?.character_version || 0;
  const characterHistory = workflowState?.character_history || [];
  
  const [selectedVersion, setSelectedVersion] = useState<number>(currentVersion);
  
  useEffect(() => {
    if (currentVersion > 0) {
      setSelectedVersion(currentVersion);
    }
  }, [currentVersion]);

  if (!workflowState?.characters && characterHistory.length === 0) {
    return <div className="p-8 text-stone-500">{strings.workspace.characterViewer.noCharacters}</div>;
  }

  let charactersToRender: any[] = [];
  if (selectedVersion === currentVersion) {
    charactersToRender = workflowState?.characters || [];
  } else {
    const historical = characterHistory.find((h: any) => h.version === selectedVersion);
    if (historical) {
      charactersToRender = historical.data.characters || [];
    }
  }

  const isApproved = workflowState?.approval_states?.characters_approved && selectedVersion === currentVersion;

  if (charactersToRender.length === 0) {
    return (
      <div className="h-full flex flex-col bg-white overflow-y-auto">
        {currentVersion > 1 && (
          <div className="flex justify-between items-center bg-stone-50 border-b border-stone-200 px-8 py-3">
            <div className="flex items-center gap-2 text-stone-500 text-sm">
              <Clock className="w-4 h-4" />
              <span>{strings.workspace.characterViewer.historyTitle}</span>
            </div>
            <select
              value={selectedVersion}
              onChange={(e) => setSelectedVersion(Number(e.target.value))}
              className="text-sm bg-white border border-stone-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
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
        <div className="p-8 text-stone-500">{strings.workspace.characterViewer.noPhysicalCharacters}</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white overflow-y-auto">
      {/* Version Selector Header */}
      {currentVersion > 1 && (
        <div className="flex justify-between items-center bg-stone-50 border-b border-stone-200 px-8 py-3">
          <div className="flex items-center gap-2 text-stone-500 text-sm">
            <Clock className="w-4 h-4" />
            <span>{strings.workspace.characterViewer.historyTitle}</span>
          </div>
          <select
            value={selectedVersion}
            onChange={(e) => setSelectedVersion(Number(e.target.value))}
            className="text-sm bg-white border border-stone-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
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
      <div className="max-w-3xl mx-auto w-full px-8 py-12">
        <div className="flex items-center gap-4 mb-8">
          <h1 className="text-2xl font-bold text-stone-900">{strings.workspace.characterViewer.title}</h1>
          <span className="text-sm text-stone-500 font-medium tracking-wide uppercase px-2 py-1 bg-stone-100 rounded-md">
            v{selectedVersion}
          </span>
          {isApproved && (
            <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded-md ml-auto">
              {strings.workspace.characterViewer.approved}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-6">
          {charactersToRender.map((char: any, index: number) => (
            <div key={index} className="flex gap-6 p-6 border border-stone-200 rounded-2xl bg-stone-50/50 relative overflow-hidden">
              {/* Character Avatar Placeholder */}
              <div className="w-24 h-24 shrink-0 rounded-xl bg-stone-200 border border-stone-300 flex items-center justify-center relative overflow-hidden shadow-sm">
                {char.image_url ? (
                  <img src={char.image_url} alt={char.name} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-10 h-10 text-stone-400" />
                )}
              </div>
              
              <div className="flex-1">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h2 className="text-lg font-bold text-stone-900">{char.name}</h2>
                    <div className="text-xs font-mono text-stone-400 mt-0.5">{char.character_id || char.id}</div>
                  </div>
                </div>

                <div className="mt-4">
                  <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">{strings.workspace.characterViewer.visualDescription}</h3>
                  <p className="text-sm text-stone-700 leading-relaxed bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
                    {char.visual_description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
