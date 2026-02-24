# HNSW vs IVFFlat — Complete Index Explanation

> Why this RAG system uses HNSW, how both indexes work, and when to switch.

---

## Full Forms

| Abbreviation | Full Form |
|---|---|
| **HNSW** | Hierarchical Navigable Small World |
| **IVFFlat** | Inverted File Index — Flat (no compression) |

---

## IVFFlat — How It Works

**The concept: Divide all vectors into clusters at build time, search only the relevant clusters.**

### Step 1 — Training (build time)

```
All 1000 vectors in your DB:
  ┌──────────────────────────────────────────┐
  │  *  *  *  *    *  *  *    *  *  *  *    │
  │    *  *          *  *        *  *        │
  │  Cluster 1   Cluster 2   Cluster 3  ...  │
  │  (centroid)  (centroid)  (centroid)      │
  └──────────────────────────────────────────┘

IVFFlat runs k-means clustering to create N "lists" (buckets).
Each vector is assigned to its nearest centroid.
lists = 100  →  creates 100 clusters
```

### Step 2 — Search time

```
Query vector comes in
  → Find nearest 2–3 centroids
  → Only search vectors inside those clusters
  → Instead of checking 1000 vectors, only checks ~30
```

### The Problem — It needs data to train on

```sql
CREATE INDEX ON rag_documents
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

- Table has **0 rows** → clusters cannot be formed → index is useless
- Table has **50 rows** and `lists=100` → most clusters are EMPTY → search misses results
- **Rule:** rows should be at least **3× the number of lists**
  - `lists = 100` needs ~300+ vectors minimum to work properly

### The Maintenance Problem

```sql
-- After every bulk insert, you must run:
ANALYZE rag_documents;

-- Without ANALYZE → query planner uses stale stats
--               → wrong clusters are searched
--               → relevant chunks are missed
```

---

## HNSW — How It Works

**The concept: Build a multi-layer navigation graph. Each vector connects to its nearest neighbours. Search by traversing the graph top-down.**

### Step 1 — Build time (inserting each vector)

```
Layer 2 (sparse — long-range highway connections):
    A ────────────────────────── F

Layer 1 (medium — neighbourhood connections):
    A ──── C ──── F
    │             │
    B             E

Layer 0 (dense — all vectors, short connections):
    A ── B ── C ── D ── E ── F ── G ── H

Each new vector inserted:
  → Randomly assigned to a top layer
  → Connects to m=16 nearest neighbours on each layer it appears in
  → Graph grows incrementally — always valid, even from 0 rows
```

### Step 2 — Search time

```
Query Q comes in:

1. Start at Layer 2 (few nodes, fast scan)
   → Find approximate nearest neighbour region

2. Drop to Layer 1 (refine using local connections)
   → Closer to Q now

3. Drop to Layer 0 (all vectors — final fine-grained search)
   → Explore ef_search candidates
   → Return top-k results

Analogy: Like GPS navigation
  Layer 2 = motorways    (fast, coarse direction)
  Layer 1 = main roads   (refine the route)
  Layer 0 = exact street (precise destination)
```

### Why it works on empty tables

```
Table has 0 rows → index exists, is empty → no problem
First row inserted → becomes root node of the graph
Each new row → connects to nearest existing neighbours
→ Index updates live on every INSERT — zero maintenance needed
```

---

## Side-by-Side Comparison

| Property | IVFFlat | HNSW |
|---|---|---|
| **Full name** | Inverted File — Flat | Hierarchical Navigable Small World |
| **Structure** | Flat clusters (k-means) | Multi-layer graph |
| **Build on empty table** | Fails / useless | Works perfectly |
| **Incremental inserts** | Needs ANALYZE after bulk inserts | Handles naturally — no maintenance |
| **Recall quality** | Good (~95%) | Better (~99%) |
| **Build speed** | Fast | Slower |
| **Memory usage** | Low | Higher |
| **Query speed** | Very fast | Fast |
| **Minimum data needed** | rows ≥ 3× lists | None |
| **Best scale** | > 100,000 vectors | Up to ~1 million vectors |

---

## Why This RAG System Uses HNSW

### Reason 1 — Index is created on startup, before any data exists

```python
# src/vector_databases.py — PgVectorDatabase._setup_database()
# Runs automatically on every server start

