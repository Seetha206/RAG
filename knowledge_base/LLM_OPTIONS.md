# LLM Options for SellBot RAG

Alternatives to the current Gemini LLM for the answer generation step. The LLM only reads retrieved chunks and generates answers — it does not need to "know" real estate facts. A well-tuned 7B local model performs nearly as well as GPT-4 for this task.

**Current default:** Gemini `models/gemini-3-flash-preview` (Google cloud, free tier)

---

## Category 1: Free Cloud APIs

No model download. Requires API key. Data leaves your server.

| Model | Provider | Free Tier | Quality | Speed | Notes |
|---|---|---|---|---|---|
| Gemini 2.5 Flash | Google | Yes | Excellent | Fast | Current default |
| Gemini 2.5 Pro | Google | Limited | Best | Moderate | Higher quality, slower |
| **Groq + Llama3.1-8B** | Groq | **Yes (generous)** | Very good | **Fastest** | LPU hardware, ~10x faster than Gemini |
| Groq + Mixtral-8x7B | Groq | Yes | Excellent | Fast | Best free-tier quality |
| GPT-4o-mini | OpenAI | No (paid) | Excellent | Fast | Very cost-effective paid option |

**Groq** is the standout free alternative — same integration style as OpenAI (just swap key + base URL), free tier is very generous, and response speed is significantly faster than Gemini due to their LPU chips.

---

## Category 2: Fully Local via Ollama

No API key. No internet. No cost. Data never leaves your machine.
Requires Ollama daemon running before the RAG server starts.

| Model | Download Size | License | RAG Quality | RAM Needed |
|---|---|---|---|---|
| **Mistral 7B** | ~4 GB | Apache 2.0 | Excellent | ~6 GB |
| Llama 3.1 8B | ~5 GB | Meta (commercial OK) | Excellent | ~8 GB |
| Qwen2.5 7B | ~5 GB | Apache 2.0 | Very good | ~8 GB |
| Phi-3.5 Mini (3.8B) | ~2 GB | **MIT** | Good | ~4 GB |
| LFM2-1.2B-RAG | ~1 GB | Liquid AI | Good (RAG-tuned) | ~2 GB |

**Mistral 7B** is the recommended local option — best accuracy-to-size ratio, Apache 2.0 licensed, well-supported in Ollama.

**LFM2-1.2B-RAG** by Liquid AI is specifically fine-tuned for RAG tasks (reads context, avoids hallucination). Useful if RAM is very limited.

---

## Decision Guide

| Priority | Recommendation |
|---|---|
| Keep it simple, stay cloud | Stay on Gemini (current) |
| Free cloud, faster responses | Groq + Llama3.1-8B |
| Fully offline, best quality | Mistral 7B via Ollama |
| Fully offline, low RAM | Phi-3.5 Mini (MIT) via Ollama |
| Fully offline, RAG-optimized | LFM2-1.2B-RAG via Ollama |
| Best accuracy, budget available | GPT-4o-mini (OpenAI) |

---

## How to Switch

Change two lines in `config.py` under `LLM_CONFIG`:

```python
# Groq (free cloud, fast)
"provider": "groq",
"model": "llama-3.1-8b-instant"

# Ollama (local)
"provider": "ollama",
"model": "mistral"

# OpenAI
"provider": "openai",
"model": "gpt-4o-mini"
```

Each requires adding a new `elif` branch in `src/llm.py` (`create_llm_client()` and `generate_answer()`).

---

## Current Stack Summary

```
Embeddings:  fastembed → BAAI/bge-large-en-v1.5 (ONNX, no torch, Apache 2.0)
Vector DB:   pgvector  (PostgreSQL, MIT)
LLM:         Gemini 2.x Flash (Google cloud, proprietary, free tier)
```
