import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import {
  Search, Upload, Bot, X, Send, User, Loader2, RefreshCw, ZoomIn, ZoomOut, ArrowLeft, FileText, Trash2,
  CheckCircle, CircleX, DollarSign, Star, MapPin, List, Shield, Info,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { getFAQs, deleteFAQ, clearChatFAQs } from '@services/api/faqService';
import { postQuery, postUpload } from '@services/api/ragService';
import { getProjectDocuments, deleteProjectDocument } from '@services/api/projectService';
import { setFAQs, setFAQLoading, setFAQError, selectFAQCategories, selectFAQLoading } from '@store/slices/faqSlice';
import type { FAQEntry, FAQCategoryData } from '../../types/faq.types';
import type { ProjectDocument, Source } from '../../types/rag.types';
import type { AppDispatch } from '@store/index';

// ---------------------------------------------------------------------------
// Chat types
// ---------------------------------------------------------------------------
interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  source_type?: 'faq' | 'rag';
  sources?: Source[];
}

const UPLOAD_STEPS = ['Parsing document…', 'Creating embeddings…', 'Generating FAQs…'];

// ---------------------------------------------------------------------------
// Category icon paths (lucide-style, 24×24 viewBox — scaled to 14px at render)
// ---------------------------------------------------------------------------
const CATEGORY_ICONS: Record<string, string[]> = {
  Pricing:        ['M12 1v22', 'M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6'],
  Amenities:      ['M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z'],
  Location:       ['M12 22s-8-4.5-8-11.8A8 8 0 0112 2a8 8 0 018 8.2c0 7.3-8 11.8-8 11.8z', 'M12 13a3 3 0 100-6 3 3 0 000 6z'],
  Process:        ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01'],
  Specifications: ['M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z', 'M14 2v6h6', 'M16 13H8', 'M16 17H8', 'M10 9H8'],
  Security:       ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'],
  General:        ['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', 'M12 8v4', 'M12 16h.01'],
};

// Lucide icon components per category (used in the right panel header)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CATEGORY_LUCIDE_ICONS: Record<string, React.ComponentType<any>> = {
  Pricing:        DollarSign,
  Amenities:      Star,
  Location:       MapPin,
  Process:        List,
  Specifications: FileText,
  Security:       Shield,
  General:        Info,
};

// ---------------------------------------------------------------------------
// SVG layout helpers
// ---------------------------------------------------------------------------
const ROOT_X    = 90;
const CAT_X     = 300;
const SVG_WIDTH = 600;

function buildLayout(categories: FAQCategoryData[]) {
  interface Node {
    id: string;
    type: 'root' | 'category';
    x: number;
    y: number;
    label: string;
    color?: string;
    category?: FAQCategoryData;
  }

  const CAT_SPACING = 80;
  const SVG_HEIGHT = Math.max(400, categories.length * CAT_SPACING + 100);
  const rootY = SVG_HEIGHT / 2;

  const nodes: Node[] = [{ id: 'root', type: 'root', x: ROOT_X, y: rootY, label: 'SellBot AI' }];
  const links: { source: string; target: string }[] = [];

  const startY = (SVG_HEIGHT - (categories.length - 1) * CAT_SPACING) / 2;
  categories.forEach((cat, ci) => {
    nodes.push({
      id:       `cat_${cat.name}`,
      type:     'category',
      x:        CAT_X,
      y:        startY + ci * CAT_SPACING,
      label:    cat.name,
      color:    cat.color,
      category: cat,
    });
    links.push({ source: 'root', target: `cat_${cat.name}` });
  });

  return { nodes, links, svgHeight: SVG_HEIGHT };
}

function bezierPath(sx: number, sy: number, tx: number, ty: number): string {
  const mx = (sx + tx) / 2;
  return `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ty}, ${tx} ${ty}`;
}

// ---------------------------------------------------------------------------
// MindMapView — main component
// ---------------------------------------------------------------------------
interface MindMapViewProps {
  projectId: string;
  projectName?: string;
  onBack: () => void;
}

