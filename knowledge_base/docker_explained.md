# Docker Explained: What It Is and Why We Use It

This document explains Docker in plain terms — no prior knowledge assumed — and then explains exactly what each Dockerfile in this project does and why.

---

## What Is Docker?

Imagine you built a great application on your laptop. It works perfectly. Then you try to run it on a server (or a friend's computer), and it breaks — because the server has a different version of Python, or a missing library, or a different OS.

**Docker solves this problem.**

Docker packages your entire application — the code, the Python version, all libraries, all system tools — into a single portable unit called a **container**. The container runs the same way on every machine: your laptop, a server in the cloud, a colleague's computer.

Think of it like this:

> **Without Docker:** "It works on my machine" — and nowhere else
> **With Docker:** "It works in the container" — everywhere

---

## Key Terms (Plain English)

| Term | What It Means |
|------|--------------|
| **Image** | A blueprint/template. Like a recipe. Read-only. |
| **Container** | A running instance of an image. Like a dish cooked from a recipe. |
| **Dockerfile** | A text file with instructions to build an image. You write it once. |
| **Build** | The process of turning a Dockerfile into an image (runs the instructions). |
| **Layer** | Each instruction in a Dockerfile creates a layer. Layers are cached — if nothing changed, Docker skips re-running that step. |
| **Docker Hub** | A public registry of pre-built images (like `python:3.11-slim`, `nginx:alpine`). |
| **.dockerignore** | Like `.gitignore` — tells Docker which files NOT to copy into the image. |

---

## What Is a Dockerfile?

A Dockerfile is a set of step-by-step instructions for building a Docker image. Each instruction is one line. Docker runs them in order to produce the final image.

**Simple analogy:** A Dockerfile is like a recipe card:
1. Start with a base ingredient (`FROM python:3.11-slim` → start with Python already installed)
2. Add your ingredients (`COPY requirements.txt .` → bring in your file)
3. Cook (`RUN pip install -r requirements.txt` → run a command)
4. Serve (`CMD uvicorn app:app` → what to do when the container starts)

---

## This Project's Dockerfiles

The project has **two Dockerfiles** — one for each part of the application:

```
RAG/                   ← Project root
├── Dockerfile         ← Builds the FastAPI backend container
└── RAG/
    └── Dockerfile     ← Builds the React frontend container
```

They are separate because the frontend and backend are different technologies (Python vs JavaScript) and need to run as separate services.

---

## Backend Dockerfile — Line by Line

**File:** `Dockerfile` (project root)

```dockerfile
FROM python:3.11-slim
```
**What it does:** Starts with a pre-built Python 3.11 image from Docker Hub. The `-slim` version is stripped down (smaller, faster downloads) but still has everything Python needs.

**Why this specific base:** Your app requires Python 3.11+. Starting from this base means Python is already installed — you don't need to install it yourself.

---

```dockerfile
WORKDIR /app
```
**What it does:** All following commands run inside the `/app` folder inside the container.

**Why:** Keeps everything organized in one directory, similar to `cd /app` before running your app.

---

```dockerfile
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*
```
**What it does:** Installs Linux system tools.

**Why:** `sentence-transformers` (the embedding library) needs `build-essential` to compile some native code. `curl` is useful for debugging. The last line deletes the apt package cache to keep the image smaller.

---

```dockerfile
COPY requirements_api.txt .
RUN pip install --no-cache-dir -r requirements_api.txt
```
**What it does:** Copies `requirements_api.txt` into the container, then installs all Python packages listed in it.

**Why copy requirements BEFORE the code?** Docker caches layers. If you change a `.py` file, Docker only re-runs steps from that point forward — it does NOT re-run `pip install` (which takes minutes) because `requirements_api.txt` didn't change. This makes rebuilds much faster.

---

```dockerfile
RUN python -c "\
from sentence_transformers import SentenceTransformer; \
SentenceTransformer('BAAI/bge-large-en-v1.5'); \
print('Embedding model downloaded successfully')"
```
**What it does:** Downloads the BAAI/bge-large-en-v1.5 embedding model (~1.3 GB) and bakes it into the Docker image.

**Why:** Without this, the first time someone makes an API request, the server would try to download a 1.3 GB model on-the-fly, causing a ~5-minute delay before the first response. By downloading it during `docker build`, the model is already in the image and every request is instant from the start.

**Trade-off:** The Docker image is larger (~2 GB) but the app is ready immediately.

---

```dockerfile
COPY app.py config.py ./
COPY src/ ./src/
```
**What it does:** Copies your application code into the container.

**Why these files specifically:** Only the files needed to run the API — `app.py` (the server), `config.py` (settings), `src/` (core modules). Test files, documentation, and other extras are excluded by `.dockerignore`.

---

```dockerfile
ENV PORT=8000
EXPOSE 8000
CMD uvicorn app:app --host 0.0.0.0 --port $PORT
```
**What it does:**
- `ENV PORT=8000` — sets a default port (Railway overrides this with its own PORT variable)
- `EXPOSE 8000` — documents that the container listens on port 8000 (informational only)
- `CMD ...` — the command that runs when the container starts (launches your FastAPI server)

**Why `--host 0.0.0.0`:** By default Uvicorn only accepts connections from `localhost` (the container itself). `0.0.0.0` means "accept connections from anywhere" — required so Railway can route traffic to it.

---

## Frontend Dockerfile — Line by Line

**File:** `RAG/Dockerfile`

This one uses a **two-stage build** — a technique that produces a tiny final image.

### Stage 1: Build

```dockerfile
FROM node:20-alpine AS build
```
**What it does:** Starts with Node.js 20 (Alpine Linux = very small OS). Named `build` so Stage 2 can reference it.

**Why Node.js here:** The React app needs Node.js and npm to compile TypeScript and bundle everything with Vite. But we don't want Node.js in the final running container.

---

```dockerfile
COPY package*.json ./
RUN npm ci
```
**What it does:** Copies `package.json` and `package-lock.json`, then installs all npm packages.

**Why `npm ci` instead of `npm install`:** `npm ci` is faster and stricter — it installs the exact versions from `package-lock.json` with no surprises. Used in automated builds.

**Why copy package files before source code:** Same caching trick as the backend — if source code changes but `package.json` doesn't, Docker skips `npm install` on rebuild.

---

```dockerfile
COPY . .
ARG VITE_API_BASE_URL=http://localhost:8000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build
```
**What it does:**
1. Copies all frontend source files
2. Takes the backend URL as a build argument (Railway passes this in during build)
3. Sets it as an environment variable that Vite can read
4. Runs `tsc -b && vite build` → compiles TypeScript, bundles everything into `/app/dist/` (static HTML, CSS, JS files)

**Why bake the URL at build time:** Vite replaces `import.meta.env.VITE_API_BASE_URL` in the code at compile time. After compilation, the URL is hardcoded in the JavaScript files. This is how Vite handles environment variables — they must be known at build time.

---

### Stage 2: Serve

```dockerfile
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
```
**What it does:** Starts a fresh, clean Nginx container (tiny web server, ~25 MB). Copies only the compiled files from Stage 1 — not Node.js, not npm, not source code.

**Why Nginx instead of Node.js:** The compiled React app is just HTML + CSS + JavaScript files. You don't need Node.js to serve static files — that would be like using a semi-truck to deliver a letter. Nginx is a high-performance static file server that uses minimal RAM.

**Result:** The final image is ~25 MB instead of ~1 GB.

---

```dockerfile
RUN printf 'server {\n\
    listen 80;\n\
    location / {\n\
        root /usr/share/nginx/html;\n\
        index index.html;\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf
```
**What it does:** Writes an Nginx config file that:
- Serves files from `/usr/share/nginx/html`
- For any URL that doesn't match a file, falls back to `/index.html`

**Why the fallback to `index.html`:** React Router handles routing in the browser. If a user goes directly to `https://yourapp.com/chat`, Nginx looks for a file called `chat` — which doesn't exist. Without the fallback, they get a 404 error. With `try_files ... /index.html`, Nginx serves `index.html` and React Router takes over to show the right page.

---

## What Is .dockerignore?

`.dockerignore` tells Docker which files to skip when copying from your computer into the image. Similar to `.gitignore`.

**Without `.dockerignore`:** Docker copies everything — including `venv/` (2 GB of Python packages), `node_modules/` (500 MB of npm packages), `.git/` (all git history), etc. This makes builds slow and images huge.

**With `.dockerignore`:** Only the files your app actually needs get copied, making the `COPY` step fast.

**This project's `.dockerignore` excludes:**
- `venv/` — Python packages are installed fresh inside the container
- `node_modules/` — npm packages are installed fresh inside the frontend container
- `vector_store/`, `knowledge_base.index` — large binary files not needed at runtime
- `.env` — secrets should NEVER be baked into an image (use environment variables instead)
- `knowledge_base/`, `real_estate_documents/` — documentation not needed by the API

---

## Two-Stage Build: Why It Matters

The frontend Dockerfile uses a two-stage build. Here's the size comparison:

| Approach | Final Image Size | What It Contains |
|----------|-----------------|-----------------|
| Single stage (naive) | ~1.2 GB | Node.js + npm + all packages + source code + compiled output |
| Two-stage build | ~25 MB | Compiled HTML/CSS/JS files only |

Smaller images = faster deploys, less storage cost on Railway, faster container startup.

---

## The Full Picture: How Docker Fits Into Railway Deployment

```
Your laptop
    |
    | git push
    v
GitHub (Seetha206/RAG)
    |
    | Railway detects push (auto-deploy)
    v
Railway Build Server
    |
    |--- reads Dockerfile (root)         → builds backend image
    |--- reads RAG/Dockerfile            → builds frontend image
    v
Railway Container Runtime
    |
    |--- starts Backend container  (port 8000) ─── reads GEMINI_API_KEY, PGVECTOR_CONNECTION_STRING from Railway env vars
    |--- starts Frontend container (port 80)   ─── was given VITE_API_BASE_URL at build time
    |--- starts PostgreSQL container (port 5432) ── internal only
    v
Live at:
    https://your-backend.up.railway.app   (backend)
    https://your-frontend.up.railway.app  (frontend)
```

---

## Files Created

| File | Purpose |
|------|---------|
| `Dockerfile` | Instructions to build the FastAPI backend container |
| `RAG/Dockerfile` | Instructions to build the React frontend container |
| `.dockerignore` | Files to exclude from the backend image build |
| `RAG/.dockerignore` | Files to exclude from the frontend image build |

---

## Related Files

- `knowledge_base/RAILWAY_DEPLOYMENT.md` — Full step-by-step Railway deployment guide
- `requirements_api.txt` — Python packages installed in the backend image
- `RAG/package.json` — npm packages and build scripts for the frontend image
- `config.py` — API_CONFIG (CORS origins need the Railway frontend URL added)
