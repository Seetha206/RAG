"""LLM client initialization and answer generation."""

from typing import List

from config import LLM_CONFIG, RAG_CONFIG


def create_llm_client():
    """
    Create and return LLM client based on LLM_CONFIG["provider"].

    Returns:
        Initialized LLM client (google.genai.Client, openai.OpenAI, or anthropic.Anthropic)
    """
    provider = LLM_CONFIG["provider"]

    if provider == "gemini":
        from google import genai
        return genai.Client(api_key=LLM_CONFIG["gemini_api_key"])

    elif provider == "openai":
        from openai import OpenAI
        return OpenAI(api_key=LLM_CONFIG["openai_api_key"])

    elif provider == "claude":
        from anthropic import Anthropic
        return Anthropic(api_key=LLM_CONFIG["anthropic_api_key"])

    else:
        raise ValueError(f"Unknown LLM provider: {provider}")


def generate_answer(llm_client, query: str, relevant_chunks: List[tuple]) -> str:
    """
    Generate answer using LLM with retrieved context.

    Args:
        llm_client: Initialized LLM client (from create_llm_client)
        query: User question
        relevant_chunks: List of (id, text, metadata, score) tuples

    Returns:
        Generated answer string
    """
    # Prepare context from retrieved chunks
    context_parts = []
    for _, text, metadata, score in relevant_chunks:
        source = metadata.get("filename", "Unknown")
        context_parts.append(f"[Source: {source}, Relevance: {score:.2f}]\n{text}")

    context = "\n\n".join(context_parts)

    # Create prompt
    prompt = RAG_CONFIG["system_prompt"].format(context=context, query=query)

    # Generate response based on provider
    if LLM_CONFIG["provider"] == "gemini":
        response = llm_client.models.generate_content(
            model=LLM_CONFIG["model"],
            contents=prompt
        )
        return response.text

    elif LLM_CONFIG["provider"] == "openai":
        response = llm_client.chat.completions.create(
            model=LLM_CONFIG["model"],
            messages=[{"role": "user", "content": prompt}],
            temperature=LLM_CONFIG["temperature"],
            max_tokens=LLM_CONFIG["max_tokens"]
        )
        return response.choices[0].message.content

    elif LLM_CONFIG["provider"] == "claude":
        response = llm_client.messages.create(
            model=LLM_CONFIG["model"],
            max_tokens=LLM_CONFIG["max_tokens"],
            messages=[{"role": "user", "content": prompt}]
        )
        return response.content[0].text

    else:
        raise ValueError(f"Unknown LLM provider: {LLM_CONFIG['provider']}")
