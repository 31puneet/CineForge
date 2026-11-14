import { useRef } from 'react';
import { Folder, Search, ChevronRight, Upload, Loader2, Users, Volume2, Film } from 'lucide-react';
import { useAssetUpload } from '../../hooks/useAssetUpload';
import strings from '../../constants/strings.json';

interface ArtifactManagerProps {
  project: any;
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
  videoCount = 0
}: ArtifactManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isUploading, error, uploadAsset } = useAssetUpload();

  const projectId = project?.id || project?._id;

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !projectId) return;

    const asset = await uploadAsset(projectId, file);
    if (asset) {
      alert('Asset uploaded successfully!');
    } else if (error) {
      alert(`Upload failed: ${error}`);
    }

    // Reset the file input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="h-full bg-[#E5DFD3] border-l border-stone-300 flex flex-col py-6 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-stone-900 tracking-tight">{strings.workspace.artifactManager.title}</h2>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          className="hidden" 
        />
        <button 
          onClick={handleUploadClick}
          disabled={isUploading || !projectId}
          className="p-1.5 text-stone-700 hover:text-stone-900 hover:bg-[#D9D3C7] rounded-md transition-colors disabled:opacity-50"
          title="Upload Asset"
        >
          {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        </button>
      </div>

      {/* Search Input */}
      <div className="relative mb-6">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
        <input 
          type="text" 
          placeholder={strings.workspace.artifactManager.searchPlaceholder}
          className="w-full bg-[#F3ECE5] text-xs rounded-lg pl-9 pr-3 py-2 text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-orange-500 border border-transparent focus:border-orange-500"
        />
      </div>

      {/* Folders List */}
      <div className="flex-1 overflow-y-auto">
        
        {/* Scripts Folder */}
        <div className="mb-2">
          <button 
            onClick={hasScript ? onSelectScript : undefined}
            className="w-full flex items-center justify-between px-2 py-1.5 text-stone-800 hover:bg-[#F3ECE5] rounded-md transition-colors group text-sm font-medium"
          >
            <div className="flex items-center gap-2">
              <ChevronRight className={`w-4 h-4 text-stone-500 group-hover:text-stone-800 transition-transform ${hasScript ? 'rotate-90' : ''}`} />
              <Folder className="w-4 h-4 text-orange-500" />
              {strings.workspace.artifactManager.folders.scripts}
            </div>
            {hasScript && (
              <span className="text-[10px] bg-stone-300 text-stone-700 px-1.5 py-0.5 rounded font-mono">1</span>
            )}
          </button>
          
          <div className="pl-6 flex flex-col gap-1 mt-1">
            {hasScript && (
              <button 
                onClick={onSelectScript}
                className="text-left text-sm text-stone-600 hover:text-orange-600 hover:bg-[#F3ECE5] px-2 py-1 rounded transition-colors"
              >
                v1_script.json
              </button>
            )}
          </div>
        </div>

        {/* Characters Folder */}
        <div className="mb-2">
          <button 
            onClick={hasCharacters ? onSelectCharacters : undefined}
            className="w-full flex items-center justify-between px-2 py-1.5 text-stone-800 hover:bg-[#F3ECE5] rounded-md transition-colors group text-sm font-medium"
          >
            <div className="flex items-center gap-2">
              <ChevronRight className={`w-4 h-4 text-stone-500 group-hover:text-stone-800 transition-transform ${hasCharacters ? 'rotate-90' : ''}`} />
              <Folder className="w-4 h-4 text-orange-500" />
              {strings.workspace.artifactManager.folders.characters}
            </div>
            {characterCount > 0 && (
              <span className="text-[10px] bg-stone-300 text-stone-700 px-1.5 py-0.5 rounded font-mono">{characterCount}</span>
            )}
          </button>

          {hasCharacters && (
            <div className="pl-6 flex flex-col gap-1 mt-1">
              <button 
                onClick={onSelectCharacters}
                className="text-left text-sm text-stone-600 hover:text-orange-600 hover:bg-[#F3ECE5] px-2 py-1 rounded transition-colors flex items-center gap-1.5"
              >
                <Users className="w-3.5 h-3.5 text-orange-500" />
                Character Cards ({characterCount})
              </button>
            </div>
          )}
        </div>

        {/* Audio Folder */}
        <div className="mb-2">
          <button 
            onClick={hasAudio ? onSelectAudio : undefined}
            className="w-full flex items-center justify-between px-2 py-1.5 text-stone-800 hover:bg-[#F3ECE5] rounded-md transition-colors group text-sm font-medium"
          >
            <div className="flex items-center gap-2">
              <ChevronRight className={`w-4 h-4 text-stone-500 group-hover:text-stone-800 transition-transform ${hasAudio ? 'rotate-90' : ''}`} />
              <Folder className="w-4 h-4 text-orange-500" />
              {strings.workspace.artifactManager.folders.audio}
            </div>
            {audioCount > 0 && (
              <span className="text-[10px] bg-stone-300 text-stone-700 px-1.5 py-0.5 rounded font-mono">{audioCount}</span>
            )}
          </button>

          {hasAudio && (
            <div className="pl-6 flex flex-col gap-1 mt-1">
              <button 
                onClick={onSelectAudio}
                className="text-left text-sm text-stone-600 hover:text-orange-600 hover:bg-[#F3ECE5] px-2 py-1 rounded transition-colors flex items-center gap-1.5"
              >
                <Volume2 className="w-3.5 h-3.5 text-cyan-600" />
                Dialogue Tracks ({audioCount})
              </button>
            </div>
          )}
        </div>

        {/* Video Clips Folder */}
        <div className="mb-2">
          <button 
            onClick={hasVideo ? onSelectVideo : undefined}
            className="w-full flex items-center justify-between px-2 py-1.5 text-stone-800 hover:bg-[#F3ECE5] rounded-md transition-colors group text-sm font-medium cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <ChevronRight className={`w-4 h-4 text-stone-500 group-hover:text-stone-800 transition-transform ${hasVideo ? 'rotate-90' : ''}`} />
              <Folder className="w-4 h-4 text-orange-500" />
              {strings.workspace.artifactManager.folders.videoClips}
            </div>
            {videoCount > 0 && (
              <span className="text-[10px] bg-stone-300 text-stone-700 px-1.5 py-0.5 rounded font-mono">{videoCount}</span>
            )}
          </button>

          {hasVideo && (
            <div className="pl-6 flex flex-col gap-1 mt-1">
              <button 
                onClick={onSelectVideo}
                className="text-left text-sm text-stone-600 hover:text-orange-600 hover:bg-[#F3ECE5] px-2 py-1 rounded transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Film className="w-3.5 h-3.5 text-orange-600" />
                Rendered Shots & Movie ({videoCount})
              </button>
            </div>
          )}
        </div>

      </div>

      {/* Info Footer */}
      <div className="mt-4 pt-4 border-t border-[#D9D3C7]">
        <p className="text-[10px] text-stone-500 text-center uppercase tracking-widest">
          {hasScript || hasCharacters || hasVideo ? `${(hasScript ? 1 : 0) + (characterCount > 0 ? characterCount : 0) + (videoCount > 0 ? videoCount : 0)} Generated Assets` : strings.workspace.artifactManager.noAssets}
        </p>
      </div>
    </div>
  );
}
