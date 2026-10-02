import { useState } from 'react';
import { Send, FileText, Image as ImageIcon } from 'lucide-react';
import strings from '../../constants/strings.json';

interface AgentChatProps {
  project: any;
}

export function AgentChat({ project }: AgentChatProps) {
  const [input, setInput] = useState('');

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    // TODO: Send to backend agent system
    setInput('');
  };

  return (
    <div className="h-full flex flex-col bg-[#FAF7F2]">
      {/* Tabs Header */}
      <div className="flex border-b border-stone-200 bg-white">
        <button className="px-6 py-4 text-sm font-medium border-b-2 border-orange-500 text-stone-900 flex items-center gap-2">
          <img src="/cineforge-logo.jpg" alt="Agent" className="w-4 h-4 rounded-sm" />
          {strings.workspace.agentChat.tabTitle}
        </button>
      </div>

      {/* Chat Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        <div className="flex justify-center my-4">
          <span className="px-3 py-1 bg-stone-100 text-stone-500 text-xs rounded-full border border-stone-200">
            {strings.workspace.agentChat.projectInitialized.replace('{title}', project?.title || '')}
          </span>
        </div>

        {/* Example Welcome Message */}
        <div className="flex gap-4">
          <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0 overflow-hidden">
            <img src="/cineforge-logo.jpg" alt="Agent" className="w-full h-full object-cover" />
          </div>
          <div className="bg-white border border-stone-200 rounded-2xl rounded-tl-none p-4 max-w-[80%] shadow-sm text-stone-800 text-sm leading-relaxed whitespace-pre-wrap">
            {strings.workspace.agentChat.welcomeMessage}
          </div>
        </div>
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-stone-200">
        <form onSubmit={handleSend} className="max-w-4xl mx-auto relative">
          <div className="flex items-center gap-2 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">
            <button type="button" className="p-1 hover:text-orange-500 transition-colors" title="Attach Document">
              <FileText className="w-4 h-4" />
            </button>
            <button type="button" className="p-1 hover:text-orange-500 transition-colors" title="Attach Image">
              <ImageIcon className="w-4 h-4" />
            </button>
          </div>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={strings.workspace.agentChat.inputPlaceholder}
            className="w-full pl-20 pr-12 py-4 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all shadow-inner"
          />
          <button 
            type="submit" 
            disabled={!input.trim()}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-stone-900 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:hover:bg-stone-900 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
