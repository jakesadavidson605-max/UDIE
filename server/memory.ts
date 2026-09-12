import { nanoid } from "nanoid";
import { listStoredMemory, saveChunks, saveDocument, saveEdges } from "./memory-db";

export type SearchHit = { id: string; documentId: string; title: string; content: string; score: number; sourceUrl?: string; citation: string; keywords: string[] };

const STOP_WORDS = new Set("the a an and or to of in on for with is are be this that as by from it into at be can should how what when where why".split(/\s+/));

export function tokenize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter(token => token.length > 2 && !STOP_WORDS.has(token));
}

export function chunkText(text: string, maxChars = 1400, overlap = 180) {
  const normalized = text.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
  if (!normalized) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length) {
    const end = Math.min(normalized.length, start + maxChars);
    const candidate = normalized.slice(start, end);
    const boundary = end < normalized.length ? Math.max(candidate.lastIndexOf("\n\n"), candidate.lastIndexOf(". ")) : candidate.length;
    const actualEnd = boundary > maxChars * 0.55 ? start + boundary + (candidate[boundary] === "." ? 1 : 0) : end;
    chunks.push(normalized.slice(start, actualEnd).trim());
    if (actualEnd >= normalized.length) break;
    start = Math.max(actualEnd - overlap, start + 1);
  }
  return chunks;
}

function termFrequency(tokens: string[]) {
  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  return counts;
}

export function bm25Score(query: string, document: string, corpusSize = 1) {
  const q = tokenize(query);
  const d = tokenize(document);
  const frequencies = termFrequency(d);
  const avgLength = 120;
  const k1 = 1.5;
  const b = 0.75;
  let score = 0;
  for (const term of q) {
    const tf = frequencies.get(term) ?? 0;
    if (!tf) continue;
    const idf = Math.log(1 + (corpusSize + 0.5) / 1.5);
    score += idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (d.length / avgLength))));
  }
  return score;
}

function extractEntities(text: string) {
  return Array.from(new Set((text.match(/\b[A-Z][A-Za-z0-9-]{2,}\b/g) ?? []).slice(0, 30)));
}

async function ensureChromaCollection(base: string) {
  const existing = await fetch(`${base}/api/v1/collections?name=udie_memory`);
  if (existing.ok) {
    const collections = await existing.json() as Array<{ id: string; name: string }>;
    const match = collections.find(collection => collection.name === "udie_memory");
    if (match) return match.id;
  }
  const created = await fetch(`${base}/api/v1/collections`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "udie_memory", metadata: { "hnsw:space": "cosine" }, get_or_create: true }) });
  if (!created.ok) throw new Error(`Chroma collection unavailable (${created.status})`);
  const collection = await created.json() as { id: string };
  return collection.id;
}

async function syncToChroma(chunks: Array<{ id: string; content: string; metadata: Record<string, string> }>) {
  const endpoint = process.env.CHROMA_URL;
  if (!endpoint || chunks.length === 0) return { synced: false, reason: "CHROMA_URL not configured" };
  try {
    const base = endpoint.replace(/\/$/, "");
    const collectionId = await ensureChromaCollection(base);
    const response = await fetch(`${base}/api/v1/collections/${collectionId}/add`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: chunks.map(chunk => chunk.id), documents: chunks.map(chunk => chunk.content), metadatas: chunks.map(chunk => chunk.metadata) }) });
    return { synced: response.ok, reason: response.ok ? "ok" : `Chroma responded ${response.status}` };
  } catch (error) {
    return { synced: false, reason: error instanceof Error ? error.message : "Chroma unavailable" };
  }
}

export async function reindexChroma() {
  const stored = await listStoredMemory(5000);
  if (stored.length === 0) return { synced: false, count: 0, reason: "No stored chunks" };
  const result = await syncToChroma(stored.map(chunk => ({ id: chunk.id, content: chunk.content, metadata: { documentId: chunk.documentId, title: `Memory chunk ${chunk.chunkIndex + 1}`, sourceUrl: "" } })));
  return { ...result, count: stored.length };
}

