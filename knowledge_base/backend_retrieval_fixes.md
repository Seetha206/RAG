# Backend Retrieval Fixes: SellBot RAG Pipeline

This document records every significant fix made to the RAG retrieval pipeline, in chronological order. Each fix includes the problem observed, root cause analysis, the change made, and the measured impact.

---

## Fix 1: Sentence-Boundary Aware Chunking

### Problem
The original chunking strategy used blind 400-character splits. This meant chunks would frequently break mid-sentence, mid-word, or even mid-number:

```
Chunk 17: "...the total project area is 25 ac"
Chunk 18: "res with 1,247 residential units spread across 12 towers..."
```

When a user asked "What is the total project area?", neither chunk contained the complete fact. Chunk 17 had "25 ac" (truncated "acres") and chunk 18 started with "res" -- meaningless on its own. The embedding for each chunk failed to capture the semantic meaning of "25 acres", so neither ranked highly in similarity search.

### Root Cause
The `chunk_text()` function in `document_parsers.py` was performing a naive `text[i:i+chunk_size]` split with character-count-only logic. No awareness of sentence boundaries, paragraph breaks, or logical units.

### Fix Applied
Replaced the blind character split with sentence-boundary aware chunking:

- **Chunk size increased:** 400 characters to 800 characters
- **Split logic:** First split on paragraph boundaries (`\n\n`), then on sentence boundaries (`. `, `? `, `! `), falling back to word boundaries if a single sentence exceeds 800 characters
- **Overlap increased:** 100 to 150 characters, applied at the sentence level (overlap includes the last 1-2 sentences of the previous chunk)

### Impact
- Eliminated mid-word and mid-number splits entirely
- Retrieval accuracy on basic fact questions improved noticeably -- chunks now contain complete facts
- Total chunk count per document decreased (larger chunks), reducing vector DB storage needs

### Config Change
```python
# config.py
DOCUMENT_CONFIG["chunk_size"] = 800      # was 400
DOCUMENT_CONFIG["chunk_overlap"] = 150   # was 100
```

---

## Fix 2: PDF Text Cleaning

### Problem
PDF-parsed text contained artifacts that degraded embedding quality:

- Header/footer repetition: "Page 12 of 45 | Prestige Group Confidential" repeated on every page, creating dozens of near-identical chunks
- Ligature artifacts: "fi" becoming "fi" (or other Unicode ligature characters)
- Excessive whitespace: triple newlines, tab characters mixed with spaces
- Bullet point encoding: various Unicode bullet characters (U+2022, U+2023, U+25CF) inconsistently parsed

These artifacts meant that two chunks containing the same semantic information would have very different text representations, reducing embedding similarity between them and the query.

### Root Cause
The PDF parser (`PyPDF2` / `pdfplumber`) faithfully extracts text as-is, including all layout artifacts. No post-processing was applied before chunking.

### Fix Applied
Added a `clean_text()` function in `document_parsers.py` that runs before chunking:

1. **Header/footer removal:** Regex pattern to detect and strip repeated lines that appear on 3+ pages
2. **Ligature normalization:** Unicode NFKD decomposition to convert ligatures to ASCII equivalents
3. **Whitespace normalization:** Collapse multiple newlines to double-newline (paragraph break), normalize tabs to spaces, strip trailing whitespace
4. **Bullet normalization:** Convert all Unicode bullet variants to a standard `- ` prefix
5. **Page number stripping:** Remove standalone "Page X of Y" lines

### Impact
- Eliminated ~15-20% of junk chunks per PDF document (repeated headers/footers)
- Embedding quality improved for remaining chunks (cleaner text = better semantic representation)
- Cross-document queries became more reliable (consistent bullet/formatting across different PDFs)

### Code Location
```python
# document_parsers.py
def clean_text(raw_text: str) -> str:
    """Remove PDF artifacts before chunking."""
    ...
```

---

## Fix 3: HNSW Index (Replacing IVFFlat)

### Problem
With pgvector as the vector database, the default IVFFlat index was causing missed results. IVFFlat partitions vectors into Voronoi cells and only searches a subset of cells (`probes`) at query time. With the default `probes=1`, the index was searching only ~10% of cells, missing relevant chunks that happened to fall in a different partition.

Increasing probes helped but introduced a trade-off: `probes=10` gave good recall but slowed queries to 200ms+, which was noticeable in the chat UI.

### Root Cause
IVFFlat requires careful tuning of `nlists` (number of cells) and `probes` for each dataset size. With a small-to-medium document collection (500-5000 chunks), IVFFlat's partitioning overhead is not justified -- the dataset is too small to benefit from aggressive partitioning.

### Fix Applied
Switched from IVFFlat to HNSW (Hierarchical Navigable Small World) index:

