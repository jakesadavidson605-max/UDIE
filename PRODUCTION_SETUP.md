# UDIE production setup

## Service configuration

Set `CHROMA_URL` to the reachable Chroma HTTP service URL. UDIE creates or reuses the `udie_memory` collection, indexes source chunks with metadata, and queries vector results alongside MySQL-backed BM25 results. The hybrid score fuses sparse and vector signals before citations are generated.

Set `UDIE_OLLAMA_URL=http://localhost:11434` and `UDIE_OLLAMA_MODEL=llama3.1` when Ollama runs beside the application on the same host. Set `UDIE_VLLM_URL=http://localhost:8000` and `UDIE_VLLM_MODEL=Qwen/Qwen2.5-7B-Instruct` for vLLM. In a managed container, `localhost` refers to the application container itself; use a private service hostname or a sidecar/network address when the model server is outside that container. The gateway inventory intentionally shows these routes as disabled until their corresponding URL is explicitly configured.

## Authenticated persistence

After Manus OAuth completes, the first authenticated request creates a `workspaces` row for the user. Threads and messages are scoped by both `ownerId` and `workspaceId`; the server verifies ownership before reading a thread or appending chat messages. The React workspace automatically adopts the user's latest thread or creates a default thread. Anonymous preview sessions remain available but do not persist chat messages.

## Automatic maintenance

The maintenance service removes duplicate chunks by normalized content fingerprint, resolves duplicate graph edges by `(fromId, toId, relation)`, and re-indexes stored chunks into Chroma when `CHROMA_URL` is available. Every run writes an idempotent `maintenanceRuns` record.

The callback is mounted at `POST /api/scheduled/memory-maintenance` and accepts only platform cron identities. This project uses the managed HTTP Heartbeat facility rather than APScheduler/Celery or an in-process timer because the default deployment scales to zero and cannot guarantee a resident worker.

After the site is deployed, register the project-level Heartbeat from a Manus shell:

```bash
manus-heartbeat create \
  --name udie-memory-maintenance \
  --cron "0 0 3 * * *" \
  --path /api/scheduled/memory-maintenance \
  --description "Nightly UDIE memory deduplication, conflict resolution, and vector re-indexing"
```

Alternatively, an authenticated owner can call the protected `workspace.scheduleMaintenance` procedure with a six-field UTC cron expression. The returned `taskUid` should be stored in `maintenanceSchedules.scheduleCronTaskUid`; the repository already contains the persistence helper and schema column. Do not register the callback before deployment—the platform scheduler must be able to reach the deployed URL.

## Verification

```bash
pnpm test --reporter=dot
pnpm check
pnpm build
```

The test suite covers the maintenance fallback, per-user workspace/thread ownership shapes, memory pipeline, ingestion citations, sandbox boundary, and the original auth logout behavior.