cur.execute("""
    CREATE INDEX IF NOT EXISTS rag_documents_embedding_idx
    ON rag_documents
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
""")

# If this were IVFFlat with lists=100 and table is empty → broken index
# HNSW on empty table → perfectly valid, grows as documents are uploaded
```

### Reason 2 — Every /upload adds chunks immediately, no batch mode

```
User uploads a PDF
  → 33 chunks created
  → Each chunk inserted individually into pgvector

IVFFlat behaviour:
  → Clusters are now stale
  → Must run ANALYZE manually
  → Extra step, easy to forget, causes missed results

HNSW behaviour:
  → Each INSERT updates the graph automatically
  → Always accurate
  → Zero maintenance required
```

### Reason 3 — Current scale is HNSW's sweet spot

```
Current stored vectors: 33
After typical use: 1,000 – 50,000
IVFFlat advantage starts at: 100,000+

At SellBot's current and near-future scale:
  → HNSW gives better recall
  → Zero overhead
  → No configuration tuning needed
```

---

## The Parameters Explained — `m=16, ef_construction=64`

### `m = 16` — Connections per layer

```
m = 4   →  sparse graph, very fast build, poor recall
m = 16  →  balanced (industry standard default)          ← we use this
m = 32  →  denser graph, slower build, better recall
m = 64  →  very dense, slow build, excellent recall, high memory

Effect: higher m = more neighbours checked = better results = more RAM
```

### `ef_construction = 64` — Build quality

```
ef_construction controls how many candidate neighbours
are considered when BUILDING each connection in the graph.

ef_construction = 32   →  faster build, slightly worse graph quality
ef_construction = 64   →  balanced (recommended default)             ← we use this
ef_construction = 128  →  slower build, better graph quality, better recall

Note: ef_construction only affects index BUILD time.
      It does NOT affect query speed.
      A separate parameter ef_search controls query-time quality.
```

---

## The SQL Used in This Project

```sql
-- What the app auto-creates (src/vector_databases.py)
CREATE INDEX IF NOT EXISTS rag_documents_embedding_idx
    ON rag_documents
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- operator class options:
-- vector_cosine_ops   → cosine distance (<=>)  ← used here
-- vector_l2_ops       → L2 / Euclidean (<->)
-- vector_ip_ops       → inner product (<#>)
```

---

## When to Switch to IVFFlat

```
Vectors stored now:    33        → HNSW ✓
After 1,000 uploads:  ~33,000   → HNSW ✓
At 100,000+ vectors             → Consider switching

-- Switch procedure:
DROP INDEX rag_documents_embedding_idx;

CREATE INDEX rag_documents_ivfflat_idx
    ON rag_documents
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 316);   -- formula: sqrt(total_row_count)
                          -- 100,000 rows → sqrt(100000) ≈ 316

ANALYZE rag_documents;   -- required after creating IVFFlat index

-- Going forward: run ANALYZE after every large batch upload
```

---

## Visual: How HNSW Finds Your Answer

```
You ask: "What is the price of 3 BHK Duplex?"

Query embedding = [0.23, -0.41, 0.87, ...]  (1024 numbers)

HNSW search:
  Layer 2:  [A]──────[F]──────[K]
               ↓ nearest to query is near F
  Layer 1:  [D]──[F]──[G]
                    ↓ refine — G is closer
  Layer 0:  [G]──[G1]──[G2]──[G3]
                          ↓
                     "3 BHK Duplex — Sunrise Heights
                      2200 sqft — Rs. 1.80 Cr"
                      similarity: 0.82 ✓

Result returned to LLM as context → accurate answer generated
```

---

## Summary

| | IVFFlat | HNSW |
|---|---|---|
| **How** | Clusters vectors into N buckets, searches nearest buckets | Builds a graph, navigates from coarse to fine |
| **Strength** | Very fast at massive scale (>100k vectors) | Better recall, zero maintenance, works from empty |
| **Weakness** | Needs data to build, needs ANALYZE after inserts | Higher memory, slower to build |
| **This project** | Not suitable — index created before data exists | **Used** — perfect for incremental real-time inserts |

> **Bottom line:** HNSW was chosen because the app creates the index at startup on an empty table, and every document upload adds chunks in real time. IVFFlat would either fail at startup or give degraded recall until manually rebuilt. HNSW requires zero maintenance and delivers better recall at the current scale.
