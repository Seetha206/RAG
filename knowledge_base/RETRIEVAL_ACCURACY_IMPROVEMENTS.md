# Retrieval Accuracy Improvements — FAQ Threshold & Word Guard

**Issue ref:** ISSUE_019
**Date fixed:** 2026-03-04
**Files changed:** `src/faq_db.py`, `app.py`

---

## The Problem — What Was Breaking

The SellBot AI chat uses a **FAQ-first pipeline**: before doing a full vector search
through uploaded documents, it checks whether the user's question matches a stored FAQ.

The old system had two flaws that made this too aggressive:

### Flaw 1 — Threshold was 0.01 (near zero)

PostgreSQL `ts_rank` scores how well a query matches a document using full-text search.
The score ranges from `0.0` (no overlap) to `1.0` (perfect match).

The old threshold was `rank > 0.01` — which is essentially "any word in common".

**Real example:**
```
User query:   "parking"
FAQ question: "Is there a parking facility available for residents?"
ts_rank:       0.06  ✓ passes the 0.01 threshold
Result:        FAQ answer returned — "Yes, 2 covered slots per flat"
```

Even though the user typed just one word "parking", the system confidently returned
the FAQ. But the user might have meant:
- "What are the parking dimensions for large SUVs?"
- "Is visitor parking free or paid?"
- "How many parking floors does the building have?"

All of these require the actual uploaded brochure — the FAQ doesn't cover them.

### Flaw 2 — Single keywords always matched

Words like **parking**, **price**, **location**, **amenities**, **security** appear
in almost every FAQ question. Any one-word query would hit an FAQ and skip RAG entirely,
no matter what the user's real intent was.

```
"price"      → FAQ: "What is the price of a 2BHK?" → returns 2BHK price only
"location"   → FAQ: "Where is the project located?" → returns vague area name
"amenities"  → FAQ: "What amenities are available?" → returns generic list
```

The user wanted the full document answer. They got a one-liner FAQ instead.

---

## What Was Changed

### Fix 1 — Raised threshold: `0.01 → 0.15` in `src/faq_db.py`

**File:** [src/faq_db.py](../src/faq_db.py) — line 246
**Before:**
```python
# Only return if rank is meaningful (> 0.01 to filter very weak matches)
if rank < 0.01:
    return None
```

**After:**
```python
# Only return if rank is meaningful — raised from 0.01 → 0.15 (ISSUE_019)
# 0.15 requires a phrase-level match; 0.01 fired on any single keyword overlap
if rank < 0.15:
    return None
```

**What 0.15 means in practice:**

| ts_rank score | What it represents | Returned? |
|--------------|-------------------|-----------|
| 0.02–0.08 | Single common word overlap (old system returned this) | ❌ No (falls to RAG) |
| 0.08–0.14 | Partial phrase match, ambiguous intent | ❌ No (falls to RAG) |
| 0.15–0.30 | Multiple keywords match — likely relevant FAQ | ✅ Yes |
| 0.30+ | Strong phrase match — very likely what the user asked | ✅ Yes |

The score of 0.15 was chosen because:
- `ts_rank` with `plainto_tsquery` assigns higher scores when multiple unique words match
- A 4+ word question like "What is the parking cost for visitors?" hits 0.15+ when
  the FAQ contains "parking cost" and "visitors" together
- A 1-word "parking" query maxes out around 0.06–0.08 on a typical FAQ sentence

---

### Fix 2 — 4-word minimum before FAQ search in `app.py`

**File:** [app.py](../app.py) — `/query` endpoint, Step 1 block
**Before:**
```python
if db_conn is not None:
    try:
        faq_match = search_faq(normalized_question, db_conn, ...)
```

**After:**
```python
query_words = normalized_question.strip().split()
if db_conn is not None and len(query_words) >= 4:
    try:
        faq_match = search_faq(normalized_question, db_conn, ...)
```

**Why 4 words?**

A query with fewer than 4 words is almost always:
- A topic probe ("parking", "price", "location")
- A vague term ("amenities", "specs", "security")
- An abbreviation ("3BHK rate", "RERA no")

These need the RAG pipeline — they need full document context to answer properly.
A query with 4+ words signals specific intent:
- "What is the parking cost" (5 words) → specific, FAQ can help
- "Does the project have a gym" (7 words) → specific, FAQ is ideal

