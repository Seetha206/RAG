# Backend API & Database Query Reference

Complete reference for all SellBot RAG API endpoints and the SQL queries they run internally.
Use this when debugging, testing with curl, or writing new frontend service calls.

---

## Base URL

```
http://localhost:8000
```

---

## Projects

### List all projects
```
GET /projects
```
Returns all user-created projects. **Default Project is excluded** (filtered server-side).

```bash
curl http://localhost:8000/projects
```
SQL run internally:
```sql
SELECT project_id::text, project_name, vdb_namespace, created_at
FROM projects
WHERE vdb_namespace != 'default'
ORDER BY created_at ASC;
```

---

### Get one project
```
GET /projects/{project_id}
```
```bash
curl http://localhost:8000/projects/YOUR_UUID_HERE
```
SQL:
```sql
SELECT project_id::text, project_name, vdb_namespace, created_at
FROM projects
WHERE project_id = 'YOUR_UUID_HERE'::uuid;
```

---

### Create a project
```
POST /projects
Content-Type: application/json
Body: { "project_name": "Sunrise Heights" }
```
```bash
curl -X POST http://localhost:8000/projects \
  -H "Content-Type: application/json" \
  -d '{"project_name": "Sunrise Heights"}'
```
SQL:
```sql
INSERT INTO projects (project_name, vdb_namespace)
VALUES ('Sunrise Heights', gen_random_uuid()::text)
RETURNING project_id::text, project_name, vdb_namespace, created_at;
```
Response:
```json
{
  "project_id": "uuid-here",
  "project_name": "Sunrise Heights",
  "vdb_namespace": "uuid-here",
  "created_at": "2026-03-04T10:00:00"
}
```

---

### Delete a project ⚠️
```
DELETE /projects/{project_id}
```
**Cascades and permanently deletes all documents and FAQs for this project.**
The Default Project cannot be deleted (returns HTTP 400).

```bash
curl -X DELETE http://localhost:8000/projects/YOUR_UUID_HERE
```
SQL:
```sql
DELETE FROM projects WHERE project_id = 'YOUR_UUID_HERE'::uuid;
-- CASCADE automatically removes:
--   rag_documents  WHERE project_id = 'YOUR_UUID_HERE'
--   faq_entries    WHERE project_id = 'YOUR_UUID_HERE'
```
Response on success:
```json
{ "status": "success", "message": "Project YOUR_UUID_HERE deleted" }
```
Error responses:
- `400` — tried to delete the Default Project
- `404` — project_id not found

> **Frontend note:** `projectService.ts` currently has `getProjects` and `createProject` only.
> `deleteProject` is not yet wired in the frontend. Backend is ready — just needs:
> ```ts
> export const deleteProject = (id: string) =>
>   axiosInstance.delete(RAG_URLS.PROJECT(id)).then((r) => r.data);
> ```
> and `PROJECT: (id: string) => '/projects/${id}'` added to `RAG_URLS` in `urls.ts`.

---

## Documents (Upload)

### Upload a document
```
POST /upload
Content-Type: multipart/form-data
Fields:
  file       — required, the document (PDF/DOCX/XLSX/TXT, max 50 MB)
  project_id — optional UUID; defaults to Default Project if omitted
```
```bash
curl -X POST http://localhost:8000/upload \
  -F "file=@/path/to/brochure.pdf" \
  -F "project_id=YOUR_UUID_HERE"
```
What it does:
1. Parses file in-memory → extracts text
2. Chunks text (800 chars, 200 overlap, sentence-boundary)
3. Embeds chunks (fastembed BAAI/bge-large-en-v1.5, 1024 dims)
4. Stores vectors in `rag_documents` with `project_id`
5. Sends full text to LLM → extracts up to 25 FAQs → stores in `faq_entries`

