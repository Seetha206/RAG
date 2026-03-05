"""FAQ generation — sends full document text to LLM and extracts structured Q&A pairs."""

import json
import re
from typing import List, Dict, Any

from config import LLM_CONFIG

FIXED_CATEGORIES = [
    "Pricing",
    "Amenities",
    "Location",
    "Process",
    "Specifications",
    "Security",
    "General",
]

# Max characters of document text to send to LLM
# Keeps prompt within context limits for all providers
MAX_TEXT_CHARS = 50_000

FAQ_PROMPT = """You are a real estate FAQ generator.

Read the following document carefully and generate {max_faqs} question-answer pairs that cover the most important facts a property buyer or sales agent would need to know.

Rules:
1. Each question must be specific and answerable from the document.
2. Each answer must be detailed and comprehensive — include all relevant numbers, names, specifications, and context from the document. Answers should be 2-5 sentences minimum. Use bullet points or line breaks where listing multiple items (e.g., multiple amenities, payment plan installments, or unit types).
3. Do NOT give one-line answers. A good answer explains the full picture, not just a single fact.
4. Assign EXACTLY ONE category from this fixed list:
   - Pricing      (prices, costs, rates, payment plans, charges, discounts, GST)
   - Amenities    (facilities, pool, gym, clubhouse, sports, recreation, children)
   - Location     (distance, connectivity, nearby landmarks, schools, hospitals, IT parks)
   - Process      (buying, booking, documentation, home loan, registration, possession, RERA)
   - Specifications (construction, flooring, fittings, materials, dimensions, sq.ft., BHK layout)
   - Security     (CCTV, guards, safety systems, access control, fire, DG backup)
   - General      (anything that doesn't fit the above categories)

Return ONLY a valid JSON array — no markdown, no explanation, no code fences.
Format:
[
  {{"question": "What is the starting price for a 2BHK?", "answer": "The 2BHK Standard unit starts at Rs. 86.25 Lakhs, based on a carpet area of 1,150 sq.ft. priced at Rs. 7,500 per sq.ft. Additional charges apply: car parking is Rs. 3.5 Lakhs per slot, clubhouse membership is Rs. 2 Lakhs, and legal/registration charges are 5% of the property value. GST at 5% is applicable for under-construction units.", "category": "Pricing"}},
  ...
]

Document text:
{text}"""


def _call_llm(prompt: str, llm_client) -> str:
    """Call the configured LLM provider and return the raw text response."""
    provider = LLM_CONFIG["provider"]

    if provider == "gemini":
        response = llm_client.models.generate_content(
            model=LLM_CONFIG["model"],
            contents=prompt
        )
        return response.text

    elif provider == "ollama":
        import httpx
        base_url = llm_client.get("base_url", "http://localhost:11434")
        response = httpx.post(
            f"{base_url}/api/generate",
            json={"model": LLM_CONFIG["model"], "prompt": prompt, "stream": False},
            timeout=180.0,  # FAQ generation can take longer than normal queries
        )
        response.raise_for_status()
        return response.json()["response"]

    elif provider == "openai":
        response = llm_client.chat.completions.create(
            model=LLM_CONFIG["model"],
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,   # Lower temperature for factual FAQ extraction
            max_tokens=LLM_CONFIG["max_tokens"],
        )
        return response.choices[0].message.content

    elif provider == "claude":
        response = llm_client.messages.create(
            model=LLM_CONFIG["model"],
            max_tokens=LLM_CONFIG["max_tokens"],
            messages=[{"role": "user", "content": prompt}]
        )
        return response.content[0].text

    else:
        raise ValueError(f"Unknown LLM provider: {provider}")


def _parse_faq_json(raw_text: str) -> List[Dict[str, Any]]:
    """
    Parse JSON array from LLM response.
    Handles cases where LLM wraps JSON in markdown code fences.
    """
    if not raw_text or not raw_text.strip():
        return []

    text = raw_text.strip()

    # Try direct parse first
    try:
        result = json.loads(text)
        if isinstance(result, list):
            return result
    except json.JSONDecodeError:
        pass

    # Strip markdown code fences: ```json ... ``` or ``` ... ```
    fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence_match:
        try:
            result = json.loads(fence_match.group(1).strip())
            if isinstance(result, list):
                return result
        except json.JSONDecodeError:
            pass

    # Find first [ ... ] block in response
    bracket_match = re.search(r"\[[\s\S]*\]", text)
    if bracket_match:
        try:
            result = json.loads(bracket_match.group(0))
            if isinstance(result, list):
                return result
        except json.JSONDecodeError:
            pass

    print(f"[faq_generator] Could not parse JSON from LLM response. Raw (first 500 chars): {text[:500]}")
    return []


def generate_faqs(
    text: str,
    llm_client,
    source_file: str = "",
    max_faqs: int = 25,
) -> List[Dict[str, Any]]:
    """
    Generate FAQ Q&A pairs from document text using the configured LLM.

    Args:
        text: Full extracted document text (will be truncated to MAX_TEXT_CHARS)
        llm_client: Initialized LLM client from create_llm_client()
        source_file: Original filename (for attribution, not sent to LLM)
        max_faqs: Number of FAQ pairs to request from LLM (default 25)

    Returns:
        List of {question, answer, category, source_file} dicts
    """
    if not text or not text.strip():
        print(f"[faq_generator] Empty text for {source_file}, skipping FAQ generation.")
        return []

    # Truncate to context limit
    truncated_text = text[:MAX_TEXT_CHARS]
    if len(text) > MAX_TEXT_CHARS:
        print(f"[faq_generator] Text truncated from {len(text)} to {MAX_TEXT_CHARS} chars for {source_file}")

    prompt = FAQ_PROMPT.format(max_faqs=max_faqs, text=truncated_text)

    try:
        print(f"[faq_generator] Generating {max_faqs} FAQs for: {source_file}")
        raw_response = _call_llm(prompt, llm_client)
        faqs_raw = _parse_faq_json(raw_response)
    except Exception as e:
        print(f"[faq_generator] LLM call failed for {source_file}: {e}")
        return []

    # Validate and clean each FAQ
    validated = []
    for item in faqs_raw:
        if not isinstance(item, dict):
            continue

        question = str(item.get("question", "")).strip()
        answer = str(item.get("answer", "")).strip()
        category = str(item.get("category", "General")).strip()

        if not question or not answer:
            continue

        # Ensure category is from the fixed list
        if category not in FIXED_CATEGORIES:
            category = "General"

        validated.append({
            "question": question,
            "answer": answer,
            "category": category,
            "source_file": source_file,
        })

    print(f"[faq_generator] Generated {len(validated)} valid FAQs for: {source_file}")
    return validated
