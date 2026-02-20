# Complete Line-by-Line Explanation of simple_rag.py

This document explains every single line of code in `simple_rag.py` and the technical decisions behind it.

---

## Table of Contents
1. [Line-by-Line Code Explanation](#line-by-line-code-explanation)
2. [Why all-MiniLM-L6-v2 Embedding Model?](#why-all-minilm-l6-v2-embedding-model)
3. [Why Run Embeddings Locally?](#why-run-embeddings-locally)
4. [Why FAISS Vector Database?](#why-faiss-vector-database)
5. [How RAG Works (Step by Step)](#how-rag-works-step-by-step)

---

## Line-by-Line Code Explanation

### Lines 1-10: Documentation Header
```python
"""
Simple RAG Implementation using Google Gemini and Local Embeddings
This script demonstrates the core RAG pipeline:
1. Load documents
2. Chunk text
3. Generate embeddings (local)
4. Store in FAISS vector database
5. Semantic search
6. Generate answer using Gemini API
"""
```
**Purpose**: Multi-line string (docstring) that documents what this script does. This appears when you run `help(module)` or read the code. It outlines the 6 main steps of the RAG pipeline.

---

### Lines 12-18: Import Statements

#### Line 12
```python
import os
```
**What**: Import Python's built-in operating system module.
**Why**: We need it to:
- Read environment variables (`os.getenv()`)
- List files in directories (`os.listdir()`)
- Join file paths (`os.path.join()`)

#### Line 13
```python
import google.generativeai as genai
```
**What**: Import Google's Generative AI library and alias it as `genai`.
**Why**: This library provides access to Google's Gemini AI models. We'll use it to generate final answers based on retrieved context.
**Installation**: Comes from `google-generativeai` package.

#### Line 14
```python
from sentence_transformers import SentenceTransformer
```
**What**: Import the SentenceTransformer class from sentence-transformers library.
**Why**: This class loads pre-trained embedding models that convert text into numerical vectors. These vectors capture semantic meaning.
**Key Point**: Runs locally on your machine, no API needed!

#### Line 15
```python
import faiss
```
**What**: Import Facebook AI Similarity Search (FAISS) library.
**Why**: FAISS is a highly optimized library for similarity search in high-dimensional vector spaces. It can search millions of vectors in milliseconds.
**What it does**: Stores embeddings and finds the most similar ones to a query.

#### Line 16
```python
import numpy as np
```
**What**: Import NumPy library (fundamental package for numerical computing in Python).
**Why**:
- FAISS requires embeddings in NumPy array format
- Used for array operations and conversions
- Standard library for working with multi-dimensional arrays

#### Line 17
```python
from dotenv import load_dotenv
```
**What**: Import function to load environment variables from `.env` file.
**Why**: Keeps sensitive data (API keys) separate from code. Good security practice. The `.env` file contains your Gemini API key.

#### Line 18
```python
from typing import List, Tuple
```
**What**: Import type hints for better code documentation.
**Why**:
- `List[str]` means "a list of strings"
- `Tuple[str, str]` means "a tuple with two strings"
- Helps IDEs provide autocomplete and catch type errors
- Makes code more readable and maintainable

---

### Lines 20-21: Load Environment Variables

#### Line 20
```python
# Load environment variables
```
**What**: Comment explaining the next line.

#### Line 21
```python
load_dotenv()
```
**What**: Execute the function to load variables from `.env` file.
**How it works**:
1. Looks for a file named `.env` in current directory
2. Reads all lines like `GEMINI_API_KEY=your_key_here`
3. Makes them available via `os.getenv()`
**Why before imports**: Ensures API keys are loaded before we try to use them.

---

### Lines 23-28: Configuration Constants

#### Line 23
```python
# Configuration
```
**What**: Comment indicating configuration section.

#### Line 24
```python
DOCUMENTS_PATH = "./sample_documents"
```
**What**: Variable storing the path to documents directory.
**Why**:
- Relative path (starts with `./`) means "in current directory"
- Easy to change if you move documents elsewhere
- Single place to update if directory name changes

#### Line 25
```python
CHUNK_SIZE = 400
```
**What**: Maximum number of characters per chunk.
**Why 400?**:
- Too small (e.g., 100): Loses context, may split sentences awkwardly
- Too large (e.g., 2000): Less precise retrieval, exceeds LLM context limits
- 400 is a good balance: Roughly 2-3 paragraphs or 60-80 words
**Experimentation**: Try 200, 600, or 800 to see how results change!

#### Line 26
```python
CHUNK_OVERLAP = 100
```
**What**: Number of characters that overlap between consecutive chunks.
**Why overlap?**:
- Prevents splitting important information across chunks
- If key info is at the end of chunk 1, it's also at start of chunk 2
- Ensures continuity of context
**Example**:
```
Chunk 1: [chars 0-400]
Chunk 2: [chars 300-700]  (overlaps 100 chars with chunk 1)
Chunk 3: [chars 600-1000] (overlaps 100 chars with chunk 2)
```

#### Line 27
```python
TOP_K = 3  # Number of relevant chunks to retrieve
```
**What**: How many most similar chunks to retrieve for each query.
**Why 3?**:
- 1 chunk: May miss important info
- 10 chunks: Too much irrelevant info, confuses the LLM
- 3-5: Sweet spot for most queries
**Trade-off**: More chunks = more context but also more noise

#### Line 28
```python
EMBEDDING_MODEL = "all-MiniLM-L6-v2"  # Local embedding model
```
**What**: Name of the embedding model to use.
**Why this model?**: See detailed section below. Short answer: Fast, accurate, runs locally, free!

---

### Lines 30-35: Model Initialization

#### Line 30
```python
# Initialize models
```
**What**: Comment marking model setup section.

#### Line 31
```python
print("Initializing models...")
```
**What**: Print status message to user.
**Why**: First-time model loading downloads files (~90MB), so user knows something is happening.

#### Line 32
```python
embedding_model = SentenceTransformer(EMBEDDING_MODEL)
```
**What**: Create an instance of SentenceTransformer with our chosen model.
**What happens internally**:
1. Checks if model exists in `~/.cache/torch/sentence_transformers/`
2. If not, downloads from HuggingFace Hub
3. Loads model weights into memory
4. Ready to convert text to 384-dimensional vectors
**Memory**: Uses ~120MB RAM
**Speed**: First run downloads, subsequent runs instant

#### Line 33
```python
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
```
**What**: Configure the Google Generative AI library with your API key.
**How it works**:
1. `os.getenv("GEMINI_API_KEY")` retrieves key from environment
2. `genai.configure()` sets up authentication for all future API calls
**Security**: API key never appears in code, only in `.env` file

#### Line 34
```python
gemini_model = genai.GenerativeModel('gemini-pro')
```
**What**: Create a Gemini Pro model instance.
**Options**:
- `gemini-pro`: Best for text-only tasks (what we use)
- `gemini-pro-vision`: For image + text tasks
**Not downloaded**: Model runs on Google's servers, not locally

#### Line 35
```python
print("Models initialized successfully!\n")
```
**What**: Confirm successful setup. `\n` adds blank line for readability.

---

### Lines 38-53: Document Loading Function

#### Line 38
```python
# Step 1: Document Loading
```
**What**: Comment marking this section of the pipeline.

#### Line 39
```python
def load_documents(docs_path: str) -> List[Tuple[str, str]]:
```
**What**: Define a function named `load_documents`.
**Parameters**:
- `docs_path: str` = expects a string (the directory path)
**Returns**:
- `List[Tuple[str, str]]` = returns a list of tuples, each containing two strings
- First string: filename (e.g., "project_info.txt")
- Second string: file content (the actual text)
**Example return**: `[("file1.txt", "content..."), ("file2.txt", "content...")]`

#### Line 40
```python
    """Load all text documents from the specified directory."""
```
**What**: Docstring describing function purpose.

#### Line 41
```python
    print(f"Loading documents from {docs_path}...")
```
**What**: Print which directory we're loading from.
**f-string**: `f"..."` allows embedding variables with `{variable_name}`

#### Line 42
```python
    documents = []
```
**What**: Create empty list to store document tuples.
**Type**: Will become `List[Tuple[str, str]]`

#### Line 44
```python
    for filename in os.listdir(docs_path):
```
**What**: Loop through all files/folders in the directory.
**How `os.listdir()` works**:
- Input: `"./sample_documents"`
- Output: `["project_info.txt", "amenities.txt", "faq.txt"]`
- Each iteration, `filename` gets one item from this list

#### Line 45
```python
        if filename.endswith('.txt'):
```
**What**: Check if filename ends with `.txt`.
**Why**: Ignore non-text files (like `.DS_Store`, `.gitignore`, subdirectories).
**How**: `"hello.txt".endswith('.txt')` returns `True`

#### Line 46
```python
            filepath = os.path.join(docs_path, filename)
```
**What**: Create full path by joining directory and filename.
**Example**:
- `docs_path` = `"./sample_documents"`
- `filename` = `"project_info.txt"`
- `filepath` = `"./sample_documents/project_info.txt"`
**Why use `os.path.join()`**: Handles different OS path separators (`/` vs `\`)

#### Line 47
```python
            with open(filepath, 'r', encoding='utf-8') as f:
```
**What**: Open file for reading.
**Breakdown**:
- `open(filepath, 'r')`: Open in read mode
- `encoding='utf-8'`: Handle international characters properly
- `with ... as f`: Context manager (automatically closes file)
**Why context manager**: Ensures file is closed even if error occurs

#### Line 48
```python
                content = f.read()
```
**What**: Read entire file content into a string.
**Result**: `content` now contains all text from the file.

#### Line 49
```python
                documents.append((filename, content))
```
**What**: Add tuple of (filename, content) to documents list.
**Example**: `documents.append(("project_info.txt", "Green Valley Residences..."))`

#### Line 50
```python
                print(f"  - Loaded: {filename} ({len(content)} chars)")
```
**What**: Print confirmation with character count.
**Output example**: `  - Loaded: project_info.txt (1523 chars)`

#### Lines 52-53
```python
    print(f"Total documents loaded: {len(documents)}\n")
    return documents
```
**What**: Print summary and return the list of document tuples.

---

### Lines 56-72: Text Chunking Function

#### Line 57
```python
def chunk_text(text: str, chunk_size: int, overlap: int) -> List[str]:
```
**What**: Function to split text into overlapping chunks.
**Parameters**:
- `text`: The document content to chunk
- `chunk_size`: Max characters per chunk (400)
- `overlap`: Characters to overlap (100)
**Returns**: List of text chunks (strings)

#### Line 58
```python
    """Split text into overlapping chunks."""
```
**What**: Docstring.

#### Line 59
```python
    chunks = []
```
**What**: Empty list to store chunks.

#### Line 60
```python
    start = 0
```
**What**: Starting position in the text (character index).
**Why 0**: Python uses 0-based indexing.

#### Line 62
```python
    while start < len(text):
```
**What**: Loop until we've processed the entire text.
**Logic**: Keep chunking while start position is before the end.

#### Line 63
```python
        end = start + chunk_size
```
**What**: Calculate end position for this chunk.
**Example**: If `start=0` and `chunk_size=400`, then `end=400`

#### Line 64
```python
        chunk = text[start:end]
```
**What**: Extract substring from start to end.
**Python slicing**: `text[0:400]` gets characters 0 through 399.

#### Lines 67-68
```python
        if chunk.strip():
            chunks.append(chunk.strip())
```
**What**: Add chunk to list if it's not empty.
**`strip()`**: Removes leading/trailing whitespace.
**Why check**: Prevents adding empty chunks at the end.

#### Line 70
```python
        start += chunk_size - overlap
```
**What**: Move start position forward for next chunk.
**Math**:
- `chunk_size - overlap` = `400 - 100` = `300`
- Next chunk starts 300 characters ahead
- Creates 100-character overlap
**Example**:
```
Chunk 1: chars [0:400]
start moves to 300
Chunk 2: chars [300:700]  (300-400 overlaps with chunk 1)
```

#### Line 72
```python
    return chunks
```
**What**: Return the list of chunk strings.

---

### Lines 75-87: Process Documents Function

#### Line 75
```python
def process_documents(documents: List[Tuple[str, str]]) -> List[Tuple[str, str, str]]:
```
**What**: Function to chunk all documents and add metadata.
**Input**: List of (filename, content) tuples
**Output**: List of (filename, chunk_id, chunk_text) tuples
**Why add chunk_id**: Track which chunk came from which part of document.

#### Line 76
```python
    """Process documents into chunks with metadata."""
```
**What**: Docstring.

#### Lines 77-78
```python
    print("Chunking documents...")
    all_chunks = []
```
**What**: Print status and initialize empty list for all chunks.

#### Line 80
```python
    for filename, content in documents:
```
**What**: Loop through each document tuple.
**Unpacking**: `(filename, content)` extracts both parts of tuple in one step.

#### Line 81
```python
        chunks = chunk_text(content, CHUNK_SIZE, CHUNK_OVERLAP)
```
**What**: Call chunk_text function to split this document's content.
**Returns**: List of text chunks for this document.

#### Line 82
```python
        for i, chunk in enumerate(chunks):
```
**What**: Loop through chunks with index.
**`enumerate()`**:
- Input: `["chunk a", "chunk b", "chunk c"]`
- Output: `[(0, "chunk a"), (1, "chunk b"), (2, "chunk c")]`
- `i` gets the index, `chunk` gets the text

#### Line 83
```python
            all_chunks.append((filename, f"chunk_{i}", chunk))
```
**What**: Create tuple with filename, chunk ID, and chunk text.
**Example**: `("project_info.txt", "chunk_0", "Green Valley Residences...")`
**Why chunk_id**: Later we can show which specific chunk matched the query.

#### Lines 84-87
```python
        print(f"  - {filename}: {len(chunks)} chunks created")
    print(f"Total chunks: {len(all_chunks)}\n")
    return all_chunks
```
**What**: Print per-file and total statistics, return all chunks.

---

### Lines 90-99: Generate Embeddings Function

#### Line 91
```python
def generate_embeddings(chunks: List[Tuple[str, str, str]]) -> np.ndarray:
```
**What**: Function to convert text chunks into numerical vectors.
**Input**: List of (filename, chunk_id, text) tuples
**Output**: NumPy array of shape `(n_chunks, 384)` where 384 is embedding dimension
**Why np.ndarray**: FAISS requires this format.

#### Line 92
```python
    """Generate embeddings for all chunks using local model."""
```
**What**: Docstring.

#### Line 93
```python
    print("Generating embeddings (this may take a moment)...")
```
**What**: Inform user this might take a few seconds.

#### Line 95
```python
    texts = [chunk[2] for chunk in chunks]  # Extract text from tuples
```
**What**: List comprehension to extract just the text (3rd element, index 2).
**Input**: `[("file1", "chunk_0", "text1"), ("file1", "chunk_1", "text2")]`
**Output**: `["text1", "text2"]`
**Why**: embedding_model.encode() expects list of strings.

#### Line 96
```python
    embeddings = embedding_model.encode(texts, show_progress_bar=True)
```
**What**: Convert all texts to embeddings in one batch.
**How it works**:
1. Model processes each text through neural network
2. Outputs 384-dimensional vector per text
3. Returns NumPy array of shape `(len(texts), 384)`
**show_progress_bar**: Shows progress during encoding.
**Speed**: ~100-1000 texts per second depending on CPU.

#### Line 98
```python
    print(f"Generated {len(embeddings)} embeddings of dimension {embeddings.shape[1]}\n")
```
**What**: Print summary.
**Output example**: `Generated 15 embeddings of dimension 384`
**`embeddings.shape`**: NumPy attribute giving (rows, columns).

#### Line 99
```python
    return embeddings
```
**What**: Return the NumPy array of embeddings.

---

### Lines 102-112: Create Vector Store Function

#### Line 103
```python
def create_vector_store(embeddings: np.ndarray) -> faiss.IndexFlatL2:
```
**What**: Function to create FAISS index and add embeddings.
**Input**: NumPy array of embeddings
**Output**: FAISS index object (searchable database)
**IndexFlatL2**: Specific type of FAISS index using L2 (Euclidean) distance.

#### Line 104
```python
    """Create and populate FAISS vector store."""
```
**What**: Docstring.

#### Line 105
```python
    print("Creating FAISS vector store...")
```
**What**: Status message.

#### Line 107
```python
    dimension = embeddings.shape[1]
```
**What**: Get embedding dimension (384 for all-MiniLM-L6-v2).
**Why needed**: FAISS index must know vector dimensionality upfront.

#### Line 108
```python
    index = faiss.IndexFlatL2(dimension)  # L2 distance (Euclidean)
```
**What**: Create FAISS index using L2 distance metric.
**IndexFlatL2**:
- "Flat" = brute-force search (checks all vectors)
- "L2" = Euclidean distance metric
- Guarantees 100% accurate results
- Fast for <1M vectors
**Alternatives**: IndexIVFFlat (faster but approximate), IndexHNSW (graph-based).

#### Line 109
```python
    index.add(embeddings.astype('float32'))
```
**What**: Add all embeddings to the index.
**`astype('float32')`**: Convert to 32-bit floats (FAISS requirement).
**What happens**: FAISS stores vectors in optimized data structure.

#### Lines 111-112
```python
    print(f"Vector store created with {index.ntotal} vectors\n")
    return index
```
**What**: Print count and return the index.
**`index.ntotal`**: FAISS attribute giving total stored vectors.

---

### Lines 115-137: Semantic Search Function

#### Lines 116-121
```python
def search_similar_chunks(
    query: str,
    index: faiss.IndexFlatL2,
    chunks: List[Tuple[str, str, str]],
    top_k: int
) -> List[Tuple[str, str, str, float]]:
```
**What**: Function to find most similar chunks to a query.
**Parameters**:
- `query`: User's question (string)
- `index`: FAISS vector database
- `chunks`: Original chunk data (for retrieving text)
- `top_k`: How many results to return (3)
**Returns**: List of (filename, chunk_id, text, similarity_score) tuples.

#### Line 122
```python
    """Search for most similar chunks to the query."""
```
**What**: Docstring.

#### Lines 124-125
```python
    # Generate query embedding
    query_embedding = embedding_model.encode([query])
```
**What**: Convert query into same 384-dimensional space as chunks.
**Input**: `["What is the price?"]` (must be a list)
**Output**: NumPy array of shape `(1, 384)`
**Why same model**: Query and documents must be in same embedding space!

#### Line 127-128
```python
    # Search in FAISS
    distances, indices = index.search(query_embedding.astype('float32'), top_k)
```
**What**: Search index for top_k nearest neighbors.
**How it works**:
1. FAISS computes distance from query to every stored vector
2. Returns the k smallest distances
3. Also returns indices of those vectors
**Returns**:
- `distances`: Array of shape `(1, top_k)` with distance values
- `indices`: Array of shape `(1, top_k)` with indices of closest vectors
**Example**:
```
distances = [[0.523, 0.891, 1.234]]
indices = [[5, 12, 3]]  # Chunks at positions 5, 12, 3 are most similar
```

#### Lines 130-135
```python
    # Retrieve chunks with similarity scores
    results = []
    for i, idx in enumerate(indices[0]):
        filename, chunk_id, text = chunks[idx]
        similarity_score = 1 / (1 + distances[0][i])  # Convert distance to similarity
        results.append((filename, chunk_id, text, similarity_score))
```
**What**: Build result list with chunk data and scores.
**`indices[0]`**: Get first (only) row of results array.
**`chunks[idx]`**: Retrieve original chunk tuple using index.
**Similarity conversion**:
- Distance 0 (identical) → similarity 1.0 (100%)
- Distance 1 → similarity 0.5 (50%)
- Distance 10 → similarity 0.09 (9%)
**Formula**: `1 / (1 + d)` where d is distance.

#### Line 137
```python
    return results
```
**What**: Return list of results.

---

### Lines 140-163: Generate Answer Function

#### Line 141
```python
def generate_answer(query: str, relevant_chunks: List[Tuple[str, str, str, float]]) -> str:
```
**What**: Function to generate final answer using Gemini API.
**Input**:
- `query`: User's question
- `relevant_chunks`: Retrieved chunks with scores
**Output**: Answer string from Gemini.

#### Line 142
```python
    """Generate answer using Gemini API with retrieved context."""
```
**What**: Docstring.

#### Lines 144-148
```python
    # Prepare context from retrieved chunks
    context = "\n\n".join([
        f"[Source: {filename}]\n{text}"
        for filename, _, text, _ in relevant_chunks
    ])
```
**What**: Combine all chunks into one context string.
**List comprehension**: Iterate through chunks and format each.
**`_` (underscore)**: Ignore chunk_id and score (don't need them here).
**`"\n\n".join()`**: Join list with double newlines between items.
**Example output**:
```
[Source: project_info.txt]
Green Valley Residences is a premium...

[Source: amenities.txt]
Our project offers world-class amenities...

[Source: faq.txt]
Q: What is the payment plan?
```

#### Lines 150-159
```python
    # Create prompt with context
    prompt = f"""You are a helpful real estate assistant. Answer the question based on the context provided below.
If the answer cannot be found in the context, say "I don't have that information in my knowledge base."

Context:
{context}

Question: {query}

Answer:"""
```
**What**: Create prompt for Gemini with instructions, context, and question.
**Structure**:
1. System instruction (role definition)
2. Fallback instruction (what to say if no answer)
3. Context (retrieved chunks)
4. Question (user query)
5. "Answer:" (prompt completion)
**Why this format**: Guides LLM to use only provided context.

#### Lines 161-163
```python
    # Generate response using Gemini
    response = gemini_model.generate_content(prompt)
    return response.text
```
**What**: Send prompt to Gemini API and return response text.
**`generate_content()`**: Gemini API call.
**`.text`**: Extract text from response object.
**Happens**:
1. Prompt sent to Google's servers
2. Gemini processes with GPT-level model
3. Returns generated answer
4. Takes ~1-3 seconds

---

### Lines 166-193: Main RAG Pipeline Function

#### Line 167
```python
def rag_query(query: str, index, chunks):
```
**What**: Orchestrate entire RAG process for one query.
**Purpose**: Combines search + generation into single function.

#### Lines 169-171
```python
    print(f"\n{'='*80}")
    print(f"QUERY: {query}")
    print(f"{'='*80}\n")
```
**What**: Print formatted header.
**`'='*80`**: Creates string of 80 equal signs.
**Output**:
```
================================================================================
QUERY: What is the price of 3BHK?
================================================================================
```

#### Lines 173-175
```python
    # Step 1: Retrieve relevant chunks
    print("Searching for relevant information...")
    relevant_chunks = search_similar_chunks(query, index, chunks, TOP_K)
```
**What**: Call semantic search function to find relevant chunks.

#### Lines 177-181
```python
    # Display retrieved chunks
    print("\nRetrieved Chunks:")
    for i, (filename, chunk_id, text, score) in enumerate(relevant_chunks, 1):
        print(f"\n  [{i}] {filename} ({chunk_id}) - Similarity: {score:.3f}")
        print(f"      {text[:150]}..." if len(text) > 150 else f"      {text}")
```
**What**: Show user which chunks were retrieved and their scores.
**`enumerate(relevant_chunks, 1)`**: Start counting from 1 instead of 0.
**`score:.3f`**: Format score to 3 decimal places (0.856).
**Ternary**: If text > 150 chars, show first 150 + "...", else show all.

#### Lines 183-185
```python
    # Step 2: Generate answer
    print("\n\nGenerating answer using Gemini API...")
    answer = generate_answer(query, relevant_chunks)
```
**What**: Call answer generation function.

#### Lines 187-191
```python
    print("\n" + "="*80)
    print("ANSWER:")
    print("="*80)
    print(answer)
    print("="*80 + "\n")
```
**What**: Display formatted answer.

#### Line 193
```python
    return answer
```
**What**: Return answer (in case caller wants to store it).

---

### Lines 196-226: Main Execution

#### Line 197
```python
if __name__ == "__main__":
```
**What**: Only run this code if script is executed directly (not imported).
**Why**: Allows others to import functions without running the test queries.

#### Lines 198-208
```python
    # Step 1: Load documents
    documents = load_documents(DOCUMENTS_PATH)
    # Step 2: Chunk documents
    chunks = process_documents(documents)
    # Step 3: Generate embeddings
    embeddings = generate_embeddings(chunks)
    # Step 4: Create vector store
    vector_store = create_vector_store(embeddings)
```
**What**: Execute the 4 setup steps in order.
**Result**: RAG system is ready to answer queries.

#### Lines 210-212
```python
    print("\n" + "="*80)
    print("RAG SYSTEM READY!")
    print("="*80 + "\n")
```
**What**: Confirm system is initialized.

#### Lines 214-220
```python
    # Test queries
    test_queries = [
        "What is the price of 3BHK apartment?",
        "What amenities are available?",
        "Is there a swimming pool?",
        "What is the payment plan?",
    ]
```
**What**: Define list of test questions.
**Purpose**: Demonstrate RAG capabilities automatically.

#### Lines 222-225
```python
    print("Running test queries...\n")
    for query in test_queries:
        rag_query(query, vector_store, chunks)
        input("\nPress Enter to continue to next query...")
```
**What**: Loop through queries and process each.
**`input()`**: Wait for user to press Enter before next query.
**Why**: Gives user time to read results.

---

## Why all-MiniLM-L6-v2 Embedding Model?

### What is all-MiniLM-L6-v2?

**Full Name**: All-domain MiniLM Layer 6 Version 2

**Developer**: Microsoft Research (based on their MiniLM paper)

**Available**: Free on HuggingFace Hub

### Technical Specifications

| Specification | Value | Explanation |
|---------------|-------|-------------|
| **Model Type** | Transformer (BERT-based) | Neural network architecture for understanding text |
| **Parameters** | 22.7 million | Relatively small (GPT-3 has 175 billion) |
| **Embedding Dimension** | 384 | Each text becomes a 384-number vector |
| **Max Input Length** | 256 word pieces (~200 words) | Longer texts get truncated |
| **Training Data** | 1+ billion sentence pairs | From web, books, Wikipedia, Q&A sites |
| **Model Size** | ~80MB download | Tiny compared to most models |
| **Speed** | ~1000 sentences/sec on CPU | Very fast for embedding generation |

### Why This Model?

#### 1. **Performance vs. Size Trade-off**

**Benchmarks** (on STSB similarity task):
- all-MiniLM-L6-v2: **82.41%** accuracy (what we use)
- all-MiniLM-L12-v2: 83.42% accuracy (2x slower, only 1% better)
- all-mpnet-base-v2: 86.31% accuracy (3x slower, 4% better)
- text-embedding-ada-002 (OpenAI): 88%+ (API costs money)

**Conclusion**: Best balance of speed and accuracy for learning.

#### 2. **Runs Locally**

**Advantages**:
- No API costs
- No internet required after first download
- No rate limits
- Data privacy (text never leaves your computer)
- Instant results (no network latency)

**Comparison**:
```
OpenAI ada-002 embeddings:
- $0.02 per 1 million tokens
- ~1000 tokens = 750 words
- Our 3 documents = ~3000 tokens
- Cost: ~$0.00006 per run (tiny, but adds up)
- Requires internet

all-MiniLM-L6-v2:
- $0.00 per run
- Works offline
```

#### 3. **Fast on CPU**

**Speed Comparison** (1000 sentences):
- all-MiniLM-L6-v2 (6 layers): **1 second** on CPU
- all-MiniLM-L12-v2 (12 layers): 2 seconds on CPU
- all-mpnet-base-v2: 3 seconds on CPU
- BERT-large: 10+ seconds on CPU

**Why it matters**:
- No GPU required
- Fast enough for real-time applications
- Can re-embed entire knowledge base quickly

#### 4. **Good Semantic Understanding**

**What it understands**:
- Synonyms: "car" ≈ "automobile" ≈ "vehicle"
- Paraphrases: "What's the cost?" ≈ "How much does it cost?" ≈ "What is the price?"
- Context: "bank" (financial) vs "bank" (river side)

**Example**:
```python
Query: "How expensive are 3-bedroom units?"
Matches chunks containing:
- "3BHK apartments cost..."
- "Pricing for three-bedroom..."
- "3BHK units start at Rs..."
```
Even though query words differ from document words!

#### 5. **Widely Used & Tested**

**Statistics**:
- 500+ million downloads on HuggingFace
- Used in production by major companies
- Extensive documentation and examples
- Actively maintained

#### 6. **Domain Agnostic**

**"All" in name means**:
- Trained on diverse domains (medical, legal, technical, casual)
- Works for any topic without fine-tuning
- No need for specialized models

**Works for**:
- Real estate (our example)
- Legal documents
- Medical records
- Customer support
- Code documentation

### Alternatives Considered

| Model | Pros | Cons | When to Use |
|-------|------|------|-------------|
| **all-MiniLM-L6-v2** ✓ | Fast, accurate enough, free | Less accurate than larger models | Learning, prototypes, production with <100k docs |
| **all-mpnet-base-v2** | More accurate (+4%) | 3x slower, 120MB | Production with accuracy priority |
| **OpenAI ada-002** | Most accurate, hosted | Costs money, requires internet | Enterprise, budget available |
| **multi-qa-MiniLM-L6** | Optimized for Q&A | Slightly slower | Q&A specific applications |
| **paraphrase-MiniLM-L3** | Ultra fast | Less accurate (-3%) | Real-time applications, millions of docs |

### When to Upgrade

**Use a better model if**:
- Accuracy < 80% in your tests
- Budget allows API costs
- Have GPU for faster inference
- Documents are very domain-specific

**Stick with all-MiniLM-L6-v2 if**:
- Learning RAG concepts ✓
- Prototyping quickly ✓
- <100k documents ✓
- CPU-only environment ✓
- No budget for APIs ✓

---

## Why Run Embeddings Locally?

### What Does "Local" Mean?

**Local**: Model runs on your computer's CPU/RAM, not in the cloud.

**Process**:
1. Model files downloaded once to `~/.cache/torch/sentence_transformers/`
2. Model loaded into RAM (~120MB)
3. Text processing happens on your CPU
4. No internet needed after first download

### Advantages of Local Embeddings

#### 1. **Zero Cost**

**Cloud Embedding Costs** (as of 2026):
- OpenAI text-embedding-3-small: $0.02 per 1M tokens
- OpenAI text-embedding-ada-002: $0.10 per 1M tokens
- Cohere embed-english-v3: $0.10 per 1M tokens
- Google Vertex AI: $0.025 per 1M characters

**Our 3 Sample Documents**:
- Total characters: ~3,500
- Total tokens: ~875
- Chunked into 15 pieces
- Embedded 15 times

**Cost with OpenAI**:
- $0.02 / 1,000,000 tokens × 875 tokens = $0.0000175
- Per run: $0.00002 (tiny!)
- 1000 runs: $0.02
- 100,000 runs: $2.00

**Cost with local model**:
- $0.00 forever
- Unlimited runs

**Seems small, but**:
- Production apps: millions of embeddings
- Re-embedding entire knowledge base: expensive
- Budget predictability: local = $0

#### 2. **No Internet Required**

**After initial download**:
- Model cached locally
- Works offline completely
- No network latency
- No API timeouts
- No rate limit errors

**Use cases**:
- Airplane coding
- Remote locations
- Air-gapped systems
- Secure environments

#### 3. **Privacy & Security**

**With cloud APIs**:
- Your text sent to external servers
- Potentially logged for training
- Subject to terms of service
- Could contain sensitive info

**With local embeddings**:
- Text never leaves your machine
- No data transmission
- No third-party access
- GDPR/HIPAA friendly

**Critical for**:
- Medical records
- Legal documents
- Proprietary business data
- Personal information

#### 4. **Speed**

**Network latency eliminated**:
```
Cloud Embedding:
- Network request: 50-200ms
- Processing: 50ms
- Network response: 50-200ms
- Total: 150-450ms per batch

Local Embedding:
- Processing: 10-50ms per batch
- Network: 0ms
- Total: 10-50ms per batch
```

**Real-world impact**:
- 1000 documents embedded:
  - Cloud: 150+ seconds (with batching)
  - Local: 10-30 seconds
- Interactive applications feel instant

#### 5. **No Rate Limits**

**Cloud API limits** (typical):
- 3,000 requests/minute
- 1M tokens/minute
- Hard cutoff when exceeded

**Local model**:
- Limited only by CPU/RAM
- Process millions of texts
- No throttling
- Burst capacity = continuous capacity

#### 6. **Predictable Performance**

**Cloud issues**:
- API downtime (rare but happens)
- "Model deprecated, migrate by..."
- Pricing changes
- Terms of service changes
- Geographic restrictions

**Local model**:
- Works forever (saved on disk)
- No deprecation
- No vendor lock-in
- Same performance always

#### 7. **Development Workflow**

**Easier iteration**:
```python
# Can run this 1000 times during development
embeddings = model.encode(texts)  # Local: instant
# vs.
embeddings = openai.embed(texts)  # Cloud: costs add up
```

**CI/CD friendly**:
- Tests run offline
- No API keys in test environment
- Faster test suites
- Reproducible builds

### Disadvantages of Local Embeddings

#### 1. **Accuracy Trade-off**

**Quality hierarchy**:
```
OpenAI ada-003:     ████████████ 95% (cloud)
OpenAI ada-002:     ███████████░ 92% (cloud)
Cohere embed:       ██████████░░ 87% (cloud)
all-mpnet-base-v2:  █████████░░░ 86% (local)
all-MiniLM-L6-v2:   ████████░░░░ 82% (local) ← we use this
```

**When this matters**:
- Nuanced queries requiring deep understanding
- Multilingual applications (local models often English-focused)
- Domain-specific jargon not in training data

**When this doesn't matter**:
- 82% is "good enough" for most applications
- Difference noticeable mainly in edge cases
- Can compensate with better chunking strategy

#### 2. **Resource Usage**

**System requirements**:
- RAM: 120MB for model + 50-200MB for processing
- CPU: Utilizes all cores during encoding
- Disk: 80MB for model files

**Impact**:
- CPU spikes during embedding
- May slow down other processes temporarily
- Not ideal for very resource-constrained environments

**Comparison**:
- Cloud API: Your server only sends/receives JSON (KB)
- Local: Full neural network inference (MB)

#### 3. **Startup Time**

**First run**:
```python
model = SentenceTransformer("all-MiniLM-L6-v2")
# First time: Downloads 80MB (~10-30 seconds)
# Subsequent runs: Loads from cache (instant)
```

**In production**:
- Model loaded once at app startup
- Stays in RAM during app lifetime
- No reload needed

#### 4. **Model Updates**

**Cloud APIs**:
- Automatic improvements
- "We upgraded ada-002 → ada-003"
- You get benefits instantly

**Local models**:
- Must manually check for new versions
- Download and switch manually
- More control, less automatic improvement

### Hybrid Approach

**Best of both worlds**:

```python
class EmbeddingService:
    def __init__(self):
        # Try local first
        try:
            self.local_model = SentenceTransformer("all-MiniLM-L6-v2")
            self.use_local = True
        except:
            self.use_local = False

    def embed(self, texts):
        if self.use_local:
            return self.local_model.encode(texts)
        else:
            return openai_embed(texts)  # Fallback to cloud
```

**Strategy**:
- Development: Always local (fast iteration)
- Production: Local by default, cloud for critical queries
- Staging: Test both to compare accuracy

---

## Why FAISS Vector Database?

### What is FAISS?

**Full Name**: Facebook AI Similarity Search

**Developer**: Meta AI Research (formerly Facebook AI)

**Purpose**: Search for similar items in high-dimensional vector spaces

**Release**: 2017, open-source

**Written in**: C++ (with Python bindings)

### The Problem FAISS Solves

**Naive similarity search**:
```python
# Find most similar vectors to query
def naive_search(query_vector, all_vectors, k=3):
    distances = []
    for vector in all_vectors:
        distance = calculate_distance(query_vector, vector)
        distances.append(distance)
    return sorted(distances)[:k]
```

**Problems**:
1. **Slow**: Must check every vector
2. **Doesn't scale**: 1M vectors = 1M distance calculations
3. **Memory intensive**: All vectors in RAM

**Time complexity**: O(n × d)
- n = number of vectors (can be millions)
- d = dimension (384 for our embeddings)

**Example**:
- 1,000 vectors: 0.1 seconds ✓
- 10,000 vectors: 1 second ✓
- 100,000 vectors: 10 seconds ✗
- 1,000,000 vectors: 100 seconds ✗✗

### How FAISS Solves This

**Optimization techniques**:
1. **Vectorized operations** (SIMD instructions)
2. **Efficient memory layout**
3. **Index structures** (clustering, graphs, etc.)
4. **GPU acceleration** (optional)

**Result**:
- 1,000,000 vectors: 0.001-0.1 seconds depending on index type

### FAISS Index Types

#### 1. IndexFlatL2 (What We Use)

**Description**: Brute-force exact search with L2 distance.

**How it works**:
- Stores all vectors in contiguous memory
- Computes L2 distance to every vector
- Uses SIMD for parallel computation
- Returns exact k nearest neighbors

**Characteristics**:
- **Speed**: Fast for <1M vectors
- **Accuracy**: 100% (exact search)
- **Memory**: n × d × 4 bytes (float32)
- **Build time**: Instant (just stores vectors)

**When to use**:
- <1M vectors (our case: 15 vectors!)
- Need 100% accuracy
- Simple to use
- Learning/prototyping

**Formula**: L2 distance = √(Σ(q_i - v_i)²)

**Example**:
```python
index = faiss.IndexFlatL2(384)  # 384 dimensions
index.add(embeddings)            # Add all vectors
distances, indices = index.search(query, k=3)  # Find top 3
```

#### 2. IndexIVFFlat (Faster, Approximate)

**Description**: Inverted file index with flat quantization.

**How it works**:
1. Cluster vectors into n groups (using k-means)
2. Search only nearest clusters
3. Brute-force within those clusters

**Characteristics**:
- **Speed**: 10-100x faster than Flat
- **Accuracy**: 90-99% (configurable)
- **Memory**: Same as Flat
- **Build time**: Requires training (k-means)

**When to use**:
- 100k-10M vectors
- Can tolerate slight inaccuracy
- Need speed over perfection

**Code**:
```python
quantizer = faiss.IndexFlatL2(384)
index = faiss.IndexIVFFlat(quantizer, 384, 100)  # 100 clusters
index.train(embeddings)  # Cluster vectors
index.add(embeddings)
index.nprobe = 10  # Search 10 nearest clusters
```

#### 3. IndexHNSW (Graph-based)

**Description**: Hierarchical Navigable Small World graph.

**How it works**:
1. Build graph where similar vectors are connected
2. Navigate graph from entry point to target
3. Uses hierarchical layers for speed

**Characteristics**:
- **Speed**: Very fast, even for billions of vectors
- **Accuracy**: 95-99%
- **Memory**: 1.5-2x more than Flat (stores graph)
- **Build time**: Slower to build

**When to use**:
- 1M-1B vectors
- High QPS (queries per second)
- Production systems

**Code**:
```python
index = faiss.IndexHNSWFlat(384, 32)  # 32 = graph connectivity
index.add(embeddings)
```

#### 4. IndexPQ (Product Quantization)

**Description**: Compresses vectors to save memory.

**How it works**:
1. Split vector into sub-vectors
2. Quantize each sub-vector (lossy compression)
3. Store small codes instead of full vectors

**Characteristics**:
- **Speed**: Fast
- **Accuracy**: 80-95%
- **Memory**: 32-128 bytes per vector (vs 384×4=1536)
- **Compression**: 10-50x smaller

**When to use**:
- Memory-constrained environments
- Billions of vectors
- Accuracy less critical

### Why IndexFlatL2 for Learning?

#### 1. **Simplicity**

**No configuration needed**:
```python
# Just 3 lines!
index = faiss.IndexFlatL2(dimension)
index.add(embeddings)
distances, indices = index.search(query, k)
```

**vs. complex indexes**:
```python
# Requires training, tuning, trade-offs
quantizer = faiss.IndexFlatL2(dimension)
index = faiss.IndexIVFPQ(quantizer, dimension, n_clusters, m, nbits)
index.train(training_data)  # Need separate training set
index.nprobe = optimal_value  # Tune this
index.add(embeddings)
```

#### 2. **100% Accuracy**

**Exact search**:
- Always returns the true k nearest neighbors
- No approximation errors
- Deterministic results

**Why this matters for learning**:
- Understand "ground truth" behavior
- Debug RAG pipeline easily
- No "is it the index or my embeddings?" confusion

#### 3. **Fast Enough**

**Our scale**:
- 15 chunks (tiny!)
- IndexFlatL2: <1ms per query
- No need for optimization

**When to upgrade**:
```
<1,000 vectors:     IndexFlatL2 (what we use)
1k-100k vectors:    IndexFlatL2 or IndexHNSW
100k-1M vectors:    IndexHNSW
1M-10M vectors:     IndexIVFFlat or IndexHNSW
10M+ vectors:       IndexHNSW + PQ compression
```

#### 4. **No Training Required**

**Flat indexes**:
- No pre-processing
- No training data needed
- Add vectors anytime

**Clustered indexes**:
- Must train on representative data
- Re-train if data distribution changes
- More complex workflow

#### 5. **Educational Value**

**Shows RAG fundamentals**:
- What is vector similarity?
- How does semantic search work?
- Why do these chunks match my query?

**Without complexity of**:
- Approximation algorithms
- Index parameter tuning
- Accuracy vs. speed trade-offs

### FAISS Performance Benchmarks

**Test**: 1 million 384-dimensional vectors

| Index Type | Build Time | Memory | Query Time (k=10) | Accuracy |
|------------|------------|--------|-------------------|----------|
| IndexFlatL2 | 0s | 1.4GB | 180ms | 100.0% |
| IndexIVFFlat (4096 clusters) | 120s | 1.4GB | 2ms | 99.5% |
| IndexHNSW (M=32) | 450s | 2.8GB | 0.5ms | 99.9% |
| IndexPQ (m=64) | 150s | 180MB | 3ms | 92.0% |
| IndexIVFPQ | 180s | 200MB | 1ms | 88.0% |

**Takeaways**:
- Flat is slow at 1M scale (but perfect for <10k)
- HNSW is best for high QPS
- PQ variants save memory but lose accuracy

### Why Not Other Vector DBs?

**Alternatives**:
1. **Pinecone** (cloud, managed)
2. **Weaviate** (self-hosted, feature-rich)
3. **Qdrant** (Rust-based, fast)
4. **ChromaDB** (simple, Python)
5. **Milvus** (enterprise-scale)

**Why FAISS for learning**:

| Feature | FAISS | Pinecone | Weaviate | Qdrant | ChromaDB |
|---------|-------|----------|----------|--------|----------|
| **Runs locally** | ✓ | ✗ (cloud) | ✓ | ✓ | ✓ |
| **No server setup** | ✓ | ✓ | ✗ | ✗ | ✓ |
| **Free** | ✓ | $ | ✓ | ✓ | ✓ |
| **Production-grade** | ✓ | ✓ | ✓ | ✓ | Growing |
| **Simplest code** | ✓ | Simple | Medium | Medium | ✓ |
| **Learning-friendly** | ✓ | ✗ | Medium | Medium | ✓ |

**FAISS advantages**:
- Pure Python library (pip install)
- No server/daemon required
- Battle-tested (Meta uses in production)
- Extensive documentation
- Industry standard

**When to use alternatives**:
- **Pinecone**: Production, don't want to manage infrastructure
- **Weaviate**: Need full-text search + vector search
- **Qdrant**: Need REST API, filtering, multi-tenancy
- **ChromaDB**: Very simple projects, embeddings + metadata

### FAISS in Production

**Who uses FAISS**:
- Meta (obviously)
- Spotify (music recommendations)
- Pinterest (image search)
- Snapchat (content discovery)
- Many startups (RAG applications)

**Scale achieved**:
- Billions of vectors
- Millions of queries per second
- <10ms latency at scale

**Production setup**:
```python
# Save index to disk
faiss.write_index(index, "vectors.index")

# Load in production
index = faiss.read_index("vectors.index")

# GPU acceleration
gpu_index = faiss.index_cpu_to_gpu(gpu_resources, 0, cpu_index)
```

---

## How RAG Works (Step by Step)

Let's trace a full query through the system:

### Example Query: "What is the price of 3BHK apartment?"

#### Step 1: Load Documents (Happens Once at Startup)

```python
documents = load_documents("./sample_documents")
```

**Files loaded**:
1. `project_info.txt` (1523 chars)
2. `amenities.txt` (1145 chars)
3. `faq.txt` (1387 chars)

**Output**:
```
Loading documents from ./sample_documents...
  - Loaded: project_info.txt (1523 chars)
  - Loaded: amenities.txt (1145 chars)
  - Loaded: faq.txt (1387 chars)
Total documents loaded: 3
```

#### Step 2: Chunk Documents

```python
chunks = process_documents(documents)
```

**Processing project_info.txt**:
```
Original: 1523 chars
Chunks created: 4

Chunk 0 [0:400]:
"Green Valley Residences is a premium residential project located in the heart of the city. The project spans across 5 acres and offers 2BHK, 3BHK, and 4BHK luxury apartments.

Project Highlights:
- Total Units: 200 apartments
- Configuration: 2BHK (900 sq ft), 3BHK (1400 sq ft), 4BHK (2000 sq ft)
- Location: Whitefield, Bangalore
..."

Chunk 1 [300:700] (overlaps 100 chars with chunk 0):
"...
- Configuration: 2BHK (900 sq ft), 3BHK (1400 sq ft), 4BHK (2000 sq ft)
- Location: Whitefield, Bangalore
- Possession Date: December 2026
- Builder: Green Valley Constructions Pvt Ltd
- RERA Registration: KA/RERA/2024/001234

The project is designed by award-winning architects..."
```

**Total**: 15 chunks across all documents

#### Step 3: Generate Embeddings

```python
embeddings = generate_embeddings(chunks)
```

**For chunk 0**:
```
Text: "Green Valley Residences is a premium residential project..."

Embedding process:
1. Tokenize: ["Green", "Valley", "Residences", "is", "a", ...]
2. Pass through neural network (6 transformer layers)
3. Pool outputs to single 384-dimensional vector

Result: [0.042, -0.123, 0.891, ..., 0.234]  (384 numbers)
          ↑       ↑       ↑           ↑
     dimension 0  1       2         383
```

**Semantic meaning encoded**:
- Numbers close to 0: Feature not present
- Positive numbers: Feature present
- Negative numbers: Opposite feature present

**All 15 chunks → 15 embeddings**:
```
embeddings.shape = (15, 384)
```

#### Step 4: Create FAISS Index

```python
vector_store = create_vector_store(embeddings)
```

**What happens**:
```
Memory layout:
[
  [0.042, -0.123, 0.891, ..., 0.234],  ← chunk 0 embedding
  [0.123,  0.456, -0.789, ..., 0.111],  ← chunk 1 embedding
  ...
  [-0.234, 0.567, 0.432, ..., -0.654]   ← chunk 14 embedding
]

Stored in optimized format for fast search
```

**Vector store ready** with 15 vectors

#### Step 5: Query Processing

```python
query = "What is the price of 3BHK apartment?"
```

**Convert query to embedding**:
```python
query_embedding = embedding_model.encode([query])
# Result: [0.034, -0.234, 0.765, ..., 0.123]
```

**Same embedding space as chunks!**

#### Step 6: Semantic Search

```python
distances, indices = index.search(query_embedding, top_k=3)
```

**FAISS computes distances**:
```
Query embedding vs. all 15 chunk embeddings:

Chunk 0 distance: 1.234 (far)
Chunk 1 distance: 0.523 (close!) ← Top 1
Chunk 2 distance: 2.456 (far)
Chunk 3 distance: 0.891 (medium)
Chunk 4 distance: 3.123 (very far)
Chunk 5 distance: 0.678 (close) ← Top 2
Chunk 6 distance: 1.987 (far)
Chunk 7 distance: 0.734 (close) ← Top 3
...
Chunk 14 distance: 2.789 (far)
```

**Returns**:
```python
indices = [[1, 5, 7]]      # Top 3 chunk IDs
distances = [[0.523, 0.678, 0.734]]  # Their distances
```

#### Step 7: Retrieve Chunks

```python
relevant_chunks = [
    ("project_info.txt", "chunk_1", "Pricing starts at Rs 65 lakhs for 2BHK, Rs 95 lakhs for 3BHK, and Rs 1.4 crores for 4BHK...", 0.656),
    ("faq.txt", "chunk_2", "Q: What is included in the price? A: The quoted price includes basic apartment cost...", 0.596),
    ("project_info.txt", "chunk_0", "Configuration: 2BHK (900 sq ft), 3BHK (1400 sq ft), 4BHK (2000 sq ft)...", 0.576)
]
```

**Similarity scores**: 1 / (1 + distance)

**Display to user**:
```
Retrieved Chunks:
  [1] project_info.txt (chunk_1) - Similarity: 0.656
      Pricing starts at Rs 65 lakhs for 2BHK, Rs 95 lakhs for 3BHK...

  [2] faq.txt (chunk_2) - Similarity: 0.596
      Q: What is included in the price? A: The quoted price includes...

  [3] project_info.txt (chunk_0) - Similarity: 0.576
      Configuration: 2BHK (900 sq ft), 3BHK (1400 sq ft)...
```

#### Step 8: Build Context

```python
context = """
[Source: project_info.txt]
Pricing starts at Rs 65 lakhs for 2BHK, Rs 95 lakhs for 3BHK, and Rs 1.4 crores for 4BHK apartments. Special launch offers are available with discounts up to 10% for early bookings.

[Source: faq.txt]
Q: What is included in the price?
A: The quoted price includes basic apartment cost. Additional charges include registration (as per government norms), maintenance deposit (Rs 50 per sq ft), and preferred floor charges if applicable (1-3% extra for higher floors).

[Source: project_info.txt]
- Configuration: 2BHK (900 sq ft), 3BHK (1400 sq ft), 4BHK (2000 sq ft)
- Location: Whitefield, Bangalore
- Possession Date: December 2026
"""
```

#### Step 9: Create Prompt for Gemini

```python
prompt = """You are a helpful real estate assistant. Answer the question based on the context provided below.
If the answer cannot be found in the context, say "I don't have that information in my knowledge base."

Context:
[Source: project_info.txt]
Pricing starts at Rs 65 lakhs for 2BHK, Rs 95 lakhs for 3BHK, and Rs 1.4 crores for 4BHK apartments...

[Source: faq.txt]
Q: What is included in the price?...

[Source: project_info.txt]
- Configuration: 2BHK (900 sq ft), 3BHK (1400 sq ft)...

Question: What is the price of 3BHK apartment?

Answer:"""
```

#### Step 10: Generate Answer with Gemini

```python
response = gemini_model.generate_content(prompt)
answer = response.text
```

**Gemini's response**:
```
The price of a 3BHK apartment in Green Valley Residences starts at Rs 95 lakhs.

The 3BHK units are 1400 sq ft in size. Please note that there are special launch offers available with discounts up to 10% for early bookings.

Additionally, the quoted price includes the basic apartment cost, but you should budget for additional charges including:
- Registration fees (as per government norms)
- Maintenance deposit (Rs 50 per sq ft)
- Preferred floor charges if applicable (1-3% extra for higher floors)
```

**Why this answer is good**:
- Directly answers the question (Rs 95 lakhs)
- Provides relevant context (size, location)
- Mentions discounts (from retrieved context)
- Includes additional costs (from FAQ chunk)
- Well-structured and complete

#### Step 11: Display Result

```
================================================================================
ANSWER:
================================================================================
The price of a 3BHK apartment in Green Valley Residences starts at Rs 95 lakhs.

The 3BHK units are 1400 sq ft in size. Please note that there are special launch offers available with discounts up to 10% for early bookings.

Additionally, the quoted price includes the basic apartment cost, but you should budget for additional charges including:
- Registration fees (as per government norms)
- Maintenance deposit (Rs 50 per sq ft)
- Preferred floor charges if applicable (1-3% extra for higher floors)
================================================================================
```

---

## Key Takeaways

### What You've Learned

1. **Every line of code** in simple_rag.py and why it exists
2. **Why all-MiniLM-L6-v2**: Fast, accurate enough, runs locally, free
3. **Why local embeddings**: Zero cost, privacy, speed, offline support
4. **Why FAISS**: Fast, simple, production-grade, perfect for learning
5. **How RAG works end-to-end**: From document to answer in 11 steps

### Next Steps

1. **Run the code** and observe each step
2. **Experiment** with parameters (chunk size, top-k, models)
3. **Add your own documents** and test custom queries
4. **Upgrade components** when ready:
   - Better embedding model (all-mpnet-base-v2)
   - Advanced FAISS index (IndexHNSW)
   - Cloud vector DB (Pinecone, Weaviate)
5. **Build production features**:
   - Document approval workflow
   - Analytics dashboard
   - WhatsApp integration
   - User feedback loop

---

## Questions & Debugging

### Common Issues

**Q: Embeddings take forever on first run**
- **A**: Downloading model (~80MB). Subsequent runs instant.

**Q: FAISS search returns wrong chunks**
- **A**: Check chunk size. Too large = imprecise retrieval.

**Q: Gemini gives wrong answer despite correct chunks**
- **A**: Improve prompt instructions or use more chunks (increase TOP_K).

**Q: Memory error when encoding**
- **A**: Reduce batch size or chunk count. Or upgrade RAM.

**Q: Query doesn't match expected chunks**
- **A**: Embeddings might not capture specific jargon. Try better embedding model or rephrase query.

### Performance Tuning

**Speed up embedding**:
```python
# Use GPU if available
model = SentenceTransformer(EMBEDDING_MODEL, device='cuda')

# Batch encode
embeddings = model.encode(texts, batch_size=32)
```

**Improve accuracy**:
```python
# Use better model
EMBEDDING_MODEL = "all-mpnet-base-v2"  # +4% accuracy

# Increase retrieval
TOP_K = 5  # More context for LLM

# Better chunking
CHUNK_SIZE = 600
CHUNK_OVERLAP = 150
```

**Save index to disk**:
```python
# After creating index
faiss.write_index(vector_store, "knowledge_base.index")

# Load later
vector_store = faiss.read_index("knowledge_base.index")
```

---

**End of Code Explanation Document**

You now understand every aspect of this RAG implementation!
