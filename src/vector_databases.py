"""
Abstract vector database interface with multiple provider implementations.
Swap providers by changing config.py - no code changes needed!
"""

from abc import ABC, abstractmethod
from typing import List, Tuple, Dict, Any
import numpy as np
import json
import os


class VectorDatabase(ABC):
    """Abstract base class for vector databases."""

    @abstractmethod
    def add(
        self,
        embeddings: np.ndarray,
        texts: List[str],
        metadata: List[Dict[str, Any]]
    ) -> List[str]:
        """
        Add embeddings to the vector database.

        Args:
            embeddings: numpy array of embeddings (n_vectors x dimensions)
            texts: List of text chunks
            metadata: List of metadata dicts for each chunk

        Returns:
            List of IDs for added vectors
        """
        pass

    @abstractmethod
    def search(
        self,
        query_embedding: np.ndarray,
        top_k: int = 3
    ) -> List[Tuple[str, str, Dict[str, Any], float]]:
        """
        Search for similar vectors.

        Args:
            query_embedding: Query embedding vector
            top_k: Number of results to return

        Returns:
            List of tuples: (id, text, metadata, similarity_score)
        """
        pass

    @abstractmethod
    def save(self, path: str) -> None:
        """Save vector database to disk."""
        pass

    @abstractmethod
    def load(self, path: str) -> None:
        """Load vector database from disk."""
        pass

    @abstractmethod
    def reset(self) -> None:
        """Clear all vectors from database."""
        pass

    @abstractmethod
    def get_stats(self) -> Dict[str, Any]:
        """Return database statistics."""
        pass


# =============================================================================
# FAISS VECTOR DATABASE (Local, Fast)
# =============================================================================


class FAISSDatabase(VectorDatabase):
    """
    FAISS vector database - local, extremely fast.
    Best for: Development, small-medium datasets, no cloud dependency.
    """

    def __init__(self, dimensions: int, index_type: str = "IndexFlatL2"):
        """
        Initialize FAISS vector database.

        Args:
            dimensions: Embedding dimension size
            index_type: FAISS index type
                - IndexFlatL2: Exact search, L2 distance (default)
                - IndexFlatIP: Exact search, inner product
                - IndexIVFFlat: Approximate search, faster for large datasets
        """
        try:
            import faiss
        except ImportError:
            raise ImportError("faiss not installed. Run: pip install faiss-cpu")

        self.dimensions = dimensions
        self.index_type = index_type
        self.chunks = []  # Store (id, text, metadata)
        self.faiss = faiss

        # Create FAISS index
        if index_type == "IndexFlatL2":
            self.index = faiss.IndexFlatL2(dimensions)
        elif index_type == "IndexFlatIP":
            self.index = faiss.IndexFlatIP(dimensions)
        else:
            self.index = faiss.IndexFlatL2(dimensions)

        print(f"Initialized FAISS {index_type} with {dimensions} dimensions")

    def add(
        self,
        embeddings: np.ndarray,
        texts: List[str],
        metadata: List[Dict[str, Any]]
    ) -> List[str]:
        """Add embeddings to FAISS index."""
        # Generate IDs
        start_id = len(self.chunks)
        ids = [f"vec_{start_id + i}" for i in range(len(embeddings))]

        # Store chunks with metadata
        for i, (text, meta) in enumerate(zip(texts, metadata)):
            self.chunks.append({
                "id": ids[i],
                "text": text,
                "metadata": meta
            })

        # Add to FAISS index
        self.index.add(embeddings.astype('float32'))

        return ids

    def search(
        self,
        query_embedding: np.ndarray,
        top_k: int = 3
    ) -> List[Tuple[str, str, Dict[str, Any], float]]:
        """Search FAISS index for similar vectors."""
        if self.index.ntotal == 0:
            return []

        # Ensure query is 2D
        if query_embedding.ndim == 1:
            query_embedding = query_embedding.reshape(1, -1)

        # Search
        distances, indices = self.index.search(
            query_embedding.astype('float32'),
            min(top_k, self.index.ntotal)
        )

        # Convert distances to similarity scores
        # For L2 distance: similarity = 1 / (1 + distance)
        results = []
        for i, idx in enumerate(indices[0]):
            if idx < len(self.chunks):
                chunk = self.chunks[idx]
                similarity_score = 1 / (1 + distances[0][i])
                results.append((
                    chunk["id"],
                    chunk["text"],
                    chunk["metadata"],
                    float(similarity_score)
                ))

        return results

    def save(self, path: str) -> None:
        """Save FAISS index and metadata to disk."""
        os.makedirs(os.path.dirname(path) if os.path.dirname(path) else ".", exist_ok=True)

        # Save FAISS index
        self.faiss.write_index(self.index, path)

        # Save chunks metadata
        metadata_path = path.replace(".index", "_metadata.json")
        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump(self.chunks, f, indent=2)

        print(f"Saved FAISS index to {path}")
        print(f"Saved metadata to {metadata_path}")

    def load(self, path: str) -> None:
        """Load FAISS index and metadata from disk."""
        if not os.path.exists(path):
            raise FileNotFoundError(f"FAISS index not found: {path}")

        # Load FAISS index
        self.index = self.faiss.read_index(path)

        # Load chunks metadata
        metadata_path = path.replace(".index", "_metadata.json")
        if os.path.exists(metadata_path):
            with open(metadata_path, 'r', encoding='utf-8') as f:
                self.chunks = json.load(f)

        print(f"Loaded FAISS index from {path} ({self.index.ntotal} vectors)")

    def reset(self) -> None:
        """Clear FAISS index and chunks."""
        self.index.reset()
        self.chunks = []
        print("FAISS index reset")

    def get_stats(self) -> Dict[str, Any]:
        """Return FAISS database statistics."""
        return {
            "provider": "faiss",
            "index_type": self.index_type,
            "total_vectors": self.index.ntotal,
            "dimensions": self.dimensions,
            "total_chunks": len(self.chunks),
        }


