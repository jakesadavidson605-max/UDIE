# UDIE implementation guide

## What is implemented

The repository now contains a deploy-safe, modular UDIE control plane. Persistent memory metadata, chunks, graph edges, ingestion jobs, and gateway configurations are stored through Drizzle/MySQL. Hybrid retrieval uses a native TypeScript BM25 implementation and persisted memory records; `CHROMA_URL` enables optional synchronization with a Chroma HTTP server. Knowledge-graph relationships are extracted from capitalized entities and persisted as weighted edges for later graph inspection.

The ingestion layer accepts text and URLs, cleans HTML, chunks source content with overlap, records ingestion jobs, preserves source URLs, and returns citation metadata. If `UDIE_ENABLE_PLAYWRIGHT=true` and the optional `playwright` package plus a browser executable are available, the crawler uses a rendered page; otherwise it falls back to a bounded `fetch` crawler.

Gateway routing supports the built-in Manus gateway, local Ollama, local vLLM, OpenRouter, OpenAI-compatible APIs, and Anthropic's Messages API. The selected route is controlled by the existing Hybrid / Local / Cloud UI selector. Gateway inventory and built-in model discovery are exposed through tRPC, with persisted gateway configuration support available through `udie.saveGateway`.

The orchestration pipeline runs Planner, Researcher, Executor, and Reviewer stages. It retrieves memory, compresses oversized context, optionally runs sandbox code, synthesizes through the selected gateway, and appends inspectable source citations and per-agent timing events. The sandbox enforces a deny policy before execution and supports three bounded attempts. It can use a remote Pyodide service (`UDIE_PYODIDE_URL`), an explicitly enabled Docker runner (`UDIE_SANDBOX_DOCKER=true`), or a deterministic no-side-effect preview in managed hosting.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `CHROMA_URL` | Optional Chroma HTTP endpoint for vector synchronization. |
| `UDIE_ENABLE_PLAYWRIGHT` | Set to `true` to prefer rendered crawling when Playwright is installed. |
| `UDIE_PYODIDE_URL` | Optional remote Pyodide execution service. |
| `UDIE_SANDBOX_DOCKER` | Set to `true` only on a host where Docker is intentionally available. |
| `UDIE_OLLAMA_URL` / `UDIE_OLLAMA_MODEL` | Local Ollama endpoint and model. |
| `UDIE_VLLM_URL` / `UDIE_VLLM_MODEL` | Local vLLM endpoint and model. |
| `OPENROUTER_API_KEY` / `UDIE_OPENROUTER_MODEL` | OpenRouter credentials and model. |
| `OPENAI_API_KEY` / `UDIE_OPENAI_MODEL` | OpenAI-compatible credentials and model. |
| `ANTHROPIC_API_KEY` / `UDIE_ANTHROPIC_MODEL` | Anthropic credentials and model. |

The managed WebDev deployment remains functional without any optional external service. In that mode, the built-in gateway, MySQL persistence, fetch crawler, native BM25 search, persisted graph edges, and static sandbox preview are the safe defaults.

## Local optional services

For a richer local deployment, run Chroma separately and provide `CHROMA_URL`; run Ollama or vLLM and provide the corresponding local endpoint; install Playwright and a compatible Chromium binary before enabling rendered crawling; and enable Docker execution only on a host with a controlled Docker daemon. The WebDev production container is intentionally not assumed to have Docker, Chromium, Python, or a long-running worker.

## Verification

The project includes unit coverage for seeded agents, fallback orchestration, memory tokenization, chunking, BM25 ranking, context compression, ingestion citations, and sandbox policy enforcement. Run:

```bash
pnpm test
pnpm check
pnpm build
```

The browser workspace exposes context ingestion under **Attach context**, gateway routing in the composer, per-agent orchestration traces under assistant messages, citations under retrieved responses, and safe sandbox execution under **Control plane → System**.
