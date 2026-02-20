"""
Abstract embedding interface with multiple provider implementations.
Swap providers by changing config.py - no code changes needed!
"""

from abc import ABC, abstractmethod
from typing import List, Union
import numpy as np


class EmbeddingProvider(ABC):
    """Abstract base class for embedding providers."""

    @abstractmethod
    def embed(self, texts: Union[str, List[str]]) -> np.ndarray:
        """
        Generate embeddings for text(s).

        Args:
            texts: Single text string or list of text strings

        Returns:
            numpy array of embeddings (n_texts x dimensions)
        """
        pass

    @abstractmethod
    def get_dimensions(self) -> int:
        """Return the embedding dimension size."""
        pass

    @abstractmethod
    def get_model_name(self) -> str:
        """Return the model name."""
        pass


# =============================================================================
# LOCAL EMBEDDING PROVIDERS (Free, runs on your machine)
# =============================================================================


class LocalEmbeddings(EmbeddingProvider):
    """
    Local embedding provider using sentence-transformers.
    Free, privacy-preserving, no API calls.
    """

    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        """
        Initialize local embedding model.

        Args:
            model_name: sentence-transformers model name
                - all-MiniLM-L6-v2: 384 dims, fastest
                - all-mpnet-base-v2: 768 dims, better quality
                - e5-large-v2: 1024 dims, best local quality
        """
        try:
            from sentence_transformers import SentenceTransformer
        except ImportError:
            raise ImportError(
                "sentence-transformers not installed. "
                "Run: pip install sentence-transformers"
            )

        self.model_name = model_name
        self.model = SentenceTransformer(model_name)
        self.dimensions = self.model.get_sentence_embedding_dimension()

    def embed(self, texts: Union[str, List[str]]) -> np.ndarray:
        """Generate embeddings using local model."""
        if isinstance(texts, str):
            texts = [texts]

        embeddings = self.model.encode(
            texts,
            show_progress_bar=False,
            convert_to_numpy=True
        )
        return embeddings

    def get_dimensions(self) -> int:
        """Return embedding dimensions."""
        return self.dimensions

    def get_model_name(self) -> str:
        """Return model name."""
        return self.model_name


# =============================================================================
# OPENAI EMBEDDING PROVIDERS (Paid, cloud-based)
# =============================================================================


class OpenAIEmbeddings(EmbeddingProvider):
    """
    OpenAI embedding provider.
    High quality, paid API calls.
    """

    DIMENSION_MAP = {
        "text-embedding-3-small": 1536,
        "text-embedding-3-large": 3072,
        "text-embedding-ada-002": 1536,
    }

    def __init__(
        self,
        model_name: str = "text-embedding-3-small",
        api_key: str = None
    ):
        """
        Initialize OpenAI embedding model.

        Args:
            model_name: OpenAI embedding model
                - text-embedding-3-small: 1536 dims, $0.02 per 1M tokens
                - text-embedding-3-large: 3072 dims, $0.13 per 1M tokens
                - text-embedding-ada-002: 1536 dims, $0.10 per 1M tokens (older)
            api_key: OpenAI API key
        """
        try:
            from openai import OpenAI
        except ImportError:
            raise ImportError(
                "openai not installed. Run: pip install openai"
            )

        if not api_key:
            raise ValueError("OpenAI API key required")

        self.model_name = model_name
        self.client = OpenAI(api_key=api_key)
        self.dimensions = self.DIMENSION_MAP.get(model_name, 1536)

    def embed(self, texts: Union[str, List[str]]) -> np.ndarray:
        """Generate embeddings using OpenAI API."""
        if isinstance(texts, str):
            texts = [texts]

        # OpenAI API call
        response = self.client.embeddings.create(
            model=self.model_name,
            input=texts
        )

        # Extract embeddings
        embeddings = [item.embedding for item in response.data]
        return np.array(embeddings, dtype=np.float32)

    def get_dimensions(self) -> int:
        """Return embedding dimensions."""
        return self.dimensions

    def get_model_name(self) -> str:
        """Return model name."""
        return self.model_name


# =============================================================================
# COHERE EMBEDDING PROVIDERS (Paid, cloud-based)
# =============================================================================


