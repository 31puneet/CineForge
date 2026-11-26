import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, FileText, Loader2, ChevronDown, ChevronRight, CheckCircle2, Circle, Paperclip, X, Image as ImageIcon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

import strings from '../../constants/strings.json';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import type { Project, ProjectAttachment, ProjectMessage, WorkflowEvent, WorkflowState } from '../../types/workflow';

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

interface AgentChatProps {
  project: Project;
  workflowState?: WorkflowState | null;
  onFetchState?: () => Promise<void>;
  onSwitchTab?: (tab: string) => void;
}

export function AgentChat({ project, workflowState, onFetchState, onSwitchTab }: AgentChatProps) {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const projectId = project?.id || project?._id;
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [selectedDuration, setSelectedDuration] = useState('60');
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [thinkingExpanded, setThinkingExpanded] = useState(true);
  const [thinkingSteps, setThinkingSteps] = useState<string[]>([]);
  const [thinkingContent, setThinkingContent] = useState('');
  const [planSteps, setPlanSteps] = useState<string[]>([]);
  const [currentPlanStep, setCurrentPlanStep] = useState('');
  const [approvalPending, setApprovalPending] = useState(false);
  const [approvalStage, setApprovalStage] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);
  const [isPollingTransition, setIsPollingTransition] = useState(false);
  const [attachments, setAttachments] = useState<ProjectAttachment[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamAbortRef = useRef<AbortController | null>(null);

  const effectiveApprovalStage = approvalStage || (() => {
    if (!workflowState) return '';
    const approvals = workflowState.approval_states || {};
    if (!approvals.script_approved && workflowState.script_data) return 'script';
    if (!approvals.characters_approved && (workflowState.characters?.length ?? 0) > 0) return 'characters';
    if (!approvals.voiceovers_approved && (workflowState.voiceovers?.length ?? 0) > 0) return 'voiceover';
    if (!approvals.video_approved && (workflowState.video_shots?.length ?? 0) > 0) return 'video';
    if (approvals.video_approved && !approvals.assembly_confirmed) return 'assembly';
    return '';
  })();

  const isApprovalNeeded = (approvalPending || !!effectiveApprovalStage) && !isLoading;

  const fetchMessages = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await apiClient.get<ProjectMessage[]>(`/projects/${projectId}/messages`);
      setMessages(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    apiClient
      .get<ProjectMessage[]>(`/projects/${projectId}/messages`)
      .then((res) => {
        if (!cancelled) {
          setMessages(Array.isArray(res.data) ? res.data : []);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('Failed to fetch messages:', error);
        }
      });

    const abortController = streamAbortRef.current;
    return () => {
      cancelled = true;
      abortController?.abort();
    };
  }, [projectId]);

  useEffect(() => {
    const stage = workflowState?.current_stage;
    const isTerminal = stage === 'completed' || Boolean(stage?.endsWith('failed'));
    if (!isPollingTransition || !projectId || isTerminal) return;

    const timer = window.setInterval(() => {
      onFetchState?.();
      fetchMessages();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [isPollingTransition, projectId, workflowState?.current_stage, onFetchState, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, thinkingSteps, approvalPending, showReasonInput]);

  const submitApprovalResponse = async (approved: boolean, reasonText: string) => {
    if (isSubmittingApproval || !projectId) return;
    setIsSubmittingApproval(true);
    setIsError(false);
    setErrorMessage('');
    const stageToRespond = effectiveApprovalStage || approvalStage || 'script';
    const stageVersion =
      stageToRespond === 'characters'
        ? workflowState?.character_version || 1
        : stageToRespond === 'script'
          ? workflowState?.script_version || 1
          : 1;

    try {
      await apiClient.post(`/projects/${projectId}/messages/respond`, {
        approved,
        reason: reasonText,
        stage: stageToRespond,
        version: stageVersion,
      });
      setApprovalPending(false);
      setApprovalStage('');
      setShowReasonInput(false);
      setRejectionReason('');
      setMessages((prev) => [
        ...prev,
        {
          _id: `${Date.now()}`,
          role: 'user',
          content: approved ? 'Yes, proceed' : `Revise: ${reasonText}`,
          createdAt: new Date().toISOString(),
        },
      ]);
      setIsPollingTransition(true);
      await Promise.all([onFetchState?.(), fetchMessages()]);
    } catch (error) {
      console.error('Failed to submit approval:', error);
      setIsError(true);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to submit approval response.');
      setIsLoading(false);
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  const handleRespondApproval = async (approved: boolean) => {
    if (isSubmittingApproval) return;
    if (!approved && !showReasonInput) {
      setShowReasonInput(true);
      return;
    }
    await submitApprovalResponse(approved, rejectionReason.trim());
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_ATTACHMENT_BYTES) {
      setIsError(true);
      setErrorMessage(`File '${file.name}' exceeds the 10MB attachment limit.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result;
      if (typeof base64 === 'string') {
        setAttachments((prev) => [
          ...prev,
          {
            type: file.type.startsWith('image/') ? 'image_url' : 'file',
            url: base64,
            name: file.name,
            mimeType: file.type,
          },
        ]);
      }
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !projectId) return;
    const text = input.trim();
    setInput('');

    const cleanLower = text.toLowerCase().trim().replace(/[.!]+$/, '');
    const isAffirmative = ['yes', 'proceed', 'continue', 'next', 'approve', 'approved', 'looks good', 'ok', 'good', 'sure', 'advance'].includes(cleanLower);

    if (isApprovalNeeded) {
      await submitApprovalResponse(isAffirmative, isAffirmative ? '' : text);
      return;
    }

    await executeSendMessage(text);
  };

  const executeSendMessage = async (userMessageContent: string) => {
    if (!userMessageContent.trim() || !projectId) return;

    streamAbortRef.current?.abort();
    const controller = new AbortController();
    streamAbortRef.current = controller;

    const currentAttachments = [...attachments];
    setIsLoading(true);
    setIsError(false);
    setErrorMessage('');
    setThinkingSteps([]);
    setThinkingContent('');
    setPlanSteps([]);
    setCurrentPlanStep('');
    setThinkingExpanded(true);
    setApprovalPending(false);
    setShowReasonInput(false);
    setAttachments([]);

    const tempUserMessage: ProjectMessage = {
      _id: `${Date.now()}`,
      role: 'user',
      content: userMessageContent,
      createdAt: new Date().toISOString(),
      metadata: currentAttachments.length > 0 ? { attachments: currentAttachments } : undefined,
    };
    setMessages((prev) => [...prev, tempUserMessage]);

    try {
      const baseURL = apiClient.defaults.baseURL || 'http://localhost:3000/api';
      const res = await fetch(`${baseURL}/projects/${projectId}/messages`, {
        method: 'POST',
        credentials: 'include',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: userMessageContent,
          metadata: {
            targetDurationSeconds: parseInt(selectedDuration, 10),
            attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
          },
        }),
      });

      if (!res.ok || !res.body) {
        let errText = 'Failed to send message';
        try {
          const errJson = (await res.json()) as { error?: string | { message?: string } };
          if (typeof errJson.error === 'string') errText = errJson.error;
          else if (errJson.error?.message) errText = errJson.error.message;
        } catch {
          // ignore non-JSON error body
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
      let lineBuffer = '';

      const handleParsedLine = (rawLine: string) => {
        const trimmed = rawLine.trim();
        if (!trimmed) return;
        try {
          const parsed = JSON.parse(trimmed) as WorkflowEvent;
          if (parsed.type === 'ping') return;
          if (parsed.type === 'status') {
            setThinkingSteps((prev) => [...prev, parsed.content]);
          } else if (parsed.type === 'thinking') {
            setThinkingContent((prev) => prev + parsed.content);
          } else if (parsed.type === 'plan') {
            setPlanSteps(parsed.steps);
            setCurrentPlanStep(parsed.current);
          } else if (parsed.type === 'plan_update') {
            setCurrentPlanStep(parsed.current);
          } else if (parsed.type === 'message') {
            setThinkingExpanded(false);
            setMessages((prev) => [
              ...prev,
              {
                _id: `${Date.now()}-${Math.random()}`,
                role: 'assistant',
                content: parsed.content,
                createdAt: new Date().toISOString(),
                metadata: parsed.link ? { link: parsed.link } : {},
              },
            ]);
            onFetchState?.();
          } else if (parsed.type === 'approval_request') {
            setApprovalPending(true);
            setApprovalStage(parsed.stage);
            setIsLoading(false);
            setIsPollingTransition(false);
          } else if (parsed.type === 'error') {
            setIsError(true);
            const errMsg = parsed.content || parsed.message || 'An error occurred';
            setErrorMessage(errMsg);
            setMessages((prev) => [
              ...prev,
              {
                _id: `${Date.now()}-${Math.random()}`,
                role: 'assistant',
                content: `⚠️ **Notice:** ${errMsg}`,
                createdAt: new Date().toISOString(),
              },
            ]);
            setIsLoading(false);
            setIsPollingTransition(false);
            onFetchState?.();
          } else if (parsed.type === 'done') {
            setIsLoading(false);
            setThinkingExpanded(false);
            setIsPollingTransition(false);
            onFetchState?.();
          }
        } catch (e) {
          console.error('Failed to parse NDJSON event', e);
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        lineBuffer += decoder.decode(value, { stream: true });
        const lines = lineBuffer.split('\n');
        lineBuffer = lines.pop() ?? '';
        for (const line of lines) {
          handleParsedLine(line);
        }
      }

      lineBuffer += decoder.decode();
      if (lineBuffer.trim()) {
        handleParsedLine(lineBuffer);
      }
      setIsLoading(false);
    } catch (error) {
      if ((error as { name?: string })?.name === 'AbortError') return;
      console.error('Error sending message:', error);
      setIsLoading(false);
      setIsError(true);
      setErrorMessage(error instanceof Error ? error.message : 'Unable to reach workflow service.');
    }
  };

  return (
    <div className={`h-full flex flex-col transition-colors duration-300 ${isDark ? 'bg-[#0A0D14]' : 'bg-[#FAF7F2]'}`}>
      <div className={`flex border-b transition-colors duration-300 ${isDark ? 'border-white/10 bg-[#0B0D15]' : 'border-stone-200 bg-white'}`}>
        <button className={`px-6 py-4 text-sm font-medium border-b-2 border-orange-500 flex items-center gap-2 ${isDark ? 'text-white' : 'text-stone-900'}`}>
          <img src="/cineforge-logo.jpg" alt="Agent" className="w-4 h-4 rounded-sm" />
          {strings.workspace.agentChat.tabTitle}
        </button>
      </div>

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

        {messages.map((msg, idx) => (
          <div key={msg._id || idx} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role !== 'user' && (
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0 overflow-hidden mt-1">
                <img src="/cineforge-logo.jpg" alt="Agent" className="w-full h-full object-cover" />
              </div>
            )}

            <div className="flex flex-col gap-2 items-end">
              {msg.metadata?.attachments && msg.metadata.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-end mb-1">
                  {msg.metadata.attachments.map((att, attIdx) => (
                    <div key={attIdx} className="overflow-hidden rounded-xl border border-stone-200 shadow-sm max-w-[200px]">
                      {att.type === 'image_url' && (att.url.startsWith('data:image/') || att.url.startsWith('https://') || att.url.startsWith('/')) ? (
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
                  {msg.role === 'user' ? msg.content : <ReactMarkdown>{msg.content}</ReactMarkdown>}
                </div>

                {msg.metadata?.link && (
                  <button
                    onClick={() => onSwitchTab?.(msg.metadata?.link?.target || 'script')}
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
                  <div className="flex flex-col gap-1.5 text-xs text-stone-500">
                    {thinkingSteps.map((step, idx) => (
                      <div key={idx} className="flex gap-2">
                        <span className="text-orange-400">▸</span> {step}
                      </div>
                    ))}
                  </div>

                  {thinkingContent && (
                    <div className={`pl-4 border-l-2 mt-2 text-xs whitespace-pre-wrap font-mono prose prose-sm ${
                      isDark ? 'border-white/20 text-slate-400 prose-invert' : 'border-stone-200 text-stone-500 prose-stone'
                    }`}>
                      <ReactMarkdown>{thinkingContent}</ReactMarkdown>
                    </div>
                  )}

                  {planSteps.length > 0 && (
                    <div className={`rounded-lg p-3 ml-4 border ${isDark ? 'bg-white/5 border-white/10' : 'bg-stone-50 border-stone-100'}`}>
                      <div className="text-xs font-semibold text-stone-600 mb-2">Workflow Plan:</div>
                      <div className="flex flex-col gap-2">
                        {planSteps.map((step, idx) => {
                          let stepState = 'pending';
                          const currentIndex = planSteps.indexOf(currentPlanStep);
                          if (idx < currentIndex) stepState = 'completed';
                          else if (idx === currentIndex) {
                            stepState = isLoading || approvalPending ? 'current' : 'completed';
                          }

                          return (
                            <div key={idx} className={`flex items-center gap-2 text-xs ${stepState === 'current' ? 'text-orange-600 font-medium' : stepState === 'completed' ? 'text-stone-700' : 'text-stone-400'}`}>
                              {stepState === 'completed' ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                                : stepState === 'current' ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  : <Circle className="w-3.5 h-3.5" />}
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

        {isApprovalNeeded && (
          <div className="flex gap-4">
            <div className="w-8 h-8 opacity-0"></div>
            <div className={`rounded-2xl p-4 shadow-sm min-w-[300px] border ${
              isDark ? 'bg-[#121622] border-orange-500/30' : 'bg-white border-orange-200'
            }`}>
              <div className={`text-sm font-medium mb-3 ${isDark ? 'text-slate-200' : 'text-stone-800'}`}>
                {effectiveApprovalStage === 'assembly'
                  ? 'All shots are approved! Confirm to assemble the final master film?'
                  : `Does this ${effectiveApprovalStage === 'character' ? 'character cast' : effectiveApprovalStage === 'voiceover' ? 'voiceover line-up' : effectiveApprovalStage === 'video' ? 'video shot line-up' : effectiveApprovalStage || 'step'} look good to you?`}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => handleRespondApproval(true)}
                  disabled={isSubmittingApproval}
                  className="flex-1 py-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer"
                >
                  Yes, proceed
                </button>
                <button
                  onClick={() => handleRespondApproval(false)}
                  disabled={isSubmittingApproval}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer border disabled:opacity-50 ${
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
                    disabled={!rejectionReason.trim() || isSubmittingApproval}
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

      <div className={`p-4 border-t transition-colors duration-300 ${isDark ? 'bg-[#0B0D15] border-white/10' : 'bg-white border-stone-200'}`}>
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2 max-w-4xl mx-auto">
            {attachments.map((att, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-stone-100 px-3 py-1.5 rounded-lg border border-stone-200 text-sm">
                {att.type === 'image_url' ? <ImageIcon className="w-4 h-4 text-orange-500" /> : <FileText className="w-4 h-4 text-stone-500" />}
                <span className="truncate max-w-[150px]">{att.name}</span>
                <button type="button" onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))} className="text-stone-400 hover:text-stone-700">
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
            placeholder={isLoading ? 'Agent is working...' : isApprovalNeeded ? 'Type feedback, instructions, or approve above...' : strings.workspace.agentChat.inputPlaceholder}
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
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
