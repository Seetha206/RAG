# ============================================================
# SellBot RAG — FastAPI Backend
# Runs on: Railway, Render, Fly.io, any Docker host
# ============================================================

FROM python:3.11-slim

WORKDIR /app

# Install system build tools needed by some Python packages
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first so Docker can cache this layer.
# Only re-runs pip install when requirements_api.txt changes.
COPY requirements_api.txt .

RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements_api.txt

# NOTE: Model (BAAI/bge-large-en-v1.5, ~1.3 GB) downloads at first startup.
# Pre-downloading here causes Railway build timeouts.
# First server startup takes ~2-3 min while the model downloads — subsequent starts are instant.

# Copy application code
COPY app.py config.py ./
COPY src/ ./src/

# Railway and most platforms set PORT via environment variable.
# Default to 8000 if not set.
ENV PORT=8000

EXPOSE 8000

# Use shell form so $PORT is expanded at runtime
CMD uvicorn app:app --host 0.0.0.0 --port $PORT
