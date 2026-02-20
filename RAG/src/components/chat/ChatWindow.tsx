import { useEffect, useRef, useState } from 'react';
import {
  Sparkles,
  Database,
  Zap,
  Home,
  FileText,
  TrendingUp,
  Target,
  ChevronRight,
  Upload,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import {
  selectActiveConversation,
  selectIsLoading,
  addMessage,
  setLoading,
  createConversation,
  selectActiveConversationId,
} from '../../store/slices/chatSlice';
import axios from 'axios';
import { postQuery, getStatus } from '../../services/api/ragService';
import type { StatusResponse } from '../../types/rag.types';
import MessageBubble from './MessageBubble';
import InputBox from './InputBox';
import UploadButton from './UploadButton';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function getErrorMessage(err: unknown): string {
  if (!axios.isAxiosError(err)) {
    return "I'm having trouble processing your request right now. Please try again in a moment.";
  }

  const status = err.response?.status;

  if (!err.response) {
    if (err.code === 'ECONNABORTED') {
      return "Your request is taking longer than usual. Please try again in a few seconds.";
    }
    return "I'm currently unavailable. Please try again in a few moments.";
  }

  if (status === 500) {
    return "Sorry, I ran into an issue while processing your query. Please try again shortly.";
  }

  if (status === 503) {
    return "I'm temporarily unavailable — this usually resolves in a few seconds. Please try again shortly.";
  }

  if (status === 429) {
    return "I'm receiving too many requests right now. Please wait a moment and try again.";
  }

  if (status === 408 || status === 504) {
    return "Your request timed out. Please try again in a few seconds.";
  }

  if (status && status >= 400 && status < 500) {
    return "There was a problem with your request. Please try rephrasing your question.";
  }

  return "Something went wrong. Please try again in a moment.";
}

function TypingIndicator() {
  return (
    <div className="flex gap-3 px-4 py-4 max-w-3xl mx-auto w-full">
      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
        <Sparkles size={16} className="text-white" />
      </div>
      <div className="flex items-center gap-1 py-2">
        <span
          className="w-2 h-2 bg-slate-400 rounded-full animate-bounce-dot"
          style={{ animationDelay: '0s' }}
        />
        <span
          className="w-2 h-2 bg-slate-400 rounded-full animate-bounce-dot"
          style={{ animationDelay: '0.2s' }}
        />
        <span
          className="w-2 h-2 bg-slate-400 rounded-full animate-bounce-dot"
          style={{ animationDelay: '0.4s' }}
        />
      </div>
    </div>
  );
}

function StatusBar({ status }: { status: StatusResponse | null }) {
  if (!status) return null;
  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-white border-b border-slate-200 text-xs text-slate-500">
      <div className="flex items-center gap-1.5">
        <Database size={12} className="text-slate-400" />
        <span>{status.total_documents} docs</span>
        <span className="text-slate-300">|</span>
        <span>{status.total_chunks} chunks</span>
      </div>
      <span className="text-slate-300">|</span>
      <span>LLM: {status.llm_model}</span>
    </div>
  );
}

const FAQ_ITEMS = [
  {
    icon: Home,
    text: 'What are the available property listings?',
  },
  {
    icon: FileText,
    text: 'Summarize the latest property details.',
  },
  {
    icon: TrendingUp,
    text: 'What are the price trends in this area?',
  },
  {
    icon: Target,
    text: 'What amenities does this property offer?',
  },
];

