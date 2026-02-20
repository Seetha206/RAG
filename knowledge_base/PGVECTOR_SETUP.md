# pgvector Setup Guide

Complete guide to setting up PostgreSQL with pgvector extension for your RAG system.

## What is pgvector?

**pgvector** is a PostgreSQL extension that adds vector similarity search capabilities to your PostgreSQL database.

### Why use pgvector?

✅ **FREE** - Open source, no licensing costs
✅ **Production-ready** - Built on PostgreSQL's reliability
✅ **SQL + Vector** - Combine relational queries with vector search
✅ **Persistent** - Data survives restarts automatically
✅ **Metadata filtering** - Filter by price, location, etc. THEN vector search
✅ **Existing infrastructure** - Use your current PostgreSQL setup

---

## Installation Options

### Option 1: Local PostgreSQL (Development)

#### Ubuntu/Debian

```bash
# Install PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Install pgvector extension
sudo apt install postgresql-15-pgvector
```

#### macOS (Homebrew)

```bash
# Install PostgreSQL
brew install postgresql@15

# Install pgvector
brew install pgvector
```

#### Windows

Download PostgreSQL from: https://www.postgresql.org/download/windows/

Then install pgvector:

```bash
# Using pg_config to compile
git clone --branch v0.5.1 https://github.com/pgvector/pgvector.git
cd pgvector
make
make install
```

---

### Option 2: Docker (Easiest for Development)

```bash
# Pull PostgreSQL image with pgvector
docker run -d \
  --name postgres-pgvector \
  -e POSTGRES_PASSWORD=mypassword \
  -e POSTGRES_DB=rag_db \
  -p 5432:5432 \
  ankane/pgvector
```

**Advantages:**

- No system installation needed
- Clean isolated environment
- Easy to reset/restart

---

Now you just need to enable the extension in psql. Run these commands:

psql

Inside psql (you should see reports=>), run:

CREATE EXTENSION vector;

Verify it worked:
\dx

You should see:
Name | Version | Schema | Description
---------+---------+------------+-------------------------------------------------------------
vector | 0.5.1 | public | vector data type and ivfflat and hnsw access methods

Then exit:
\q

Now you're ready! Let's test the RAG system:

cd /home/seetha/Documents/Seetha/RAG
pip install -r requirements_api.txt
python app.py

The extension is installed correctly - you just need to enable it in the database! 🎉

> seetha@centilio:~$ psql
> Password for user reports:
> psql (15.7 (Ubuntu 15.7-0ubuntu0.23.10.1))
> SSL connection (protocol: TLSv1.3, cipher: TLS_AES_256_GCM_SHA384, compression: off)
> Type "help" for help.

reports=> \dx
List of installed extensions
Name | Version | Schema | Description  
---------+---------+------------+------------------------------
plpgsql | 1.0 | pg_catalog | PL/pgSQL procedural language
(1 row)

reports=> CREATE EXTENSION vector;
ERROR: permission denied to create extension "vector"
HINT: Must be superuser to create this extension.

● You need superuser permissions to create the extension. Exit psql and reconnect as the postgres superuser:

\q

Then connect as postgres:

sudo -u postgres psql reports

Or:

sudo -u postgres psql

Then inside psql as postgres:

-- If you're not in the reports database, connect to it
\c reports

-- Now create the extension
CREATE EXTENSION vector;

-- Verify
\dx

-- Exit
\q

After this, you can use the reports user normally - the extension just needs to be created once by a superuser.

Then start your RAG system:

cd /home/seetha/Documents/Seetha/RAG
python app.py

> List of installed extensions
> Name | Version | Schema | Description  
> ---------+---------+------------+------------------------------------------------------
> plpgsql | 1.0 | pg_catalog | PL/pgSQL procedural language
> vector | 0.5.1 | public | vector data type and ivfflat and hnsw access methods
> (2 rows)

● Perfect! ✅ The vector extension is now installed successfully!

Now exit psql and start your RAG system:

\q

Then:

cd /home/seetha/Documents/Seetha/RAG
pip install -r requirements_api.txt

This will take a few minutes because it needs to:

- Install psycopg2-binary (PostgreSQL driver)
- Install sentence-transformers
- Download bge-large-en-v1.5 model (~1.3GB on first run)

After installation completes, start the server:

python app.py

# Expected output:

# Initializing RAG System...

Initializing local embeddings: BAAI/bge-large-en-v1.5
✓ Embedding model: BAAI/bge-large-en-v1.5 (1024 dims)
Initialized pgvector database: rag_documents
✓ Vector database: pgvector
✓ LLM: gemini-2.0-flash-exp (Gemini)
================================================================================
✓ RAG System Ready!
================================================================================

Then test it:

# In another terminal

curl -X POST "http://localhost:8000/upload" \
 -F "file=@./sample_documents/project_info.txt"

You're almost there! 🚀

### Option 3: Cloud PostgreSQL (Production)

#### Supabase (Recommended - FREE tier available)

1. Sign up: https://supabase.com
2. Create new project
3. pgvector is **pre-installed**! ✅
4. Copy connection string

