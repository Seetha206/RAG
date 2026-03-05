# Ollama + LFM2 Local LLM Guide

## Why We Used It

During SESSION_004 (2026-02-25) we tested **Ollama** with the **sam860/LFM2:1.2b** model
as a local, offline alternative to Gemini. The reasons:

| Reason | Detail |
|--------|--------|
| **Privacy** | All inference runs on your machine — no data leaves the system |
| **Zero API cost** | No API key, no usage limits, no billing |
| **RAG-tuned model** | LFM2:1.2b is specifically fine-tuned for retrieval-augmented generation (by Liquid AI) |
| **Tiny footprint** | Only ~1 GB — runs on CPU with 8 GB RAM, no GPU needed |
| **Offline capable** | Works without internet after the one-time model pull |

The trade-off vs Gemini 2.5 Flash:
- Answer quality is noticeably lower (1.2B parameters vs ~80B+ in Gemini)
- Response speed is slower on CPU (~5–15s vs ~2s for Gemini)
- No multimodal / reasoning capabilities

**Current active LLM:** Gemini 2.5 Flash (switched back in SESSION_007 — better quality for production).
The Ollama code path remains in `src/llm.py` and can be re-enabled in one line in `config.py`.

---

## How to Enable Ollama (When Needed)

### Step 1 — Install Ollama (system-level, not pip)

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

Verify:
```bash
ollama --version
```

Ollama is **not a Python package**. It is a standalone server that exposes a local HTTP API
at `http://localhost:11434`. The Python code in `src/llm.py` uses `httpx` to call it —
`httpx` is already installed (it is also a dependency of `google-genai`), so no extra
`pip install` is needed.

### Step 2 — Pull the LFM2 model

```bash
ollama pull sam860/LFM2:1.2b
```

This downloads ~1 GB on first run. The model is cached at `~/.ollama/models/`.

Other good RAG models available via Ollama:

| Model | Size | Licence | Notes |
|-------|------|---------|-------|
| `sam860/LFM2:1.2b` | ~1 GB | Apache 2.0 | RAG-tuned by Liquid AI — best for this project |
| `mistral` | ~4 GB | Apache 2.0 | Strong general model |
| `llama3.1` | ~4.7 GB | Llama 3 | Meta's flagship open model |
| `phi3.5` | ~2.2 GB | MIT | Microsoft, fast on CPU |
| `qwen2.5:7b` | ~4.7 GB | Apache 2.0 | Strong at instruction following |

### Step 3 — Start the Ollama server

```bash
ollama serve
```

Keep this terminal open while the backend is running. Alternatively, add it as a
`systemd` service (Ollama installer usually does this automatically on Linux).

### Step 4 — Switch config.py

In `config.py`, change **two lines** inside `LLM_CONFIG`:

```python
"provider": "ollama",           # was "gemini"
"model": "sam860/LFM2:1.2b",   # was "gemini-2.5-flash"
```

Then restart the backend:
```bash
uvicorn app:app --reload
```

### Switching back to Gemini

```python
"provider": "gemini",
"model": "gemini-2.5-flash",
```

Ensure `GEMINI_API_KEY` is set in `.env`.

---

## How the Code Works

The Ollama integration lives entirely in `src/llm.py`:

```python
# create_llm_client() — returns a plain dict (no SDK object needed)
elif provider == "ollama":
    return {"type": "ollama", "base_url": LLM_CONFIG.get("ollama_base_url", "http://localhost:11434")}

# generate_answer() — calls Ollama REST API directly with httpx
elif LLM_CONFIG["provider"] == "ollama":
    import httpx
    base_url = llm_client.get("base_url", "http://localhost:11434")
    response = httpx.post(
        f"{base_url}/api/generate",
        json={"model": LLM_CONFIG["model"], "prompt": prompt, "stream": False},
        timeout=120.0
    )
    return response.json()["response"]
```

Key points:
- `stream: False` — waits for the full response before returning (simpler, no streaming parser needed)
- `timeout=120.0` — 2-minute timeout handles slow CPU inference
- The Ollama HTTP API is OpenAI-compatible; `/api/generate` is the non-streaming endpoint

---

## Uninstalling Ollama (If Needed)

Ollama is a system app, not in the Python venv. To remove it:

```bash
# Stop the service
sudo systemctl stop ollama
sudo systemctl disable ollama

# Remove the binary
sudo rm /usr/local/bin/ollama

# Remove model cache (~/.ollama/ can be several GB)
rm -rf ~/.ollama
```

The Python venv requires **no changes** — `httpx` stays (it is also needed by `google-genai`).
