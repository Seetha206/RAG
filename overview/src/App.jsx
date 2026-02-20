const DEMO_URL = 'https://rag-tau-six.vercel.app/';

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

const ExternalLink = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
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
          <a href={DEMO_URL} target="_blank" rel="noopener" className="btn btn-primary nav-cta">
            Live Demo <ExternalLink />
          </a>
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
          SellBot AI reads your property PDFs, brochures, and price lists
          — then answers any question instantly using Retrieval-Augmented Generation.
        </p>

        <div className="hero-actions">
          <a href={DEMO_URL} target="_blank" rel="noopener" className="btn btn-primary">
            Try Live Demo <ExternalLink />
          </a>
          <a href="#what-is-rag" className="btn btn-outline">
            How it works <ArrowRight />
          </a>
        </div>

        <div className="stats-strip">
          {[
            { value: '5+', label: 'File types supported' },
            { value: '<1s', label: 'Query response time' },
            { value: '1024', label: 'Embedding dimensions' },
            { value: '6', label: 'REST API endpoints' },
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
    desc: 'PDF, DOCX, Excel or TXT — streamed as bytes, never written to disk.',
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
    desc: 'Each chunk converted to a 1024-dim semantic vector by BAAI/bge-large-en-v1.5.',
    tag: 'sentence-transformers',
  },
  {
    num: 4, icon: '🗄️',
    title: 'Store in pgvector',
    desc: 'Vectors and metadata stored in PostgreSQL with the pgvector extension and HNSW index.',
    tag: 'pgvector',
  },
  {
    num: 5, icon: '💬',
    title: 'Query & Answer',
    desc: 'Question embedded → top-k chunks retrieved by cosine similarity → Gemini generates answer.',
    tag: 'Gemini Flash LLM',
  },
];

function Pipeline() {
  return (
    <section id="pipeline">
      <div className="container pipeline">
        <p className="section-label">Under the hood</p>
        <h2 className="section-title">How It <span className="grad-text">Works</span></h2>
        <p className="section-sub" style={{ margin: '0 auto' }}>
          Five steps from document upload to AI-generated answer — all happening in under a second.
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
    sub: 'Python 3.11 · REST API',
    features: [
      'Async endpoints for upload, query, reset, status',
      'In-memory document parsing — no disk writes',
      'Plugin-based design: swap any provider via config.py',
      'Auto-loads embedder, vector DB, and LLM at startup',
    ],
  },
  {
    icon: '🗄️',
    iconBg: 'rgba(6,182,212,.15)',
    title: 'pgvector Database',
    sub: 'PostgreSQL · Vector Search',
    features: [
      'HNSW index for fast approximate nearest-neighbour search',
      'Cosine similarity scoring (0–100%)',
      'Stores text, metadata, and 384-dim vectors together',
      'Internal Railway network — never exposed to internet',
    ],
  },
  {
    icon: '🧠',
    iconBg: 'rgba(139,92,246,.15)',
    title: 'Gemini Flash LLM',
    sub: 'Google Gemini · Answer Generation',
    features: [
      'Receives top-k retrieved chunks as grounded context',
      'Structured system prompt prevents hallucination',
      'Returns markdown-formatted answer with source references',
      'Swappable with GPT-4, Claude, or any LLM via config',
    ],
  },
  {
    icon: '🎨',
    iconBg: 'rgba(245,158,11,.15)',
    title: 'React Frontend',
    sub: 'React 19 · Redux · TypeScript',
    features: [
      'Real-time chat UI with markdown and code rendering',
      'Redux Toolkit + redux-persist (chat survives reloads)',
      'File upload with drag-and-drop support',
      'Expandable source citations with similarity scores',
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
          Four layers working together — from document ingestion to AI-powered answers.
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
  { icon: '🤗', name: 'sentence-transformers', role: 'Local embeddings' },
  { icon: '🐘', name: 'PostgreSQL', role: 'Vector database' },
  { icon: '🔷', name: 'pgvector', role: 'Vector extension' },
  { icon: '✨', name: 'Gemini Flash', role: 'LLM answer generation' },
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
            <div className="demo-card-url">rag-tau-six.vercel.app</div>
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
          <a href={DEMO_URL} target="_blank" rel="noopener" className="btn btn-primary" style={{ fontSize: '15px', padding: '14px 32px' }}>
            Open Live Demo <ExternalLink />
          </a>
          <a href="https://github.com/Seetha206/RAG" target="_blank" rel="noopener" className="btn btn-outline">
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
          Built with ❤️ using FastAPI · pgvector · React · Gemini &nbsp;·&nbsp;{' '}
          <a href={DEMO_URL} target="_blank" rel="noopener">Try the live demo →</a>
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
