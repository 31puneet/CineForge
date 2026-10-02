import { useParams } from 'react-router-dom';
import { useProject } from '../hooks/useProject';
import { WorkspaceSidebar } from '../components/workspace/WorkspaceSidebar';
import { AgentChat } from '../components/workspace/AgentChat';
import { ArtifactManager } from '../components/workspace/ArtifactManager';
import strings from '../constants/strings.json';

export default function ProjectPage() {
  const { id } = useParams();
  const { project, isLoading, error } = useProject(id);

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

  return (
    <div className="h-screen w-full bg-[#FAF7F2] font-sans flex overflow-hidden">
      
      {/* ─── Left 25% (Sidebar) ─── */}
      <div className="w-1/4 min-w-[280px] max-w-[320px] h-full flex-shrink-0">
        <WorkspaceSidebar project={project} />
      </div>

      {/* ─── Center 50% (Agent Chat / Tabs) ─── */}
      <div className="flex-1 h-full min-w-[500px]">
        <AgentChat project={project} />
      </div>

      {/* ─── Right 25% (Artifacts Folder) ─── */}
      <div className="w-1/4 min-w-[280px] max-w-[320px] h-full flex-shrink-0">
        <ArtifactManager project={project} />
      </div>

    </div>
  );
}
