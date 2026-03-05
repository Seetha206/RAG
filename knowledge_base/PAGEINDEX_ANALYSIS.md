# PageIndex RAG — Concept Analysis & SellBot Relevance

**Date analysed:** 2026-03-03
**Status:** Watched / Not yet implemented
**Decision:** Not applicable to current document set — revisit if long regulatory/legal docs are added

---

## What is PageIndex?

PageIndex is a **vectorless, reasoning-based RAG framework** that indexes documents as hierarchical trees (sections → subsections → pages) instead of embedding-based chunks. The LLM navigates the tree to locate the answer rather than doing cosine similarity search.

**Source:** GitHub — PageIndex project

---

## How it differs from traditional RAG

| Dimension | Traditional RAG (SellBot current) | PageIndex |
|---|---|---|
| Indexing | chunk → embed → vector store | parse structure → tree index |
| Retrieval | cosine similarity (HNSW) | LLM reasons over tree nodes |
| Chunking | 800-char, sentence-boundary | none — preserves document structure |
| LLM calls per query | 0 (FAQ hit) or 1 (RAG) | 2+ (tree navigation + answer) |
| Citation | chunk offset + filename | section name + page number |
| Cross-document queries | native (shared vector namespace) | hard (separate trees per doc) |
| Best document type | short/medium, multi-document | long, deeply hierarchical, single-doc |

### Traditional RAG pipeline
```
Document → chunk(800 chars) → embed → pgvector → cosine similarity → top-k → LLM
```

### PageIndex pipeline
```
Document → parse section hierarchy → tree index → LLM reasons over tree → navigate to node → extract answer
```

---

## Key characteristics

- **Vectorless & No chunking:** Replaces embeddings with structural tree navigation
- **Hierarchical structure:** Documents indexed like an intelligent table of contents (section → subsection → page)
- **Agentic reasoning:** LLM decides which subtree contains the answer — 2+ LLM calls per query
- **High precision & traceability:** Returns `§14.3(b), page 127` style citations
- **Designed for:** Financial reports, regulatory filings, academic textbooks, technical manuals (long, formally structured)

---

## Where PageIndex genuinely wins over vector RAG

| Scenario | Why vectors struggle | Why PageIndex wins |
|---|---|---|
| "What does clause 14.3.b say?" | Chunk may split the clause across boundaries | Navigates directly to section 14.3.b |
| 300-page RERA agreement | Critical context spread across 20 retrieved chunks | Reasons about which section governs |
| Cross-referenced sections ("See footnote 8 and Table 4A") | Page-spanning references lost in chunking | Tree preserves document structure |
| Precise legal citation required | Source is chunk offset, not section name | Returns exact section + page |

---

## SellBot-specific analysis

### Current document types (short, flat)

Real estate brochures are **short and structurally flat** — typically 5–30 pages:

```
Sunrise Heights Brochure
├── Overview (page 1)
├── Floor Plans (page 2)
├── Pricing (page 3)
└── Amenities (page 4)
```

PageIndex's tree navigation advantage collapses when the tree is only 2 levels deep. An LLM reasoning over that tree still reads the Pricing page to answer a price question — no more precise than cosine search returning the pricing chunk.

### Three specific conflicts with SellBot architecture

**1. Multi-document cross-project queries break the model**

PageIndex indexes one document as one tree. SellBot has many documents per project. A query like *"Compare Sunrise Heights vs Park Avenue 3BHK pricing"* requires reasoning across two separate trees — PageIndex has no native cross-tree retrieval. SellBot's vector approach handles this natively: both documents' chunks share the same project namespace.

**2. Latency conflict — PageIndex needs 2+ LLM calls per query**

- PageIndex: LLM call #1 (tree navigation) + LLM call #2 (answer generation)
- SellBot FAQ hit: **0 LLM calls** (~10ms PostgreSQL FTS)
- SellBot RAG fallback: **1 LLM call**

SellBot targets `<1s` response. With Ollama (180s max timeout), double LLM calls would significantly increase p99 latency.

**3. Document addition becomes heavier**

SellBot current: `upload → embed → upsert to pgvector` — instant.
PageIndex: requires re-parsing document structure into a tree index each time — more operational overhead for a system where agents upload brochures frequently.

### Where SellBot's FAQ-first already covers PageIndex's main benefit

PageIndex's main advantage is **precision and traceability**. SellBot's FAQ-first path already achieves this for the most common queries:
- FAQ hit → exact pre-extracted answer → 0 hallucination, direct citation to source file
- The FAQ Q&A pairs are grounded in the original document text by the LLM at upload time

For the remaining RAG queries, 800-char sentence-boundary chunks with 1024-dim cosine search is well-matched to the actual document lengths.

---

## When to revisit PageIndex for SellBot

**Trigger: document types shift toward long structured content**

| Future document type | Pages | Should consider PageIndex? |
|---|---|---|
| RERA compliance filings | 40–100 | Yes |
| Loan agreements / sale deeds | 100–300 | Yes |
| Building bylaws / zoning regulations | 50–200 | Yes |
| Property management contracts | 20–80 | Maybe |
| Current brochures / price lists | 5–30 | No — current approach is correct |

---

## Hybrid architecture (future consideration)

If long regulatory/legal documents are added, a hybrid makes sense — **not replacing** the current system but **adding a parallel path**:

```
POST /upload:
  if doc_type == "legal" or page_count > 50:
      → PageIndex tree builder → store tree in DB
  else:
      → current: embed → pgvector (current path)

POST /query:
  FAQ-first (unchanged — PostgreSQL FTS)
  ↓ no FAQ match
  if project has PageIndex docs AND query looks structural:
      → PageIndex tree navigation + LLM
  else:
      → current: embed → cosine similarity → LLM (current path)
```

The FAQ layer (Phase 1 of SellBot) is **orthogonal** to both retrieval methods — it stays in both scenarios.

---

## Decision

**Current status: Watch, do not implement.**

The current vector + FAQ-first architecture is the right fit for short, multi-document, real estate brochure content where speed and cross-document retrieval matter. PageIndex solves a problem SellBot does not yet have.

**Re-evaluate when:** Legal/regulatory document support is planned (RERA, sale deeds, loan docs). At that point, add PageIndex as a parallel document type handler alongside the existing vector pipeline, not as a replacement.

---

## References

- PageIndex GitHub repository (vectorless RAG framework)
- Related: LlamaIndex's Tree Index (similar hierarchical approach, but with embeddings at each node)
- Related: Microsoft GraphRAG (graph-based, also reasoning-first — same tradeoff analysis applies)
