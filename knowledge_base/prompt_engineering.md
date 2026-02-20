# Prompt Engineering: SellBot AI System Prompt

This document explains the design decisions behind the RAG system prompt used by SellBot AI, the real estate sales chatbot. Every instruction in the prompt exists because of a specific failure observed during testing.

---

## System Prompt Overview

The current production prompt is **v2**, containing **9 explicit instructions** that guide the LLM when generating answers from retrieved context chunks. The prompt uses two placeholders -- `{context}` (injected retrieved chunks with metadata and relevance scores) and `{query}` (the user's original question).

---

## The 9 Instructions: What They Do and Why They Exist

### 1. "Read ALL provided context chunks before answering"

**Problem it solves:** During v1 testing, the LLM was stopping early after finding a partial match in the first few chunks. In one critical case, the correct answer to a pricing question was in chunk #7 out of 10 retrieved chunks. The LLM latched onto a superficially similar but incorrect chunk at position #2 and returned a wrong price.

**Why it matters:** Retrieved chunks are ordered by similarity score, but the top-ranked chunk is not always the one containing the answer. Similarity search is approximate -- a chunk describing "pricing options" might rank above the chunk containing the actual price. This instruction forces the LLM to consider all evidence before committing to an answer.

**Failure example:**
- Query: "What is the 3 BHK price in Prestige Lakeside?"
- Chunk #2 (score 0.82): "Prestige Lakeside offers premium 3 BHK residences with lake-facing balconies..."
- Chunk #7 (score 0.71): "3 BHK units at Prestige Lakeside start from Rs. 1.45 Cr onwards..."
- Without this instruction, the LLM returned: "Prestige Lakeside offers premium 3 BHK residences" -- no price at all.

---

### 2. "Always mention the property name when providing details"

**Problem it solves:** In v1, the LLM frequently gave ambiguous answers like "The price is Rs. 1.2 Cr" or "The project offers 2 and 3 BHK configurations" without specifying which property it was referring to. When users had uploaded brochures for multiple properties, this made answers nearly useless.

**Why it matters:** Real estate buyers are often comparing 3-5 properties simultaneously. An answer without a property name forces the user to guess or re-ask. This instruction ensures every fact is anchored to a specific project name.

**Failure example:**
- Query: "What is the starting price?"
- v1 answer: "The starting price is Rs. 85 Lakhs for a 2 BHK unit."
- v2 answer: "The starting price at Sobha Dream Acres is Rs. 85 Lakhs for a 2 BHK unit."

---

### 3. "When multiple properties are relevant, organize your answer by property"

**Problem it solves:** For comparison queries like "Which projects have covered parking?", v1 would produce a rambling paragraph mixing details from 4 different properties. Users had to mentally untangle which fact belonged to which project.

**Why it matters:** Multi-property queries are among the most common in real estate search. Buyers want structured side-by-side comparisons. This instruction pushes the LLM toward using headings, bullet points, or clear property-by-property sections.

**Failure example:**
- Query: "Compare parking facilities across all properties"
- v1 answer: "Covered parking is available and some projects offer two dedicated slots while others have open parking with visitor parking also available in the basement..."
- v2 answer produces a structured breakdown per property with specific slot counts and types.

---

### 4. "If context contains conflicting information about the same property, mention both values and note the discrepancy"

**Problem it solves:** Real estate documents are notoriously inconsistent. A property brochure might list "Starting from Rs. 1.2 Cr" while a comparison spreadsheet uploaded later says "Rs. 1.15 Cr" for the same unit type. In v1, the LLM would silently pick one value (usually from the higher-ranked chunk) and present it as fact.

**Why it matters:** Presenting a wrong price to a buyer can erode trust instantly. It is better to surface the conflict and let the user verify, rather than silently choosing one source. This also helps sales agents catch outdated data in their uploaded documents.

**Failure example:**
- Brochure chunk: "Prestige Lakeside 3 BHK: Rs. 1.45 Cr"
- Comparison sheet chunk: "Prestige Lakeside 3 BHK: Rs. 1.38 Cr (post-discount)"
- v1 silently returned Rs. 1.45 Cr. v2 mentions both values and notes the discrepancy.

---

### 5. "Format your response using markdown"

**Problem it solves:** Plain text answers looked dense and hard to scan in the chat UI. The React frontend uses `react-markdown` with `remark-gfm` and `react-syntax-highlighter`, which means markdown formatting renders beautifully -- headings, bold text, bullet lists, tables, and code blocks all display correctly.

**Why it matters:** Real estate answers often involve structured data (price tables, amenity lists, specification comparisons). Markdown lets the LLM express this structure naturally, and the frontend renders it in a user-friendly way. Without this instruction, the LLM defaults to plain paragraphs even when a table or list would be far more readable.

---

### 6. "Be specific with numbers -- use exact figures from the context, do not round or approximate"

**Problem it solves:** LLMs have a natural tendency to "smooth" numbers. A price of "Rs. 1,23,45,000" might become "approximately Rs. 1.23 Cr" or worse, "around Rs. 1.2 Cr". Square footage of "1,847 sq.ft." might become "about 1,850 sq.ft." These approximations are unacceptable in real estate.

**Why it matters:** Buyers make financial decisions based on exact numbers. A rounding error of even Rs. 5 Lakhs can change EMI calculations, loan eligibility, and negotiation strategy. This instruction forces the LLM to copy numbers verbatim from the context rather than paraphrasing them.

**Failure example:**
- Context: "Super built-up area: 1,847 sq.ft. | Price: Rs. 1,23,45,000"
- Without instruction: "The unit is approximately 1,850 sq.ft. priced at around Rs. 1.23 Crores"
- With instruction: "The unit has a super built-up area of 1,847 sq.ft. priced at Rs. 1,23,45,000"

---

### 7. "Prioritize information from chunks with higher relevance scores"

**Problem it solves:** Each retrieved chunk is injected into the context with its similarity score (e.g., `[Relevance: 0.85]`). Without this instruction, the LLM treats all chunks equally, sometimes pulling details from a low-relevance chunk (score 0.45) that was retrieved as noise, while ignoring a high-relevance chunk (score 0.88) that directly answers the question.

**Why it matters:** The vector search scoring reflects semantic similarity to the query. While not perfect, it is a strong signal. Telling the LLM to weight higher-scored chunks more heavily improves answer accuracy, especially when the top_k is set high (10) and lower-ranked chunks contain tangentially related information.

---

### 8. "Do not repeat the same information even if it appears in multiple chunks"

**Problem it solves:** Because of chunk overlap (100 characters) and multiple documents covering the same property, the retrieved context frequently contains the same fact 2-3 times. Without this instruction, the LLM would dutifully mention "Sunrise Heights has a clubhouse" three times in the same answer, once for each chunk that mentioned it.

**Why it matters:** Repetitive answers waste the user's time and make the bot seem unintelligent. This instruction tells the LLM to deduplicate information, mentioning each fact exactly once even if it appears in multiple source chunks.

**Failure example:**
- 3 chunks all mention "24/7 security with CCTV surveillance"
- v1 answer: "The property offers 24/7 security. Additionally, CCTV surveillance is provided. The project also features round-the-clock security monitoring."
- v2 answer mentions security once, clearly.

---

### 9. "If the answer is not found in the provided context, say so clearly -- do not make up information"

**Problem it solves:** This is the most critical grounding instruction. LLMs will confidently hallucinate real estate details -- inventing prices, amenities, possession dates, and legal approvals that sound plausible but are entirely fabricated. In v1 testing, the bot once invented a "RERA approval number" that looked legitimate but was completely fake.

**Why it matters:** Hallucinated real estate information can have legal consequences. If a bot tells a buyer "possession is March 2025" when no such date exists in any uploaded document, and the buyer relies on that, it creates liability. This instruction establishes a clear contract: only answer from the provided context, and explicitly say "I don't have this information in my documents" when the context lacks the answer.

---

## Other Generation Settings

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `temperature` | 0.7 | Balances factual accuracy with natural-sounding language. Lower (0.2-0.3) makes answers robotic; higher (0.9+) increases hallucination risk. 0.7 is the sweet spot for conversational yet grounded responses. |
| `max_tokens` | 2048 | Increased from 1000 after multi-property comparison answers were getting truncated mid-sentence. 2048 accommodates detailed comparisons of 4-5 properties with amenity lists. |

---

## Tuning Guide: Common Adjustments

### For shorter, more concise answers
Add to the system prompt:
```
Keep answers under 150 words. Use bullet points instead of paragraphs.
```
Reduce `max_tokens` to 512. This works well for WhatsApp integration where long messages are unwieldy.

### For table-format comparisons
Add to the system prompt:
```
When comparing properties, always use a markdown table with property names as rows and attributes as columns.
```
The React frontend renders markdown tables natively via `remark-gfm`.

### For a sales-oriented tone
Add to the system prompt:
```
Adopt a professional yet enthusiastic real estate advisor tone. Highlight unique selling points. End answers with a relevant follow-up question to keep the conversation going.
```
Useful for customer-facing deployments. Avoid for internal sales team tools where a neutral tone is preferred.

### For strict no-hallucination mode
Lower temperature to 0.2 and add:
```
STRICT MODE: Only state facts that are directly and explicitly present in the context. Do not infer, extrapolate, or synthesize information that is not word-for-word in the chunks. If uncertain, say "I cannot confirm this from the available documents."
```
Use this for compliance-sensitive deployments or when uploaded documents may be incomplete.

---

## Prompt Version History

| Version | Changes | Result |
|---------|---------|--------|
| v1 | Basic "answer from context" instruction only | High hallucination rate, ambiguous answers, no structure |
| v2 (current) | 9 targeted instructions based on failure analysis | Significant improvement in accuracy, structure, and grounding |

---

## Related Files

- `config.py` -- `RAG_CONFIG["system_prompt"]` contains the actual prompt template
- `app.py` -- `generate_answer()` function injects context and query into the prompt
- `knowledge_base/backend_retrieval_fixes.md` -- pipeline fixes that complement prompt improvements
