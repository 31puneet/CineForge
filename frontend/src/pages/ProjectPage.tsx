import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useProject } from '../hooks/useProject';
import { useWorkflowState } from '../hooks/useWorkflowState';
import { useTheme } from '../context/ThemeContext';
import { WorkspaceSidebar } from '../components/workspace/WorkspaceSidebar';
import { AgentChat } from '../components/workspace/AgentChat';
import { ArtifactManager } from '../components/workspace/ArtifactManager';
import { ScriptViewer } from '../components/workspace/ScriptViewer';
import { CharacterViewer } from '../components/workspace/CharacterViewer';
import { AudioViewer } from '../components/workspace/AudioViewer';
import { VideoViewer } from '../components/workspace/VideoViewer';
import strings from '../constants/strings.json';
import { FileText, MessageSquare, Users, Volume2, Film } from 'lucide-react';

export default function ProjectPage() {
  const { id } = useParams();
  const { project, isLoading, error } = useProject(id);
  const { workflowState, fetchState } = useWorkflowState(id);
  const { isDark } = useTheme();
  
  const [activeTab, setActiveTab] = useState<'chat' | 'script' | 'characters' | 'characters_tab' | 'audio' | 'video'>('chat');

  if (isLoading) {
    return (
      <div className={`min-h-screen font-sans flex items-center justify-center ${
        isDark ? 'bg-[#08090D] text-slate-400' : 'bg-[#FAF7F2] text-stone-500'
      }`}>
        <div className="animate-pulse">{strings.workspace.projectPage.loading}</div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className={`min-h-screen font-sans flex items-center justify-center ${
        isDark ? 'bg-[#08090D] text-red-400' : 'bg-[#FAF7F2] text-red-500'
      }`}>
        <div>{error || strings.workspace.projectPage.notFound}</div>
      </div>
    );
  }

  const hasScript = !!workflowState?.script_data;
  const hasCharacters = (workflowState?.characters && workflowState.characters.length > 0) || (workflowState?.character_history && workflowState.character_history.length > 0);
  const hasAudio = !!(workflowState?.voiceovers && workflowState.voiceovers.length > 0);
  const hasVideo = !!(workflowState?.video_shots && workflowState.video_shots.length > 0) || !!workflowState?.final_video_url;

  return (
    <div className={`h-screen w-screen overflow-hidden flex transition-colors duration-300 ${
      isDark ? 'bg-[#08090D] text-slate-100' : 'bg-[#FAF7F2] text-stone-800'
    }`}>
      {/* ─── Left 15% (Navigation) ─── */}
      <WorkspaceSidebar project={project} />

      {/* ─── Center 60% (Interactive Work Area) ─── */}
      <div className={`flex-1 flex flex-col h-full border-r transition-colors duration-300 ${
        isDark ? 'border-white/10 bg-[#0E111A]' : 'border-[#D9D3C7] bg-white'
      }`}>
        {/* Navigation Tabs Header */}
        <div className={`flex items-center gap-2 px-8 pt-4 border-b transition-colors duration-300 ${
          isDark ? 'border-white/10 bg-[#0B0D15]' : 'border-stone-200 bg-stone-50/50'
        }`}>
          <button 
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors cursor-pointer ${
              activeTab === 'chat' 
                ? isDark 
                  ? 'bg-[#0E111A] text-white border border-b-0 border-white/15'
                  : 'bg-white text-stone-900 border border-b-0 border-stone-200 shadow-2xs' 
                : isDark
                  ? 'text-slate-400 hover:text-white hover:bg-white/5'
                  : 'text-stone-500 hover:text-stone-700 hover:bg-stone-100'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            {strings.workspace.projectPage.tabs.chat}
          </button>
          
          {hasScript && (
            <button 
              onClick={() => setActiveTab('script')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors cursor-pointer ${
                activeTab === 'script' 
                  ? isDark 
                    ? 'bg-[#0E111A] text-white border border-b-0 border-white/15'
                    : 'bg-white text-stone-900 border border-b-0 border-stone-200 shadow-2xs' 
                  : isDark
                    ? 'text-slate-400 hover:text-white hover:bg-white/5'
                    : 'text-stone-500 hover:text-stone-700 hover:bg-stone-100'
              }`}
            >
              <FileText className="w-4 h-4" />
              {strings.workspace.projectPage.tabs.script} {workflowState?.approval_states?.script_approved ? strings.workspace.projectPage.tabs.approved : strings.workspace.projectPage.tabs.review}
            </button>
          )}

          {hasCharacters && (
            <button 
              onClick={() => setActiveTab('characters')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors cursor-pointer ${
                activeTab === 'characters' || activeTab === 'characters_tab'
                  ? isDark 
                    ? 'bg-[#0E111A] text-white border border-b-0 border-white/15'
                    : 'bg-white text-stone-900 border border-b-0 border-stone-200 shadow-2xs' 
                  : isDark
                    ? 'text-slate-400 hover:text-white hover:bg-white/5'
                    : 'text-stone-500 hover:text-stone-700 hover:bg-stone-100'
              }`}
            >
              <Users className="w-4 h-4" />
              {strings.workspace.projectPage.tabs.characters || 'Characters'} {workflowState?.approval_states?.characters_approved ? strings.workspace.projectPage.tabs.approved : strings.workspace.projectPage.tabs.review}
            </button>
          )}

          {hasAudio && (
            <button 
              onClick={() => setActiveTab('audio')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors cursor-pointer ${
                activeTab === 'audio' 
                  ? isDark 
                    ? 'bg-[#0E111A] text-white border border-b-0 border-white/15'
                    : 'bg-white text-stone-900 border border-b-0 border-stone-200 shadow-2xs' 
                  : isDark
                    ? 'text-slate-400 hover:text-white hover:bg-white/5'
                    : 'text-stone-500 hover:text-stone-700 hover:bg-stone-100'
              }`}
            >
              <Volume2 className="w-4 h-4" />
              Audio {workflowState?.approval_states?.voiceovers_approved ? strings.workspace.projectPage.tabs.approved : strings.workspace.projectPage.tabs.review}
            </button>
          )}

          {hasVideo && (
            <button 
              onClick={() => setActiveTab('video')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors cursor-pointer ${
                activeTab === 'video' 
                  ? isDark 
                    ? 'bg-[#0E111A] text-white border border-b-0 border-white/15 font-semibold'
                    : 'bg-white text-stone-900 border border-b-0 border-stone-200 font-semibold shadow-2xs' 
                  : isDark
                    ? 'text-slate-400 hover:text-white hover:bg-white/5'
                    : 'text-stone-500 hover:text-stone-700 hover:bg-stone-100'
              }`}
            >
              <Film className="w-4 h-4 text-orange-500" />
              Video {workflowState?.approval_states?.video_approved ? strings.workspace.projectPage.tabs.approved : strings.workspace.projectPage.tabs.review}
            </button>
          )}
        </div>
        
        {/* Tab Content */}
        <div className="flex-1 overflow-hidden relative">
          <div className={`absolute inset-0 ${activeTab === 'chat' ? 'block' : 'hidden'}`}>
            <AgentChat project={project} workflowState={workflowState} onFetchState={fetchState} onSwitchTab={(tab) => setActiveTab(tab as any)} />
          </div>
          <div className={`absolute inset-0 ${activeTab === 'script' ? 'block' : 'hidden'}`}>
            <ScriptViewer project={project} workflowState={workflowState} />
          </div>
          <div className={`absolute inset-0 ${activeTab === 'characters' || activeTab === 'characters_tab' ? 'block' : 'hidden'}`}>
            <CharacterViewer workflowState={workflowState} projectId={id} onRefreshState={fetchState} />
          </div>
          <div className={`absolute inset-0 ${activeTab === 'audio' ? 'block' : 'hidden'}`}>
            <AudioViewer workflowState={workflowState} projectId={id} onRefreshState={fetchState} />
          </div>
          <div className={`absolute inset-0 ${activeTab === 'video' ? 'block' : 'hidden'}`}>
            <VideoViewer workflowState={workflowState} projectId={id} onRefreshState={fetchState} />
          </div>
        </div>
      </div>

      {/* ─── Right 25% (Artifacts Folder) ─── */}
      <div className={`w-1/4 min-w-[280px] max-w-[320px] h-full flex-shrink-0 transition-colors duration-300 ${
        isDark ? 'bg-[#0C0F17]' : 'bg-white'
      }`}>
        <ArtifactManager 
          project={project} 
          workflowState={workflowState}
          onSelectScript={() => setActiveTab('script')} 
          hasScript={hasScript}
          onSelectCharacters={() => setActiveTab('characters')}
          hasCharacters={hasCharacters}
          characterCount={workflowState?.characters?.length || 0}
          onSelectAudio={() => setActiveTab('audio')}
          hasAudio={hasAudio}
          audioCount={workflowState?.voiceovers?.length || 0}
          onSelectVideo={() => setActiveTab('video')}
          hasVideo={hasVideo}
          videoCount={workflowState?.video_shots?.length || 0}
        />
      </div>

    </div>
  );
}
