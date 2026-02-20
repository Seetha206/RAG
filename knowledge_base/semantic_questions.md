# Semantic Test Questions for SellBot RAG System

This document contains 40 test questions organized by category. These questions are designed to evaluate the RAG pipeline's retrieval accuracy, answer quality, and edge-case handling across different query types.

Use these questions after uploading property brochures, comparison sheets, and specification documents to validate system behavior.

---

## 1. Basic Retrieval (8 Questions)

These test direct fact lookup from a single document. The answer should exist in one chunk. Failure here indicates a fundamental retrieval or embedding problem.

| # | Question | What It Tests |
|---|----------|---------------|
| 1.1 | What is the price of 3 BHK in Sunrise Heights? | Direct price lookup for a specific unit type and property |
| 1.2 | What is the total land area of Prestige Lakeside? | Numeric fact retrieval (area in acres/sq.ft.) |
| 1.3 | How many floors does Brigade Metropolis have? | Single numeric attribute retrieval |
| 1.4 | What is the possession date for Sobha Dream Acres? | Date-type information retrieval |
| 1.5 | What is the carpet area of a 2 BHK unit in Phoenix Heights? | Specific measurement retrieval with unit type qualifier |
| 1.6 | Who is the developer of Godrej Splendour? | Entity name retrieval |
| 1.7 | What is the RERA registration number for Mantri Serenity? | Alphanumeric identifier retrieval |
| 1.8 | What are the maintenance charges per sq.ft. at Embassy Springs? | Financial detail with unit-rate format |

---

## 2. Cross-Document (6 Questions)

These require the system to retrieve and synthesize information from multiple uploaded documents. Tests the RAG system's ability to pull relevant chunks from different source files and present a coherent combined answer.

| # | Question | What It Tests |
|---|----------|---------------|
| 2.1 | Compare parking facilities across all properties | Multi-document retrieval with structured comparison output |
| 2.2 | Which property offers the lowest price per square foot? | Requires retrieving prices AND areas from multiple properties, then comparing |
| 2.3 | Compare the 3 BHK configurations across Sunrise Heights, Prestige Lakeside, and Brigade Metropolis | Named multi-property comparison with specific unit type |
| 2.4 | Which properties are RERA approved? | Boolean attribute check across all uploaded documents |
| 2.5 | List all properties with their possession timelines | Tabular retrieval across documents, date-type comparison |
| 2.6 | How do the clubhouse facilities differ between Sobha Dream Acres and Godrej Splendour? | Two-document focused comparison on a specific amenity |

---

## 3. Amenity-Specific (6 Questions)

These focus on amenity retrieval, which is challenging because amenity descriptions are often buried in long lists or scattered across brochure sections. Tests chunk quality and retrieval precision.

| # | Question | What It Tests |
|---|----------|---------------|
| 3.1 | Which properties have a swimming pool? | Boolean amenity check across all documents |
| 3.2 | Does Prestige Lakeside have a gymnasium? | Yes/no retrieval for a specific property and amenity |
| 3.3 | What sports facilities are available at Brigade Metropolis? | Category-based amenity retrieval (sports subset) |
| 3.4 | Which properties offer a children's play area? | Amenity search with variant naming (play area, kids zone, children's park) |
| 3.5 | List all indoor amenities at Sobha Dream Acres | Amenity filtering by indoor/outdoor classification |
| 3.6 | Does any property have an EV charging station? | Niche amenity search -- may not exist in any document (tests "not found" response) |

---

## 4. Location & Market (5 Questions)

These test retrieval of location data, proximity information, and market context. Challenging because location details are often mentioned casually in brochure prose rather than in structured tables.

| # | Question | What It Tests |
|---|----------|---------------|
| 4.1 | What properties are near Whitefield? | Geo-proximity retrieval -- requires understanding "near" in context |
| 4.2 | Which property has the best connectivity to the airport? | Superlative query requiring comparison of distance/time data |
| 4.3 | What schools and hospitals are near Mantri Serenity? | Nearby landmarks retrieval (social infrastructure) |
| 4.4 | Which properties are on Sarjapur Road? | Exact location match on a specific road/area |
| 4.5 | What is the expected appreciation rate for properties in North Bangalore? | Market insight query -- may require "not found" response if not in documents |

