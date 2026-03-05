# Multi-Project RAG Architecture 
---

## 1️⃣ MAIN STRUCTURE

```
                         ┌──────────────────────┐
                         │        MAIN DB       │
                         │----------------------│
                         │ projects table       │
                         │ project_id           │
                         │ project_name         │
                         │ vdb_namespace        │
                         └─────────┬────────────┘
                                   │
        ───────────────────────────┼───────────────────────────
                                   │
        ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
        │   PROJECT 1      │  │   PROJECT 2      │  │   PROJECT 3      │
        │------------------│  │------------------│  │------------------│
        │ VDB: vdb_p1      │  │ VDB: vdb_p2      │  │ VDB: vdb_p3      │
        │ FAQ_DB: faq_p1   │  │ FAQ_DB: faq_p2   │  │ FAQ_DB: faq_p3   │
        └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘
                 │                      │                      │
```

---

## 2️⃣ DOCUMENT UPLOAD FLOW

```
User Uploads PDF (e.g., star_promptor.pdf)
        │
        ▼
+------------------+
| Extract Text     |
+------------------+
        │
        ▼
+------------------+
| Chunking         |
+------------------+
        │
        ▼
+------------------+
| Create Embedding |
+------------------+
        │
        ▼
+------------------+
| Store in VDB_P1  |
+------------------+
```

---

## 3️⃣ AUTO FAQ GENERATION FROM PDF (LLM Processing)

```
User Uploads PDF
        │
        ▼
+----------------------+
| Extract Full Text    |
+----------------------+
        │
        ▼
+------------------------------+
| Send Text to LLM             |
| "Generate 40 FAQ (Q&A)"     |
+------------------------------+
        │
        ▼
+------------------------------+
| LLM Returns Structured JSON  |
| [ {question, answer}, ... ]  |
+------------------------------+
        │
        ▼
+------------------------------+
| Store into FAQ_DB (SQL)      |
| project_id based storage     |
+------------------------------+
```

### FAQ Table Structure

```
faq_table
--------------------------------
id
project_id
question
answer
source = 'pdf_generated'
created_at
```

---

## 4️⃣ USER QUESTION FLOW

```
User Question
        │
        ▼
+------------------+
| Identify Project |
+------------------+
        │
        ▼
+---------------------------+
| Step 1: Check FAQ_DB      |
| (Exact / Keyword match)   |
+---------------------------+
        │
        ├── Found → Return Answer
        │
        └── Not Found
                │
                ▼
        +------------------+
        | Embed Question   |
        +------------------+
                │
                ▼
        +------------------+
        | Search VDB_P1    |
        | (top_k chunks)   |
        +------------------+
                │
                ▼
        +------------------+
        | Send to LLM      |
        +------------------+
                │
                ▼
            Final Answer
```

---

## 5️⃣ COMPLETE SYSTEM VIEW

```
                 ┌───────────────┐
                 │     USER      │
                 └──────┬────────┘
                        │
                        ▼
                 ┌───────────────┐
                 │    FASTAPI    │
                 │   (Backend)   │
                 └──────┬────────┘
                        │
        ┌───────────────┼────────────────┐
        ▼               ▼                ▼
   MAIN DB          FAQ DB          VECTOR DB
(project meta)   (structured Q/A)   (embeddings)
```

---

End of Architecture Diagram.

