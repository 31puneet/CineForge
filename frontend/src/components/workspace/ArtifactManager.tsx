import { useState, useRef } from 'react';
import { Folder, Search, ChevronRight, Upload, Loader2, Users, Volume2, Film } from 'lucide-react';
import { useAssetUpload } from '../../hooks/useAssetUpload';
import { useTheme } from '../../context/ThemeContext';
import type { Project, WorkflowState } from '../../types/workflow';
import strings from '../../constants/strings.json';

interface ArtifactManagerProps {
  project: Project;
  workflowState?: WorkflowState | null;
  onSelectScript?: () => void;
  hasScript?: boolean;
  onSelectCharacters?: () => void;
  hasCharacters?: boolean;
  characterCount?: number;
  onSelectAudio?: () => void;
  hasAudio?: boolean;
  audioCount?: number;
  onSelectVideo?: () => void;
  hasVideo?: boolean;
  videoCount?: number;
}

export function ArtifactManager({
  project,
  workflowState,
  onSelectScript,
  hasScript,
  onSelectCharacters,
  hasCharacters,
  characterCount = 0,
  onSelectAudio,
  hasAudio,
  audioCount = 0,
  onSelectVideo,
  hasVideo,
  videoCount = 0,
}: ArtifactManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isDark } = useTheme();
  const { isUploading, error, uploadAsset } = useAssetUpload();
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  const projectId = project?.id || project?._id;
  const queryLower = searchQuery.trim().toLowerCase();
  const matchesQuery = (label: string) => !queryLower || label.toLowerCase().includes(queryLower);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !projectId) return;

    setUploadSuccess(null);
    const asset = await uploadAsset(projectId, file);
    if (asset) {
      setUploadSuccess(`Uploaded '${file.name}' successfully.`);
    }
    e.target.value = '';
  };

  const folderBtnClass = `w-full flex items-center justify-between px-2 py-1.5 rounded-md transition-colors group text-sm font-medium cursor-pointer ${
    isDark ? 'text-slate-200 hover:bg-white/5' : 'text-stone-800 hover:bg-[#F3ECE5]'
  }`;
  const folderBadgeClass = `text-[10px] px-1.5 py-0.5 rounded font-mono ${
    isDark ? 'bg-white/10 text-slate-300' : 'bg-stone-300 text-stone-700'
  }`;
  const itemBtnClass = `text-left text-sm px-2 py-1 rounded transition-colors cursor-pointer ${
    isDark ? 'text-slate-400 hover:text-orange-400 hover:bg-white/5' : 'text-stone-600 hover:text-orange-600 hover:bg-[#F3ECE5]'
  }`;

  const totalAssets =
    (hasScript ? 1 : 0) +
    (characterCount > 0 ? characterCount : 0) +
    (audioCount > 0 ? audioCount : 0) +
    (videoCount > 0 ? videoCount : 0);

  return (
    <div className={`w-80 flex flex-col p-4 flex-shrink-0 select-none border-r transition-colors duration-300 ${
      isDark ? 'border-white/10 bg-[#0C0F17]' : 'border-[#D9D3C7] bg-[#EFE9E1]'
    }`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className={`font-serif font-bold text-lg tracking-wide ${isDark ? 'text-white' : 'text-stone-900'}`}>
          {strings.workspace.artifactManager.title}
        </h2>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          onClick={handleUploadClick}
          disabled={isUploading}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shadow-2xs cursor-pointer disabled:opacity-50 border ${
            isDark ? 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/10' : 'bg-[#FAF7F2] border-[#D9D3C7] text-stone-800 hover:bg-white hover:border-stone-400'
          }`}
        >
          {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {isUploading ? 'Uploading...' : strings.workspace.artifactManager.uploadAsset}
        </button>
      </div>

      {error && (
        <div className="mb-3 px-3 py-2 bg-red-100 border border-red-300 rounded-lg text-xs text-red-700">
          {error}
        </div>
      )}
      {uploadSuccess && (
        <div className="mb-3 px-3 py-2 bg-emerald-100 border border-emerald-300 rounded-lg text-xs text-emerald-800">
          {uploadSuccess}
        </div>
      )}

      <div className="relative mb-4">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={strings.workspace.artifactManager.searchPlaceholder}
          className={`w-full pl-9 pr-3 py-1.5 rounded-lg text-sm placeholder-stone-500 focus:outline-none focus:ring-1 focus:ring-orange-500 border ${
            isDark ? 'bg-[#121622] border-white/10 text-white placeholder-slate-500' : 'bg-[#FAF7F2] border-[#D9D3C7] text-stone-900 placeholder-stone-500'
          }`}
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {matchesQuery(strings.workspace.artifactManager.folders.scripts) && (
          <div className="mb-2">
            <button onClick={hasScript ? onSelectScript : undefined} className={folderBtnClass}>
              <div className="flex items-center gap-2">
                <ChevronRight className={`w-4 h-4 text-stone-500 group-hover:text-stone-800 transition-transform ${hasScript ? 'rotate-90' : ''}`} />
                <Folder className="w-4 h-4 text-orange-500" />
                {strings.workspace.artifactManager.folders.scripts}
              </div>
              {hasScript && <span className={folderBadgeClass}>{workflowState?.script_version || 1}</span>}
            </button>

            <div className="pl-9 mt-1 flex flex-col gap-1">
              {hasScript && workflowState?.script_version && workflowState.script_version > 0 ? (
                [...Array(workflowState.script_version)].map((_, i) => {
                  const v = workflowState.script_version! - i;
                  const label = strings.workspace.artifactNames.script.replace('{v}', v.toString());
                  if (!matchesQuery(label) && !matchesQuery('scripts')) return null;
                  return (
                    <button key={v} onClick={onSelectScript} className={itemBtnClass}>
                      {label}
                    </button>
                  );
                })
              ) : hasScript ? (
                <button onClick={onSelectScript} className={itemBtnClass}>
                  v1_script.json
                </button>
              ) : null}
            </div>
          </div>
        )}

        {matchesQuery(strings.workspace.artifactManager.folders.characters) && (
          <div className="mb-2">
            <button onClick={hasCharacters ? onSelectCharacters : undefined} className={folderBtnClass}>
              <div className="flex items-center gap-2">
                <ChevronRight className={`w-4 h-4 text-stone-500 group-hover:text-stone-800 transition-transform ${hasCharacters ? 'rotate-90' : ''}`} />
                <Folder className="w-4 h-4 text-orange-500" />
                {strings.workspace.artifactManager.folders.characters}
              </div>
              {characterCount > 0 && <span className={folderBadgeClass}>{characterCount}</span>}
            </button>

            <div className="pl-9 mt-1 flex flex-col gap-1">
              {hasCharacters && workflowState?.character_version && workflowState.character_version > 0 ? (
                [...Array(workflowState.character_version)].map((_, i) => {
                  const v = workflowState.character_version! - i;
                  const label = strings.workspace.artifactNames.characters.replace('{v}', v.toString());
                  return (
                    <button key={v} onClick={onSelectCharacters} className={`${itemBtnClass} flex items-center gap-1.5`}>
                      <Users className="w-3.5 h-3.5 text-orange-500" />
                      {label}
                    </button>
                  );
                })
              ) : hasCharacters ? (
                <button onClick={onSelectCharacters} className={`${itemBtnClass} flex items-center gap-1.5`}>
                  <Users className="w-3.5 h-3.5 text-orange-500" />
                  Character Cards ({characterCount})
                </button>
              ) : null}
            </div>
          </div>
        )}

        {matchesQuery(strings.workspace.artifactManager.folders.audio) && (
          <div className="mb-2">
            <button onClick={hasAudio ? onSelectAudio : undefined} className={folderBtnClass}>
              <div className="flex items-center gap-2">
                <ChevronRight className={`w-4 h-4 text-stone-500 group-hover:text-stone-800 transition-transform ${hasAudio ? 'rotate-90' : ''}`} />
                <Folder className="w-4 h-4 text-orange-500" />
                {strings.workspace.artifactManager.folders.audio}
              </div>
              {audioCount > 0 && <span className={folderBadgeClass}>{audioCount}</span>}
            </button>

            {hasAudio && (
              <div className="pl-9 mt-1 flex flex-col gap-1">
                <button onClick={onSelectAudio} className={`${itemBtnClass} flex items-center gap-1.5`}>
                  <Volume2 className="w-3.5 h-3.5 text-cyan-600" />
                  Dialogue Tracks ({audioCount})
                </button>
              </div>
            )}
          </div>
        )}

        {matchesQuery(strings.workspace.artifactManager.folders.videoClips) && (
          <div className="mb-2">
            <button onClick={hasVideo ? onSelectVideo : undefined} className={folderBtnClass}>
              <div className="flex items-center gap-2">
                <ChevronRight className={`w-4 h-4 text-stone-500 group-hover:text-stone-800 transition-transform ${hasVideo ? 'rotate-90' : ''}`} />
                <Folder className="w-4 h-4 text-orange-500" />
                {strings.workspace.artifactManager.folders.videoClips}
              </div>
              {videoCount > 0 && <span className={folderBadgeClass}>{videoCount}</span>}
            </button>

            {hasVideo && (
              <div className="pl-9 mt-1 flex flex-col gap-1">
                <button onClick={onSelectVideo} className={`${itemBtnClass} flex items-center gap-1.5`}>
                  <Film className="w-3.5 h-3.5 text-orange-600" />
                  Rendered Shots & Movie ({videoCount})
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className={`mt-4 pt-4 border-t ${isDark ? 'border-white/10' : 'border-[#D9D3C7]'}`}>
        <p className={`text-[10px] text-center uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-stone-500'}`}>
          {totalAssets > 0 ? `${totalAssets} Generated Assets` : strings.workspace.artifactManager.noAssets}
        </p>
      </div>
    </div>
  );
}