# =============================================================================
# CHROMADB VECTOR DATABASE (Local, Persistent)
# =============================================================================


class ChromaDBDatabase(VectorDatabase):
    """
    ChromaDB vector database - local with persistence.
    Best for: Local development with automatic persistence.
    """

    def __init__(
        self,
        collection_name: str = "rag_documents",
        persist_directory: str = "./vector_store/chromadb"
    ):
        """
        Initialize ChromaDB vector database.

        Args:
            collection_name: Name of the collection
            persist_directory: Directory to persist data
        """
        try:
            import chromadb
        except ImportError:
            raise ImportError("chromadb not installed. Run: pip install chromadb")

        self.collection_name = collection_name
        self.persist_directory = persist_directory

        # Create client with persistence
        self.client = chromadb.PersistentClient(path=persist_directory)

        # Get or create collection
        self.collection = self.client.get_or_create_collection(
            name=collection_name,
            metadata={"description": "RAG document collection"}
        )

        print(f"Initialized ChromaDB collection: {collection_name}")

    def add(
        self,
        embeddings: np.ndarray,
        texts: List[str],
        metadata: List[Dict[str, Any]]
    ) -> List[str]:
        """Add embeddings to ChromaDB."""
        # Generate IDs
        current_count = self.collection.count()
        ids = [f"vec_{current_count + i}" for i in range(len(embeddings))]

        # Add to collection
        self.collection.add(
            embeddings=embeddings.tolist(),
            documents=texts,
            metadatas=metadata,
            ids=ids
        )

        return ids

    def search(
        self,
        query_embedding: np.ndarray,
        top_k: int = 3
    ) -> List[Tuple[str, str, Dict[str, Any], float]]:
        """Search ChromaDB for similar vectors."""
        if self.collection.count() == 0:
            return []

        # Query
        results = self.collection.query(
            query_embeddings=query_embedding.tolist() if query_embedding.ndim == 1
                            else query_embedding.tolist(),
            n_results=min(top_k, self.collection.count())
        )

        # Format results
        output = []
        if results['ids'] and len(results['ids']) > 0:
            for i in range(len(results['ids'][0])):
                output.append((
                    results['ids'][0][i],
                    results['documents'][0][i],
                    results['metadatas'][0][i],
                    1 - results['distances'][0][i]  # Convert distance to similarity
                ))

        return output

    def save(self, path: str = None) -> None:
        """ChromaDB auto-persists, but this method is for interface compatibility."""
        print(f"ChromaDB auto-persists to {self.persist_directory}")

    def load(self, path: str = None) -> None:
        """ChromaDB auto-loads, but this method is for interface compatibility."""
        print(f"ChromaDB auto-loads from {self.persist_directory}")

    def reset(self) -> None:
        """Clear ChromaDB collection."""
        self.client.delete_collection(name=self.collection_name)
        self.collection = self.client.create_collection(
            name=self.collection_name,
            metadata={"description": "RAG document collection"}
        )
        print("ChromaDB collection reset")

    def get_stats(self) -> Dict[str, Any]:
        """Return ChromaDB statistics."""
        return {
            "provider": "chromadb",
            "collection_name": self.collection_name,
            "total_vectors": self.collection.count(),
            "persist_directory": self.persist_directory,
        }


