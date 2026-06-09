'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { XMarkIcon, PaperAirplaneIcon, SparklesIcon } from '@heroicons/react/24/outline';
import type { AgentMessage, AgentLocationData, AgentResponse } from '@/app/api/survey/agent/route';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SurveyLocation {
  id:               number;
  projectId:        number | null;
  areaName:         string | null;
  floor:            string | null;
  surveyNotes:      string | null;
  notes:            string | null;
  mountingLocation: string | null;
  coveragePurpose:  string | null;
  surveyedAt:       string | null;
  images:           unknown[];
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface SurveyAgentChatProps {
  projectId:       number;
  buildingName:    string;
  onLocationSaved: (location: SurveyLocation) => void;
  onExit:          () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SurveyAgentChat({ projectId, buildingName, onLocationSaved, onExit }: SurveyAgentChatProps) {
  const greeting = `Hi! I'll walk you through logging locations for this survey in "${buildingName}". What floor is the first location on?`;

  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: greeting },
  ]);
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const bottomRef             = useRef<HTMLDivElement>(null);
  const inputRef              = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [loading]);

  const saveLocation = useCallback(async (data: AgentLocationData): Promise<SurveyLocation | null> => {
    try {
      const res = await fetch('/api/survey/locations', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId:   data.projectId,
          areaName:    data.areaName,
          floor:       data.floor ?? undefined,
          surveyNotes: data.surveyNotes ?? undefined,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      return await res.json() as SurveyLocation;
    } catch {
      return null;
    }
  }, []);

  const sendMessage = useCallback(async (userText: string) => {
    if (!userText.trim() || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: userText.trim() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const historyToSend: AgentMessage[] = nextMessages.map(m => ({
        role:    m.role,
        content: m.content,
      }));

      const res = await fetch('/api/survey/agent', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: historyToSend, projectId, buildingName }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? 'Agent request failed');
      }

      const data: AgentResponse = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);

      if (data.action) {
        if (data.action.type === 'save' && data.action.data) {
          const saved = await saveLocation(data.action.data);
          if (saved) {
            onLocationSaved(saved);
          } else {
            setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I had trouble saving that location. Want to try again?' }]);
          }
        } else if (data.action.type === 'exit') {
          setTimeout(() => onExit(), 1200);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [messages, loading, projectId, buildingName, saveLocation, onLocationSaved, onExit]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white rounded-t-2xl shadow-2xl flex flex-col" style={{ maxHeight: '80vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <SparklesIcon className="w-5 h-5 text-blue-500" />
            <span className="text-sm font-semibold text-gray-800">Survey Assistant</span>
            <span className="text-xs text-gray-400">— {buildingName}</span>
          </div>
          <button onClick={onExit} className="p-1 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'}`}>
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-2.5 flex gap-1">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          {error && (
            <div className="flex justify-center">
              <p className="text-xs text-red-500 bg-red-50 px-3 py-1.5 rounded-lg">{error}</p>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-gray-100 shrink-0">
          <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200 focus-within:border-blue-400 transition-colors">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              placeholder="Type your response…"
              className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none disabled:opacity-50"
            />
            <button onClick={() => sendMessage(input)} disabled={loading || !input.trim()} className="p-1 text-blue-500 hover:text-blue-700 disabled:opacity-30 transition-colors">
              <PaperAirplaneIcon className="w-5 h-5" />
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1.5 text-center">
            Say <span className="font-medium">save</span>, <span className="font-medium">next</span>, or <span className="font-medium">exit</span> at any time
          </p>
        </div>
      </div>
    </div>
  );
}
