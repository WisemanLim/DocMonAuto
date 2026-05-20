'use client';

import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { queryApi } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import type { ChatMessage } from '@/types';
import { Send, Bot, User, FileText, Clock, Loader2, History } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: history } = useQuery({
    queryKey: ['query-history'],
    queryFn: queryApi.history,
    enabled: showHistory,
  });

  const mutation = useMutation({
    mutationFn: queryApi.ask,
    onSuccess: (data) => {
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.answer,
        sources: data.sources,
        llmProvider: data.llmProvider ?? undefined,
        llmModel: data.llmModel ?? undefined,
        latencyMs: data.latencyMs,
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    },
    onError: () => {
      const errMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, errMsg]);
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSend() {
    const q = input.trim();
    if (!q || mutation.isPending) return;
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: q,
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    mutation.mutate(q);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col">
        <header className="flex items-center justify-between px-6 py-3 border-b bg-white">
          <h1 className="font-semibold text-gray-900">문서 질의응답</h1>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors',
              showHistory
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700',
            )}
          >
            <History className="w-4 h-4" />
            이력
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 scrollbar-thin">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
              <Bot className="w-12 h-12 mb-3 opacity-30" />
              <p className="font-medium">문서에 대해 질문하세요</p>
              <p className="text-sm mt-1">인덱싱된 문서 내용을 검색하여 답변합니다</p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn('flex gap-3', msg.role === 'user' && 'flex-row-reverse')}
            >
              <div
                className={cn(
                  'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
                  msg.role === 'user' ? 'bg-blue-600' : 'bg-gray-200',
                )}
              >
                {msg.role === 'user' ? (
                  <User className="w-4 h-4 text-white" />
                ) : (
                  <Bot className="w-4 h-4 text-gray-600" />
                )}
              </div>

              <div className={cn('flex flex-col gap-1 max-w-[75%]', msg.role === 'user' && 'items-end')}>
                <div
                  className={cn(
                    'px-4 py-3 rounded-2xl text-sm leading-relaxed',
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-sm'
                      : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm',
                  )}
                >
                  {msg.role === 'assistant' ? (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2"
                    >
                      {msg.content}
                    </ReactMarkdown>
                  ) : (
                    msg.content
                  )}
                </div>

                {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {msg.sources.slice(0, 3).map((src, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-500"
                        title={src.text || src.excerpt || ''}
                      >
                        <FileText className="w-3 h-3" />
                        출처 {i + 1} (score: {src.score.toFixed(2)})
                      </span>
                    ))}
                  </div>
                )}

                {msg.role === 'assistant' &&
                  (msg.latencyMs != null || msg.llmProvider || msg.llmModel) && (
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Clock className="w-3 h-3" />
                    {msg.latencyMs != null ? `${msg.latencyMs}ms` : '—'}
                    {(msg.llmProvider || msg.llmModel) && (
                      <>
                        {' '}
                        · {msg.llmProvider ?? '—'}/{msg.llmModel ?? '—'}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {mutation.isPending && (
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                <Bot className="w-4 h-4 text-gray-600" />
              </div>
              <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-white border border-gray-200 shadow-sm">
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div className="px-4 py-3 border-t bg-white">
          <div className="flex gap-2 items-end">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="질문을 입력하세요... (Shift+Enter 줄바꿈)"
              rows={1}
              className="flex-1 resize-none px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent max-h-32 overflow-y-auto scrollbar-thin"
              style={{ minHeight: '40px' }}
              onInput={(e) => {
                const t = e.currentTarget;
                t.style.height = 'auto';
                t.style.height = Math.min(t.scrollHeight, 128) + 'px';
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || mutation.isPending}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {showHistory && (
        <aside className="w-72 border-l bg-white overflow-y-auto scrollbar-thin">
          <div className="px-4 py-3 border-b">
            <h2 className="font-medium text-sm text-gray-700">질의 이력</h2>
          </div>
          <div className="divide-y">
            {history?.map((log) => (
              <div key={log.id} className="px-4 py-3 hover:bg-gray-50 cursor-pointer">
                <p className="text-sm text-gray-800 line-clamp-2">{log.query}</p>
                <p className="text-xs text-gray-400 mt-1">{formatDate(log.createdAt)}</p>
              </div>
            ))}
            {history?.length === 0 && (
              <p className="px-4 py-8 text-sm text-gray-400 text-center">이력이 없습니다</p>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
