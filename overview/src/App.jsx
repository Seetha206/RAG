
/* ── Icons (inline SVG) ────────────────────────────────────────── */
const SparkleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>
  </svg>
);

const ArrowRight = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
  </svg>
);

/* ── Nav ────────────────────────────────────────────────────────── */
function Nav() {
  return (
    <nav className="nav">
      <div className="container nav-inner">
        <div className="nav-logo">
          <div className="nav-logo-icon"><SparkleIcon /></div>
          SellBot AI
        </div>
        <div className="nav-links">
          <a href="#what-is-rag" className="nav-link">What is RAG?</a>
          <a href="#pipeline" className="nav-link">How it works</a>
          <a href="#tech" className="nav-link">Tech stack</a>
        </div>
      </div>
    </nav>
  );
}

/* ── Hero ────────────────────────────────────────────────────────── */
function Hero() {
  return (
    <section className="hero">
      <div className="hero-grid" />
      <div className="container hero-content">
        <div className="hero-badge">
          <span className="badge">
            <SparkleIcon /> AI-Powered Real Estate Intelligence
          </span>
        </div>

        <h1 className="hero-title">
          Build AI That <span className="grad-text">Knows</span><br />
          Your Documents
        </h1>

        <p className="hero-sub">
          SellBot AI reads your property PDFs, brochures, and price lists — auto-generates
          an interactive FAQ mind map, then answers any question instantly using
          FAQ search or Retrieval-Augmented Generation.
        </p>

        <div className="hero-actions">
          <a href="#what-is-rag" className="btn btn-outline">
            How it works <ArrowRight />
          </a>
        </div>

        <div className="stats-strip">
          {[
            { value: '4', label: 'File formats' },
            { value: '<1s', label: 'Query response time' },
            { value: '1024', label: 'Embedding dimensions' },
            { value: '10+', label: 'REST API endpoints' },
            { value: '∞', label: 'Documents uploadable' },
          ].map(s => (
            <div className="stat-item" key={s.label}>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── What is RAG ─────────────────────────────────────────────────── */
function WhatIsRAG() {
  return (
    <section id="what-is-rag">
      <div className="container">
        <div className="rag-grid">
          {/* Text side */}
          <div>
            <p className="section-label">The Problem We Solve</p>
            <h2 className="section-title">
              What is <span className="grad-text">RAG</span>?
            </h2>
            <div className="definition-box">
              <strong>Retrieval-Augmented Generation (RAG)</strong> is a technique where an AI model
              retrieves relevant information from your own documents before generating an answer —
              instead of relying only on what it was trained on.
            </div>
            <p className="section-sub">
              Traditional LLMs hallucinate because they can't see your specific data.
              RAG fixes this: we give the AI only the relevant document chunks, so every
              answer is grounded in your actual content.
            </p>
          </div>

          {/* Visual side */}
          <div className="rag-visual">
            <div className="rag-vs">
              <div className="rag-block before">
                <div className="rag-block-title">✗ Without RAG</div>
                {[
                  'LLM has no idea about your property prices',
                  'Hallucinated answers with no source',
                  'No way to update with new documents',
                  'Generic responses, zero specificity',
                ].map(p => (
                  <div className="rag-point" key={p}>
                    <span className="icon">❌</span> {p}
                  </div>
                ))}
              </div>
              <div className="rag-block after">
                <div className="rag-block-title">✓ With RAG (SellBot AI)</div>
                {[
                  'Reads your uploaded PDFs and brochures',
                  'Cites exact source and chunk for every answer',
                  'Add new documents anytime — instant updates',
                  'Answers with prices, dates, and details from your docs',
                ].map(p => (
                  <div className="rag-point" key={p}>
                    <span className="icon">✅</span> {p}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Pipeline ────────────────────────────────────────────────────── */
const STEPS = [
  {
    num: 1, icon: '📄',
    title: 'Upload Document',
    desc: 'PDF, DOCX, Excel or TXT — streamed as bytes, never written to disk. Scoped to a project.',
    tag: '/upload endpoint',
  },
  {
    num: 2, icon: '✂️',
    title: 'Parse & Chunk',
    desc: 'Text extracted and split into 800-character overlapping chunks at sentence boundaries.',
    tag: 'document_parsers.py',
  },
  {
    num: 3, icon: '🔢',
    title: 'Embed Vectors',
    desc: 'Each chunk converted to a 1024-dim semantic vector by BAAI/bge-large-en-v1.5 via FastEmbed ONNX — no GPU needed.',
    tag: 'fastembed ONNX',
  },
  {
    num: 4, icon: '🗄️',
    title: 'Store in pgvector',
    desc: 'Vectors and metadata stored in PostgreSQL with HNSW index, scoped per project namespace.',
    tag: 'pgvector · HNSW',
  },
  {
    num: 5, icon: '🧩',
    title: 'Auto-generate FAQs',
    desc: 'LLM reads the full document text and extracts up to 25 Q&A pairs across 7 categories.',
    tag: 'Gemini Flash · faq_generator.py',
  },
  {
    num: 6, icon: '💬',
    title: 'Query & Answer',
    desc: 'FAQ-first: PostgreSQL full-text search returns instant answers. No FAQ match? Embed → cosine similarity → Gemini generates a grounded answer.',
    tag: 'FAQ → RAG fallback',
  },
];

function Pipeline() {
  return (
    <section id="pipeline">
      <div className="container pipeline">
        <p className="section-label">Under the hood</p>
        <h2 className="section-title">How It <span className="grad-text">Works</span></h2>
        <p className="section-sub" style={{ margin: '0 auto' }}>
          Six steps from document upload to AI-generated answer — FAQ-first for instant replies, RAG fallback for everything else.
        </p>

        <div className="pipeline-steps">
          {STEPS.map(s => (
            <div className="step-card" key={s.num}>
              <div className="step-num">{s.num}</div>
              <div className="step-icon">{s.icon}</div>
              <div className="step-title">{s.title}</div>
              <div className="step-desc">{s.desc}</div>
              <div className="step-tag">{s.tag}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── What We Built ───────────────────────────────────────────────── */
const BUILT = [
  {
    icon: '⚡',
    iconBg: 'rgba(16,185,129,.15)',
    title: 'FastAPI Backend',
    sub: 'Python 3.11 · REST API · Multi-tenant',
    features: [
      'Multi-project support: each project gets an isolated vector namespace',
      'In-memory document parsing — no disk writes ever',
      'Plugin-based design: swap embedding, vector DB, or LLM via config.py',
      'FAQ auto-generation on every upload — non-blocking, non-fatal',
    ],
  },
  {
    icon: '🗄️',
    iconBg: 'rgba(6,182,212,.15)',
    title: 'pgvector Database',
    sub: 'PostgreSQL · Vector + Full-text Search',
    features: [
      'HNSW index for fast approximate nearest-neighbour search',
      '1024-dim cosine similarity scoring per project namespace',
      'Separate faq_entries table with GIN full-text search index',
      'projects table: UUID primary keys, namespace isolation, CASCADE deletes',
    ],
  },
  {
    icon: '🧠',
    iconBg: 'rgba(139,92,246,.15)',
    title: 'Gemini Flash LLM',
    sub: 'Google Gemini 2.5 Flash · Answer Generation',
    features: [
      'Extracts up to 25 FAQ pairs per document across 7 fixed categories',
      'Receives top-k retrieved chunks as grounded context for RAG answers',
      'Structured system prompt grounds answers in your documents',
      'Swappable with GPT-4, Claude, Ollama, or any LLM via config',
    ],
  },
  {
    icon: '🎨',
    iconBg: 'rgba(245,158,11,.15)',
    title: 'React Mind Map UI',
    sub: 'React 19 · Redux · TypeScript · SVG',
    features: [
      'Interactive SVG mind map: Root → Category → FAQ questions',
      'AI chat panel slides in from the right with FAQ-match badge',
      'Redux Toolkit + redux-persist (state survives reloads)',
      'framer-motion animated modals for FAQ answer previews',
    ],
  },
];

function WhatWeBuilt() {
  return (
    <section id="built">
      <div className="container">
        <p className="section-label">What We Built</p>
        <h2 className="section-title">
          A Full-Stack <span className="grad-text">RAG System</span>
        </h2>
        <p className="section-sub">
          Four layers working together — from multi-project document ingestion to FAQ mind map and AI-powered answers.
        </p>

        <div className="built-grid">
          {BUILT.map(c => (
            <div className="built-card" key={c.title}>
              <div className="built-card-header">
                <div className="built-icon" style={{ background: c.iconBg }}>{c.icon}</div>
                <div>
                  <div className="built-card-title">{c.title}</div>
                  <div className="built-card-sub">{c.sub}</div>
                </div>
              </div>
              <ul className="built-features">
                {c.features.map(f => <li key={f}>{f}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Tech Stack ──────────────────────────────────────────────────── */
const TECH = [
  { icon: '🐍', name: 'Python 3.11', role: 'Backend runtime' },
  { icon: '⚡', name: 'FastAPI', role: 'REST API framework' },
  { icon: '🚀', name: 'FastEmbed ONNX', role: 'Local embeddings · no GPU' },
  { icon: '🐘', name: 'PostgreSQL', role: 'Vector + full-text database' },
  { icon: '🔷', name: 'pgvector', role: 'Vector extension · HNSW' },
  { icon: '✨', name: 'Gemini 2.5 Flash', role: 'LLM · FAQ + RAG answers' },
  { icon: '⚛️', name: 'React 19', role: 'Frontend framework' },
  { icon: '🏪', name: 'Redux Toolkit', role: 'State management' },
  { icon: '📘', name: 'TypeScript', role: 'Type safety' },
  { icon: '⚡', name: 'Vite', role: 'Frontend bundler' },
  { icon: '💨', name: 'Tailwind CSS', role: 'Styling' },
  { icon: '🚂', name: 'Railway', role: 'Cloud hosting' },
];

function TechStack() {
  return (
    <section id="tech">
      <div className="container tech-section">
        <p className="section-label">Technologies</p>
        <h2 className="section-title">
          Built With <span className="grad-text-2">Modern Tools</span>
        </h2>
        <p className="section-sub" style={{ margin: '0 auto' }}>
          Every layer of the stack is swappable — change providers in one config file, no code changes needed.
        </p>

        <div className="tech-grid">
          {TECH.map(t => (
            <div className="tech-badge" key={t.name}>
              <span className="tech-badge-icon">{t.icon}</span>
              <div>
                <div className="tech-badge-name">{t.name}</div>
                <div className="tech-badge-role">{t.role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── CTA ─────────────────────────────────────────────────────────── */
function CTASection() {
  return (
    <section className="cta-section" id="demo">
      <div className="cta-glow" />
      <div className="container" style={{ position: 'relative' }}>
        <h2 className="cta-title">
          See It In <span className="grad-text">Action</span>
        </h2>
        <p className="cta-sub">
          Click a question, watch the typing indicator, and see a RAG-powered answer with source citations — just like the real system.
        </p>

        {/* Mini browser mockup */}
        <div className="demo-card">
          <div className="demo-card-bar">
            <div className="demo-dot" style={{ background: '#ef4444' }} />
            <div className="demo-dot" style={{ background: '#f59e0b' }} />
            <div className="demo-dot" style={{ background: '#22c55e' }} />
            <div className="demo-card-url">sellbot-ai.vercel.app</div>
          </div>
          <div className="demo-card-content">
            <div className="demo-ui-preview">
              <div className="demo-msg user">
                <div className="demo-avatar" style={{ background: '#1e3a5f', color: '#10b981' }}>👤</div>
                <div className="demo-bubble">What is the price of 3 BHK in Sunrise Heights?</div>
              </div>
              <div className="demo-msg bot">
                <div className="demo-avatar" style={{ background: 'rgba(16,185,129,.15)', color: '#10b981' }}>✨</div>
                <div className="demo-bubble" style={{ color: '#94a3b8' }}>
                  <strong style={{ color: '#f1f5f9' }}>Sunrise Heights — 3 BHK Pricing</strong><br />
                  Based on the uploaded brochure: Standard (1,450 sq.ft) ₹95L · Premium (1,680 sq.ft) ₹1.12Cr · Corner (1,720 sq.ft) ₹1.18Cr...
                  <br /><br />
                  <span style={{ fontSize: '11px', color: '#475569' }}>📄 Sunrise_Heights_Brochure.pdf · Chunk 3 · 94% match</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="https://github.com/Seetha206/RAG" target="_blank" rel="noopener" className="btn btn-primary" style={{ fontSize: '15px', padding: '14px 32px' }}>
            View on GitHub <ArrowRight />
          </a>
        </div>
      </div>
    </section>
  );
}

/* ── Footer ──────────────────────────────────────────────────────── */
function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <p className="footer-text">
          Built with ❤️ using FastAPI · pgvector · FastEmbed · React 19 · Gemini 2.5 Flash
        </p>
      </div>
    </footer>
  );
}

/* ── App ─────────────────────────────────────────────────────────── */
export default function App() {
  return (
    <>
      <Nav />
      <Hero />
      <WhatIsRAG />
      <Pipeline />
      <WhatWeBuilt />
      <TechStack />
      <CTASection />
      <Footer />
    </>
  );
}
