import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageSquare, ListTodo, Settings, Sun, Moon } from 'lucide-react';
import strings from '../../constants/strings.json';
import { useTheme } from '../../context/ThemeContext';
import type { Project } from '../../types/workflow';

interface WorkspaceSidebarProps {
  project: Project;
}

export function WorkspaceSidebar({ project }: WorkspaceSidebarProps) {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();

  return (
    <aside className={`h-full border-r flex flex-col justify-between py-6 px-4 transition-colors duration-300 ${
      isDark ? 'bg-[#0C0F17] border-white/10 text-slate-200' : 'bg-[#F3ECE5] border-[#E5DFD3] text-stone-900'
    }`}>
      <div>
        {/* Header */}
        <div className="flex items-center gap-3 px-2 mb-8">
          <button 
            onClick={() => navigate('/dashboard')}
            className={`p-1.5 rounded-lg transition-colors ${
              isDark ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-[#E5DFD3] text-stone-600'
            }`}
            title={strings.workspace.sidebar.backToDashboard}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className={`p-1 rounded-lg border shadow-xs ${isDark ? 'bg-white/10 border-white/20' : 'bg-white border-stone-200'}`}>
            <img src="/cineforge-logo.jpg" alt="CineForge" className="w-6 h-6 rounded object-cover" />
          </div>
          <h1 className={`font-bold tracking-wide truncate flex-1 text-sm ${isDark ? 'text-white' : 'text-stone-900'}`}>
            {project?.title || strings.workspace.sidebar.loading}
          </h1>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-1.5 mb-8">
          <button className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
            isDark ? 'bg-orange-500/20 text-orange-400 font-semibold border border-orange-500/30' : 'bg-orange-50 text-orange-800 font-semibold'
          }`}>
            <MessageSquare className="w-4 h-4" />
            {strings.workspace.sidebar.activeChat}
          </button>
          <button className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
            isDark ? 'text-slate-400 hover:bg-white/5 hover:text-white' : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
          }`}>
            <ListTodo className="w-4 h-4" />
            {strings.workspace.sidebar.sceneList}
          </button>
          <button className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
            isDark ? 'text-slate-400 hover:bg-white/5 hover:text-white' : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
          }`}>
            <Settings className="w-4 h-4" />
            {strings.workspace.sidebar.projectSettings}
          </button>
        </nav>

        {/* Chat History Section */}
        <div>
          <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider px-3 mb-3">{strings.workspace.sidebar.chatHistory}</h4>
          <div className="flex flex-col gap-1">
            <div className={`px-3 py-2 text-xs rounded-xl flex items-center gap-2 border ${
              isDark ? 'bg-white/5 border-white/10 text-slate-300' : 'bg-white border-stone-200 text-stone-700'
            }`}>
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="truncate font-medium">{project?.title ? `Session: ${project.title}` : 'Active Production'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer with Theme Toggle */}
      <div className={`pt-4 border-t flex items-center justify-between px-2 ${isDark ? 'border-white/10' : 'border-stone-200'}`}>
        <span className="text-xs font-medium text-stone-400">Theme</span>
        <button
          onClick={toggleTheme}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
            isDark
              ? 'bg-white/10 hover:bg-white/15 text-amber-300 border-white/15'
              : 'bg-white hover:bg-stone-100 text-stone-700 border-stone-200 shadow-2xs'
          }`}
          title={isDark ? 'Switch to Light' : 'Switch to Dark'}
        >
          {isDark ? (
            <>
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] font-mono text-amber-200">Light</span>
            </>
          ) : (
            <>
              <Moon className="w-3.5 h-3.5 text-stone-700" />
              <span className="text-[11px] font-mono text-stone-700">Dark</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