```sql
CREATE INDEX ON embeddings USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

Parameters:
- **m = 16:** Each node connects to 16 neighbors. Higher = better recall but more memory. 16 is the standard default.
- **ef_construction = 64:** Construction-time search breadth. Higher = slower index building but better graph quality. 64 is a good balance for datasets under 100k vectors.

### Impact
- Recall improved significantly -- HNSW searches the graph more thoroughly than IVFFlat with low probes
- Query latency dropped to under 50ms consistently
- No tuning needed as dataset grows (HNSW self-adjusts, unlike IVFFlat which needs nlist recalculation)

### Config Change
```python
# vector_databases.py -- PgVectorDatabase._setup_database()
# Changed index creation from IVFFlat to HNSW
```

---

## Fix 4: Similarity Score Threshold

### Problem
The vector search was returning chunks with very low similarity scores (0.05-0.15) that were essentially random noise. When these low-quality chunks were included in the LLM context, they would:
- Confuse the LLM by introducing irrelevant information
- Dilute the context window with noise, pushing out potentially useful information (when max context is limited)
- Occasionally cause the LLM to hallucinate answers based on tangentially related content

### Root Cause
The `search()` method returned the top_k results regardless of how low their similarity scores were. With a large chunk collection, there are always k results, even if none are truly relevant to the query.

### Fix Applied
Added a minimum similarity threshold of **0.15** in the search pipeline. Any chunk with a similarity score below 0.15 is filtered out before being passed to the LLM context.

```python
# Filtering applied after vector search, before context injection
results = [(id, text, meta, score) for id, text, meta, score in raw_results if score >= 0.15]
```

### Impact
- Eliminated noise chunks from LLM context entirely
- "Not found" responses became accurate -- when no chunk exceeds 0.15, the system correctly says it does not have the information
- Reduced hallucination on out-of-scope queries (queries about topics not in any uploaded document)

### Threshold Calibration
| Threshold | Behavior |
|-----------|----------|
| 0.05 | Too permissive -- lets in noise |
| 0.15 | Current setting -- good balance of recall and precision |
| 0.30 | Too aggressive -- filters out valid but loosely related chunks |
| 0.50 | Would miss most valid results |

The threshold may need adjustment if the embedding model changes (different models produce different score distributions).

---

## Fix 5: top_k Increase (3 to 5 to 10)

### Problem
With `top_k=3`, comparison queries like "Compare parking across all properties" would only retrieve chunks from 2-3 properties (one chunk per property at best), missing properties entirely. Even single-property queries sometimes missed the answer because the most relevant chunk was at position #4 or #5.

### Root Cause
Real estate documents are verbose. A single property brochure might generate 50-100 chunks. The exact answer to a question might not be in the top 3 by similarity, especially for:
- Niche queries (maintenance charges, legal details) where the relevant chunk's language differs significantly from the query
- Multi-property queries where the system needs at least one chunk per property

### Fix Applied
Increased `top_k` progressively based on testing:

1. **3 to 5:** Helped with single-property queries but still missed properties in comparisons
2. **5 to 10:** Resolved multi-property comparison issues. With 10 chunks, the system reliably retrieves at least one relevant chunk per property for collections of up to 6-7 properties.

### Impact
- Multi-property comparison answers went from covering 2-3 properties to covering all uploaded properties
- Single-property answer accuracy improved as the "safety net" of extra chunks catches answers that would have been missed at lower top_k
- Trade-off: More tokens in LLM context (mitigated by the system prompt instruction to avoid repetition)

### Config Change
```python
# config.py
RAG_CONFIG["top_k"] = 10  # was 3, then 5
```

---

## Fix 6: Query Normalization

### Problem
Users type real estate queries with inconsistent formatting that does not match how the same information appears in documents:

- "3BHK" vs "3 BHK" vs "3-BHK" (documents typically say "3 BHK")
- "sqft" vs "sq.ft." vs "sq ft" vs "square feet"
- "1.5 Crores" vs "1.5 Cr" vs "1,50,00,000" vs "15000000"
- "Sarjapura" vs "Sarjapur" (common misspelling)

These mismatches caused embedding similarity to drop, meaning the correct chunk existed but was not retrieved because the query embedding was too different from the chunk embedding.

### Root Cause
Embedding models are sensitive to surface-level text differences. "3BHK" and "3 BHK" produce noticeably different embeddings despite being semantically identical. The query needs to match the document's vocabulary for optimal retrieval.

### Fix Applied
Added a `normalize_query()` function that standardizes query text before embedding:

1. **BHK normalization:** "3BHK", "3-BHK", "3bhk" all become "3 BHK"
2. **Area unit normalization:** "sqft", "sq ft", "sft" all become "sq.ft."
3. **Currency normalization:** "Crores", "crore", "Cr" all become "Cr" (and "Lakhs", "lakh", "L" all become "Lakhs")
4. **Common misspelling correction:** Dictionary of 20+ common Bangalore area misspellings (Sarjapura to Sarjapur, Whitefield to Whitefield, Yelahanka to Yelahanka)
5. **Case normalization:** Property names and area names are title-cased

### Impact
- Retrieval accuracy improved on queries with non-standard formatting
- Particularly effective for BHK queries (most common query type) -- "3BHK" now retrieves the same results as "3 BHK"
- Misspelling correction prevents zero-result queries for common typos

### Code Location
```python
# app.py or a dedicated query_utils.py
def normalize_query(query: str) -> str:
    """Standardize query text to match document vocabulary."""
    ...
