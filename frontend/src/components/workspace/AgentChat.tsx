import { useState, useEffect, useRef } from 'react';
import { Send, FileText, Loader2, ChevronDown, ChevronRight, CheckCircle2, Circle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import strings from '../../constants/strings.json';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import type { WorkflowEvent } from '../../types/events';

interface AgentChatProps {
  project: any;
  onFetchState?: () => Promise<void>;
  onSwitchTab?: (tab: string) => void;
}

interface Message {
  _id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  metadata?: any;
}

export function AgentChat({ project, onFetchState, onSwitchTab }: AgentChatProps) {
  const { user } = useAuth();
  const projectId = project?.id || project?._id;
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedDuration, setSelectedDuration] = useState('60'); // Default 1 minute
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Workflow UI state
  const [thinkingExpanded, setThinkingExpanded] = useState(true);
  const [thinkingSteps, setThinkingSteps] = useState<string[]>([]);
  const [thinkingContent, setThinkingContent] = useState('');
  const [planSteps, setPlanSteps] = useState<string[]>([]);
  const [currentPlanStep, setCurrentPlanStep] = useState('');
  const [approvalPending, setApprovalPending] = useState(false);
  const [approvalStage, setApprovalStage] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showReasonInput, setShowReasonInput] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (projectId) {
      fetchMessages();
    }
  }, [projectId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, thinkingSteps, approvalPending, showReasonInput]);

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

  const handleRespondApproval = async (approved: boolean) => {
    if (!approved && !showReasonInput) {
      setShowReasonInput(true);
      return;
    }
    
    setApprovalPending(false);
    setShowReasonInput(false);
    setIsLoading(true);
    setThinkingSteps([]);
    setThinkingContent('');
    setThinkingExpanded(true); // Re-open thinking for next step
    
    try {
      await apiClient.post(`/projects/${projectId}/messages/respond`, {
        approved,
        reason: rejectionReason,
        stage: approvalStage,
        version: 1 // backend determines real version if needed, or we just pass it
      });
      setRejectionReason('');
    } catch (error) {
      console.error('Failed to submit approval:', error);
      setIsError(true);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !projectId) return;

    const userMessageContent = input.trim();
    setInput('');
    setIsLoading(true);
    setIsError(false);
    setThinkingSteps([]);
    setThinkingContent('');
    setPlanSteps([]);
    setCurrentPlanStep('');
    setThinkingExpanded(true);
    setApprovalPending(false);
    setShowReasonInput(false);

    // Optimistically add user message
    const tempUserMessage: Message = {
      _id: Date.now().toString(),
      role: 'user',
      content: userMessageContent,
      createdAt: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, tempUserMessage]);

    try {
      const baseURL = apiClient.defaults.baseURL || 'http://localhost:3000/api';
      const res = await fetch(`${baseURL}/projects/${projectId}/messages`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: userMessageContent,
          metadata: {
            targetDurationSeconds: parseInt(selectedDuration)
          }
        })
      });

      if (!res.ok || !res.body) throw new Error('Failed to send message');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunkString = decoder.decode(value, { stream: true });
        const lines = chunkString.split('\n').filter(l => l.trim().length > 0);
        
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line) as WorkflowEvent;
            
            if (parsed.type === 'ping') {
              continue; // Just keep connection alive
            } else if (parsed.type === 'status') {
              setThinkingSteps(prev => [...prev, parsed.content]);
            } else if (parsed.type === 'thinking') {
              setThinkingContent(prev => prev + parsed.content);
            } else if (parsed.type === 'plan') {
              setPlanSteps(parsed.steps);
              setCurrentPlanStep(parsed.current);
            } else if (parsed.type === 'plan_update') {
              setCurrentPlanStep(parsed.current);
            } else if (parsed.type === 'message') {
              setThinkingExpanded(false); // Contract thinking when message arrives
              const newMsg: Message = {
                _id: Date.now().toString() + Math.random(),
                role: 'assistant',
                content: parsed.content,
                createdAt: new Date().toISOString(),
                metadata: parsed.link ? { link: parsed.link } : {}
              };
              setMessages(prev => [...prev, newMsg]);
              if (onFetchState) onFetchState();
            } else if (parsed.type === 'approval_request') {
              setApprovalPending(true);
              setApprovalStage(parsed.stage);
              setIsLoading(false); // Enable chat interaction again for approval
            } else if (parsed.type === 'error') {
              setIsError(true);
              setErrorMessage(parsed.content);
              setIsLoading(false);
            } else if (parsed.type === 'done') {
              setIsLoading(false);
              setThinkingExpanded(false);
              if (onFetchState) onFetchState();
            }
          } catch (e) {
            console.error('Failed to parse chunk', e);
          }
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setIsError(true);
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
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0 overflow-hidden mt-1">
                <img src="/cineforge-logo.jpg" alt="Agent" className="w-full h-full object-cover" />
              </div>
            )}
            
            <div className={`p-4 max-w-[80%] shadow-sm text-sm leading-relaxed whitespace-pre-wrap flex flex-col gap-2
              ${msg.role === 'user' 
                ? 'bg-orange-500 text-white rounded-2xl rounded-tr-none' 
                : 'bg-white border border-stone-200 text-stone-800 rounded-2xl rounded-tl-none'}`}
            >
              <div className="prose prose-sm prose-stone max-w-none">
                {msg.role === 'user' ? (
                  msg.content
                ) : (
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                )}
              </div>
              
              {msg.metadata?.link && (
                <button 
                  onClick={() => onSwitchTab?.('script')}
                  className="flex items-center gap-2 mt-2 px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-stone-700 hover:bg-orange-50 transition-colors w-max"
                >
                  <FileText className="w-4 h-4 text-orange-500" />
                  <span className="font-medium text-xs">{msg.metadata.link.label}</span>
                </button>
              )}
            </div>

            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center shrink-0 overflow-hidden mt-1">
                <img src={user?.avatarUrl || `https://api.dicebear.com/7.x/notionists/svg?seed=${user?.name || 'User'}&backgroundColor=e5e5e5`} alt="User" className="w-full h-full object-cover" />
              </div>
            )}
          </div>
        ))}

        {/* Real-time Thinking & Workflow UI */}
        {(isLoading || thinkingSteps.length > 0) && (
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0 overflow-hidden">
              <img src="/cineforge-logo.jpg" alt="Agent" className="w-full h-full object-cover" />
            </div>
            <div className="bg-white border border-stone-200 rounded-2xl rounded-tl-none p-3 shadow-sm text-sm text-stone-800 min-w-[300px]">
              
              <button 
                onClick={() => setThinkingExpanded(!thinkingExpanded)}
                className="flex items-center gap-2 w-full text-left font-medium text-stone-700 pb-2 border-b border-stone-100 hover:text-orange-600 transition-colors"
              >
                {thinkingExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <span className="flex items-center gap-2">
                  {isLoading && <Loader2 className="w-3 h-3 animate-spin text-orange-500" />}
                  Agent Thinking
                </span>
              </button>

              {thinkingExpanded && (
                <div className="pt-3 flex flex-col gap-3">
                  {/* Status Steps */}
                  <div className="flex flex-col gap-1.5 text-xs text-stone-500">
                    {thinkingSteps.map((step, idx) => (
                      <div key={idx} className="flex gap-2">
                        <span className="text-orange-400">▸</span> {step}
                      </div>
                    ))}
                  </div>

                  {/* Real Thinking Content */}
                  {thinkingContent && (
                    <div className="pl-4 border-l-2 border-stone-200 mt-2 text-xs text-stone-500 whitespace-pre-wrap font-mono prose prose-sm prose-stone">
                      <ReactMarkdown>{thinkingContent}</ReactMarkdown>
                    </div>
                  )}

                  {/* Plan Checklist */}
                  {planSteps.length > 0 && (
                    <div className="bg-stone-50 rounded-lg p-3 border border-stone-100 ml-4">
                      <div className="text-xs font-semibold text-stone-600 mb-2">Workflow Plan:</div>
                      <div className="flex flex-col gap-2">
                        {planSteps.map((step, idx) => {
                          let stepState = 'pending';
                          const currentIndex = planSteps.indexOf(currentPlanStep);
                          
                          if (idx < currentIndex) {
                            stepState = 'completed';
                          } else if (idx === currentIndex) {
                            if (isLoading || approvalPending) stepState = 'current';
                            else stepState = 'completed'; // Agent finished this step
                          }
                          
                          return (
                            <div key={idx} className={`flex items-center gap-2 text-xs ${stepState === 'current' ? 'text-orange-600 font-medium' : stepState === 'completed' ? 'text-stone-700' : 'text-stone-400'}`}>
                              {stepState === 'completed' ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : 
                               stepState === 'current' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 
                               <Circle className="w-3.5 h-3.5" />}
                              {step}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Error State */}
        {isError && (
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0 overflow-hidden">
              <span className="text-red-500 text-xs">!</span>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-2xl rounded-tl-none p-4 max-w-[80%] text-red-700 text-sm">
              {errorMessage || 'An error occurred while communicating with the agent. Please try again.'}
            </div>
          </div>
        )}

        {/* Approval Card */}
        {approvalPending && (
          <div className="flex gap-4">
            <div className="w-8 h-8 opacity-0"></div>
            <div className="bg-white border border-orange-200 rounded-2xl p-4 shadow-sm min-w-[300px]">
              <div className="text-sm font-medium text-stone-800 mb-3">Does this {approvalStage} look good to you?</div>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => handleRespondApproval(true)}
                  className="flex-1 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Yes, proceed
                </button>
                <button 
                  onClick={() => handleRespondApproval(false)}
                  className="flex-1 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200 rounded-lg text-sm font-medium transition-colors"
                >
                  No, revise
                </button>
              </div>

              {showReasonInput && (
                <div className="mt-4 flex flex-col gap-2">
                  <textarea
                    placeholder="What should I change?"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 resize-none h-24"
                  />
                  <button 
                    onClick={() => handleRespondApproval(false)}
                    disabled={!rejectionReason.trim()}
                    className="py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-stone-300 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Submit Feedback
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-stone-200">
        <form onSubmit={handleSend} className="max-w-4xl mx-auto relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading || approvalPending}
            placeholder={isLoading ? "Agent is working..." : approvalPending ? "Please approve or reject above..." : strings.workspace.agentChat.inputPlaceholder}
            className="w-full pl-6 pr-16 py-4 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all shadow-inner disabled:opacity-50"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <select
              value={selectedDuration}
              onChange={(e) => setSelectedDuration(e.target.value)}
              disabled={isLoading || approvalPending}
              className="bg-transparent text-stone-500 text-xs font-medium cursor-pointer focus:outline-none hover:text-stone-800 transition-colors"
              title="Target Duration"
            >
              <option value="15">15s</option>
              <option value="30">30s</option>
              <option value="60">1m</option>
              <option value="120">2m</option>
              <option value="300">5m</option>
            </select>
            <button 
              type="submit" 
              disabled={!input.trim() || isLoading || approvalPending}
              className="p-2 bg-stone-900 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:hover:bg-stone-900 transition-colors"
            >
              {(isLoading) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
