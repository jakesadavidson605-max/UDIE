import { desc, eq } from "drizzle-orm";
import { getDb } from "./db";
import { gatewayConfigs, ingestionJobs, memoryChunks, memoryDocuments, memoryEdges } from "../drizzle/schema";
import { nanoid } from "nanoid";

export async function listStoredMemory(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(memoryChunks).orderBy(desc(memoryChunks.createdAt)).limit(limit);
}

export async function saveDocument(input: { id: string; title: string; content: string; sourceUrl?: string; sourceType?: "text" | "url" | "file"; metadata?: Record<string, unknown> }) {
  const db = await getDb();
  if (!db) return false;
  await db.insert(memoryDocuments).values({ ...input, metadata: input.metadata ? JSON.stringify(input.metadata) : null }).onDuplicateKeyUpdate({ set: { title: input.title, content: input.content, sourceUrl: input.sourceUrl, updatedAt: new Date() } });
  return true;
}

export async function saveChunks(documentId: string, chunks: Array<{ id: string; chunkIndex: number; content: string; tokenCount: number; keywords: string[] }>) {
  const db = await getDb();
  if (!db || chunks.length === 0) return false;
  await db.insert(memoryChunks).values(chunks.map(chunk => ({ ...chunk, documentId, keywords: JSON.stringify(chunk.keywords) }))).onDuplicateKeyUpdate({ set: { content: chunks[0]?.content ?? "", tokenCount: chunks[0]?.tokenCount ?? 0 } });
  return true;
}

export async function saveEdges(edges: Array<{ fromId: string; toId: string; relation: string; weight?: number }>) {
  const db = await getDb();
  if (!db || edges.length === 0) return false;
  await db.insert(memoryEdges).values(edges.map(edge => ({ ...edge, id: nanoid(16), weight: edge.weight ?? 1 })));
  return true;
}

export async function createIngestionJob(source: string) {
  const id = nanoid(16);
  const db = await getDb();
  if (db) await db.insert(ingestionJobs).values({ id, source, status: "queued" });
  return id;
}

export async function updateIngestionJob(id: string, patch: { status: "queued" | "running" | "completed" | "failed"; documentId?: string; error?: string }) {
  const db = await getDb();
  if (!db) return;
  await db.update(ingestionJobs).set({ ...patch, updatedAt: new Date() }).where(eq(ingestionJobs.id, id));
}

export async function listGateways() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(gatewayConfigs).orderBy(desc(gatewayConfigs.updatedAt));
}

export async function upsertGateway(input: { id?: string; provider: "ollama" | "vllm" | "openrouter" | "openai" | "anthropic" | "builtin"; label: string; endpoint?: string; model: string; enabled?: boolean }) {
  const db = await getDb();
  const id = input.id ?? nanoid(16);
  if (db) await db.insert(gatewayConfigs).values({ id, provider: input.provider, label: input.label, endpoint: input.endpoint, model: input.model, enabled: input.enabled === false ? 0 : 1 }).onDuplicateKeyUpdate({ set: { label: input.label, endpoint: input.endpoint, model: input.model, enabled: input.enabled === false ? 0 : 1, updatedAt: new Date() } });
  return id;
}
