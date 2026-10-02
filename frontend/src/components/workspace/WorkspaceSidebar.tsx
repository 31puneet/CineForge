import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageSquare, ListTodo, Users, Settings } from 'lucide-react';
import strings from '../../constants/strings.json';

interface WorkspaceSidebarProps {
  project: any;
}

export function WorkspaceSidebar({ project }: WorkspaceSidebarProps) {
  const navigate = useNavigate();

  return (
    <aside className="h-full bg-[#F3ECE5] border-r border-[#E5DFD3] flex flex-col py-6 px-4">
      {/* Header */}
      <div className="flex items-center gap-3 px-2 mb-8">
        <button 
          onClick={() => navigate('/dashboard')}
          className="p-1.5 hover:bg-[#E5DFD3] rounded-lg transition-colors text-stone-600"
          title={strings.workspace.sidebar.backToDashboard}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <img src="/cineforge-logo.jpg" alt="CineForge" className="w-7 h-7 rounded shadow-sm" />
        <h1 className="font-bold tracking-wide text-stone-900 truncate flex-1">
          {project?.title || strings.workspace.sidebar.loading}
        </h1>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1.5 mb-8">
        <button className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium bg-orange-50 text-orange-800 transition-colors">
          <MessageSquare className="w-4 h-4" />
          {strings.workspace.sidebar.activeChat}
        </button>
        <button className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition-colors">
          <ListTodo className="w-4 h-4" />
          {strings.workspace.sidebar.sceneList}
        </button>
        <button className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition-colors">
          <Users className="w-4 h-4" />
          {strings.workspace.sidebar.characters}
        </button>
        <button className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition-colors">
          <Settings className="w-4 h-4" />
          {strings.workspace.sidebar.projectSettings}
        </button>
      </nav>

      {/* Chat History Section */}
      <div className="flex-1 overflow-y-auto">
        <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider px-3 mb-3">{strings.workspace.sidebar.chatHistory}</h4>
        <div className="flex flex-col gap-1">
          {/* Empty state for now */}
          <div className="px-3 py-2 text-sm text-stone-400 italic">{strings.workspace.sidebar.noChatHistory}</div>
        </div>
      </div>
    </aside>
  );
}
