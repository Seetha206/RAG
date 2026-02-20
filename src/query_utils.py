"""Query preprocessing utilities for the RAG pipeline."""

import re


def normalize_query(query: str) -> str:
    """
    Normalize user query for better embedding similarity.
    Handles common real estate shorthand and formatting variations.

    Examples:
        "3BHK" → "3 BHK"
        "1200sqft" → "1200 sq.ft."
        "1.5cr" → "1.5 Crores"
        "50L" → "50 Lakhs"
        "INR 50" → "Rs. 50"
    """
    text = query

    # Normalize BHK variants: "3BHK" → "3 BHK", "2bhk" → "2 BHK"
    text = re.sub(r'(\d)\s*[Bb][Hh][Kk]', r'\1 BHK', text)

    # Normalize sqft variants: "1200sqft" → "1200 sq.ft."
    text = re.sub(r'(\d)\s*(?:sq\.?\s*ft\.?|sqft)', r'\1 sq.ft.', text, flags=re.IGNORECASE)

    # Normalize crore/lakh: "1.5cr" → "1.5 Crores", "50L" → "50 Lakhs"
    text = re.sub(r'(\d)\s*[Cc][Rr](?:ores?)?\.?\b', r'\1 Crores', text)
    text = re.sub(r'(\d)\s*[Ll](?:akhs?)?\.?\b', r'\1 Lakhs', text)

    # Normalize Rs/INR: "Rs.50" → "Rs. 50", "INR" → "Rs."
    text = re.sub(r'(?:INR|inr)\s*', 'Rs. ', text)
    text = re.sub(r'[Rr][Ss]\.?\s*(\d)', r'Rs. \1', text)

    return text.strip()