export function MindMapView({ projectId, projectName, onBack }: MindMapViewProps) {
  const dispatch = useDispatch<AppDispatch>();
  const categories = useSelector(selectFAQCategories);
  const isLoading  = useSelector(selectFAQLoading);

  const [zoomLevel, setZoomLevel]       = useState(1.0);
  const [searchQuery, setSearchQuery]   = useState('');
  type PanelState = { type: 'category'; cat: FAQCategoryData } | { type: 'faq'; faq: FAQEntry; cat: FAQCategoryData } | null;
  const [panelState, setPanelState]     = useState<PanelState>(null);
  const [showChat, setShowChat]         = useState(false);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const [showDocs, setShowDocs]         = useState(false);
  const [documents, setDocuments]       = useState<ProjectDocument[]>([]);
  const [docsLoading, setDocsLoading]   = useState(false);
  const [deletingDocId, setDeletingDocId]   = useState<string | null>(null);
  const [deletingFaqId, setDeletingFaqId]   = useState<number | null>(null);
  const [clearingChat, setClearingChat]     = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: '0', type: 'ai', content: "Hi! I'm SellBot AI. Click any FAQ node on the map, or ask me anything about the uploaded documents." }
  ]);
  const [chatInput, setChatInput]       = useState('');
  const [chatLoading, setChatLoading]   = useState(false);
  const [uploadStage, setUploadStage]   = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadFileIndex, setUploadFileIndex] = useState(0);
  const [uploadFileTotal, setUploadFileTotal] = useState(0);
  const [uploadResult, setUploadResult] = useState<{ totalChunks: number; totalFaqs: number; fileCount: number } | null>(null);
  const [uploadStepIdx, setUploadStepIdx] = useState(0);
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const chatEndRef    = useRef<HTMLDivElement>(null);
  const uploadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadFAQs = useCallback(async () => {
    dispatch(setFAQLoading(true));
    try {
      const data = await getFAQs(projectId);
      dispatch(setFAQs({ categories: data.categories, total: data.total }));
    } catch {
      dispatch(setFAQError('Failed to load FAQs'));
    }
  }, [dispatch, projectId]);

  const loadDocuments = useCallback(async () => {
    setDocsLoading(true);
    try {
      const data = await getProjectDocuments(projectId);
      setDocuments(data.documents);
    } catch {
      setDocuments([]);
    } finally {
      setDocsLoading(false);
    }
  }, [projectId]);

  // Load FAQs for this project on mount / when projectId changes
  useEffect(() => {
    dispatch(setFAQs({ categories: [], total: 0 })); // clear previous project's data immediately
    setDocuments([]);
    loadFAQs();
    loadDocuments();
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const filteredFAQsByCategory = useMemo(() => {
    const result: Record<string, FAQEntry[]> = {};
    for (const cat of categories) {
      if (!searchQuery.trim()) {
        result[cat.name] = cat.faqs;
      } else {
        const q = searchQuery.toLowerCase();
        result[cat.name] = cat.faqs.filter(
          (f) => f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q)
        );
      }
    }
    return result;
  }, [categories, searchQuery]);

  const visibleCategories = useMemo(
    () => categories.filter((c) => (filteredFAQsByCategory[c.name] ?? []).length > 0),
    [categories, filteredFAQsByCategory]
  );

  const { nodes, links, svgHeight } = useMemo(
    () => buildLayout(visibleCategories),
    [visibleCategories]
  );

  async function handleDeleteDoc(doc: ProjectDocument) {
    if (deletingDocId) return;
    setDeletingDocId(doc.document_id);
    try {
      await deleteProjectDocument(projectId, doc.document_id);
      await Promise.all([loadDocuments(), loadFAQs()]);
    } catch {
      // silent — doc list will be unchanged
    } finally {
      setDeletingDocId(null);
    }
  }

  async function handleDeleteFAQ(faqId: number) {
    if (deletingFaqId !== null) return;
    setDeletingFaqId(faqId);
    try {
      await deleteFAQ(faqId, projectId);
      await loadFAQs();
      // Close panel if the deleted FAQ was open
      setPanelState((prev) =>
        prev?.type === 'faq' && prev.faq.id === faqId ? null : prev
      );
    } catch {
      // silent
    } finally {
      setDeletingFaqId(null);
    }
  }

  async function handleClearChatFAQs() {
    if (clearingChat) return;
    setClearingChat(true);
    try {
      await clearChatFAQs(projectId);
      await loadFAQs();
      // Close panel if it was showing General
      setPanelState((prev) =>
        prev?.cat.name === 'General' ? null : prev
      );
    } catch {
      // silent
    } finally {
      setClearingChat(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const total = files.length;
    setUploadFileTotal(total);
    setUploadStage('uploading');
    setUploadResult(null);

    let totalChunks = 0;
    let totalFaqs = 0;
    let hadError = false;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadFileIndex(i + 1);
      setUploadFileName(file.name);
      setUploadStepIdx(0);

      uploadTimerRef.current = setInterval(() => {
        setUploadStepIdx((prev) => (prev + 1) % UPLOAD_STEPS.length);
      }, 2200);

      try {
        const res = await postUpload(file, projectId);
        if (uploadTimerRef.current) clearInterval(uploadTimerRef.current);
        totalChunks += res.chunks_added;
        totalFaqs += res.faqs_generated ?? 0;
      } catch {
        if (uploadTimerRef.current) clearInterval(uploadTimerRef.current);
        hadError = true;
        setUploadStage('error');
        break;
      }
    }

    if (fileInputRef.current) fileInputRef.current.value = '';

    if (!hadError) {
      setUploadResult({ totalChunks, totalFaqs, fileCount: total });
      setUploadStage('done');
      await Promise.all([loadFAQs(), loadDocuments()]);
      setTimeout(() => setUploadStage('idle'), 4000);
    }
  }

  async function handleSend() {
    if (!chatInput.trim() || chatLoading) return;
    const question = chatInput.trim();
    setChatInput('');
    setChatMessages((prev) => [...prev, { id: Date.now().toString(), type: 'user', content: question }]);
    setChatLoading(true);
    try {
      const res = await postQuery({ question, project_id: projectId });
      setChatMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          type: 'ai',
          content: res.answer,
          source_type: res.source_type as 'faq' | 'rag',
          sources: res.sources,
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

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="w-full h-full flex flex-col px-4 py-3 gap-3">

      {/* ---- Toolbar ---- */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 flex-shrink-0 flex-wrap h-14 px-4 glass-card rounded-xl border-white/10"
      >
        {/* Back button + breadcrumb */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Projects
          </button>
          {projectName && (
            <>
              <span className="text-slate-600 text-sm">/</span>
              <span className="text-sm text-slate-300 font-medium truncate max-w-[200px]">{projectName}</span>
            </>
          )}
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-white/10" />

        {/* Search */}
        <div className="flex-1 max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search FAQs…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-primary"
          />
        </div>

        {/* Refresh */}
        <button
          onClick={() => { loadFAQs(); loadDocuments(); }}
          disabled={isLoading}
          title="Refresh"
          className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>

        {/* Documents toggle */}
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => { setShowDocs(!showDocs); if (!showDocs) setShowChat(false); }}
          title="Connected Documents"
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
            showDocs
              ? 'bg-violet-500/20 border-violet-500/30 text-violet-400'
              : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
          }`}
        >
          <FileText className="w-4 h-4" />
          Files
          {documents.length > 0 && (
            <span className="ml-0.5 bg-violet-500/30 text-violet-300 rounded-full px-1.5 py-px text-[10px]">
              {documents.length}
            </span>
          )}
        </motion.button>

        {/* Zoom controls */}
        <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg px-1 py-1">
          <button
            onClick={() => setZoomLevel((z) => Math.max(0.35, parseFloat((z - 0.15).toFixed(2))))}
            title="Zoom out"
            className="p-1.5 rounded text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoomLevel(1.0)}
            title="Reset zoom"
            className="px-2 py-1 text-xs text-slate-400 hover:bg-white/10 hover:text-white rounded transition-colors min-w-[42px] text-center"
          >
            {Math.round(zoomLevel * 100)}%
          </button>
          <button
            onClick={() => setZoomLevel((z) => Math.min(2.5, parseFloat((z + 0.15).toFixed(2))))}
            title="Zoom in"
            className="p-1.5 rounded text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>

        {/* Upload */}
        <label className={`cursor-pointer ${uploadStage === 'uploading' ? 'pointer-events-none opacity-50' : ''}`}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.xlsx,.txt"
            multiple
            className="hidden"
            onChange={handleUpload}
          />
          <motion.div
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors bg-white/5 text-slate-300 border-white/10 hover:bg-white/10"
          >
            <Upload className="w-4 h-4" />
            Upload Doc
          </motion.div>
        </label>
      </motion.div>

      {/* ---- Main content: Mind Map + Chat Panel ---- */}
      <div className="flex flex-1 gap-3 overflow-hidden min-h-0">

        {/* Mind Map */}
        <motion.div
          layout
          className="flex-1 glass-card rounded-2xl overflow-auto relative"
        >
          {isLoading && categories.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
              <span className="ml-3 text-slate-400 text-sm">Loading…</span>
            </div>
          ) : categories.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-600">
              <Upload className="w-12 h-12 opacity-20" />
              <p className="text-sm font-medium text-slate-400">No data yet</p>
              <p className="text-xs text-slate-500">Upload a document to generate FAQ nodes</p>
            </div>
          ) : (
            <div className="flex items-start justify-center min-h-full p-4">
            <svg
              width={SVG_WIDTH * zoomLevel}
              height={svgHeight * zoomLevel}
              viewBox={`0 0 ${SVG_WIDTH} ${svgHeight}`}
            >
              <defs>
                <filter id="mm-shadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.12" />
                </filter>
              </defs>

              {/* Links */}
              {links.map((link, i) => {
                const src = nodes.find((n) => n.id === link.source);
                const tgt = nodes.find((n) => n.id === link.target);
                if (!src || !tgt) return null;
                const srcOffX = src.type === 'root' ? 80 : 18;
                const tgtOffX = tgt.type === 'category' ? -20 : 0;
                return (
                  <motion.path
                    key={`${link.source}-${link.target}`}
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 0.5, delay: i * 0.02 }}
                    d={bezierPath(src.x + srcOffX, src.y, tgt.x + tgtOffX, tgt.y)}
                    fill="none"
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth="1.5"
                  />
                );
              })}

              {/* Nodes */}
              {nodes.map((node, i) => {
                if (node.type === 'root') {
                  return (
                    <motion.g
                      key={node.id}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0, type: 'spring', stiffness: 220, damping: 18 }}
                    >
                      <rect
                        x={node.x - 80} y={node.y - 28}
                        width="160" height="56"
                        rx="28"
                        fill="#fb7185"
                        filter="url(#mm-shadow)"
                      />
                      <text
                        x={node.x} y={node.y + 5}
                        textAnchor="middle"
                        fill="white"
                        fontSize="13"
                        fontWeight="700"
                        fontFamily="system-ui, sans-serif"
                      >
                        {projectName ?? 'SellBot AI'}
                      </text>
                    </motion.g>
                  );
                }

                if (node.type === 'category') {
                  const cat = node.category!;
                  const faqCount = (filteredFAQsByCategory[cat.name] ?? []).length;
                  const isActive = panelState?.cat.name === cat.name;
                  return (
                    <motion.g
                      key={node.id}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: i * 0.07, type: 'spring', stiffness: 220, damping: 18 }}
                      className="cursor-pointer"
                      onClick={() => { setPanelState({ type: 'category', cat }); setShowDocs(false); }}
                    >
                      {/* Active glow ring */}
                      {isActive && (
                        <circle cx={node.x} cy={node.y} r="25" fill={cat.color} opacity="0.15" />
                      )}
                      <circle cx={node.x} cy={node.y} r="20" fill={cat.color} opacity={isActive ? 1 : 0.85} filter="url(#mm-shadow)" />
                      {/* Category icon — 24×24 paths scaled to 14px and centered */}
                      {CATEGORY_ICONS[cat.name] && (
                        <g transform={`translate(${node.x - 7}, ${node.y - 7}) scale(0.583)`}>
                          {CATEGORY_ICONS[cat.name].map((d, pi) => (
                            <path
                              key={pi}
                              d={d}
                              fill="none"
                              stroke="white"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              opacity="0.9"
                            />
                          ))}
                        </g>
                      )}
                      {/* Count badge */}
                      <circle cx={node.x + 14} cy={node.y - 14} r="9" fill="#0f172a" stroke={cat.color} strokeWidth="1.5" />
                      <text
                        x={node.x + 14} y={node.y - 10}
                        textAnchor="middle"
                        fill={cat.color}
                        fontSize="8"
                        fontWeight="700"
                        fontFamily="system-ui, sans-serif"
                      >
                        {faqCount}
                      </text>
                      {/* Category name */}
                      <text
                        x={node.x + 28} y={node.y + 5}
                        fill={isActive ? '#f8fafc' : '#e2e8f0'}
                        fontSize="13"
                        fontWeight={isActive ? '700' : '600'}
                        fontFamily="system-ui, sans-serif"
                      >
                        {cat.name}
                      </text>
                    </motion.g>
                  );
                }

                return null;
              })}
            </svg>
            </div>
          )}

          {/* Category legend */}
          {categories.length > 0 && (
            <div className="absolute bottom-3 left-3 glass-card rounded-xl px-3 py-2">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                Categories
              </p>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {categories.map((cat) => (
                  <div key={cat.name} className="flex items-center gap-1">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="text-[10px] text-slate-300">{cat.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* ---- Documents Panel (ISSUE_018) ---- */}
        <AnimatePresence>
          {showDocs && (
            <motion.div
              initial={{ opacity: 0, x: 320 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 320 }}
              transition={{ type: 'spring', stiffness: 280, damping: 28 }}
              className="w-[340px] glass-card rounded-3xl flex flex-col overflow-hidden flex-shrink-0 border border-white/10 shadow-2xl"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-violet-600 to-violet-400 px-5 py-4 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-bold">Connected Documents</p>
                    <p className="text-white/70 text-[10px]">{documents.length} file{documents.length !== 1 ? 's' : ''} uploaded</p>
                  </div>
                </div>
                <button onClick={() => setShowDocs(false)} className="p-1 text-white/50 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
                {docsLoading ? (
                  <div className="flex items-center justify-center py-10 gap-2 text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm">Loading files…</span>
                  </div>
                ) : documents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                    <Upload className="w-10 h-10 text-slate-600 opacity-40" />
                    <p className="text-slate-400 text-sm font-medium">No documents yet</p>
                    <p className="text-slate-600 text-xs">Upload a PDF, DOCX, XLSX or TXT file using the Upload button above.</p>
                  </div>
                ) : (
                  documents.map((doc) => (
                    <div
                      key={doc.document_id}
                      className="flex items-start gap-3 px-3 py-3 rounded-xl bg-white/5 border border-white/5 hover:border-violet-500/20 transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <FileText className="w-4 h-4 text-violet-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-200 text-xs font-medium truncate" title={doc.filename}>
                          {doc.filename}
                        </p>
                        <p className="text-slate-500 text-[11px] mt-0.5">
                          {doc.chunk_count} chunk{doc.chunk_count !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteDoc(doc)}
                        disabled={deletingDocId === doc.document_id}
                        title="Delete document and its FAQs"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-all disabled:opacity-40 flex-shrink-0"
                      >
                        {deletingDocId === doc.document_id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Footer hint */}
              <div className="px-4 pb-4 flex-shrink-0">
                <p className="text-[10px] text-slate-600 text-center">
                  Each file's text is split into chunks and stored as embeddings for AI search
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ---- FAQ / Category Right Panel ---- */}
        <AnimatePresence>
          {panelState && (
            <motion.div
              initial={{ opacity: 0, x: 400 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 400 }}
              transition={{ type: 'spring', stiffness: 280, damping: 28 }}
              className="w-[420px] glass-card rounded-3xl flex flex-col overflow-hidden flex-shrink-0 border border-white/10 shadow-2xl"
            >
              {panelState.type === 'category' ? (
                <>
                  {/* Category header */}
                  <div
                    className="px-5 py-4 flex items-center justify-between flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, ${panelState.cat.color}cc, ${panelState.cat.color}66)` }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                        {(() => { const Icon = CATEGORY_LUCIDE_ICONS[panelState.cat.name] ?? FileText; return <Icon className="w-4 h-4 text-white" />; })()}
                      </div>
                      <div>
                        <p className="text-white text-sm font-bold">{panelState.cat.name}</p>
                        <p className="text-white/70 text-[10px]">
                          {(filteredFAQsByCategory[panelState.cat.name] ?? []).length} questions
                          {panelState.cat.name === 'General' && ' · AI Chat History'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {panelState.cat.name === 'General' && (filteredFAQsByCategory['General'] ?? []).length > 0 && (
                        <button
                          onClick={handleClearChatFAQs}
                          disabled={clearingChat}
                          title="Clear all AI chat history"
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30 text-[10px] font-semibold transition-colors disabled:opacity-40"
                        >
                          {clearingChat ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                          Clear All
                        </button>
                      )}
                      <button onClick={() => setPanelState(null)} className="p-1 text-white/50 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  {/* Question list */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
                    {(filteredFAQsByCategory[panelState.cat.name] ?? []).length === 0 ? (
                      <p className="text-slate-500 text-sm text-center py-8">No questions in this category</p>
                    ) : (
                      (filteredFAQsByCategory[panelState.cat.name] ?? []).map((faq) => (
                        <motion.div
                          key={faq.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-stretch gap-2 group"
                        >
                          <motion.button
                            whileHover={{ x: 3 }}
                            onClick={() => setPanelState({ type: 'faq', faq, cat: panelState.cat })}
                            className="flex-1 text-left p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-colors"
                          >
                            <p className="text-sm text-slate-300 group-hover:text-white leading-relaxed">{faq.question}</p>
                            {faq.source_file && faq.source_file !== 'user_chat' && (
                              <span className="text-[10px] text-slate-600 mt-1 block">{faq.source_file}</span>
                            )}
                          </motion.button>
                          {panelState.cat.name === 'General' && (
                            <button
                              onClick={() => handleDeleteFAQ(faq.id)}
                              disabled={deletingFaqId === faq.id}
                              title="Delete this question"
                              className="px-2 rounded-xl bg-white/5 border border-white/10 text-slate-500 hover:text-red-400 hover:bg-red-400/10 hover:border-red-400/20 transition-all disabled:opacity-40 flex-shrink-0"
                            >
                              {deletingFaqId === faq.id
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </motion.div>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* FAQ answer header */}
                  <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPanelState({ type: 'category', cat: panelState.cat })}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5 text-brand-primary" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-brand-primary">Verified AI Response</span>
                      </div>
                    </div>
                    <button onClick={() => setPanelState(null)} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {/* FAQ answer body */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-5 flex flex-col gap-4">
                    <h3 className="text-base font-bold text-white leading-snug">{panelState.faq.question}</h3>
                    <div className="text-slate-300 text-sm leading-relaxed [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:space-y-1 [&_li]:text-slate-300 [&_strong]:text-white [&_br]:block">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{panelState.faq.answer}</ReactMarkdown>
                    </div>
                    {/* Source citation */}
                    {panelState.faq.source_file && panelState.faq.source_file !== 'user_chat' && (
                      <div className="mt-2 pt-4 border-t border-white/10">
                        <div className="flex items-center gap-2 text-slate-500 mb-2">
                          <span className="text-[10px] font-semibold uppercase tracking-widest">Source Citation</span>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/10 hover:border-white/20 transition-colors cursor-default">
                          <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <div>
                            <p className="text-xs text-slate-200">{panelState.faq.source_file}</p>
                            <p className="text-[10px] text-slate-500">{panelState.cat.name} category</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ---- AI Chat Panel ---- */}
        <AnimatePresence>
          {showChat && (
            <motion.div
              initial={{ opacity: 0, x: 320 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 320 }}
              transition={{ type: 'spring', stiffness: 280, damping: 28 }}
              className="w-[380px] glass-card rounded-3xl flex flex-col overflow-hidden flex-shrink-0 border border-white/10 shadow-2xl"
            >
              {/* Chat header */}
              <div className="bg-gradient-to-r from-brand-primary to-brand-secondary px-5 py-4 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-bold">AI Assistant</p>
                    <p className="text-white/70 text-[10px]">RAG-powered</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowChat(false)}
                  className="p-1 text-white/50 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4 text-sm">
                {chatMessages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex gap-3 ${msg.type === 'user' ? 'flex-row-reverse' : ''}`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        msg.type === 'user' ? 'bg-brand-primary' : 'bg-brand-primary/20'
                      }`}
                    >
                      {msg.type === 'user' ? (
                        <User className="w-4 h-4 text-white" />
                      ) : (
                        <Bot className="w-4 h-4 text-brand-primary" />
                      )}
                    </div>
                    <div
                      className={`max-w-[85%] px-4 py-3 rounded-2xl text-xs leading-relaxed ${
                        msg.type === 'user'
                          ? 'bg-brand-primary text-white rounded-br-md'
                          : 'bg-white/5 text-slate-300 border border-white/5 rounded-bl-md'
                      }`}
                    >
                      {msg.type === 'ai' ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      ) : (
                        msg.content
                      )}
                      {/* Source attribution */}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-white/10">
                          <button
                            onClick={() => setExpandedSources(prev => {
                              const next = new Set(prev);
                              next.has(msg.id) ? next.delete(msg.id) : next.add(msg.id);
                              return next;
                            })}
                            className="flex items-center gap-1.5 text-[9px] text-slate-500 uppercase tracking-wider hover:text-slate-300 transition-colors"
                          >
                            <FileText className="w-2.5 h-2.5" />
                            Sources · {msg.sources.length} chunk{msg.sources.length !== 1 ? 's' : ''}
                            <span className="ml-0.5">{expandedSources.has(msg.id) ? '▲' : '▼'}</span>
                          </button>
                          {expandedSources.has(msg.id) && (
                            <div className="flex flex-col gap-1 mt-1.5">
                              {msg.sources.map((s, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-white/5 border border-white/5 text-[9px]"
                                >
                                  <span className="flex items-center gap-1 text-slate-400 min-w-0">
                                    <FileText className="w-2.5 h-2.5 flex-shrink-0" />
                                    <span className="truncate">{s.filename}</span>
                                    <span className="text-slate-600 flex-shrink-0">chunk {s.chunk_index}</span>
                                  </span>
                                  <span
                                    className={`flex-shrink-0 font-semibold ${
                                      s.similarity_score >= 0.7 ? 'text-green-400' :
                                      s.similarity_score >= 0.55 ? 'text-brand-primary' :
                                      s.similarity_score >= 0.45 ? 'text-yellow-400' : 'text-slate-500'
                                    }`}
                                  >
                                    {Math.round(s.similarity_score * 100)}%
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
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
                          <span
                            key={i}
                            className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-bounce"
                            style={{ animationDelay: `${i * 0.15}s` }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div className="p-6 pt-0 flex-shrink-0">
                <div className="relative flex items-end gap-2">
                  <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-4">
                    <input
                      type="text"
                      placeholder="Ask anything…"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                      disabled={chatLoading}
                      className="w-full bg-transparent border-0 p-0 text-sm text-slate-200 placeholder-slate-500 focus:outline-none disabled:opacity-50"
                    />
                    <p className="text-[9px] text-slate-500 mt-1">Questions not in FAQ go to RAG</p>
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

      {/* ---- Upload Progress Modal ---- */}
      <AnimatePresence>
        {uploadStage !== 'idle' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.88, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.88, opacity: 0 }}
              className="glass-card rounded-2xl p-8 w-full max-w-sm mx-4 text-center"
            >
              {uploadStage === 'uploading' && (
                <>
                  <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-brand-primary/10 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
                  </div>
                  {uploadFileTotal > 1 && (
                    <div className="flex items-center justify-center gap-1.5 mb-2">
                      <span className="text-xs font-bold text-brand-primary bg-brand-primary/10 px-2.5 py-0.5 rounded-full">
                        File {uploadFileIndex} of {uploadFileTotal}
                      </span>
                    </div>
                  )}
                  <p className="text-slate-200 font-semibold mb-1 truncate max-w-xs mx-auto" title={uploadFileName}>
                    {uploadFileName.length > 36 ? uploadFileName.slice(0, 33) + '…' : uploadFileName}
                  </p>
                  <p className="text-slate-400 text-sm mb-6">{UPLOAD_STEPS[uploadStepIdx]}</p>
                  <div className="flex justify-center gap-2">
                    {UPLOAD_STEPS.map((_, i) => (
                      <div
                        key={i}
                        className={`h-1.5 rounded-full transition-all duration-500 ${
                          i === uploadStepIdx ? 'w-6 bg-brand-primary' : 'w-2 bg-white/20'
                        }`}
                      />
                    ))}
                  </div>
                  {uploadFileTotal > 1 && (
                    <div className="flex justify-center gap-1 mt-5">
                      {Array.from({ length: uploadFileTotal }).map((_, i) => (
                        <div
                          key={i}
                          className={`h-1 rounded-full transition-all duration-300 ${
                            i < uploadFileIndex - 1
                              ? 'w-4 bg-green-400'
                              : i === uploadFileIndex - 1
                              ? 'w-4 bg-brand-primary'
                              : 'w-4 bg-white/10'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}

              {uploadStage === 'done' && uploadResult && (
                <>
                  <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-green-500/10 flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-green-400" />
                  </div>
                  <p className="text-slate-200 font-semibold mb-1">
                    {uploadResult.fileCount > 1 ? `${uploadResult.fileCount} Files Uploaded!` : 'Upload Complete!'}
                  </p>
                  <p className="text-slate-500 text-xs mb-5">
                    {uploadResult.fileCount > 1
                      ? `All ${uploadResult.fileCount} documents processed successfully`
                      : uploadFileName}
                  </p>
                  <div className="flex justify-center gap-8">
                    <div>
                      <p className="text-2xl font-bold text-brand-primary">{uploadResult.totalChunks}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Chunks</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-purple-400">{uploadResult.totalFaqs}</p>
                      <p className="text-xs text-slate-500 mt-0.5">FAQs</p>
                    </div>
                  </div>
                </>
              )}

              {uploadStage === 'error' && (
                <>
                  <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-red-500/10 flex items-center justify-center">
                    <CircleX className="w-8 h-8 text-red-400" />
                  </div>
                  <p className="text-slate-200 font-semibold mb-2">Upload Failed</p>
                  <p className="text-slate-400 text-sm mb-5">Check the file format and try again.</p>
                  <button
                    onClick={() => setUploadStage('idle')}
                    className="px-5 py-2 bg-white/10 hover:bg-white/15 text-slate-300 rounded-lg text-sm transition-colors"
                  >
                    Close
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- Floating AI Chat button (hidden when chat is open — header X closes it) ---- */}
      <AnimatePresence>
        {!showChat && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.93 }}
            onClick={() => { setShowChat(true); setShowDocs(false); }}
            className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-brand-primary shadow-lg shadow-brand-primary/40 flex items-center justify-center text-white"
            title="AI Assistant"
          >
            <Bot className="w-6 h-6" />
            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-slate-900 animate-pulse" />
          </motion.button>
        )}
      </AnimatePresence>

    </div>
  );
}