async function queryChroma(query: string, limit: number): Promise<SearchHit[]> {
  const endpoint = process.env.CHROMA_URL;
  if (!endpoint) return [];
  try {
    const base = endpoint.replace(/\/$/, "");
    const collectionId = await ensureChromaCollection(base);
    const response = await fetch(`${base}/api/v1/collections/${collectionId}/query`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query_texts: [query], n_results: limit, include: ["documents", "metadatas", "distances"] }) });
    if (!response.ok) return [];
    const data = await response.json() as { ids?: string[][]; documents?: Array<Array<string | null>>; metadatas?: Array<Array<Record<string, string> | null>>; distances?: number[][] };
    return (data.ids?.[0] ?? []).map((id, index) => {
      const metadata = data.metadatas?.[0]?.[index] ?? {};
      const content = data.documents?.[0]?.[index] ?? "";
      const distance = data.distances?.[0]?.[index] ?? 1;
      return { id, documentId: metadata.documentId ?? id, title: metadata.title ?? "Chroma memory", content, score: Math.max(0, 1 - distance), sourceUrl: metadata.sourceUrl, citation: `[Vector ${id.slice(0, 6)}]`, keywords: tokenize(content).slice(0, 24) };
    });
  } catch {
    return [];
  }
}

export async function ingestText(input: { title: string; content: string; sourceUrl?: string; sourceType?: "text" | "url" | "file" }) {
  const documentId = nanoid(16);
  const rawChunks = chunkText(input.content);
  const chunks = rawChunks.map((content, index) => ({ id: nanoid(16), chunkIndex: index, content, tokenCount: tokenize(content).length, keywords: tokenize(content).slice(0, 24) }));
  await saveDocument({ id: documentId, title: input.title, content: input.content, sourceUrl: input.sourceUrl, sourceType: input.sourceType, metadata: { chunkCount: chunks.length } });
  await saveChunks(documentId, chunks);
  const entities = extractEntities(input.content);
  await saveEdges(entities.slice(1).map(entity => ({ fromId: `${documentId}:${entities[0] ?? "document"}`, toId: `${documentId}:${entity}`, relation: "mentions", weight: 1 })));
  const chroma = await syncToChroma(chunks.map(chunk => ({ id: chunk.id, content: chunk.content, metadata: { documentId, title: input.title, sourceUrl: input.sourceUrl ?? "" } })));
  return { documentId, chunkCount: chunks.length, entities, chroma };
}

export async function hybridSearch(query: string, limit = 8): Promise<SearchHit[]> {
  const stored = await listStoredMemory(250);
  const sparseHits = stored.map(chunk => {
    const score = bm25Score(query, chunk.content, stored.length);
    let keywords: string[] = [];
    try { keywords = chunk.keywords ? JSON.parse(chunk.keywords) : []; } catch { keywords = []; }
    return { id: chunk.id, documentId: chunk.documentId, title: `Memory chunk ${chunk.chunkIndex + 1}`, content: chunk.content, score, citation: `[Memory ${chunk.documentId.slice(0, 6)}]`, keywords };
  }).filter(hit => hit.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
  const vectorHits = await queryChroma(query, limit);
  const combined = new Map<string, SearchHit>();
  for (const hit of sparseHits) combined.set(hit.id, { ...hit, score: Math.min(1, hit.score / 4) * 0.55 });
  for (const hit of vectorHits) {
    const existing = combined.get(hit.id);
    combined.set(hit.id, existing ? { ...hit, score: existing.score * 0.55 + hit.score * 0.45 } : { ...hit, score: hit.score * 0.45 });
  }
  return Array.from(combined.values()).sort((a, b) => b.score - a.score).slice(0, limit);
}

export function compressContext(blocks: string[], maxTokens = 4000) {
  const estimated = blocks.join(" ").split(/\s+/).filter(Boolean);
  if (estimated.length <= maxTokens) return blocks;
  return blocks.map(block => block.split(/\s+/).filter((word, index) => index < maxTokens / Math.max(blocks.length, 1) || /[A-Z0-9]{3,}/.test(word)).join(" "));
}