function EmptyState({ onSendQuery }: { onSendQuery: (q: string) => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-[800px] flex flex-col items-center space-y-10">
        {/* Hero Section */}
        <div className="text-center space-y-4">
          <h1 className="text-slate-900 text-4xl md:text-5xl font-bold tracking-tight leading-tight">
            How can I assist your{' '}
            <span className="text-primary">real estate</span> needs today?
          </h1>
          <p className="text-slate-500 text-lg max-w-xl mx-auto">
            Upload property documents and ask questions. I'll find answers from
            your knowledge base using AI-powered retrieval.
          </p>
        </div>

        {/* Upload Zone */}
        <div className="w-full">
          <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 py-10 transition-all hover:bg-slate-50 group">
            <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
              <Upload size={28} />
            </div>
            <div className="flex flex-col items-center gap-1">
              <p className="text-slate-900 text-lg font-semibold">
                Upload Property Documents
              </p>
              <p className="text-slate-500 text-sm">
                Drop PDF, DOCX, XLSX, or TXT files here or click to browse
              </p>
            </div>
            <UploadButton variant="prominent" />
          </div>
        </div>

        {/* FAQ Grid */}
        <div className="w-full space-y-4">
          <div className="flex items-center gap-2 text-slate-500 px-1">
            <Zap size={14} />
            <h4 className="text-xs font-bold uppercase tracking-widest">
              Common Queries
            </h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {FAQ_ITEMS.map((item, index) => (
              <button
                key={index}
                onClick={() => onSendQuery(item.text)}
                className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 bg-white text-left hover:border-primary hover:shadow-md transition-all group"
              >
                <div className="p-2 rounded-lg bg-slate-50 text-slate-400 group-hover:text-primary transition-colors">
                  <item.icon size={20} />
                </div>
                <span className="text-slate-700 font-medium text-sm flex-1">
                  {item.text}
                </span>
                <ChevronRight
                  size={16}
                  className="text-slate-300 group-hover:text-primary transition-colors"
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ChatWindow() {
  const dispatch = useAppDispatch();
  const activeConversation = useAppSelector(selectActiveConversation);
  const activeId = useAppSelector(selectActiveConversationId);
  const isLoading = useAppSelector(selectIsLoading);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [ragStatus, setRagStatus] = useState<StatusResponse | null>(null);

  const fetchStatus = async () => {
    try {
      const status = await getStatus();
      setRagStatus(status);
    } catch {
      // Status bar won't show if backend is unreachable
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages.length, isLoading]);

  const handleSend = async (content: string) => {
    let conversationId = activeId;

    // Auto-create a conversation if none is active
    if (!conversationId) {
      const now = new Date().toISOString();
      const newConv = {
        id: generateId(),
        title: 'New Chat',
        messages: [],
        createdAt: now,
        updatedAt: now,
      };
      dispatch(createConversation(newConv));
      conversationId = newConv.id;
    }

    // Add user message
    const userMessage = {
      id: generateId(),
      role: 'user' as const,
      content,
      timestamp: new Date().toISOString(),
    };
    dispatch(addMessage({ conversationId, message: userMessage }));

    // Call RAG API
    dispatch(setLoading(true));
    try {
      const response = await postQuery({ question: content });
      const assistantMessage = {
        id: generateId(),
        role: 'assistant' as const,
        content: response.answer,
        timestamp: new Date().toISOString(),
        sources: response.sources,
        processingTimeMs: response.processing_time_ms,
      };
      dispatch(addMessage({ conversationId, message: assistantMessage }));
    } catch (err: unknown) {
      const errorMessage = {
        id: generateId(),
        role: 'assistant' as const,
        content: getErrorMessage(err),
        timestamp: new Date().toISOString(),
      };
      dispatch(addMessage({ conversationId, message: errorMessage }));
    } finally {
      dispatch(setLoading(false));
    }
  };

  const handleUploadSuccess = (filename: string, chunksAdded: number) => {
    fetchStatus();

    let conversationId = activeId;

    // Create a conversation if none exists, so the upload message has somewhere to go
    if (!conversationId) {
      const now = new Date().toISOString();
      const newConv = {
        id: generateId(),
        title: 'New Chat',
        messages: [],
        createdAt: now,
        updatedAt: now,
      };
      dispatch(createConversation(newConv));
      conversationId = newConv.id;
    }

    dispatch(
      addMessage({
        conversationId,
        message: {
          id: generateId(),
          role: 'assistant' as const,
          content: `Document **${filename}** uploaded successfully. ${chunksAdded} chunks added to the knowledge base. You can now ask questions about it.`,
          timestamp: new Date().toISOString(),
        },
      })
    );
  };

  const messages = activeConversation?.messages ?? [];
  const hasMessages = messages.length > 0;

  return (
    <div className="flex-1 flex flex-col h-full bg-chat-bg">
      {/* Status bar */}
      <StatusBar status={ragStatus} />

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {hasMessages ? (
          <div className="py-4">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {isLoading && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        ) : (
          <EmptyState onSendQuery={handleSend} />
        )}
      </div>

      {/* Input area with upload */}
      <div className="w-full max-w-3xl mx-auto px-4 pb-4 pt-2">
        <div className="flex items-center gap-2">
          <UploadButton onUploadSuccess={handleUploadSuccess} />
          <div className="flex-1">
            <InputBox onSend={handleSend} isLoading={isLoading} />
          </div>
        </div>
        <p className="text-[11px] text-slate-400 text-center mt-2">
          RAG can make mistakes. Verify answers with source documents.
        </p>
      </div>

      {/* Footer */}
      <div className="py-3 border-t border-slate-200 text-center">
        <p className="text-slate-400 text-xs">
          Powered by RAG Engine &bull; SellBot AI
        </p>
      </div>
    </div>
  );
}

export default ChatWindow;