```

---

## Fix 7: System Prompt v2 (9 Instructions)

### Problem
The v1 system prompt was a single sentence: "Answer the user's question based on the provided context." This gave the LLM almost no guidance, resulting in:

- Ambiguous answers without property names
- Hallucinated details when context was insufficient
- Unstructured paragraphs for comparison queries
- Rounded numbers instead of exact figures
- Repeated information from overlapping chunks

### Root Cause
LLMs follow instructions. With minimal instructions, they default to generic behavior -- which is not suitable for a domain-specific real estate assistant that needs precision, structure, and grounding.

### Fix Applied
Designed a 9-instruction system prompt (v2) based on systematic failure analysis. Each instruction addresses a specific observed failure pattern. Full details in `knowledge_base/prompt_engineering.md`.

The 9 instructions:
1. Read ALL context chunks before answering
2. Always mention the property name
3. Organize by property for multi-property queries
4. Surface conflicting data rather than silently choosing
5. Use markdown formatting
6. Use exact numbers, do not round
7. Prioritize higher relevance score chunks
8. Do not repeat information from overlapping chunks
9. Say "not found" instead of hallucinating

### Impact
- Answer quality improved across all test question categories
- Hallucination on out-of-scope queries dropped from frequent to rare
- Comparison queries produce structured, scannable output
- Numbers are now exact (critical for pricing queries)

### Config Location
```python
# config.py
RAG_CONFIG["system_prompt"] = """..."""
```

---

## Fix 8: max_tokens Increase (1000 to 2048)

### Problem
Multi-property comparison answers were getting truncated mid-sentence. A query like "Compare all properties by price, area, and amenities" with 5 uploaded properties requires a substantial response -- often 300+ words with tables or structured lists. With `max_tokens=1000`, the LLM would run out of tokens after covering 3 properties, cutting off abruptly.

### Root Cause
The default `max_tokens=1000` was set conservatively during early development when only single-property queries were tested. As the system evolved to handle comparison queries with `top_k=10`, response length requirements increased.

### Fix Applied
Increased `max_tokens` from 1000 to 2048:

```python
# config.py
LLM_CONFIG["max_tokens"] = 2048  # was 1000
```

### Impact
- Eliminated truncated responses for comparison queries
- Multi-property tables and lists now render completely
- No noticeable latency increase (LLM stops generating when the answer is complete; max_tokens is a ceiling, not a target)

### Trade-off
Higher max_tokens means higher potential cost per query (LLM providers charge per output token). However, the actual average response length only increased for queries that genuinely needed more space. Simple single-property queries still generate 100-200 token responses.

---

## Summary of All Fixes

| # | Fix | Before | After | Primary Impact |
|---|-----|--------|-------|----------------|
| 1 | Sentence-boundary chunking | 400-char blind split | 800-char sentence-aware split | Complete facts in chunks |
| 2 | Text cleaning | Raw PDF text with artifacts | Cleaned, normalized text | Better embeddings, fewer junk chunks |
| 3 | HNSW index | IVFFlat (poor recall or slow) | HNSW (m=16, ef=64) | Fast and accurate search |
| 4 | Similarity threshold | No filtering (noise included) | 0.15 minimum score | Eliminated noise, accurate "not found" |
| 5 | top_k increase | 3 results | 10 results | Full coverage in comparisons |
| 6 | Query normalization | Raw user input | Normalized (BHK, units, spelling) | Better retrieval for varied input |
| 7 | System prompt v2 | 1 generic instruction | 9 targeted instructions | Structured, grounded, accurate answers |
| 8 | max_tokens increase | 1000 | 2048 | No more truncated comparisons |

---

## Related Files

- `config.py` -- all configurable parameters (chunk_size, top_k, system_prompt, max_tokens)
- `document_parsers.py` -- chunking logic and clean_text()
- `vector_databases.py` -- index configuration (HNSW parameters)
- `app.py` -- query normalization and answer generation
- `knowledge_base/prompt_engineering.md` -- detailed prompt design rationale
- `knowledge_base/semantic_questions.md` -- test questions to validate these fixes
