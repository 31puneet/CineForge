import { useRef } from 'react';
import { Folder, Search, ChevronRight, Upload, Loader2 } from 'lucide-react';
import { useAssetUpload } from '../../hooks/useAssetUpload';
import strings from '../../constants/strings.json';

interface ArtifactManagerProps {
  project: any;
  onSelectScript?: () => void;
  hasScript?: boolean;
}

export function ArtifactManager({ project, onSelectScript, hasScript }: ArtifactManagerProps) {
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
          className="p-1.5 bg-stone-900 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50" 
          title={strings.workspace.artifactManager.uploadAsset}
        >
          {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
        <input 
          type="text"
          placeholder={strings.workspace.artifactManager.searchPlaceholder}
          className="w-full pl-9 pr-4 py-2 bg-[#F3ECE5] border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
        />
      </div>

      {/* Folder Structure */}
      <div className="flex-1 overflow-y-auto pr-2">
        
        {/* Scripts Folder */}
        <div className="mb-2">
          <button className="w-full flex items-center gap-2 px-2 py-1.5 text-stone-800 hover:bg-[#F3ECE5] rounded-md transition-colors group text-sm font-medium">
            <ChevronRight className="w-4 h-4 text-stone-500 group-hover:text-stone-800 transition-colors" />
            <Folder className="w-4 h-4 text-orange-500" />
            {strings.workspace.artifactManager.folders.scripts}
          </button>
          <div className="pl-9 mt-1 flex flex-col gap-1">
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
          <button className="w-full flex items-center gap-2 px-2 py-1.5 text-stone-800 hover:bg-[#F3ECE5] rounded-md transition-colors group text-sm font-medium">
            <ChevronRight className="w-4 h-4 text-stone-500 group-hover:text-stone-800 transition-colors" />
            <Folder className="w-4 h-4 text-orange-500" />
            {strings.workspace.artifactManager.folders.characters}
          </button>
        </div>

        {/* Audio Folder */}
        <div className="mb-2">
          <button className="w-full flex items-center gap-2 px-2 py-1.5 text-stone-800 hover:bg-[#F3ECE5] rounded-md transition-colors group text-sm font-medium">
            <ChevronRight className="w-4 h-4 text-stone-500 group-hover:text-stone-800 transition-colors" />
            <Folder className="w-4 h-4 text-orange-500" />
            {strings.workspace.artifactManager.folders.audio}
          </button>
        </div>

        {/* Video Clips Folder */}
        <div className="mb-2">
          <button className="w-full flex items-center gap-2 px-2 py-1.5 text-stone-800 hover:bg-[#F3ECE5] rounded-md transition-colors group text-sm font-medium">
            <ChevronRight className="w-4 h-4 text-stone-500 group-hover:text-stone-800 transition-colors" />
            <Folder className="w-4 h-4 text-orange-500" />
            {strings.workspace.artifactManager.folders.videoClips}
          </button>
        </div>

      </div>

      {/* Info Footer */}
      <div className="mt-4 pt-4 border-t border-[#D9D3C7]">
        <p className="text-[10px] text-stone-500 text-center uppercase tracking-widest">
          {strings.workspace.artifactManager.noAssets}
        </p>
      </div>
    </div>
  );
}
