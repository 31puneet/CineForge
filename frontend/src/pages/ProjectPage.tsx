import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useProject } from '../hooks/useProject';
import { useWorkflowState } from '../hooks/useWorkflowState';
import { WorkspaceSidebar } from '../components/workspace/WorkspaceSidebar';
import { AgentChat } from '../components/workspace/AgentChat';
import { ArtifactManager } from '../components/workspace/ArtifactManager';
import { ScriptViewer } from '../components/workspace/ScriptViewer';
import strings from '../constants/strings.json';
import { FileText, MessageSquare } from 'lucide-react';

export default function ProjectPage() {
  const { id } = useParams();
  const { project, isLoading, error } = useProject(id);
  const { workflowState, fetchState } = useWorkflowState(id);
  
  const [activeTab, setActiveTab] = useState<'chat' | 'script'>('chat');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] font-sans flex items-center justify-center">
        <div className="text-stone-500 animate-pulse">{strings.workspace.projectPage.loading}</div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] font-sans flex items-center justify-center">
        <div className="text-red-500 bg-red-50 px-6 py-4 rounded-xl border border-red-200 shadow-sm">
          {error || strings.workspace.projectPage.notFound}
        </div>
      </div>
    );
  }

  const hasScript = !!workflowState?.script_data;

  return (
    <div className="h-screen w-full bg-[#FAF7F2] font-sans flex overflow-hidden">
      
      {/* ─── Left 25% (Sidebar) ─── */}
      <div className="w-1/4 min-w-[280px] max-w-[320px] h-full flex-shrink-0">
        <WorkspaceSidebar project={project} />
      </div>

      {/* ─── Center 50% (Agent Chat / Tabs) ─── */}
      <div className="flex-1 h-full min-w-[500px] flex flex-col bg-white">
        {/* Tab Bar */}
        <div className="flex border-b border-stone-200 bg-[#FAF7F2] px-4 pt-3 gap-2">
          <button 
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === 'chat' 
                ? 'bg-white text-stone-900 border border-b-0 border-stone-200' 
                : 'text-stone-500 hover:text-stone-700 hover:bg-stone-100'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            {strings.workspace.projectPage.tabs.chat}
          </button>
          
          {hasScript && (
            <button 
              onClick={() => setActiveTab('script')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === 'script' 
                  ? 'bg-white text-stone-900 border border-b-0 border-stone-200' 
                  : 'text-stone-500 hover:text-stone-700 hover:bg-stone-100'
              }`}
            >
              <FileText className="w-4 h-4" />
              {strings.workspace.projectPage.tabs.script} {workflowState?.approval_states?.script_approved ? strings.workspace.projectPage.tabs.approved : strings.workspace.projectPage.tabs.review}
            </button>
          )}
        </div>
        
        {/* Tab Content */}
        <div className="flex-1 overflow-hidden relative">
          <div className={`absolute inset-0 ${activeTab === 'chat' ? 'block' : 'hidden'}`}>
            <AgentChat project={project} onFetchState={fetchState} onSwitchTab={(tab) => setActiveTab(tab as any)} />
          </div>
          <div className={`absolute inset-0 ${activeTab === 'script' ? 'block' : 'hidden'}`}>
            <ScriptViewer workflowState={workflowState} />
          </div>
        </div>
      </div>

      {/* ─── Right 25% (Artifacts Folder) ─── */}
      <div className="w-1/4 min-w-[280px] max-w-[320px] h-full flex-shrink-0">
        <ArtifactManager project={project} onSelectScript={() => setActiveTab('script')} hasScript={hasScript} />
      </div>

    </div>
  );
}