**Free tier includes:**

- 500 MB database
- Unlimited API requests
- Auto-backups

#### AWS RDS PostgreSQL

1. Create RDS instance (PostgreSQL 15+)
2. Enable pgvector extension
3. Use connection string

#### Google Cloud SQL

1. Create PostgreSQL instance
2. Install pgvector extension
3. Use connection string

---

## Setup Steps

### Step 1: Start PostgreSQL

**Local:**

```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**Docker:**

```bash
docker start postgres-pgvector
```

---

### Step 2: Create Database and User

```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Or with Docker:
docker exec -it postgres-pgvector psql -U postgres
```

```sql
-- Create database
CREATE DATABASE rag_db;

-- Create user (optional, for production)
CREATE USER rag_user WITH PASSWORD 'secure_password';

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE rag_db TO rag_user;

-- Connect to the database
\c rag_db

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify installation
SELECT * FROM pg_extension WHERE extname = 'vector';
```

**Expected output:**

```
 extname | extowner | ...
---------+----------+----
 vector  |       10 | ...
```

---

### Step 3: Configure Connection String

Add to your `.env` file:

```bash
# For local PostgreSQL
PGVECTOR_CONNECTION_STRING=postgresql://postgres:password@localhost:5432/rag_db

# For Docker
PGVECTOR_CONNECTION_STRING=postgresql://postgres:mypassword@localhost:5432/rag_db

# For Supabase (example)
PGVECTOR_CONNECTION_STRING=postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres

# For cloud providers (example)
PGVECTOR_CONNECTION_STRING=postgresql://rag_user:secure_password@your-db-host.com:5432/rag_db
```

---

### Step 4: Update config.py

Already configured! Just verify:

```python
EMBEDDING_CONFIG = {
    "provider": "local",
    "model": "BAAI/bge-large-en-v1.5",
    "dimensions": 1024,  # Must match embedding model!
}

VECTOR_DB_CONFIG = {
    "provider": "pgvector",  # Using pgvector!
    "pgvector": {
        "connection_string": os.getenv("PGVECTOR_CONNECTION_STRING"),
        "table_name": "rag_documents",
    },
}
```

---

### Step 5: Install Python Dependencies

```bash
pip install psycopg2-binary
```

Already in `requirements_api.txt`! ✅

---

### Step 6: Test Connection

```bash
# Test PostgreSQL connection
psql "postgresql://postgres:password@localhost:5432/rag_db" -c "SELECT version();"

# Or with Python
python -c "
import psycopg2
conn = psycopg2.connect('postgresql://postgres:password@localhost:5432/rag_db')
print('Connection successful!')
conn.close()
"
```

---

### Step 7: Start Your RAG API

```bash
python app.py
```

**Expected output:**

```
================================================================================
Initializing RAG System...
================================================================================
✓ Embedding model: BAAI/bge-large-en-v1.5 (1024 dims)
Initialized pgvector database: rag_documents
✓ Vector database: pgvector
✓ LLM: gemini-2.0-flash-exp (Gemini)
================================================================================
✓ RAG System Ready!
================================================================================
```

---

## Verify Setup

### 1. Check Table Creation

```bash
psql "postgresql://postgres:password@localhost:5432/rag_db"
```

```sql
-- List tables
\dt

-- Should see:
--  Schema |     Name      | Type  |  Owner
-- --------+---------------+-------+----------
--  public | rag_documents | table | postgres

-- Describe table
\d rag_documents

-- Should see columns:
--  Column     |            Type             |
-- ------------+-----------------------------+
--  id         | text                        |
--  embedding  | vector(1024)                |
--  text       | text                        |
--  metadata   | jsonb                       |
--  created_at | timestamp without time zone |
```

---

### 2. Upload a Document

```bash
curl -X POST "http://localhost:8000/upload" \
  -F "file=@./sample_documents/project_info.txt"
```

---

### 3. Check Data in PostgreSQL

```sql
-- Count vectors
SELECT COUNT(*) FROM rag_documents;

-- View sample data
SELECT id, text, metadata, created_at
FROM rag_documents
LIMIT 3;

-- Check embedding dimensions
SELECT id, array_length(embedding::real[], 1) as dimensions
FROM rag_documents
LIMIT 1;
-- Should show: 1024
```

---

### 4. Test Vector Search

```sql
-- Example: Find similar vectors to a query
-- (This is done automatically by the API, but you can test manually)

SELECT id, text, metadata,
       1 - (embedding <=> '[0.1, 0.2, ...]'::vector) AS similarity
FROM rag_documents
ORDER BY embedding <=> '[0.1, 0.2, ...]'::vector
LIMIT 3;
```

---

## Advanced pgvector Features

### 1. Hybrid Queries (SQL + Vector Search)

```sql
-- Find apartments under 100 lakhs that are similar to query
SELECT id, text, metadata,
       1 - (embedding <=> query_vector) AS similarity
FROM rag_documents
WHERE metadata->>'price' < '100'
  AND metadata->>'type' = '3BHK'
