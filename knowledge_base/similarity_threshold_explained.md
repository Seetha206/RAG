# Similarity Threshold Explained

## What Is the Similarity Threshold?

The similarity threshold is a **minimum cosine similarity score** that a document chunk must meet to be included in the results returned to the LLM. Any chunk scoring below this threshold is discarded, regardless of how many chunks are available.

It is configured in `config.py` under `RAG_CONFIG`:

```python
RAG_CONFIG = {
    "similarity_threshold": 0.15,  # Minimum cosine similarity (0.0 to 1.0)
    "top_k": 10,                   # Maximum number of chunks to return
    # ...
}
```

## Current Setting: 0.15 (Very Lenient)

The current threshold of **0.15** is intentionally lenient. The design philosophy is: **let the LLM filter the noise, not the retrieval layer.**

At 0.15, virtually every chunk that has any topical relationship to the query will pass through. The LLM (Gemini Flash) then reads all retrieved chunks and decides which ones are actually relevant when composing its answer. This approach works because modern LLMs are excellent at ignoring irrelevant context within their input.

## Three Threshold Levels Compared with Real Data

To illustrate the impact, consider a query about **"3 BHK Duplex pricing"** against a real estate knowledge base. The system retrieves chunks with similarity scores like:

```
Chunk A: "3 BHK Duplex Villa - 2400 sqft - Rs 1.2 Cr"     → 0.573
Chunk B: "Duplex options in Phase 2 with parking"           → 0.521
Chunk C: "3 BHK apartments starting from Rs 85L"            → 0.498
Chunk D: "Project amenities include clubhouse and gym"      → 0.412
Chunk E: "Site location and connectivity details"           → 0.334
Chunk F: "Builder registration and RERA details"            → 0.287
Chunk G: "Payment plan and loan options"                    → 0.245
Chunk H: "Random brochure header text"                      → 0.118
```

### Threshold at 0.50 (Strict)

```
PASS: Chunk A (0.573), Chunk B (0.521)
FAIL: Chunk C (0.498), D, E, F, G, H
```

**Result: Only 2 chunks reach the LLM.**

- Advantage: Very clean context with minimal noise.
- Problem: Chunk C ("3 BHK apartments starting from Rs 85L") is filtered out at 0.498 despite being highly relevant pricing information. The LLM never sees it and cannot include it in the answer.
- **This is a real failure mode.** The correct chunk at 0.573 is barely above the threshold. A slight variation in the query phrasing could push it below 0.50, and the user gets no answer at all.

### Threshold at 0.30 (Moderate)

```
PASS: Chunk A (0.573), B (0.521), C (0.498), D (0.412), E (0.334)
FAIL: Chunk F (0.287), G (0.245), H (0.118)
```

**Result: 5 chunks reach the LLM.**

- Advantage: All directly relevant chunks pass. Obvious noise (brochure headers, generic RERA text) is filtered.
- Tradeoff: Chunk D (amenities) and Chunk E (location) aren't about pricing, but they provide useful supplementary context the LLM might reference.
- This is a reasonable middle ground for most deployments.

### Threshold at 0.15 (Current / Lenient)

```
PASS: Chunk A (0.573), B (0.521), C (0.498), D (0.412), E (0.334), F (0.287), G (0.245)
FAIL: Chunk H (0.118)
```

**Result: 7 chunks reach the LLM.**

- Advantage: Nothing relevant is lost. Even tangentially related chunks like payment plans (G) might help the LLM give a more complete answer.
- Tradeoff: The LLM receives more context, increasing token usage. Some chunks (RERA details) add no value for a pricing question.
- Only truly irrelevant text (score below 0.15) is discarded.

## How Threshold Interacts with top_k

The similarity threshold and top_k are **two independent filters applied sequentially**:

```
All chunks in the vector database
        │
        ▼
   ┌─────────────────────────────────┐
   │  Filter 1: similarity_threshold │
   │  Remove chunks below 0.15       │
   └─────────────────────────────────┘
        │
        ▼
   ┌─────────────────────────────────┐
   │  Filter 2: top_k                │
   │  Keep only the top 10 results   │
   └─────────────────────────────────┘
        │
        ▼
   Chunks sent to the LLM
```

**Scenario interactions:**

| Chunks above threshold | top_k | Chunks sent to LLM | What happened |
|----------------------|-------|-------------------|---------------|
| 25 | 10 | 10 | top_k was the limiting factor |
| 8 | 10 | 8 | Threshold was the limiting factor |
| 0 | 10 | 0 | No chunks passed the threshold; LLM gets no context |
| 50 | 3 | 3 | Aggressive top_k keeps only the best 3 |

When the threshold is very lenient (0.15), top_k almost always becomes the binding constraint. The threshold only kicks in for truly unrelated content.

## Recommendation: Start Lenient, Tighten Only If Needed

**Start with 0.15** (the current setting) and observe the quality of answers.

**Only increase the threshold if:**
- The LLM is producing answers that reference clearly irrelevant chunks (e.g., answering a pricing question with parking details).
- You're seeing hallucinated information that traces back to low-scoring noisy chunks.
- Token costs are a concern and you need to reduce the volume of context sent to the LLM.

**Suggested escalation path:**
1. **0.15** -- Default. Maximum recall. Trust the LLM to filter.
2. **0.30** -- Moderate. Filters obvious noise while keeping most relevant chunks. Good for production systems where token cost matters.
3. **0.50** -- Strict. Only highly relevant chunks pass. Risk of filtering correct answers that score in the 0.40-0.50 range. Not recommended unless your embedding model consistently produces high scores for relevant content.

**Do not set the threshold above 0.60** unless you have validated that your embedding model and document corpus consistently produce scores above that level for relevant queries. With BAAI/bge-large-en-v1.5 and typical real estate documents, even strong matches often score in the 0.50-0.60 range.

To change the threshold, edit `config.py`:

```python
RAG_CONFIG = {
    "similarity_threshold": 0.30,  # Changed from 0.15 to 0.30
    # ...
}
```

No code changes are needed beyond this configuration value. The threshold is read at query time by the vector database's `search()` method.