---

## 5. Financial & Legal (5 Questions)

These test retrieval of financial details, tax information, and legal compliance data. Critical for accuracy -- wrong financial information can have real consequences.

| # | Question | What It Tests |
|---|----------|---------------|
| 5.1 | What are the GST charges for under-construction properties? | Tax/regulatory information retrieval |
| 5.2 | What is the stamp duty and registration cost for Prestige Lakeside? | Multi-part financial detail for a specific property |
| 5.3 | Are there any bank loan pre-approvals available for Brigade Metropolis? | Banking/financing detail retrieval |
| 5.4 | What is the payment schedule for Sunrise Heights? | Structured financial plan retrieval (milestone-based payments) |
| 5.5 | What are the additional charges beyond base price at Sobha Dream Acres? | Hidden cost retrieval (floor rise, PLC, legal charges, etc.) |

---

## 6. Senior Living / Niche (5 Questions)

These test retrieval of specialized features that not all properties offer. Important for testing the system's ability to correctly say "not found" when a niche feature does not exist in the uploaded documents.

| # | Question | What It Tests |
|---|----------|---------------|
| 6.1 | Which properties offer senior-friendly features? | Niche category search across documents |
| 6.2 | Are there any properties with wheelchair-accessible units? | Accessibility feature search -- may require "not found" |
| 6.3 | Which properties have a dedicated walking track for seniors? | Specific amenity targeting an age demographic |
| 6.4 | Do any properties offer home automation or smart home features? | Technology amenity search |
| 6.5 | Which properties have pet-friendly policies or amenities? | Lifestyle-specific query -- tests niche retrieval |

---

## 7. Multi-Hop (5 Questions)

These require the LLM to perform reasoning over retrieved chunks -- combining two or more facts to arrive at an answer. The most challenging category, testing both retrieval quality and LLM reasoning.

| # | Question | What It Tests |
|---|----------|---------------|
| 7.1 | What is the price per sq.ft. for the most expensive property? | Requires: (1) finding all prices, (2) identifying the max, (3) finding that property's area, (4) calculating price/sq.ft. |
| 7.2 | If I have a budget of Rs. 1.5 Cr, which 3 BHK options are available? | Requires: retrieving all 3 BHK prices, filtering by budget constraint |
| 7.3 | Which property gives the most carpet area for under Rs. 1 Cr? | Two-attribute comparison with a filter condition |
| 7.4 | Considering both price and location, which property is best for someone working in Electronic City? | Multi-factor recommendation requiring price + distance reasoning |
| 7.5 | What is the total cost including GST, registration, and maintenance deposit for a 2 BHK at Prestige Lakeside? | Multi-component cost aggregation from potentially different chunks |

---

## Usage Guide

### Running a Full Evaluation

1. Upload all relevant property documents via `POST /upload`
2. Run each question via `POST /query` with `{"question": "...", "top_k": 10}`
3. Evaluate each response on:
   - **Factual accuracy**: Does the answer match the source documents?
   - **Completeness**: Are all relevant properties/details included?
   - **Grounding**: Does the answer avoid hallucination? Are "not found" responses given when appropriate?
   - **Structure**: Is the answer organized by property when multiple properties are relevant?
   - **Specificity**: Are exact numbers used (not rounded)?

### Expected Failure Patterns

| Pattern | Likely Cause | Fix |
|---------|-------------|-----|
| Correct property, wrong number | Chunk overlap pulling in stale data | Increase similarity threshold |
| Missing one property from comparison | top_k too low | Increase top_k to 10+ |
| Hallucinated amenity | LLM not grounded | Strengthen "not found" prompt instruction |
| Generic answer without property name | Prompt instruction #2 not working | Check prompt template injection |
| Truncated comparison table | max_tokens too low | Increase to 2048+ |

---

## Related Files

- `config.py` -- `RAG_CONFIG` for top_k, chunk_size, and system prompt
- `knowledge_base/prompt_engineering.md` -- detailed prompt design rationale
- `knowledge_base/backend_retrieval_fixes.md` -- pipeline fixes that improve retrieval quality