ORDER BY embedding <=> query_vector
LIMIT 3;
```

**In config.py, you can customize search:**

```python
# In future: Add to vector_databases.py
def search_with_filter(query_embedding, metadata_filter):
    """Search with metadata filtering"""
    # WHERE metadata->>'price' < '100'
```

---

### 2. Index Optimization

After adding 10,000+ vectors, create index:

```sql
-- Create IVFFlat index for faster search
CREATE INDEX ON rag_documents
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Or HNSW index (better quality, slower build)
CREATE INDEX ON rag_documents
USING hnsw (embedding vector_cosine_ops);
```

---

### 3. Distance Metrics

Change similarity metric in `vector_databases.py`:

```python
# Cosine similarity (current, default)
ORDER BY embedding <=> query_vector

# L2 distance (Euclidean)
ORDER BY embedding <-> query_vector

# Inner product
ORDER BY embedding <#> query_vector
```

---

## Troubleshooting

### Error: "extension 'vector' does not exist"

**Solution:**

```sql
-- Connect as superuser
sudo -u postgres psql rag_db

-- Create extension
CREATE EXTENSION vector;
```

---

### Error: "psycopg2.OperationalError: could not connect"

**Solution:**

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Or with Docker:
docker ps | grep postgres

# Test connection manually
psql "postgresql://postgres:password@localhost:5432/rag_db"
```

---

### Error: "dimension mismatch"

**Solution:**
Ensure embedding dimensions in `config.py` match:

```python
EMBEDDING_CONFIG = {
    "dimensions": 1024,  # Must match BAAI/bge-large-en-v1.5
}
```

---

### Slow queries

**Solution:**

```sql
-- Create index (after adding data)
CREATE INDEX ON rag_documents
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Analyze table
ANALYZE rag_documents;
```

---

## Production Recommendations

### 1. Connection Pooling

Use pgBouncer for connection pooling:

```bash
sudo apt install pgbouncer
```

---

### 2. Backups

```bash
# Backup database
pg_dump rag_db > rag_db_backup.sql

# Restore
psql rag_db < rag_db_backup.sql
```

---

### 3. Monitoring

```sql
-- Check index usage
SELECT * FROM pg_stat_user_indexes
WHERE relname = 'rag_documents';

-- Check table size
SELECT pg_size_pretty(pg_total_relation_size('rag_documents'));
```

---

## Cost Comparison

| Setup                  | Cost            | Best For                 |
| ---------------------- | --------------- | ------------------------ |
| **Local PostgreSQL**   | FREE            | Development              |
| **Docker**             | FREE            | Development, testing     |
| **Supabase Free Tier** | FREE (500MB)    | Small projects, MVP      |
| **Supabase Pro**       | $25/month (8GB) | Production, small-medium |
| **AWS RDS**            | ~$15-50/month   | Enterprise, full control |
| **Google Cloud SQL**   | ~$20-60/month   | Enterprise, GCP users    |

---

## pgvector vs Other Options

| Feature                | pgvector        | FAISS      | Pinecone   |
| ---------------------- | --------------- | ---------- | ---------- |
| **Cost**               | FREE            | FREE       | $70/month  |
| **Persistence**        | ✅ Auto         | ❌ Manual  | ✅ Auto    |
| **SQL Queries**        | ✅ Yes          | ❌ No      | ❌ No      |
| **Metadata Filtering** | ✅ Full SQL     | ❌ Limited | ✅ Limited |
| **Scalability**        | Good (millions) | Excellent  | Excellent  |
| **Speed**              | Good            | Excellent  | Excellent  |
| **Setup Complexity**   | Medium          | Easy       | Easy       |
| **Infrastructure**     | Self-hosted     | Local      | Cloud      |

---

## Your Current Setup Summary

### Configuration (Already Set!)

- **Embeddings**: BAAI/bge-large-en-v1.5 (1024 dims, local, FREE)
- **Vector DB**: pgvector (PostgreSQL, FREE)
- **LLM**: Gemini 2.0 Flash Exp (latest, FREE tier)

### Total Cost: **$0/month** 🎉

### Performance:

- **Embedding Quality**: Excellent (top-tier local model)
- **Vector DB**: Production-ready, persistent
- **LLM**: Latest Gemini model, fast

---

## Quick Setup Checklist

- [ ] Install PostgreSQL (or use Docker)
- [ ] Install pgvector extension
- [ ] Create database and enable extension
- [ ] Add connection string to `.env`
- [ ] Install `psycopg2-binary`
- [ ] Verify `config.py` settings
- [ ] Start server: `python app.py`
- [ ] Upload test document
- [ ] Query and verify results

---

## Next Steps

1. **Setup PostgreSQL** (choose Docker for easiest)
2. **Update `.env`** with connection string
3. **Start server**: `python app.py`
4. **Upload documents**: Use curl or Postman
5. **Query**: Test your RAG system!

---

## Support

- **PostgreSQL Docs**: https://www.postgresql.org/docs/
- **pgvector GitHub**: https://github.com/pgvector/pgvector
- **Supabase**: https://supabase.com/docs
- **API Docs**: See `API_DOCUMENTATION.md`

Happy building with pgvector! 🐘🚀