SQL (vector insert, simplified):
```sql
INSERT INTO rag_documents (id, project_id, embedding, text, metadata, created_at)
VALUES ($1, $2::uuid, $3::vector, $4, $5::jsonb, NOW());
```
FAQ insert:
```sql
INSERT INTO faq_entries (project_id, question, answer, category, source_file)
VALUES ($1::uuid, $2, $3, $4, $5);
```
Response:
```json
{
  "filename": "brochure.pdf",
  "chunks_stored": 14,
  "message": "Successfully processed brochure.pdf",
  "faqs_generated": 12
}
```

---

## Querying

### Ask a question
```
POST /query
Content-Type: application/json
Body: { "question": "What is the price of 3BHK?", "project_id": "UUID", "top_k": 10 }
```
`project_id` and `top_k` are optional. Default project is used if `project_id` is omitted.

```bash
curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the price of 3BHK?", "project_id": "YOUR_UUID_HERE"}'
```
Pipeline:
1. **FAQ search first** (full-text, fast):
```sql
SELECT id, question, answer, category, source_file,
       ts_rank(to_tsvector('english', question), plainto_tsquery('english', $1)) AS rank
FROM faq_entries
WHERE project_id = $2
  AND to_tsvector('english', question) @@ plainto_tsquery('english', $1)
ORDER BY rank DESC
LIMIT 1;
-- Only returned if rank > 0.01
```
2. **RAG fallback** if no FAQ match:
```sql
SELECT id, text, metadata,
       1 - (embedding <=> $1::vector) AS similarity
FROM rag_documents
WHERE project_id = $2::uuid
  AND 1 - (embedding <=> $1::vector) >= 0.15
ORDER BY embedding <=> $1::vector
LIMIT 10;
```
Response:
```json
{
  "answer": "The 3BHK units at Sunrise Heights are priced at ₹85 lakhs...",
  "sources": [{"filename": "brochure.pdf", "relevance": 0.82}],
  "processing_time_ms": 340,
  "source_type": "faq"   // or "rag"
}
```

---

## FAQs

### Get all FAQs (grouped by category)
```
GET /faqs?project_id=UUID
```
`project_id` is optional — returns all FAQs across all projects if omitted.

```bash
curl "http://localhost:8000/faqs?project_id=YOUR_UUID_HERE"
```
SQL:
```sql
SELECT id, question, answer, category, source_file
FROM faq_entries
WHERE project_id = 'YOUR_UUID_HERE'::uuid
ORDER BY category, id;
```
Response shape:
```json
{
  "categories": [
    {
      "name": "Pricing",
      "color": "#3b82f6",
      "icon": "DollarSign",
      "faqs": [
        { "id": 1, "question": "...", "answer": "...", "source_file": "brochure.pdf" }
      ]
    }
  ],
  "total": 25
}
```
Fixed categories (always same 7, in order):
`Pricing`, `Amenities`, `Location`, `Process`, `Specifications`, `Security`, `General`

---

## System

### Health / status
```
GET /status
```
```bash
curl http://localhost:8000/status
```
Returns active providers, document count, and vector count.

### Reset all vectors
```
DELETE /reset
```
⚠️ Wipes ALL vectors from the vector DB. Does not touch `faq_entries` or `projects`.
```bash
curl -X DELETE http://localhost:8000/reset
```

---

## Direct Database Inspection

Useful queries to run directly in psql for debugging:

```sql
-- Count documents per project
SELECT p.project_name, COUNT(r.id) AS doc_chunks
FROM projects p
LEFT JOIN rag_documents r ON r.project_id = p.project_id
GROUP BY p.project_name;

-- Count FAQs per project
SELECT p.project_name, COUNT(f.id) AS faq_count
FROM projects p
LEFT JOIN faq_entries f ON f.project_id = p.project_id
GROUP BY p.project_name;

-- Show all FAQs for a specific project
SELECT id, category, question, source_file
FROM faq_entries
WHERE project_id = 'YOUR_UUID_HERE'::uuid
ORDER BY category, id;

-- Check if Default Project exists
SELECT project_id, project_name, vdb_namespace FROM projects WHERE vdb_namespace = 'default';

-- Show recent uploads
SELECT DISTINCT metadata->>'filename' AS file, created_at
FROM rag_documents
ORDER BY created_at DESC
LIMIT 10;
```
