# Similarity Percentage Explained

## What Does "58% Match" Mean?

When you query the RAG system, each source chunk is returned with a match percentage like "58% match". This number is the **cosine similarity score multiplied by 100**. It measures how semantically close the retrieved document chunk is to your question -- not a keyword overlap count, but a geometric comparison between two high-dimensional vectors.

## How the Score Is Calculated: End-to-End Pipeline

### Step 1: Query Embedding

Your question is converted into a dense vector by the embedding model. With the current configuration (BAAI/bge-large-en-v1.5), this produces a **1024-dimensional** vector.

```
User types: "What about parking?"
    → Embedding model produces: [0.0231, -0.0187, 0.0412, ..., 0.0089]  (1024 floats)
```

### Step 2: Chunk Vectors Already Exist

When documents were uploaded, each text chunk was already embedded and stored in pgvector. These vectors sit in the database waiting to be compared.

### Step 3: pgvector Cosine Distance Calculation

pgvector computes the **cosine distance** between the query vector and every stored chunk vector using the `<=>` operator. The RAG system then converts this to a **cosine similarity** score:

```sql
-- pgvector computes cosine distance internally
-- The Python code converts it:
similarity_score = 1 - cosine_distance
-- i.e., 1 - (embedding <=> query_vector)
```

Cosine similarity ranges from 0 (completely unrelated) to 1 (identical meaning). A score of 0.58 means the angle between the two vectors is relatively small -- the chunk is semantically relevant to the query.

### Step 4: Filtering

Two filters are applied sequentially:

1. **similarity_threshold (0.15)** -- Any chunk scoring below this minimum is discarded entirely. This is a quality floor.
2. **top_k (10)** -- Of the chunks that pass the threshold, only the top 10 highest-scoring ones are returned. This is a quantity cap.

### Step 5: Frontend Display

The frontend receives the raw similarity score (a float between 0 and 1) and formats it as a percentage:

```typescript
`${(source.similarity_score * 100).toFixed(0)}% match`
```

So a raw score of `0.58` becomes `"58% match"` in the UI.

## Score Ranges: What They Mean in Practice

| Range | Interpretation | What It Looks Like |
|-------|---------------|-------------------|
| **70%+** | Very strong match | Query and chunk discuss nearly the same specific topic |
| **55-70%** | Strong match | Chunk is clearly relevant, covers the queried subject |
| **45-55%** | Moderate match | Chunk is related but may cover a broader or adjacent topic |
| **30-45%** | Weak match | Some topical overlap but chunk may be tangential |
| **15-30%** | Very weak match | Minimal relevance; passes threshold but may be noise |
| **<15%** | Filtered out | Below the similarity_threshold; never shown to the user |

## Real Example: "Parking" Query

When a user queried **"What about parking?"**, the system returned 10 source chunks with the following similarity scores:

```
Source 1:  58% match  (0.5800)
Source 2:  57% match  (0.5700)
Source 3:  55% match  (0.5500)
Source 4:  54% match  (0.5400)
Source 5:  53% match  (0.5300)
Source 6:  52% match  (0.5200)
Source 7:  51% match  (0.5100)
Source 8:  50% match  (0.5000)
Source 9:  49% match  (0.4900)
Source 10: 49% match  (0.4900)
```

Key observations:

- The scores cluster in a narrow band (49-58%), which is typical for domain-specific real estate documents where many chunks share overlapping vocabulary.
- All 10 sources passed both filters: above the 0.15 threshold and within the top_k=10 limit.
- The spread between the best and worst match is only 9 percentage points.

## Why Higher Percentage Doesn't Always Mean Best Answer

A common misconception is that the highest-scoring chunk always contains the best answer. This is not guaranteed for several reasons:

1. **Semantic similarity is not answer quality.** A chunk might be very similar to the question in topic but not contain the specific fact the user needs. A lower-ranked chunk might have the exact answer embedded in a paragraph about a broader subject.

2. **Embedding models capture meaning, not precision.** The model might score a general overview paragraph higher than a specific detail paragraph, even though the detail is what the user wants.

3. **The LLM synthesizes across all chunks.** The generate_answer() function sends all retrieved chunks to the LLM as context. The LLM reads all of them and can extract the correct answer from chunk #7 even if chunk #1 scored higher.

4. **Chunk boundaries matter.** If the answer spans two chunks, neither individual chunk will score as high as a single chunk that perfectly encapsulates the topic. The overlap (100 tokens) helps but doesn't eliminate this.

This is why the system retrieves multiple chunks (top_k=10) rather than just the single best match -- it gives the LLM enough context to find and compose the right answer regardless of individual chunk rankings.

## The Two Filters: top_k and similarity_threshold

The system applies two independent filters that work together:

```
All chunks in database
    │
    ├── similarity_threshold = 0.15  (quality gate: discard anything below 15%)
    │
    └── top_k = 10  (quantity gate: keep only the 10 best)
    │
    └── Final results sent to LLM for answer generation
```

- **top_k** controls how many chunks the LLM sees. More chunks = more context but also more noise and higher token costs.
- **similarity_threshold** controls the minimum quality. It prevents clearly irrelevant chunks from reaching the LLM even if fewer than top_k chunks are available.

Both are configured in `config.py` under `RAG_CONFIG`.
