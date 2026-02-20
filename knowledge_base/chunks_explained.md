# How Document Chunking Works in a RAG System

This document explains what chunks are, why they exist, and how the SellBot RAG pipeline creates them.

---

## 1. What Is a Chunk?

A **chunk** is a small piece of text created by splitting a larger document into manageable segments. Each chunk is short enough to be converted into an embedding vector and stored in a vector database for semantic search.

When you upload a PDF, DOCX, Excel, or TXT file to SellBot, the system does not store the document as a single blob. Instead, it breaks the document into multiple chunks, embeds each one independently, and stores them all. At query time, the system searches across every chunk from every document to find the most relevant pieces of text.

A typical chunk is a few sentences long -- roughly 800 characters in our current configuration.

---

## 2. Why Do We Need Chunks?

Three reasons:

1. **Embedding models work best on focused text.** Embedding models (like BAAI/bge-large-en-v1.5) produce a single vector that represents the meaning of the input text. If you feed an entire 10-page PDF as one input, the resulting vector is a vague average of everything in the document. Smaller, focused chunks produce vectors that accurately represent specific topics.

2. **Smaller chunks = more precise search.** When a user asks "What is the parking allocation?", the system needs to find the exact paragraph that mentions parking. If the entire document were one vector, the system would either return the whole document or nothing. With chunks, it can pinpoint the specific paragraph.

3. **The LLM gets focused context.** Large language models have limited context windows and perform better when given relevant, concise information rather than pages of unrelated text. Chunks allow the system to send only the most relevant pieces to the LLM.

---

## 3. How Chunks Are Created (The Pipeline)

When you upload a file to `POST /upload`, it passes through five steps:

### Step 1: Parse

The raw file bytes are converted to plain text using format-specific parsers. All parsing happens **in-memory** -- no files are ever written to disk.

| Format | Parser Library | Function |
|--------|---------------|----------|
| PDF    | PyPDF2        | `parse_pdf_pypdf2(file_bytes)` |
| DOCX   | python-docx   | `parse_docx_stream(file_bytes)` |
| XLSX   | pandas + openpyxl | `parse_excel_pandas(file_bytes)` |
| TXT    | built-in      | `file_bytes.decode('utf-8')` (falls back to latin-1) |

The entry point is `auto_detect_and_parse()` in `document_parsers.py`, which routes to the correct parser based on file extension.

### Step 2: Clean

The raw extracted text contains artifacts from the parsing step. The `clean_text()` function removes them:

- **Removes `[Page X]` markers** injected by the PDF parser (e.g., `[Page 1]`, `[Page 2]`)
- **Removes `[Table X]` markers** (e.g., `[Table 1]`, `[Page 2 - Table 1]`)
- **Fixes hyphenation** across line breaks (e.g., `apart-\nment` becomes `apartment`)
- **Collapses whitespace** -- multiple blank lines become one; multiple spaces become one
- **Strips leading/trailing whitespace** from each line

### Step 3: Chunk

The cleaned text is split into overlapping chunks using `chunk_text()`:

```python
chunk_text(cleaned_text, chunk_size=800, chunk_overlap=200)
```

The chunker is **sentence-boundary aware**. It never cuts in the middle of a sentence. The algorithm:

1. Split text into sentences using regex on `.`, `!`, `?` followed by whitespace.
2. Accumulate sentences until the next sentence would exceed `chunk_size` (800 chars).
3. Finalize the current chunk.
4. Carry over trailing sentences from the current chunk that fit within the `overlap` budget (200 chars) as the start of the next chunk.
5. Repeat until all sentences are consumed.

### Step 4: Embed

Each chunk is converted into a numerical vector using the embedding model:

```python
embedder.embed(chunks)  # each chunk -> 1024-dimensional vector
```

The current model is **BAAI/bge-large-en-v1.5**, which runs locally and produces a 1024-dimensional vector for each chunk. This vector captures the semantic meaning of the text -- chunks about similar topics will have vectors that are close together in vector space.

### Step 5: Store

Each chunk's text, vector, and metadata are stored in the vector database:

```python
vector_db.add(texts=chunks, vectors=embeddings, metadata=metadata_list)
```

The current vector database is **pgvector** (PostgreSQL with the vector extension). Each row in the `rag_documents` table contains:
- `id` -- unique identifier
- `text` -- the chunk text
- `embedding` -- the 1024-dimensional vector
- `metadata` -- JSON with filename, chunk index, upload timestamp, etc.

---

## 4. Real Example

Suppose you upload a 4-page PDF called **Sunrise Heights Brochure.pdf**. The document contains information about a residential real estate project.