class CohereEmbeddings(EmbeddingProvider):
    """
    Cohere embedding provider.
    Optimized for search, supports 100+ languages.
    """

    def __init__(
        self,
        model_name: str = "embed-english-v3.0",
        api_key: str = None
    ):
        """
        Initialize Cohere embedding model.

        Args:
            model_name: Cohere embedding model
                - embed-english-v3.0: 1024 dims, English
                - embed-multilingual-v3.0: 1024 dims, 100+ languages
            api_key: Cohere API key
        """
        try:
            import cohere
        except ImportError:
            raise ImportError(
                "cohere not installed. Run: pip install cohere"
            )

        if not api_key:
            raise ValueError("Cohere API key required")

        self.model_name = model_name
        self.client = cohere.Client(api_key)
        self.dimensions = 1024  # Cohere v3 embeddings are 1024 dims

    def embed(self, texts: Union[str, List[str]]) -> np.ndarray:
        """Generate embeddings using Cohere API."""
        if isinstance(texts, str):
            texts = [texts]

        # Cohere API call
        response = self.client.embed(
            texts=texts,
            model=self.model_name,
            input_type="search_document"  # For indexing documents
        )

        embeddings = np.array(response.embeddings, dtype=np.float32)
        return embeddings

    def get_dimensions(self) -> int:
        """Return embedding dimensions."""
        return self.dimensions

    def get_model_name(self) -> str:
        """Return model name."""
        return self.model_name


# =============================================================================
# FACTORY FUNCTION - Automatically picks provider from config
# =============================================================================


def get_embedding_provider(config: dict) -> EmbeddingProvider:
    """
    Factory function to create embedding provider from config.

    Args:
        config: Embedding configuration dict with keys:
            - provider: "local", "openai", or "cohere"
            - model: model name
            - api_key: API key (for cloud providers)

    Returns:
        EmbeddingProvider instance

    Example:
        >>> config = {
        ...     "provider": "local",
        ...     "model": "all-MiniLM-L6-v2"
        ... }
        >>> embedder = get_embedding_provider(config)
        >>> embeddings = embedder.embed(["Hello world"])
    """
    provider = config.get("provider", "local").lower()
    model = config.get("model")
    api_key = config.get("api_key")

    if provider == "local":
        print(f"Initializing local embeddings: {model}")
        return LocalEmbeddings(model_name=model)

    elif provider == "openai":
        print(f"Initializing OpenAI embeddings: {model}")
        return OpenAIEmbeddings(model_name=model, api_key=api_key)

    elif provider == "cohere":
        print(f"Initializing Cohere embeddings: {model}")
        return CohereEmbeddings(model_name=model, api_key=api_key)

    else:
        raise ValueError(
            f"Unknown embedding provider: {provider}. "
            f"Supported: local, openai, cohere"
        )


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================


def compare_embeddings(
    text: str,
    providers: List[EmbeddingProvider]
) -> dict:
    """
    Compare embeddings from multiple providers (for testing/benchmarking).

    Args:
        text: Text to embed
        providers: List of embedding providers

    Returns:
        Dictionary with provider names and their embeddings
    """
    results = {}
    for provider in providers:
        embedding = provider.embed(text)
        results[provider.get_model_name()] = {
            "embedding": embedding,
            "dimensions": provider.get_dimensions(),
            "shape": embedding.shape
        }
    return results


if __name__ == "__main__":
    # Test local embeddings
    print("Testing Local Embeddings...")
    local_embedder = LocalEmbeddings("all-MiniLM-L6-v2")
    test_text = "What is the price of 3BHK apartment?"
    embedding = local_embedder.embed(test_text)
    print(f"Model: {local_embedder.get_model_name()}")
    print(f"Dimensions: {local_embedder.get_dimensions()}")
    print(f"Embedding shape: {embedding.shape}")
    print(f"First 5 values: {embedding[0][:5]}\n")

    # Test with list of texts
    texts = ["Hello world", "RAG system"]
    embeddings = local_embedder.embed(texts)
    print(f"Batch embedding shape: {embeddings.shape}")
