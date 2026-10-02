import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface EditProjectModalProps {
  project: any | null;
  onClose: () => void;
  onEdit: (id: string, updates: any) => Promise<void>;
}

export function EditProjectModal({ project, onClose, onEdit }: EditProjectModalProps) {
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (project) {
      setTitle(project.title);
    }
  }, [project]);

  if (!project) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await onEdit(project._id || project.id, { title });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-stone-100">
          <h3 className="text-xl font-serif font-bold text-stone-800">Edit Project</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-6">
            <label htmlFor="editProjectName" className="block text-sm font-medium text-stone-700 mb-2">
              Project Name
            </label>
            <input 
              id="editProjectName"
              type="text"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all shadow-sm"
              required
            />
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-stone-600 font-medium hover:bg-stone-50 rounded-xl transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={!title.trim()} className="px-5 py-2.5 bg-orange-600 text-white font-medium rounded-xl hover:bg-orange-700 disabled:bg-orange-300 transition-colors shadow-sm">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
