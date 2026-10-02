import { useState, useEffect, useRef } from 'react';
import { Send, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import strings from '../../constants/strings.json';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';

interface AgentChatProps {
  project: any;
}

interface Message {
  _id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
}

export function AgentChat({ project }: AgentChatProps) {
  const { user } = useAuth();
  const projectId = project?.id || project?._id;
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (projectId) {
      fetchMessages();
    }
  }, [projectId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = async () => {
    try {
      const res = await apiClient.get(`/projects/${projectId}/messages`);
      setMessages(res.data);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !projectId) return;

    const userMessageContent = input.trim();
    setInput('');
    setIsLoading(true);

    // Optimistically add user message
    const tempUserMessage: Message = {
      _id: Date.now().toString(),
      role: 'user',
      content: userMessageContent,
      createdAt: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, tempUserMessage]);

    try {
      const res = await apiClient.post(`/projects/${projectId}/messages`, {
        content: userMessageContent
      });
      
      // Update with actual DB messages
      setMessages(prev => {
        const filtered = prev.filter(m => m._id !== tempUserMessage._id);
        return [...filtered, res.data.userMessage, res.data.assistantMessage];
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      // Could add an error toast here
    } finally {
      setIsLoading(false);
    }
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

        {messages.length === 0 && (
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0 overflow-hidden">
              <img src="/cineforge-logo.jpg" alt="Agent" className="w-full h-full object-cover" />
            </div>
            <div className="bg-white border border-stone-200 rounded-2xl rounded-tl-none p-4 max-w-[80%] shadow-sm text-stone-800 text-sm leading-relaxed whitespace-pre-wrap">
              {strings.workspace.agentChat.welcomeMessage}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg._id} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role !== 'user' && (
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0 overflow-hidden">
                <img src="/cineforge-logo.jpg" alt="Agent" className="w-full h-full object-cover" />
              </div>
            )}
            
            <div className={`p-4 max-w-[80%] shadow-sm text-sm leading-relaxed whitespace-pre-wrap
              ${msg.role === 'user' 
                ? 'bg-orange-500 text-white rounded-2xl rounded-tr-none' 
                : 'bg-white border border-stone-200 text-stone-800 rounded-2xl rounded-tl-none'}`}
            >
              {msg.content}
            </div>

            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center shrink-0 overflow-hidden">
                <img src={user?.avatarUrl || `https://api.dicebear.com/7.x/notionists/svg?seed=${user?.name || 'User'}&backgroundColor=e5e5e5`} alt="User" className="w-full h-full object-cover" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0 overflow-hidden">
              <img src="/cineforge-logo.jpg" alt="Agent" className="w-full h-full object-cover" />
            </div>
            <div className="bg-white border border-stone-200 rounded-2xl rounded-tl-none p-4 shadow-sm text-stone-500 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
              Agent is thinking...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
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
            disabled={isLoading}
            placeholder={isLoading ? "Agent is processing..." : strings.workspace.agentChat.inputPlaceholder}
            className="w-full pl-20 pr-12 py-4 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all shadow-inner disabled:opacity-50"
          />
          <button 
            type="submit" 
            disabled={!input.trim() || isLoading}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-stone-900 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:hover:bg-stone-900 transition-colors"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}
