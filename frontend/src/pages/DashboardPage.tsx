import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Folder, Search, Plus, Bell, Settings, Compass, GraduationCap, Library, Film, MoreHorizontal, Edit2, Trash2, LogOut } from 'lucide-react';
import { useProjects } from '../hooks/useProjects';
import { useAuth } from '../context/AuthContext';
import { CreateProjectModal } from '../components/dashboard/CreateProjectModal';
import { EditProjectModal } from '../components/dashboard/EditProjectModal';
import strings from '../constants/strings.json';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('projects');
  
  const { projects, isLoading, isCreating, createProject, deleteProject, updateProject } = useProjects();
  const { user, logout } = useAuth();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState<any>(null);

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
    <div className="min-h-screen bg-[#FAF7F2] font-sans flex">
      {/* ─── Sidebar ─── */}
      <aside className="w-64 bg-[#F3ECE5] border-r border-[#E5DFD3] flex flex-col justify-between py-6 px-4">
        <div>
          <div className="flex items-center gap-3 px-3 mb-10 text-stone-900">
            <img src="/cineforge-logo.jpg" alt="CineForge" className="w-8 h-8 rounded-lg shadow-sm" />
            <div>
              <h1 className="font-bold tracking-wide text-lg leading-tight">CineForge</h1>
              <p className="text-[10px] text-stone-500 uppercase tracking-widest">AI Studio</p>
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
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive 
                      ? 'bg-orange-50 text-orange-800' 
                      : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                  {(item.id === 'explore' || item.id === 'academy') && (
                    <span className="ml-auto text-[10px] bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded border border-stone-200">Soon</span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Usage */}
        <div className="mt-8">
          <div className="bg-stone-50 rounded-xl p-4 mb-4 border border-stone-200">
            <h4 className="text-xs font-semibold text-stone-700 mb-3">{strings.dashboard.sidebar.creditsLeft}</h4>
            <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden mb-2">
              <div className="bg-orange-500 w-[0%] h-full rounded-full" />
            </div>
            <p className="text-[10px] text-stone-500 mb-3">{strings.dashboard.sidebar.creditsCount}</p>
            <button className="w-full bg-white text-stone-700 border border-stone-200 text-xs font-semibold py-2 rounded-lg hover:bg-stone-50 transition-colors shadow-sm">
              {strings.dashboard.sidebar.viewPlan}
            </button>
          </div>
        </div>
      </aside>

      {/* ─── Main Content ─── */}
      <main className="flex-1 overflow-y-auto">
        <header className="flex items-center justify-between px-10 py-6">
          <h2 className="text-3xl font-serif font-bold text-stone-900">
            {strings.dashboard.header.title}
          </h2>
          
          <div className="flex items-center gap-6">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input 
                type="text"
                placeholder={strings.dashboard.header.searchPlaceholder}
                className="pl-9 pr-4 py-2 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 w-64 shadow-sm"
              />
            </div>
            <button className="relative">
              <Bell className="w-5 h-5 text-stone-600 hover:text-stone-900" />
              <span className="absolute 0 right-0 w-2 h-2 bg-orange-500 rounded-full border border-[#FAF7F2]"></span>
            </button>
            <div className="relative">
              <div 
                className="w-9 h-9 rounded-full bg-stone-300 overflow-hidden border-2 border-white shadow-sm cursor-pointer"
                onClick={() => setActiveDropdown(activeDropdown === 'profile' ? null : 'profile')}
              >
                <img src={user?.avatarUrl || "https://api.dicebear.com/7.x/notionists/svg?seed=Felix&backgroundColor=e5e5e5"} alt="Avatar" className="w-full h-full object-cover" />
              </div>
              {activeDropdown === 'profile' && (
                <div className="absolute top-12 right-0 w-48 bg-white border border-stone-200 shadow-lg rounded-lg overflow-hidden z-20 py-1">
                  <div className="px-4 py-2 border-b border-stone-100 mb-1">
                    <p className="text-sm font-medium text-stone-900 truncate">{user?.name || 'User'}</p>
                    <p className="text-xs text-stone-500 truncate">{user?.email || 'user@example.com'}</p>
                  </div>
                  <button 
                    onClick={async () => {
                      await logout();
                      navigate('/');
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                  >
                    <LogOut className="w-4 h-4" /> {strings.login.logout}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="px-10 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-12 mt-4">
            
            <div 
              onClick={() => setIsCreateOpen(true)}
              className="aspect-video bg-white border border-dashed border-stone-300 rounded-2xl flex flex-col items-center justify-center text-stone-500 hover:text-stone-900 hover:border-orange-400 hover:bg-orange-50/50 cursor-pointer transition-all group shadow-sm"
            >
              <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mb-4 group-hover:bg-white group-hover:shadow-sm transition-all text-orange-500">
                <Plus className="w-6 h-6" />
              </div>
              <span className="font-bold text-lg text-stone-800 mb-1">{strings.dashboard.projects.createCard}</span>
              <span className="text-sm text-stone-400">{strings.dashboard.projects.createCardSub}</span>
            </div>

            {isLoading ? (
              <div className="col-span-full text-center py-12 text-stone-400">Loading projects...</div>
            ) : (
              projects.map((project) => (
                <div 
                  key={project._id || project.id} 
                  onClick={() => navigate(`/project/${project._id || project.id}`)}
                  className="aspect-video bg-white border border-stone-200 rounded-2xl relative group cursor-pointer shadow-sm hover:shadow-md hover:border-orange-300 hover:bg-orange-50/30 transition-all p-6 flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between relative">
                    <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                      <Film className="w-5 h-5" />
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveDropdown(activeDropdown === (project._id || project.id) ? null : (project._id || project.id));
                      }}
                      className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors"
                    >
                      <MoreHorizontal className="w-5 h-5" />
                    </button>

                    {activeDropdown === (project._id || project.id) && (
                      <div className="absolute top-10 right-0 w-32 bg-white border border-stone-200 shadow-lg rounded-lg overflow-hidden z-10">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingProject(project);
                            setActiveDropdown(null);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 flex items-center gap-2 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" /> Edit
                        </button>
                        <button 
                          onClick={(e) => handleDelete(e, project._id || project.id)}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <h3 className="text-stone-900 font-serif font-bold text-xl truncate mb-3 group-hover:text-orange-700 transition-colors">
                      {project.title}
                    </h3>
                    <div className="flex items-center text-stone-400 text-xs font-medium gap-2">
                      <div className="w-5 h-5 rounded-full bg-stone-200 overflow-hidden shadow-sm">
                        <img src="https://api.dicebear.com/7.x/notionists/svg?seed=Felix&backgroundColor=e5e5e5" alt="Avatar" />
                      </div>
                      {project.updatedAt ? new Date(project.updatedAt).toLocaleDateString() : 'Just now'}
                    </div>
                  </div>
                </div>
              ))
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
        project={editingProject} 
        onClose={() => setEditingProject(null)} 
        onEdit={updateProject} 
      />
    </div>
  );
}
