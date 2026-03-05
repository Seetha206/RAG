import { useEffect, useRef } from 'react';
import { Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';
import { MindMapView } from '@components/mindmap/MindMapView';
import { DashboardPage } from '@pages/DashboardPage';

// ── MindMap route wrapper — reads :projectId from URL ──
function MindMapRoute() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const projectName = (location.state as { projectName?: string } | null)?.projectName;

  if (!projectId) {
    navigate('/');
    return null;
  }

  return <MindMapView projectId={projectId} projectName={projectName} onBack={() => navigate('/')} />;
}

// ── App shell ──
function App() {
  const glowRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const projectName = (location.state as { projectName?: string } | null)?.projectName;
  const isProjectPage = location.pathname.startsWith('/projects/');

  useEffect(() => {
    const glow = glowRef.current;
    if (!glow) return;
    const onMove = (e: MouseEvent) => {
      glow.style.transform = `translate(${e.clientX - 140}px, ${e.clientY - 140}px)`;
    };
    const onDown = (e: MouseEvent) => {
      glow.style.transform = `translate(${e.clientX - 140}px, ${e.clientY - 140}px)`;
      glow.classList.add('active');
    };
    const onUp = () => glow.classList.remove('active');
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('mouseup', onUp);
    };
  }, []);

  return (
    <div className="flex flex-col h-screen bg-brand-dark text-slate-200 overflow-hidden font-sans">
      {/* Cursor gradient glow */}
      <div ref={glowRef} className="gradient-cursor" />

      {/* Relative layer above glow */}
      <div className="relative z-10 flex flex-col h-full">
        {/* ── Header ── */}
        <header className="h-16 border-b border-white/10 flex items-center justify-between px-6 glass-card flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-brand-primary rounded-lg flex items-center justify-center shadow-lg shadow-brand-primary/20">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </div>
              <span className="text-xl font-bold tracking-tight">
                SellBot <span className="text-brand-primary">AI</span>
              </span>
            </div>
            <div className="h-6 w-px bg-white/10 mx-2" />
            {isProjectPage && projectName ? (
              <span className="text-sm text-slate-400 font-medium">{projectName}</span>
            ) : (
              <span className="text-sm text-slate-400 font-medium">Knowledge Base</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button className="p-2 text-slate-400 hover:text-white transition-colors">
              <HelpCircle size={18} />
            </button>
            <div className="w-8 h-8 rounded-full bg-slate-700 border border-white/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                <circle cx="12" cy="7" r="4" strokeWidth="2" />
              </svg>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-hidden">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/projects/:projectId" element={<MindMapRoute />} />
            <Route path="*" element={<DashboardPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;
