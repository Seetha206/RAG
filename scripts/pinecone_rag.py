import os
from pinecone import Pinecone, ServerlessSpec
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv

load_dotenv()

# 1. Setup Local Embedding Model
# Using all-mpnet-base-v2 for higher accuracy (768 dimensions)
MODEL_NAME = 'all-mpnet-base-v2' 
DIMENSIONS = 768 

model = SentenceTransformer(MODEL_NAME) 

# 2. Initialize Pinecone
pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))

# Use a specific index name for 768-dim model
index_name = "lattu-rag-v2-768"

# 3. Create Index if it doesn't exist
if index_name not in pc.list_indexes().names():
    pc.create_index(
        name=index_name,
        dimension=DIMENSIONS, 
        metric='cosine',
        spec=ServerlessSpec(cloud='aws', region='us-east-1')
    )

index = pc.Index(index_name)

def add_to_pinecone(text_chunks, metadatas):
    """
    Embeds locally and uploads to Pinecone
    """
    embeddings = model.encode(text_chunks)
    
    vectors = []
    for i, (chunk, meta) in enumerate(zip(text_chunks, metadatas)):
        vectors.append({
            "id": f"vec_{i}_{int(os.urandom(2).hex(), 16)}", # Unique ID per upload
            "values": embeddings[i].tolist(),
            "metadata": {**meta, "text": chunk}
        })
    
    index.upsert(vectors=vectors)
    print(f"Successfully uploaded {len(vectors)} vectors to Pinecone index '{index_name}'.")

def query_pinecone(query_text, top_k=3):
    """
    Embeds query locally and searches Pinecone
    """
    query_vector = model.encode(query_text).tolist()
    
    results = index.query(
        vector=query_vector,
        top_k=top_k,
        include_metadata=True
    )
    return results

# Example Usage:
if __name__ == "__main__":
    sample_text = ["Lattu is working as a Backend Intern.", "Pinecone is a vector database."]
    sample_meta = [{"source": "bio"}, {"source": "tool_info"}]
    
    add_to_pinecone(sample_text, sample_meta)
    
    query = "Where does Lattu work?"
    res = query_pinecone(query)
    print(f"\nQuery: {query}")
    for match in res['matches']:
        print(f"Score: {match['score']:.4f} | Text: {match['metadata']['text']}")