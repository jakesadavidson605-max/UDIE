import { nanoid } from "nanoid";
import { ingestText } from "./memory";
import { createIngestionJob, updateIngestionJob } from "./memory-db";

export type IngestionResult = { jobId: string; documentId?: string; title: string; chunkCount?: number; source: string; status: "completed" | "failed"; error?: string; strategy: "playwright" | "fetch" | "text" | "file" };

type DynamicImport = (specifier: string) => Promise<any>;
const dynamicImport = new Function("specifier", "return import(specifier)") as DynamicImport;

function cleanHtml(html: string) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<noscript[\s\S]*?<\/noscript>/gi, " ").replace(/<svg[\s\S]*?<\/svg>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/\s{2,}/g, " ").trim();
}

async function crawlWithPlaywright(url: string) {
  try {
    const playwright = await dynamicImport("playwright");
    const browser = await playwright.chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] });
    const page = await browser.newPage({ userAgent: "UDIE/1.0 (+safe ingestion)" });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    const title = await page.title();
    const body = await page.locator("body").innerText();
    await browser.close();
    return { title: title || url, content: body, strategy: "playwright" as const };
  } catch {
    return null;
  }
}

async function crawlWithFetch(url: string) {
  const response = await fetch(url, { headers: { "user-agent": "UDIE/1.0 (+safe ingestion)" }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
  const html = await response.text();
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() || new URL(url).hostname;
  return { title, content: cleanHtml(html), strategy: "fetch" as const };
}

export async function ingestUrl(url: string): Promise<IngestionResult> {
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Only HTTP(S) URLs are supported");
  const jobId = await createIngestionJob(url);
  await updateIngestionJob(jobId, { status: "running" });
  try {
    const rendered = process.env.UDIE_ENABLE_PLAYWRIGHT === "true" ? await crawlWithPlaywright(url) : null;
    const page = rendered ?? await crawlWithFetch(url);
    const stored = await ingestText({ title: page.title, content: page.content, sourceUrl: url, sourceType: "url" });
    await updateIngestionJob(jobId, { status: "completed", documentId: stored.documentId });
    return { jobId, documentId: stored.documentId, title: page.title, chunkCount: stored.chunkCount, source: url, status: "completed", strategy: page.strategy };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ingestion failed";
    await updateIngestionJob(jobId, { status: "failed", error: message });
    return { jobId, source: url, title: parsed.hostname, status: "failed", error: message, strategy: "fetch" };
  }
}

export async function ingestDocument(input: { title: string; content: string; source?: string; sourceType?: "text" | "file" }) {
  const jobId = await createIngestionJob(input.source ?? input.title);
  await updateIngestionJob(jobId, { status: "running" });
  try {
    const stored = await ingestText({ title: input.title, content: input.content, sourceUrl: input.source, sourceType: input.sourceType ?? "text" });
    await updateIngestionJob(jobId, { status: "completed", documentId: stored.documentId });
    return { jobId, documentId: stored.documentId, title: input.title, chunkCount: stored.chunkCount, source: input.source ?? input.title, status: "completed" as const, strategy: input.sourceType === "file" ? "file" as const : "text" as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ingestion failed";
    await updateIngestionJob(jobId, { status: "failed", error: message });
    return { jobId, source: input.source ?? input.title, title: input.title, status: "failed" as const, error: message, strategy: input.sourceType === "file" ? "file" as const : "text" as const };
  }
}

export function makeCitation(source: string, title: string, chunkId: string) {
  return { id: nanoid(10), label: title, source, locator: chunkId, markdown: `[${title}](${source})` };
}