After parsing, cleaning, and chunking, the system produces approximately 4 chunks:

| Chunk | Characters | Content Summary |
|-------|-----------|-----------------|
| 0     | ~780      | Project overview: Sunrise Heights by ABC Developers, located in Whitefield, Bangalore. 2/3 BHK apartments, 200 units, RERA registered. |
| 1     | ~750      | Pricing and unit configurations: 2 BHK from 45 lakhs (1050 sq.ft.), 3 BHK from 65 lakhs (1450 sq.ft.). Payment plans and bank approvals. |
| 2     | ~800      | Amenities: clubhouse, swimming pool, gym, children's play area, landscaped gardens, 24/7 security, power backup, rainwater harvesting. |
| 3     | ~620      | Location and connectivity: 2 km from metro station, 5 km from IT parks, nearby schools and hospitals. Parking: 1 covered slot per 2 BHK, 2 slots per 3 BHK. |

Each of these 4 chunks is embedded into a 1024-dimensional vector and stored in pgvector as a separate row. The original PDF is not stored anywhere.

---

## 5. Why the Same Document Appears Multiple Times in Sources

When you query "What is the parking allocation at Sunrise Heights?", the system searches across **all chunks from all documents**. The top_k most similar chunks are returned as sources.

If 3 of those top chunks happen to come from the same PDF, you will see the same filename listed 3 times in the sources. This is expected behavior, not a bug.

For example, a query about "parking" might match:
- **Chunk 3** (score 0.87) -- directly mentions parking allocation
- **Chunk 0** (score 0.72) -- mentions the project name and general features
- **Chunk 2** (score 0.68) -- mentions amenities including covered parking areas

Each chunk is searched independently. The system does not know or care that they came from the same file. It simply returns the most semantically similar chunks.

---

## 6. Chunk Overlap

Consecutive chunks share a **200-character overlap**. This prevents information loss when a sentence or idea spans the boundary between two chunks.

Without overlap, a sentence like "The project offers 2 covered parking slots per 3 BHK unit" could be split across two chunks, with neither chunk containing the complete information.

Here is how overlap works visually:

```
Document text:
|============================== full document ==============================|

Without overlap:
|---- chunk 0 ----|---- chunk 1 ----|---- chunk 2 ----|---- chunk 3 ----|
                  ^                 ^                 ^
              hard cuts         hard cuts         hard cuts

With 200-char overlap:
|---- chunk 0 ----------|
              |---- chunk 1 ----------|
                            |---- chunk 2 ----------|
                                          |---- chunk 3 ----|
              ^^^^^^^^^^^   ^^^^^^^^^^^   ^^^^^^^^^^^
              overlap 0-1   overlap 1-2   overlap 2-3

Each overlap region (~200 chars) is shared between
consecutive chunks, so no sentence is lost at a boundary.
```

The overlap ensures that even if a key sentence falls right at the boundary between chunk 0 and chunk 1, it will appear in full in at least one of them (and possibly in both).

---

## 7. Current Configuration

These values are set in `config.py` under `RAG_CONFIG`:

| Parameter       | Value | Meaning |
|----------------|-------|---------|
| `chunk_size`    | 800   | Target maximum characters per chunk |
| `chunk_overlap` | 200   | Characters shared between consecutive chunks |
| `top_k`         | 10    | Number of chunks retrieved per query |

Additional relevant settings:

| Parameter              | Value                   | Source |
|------------------------|------------------------|--------|
| Embedding model        | BAAI/bge-large-en-v1.5 | `EMBEDDING_CONFIG` |
| Embedding dimensions   | 1024                   | `EMBEDDING_CONFIG` |
| Vector database        | pgvector               | `VECTOR_DB_CONFIG` |
| Similarity threshold   | 0.15                   | `RAG_CONFIG` |

To change any of these, edit `config.py`. No code changes are needed elsewhere -- the plugin-based architecture picks up the new values automatically.

---

## 8. Key Takeaway

Chunks are the fundamental unit of information in a RAG system. The pipeline works as follows:

1. Your document is parsed into plain text.
2. The text is cleaned and split into small, overlapping chunks at sentence boundaries.
3. Each chunk is embedded into a vector that captures its meaning.
4. The vectors are stored in a database for fast similarity search.
5. When you ask a question, your question is also embedded into a vector.
6. The database finds the chunks whose vectors are closest to your question's vector.
7. Those chunks are sent to the LLM as context, and the LLM generates an answer.

The system does not "read" your documents at query time. It searches pre-computed vectors and retrieves the specific chunks that are most relevant to your question. This is what makes RAG fast and precise.
