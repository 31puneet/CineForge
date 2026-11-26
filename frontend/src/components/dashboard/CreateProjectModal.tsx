import { useState } from 'react';
import { X } from 'lucide-react';
import strings from '../../constants/strings.json';
import { useTheme } from '../../context/ThemeContext';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (title: string) => Promise<void>;
  isCreating: boolean;
}

export function CreateProjectModal({ isOpen, onClose, onCreate, isCreating }: CreateProjectModalProps) {
  const [title, setTitle] = useState('');
  const { isDark } = useTheme();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await onCreate(title);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={`rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 border ${
        isDark ? 'bg-[#121622] border-white/10 text-white' : 'bg-white border-stone-100 text-stone-800'
      }`}>
        <div className={`flex items-center justify-between p-6 border-b ${
          isDark ? 'border-white/10' : 'border-stone-100'
        }`}>
          <h3 className={`text-xl font-serif font-bold ${isDark ? 'text-white' : 'text-stone-800'}`}>
            {strings.dashboard.createModal.title}
          </h3>
          <button 
            onClick={onClose} 
            className={`transition-colors p-1 rounded-lg ${
              isDark ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-stone-400 hover:text-stone-600 hover:bg-stone-100'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-6">
            <label htmlFor="projectName" className={`block text-sm font-medium mb-2 ${
              isDark ? 'text-slate-300' : 'text-stone-700'
            }`}>
              {strings.dashboard.createModal.nameLabel}
            </label>
            <input 
              id="projectName"
              type="text"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={strings.dashboard.createModal.namePlaceholder}
              className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all shadow-sm ${
                isDark
                  ? 'bg-[#1A2030] border-white/15 text-white placeholder-slate-500'
                  : 'bg-white border-stone-200 text-stone-900 placeholder-stone-400'
              }`}
              required
            />
          </div>

          <div className="flex justify-end gap-3">
            <button 
              type="button" 
              onClick={onClose} 
              className={`px-5 py-2.5 font-medium rounded-xl transition-colors ${
                isDark ? 'text-slate-300 hover:bg-white/10' : 'text-stone-600 hover:bg-stone-50'
              }`}
            >
              {strings.dashboard.createModal.cancelBtn}
            </button>
            <button 
              type="submit" 
              disabled={!title.trim() || isCreating} 
              className="px-5 py-2.5 bg-orange-600 text-white font-medium rounded-xl hover:bg-orange-700 disabled:bg-orange-400/50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {isCreating ? strings.dashboard.createModal.creatingBtn : strings.dashboard.createModal.createBtn}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
