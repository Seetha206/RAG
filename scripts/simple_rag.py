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

import os
from google import genai
from sentence_transformers import SentenceTransformer
import faiss
import numpy as np
from dotenv import load_dotenv
from typing import List, Tuple

# Load environment variables
load_dotenv()

# Configuration
DOCUMENTS_PATH = "./sample_documents"
CHUNK_SIZE = 400
CHUNK_OVERLAP = 100
TOP_K = 3  # Number of relevant chunks to retrieve
EMBEDDING_MODEL = "all-MiniLM-L6-v2"  # Local embedding model

# Initialize models
print("Initializing models...")
embedding_model = SentenceTransformer(EMBEDDING_MODEL)
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
print("Models initialized successfully!\n")


# Step 1: Document Loading
def load_documents(docs_path: str) -> List[Tuple[str, str]]:
    """Load all text documents from the specified directory."""
    print(f"Loading documents from {docs_path}...")
    documents = []

    for filename in os.listdir(docs_path):
        if filename.endswith('.txt'):
            filepath = os.path.join(docs_path, filename)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
                documents.append((filename, content))
                print(f"  - Loaded: {filename} ({len(content)} chars)")

    print(f"Total documents loaded: {len(documents)}\n")
    return documents


# Step 2: Text Chunking
def chunk_text(text: str, chunk_size: int, overlap: int) -> List[str]:
    """Split text into overlapping chunks."""
    chunks = []
    start = 0

    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]

        # Only add non-empty chunks
        if chunk.strip():
            chunks.append(chunk.strip())

        start += chunk_size - overlap

    return chunks


def process_documents(documents: List[Tuple[str, str]]) -> List[Tuple[str, str, str]]:
    """Process documents into chunks with metadata."""
    print("Chunking documents...")
    all_chunks = []

    for filename, content in documents:
        chunks = chunk_text(content, CHUNK_SIZE, CHUNK_OVERLAP)
        for i, chunk in enumerate(chunks):
            all_chunks.append((filename, f"chunk_{i}", chunk))
        print(f"  - {filename}: {len(chunks)} chunks created")

    print(f"Total chunks: {len(all_chunks)}\n")
    return all_chunks


# Step 3: Generate Embeddings
def generate_embeddings(chunks: List[Tuple[str, str, str]]) -> np.ndarray:
    """Generate embeddings for all chunks using local model."""
    print("Generating embeddings (this may take a moment)...")

    texts = [chunk[2] for chunk in chunks]  # Extract text from tuples
    embeddings = embedding_model.encode(texts, show_progress_bar=True)

    print(f"Generated {len(embeddings)} embeddings of dimension {embeddings.shape[1]}\n")
    return embeddings


# Step 4: Create FAISS Vector Store
def create_vector_store(embeddings: np.ndarray) -> faiss.IndexFlatL2:
    """Create and populate FAISS vector store."""
    print("Creating FAISS vector store...")

    dimension = embeddings.shape[1]
    index = faiss.IndexFlatL2(dimension)  # L2 distance (Euclidean)
    index.add(embeddings.astype('float32'))

    print(f"Vector store created with {index.ntotal} vectors\n")
    return index


# Step 5: Semantic Search
def search_similar_chunks(
    query: str,
    index: faiss.IndexFlatL2,
    chunks: List[Tuple[str, str, str]],
    top_k: int
) -> List[Tuple[str, str, str, float]]:
    """Search for most similar chunks to the query."""

    # Generate query embedding
    query_embedding = embedding_model.encode([query])

    # Search in FAISS
    distances, indices = index.search(query_embedding.astype('float32'), top_k)

    # Retrieve chunks with similarity scores
    results = []
    for i, idx in enumerate(indices[0]):
        filename, chunk_id, text = chunks[idx]
        similarity_score = 1 / (1 + distances[0][i])  # Convert distance to similarity
        results.append((filename, chunk_id, text, similarity_score))

    return results


# Step 6: RAG Query - Generate Answer
def generate_answer(query: str, relevant_chunks: List[Tuple[str, str, str, float]]) -> str:
    """Generate answer using Gemini API with retrieved context."""

    # Prepare context from retrieved chunks
    context = "\n\n".join([
        f"[Source: {filename}]\n{text}"
        for filename, _, text, _ in relevant_chunks
    ])

    # Create prompt with context
    prompt = f"""You are a helpful real estate assistant. Answer the question based on the context provided below.
If the answer cannot be found in the context, say "I don't have that information in my knowledge base."

Context:
{context}

Question: {query}

Answer:"""

    # Generate response using Gemini
    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=prompt
    )
    return response.text


# Main RAG Pipeline
def rag_query(query: str, index, chunks):
    """Complete RAG pipeline for a single query."""
    print(f"\n{'='*80}")
    print(f"QUERY: {query}")
    print(f"{'='*80}\n")

    # Step 1: Retrieve relevant chunks
    print("Searching for relevant information...")
    relevant_chunks = search_similar_chunks(query, index, chunks, TOP_K)

    # Display retrieved chunks
    print("\nRetrieved Chunks:")
    for i, (filename, chunk_id, text, score) in enumerate(relevant_chunks, 1):
        print(f"\n  [{i}] {filename} ({chunk_id}) - Similarity: {score:.3f}")
        print(f"      {text[:150]}..." if len(text) > 150 else f"      {text}")

    # Step 2: Generate answer
    print("\n\nGenerating answer using Gemini API...")
    answer = generate_answer(query, relevant_chunks)

    print("\n" + "="*80)
    print("ANSWER:")
    print("="*80)
    print(answer)
    print("="*80 + "\n")

    return answer


# Main execution
if __name__ == "__main__":
    # Step 1: Load documents
    documents = load_documents(DOCUMENTS_PATH)

    # Step 2: Chunk documents
    chunks = process_documents(documents)

    # Step 3: Generate embeddings
    embeddings = generate_embeddings(chunks)

    # Step 4: Create vector store
    vector_store = create_vector_store(embeddings)

    faiss.write_index(vector_store, "knowledge_base.index")

    print("\n" + "="*80)
    print("RAG SYSTEM READY!")
    print("="*80 + "\n")

    # Test queries
    test_queries = [
        "What is the price of 3BHK apartment?"
       
    ]

    print("Running test queries...\n")
    for i, query in enumerate(test_queries, 1):
        rag_query(query, vector_store, chunks)
        if i < len(test_queries):
            print(f"\n{'='*80}\n")
