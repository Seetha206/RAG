# Railway Deployment Guide: Full-Stack RAG on a Single Platform

Deploy the complete SellBot RAG system (React frontend + FastAPI backend + PostgreSQL/pgvector) on Railway from a single GitHub repo.

---

## Why Railway?

| Requirement | Railway | Render |
|-------------|---------|--------|
| pgvector support | One-click template, pre-installed | Supported but free DB expires in **30 days** |
| Free tier | $5 trial credit (no card), then $5/mo Hobby | Free but DB deleted after 30 days |
| All 3 services | Yes — frontend, backend, DB in one project | Yes |
| Internal networking | Yes — services connect via private URLs | Yes |
| GitHub auto-deploy | Yes — push to deploy | Yes |
| Persistent DB storage | Yes — no expiry | No — 30-day expiry on free tier |
| Secure env vars | Yes — per-service variables | Yes |

**Railway wins** because the database is persistent (no 30-day deletion) and pgvector comes pre-installed via templates.

---

## Cost

- **Trial:** $5 free credit, no credit card required, 30 days
- **Hobby plan:** $5/month (includes $5 usage credit)
- **Estimated usage for light traffic (< 100 queries/day):**
  - PostgreSQL: ~$1-2/mo (256 MB RAM, 1 GB storage)
  - FastAPI backend: ~$1-2/mo (512 MB RAM)
  - React static site: ~$0.50/mo
  - **Total: ~$3-5/mo** (covered by Hobby plan credit)

---

## Architecture on Railway

```
GitHub Repo (Seetha206/RAG)
        |
        v
Railway Project
├── [Service 1] React Frontend     ← builds from RAG/ directory
│   └── Static site served by Vite/Nginx
│       └── Makes API calls to → Backend public URL
│
├── [Service 2] FastAPI Backend    ← builds from root directory
│   └── Connects internally to → PostgreSQL
│       └── Uses PGVECTOR_CONNECTION_STRING (private)
│
└── [Service 3] PostgreSQL + pgvector
    └── Persistent storage, HNSW index, 1024-dim vectors
```

---

## Step-by-Step Deployment

### Step 1: Prepare the Repo

You need 3 config files in your repo to tell Railway how to build each service.

#### 1a. Backend Dockerfile — `Dockerfile` (project root)

Create this file in the project root:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for sentence-transformers
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (Docker layer caching)
COPY requirements_api.txt .
RUN pip install --no-cache-dir -r requirements_api.txt

# Pre-download the embedding model (avoids delay on first request)
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('BAAI/bge-large-en-v1.5')"

# Copy application code
COPY app.py config.py ./
COPY src/ ./src/

# Expose port
EXPOSE 8000

# Start server
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
```

#### 1b. Frontend Dockerfile — `RAG/Dockerfile`

Create this in the RAG/ directory:

```dockerfile
FROM node:20-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Build with production API URL (set via Railway env var)
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

# Serve with lightweight nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html

# Handle SPA routing
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### 1c. Railway config — `railway.json` (project root)

This is optional but helps organize multi-service deploys:

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### Step 2: Create Railway Account

