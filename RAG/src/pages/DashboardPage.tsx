import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, FolderOpen, X, Loader2, LayoutGrid, AlertCircle, Bot, Send, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getProjects, createProject } from '@services/api/projectService';
import { postQuery } from '@services/api/ragService';
import { ROUTES } from '@routes/routeNames';
import type { ProjectResponse } from '../types/rag.types';

interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  source_type?: 'faq' | 'rag';
}

// Palette of card accent colors cycling across projects
const CARD_COLORS = [
  '#fb7185', // rose
  '#a78bfa', // violet
  '#34d399', // emerald
  '#60a5fa', // blue
  '#fbbf24', // amber
  '#f472b6', // pink
  '#2dd4bf', // teal
];

function formatDate(iso?: string) {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
  } catch {
    return '';
  }
}

export function DashboardPage() {
  const navigate = useNavigate();

  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Global AI chat (ISSUE_021)
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: '0', type: 'ai', content: "Hi! I'm SellBot AI. Ask me anything across all your projects." }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getProjects();
      setProjects(data.projects);
    } catch {
      setError('Could not reach the backend. Make sure the API server is running.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  async function handleCreate() {
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    setCreateError('');
    try {
      const created = await createProject(name);
      setProjects((prev) => [...prev, created]);
      setShowNew(false);
      setNewName('');
      navigate(ROUTES.PROJECT_MINDMAP(created.project_id), { state: { projectName: name } });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        ?? 'Failed to create project. Is the backend running?';
      setCreateError(msg);
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  async function handleSend() {
    if (!chatInput.trim() || chatLoading) return;
    const question = chatInput.trim();
    setChatInput('');
    setChatMessages((prev) => [...prev, { id: Date.now().toString(), type: 'user', content: question }]);
    setChatLoading(true);
    try {
      const res = await postQuery({ question, global_search: true });
      setChatMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          type: 'ai',
          content: res.answer,
          source_type: res.source_type as 'faq' | 'rag',
        },
      ]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), type: 'ai', content: 'Sorry, something went wrong. Please try again.' },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  function openModal() {
    setShowNew(true);
    setNewName('');
    setCreateError('');
  }

  function closeModal() {
    setShowNew(false);
    setCreateError('');
  }

  return (
    <div className="flex h-full overflow-hidden">

      {/* Main column */}
      <div className="flex flex-col flex-1 overflow-y-auto custom-scrollbar px-6 py-8 min-w-0">

      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-8 flex-shrink-0"
      >
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Projects</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Select a project to explore its knowledge base
          </p>
        </div>
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            onClick={openModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-primary rounded-xl text-white text-sm font-semibold shadow-lg shadow-brand-primary/25 hover:bg-brand-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Project
          </motion.button>
        </div>
      </motion.div>

      {/* Body */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
          <span className="ml-3 text-slate-400 text-sm">Loading projects…</span>
        </div>
      ) : error ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
          <AlertCircle className="w-12 h-12 text-slate-600" />
          <p className="text-slate-400 text-sm max-w-sm">{error}</p>
          <button
            onClick={loadProjects}
            className="text-xs text-brand-primary hover:underline"
          >
            Retry
          </button>
        </div>
      ) : projects.length === 0 ? (
        /* Empty state */
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex-1 flex flex-col items-center justify-center gap-5 text-center"
        >
          <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
            <LayoutGrid className="w-9 h-9 text-slate-600" />
          </div>
          <div>
            <p className="text-white font-semibold text-lg">No projects yet</p>
            <p className="text-slate-500 text-sm mt-1 max-w-xs">
              Create your first project to start uploading documents and generating FAQ mind maps.
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            onClick={openModal}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-primary rounded-xl text-white text-sm font-semibold shadow-lg shadow-brand-primary/25"
          >
            <Plus className="w-4 h-4" />
            Create First Project
          </motion.button>
        </motion.div>
      ) : (
        /* Project grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {projects.map((project, i) => {
            const accent = CARD_COLORS[i % CARD_COLORS.length];
            return (
              <motion.div
                key={project.project_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                onClick={() => navigate(ROUTES.PROJECT_MINDMAP(project.project_id), { state: { projectName: project.project_name } })}
                className="glass-card rounded-2xl p-5 cursor-pointer border border-white/10 hover:border-white/20 transition-colors group relative overflow-hidden"
              >
                {/* Top color bar */}
                <div
                  className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
                  style={{ backgroundColor: accent }}
                />

                {/* Icon */}
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                  style={{ backgroundColor: `${accent}1a` }}
                >
                  <FolderOpen className="w-5 h-5" style={{ color: accent }} />
                </div>

                {/* Name */}
                <h3 className="text-white font-semibold text-base leading-snug line-clamp-2 mb-1 group-hover:text-white/90">
                  {project.project_name}
                </h3>

                {/* Meta */}
                <p className="text-slate-500 text-xs truncate mb-4">
                  {project.vdb_namespace}
                </p>

                {/* Footer */}
                <div className="flex items-center justify-between">
                  {project.created_at && (
                    <span className="text-[11px] text-slate-600">
                      {formatDate(project.created_at)}
                    </span>
                  )}
                  <span
                    className="text-[11px] font-medium ml-auto flex items-center gap-1"
                    style={{ color: accent }}
                  >
                    Open →
                  </span>
                </div>
              </motion.div>
            );
          })}

          {/* Add project card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: projects.length * 0.06 }}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            onClick={openModal}
            className="glass-card rounded-2xl p-5 cursor-pointer border border-dashed border-white/10 hover:border-brand-primary/40 transition-colors flex flex-col items-center justify-center gap-3 min-h-[160px] group"
          >
            <div className="w-11 h-11 rounded-xl bg-brand-primary/10 flex items-center justify-center group-hover:bg-brand-primary/20 transition-colors">
              <Plus className="w-5 h-5 text-brand-primary" />
            </div>
            <span className="text-sm text-slate-500 group-hover:text-slate-300 transition-colors font-medium">
              New Project
            </span>
          </motion.div>
        </div>
      )}

      {/* ---- New Project Modal ---- */}
      <AnimatePresence>
        {showNew && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={closeModal}
          >
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

            <motion.div
              initial={{ scale: 0.92, y: 24, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.92, y: 24, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md glass-card rounded-2xl shadow-2xl overflow-hidden border border-white/10"
            >
              {/* Header */}
              <div className="px-6 pt-6 pb-4 flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Create New Project</h2>
                  <p className="text-sm text-slate-400 mt-0.5">
                    Each project has its own isolated documents and knowledge base.
                  </p>
                </div>
                <button
                  onClick={closeModal}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-slate-400 ml-4 flex-shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="px-6 pb-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Project Name
                  </label>
                  <input
                    autoFocus
                    type="text"
                    placeholder="e.g. Sunrise Heights, Green Valley Villas…"
                    value={newName}
                    onChange={(e) => { setNewName(e.target.value); setCreateError(''); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); handleCreate(); }
                      if (e.key === 'Escape') closeModal();
                    }}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-primary"
                  />
                  {createError && (
                    <p className="mt-2 text-xs text-red-400">{createError}</p>
                  )}
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={closeModal}
                    className="flex-1 h-11 rounded-xl border border-white/10 text-slate-400 text-sm font-medium hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={!newName.trim() || creating}
                    className="flex-1 h-11 rounded-xl bg-brand-primary text-white text-sm font-semibold hover:bg-brand-primary/90 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Creating…
                      </>
                    ) : (
                      'Create Project'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      </div> {/* end main column */}

      {/* ---- Floating AI Chat Button ---- */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.12 }}
        whileTap={{ scale: 0.93 }}
        onClick={() => setShowChat(!showChat)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-brand-primary shadow-lg shadow-brand-primary/40 flex items-center justify-center text-white"
        title={showChat ? 'Close chat' : 'AI Assistant'}
      >
        <AnimatePresence mode="wait">
          {showChat ? (
            <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
              <X className="w-6 h-6" />
            </motion.span>
          ) : (
            <motion.span key="bot" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}>
              <Bot className="w-6 h-6" />
            </motion.span>
          )}
        </AnimatePresence>
        {!showChat && (
          <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-slate-900 animate-pulse" />
        )}
      </motion.button>

      {/* ---- Global AI Chat Panel (ISSUE_021) ---- */}
      <AnimatePresence>
        {showChat && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
            className="fixed bottom-24 right-6 z-40 w-[380px] h-[520px] flex flex-col glass-card border border-white/10 shadow-2xl overflow-hidden rounded-2xl"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-brand-primary to-brand-secondary px-5 py-4 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-white text-sm font-bold">Global AI Assistant</p>
                  <p className="text-white/70 text-[10px]">Searches all projects</p>
                </div>
              </div>
              <button onClick={() => setShowChat(false)} className="p-1 text-white/50 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4 text-sm">
              {chatMessages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${msg.type === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    msg.type === 'user' ? 'bg-brand-primary' : 'bg-brand-primary/20'
                  }`}>
                    {msg.type === 'user'
                      ? <User className="w-4 h-4 text-white" />
                      : <Bot className="w-4 h-4 text-brand-primary" />}
                  </div>
                  <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-xs leading-relaxed ${
                    msg.type === 'user'
                      ? 'bg-brand-primary text-white rounded-br-md'
                      : 'bg-white/5 text-slate-300 border border-white/5 rounded-bl-md'
                  }`}>
                    {msg.type === 'ai' ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    ) : msg.content}
                    {msg.source_type === 'faq' && (
                      <span className="block mt-1 text-[10px] text-brand-primary/80 font-medium">✓ From FAQ</span>
                    )}
                  </div>
                </motion.div>
              ))}
              {chatLoading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-brand-primary/20 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-brand-primary" />
                  </div>
                  <div className="px-4 py-3 bg-white/5 rounded-2xl rounded-bl-md border border-white/5">
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <span key={i} className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="p-5 pt-0 flex-shrink-0">
              <div className="flex items-end gap-2">
                <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-4">
                  <input
                    type="text"
                    placeholder="Ask across all projects…"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    disabled={chatLoading}
                    className="w-full bg-transparent border-0 p-0 text-sm text-slate-200 placeholder-slate-500 focus:outline-none disabled:opacity-50"
                  />
                  <p className="text-[9px] text-slate-500 mt-1">Searches documents from all projects</p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSend}
                  disabled={!chatInput.trim() || chatLoading}
                  className="mb-1 w-10 h-10 bg-brand-primary rounded-xl flex items-center justify-center text-white disabled:opacity-40 flex-shrink-0 shadow-lg hover:shadow-brand-primary/40 transition-shadow"
                >
                  <Send className="w-4 h-4 -rotate-45" />
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
