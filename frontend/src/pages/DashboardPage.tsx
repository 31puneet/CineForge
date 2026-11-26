import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Folder,
  Search,
  Plus,
  Bell,
  Settings,
  Compass,
  GraduationCap,
  Library,
  Film,
  MoreHorizontal,
  Edit2,
  Trash2,
  LogOut,
  Sun,
  Moon
} from 'lucide-react';
import { useProjects } from '../hooks/useProjects';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { CreateProjectModal } from '../components/dashboard/CreateProjectModal';
import { EditProjectModal } from '../components/dashboard/EditProjectModal';
import type { Project } from '../types/workflow';
import strings from '../constants/strings.json';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('projects');
  
  const { projects, isLoading, isCreating, error, createProject, deleteProject, updateProject } = useProjects();
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const handleCreate = async (title: string) => {
    const project = await createProject(title);
    navigate(`/project/${project._id || project.id}`);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this project?")) {
      await deleteProject(id);
    }
    setActiveDropdown(null);
  };

  const navItems = [
    { id: 'projects', label: strings.dashboard.sidebar.projects, icon: Folder },
    { id: 'library', label: strings.dashboard.sidebar.assetLibrary, icon: Library },
    { id: 'explore', label: strings.dashboard.sidebar.explore, icon: Compass },
    { id: 'academy', label: strings.dashboard.sidebar.academy, icon: GraduationCap },
    { id: 'settings', label: strings.dashboard.sidebar.settings, icon: Settings },
  ];

  return (
    <div className={`min-h-screen font-sans flex transition-colors duration-300 ${
      isDark ? 'bg-[#08090D] text-slate-100' : 'bg-[#FAF7F2] text-stone-800'
    }`}>
      {/* ─── Sidebar ─── */}
      <aside className={`w-64 border-r flex flex-col justify-between py-6 px-4 transition-colors duration-300 ${
        isDark ? 'bg-[#0C0F17] border-white/10 text-slate-200' : 'bg-[#F3ECE5] border-[#E5DFD3] text-stone-900'
      }`}>
        <div>
          <div className="flex items-center gap-3 px-3 mb-10">
            <div className={`p-1 rounded-xl shadow-xs border ${isDark ? 'bg-white/10 border-white/20' : 'bg-white border-stone-200'}`}>
              <img src="/cineforge-logo.jpg" alt="CineForge" className="w-8 h-8 rounded-lg shadow-sm object-cover" />
            </div>
            <div>
              <h1 className={`font-bold tracking-wide text-lg leading-tight ${isDark ? 'text-white' : 'text-stone-900'}`}>CineForge</h1>
              <p className="text-[10px] text-orange-500 uppercase tracking-widest font-mono">AI Studio</p>
            </div>
          </div>

          <nav className="flex flex-col gap-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive 
                      ? isDark
                        ? 'bg-orange-500/20 text-orange-400 font-semibold border border-orange-500/30'
                        : 'bg-orange-50 text-orange-800 font-semibold'
                      : isDark
                        ? 'text-slate-400 hover:bg-white/5 hover:text-white'
                        : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                  {(item.id === 'explore' || item.id === 'academy') && (
                    <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded border ${
                      isDark ? 'bg-white/5 text-slate-400 border-white/10' : 'bg-stone-100 text-stone-500 border-stone-200'
                    }`}>Soon</span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Usage */}
        <div className="mt-8">
          <div className={`rounded-2xl p-4 mb-4 border transition-colors ${
            isDark ? 'bg-[#121622] border-white/10 text-slate-300' : 'bg-stone-50 border-stone-200 text-stone-700'
          }`}>
            <h4 className={`text-xs font-semibold mb-3 ${isDark ? 'text-slate-300' : 'text-stone-700'}`}>{strings.dashboard.sidebar.creditsLeft}</h4>
            <div className={`w-full h-2 rounded-full overflow-hidden mb-2 ${isDark ? 'bg-white/10' : 'bg-stone-200'}`}>
              <div className="bg-orange-500 w-[0%] h-full rounded-full" />
            </div>
            <p className="text-[10px] text-stone-400 mb-3">{strings.dashboard.sidebar.creditsCount}</p>
            <button className={`w-full border text-xs font-semibold py-2 rounded-xl transition-colors shadow-xs ${
              isDark ? 'bg-white/5 text-slate-200 border-white/15 hover:bg-white/10' : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
            }`}>
              {strings.dashboard.sidebar.viewPlan}
            </button>
          </div>
        </div>
      </aside>

      {/* ─── Main Content ─── */}
      <main className="flex-1 overflow-y-auto">
        <header className="flex items-center justify-between px-10 py-6">
          <h2 className={`text-3xl font-serif font-bold ${isDark ? 'text-white' : 'text-stone-900'}`}>
            {strings.dashboard.header.title}
          </h2>
          
          <div className="flex items-center gap-5">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input 
                type="text"
                placeholder={strings.dashboard.header.searchPlaceholder}
                className={`pl-9 pr-4 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 w-64 shadow-xs transition-colors ${
                  isDark
                    ? 'bg-[#121622] border-white/10 text-white placeholder-slate-500'
                    : 'bg-white border-stone-200 text-stone-900 placeholder-stone-400'
                }`}
              />
            </div>

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer border ${
                isDark
                  ? 'bg-white/10 hover:bg-white/15 text-amber-300 border-white/15 shadow-inner'
                  : 'bg-white hover:bg-stone-100 text-stone-700 border-stone-200 shadow-2xs'
              }`}
              title={isDark ? 'Switch to Warm Cream Theme' : 'Switch to Cinema Dark Theme'}
            >
              {isDark ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400 animate-spin-slow" />
                  <span className="font-mono text-[11px] text-amber-200">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-stone-700" />
                  <span className="font-mono text-[11px] text-stone-700">Dark</span>
                </>
              )}
            </button>

            <button className="relative">
              <Bell className={`w-5 h-5 transition-colors ${isDark ? 'text-slate-400 hover:text-white' : 'text-stone-600 hover:text-stone-900'}`} />
              <span className={`absolute 0 right-0 w-2 h-2 bg-orange-500 rounded-full border ${isDark ? 'border-[#08090D]' : 'border-[#FAF7F2]'}`}></span>
            </button>

            <div className="relative">
              <div 
                className={`w-9 h-9 rounded-full overflow-hidden border-2 shadow-xs cursor-pointer ${
                  isDark ? 'border-white/20 bg-stone-700' : 'border-white bg-stone-300'
                }`}
                onClick={() => setActiveDropdown(activeDropdown === 'profile' ? null : 'profile')}
              >
                <img src={user?.avatarUrl || "https://api.dicebear.com/7.x/notionists/svg?seed=Felix&backgroundColor=e5e5e5"} alt="Avatar" className="w-full h-full object-cover" />
              </div>
              {activeDropdown === 'profile' && (
                <div className={`absolute top-12 right-0 w-48 border shadow-xl rounded-xl overflow-hidden z-20 py-1 ${
                  isDark ? 'bg-[#141926] border-white/15 text-slate-200' : 'bg-white border-stone-200 text-stone-900'
                }`}>
                  <div className={`px-4 py-2 border-b mb-1 ${isDark ? 'border-white/10' : 'border-stone-100'}`}>
                    <p className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-stone-900'}`}>{user?.name || 'User'}</p>
                    <p className="text-xs text-stone-400 truncate">{user?.email || 'user@example.com'}</p>
                  </div>
                  <button 
                    onClick={async () => {
                      await logout();
                      navigate('/');
                    }}
                    className={`w-full text-left px-4 py-2 text-sm text-red-500 flex items-center gap-2 transition-colors ${
                      isDark ? 'hover:bg-red-500/10' : 'hover:bg-red-50'
                    }`}
                  >
                    <LogOut className="w-4 h-4" /> {strings.login.logout}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="px-10 py-4">
          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-12 mt-4">
            
            <div 
              onClick={() => setIsCreateOpen(true)}
              className={`aspect-video border border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all group shadow-xs ${
                isDark
                  ? 'bg-[#101420] border-white/20 text-slate-400 hover:text-white hover:border-orange-500/80 hover:bg-orange-500/10'
                  : 'bg-white border-stone-300 text-stone-500 hover:text-stone-900 hover:border-orange-400 hover:bg-orange-50/50'
              }`}
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-all text-orange-500 shadow-xs ${
                isDark ? 'bg-white/10 group-hover:bg-white/20' : 'bg-stone-100 group-hover:bg-white group-hover:shadow-xs'
              }`}>
                <Plus className="w-6 h-6" />
              </div>
              <span className={`font-bold text-lg mb-1 ${isDark ? 'text-white' : 'text-stone-800'}`}>{strings.dashboard.projects.createCard}</span>
              <span className="text-sm text-stone-400">{strings.dashboard.projects.createCardSub}</span>
            </div>

            {isLoading ? (
              <div className="col-span-full text-center py-12 text-stone-400">Loading projects...</div>
            ) : (
              projects.map((project) => {
                const projectId = project._id || project.id;
                if (!projectId) return null;
                return (
                <div 
                  key={projectId} 
                  onClick={() => navigate(`/project/${projectId}`)}
                  className={`aspect-video border rounded-2xl relative group cursor-pointer transition-all p-6 flex flex-col justify-between shadow-xs ${
                    isDark
                      ? 'bg-[#101420] border-white/10 hover:border-orange-500/60 hover:bg-[#141926] hover:shadow-xl hover:shadow-black/40'
                      : 'bg-white border-stone-200 hover:border-stone-400 shadow-sm hover:shadow-md hover:bg-orange-50/20'
                  }`}
                >
                  <div className="flex items-start justify-between relative">
                    <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400 shadow-xs">
                      <Film className="w-5 h-5" />
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveDropdown(activeDropdown === projectId ? null : projectId);
                      }}
                      className={`p-1.5 rounded-lg transition-colors ${
                        isDark ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-stone-400 hover:text-stone-700 hover:bg-stone-100'
                      }`}
                    >
                      <MoreHorizontal className="w-5 h-5" />
                    </button>

                    {activeDropdown === projectId && (
                      <div className={`absolute top-10 right-0 w-32 border shadow-xl rounded-xl overflow-hidden z-10 ${
                        isDark ? 'bg-[#181D2C] border-white/15 text-slate-200' : 'bg-white border-stone-200 text-stone-700'
                      }`}>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingProject(project);
                            setActiveDropdown(null);
                          }}
                          className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors ${
                            isDark ? 'hover:bg-white/10' : 'hover:bg-stone-50'
                          }`}
                        >
                          <Edit2 className="w-4 h-4" /> Edit
                        </button>
                        <button 
                          onClick={(e) => handleDelete(e, projectId)}
                          className={`w-full text-left px-4 py-2 text-sm text-red-500 flex items-center gap-2 transition-colors ${
                            isDark ? 'hover:bg-red-500/10' : 'hover:bg-red-50'
                          }`}
                        >
                          <Trash2 className="w-4 h-4" /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <h3 className={`font-serif font-bold text-xl truncate mb-3 group-hover:text-orange-500 transition-colors ${
                      isDark ? 'text-white' : 'text-stone-900'
                    }`}>
                      {project.title}
                    </h3>
                    <div className="flex items-center text-stone-400 text-xs font-medium gap-2">
                      <div className="w-5 h-5 rounded-full bg-stone-300 overflow-hidden shadow-xs">
                        <img src="https://api.dicebear.com/7.x/notionists/svg?seed=Felix&backgroundColor=e5e5e5" alt="Avatar" />
                      </div>
                      {project.updatedAt ? new Date(project.updatedAt).toLocaleDateString() : 'Just now'}
                    </div>
                  </div>
                </div>
                );
              })
            )}
          </div>
        </div>
      </main>

      <CreateProjectModal 
        isOpen={isCreateOpen} 
        onClose={() => setIsCreateOpen(false)} 
        onCreate={handleCreate} 
        isCreating={isCreating} 
      />

      <EditProjectModal 
        key={editingProject?._id || editingProject?.id || 'edit-project-modal'}
        project={editingProject} 
        onClose={() => setEditingProject(null)} 
        onEdit={updateProject} 
      />
    </div>
  );
}