1. Go to [railway.com](https://railway.com)
2. Sign up with your GitHub account (Seetha206)
3. You get $5 free trial credit — no credit card needed

### Step 3: Create the Project

1. Click **"New Project"** in Railway dashboard
2. Select **"Deploy from GitHub Repo"**
3. Connect your `Seetha206/RAG` repository

### Step 4: Add PostgreSQL with pgvector

1. In your Railway project, click **"+ New"** → **"Database"** → **"PostgreSQL"**
2. Or use the pgvector template: go to [railway.com/deploy/pgvector-latest](https://railway.com/deploy/pgvector-latest)
3. Once deployed, click on the PostgreSQL service → **"Variables"** tab
4. Copy the `DATABASE_URL` — it looks like:
   ```
   postgresql://postgres:PASSWORD@HOST.railway.internal:5432/railway
   ```
5. Connect to the database and enable pgvector:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
   (Railway's pgvector template does this automatically)

### Step 5: Deploy the FastAPI Backend

1. In your Railway project, click **"+ New"** → **"GitHub Repo"** → select `Seetha206/RAG`
2. Railway auto-detects the `Dockerfile` in root and builds the backend
3. Go to **"Variables"** tab and add:

   | Variable | Value |
   |----------|-------|
   | `GEMINI_API_KEY` | Your Gemini API key |
   | `PGVECTOR_CONNECTION_STRING` | `${{Postgres.DATABASE_URL}}` (Railway reference variable — auto-fills the internal DB URL) |
   | `PORT` | `8000` |

4. Go to **"Settings"** → **"Networking"** → **"Generate Domain"** to get a public URL
5. Your backend is now live at `https://your-backend.up.railway.app`

### Step 6: Deploy the React Frontend

1. Click **"+ New"** → **"GitHub Repo"** → select `Seetha206/RAG` again
2. Go to **"Settings"**:
   - Set **Root Directory** to `RAG`
   - Set **Dockerfile Path** to `RAG/Dockerfile`
3. Go to **"Variables"** tab and add:

   | Variable | Value |
   |----------|-------|
   | `VITE_API_BASE_URL` | `https://your-backend.up.railway.app` (the backend URL from Step 5) |

4. Go to **"Settings"** → **"Networking"** → **"Generate Domain"**
5. Your frontend is now live at `https://your-frontend.up.railway.app`

### Step 7: Update Backend CORS

Add your frontend's Railway URL to the CORS origins. In `config.py`:

```python
API_CONFIG = {
    "host": "0.0.0.0",
    "port": 8000,
    "cors_origins": [
        "http://localhost:3000",                           # Local dev
        "https://your-frontend.up.railway.app",            # Railway frontend
    ],
}
```

Commit and push — Railway auto-redeploys.

---

## Environment Variables Summary

### Backend Service

| Variable | Source | Example |
|----------|--------|---------|
| `GEMINI_API_KEY` | Your Google AI Studio key | `AIza...` |
| `PGVECTOR_CONNECTION_STRING` | Railway reference to Postgres | `${{Postgres.DATABASE_URL}}` |
| `PORT` | Railway convention | `8000` |

### Frontend Service

| Variable | Source | Example |
|----------|--------|---------|
| `VITE_API_BASE_URL` | Backend's Railway public URL | `https://rag-backend.up.railway.app` |

### PostgreSQL (auto-configured by Railway)

Railway automatically generates `DATABASE_URL`, `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` for the PostgreSQL service.

---

## Internal vs External Networking

```
Frontend (public)  ──HTTP──>  Backend (public + internal)  ──TCP──>  PostgreSQL (internal only)
   :80                           :8000                                  :5432
```

- **Frontend → Backend:** Uses the backend's **public URL** (HTTPS). The frontend runs in the user's browser, so it must reach the backend over the internet.
- **Backend → PostgreSQL:** Uses Railway's **internal network** (`railway.internal`). The connection string uses the private hostname, so the DB is never exposed to the internet.

---

## Verify Deployment

### 1. Check backend health
```bash
curl https://your-backend.up.railway.app/status
```

Expected:
```json
{
  "status": "running",
  "total_documents": 0,
  "total_chunks": 0,
  "embedding_model": "local/BAAI/bge-large-en-v1.5",
  "vector_db_provider": "pgvector",
  "llm_model": "gemini/..."
}
```

### 2. Upload a test document
```bash
curl -X POST "https://your-backend.up.railway.app/upload" \
  -F "file=@./real_estate_documents/01_Sunrise_Heights_Premium_Apartments.pdf"
```

### 3. Query
```bash
curl -X POST "https://your-backend.up.railway.app/query" \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the price of 3 BHK in Sunrise Heights?"}'
```

### 4. Open frontend
Visit `https://your-frontend.up.railway.app` in your browser.

---

## Important Notes

### Embedding Model Size
The BAAI/bge-large-en-v1.5 model is ~1.3 GB. The Docker build pre-downloads it (Step 1a), so:
- First build takes ~5-10 minutes (downloading model)
- Subsequent builds use Docker cache and are much faster
- Railway's build environment has sufficient memory for this

### Sleep Behavior
Railway Hobby plan services **do not sleep** (unlike Render free tier). Your backend stays warm and responsive 24/7.

### Custom Domain
In Railway, go to **Settings** → **Networking** → **Custom Domain** to connect your own domain (e.g., `sellbot.yourdomain.com`).

### Auto-Deploy
Every `git push` to your `main` branch triggers an automatic rebuild and redeploy of all services connected to the repo.

### Monitoring
Railway provides built-in logs, metrics (CPU, RAM, network), and deployment history in the dashboard. Click on any service → **"Logs"** tab.

---

## Troubleshooting

### "Connection refused" from backend to PostgreSQL
- Ensure `PGVECTOR_CONNECTION_STRING` uses the **internal** Railway hostname (ending in `.railway.internal`)
- Check that the PostgreSQL service is running in the same Railway project

### "CORS error" in browser
- Add your frontend's Railway URL to `API_CONFIG["cors_origins"]` in `config.py`
- Make sure it's the exact URL including `https://`

### "Model download fails" during build
- Railway's build environment has limited memory. If the build fails, try adding to Dockerfile:
  ```dockerfile
  ENV TRANSFORMERS_CACHE=/app/.cache
  ```
- Or switch to a smaller model temporarily: `all-MiniLM-L6-v2` (384 dims, ~80 MB)

### Build timeout
- Railway has a 20-minute build timeout. The embedding model download (~1.3 GB) may take time on first build
- If it times out, the cached layers will speed up the next attempt

---

## Alternative: Lighter Deployment (If Budget Is Tight)

If the $5/mo Hobby plan is a concern, consider this split approach:

| Service | Platform | Cost | Notes |
|---------|----------|------|-------|
| Frontend | Vercel or Netlify | Free forever | Static site hosting |
| Backend | Railway or Render | $5/mo or free (with sleep) | FastAPI server |
| Database | Neon or Supabase | Free (0.5 GB) | PostgreSQL with pgvector |

This requires managing 2-3 platforms but keeps costs at $0-5/mo.

---

## Related Files

- `Dockerfile` — Backend Docker build (to be created)
- `RAG/Dockerfile` — Frontend Docker build (to be created)
- `config.py` — API_CONFIG cors_origins needs Railway frontend URL
- `requirements_api.txt` — Python dependencies installed in Docker
- `RAG/package.json` — Frontend build command (`npm run build`)
- `.env.example` — Template for environment variables

---

## Sources

- [Railway Pricing](https://railway.com/pricing)
- [Railway pgvector Template](https://railway.com/deploy/pgvector-latest)
- [Railway PostgreSQL Docs](https://docs.railway.com/databases/postgresql)
- [Railway Free Trial](https://docs.railway.com/reference/pricing/free-trial)
- [Render PostgreSQL pgvector](https://render.com/articles/simplify-ai-stack-managed-postgresql-pgvector)
- [Render Free PostgreSQL 30-Day Expiry](https://render.com/changelog/free-postgresql-instances-now-expire-after-30-days-previously-90)
- [Railway vs Render Comparison](https://northflank.com/blog/railway-vs-render)