# =============================================================================
# PINECONE VECTOR DATABASE (Cloud, Scalable)
# =============================================================================


class PineconeDatabase(VectorDatabase):
    """
    Pinecone vector database - cloud, highly scalable.
    Best for: Production, large datasets, auto-scaling.
    """

    def __init__(
        self,
        api_key: str,
        index_name: str,
        environment: str = "us-east-1",
        dimensions: int = 1536
    ):
        """
        Initialize Pinecone vector database.

        Args:
            api_key: Pinecone API key
            index_name: Name of the index
            environment: Pinecone environment
            dimensions: Embedding dimensions
        """
        try:
            from pinecone import Pinecone, ServerlessSpec
        except ImportError:
            raise ImportError("pinecone not installed. Run: pip install pinecone-client")

        if not api_key:
            raise ValueError("Pinecone API key required")

        self.index_name = index_name
        self.dimensions = dimensions
        self.chunks_map = {}  # Map vector IDs to text/metadata

        # Initialize Pinecone
        pc = Pinecone(api_key=api_key)

        # Create index if it doesn't exist
        if index_name not in pc.list_indexes().names():
            pc.create_index(
                name=index_name,
                dimension=dimensions,
                metric='cosine',
                spec=ServerlessSpec(
                    cloud='aws',
                    region=environment
                )
            )

        self.index = pc.Index(index_name)
        print(f"Initialized Pinecone index: {index_name}")

    def add(
        self,
        embeddings: np.ndarray,
        texts: List[str],
        metadata: List[Dict[str, Any]]
    ) -> List[str]:
        """Add embeddings to Pinecone."""
        # Generate IDs
        import time
        timestamp = int(time.time() * 1000)
        ids = [f"vec_{timestamp}_{i}" for i in range(len(embeddings))]

        # Prepare vectors for Pinecone
        vectors = []
        for i, (vec_id, embedding, text, meta) in enumerate(
            zip(ids, embeddings, texts, metadata)
        ):
            # Store text in metadata
            full_metadata = {**meta, "text": text}
            vectors.append({
                "id": vec_id,
                "values": embedding.tolist(),
                "metadata": full_metadata
            })
            self.chunks_map[vec_id] = {"text": text, "metadata": meta}

        # Upsert to Pinecone
        self.index.upsert(vectors=vectors)

        return ids

    def search(
        self,
        query_embedding: np.ndarray,
        top_k: int = 3
    ) -> List[Tuple[str, str, Dict[str, Any], float]]:
        """Search Pinecone for similar vectors."""
        # Query Pinecone
        results = self.index.query(
            vector=query_embedding.tolist() if query_embedding.ndim == 1
                   else query_embedding[0].tolist(),
            top_k=top_k,
            include_metadata=True
        )

        # Format results
        output = []
        for match in results['matches']:
            text = match['metadata'].pop('text', '')
            output.append((
                match['id'],
                text,
                match['metadata'],
                match['score']
            ))

        return output

    def save(self, path: str = None) -> None:
        """Pinecone is cloud-based, auto-persists."""
        print("Pinecone auto-persists (cloud-based)")

    def load(self, path: str = None) -> None:
        """Pinecone is cloud-based, auto-loads."""
        print("Pinecone auto-loads (cloud-based)")

    def reset(self) -> None:
        """Clear Pinecone index."""
        self.index.delete(delete_all=True)
        self.chunks_map = {}
        print("Pinecone index reset")

    def get_stats(self) -> Dict[str, Any]:
        """Return Pinecone statistics."""
        stats = self.index.describe_index_stats()
        return {
            "provider": "pinecone",
            "index_name": self.index_name,
            "total_vectors": stats.total_vector_count,
            "dimensions": self.dimensions,
        }


