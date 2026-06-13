# Discourse Brief: Ollama (local LLM runtime)

> Generated 2026-06-13 via /blog discourse. Window: last ~12 months (weighted to 2026).
> Sources scanned: ~25 across GitHub, Reddit, dev.to, NVIDIA forums, comparison blogs.

## Decomposition

1. What is Ollama's current state in 2026 (version, architecture, features)?
2. What do people actually struggle with (GPU, OOM, speed, concurrency, networking)?
3. What do they compare it against and when do they switch?

## What's NEW (verified, so the rewrite is not stale)

- **Latest release is v0.30.8, published June 12, 2026** (confirmed via the [GitHub releases API](https://api.github.com/repos/ollama/ollama/releases/latest)). The v0.30.x line is active and frequently updated.
- **MLX is now the default Apple Silicon backend** (v0.19+), with benchmarks around 1.6x prefill and roughly 2x decode versus the older path. Recent releases add prompt caching with better KV cache reuse and speculative decoding in the MLX runner.
- **Better VRAM handling.** `ollama run --verbose` now reports peak memory, and Ollama auto-shrinks context to fit available VRAM instead of crashing or silently spilling to CPU.

> Note: several SEO/content-farm pages list features like "OpenClaw WhatsApp/Telegram setup" and specific older version numbers (v0.21, v0.22.1) that conflict with the GitHub API. Treated as unreliable; only GitHub-verified facts used.

## Consensus across platforms

- **Ollama is the easiest on-ramp to local LLMs:** one-line install, `ollama pull`, `ollama run`. Universally agreed entry point ([codersera](https://codersera.com/blog/ollama-vs-lm-studio-vs-vllm-vs-llama-cpp-vs-mlx-2026/), [dev.to](https://dev.to/thurmon_demich/ollama-vs-llamacpp-vs-vllm-which-should-you-use-in-2026-10gp)).
- **GPU-not-used / silent CPU fallback is the #1 pain.** If a model does not fit VRAM, layers spill to CPU and it crawls; diagnose with `ollama ps` ([InsiderLLM fix guide](https://insiderllm.com/guides/ollama-not-using-gpu-fix/)).
- **OOM is fixed via `num_ctx` / `num_gpu`;** OOM appears consistently at `num_ctx` 4096+ on smaller cards ([GitHub issues](https://github.com/ollama/ollama/issues/3460)).
- **Concurrency is the wall.** Ollama has no PagedAttention or continuous batching; P95 latency spikes past ~5-10 concurrent users. For multi-user serving, vLLM does roughly 16-20x the concurrent throughput ([quantizelab benchmarks](https://www.quantizelab.dev/articles/vllm-vs-llama-cpp-vs-ollama-benchmark-guide)).

## Niche / single-source themes

- **llama.cpp is ~15-25% faster single-user** than Ollama because Ollama wraps it; worth dropping down to for embedded or thousands-of-calls workloads.

## Practitioner specifics (commands, configs)

- Diagnose GPU/CPU split: `ollama ps`. Peak memory: `ollama run <model> --verbose`.
- OOM fixes: lower `num_ctx`, set `num_gpu`, pick a smaller quant (e.g. Q4_K_M).
- Network exposure: `OLLAMA_HOST=0.0.0.0` and open port 11434; `OLLAMA_ORIGINS` for browser apps.
- Concurrency tuning: `OLLAMA_NUM_PARALLEL`, `OLLAMA_MAX_LOADED_MODELS` (but switch to vLLM for real serving).
- OpenAI-compatible API at `http://localhost:11434/v1`.

## Source list

| Platform | Scanned | Useful | Notes |
|---|---|---|---|
| GitHub | 4 | 3 | releases API (version truth), issues 3460/3349 |
| Comparison blogs / dev.to | 8 | 6 | Ollama vs llama.cpp vs vLLM vs LM Studio (2026) |
| Reddit / forums | 6 | 3 | GPU/OOM threads, NVIDIA Jetson forum |
| Vendor / docs | 4 | 3 | ollama.com, install docs |
| Content farms | 3 | 0 | conflicting versions / likely-hallucinated features, discarded |
