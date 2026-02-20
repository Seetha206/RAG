import faiss
import numpy as np

# 1. Load your index (replace 'my_index.index' with your filename)
# If you are using simple_rag.py, use the 'vector_store' variable directly
index = faiss.read_index("knowledge_base.index") 

# 2. See how many items are inside
print(f"Total Vectors in DB: {index.ntotal}")

# 3. See the Dimension (e.g., 384 for MiniLM)
print(f"Vector Dimension: {index.d}")

# 4. Get the raw Vector for ID 0 (the 'numbers')
vector_id = 0
if index.ntotal > 0:
    # Most basic indexes (Flat) allow reconstruction
    vector = index.reconstruct(vector_id)
    print(f"\nRaw Vector for ID {vector_id} (First 5 values):")
    print(vector[:5])

# 5. Check if it's trained
print(f"\nIs Index Trained: {index.is_trained}")