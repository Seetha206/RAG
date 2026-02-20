# Simple RAG Implementation

A minimal Retrieval Augmented Generation (RAG) system to understand how RAG works before building advanced features.

## What is RAG?

RAG (Retrieval Augmented Generation) enhances AI responses by:
1. **Retrieving** relevant information from your knowledge base
2. **Augmenting** the AI prompt with this context
3. **Generating** accurate answers grounded in your documents

This prevents hallucinations and ensures answers are based on your actual data.

## How It Works

```
Your Question
    ↓
Convert to Vector (Embedding)
    ↓
Search Similar Chunks in Vector DB (FAISS)
    ↓
Retrieve Top 3 Most Relevant Chunks
    ↓
Send Chunks + Question to Gemini API
    ↓
Get Accurate Answer
```

## Files Created

```
RAG/
├── simple_rag.py              # Main RAG implementation (~200 lines)
├── requirements.txt            # Python dependencies
├── .env.example               # API key template
├── sample_documents/          # Sample knowledge base
│   ├── project_info.txt      # Project details
│   ├── amenities.txt         # Amenities info
│   └── faq.txt               # Frequently asked questions
└── README_SIMPLE_RAG.md      # This file
```

## Setup Instructions

### Step 1: Install Dependencies

```bash
pip install -r requirements.txt
```

This installs:
- `google-generativeai` - For Gemini API
- `sentence-transformers` - Local embedding model (free!)
- `faiss-cpu` - Vector database (runs locally)
- `python-dotenv` - Environment variable management
- `numpy` - Numerical operations

### Step 2: Configure API Key

Your Gemini API key is already in `.env.example`. Rename it to `.env`:

```bash
mv .env.example .env
```

### Step 3: Run the RAG System

```bash
python simple_rag.py
```

## What Happens When You Run It

1. **Loads** 3 sample documents about a real estate project
2. **Chunks** them into ~400 character pieces with 100 char overlap
3. **Generates embeddings** using local model (all-MiniLM-L6-v2)
4. **Stores** embeddings in FAISS vector database
5. **Runs test queries** and shows:
   - Which chunks were retrieved
   - Similarity scores
   - Generated answer from Gemini

## Understanding the Output

For each query, you'll see:

```
QUERY: What is the price of 3BHK apartment?
================================================================================

Searching for relevant information...

Retrieved Chunks:
  [1] project_info.txt (chunk_1) - Similarity: 0.856
      Pricing starts at Rs 65 lakhs for 2BHK, Rs 95 lakhs for 3BHK...

  [2] faq.txt (chunk_0) - Similarity: 0.742
      Q: What is the payment plan? A: We offer flexible payment plans...

  [3] project_info.txt (chunk_0) - Similarity: 0.698
      Green Valley Residences is a premium residential project...

Generating answer using Gemini API...

================================================================================
ANSWER:
================================================================================
The price of a 3BHK apartment in Green Valley Residences starts at Rs 95 lakhs.
================================================================================
```

## Key Components Explained

### 1. Document Loading
Reads all `.txt` files from `sample_documents/` directory.

### 2. Text Chunking
Splits documents into smaller pieces (400 chars) with overlap (100 chars).
**Why?** LLMs have token limits, and smaller chunks give more precise retrieval.

### 3. Embeddings (Local)
Converts text to 384-dimensional vectors using `all-MiniLM-L6-v2`.
**Why local?** Free, fast, no API calls needed for embeddings.

### 4. FAISS Vector Store
Stores embeddings and enables fast similarity search.
**Why FAISS?** Industry standard, runs locally, no cloud setup needed.

### 5. Semantic Search
Finds top-k most similar chunks to your query using cosine similarity.

### 6. Answer Generation
Sends retrieved chunks + question to Gemini API for final answer.

## Experiment and Learn

Try modifying these parameters in `simple_rag.py`:

```python
CHUNK_SIZE = 400        # Try: 200, 600, 800
CHUNK_OVERLAP = 100     # Try: 0, 50, 200
TOP_K = 3              # Try: 1, 5, 10
```

### Questions to Explore:
- What happens if you reduce `TOP_K` to 1?
- How does larger `CHUNK_SIZE` affect retrieval?
- What if you remove `CHUNK_OVERLAP`?

## Adding Your Own Documents

1. Create `.txt` files in `sample_documents/` directory
2. Run `python simple_rag.py` again
3. The system will automatically process new documents

## Cost Comparison

| Component | Cost |
|-----------|------|
| Embeddings (sentence-transformers) | FREE (local) |
| Vector Store (FAISS) | FREE (local) |
| Gemini API calls | ~$0.00025 per query |

**vs OpenAI RAG:**
- OpenAI embeddings: $0.02 per 1M tokens
- OpenAI GPT-4: $10-30 per 1M tokens

## Next Steps (Advanced RAG)

Once you understand this basic implementation, you can add:

1. **Cloud Vector DB** - Pinecone, Weaviate, Qdrant
2. **PostgreSQL Integration** - Store document metadata
3. **Approval Workflow** - Admin review before vectorization
4. **WhatsApp Integration** - Connect to chatbot
5. **Analytics** - Track query performance
6. **Mother Document Generation** - AI creates FAQs automatically
7. **Hybrid Search** - Combine semantic + keyword search
8. **Re-ranking** - Improve retrieval quality

## Troubleshooting

**Error: No module named 'sentence_transformers'**
```bash
pip install sentence-transformers
```

**Error: GEMINI_API_KEY not found**
- Make sure you renamed `.env.example` to `.env`
- Check your API key is valid

**Slow first run?**
- First time downloads the embedding model (~90MB)
- Subsequent runs are fast

## Understanding RAG vs Traditional AI

**Without RAG:**
```
User: What is the price of 3BHK?
AI: I don't have specific information about that project.
```

**With RAG:**
```
User: What is the price of 3BHK?
System: [Retrieves: "Pricing starts at Rs 95 lakhs for 3BHK"]
AI: The price of a 3BHK apartment starts at Rs 95 lakhs.
```

RAG grounds the AI in your actual documents!