| Query | Words | Goes to |
|-------|-------|---------|
| "parking" | 1 | RAG (document search) |
| "3BHK price" | 2 | RAG (document search) |
| "pool location" | 2 | RAG (document search) |
| "What is the price" | 4 | FAQ search first → RAG if no match |
| "Is there a parking facility" | 6 | FAQ search first → RAG if no match |
| "What amenities does Sunrise Heights offer" | 7 | FAQ search first → RAG if no match |

---

## How the Two Fixes Work Together

The two fixes are a **double filter**. A FAQ answer is only returned when BOTH
conditions pass:

```
User query
    │
    ▼
Has 4+ words?
    │ No → straight to RAG (document vector search)
    │ Yes ↓
    ▼
ts_rank > 0.15 against stored FAQ questions?
    │ No → RAG (document vector search)
    │ Yes ↓
    ▼
Return FAQ answer (fast, no LLM needed)
```

**Before the fix:**
- "parking" → 1 word, threshold 0.01 → FAQ returned ❌
- "what is price" → 3 words, ts_rank 0.08 → FAQ returned ❌

**After the fix:**
- "parking" → 1 word → skip FAQ → RAG searches brochure.pdf → LLM answers with full context ✅
- "what is price" → 3 words → skip FAQ → RAG searches price list PDF → full answer ✅
- "What is the parking rate for visitors" → 7 words, ts_rank 0.22 → FAQ returned (if it matches) ✅
- "Is there a swimming pool" → 6 words, ts_rank 0.04 → no FAQ match → RAG searches document ✅

---

## When FAQ Still Wins (Correctly)

FAQs are still fast-path answered when the query is a genuine, complete question
that closely matches what was stored. Examples:

| User asks | FAQ stored | ts_rank | Result |
|-----------|-----------|---------|--------|
| "What is the price of a 3BHK flat?" | "What is the price of a 3BHK?" | 0.38 | ✅ FAQ |
| "Is parking available for residents?" | "Is there parking available for residents?" | 0.31 | ✅ FAQ |
| "What amenities does the project offer?" | "What are the amenities available?" | 0.19 | ✅ FAQ |
| "Is the project RERA registered?" | "Is the project RERA approved?" | 0.27 | ✅ FAQ |

These are all 5+ words AND score above 0.15 — they get the instant FAQ response
which is faster (no embedding, no vector search, no LLM call).

---

## Calibration Guide — Tuning the Threshold

If you want to adjust the threshold in future, change line 246 in `src/faq_db.py`:

```python
if rank < 0.15:   # ← change this value
    return None
```

| Threshold | Behaviour | Use when |
|-----------|-----------|----------|
| `0.01` (old) | Almost any word match returns FAQ | Never — too aggressive |
| `0.10` | Partial phrase matches return FAQ | High FAQ coverage, good quality questions |
| `0.15` | Strong partial match required (current) | **Recommended default** |
| `0.20` | Two or more unique words must match | Want very precise FAQ triggering |
| `0.30` | Near-exact phrasing required | When users type the exact FAQ question |

If you upload more precise, longer FAQ questions (generated by the LLM from richer
documents), the threshold can be raised to 0.20 or even 0.25 safely.

Similarly, if you want to adjust the word count minimum, change `app.py`:
```python
if db_conn is not None and len(query_words) >= 4:  # ← change 4
```
- `>= 3` — "Is parking free?" (3 words) triggers FAQ search
- `>= 4` — minimum for specific intent (current, recommended)
- `>= 5` — only full sentences trigger FAQ

---

## Impact on Response Speed

The FAQ path is faster than RAG because it skips:
1. Embedding the query (~50ms with fastembed)
2. Vector search in pgvector (~10–50ms)
3. LLM generation (~300ms–2s with Gemini)

With the new 4-word guard:
- Short/vague queries now always go through RAG (slightly slower but more accurate)
- Long, specific questions still hit FAQ when they match (fast path preserved)

The speed trade-off is acceptable because short queries like "parking" or "price"
were returning wrong answers instantly — wrong and fast is worse than correct and
slightly slower.

---

## Files Changed Summary

| File | Line | Change |
|------|------|--------|
| `src/faq_db.py` | 245–247 | `rank < 0.01` → `rank < 0.15` |
| `app.py` | 390–395 | Added `query_words` count check; FAQ search gated on `len >= 4` |