# =============================================================================
# PGVECTOR DATABASE (PostgreSQL with Vector Extension)
# =============================================================================


class PgVectorDatabase(VectorDatabase):
    """
    pgvector - PostgreSQL with vector extension.
    Best for: Existing PostgreSQL users, SQL + vector queries, production.
    """

    def __init__(
        self,
        connection_string: str,
        table_name: str = "rag_documents",
        dimensions: int = 1024
    ):
        """
        Initialize pgvector database.

        Args:
            connection_string: PostgreSQL connection string
                Example: "postgresql://user:password@localhost:5432/dbname"
            table_name: Name of the table to store vectors
            dimensions: Embedding dimensions
        """
        try:
            import psycopg2
            from psycopg2.extras import execute_values
        except ImportError:
            raise ImportError(
                "psycopg2 not installed. Run: pip install psycopg2-binary"
            )

        self.connection_string = connection_string
        self.table_name = table_name
        self.dimensions = dimensions

        # Connect to database
        self.conn = psycopg2.connect(connection_string)
        self.conn.autocommit = True

        # Create extension and table
        self._setup_database()

        print(f"Initialized pgvector database: {table_name}")

    def _setup_database(self):
        """Create pgvector extension and table if they don't exist."""
        with self.conn.cursor() as cur:
            # Create vector extension
            cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")

            # Create table
            cur.execute(f"""
                CREATE TABLE IF NOT EXISTS {self.table_name} (
                    id TEXT PRIMARY KEY,
                    embedding vector({self.dimensions}),
                    text TEXT,
                    metadata JSONB,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)

            # Create HNSW index for vector similarity search
            # HNSW is preferred over IVFFlat: works well at any dataset size,
            # doesn't need training data, and gives more accurate results.
            try:
                cur.execute(f"""
                    CREATE INDEX IF NOT EXISTS {self.table_name}_embedding_idx
                    ON {self.table_name}
                    USING hnsw (embedding vector_cosine_ops)
                    WITH (m = 16, ef_construction = 64);
                """)
            except Exception as e:
                print(f"Note: HNSW index creation deferred: {e}")

    def add(
        self,
        embeddings: np.ndarray,
        texts: List[str],
        metadata: List[Dict[str, Any]]
    ) -> List[str]:
        """Add embeddings to pgvector."""
        import time
        from psycopg2.extras import execute_values

        # Generate IDs
        timestamp = int(time.time() * 1000)
        ids = [f"vec_{timestamp}_{i}" for i in range(len(embeddings))]

        # Prepare data for insertion
        values = []
        for vec_id, embedding, text, meta in zip(ids, embeddings, texts, metadata):
            values.append((
                vec_id,
                embedding.tolist(),
                text,
                json.dumps(meta)
            ))

        # Insert into database
        with self.conn.cursor() as cur:
            execute_values(
                cur,
                f"""
                INSERT INTO {self.table_name} (id, embedding, text, metadata)
                VALUES %s
                ON CONFLICT (id) DO UPDATE SET
                    embedding = EXCLUDED.embedding,
                    text = EXCLUDED.text,
                    metadata = EXCLUDED.metadata
                """,
                values,
                template="(%s, %s::vector, %s, %s::jsonb)"
            )

        return ids

    def search(
        self,
        query_embedding: np.ndarray,
        top_k: int = 3
    ) -> List[Tuple[str, str, Dict[str, Any], float]]:
        """Search pgvector for similar vectors using cosine similarity."""
        if query_embedding.ndim == 1:
            query_vector = query_embedding.tolist()
        else:
            query_vector = query_embedding[0].tolist()

        with self.conn.cursor() as cur:
            # Use cosine similarity (1 - cosine distance)
            cur.execute(f"""
                SELECT
                    id,
                    text,
                    metadata,
                    1 - (embedding <=> %s::vector) AS similarity
                FROM {self.table_name}
                ORDER BY embedding <=> %s::vector
                LIMIT %s
            """, (query_vector, query_vector, top_k))

            results = []
            for row in cur.fetchall():
                vec_id, text, metadata, similarity = row
                results.append((
                    vec_id,
                    text,
                    metadata,
                    float(similarity)
                ))

            return results

    def save(self, path: str = None) -> None:
        """pgvector auto-persists (it's a database)."""
        print(f"pgvector auto-persists to PostgreSQL database")

    def load(self, path: str = None) -> None:
        """pgvector auto-loads (it's a database)."""
        print(f"pgvector auto-loads from PostgreSQL database")

    def reset(self) -> None:
        """Clear all vectors from pgvector table."""
        with self.conn.cursor() as cur:
            cur.execute(f"DELETE FROM {self.table_name}")
        print(f"pgvector table {self.table_name} reset")

    def get_stats(self) -> Dict[str, Any]:
        """Return pgvector statistics."""
        with self.conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) FROM {self.table_name}")
            count = cur.fetchone()[0]

        return {
            "provider": "pgvector",
            "table_name": self.table_name,
            "total_vectors": count,
            "dimensions": self.dimensions,
        }

    def __del__(self):
        """Close database connection."""
        if hasattr(self, 'conn'):
            self.conn.close()


# =============================================================================
# FACTORY FUNCTION
# =============================================================================


def get_vector_database(config: dict, embedding_dimensions: int) -> VectorDatabase:
    """
    Factory function to create vector database from config.

    Args:
        config: Vector DB configuration dict
        embedding_dimensions: Embedding dimension size

    Returns:
        VectorDatabase instance
    """
    provider = config.get("provider", "faiss").lower()

    if provider == "faiss":
        faiss_config = config.get("faiss", {})
        return FAISSDatabase(
            dimensions=embedding_dimensions,
            index_type=faiss_config.get("index_type", "IndexFlatL2")
        )

    elif provider == "chromadb":
        chroma_config = config.get("chromadb", {})
        return ChromaDBDatabase(
            collection_name=chroma_config.get("collection_name", "rag_documents"),
            persist_directory=chroma_config.get("persist_directory", "./vector_store/chromadb")
        )

    elif provider == "pinecone":
        pinecone_config = config.get("pinecone", {})
        return PineconeDatabase(
            api_key=pinecone_config.get("api_key"),
            index_name=pinecone_config.get("index_name", "rag-index"),
            environment=pinecone_config.get("environment", "us-east-1"),
            dimensions=embedding_dimensions
        )

    elif provider == "pgvector":
        pgvector_config = config.get("pgvector", {})
        return PgVectorDatabase(
            connection_string=pgvector_config.get("connection_string"),
            table_name=pgvector_config.get("table_name", "rag_documents"),
            dimensions=embedding_dimensions
        )

    else:
        raise ValueError(
            f"Unknown vector database provider: {provider}. "
            f"Supported: faiss, chromadb, pinecone, pgvector"
        )
