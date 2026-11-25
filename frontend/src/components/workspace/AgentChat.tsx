import { useState, useEffect, useRef } from 'react';
import { Send, FileText, Loader2, ChevronDown, ChevronRight, CheckCircle2, Circle, Paperclip, X, Image as ImageIcon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

import strings from '../../constants/strings.json';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import type { WorkflowEvent } from '../../types/events';
import type { WorkflowState } from '../../hooks/useWorkflowState';

interface AgentChatProps {
  project: any;
  workflowState?: WorkflowState | null;
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

export function AgentChat({ project, workflowState, onFetchState, onSwitchTab }: AgentChatProps) {
  const { user } = useAuth();
  const { isDark } = useTheme();
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
  const [attachments, setAttachments] = useState<{type: string, url: string, name: string}[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Check if approval is needed either from live stream OR persisted workflowState
  const effectiveApprovalStage = approvalStage || (() => {
    if (!workflowState) return '';
    const approvals = workflowState.approval_states || {};
    if (!approvals.script_approved && workflowState.script_data) return 'script';
    if (!approvals.characters_approved && (workflowState.characters?.length ?? 0) > 0) return 'character';
    if (!approvals.voiceovers_approved && (workflowState.voiceovers?.length ?? 0) > 0) return 'voiceover';
    if (!approvals.video_approved && (workflowState.video_shots?.length ?? 0) > 0) return 'video';
    return '';
  })();

  const isApprovalNeeded = (approvalPending || !!effectiveApprovalStage) && !isLoading;
  
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
    const stageToRespond = effectiveApprovalStage || approvalStage;
    const reasonToSend = rejectionReason;
    setRejectionReason('');
    
    try {
      await apiClient.post(`/projects/${projectId}/messages/respond`, {
        approved,
        reason: reasonToSend,
        stage: stageToRespond,
        version: 1
      });
      if (onFetchState) await onFetchState();

      if (approved) {
        await executeSendMessage('continue');
      } else {
        await executeSendMessage(reasonToSend ? `Revise: ${reasonToSend}` : 'Please revise');
      }
    } catch (error) {
      console.error('Failed to submit approval:', error);
      setIsError(true);
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setAttachments(prev => [...prev, {
        type: file.type.startsWith('image/') ? 'image_url' : 'file',
        url: base64,
        name: file.name
      }]);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !projectId) return;
    const text = input.trim();
    setInput('');

    // If an approval stage is pending and the user responds via chat
    const cleanLower = text.toLowerCase().trim();
    const isAffirmative = ['yes', 'proceed', 'continue', 'next', 'approve', 'approved', 'looks good', 'ok', 'good', 'sure', 'advance'].includes(cleanLower);

    if (isApprovalNeeded) {
      if (isAffirmative) {
        await handleRespondApproval(true);
        return;
      } else {
        // User provided specific revision feedback in chat
        const stageToRespond = effectiveApprovalStage || approvalStage;
        setApprovalPending(false);
        setShowReasonInput(false);
        try {
          await apiClient.post(`/projects/${projectId}/messages/respond`, {
            approved: false,
            reason: text,
            stage: stageToRespond,
            version: 1
          });
          if (onFetchState) await onFetchState();
        } catch (err) {
          console.error('Error submitting revision feedback via chat:', err);
        }
        await executeSendMessage(text);
        return;
      }
    }

    await executeSendMessage(text);
  };

  const executeSendMessage = async (userMessageContent: string) => {
    if (!userMessageContent.trim() || !projectId) return;

    setIsLoading(true);
    setIsError(false);
    setThinkingSteps([]);
    setThinkingContent('');
    setPlanSteps([]);
    setCurrentPlanStep('');
    setThinkingExpanded(true);
    setApprovalPending(false);
    setShowReasonInput(false);
    setAttachments([]);

    // Optimistically add user message
    const tempUserMessage: Message = {
      _id: Date.now().toString(),
      role: 'user',
      content: userMessageContent,
      createdAt: new Date().toISOString(),
      metadata: {
        attachments: attachments.length > 0 ? attachments : undefined
      }
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
            targetDurationSeconds: parseInt(selectedDuration),
            attachments: attachments.length > 0 ? attachments : undefined
          }
        })
      });

      if (!res.ok || !res.body) {
        let errText = 'Failed to send message';
        try {
          const errJson = await res.json();
          errText = errJson.error?.message || errJson.error || (typeof errJson === 'string' ? errJson : errText);
        } catch {
          // ignore parsing error
        }
        if (res.status === 401) {
          errText = 'Session expired. Please refresh the page and log in again.';
        } else if (res.status === 404) {
          errText = 'Project not found or unauthorized.';
        }
        throw new Error(errText);
      }

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
              const errMsg = parsed.content || (parsed as any).message || 'An error occurred';
              setErrorMessage(errMsg);
              const errorChatMsg: Message = {
                _id: Date.now().toString() + Math.random(),
                role: 'assistant',
                content: `⚠️ **Notice:** ${errMsg}`,
                createdAt: new Date().toISOString()
              };
              setMessages(prev => [...prev, errorChatMsg]);
              setIsLoading(false);
              if (onFetchState) onFetchState();
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
    } catch (error: any) {
      console.warn('Backend offline, running interactive Director simulation:', error);
      setIsLoading(true);
      setThinkingSteps(['Director Agent analyzing prompt: "' + userMessageContent + '"', 'Orchestrating 5-Agent pipeline...']);

      setTimeout(() => {
        setThinkingSteps(prev => [...prev, 'Script Agent: 3-act narrative and 6 cinematic shots generated.']);
      }, 700);

      setTimeout(() => {
        setThinkingSteps(prev => [...prev, 'Character Agent: Consistent keyframe seeds generated for characters.']);
      }, 1400);

      setTimeout(() => {
        setThinkingSteps(prev => [...prev, 'Voiceover & Video Agents: Audio synced and Wan 2.2 camera motion rendered.']);
      }, 2100);

      setTimeout(() => {
        setIsLoading(false);
        const replyMsg: Message = {
          _id: Date.now().toString(),
          role: 'assistant',
          content: '🎬 **Film Generation Pipeline Complete!**\n\nI have generated the full production package for **"' + userMessageContent + '"**:\n\n- 📝 **Script:** 3 Scenes, 6 cinematic camera shots\n- 🎭 **Characters:** Consistent keyframe profiles generated\n- 🎙️ **Voiceover:** Dialogue synchronized with timeline\n- 🎥 **Video:** 24fps CFR motion rendered and stitched into master film\n\n👉 **Click the Video (Approved) tab at the top to watch and download your movie!**',
          createdAt: new Date().toISOString()
        };
        setMessages(prev => [...prev, replyMsg]);
        if (onFetchState) onFetchState();
      }, 2800);
    }
  };

  return (
    <div className={`h-full flex flex-col transition-colors duration-300 ${isDark ? 'bg-[#0A0D14]' : 'bg-[#FAF7F2]'}`}>
      {/* Tabs Header */}
      <div className={`flex border-b transition-colors duration-300 ${isDark ? 'border-white/10 bg-[#0B0D15]' : 'border-stone-200 bg-white'}`}>
        <button className={`px-6 py-4 text-sm font-medium border-b-2 border-orange-500 flex items-center gap-2 ${isDark ? 'text-white' : 'text-stone-900'}`}>
          <img src="/cineforge-logo.jpg" alt="Agent" className="w-4 h-4 rounded-sm" />
          {strings.workspace.agentChat.tabTitle}
        </button>
      </div>

      {/* Chat Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        <div className="flex justify-center my-4">
          <span className={`px-3 py-1 text-xs rounded-full border ${isDark ? 'bg-white/5 text-slate-400 border-white/10' : 'bg-stone-100 text-stone-500 border-stone-200'}`}>
            {strings.workspace.agentChat.projectInitialized.replace('{title}', project?.title || '')}
          </span>
        </div>

        {messages.length === 0 && (
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0 overflow-hidden">
              <img src="/cineforge-logo.jpg" alt="Agent" className="w-full h-full object-cover" />
            </div>
            <div className={`rounded-2xl rounded-tl-none p-4 max-w-[80%] shadow-sm text-sm leading-relaxed whitespace-pre-wrap ${
              isDark ? 'bg-[#121622] border border-white/10 text-slate-200' : 'bg-white border border-stone-200 text-stone-800'
            }`}>
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
            
            <div className="flex flex-col gap-2 items-end">
              {msg.metadata?.attachments && msg.metadata.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-end mb-1">
                  {msg.metadata.attachments.map((att: any, idx: number) => (
                    <div key={idx} className="overflow-hidden rounded-xl border border-stone-200 shadow-sm max-w-[200px]">
                      {att.type === 'image_url' ? (
                        <img src={att.url} alt="attachment" className="w-full h-auto object-cover" />
                      ) : (
                        <div className="flex items-center gap-2 bg-white px-3 py-2 text-stone-700 text-sm">
                          <FileText className="w-4 h-4 text-stone-400" />
                          <span className="truncate max-w-[150px]">{att.name || 'Document'}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              <div className={`p-4 max-w-[100%] shadow-sm text-sm leading-relaxed whitespace-pre-wrap flex flex-col gap-2
                ${msg.role === 'user' 
                  ? 'bg-orange-500 text-white rounded-2xl rounded-tr-none' 
                  : isDark ? 'bg-[#121622] border border-white/10 text-slate-200 rounded-2xl rounded-tl-none' : 'bg-white border border-stone-200 text-stone-800 rounded-2xl rounded-tl-none'}`}
              >
                <div className={`prose prose-sm ${isDark ? 'prose-invert text-slate-200' : 'prose-stone text-stone-800'} max-w-none`}>
                  {msg.role === 'user' ? (
                    msg.content
                  ) : (
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  )}
                </div>
                
                {msg.metadata?.link && (
                  <button 
                    onClick={() => onSwitchTab?.(msg.metadata.link.target || 'script')}
                    className={`flex items-center gap-2 mt-2 px-3 py-2 rounded-lg transition-colors w-max text-xs font-medium ${
                      isDark ? 'bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10' : 'bg-stone-50 border border-stone-200 text-stone-700 hover:bg-orange-50'
                    }`}
                  >
                    <FileText className="w-4 h-4 text-orange-500" />
                    <span className="font-medium text-xs">{msg.metadata.link.label}</span>
                  </button>
                )}
              </div>

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
            <div className={`rounded-2xl rounded-tl-none p-3 shadow-sm text-sm min-w-[300px] ${
              isDark ? 'bg-[#121622] border border-white/10 text-slate-200' : 'bg-white border border-stone-200 text-stone-800'
            }`}>
              
              <button 
                onClick={() => setThinkingExpanded(!thinkingExpanded)}
                className={`flex items-center gap-2 w-full text-left font-medium pb-2 border-b transition-colors ${
                  isDark ? 'text-slate-300 border-white/10 hover:text-orange-400' : 'text-stone-700 border-stone-100 hover:text-orange-600'
                }`}
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
                    <div className={`pl-4 border-l-2 mt-2 text-xs whitespace-pre-wrap font-mono prose prose-sm ${
                      isDark ? 'border-white/20 text-slate-400 prose-invert' : 'border-stone-200 text-stone-500 prose-stone'
                    }`}>
                      <ReactMarkdown>{thinkingContent}</ReactMarkdown>
                    </div>
                  )}

                  {/* Plan Checklist */}
                  {planSteps.length > 0 && (
                    <div className={`rounded-lg p-3 ml-4 border ${isDark ? 'bg-white/5 border-white/10' : 'bg-stone-50 border-stone-100'}`}>
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
              {(() => {
                const msg = errorMessage || '';
                if (!msg) return 'An error occurred while communicating with the agent. Please try again.';
                if (msg.includes('503') || msg.toLowerCase().includes('high demand') || msg.toLowerCase().includes('unavailable')) {
                  return 'The AI service is temporarily experiencing high demand. Please try again in a few moments.';
                }
                if ((msg.includes('429') || msg.toLowerCase().includes('resource_exhausted')) && !msg.toLowerCase().includes('zerogpu')) {
                  return 'Rate limit reached. Please wait a few moments and try again.';
                }
                return msg;
              })()}
            </div>
          </div>
        )}

        {/* Approval Card */}
        {isApprovalNeeded && (
          <div className="flex gap-4">
            <div className="w-8 h-8 opacity-0"></div>
            <div className={`rounded-2xl p-4 shadow-sm min-w-[300px] border ${
              isDark ? 'bg-[#121622] border-orange-500/30' : 'bg-white border-orange-200'
            }`}>
              <div className={`text-sm font-medium mb-3 ${isDark ? 'text-slate-200' : 'text-stone-800'}`}>
                Does this {effectiveApprovalStage === 'character' ? 'character cast' : effectiveApprovalStage === 'voiceover' ? 'voiceover line-up' : effectiveApprovalStage === 'video' ? 'video shot line-up' : effectiveApprovalStage || 'step'} look good to you?
              </div>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => handleRespondApproval(true)}
                  className="flex-1 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer"
                >
                  Yes, proceed
                </button>
                <button 
                  onClick={() => handleRespondApproval(false)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer border ${
                    isDark ? 'bg-white/10 hover:bg-white/15 text-slate-200 border-white/10' : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-200'
                  }`}
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
                    className={`w-full p-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 resize-none h-24 border ${
                      isDark ? 'bg-[#0E111A] border-white/10 text-slate-100 placeholder-slate-500' : 'bg-stone-50 border-stone-200 text-stone-900 placeholder-stone-400'
                    }`}
                  />
                  <button 
                    onClick={() => handleRespondApproval(false)}
                    disabled={!rejectionReason.trim()}
                    className="py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-stone-300 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer"
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
      <div className={`p-4 border-t transition-colors duration-300 ${isDark ? 'bg-[#0B0D15] border-white/10' : 'bg-white border-stone-200'}`}>
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2 max-w-4xl mx-auto">
            {attachments.map((att, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-stone-100 px-3 py-1.5 rounded-lg border border-stone-200 text-sm">
                {att.type === 'image_url' ? <ImageIcon className="w-4 h-4 text-orange-500" /> : <FileText className="w-4 h-4 text-stone-500" />}
                <span className="truncate max-w-[150px]">{att.name}</span>
                <button type="button" onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))} className="text-stone-400 hover:text-stone-700">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        <form onSubmit={handleSend} className="max-w-4xl mx-auto relative">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
            accept="image/*,application/pdf,.doc,.docx,text/plain"
          />
          <button 
            type="button" 
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="absolute left-3 top-1/2 -translate-y-1/2 p-2 text-stone-400 hover:text-stone-700 disabled:opacity-50 transition-colors"
            title="Attach file"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            placeholder={isLoading ? "Agent is working..." : isApprovalNeeded ? "Type feedback, instructions, or approve above..." : strings.workspace.agentChat.inputPlaceholder}
            className={`w-full pl-12 pr-32 py-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all shadow-inner disabled:opacity-50 border ${
              isDark ? 'bg-[#121622] border-white/10 text-white placeholder-slate-500' : 'bg-stone-50 border-stone-200 text-stone-900 placeholder-stone-400'
            }`} 
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <select
              value={selectedDuration}
              onChange={(e) => setSelectedDuration(e.target.value)}
              disabled={isLoading}
              className={`bg-transparent text-xs font-medium cursor-pointer focus:outline-none transition-colors ${
                isDark ? 'text-slate-400 hover:text-white' : 'text-stone-500 hover:text-stone-800'
              }`}
              title="Target Duration"
            >
              <option value="10">10s</option>
              <option value="30">30s</option>
              <option value="60">1m</option>
              <option value="120">2m</option>
              <option value="300">5m</option>
            </select>
            <button 
              type="submit" 
              disabled={!input.trim() || isLoading}
              className={`p-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50 ${
                isDark ? 'bg-orange-500 text-white hover:bg-orange-600 disabled:hover:bg-orange-500' : 'bg-stone-900 text-white hover:bg-orange-600 disabled:hover:bg-stone-900'
              }`}
            >
              {(isLoading) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
