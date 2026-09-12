import { and, eq } from "drizzle-orm";
import { getDb } from "./db";
import { memoryChunks, memoryEdges } from "../drizzle/schema";
import { finishMaintenanceRun, startMaintenanceRun } from "./workspace-db";
import { listStoredMemory } from "./memory-db";
import { reindexChroma } from "./memory";

export type MaintenanceResult = { runId: string; status: "completed" | "failed"; deduplicated: number; conflictsResolved: number; reindexed: number; summary: string };

export async function runMemoryMaintenance(): Promise<MaintenanceResult> {
  const runId = await startMaintenanceRun();
  let deduplicated = 0;
  let conflictsResolved = 0;
  let reindexed = 0;
  try {
    const db = await getDb();
    if (db) {
      const chunks = await db.select().from(memoryChunks);
      const seen = new Map<string, string>();
      for (const chunk of chunks) {
        const fingerprint = chunk.content.toLowerCase().replace(/\s+/g, " ").trim();
        const previous = seen.get(fingerprint);
        if (previous) {
          await db.delete(memoryChunks).where(eq(memoryChunks.id, chunk.id));
          deduplicated += 1;
        } else {
          seen.set(fingerprint, chunk.id);
        }
      }

      const edges = await db.select().from(memoryEdges);
      const edgeKeys = new Set<string>();
      for (const edge of edges) {
        const key = `${edge.fromId}|${edge.toId}|${edge.relation}`;
        if (edgeKeys.has(key)) {
          await db.delete(memoryEdges).where(eq(memoryEdges.id, edge.id));
          conflictsResolved += 1;
        } else {
          edgeKeys.add(key);
        }
      }
    }

    const reindex = await reindexChroma();
    reindexed = reindex.synced ? reindex.count : 0;
    const summary = `Maintenance completed: ${deduplicated} duplicate chunks removed, ${conflictsResolved} duplicate graph edges resolved, ${reindexed} chunks re-indexed.`;
    await finishMaintenanceRun(runId, { status: "completed", deduplicated, conflictsResolved, reindexed, summary });
    return { runId, status: "completed", deduplicated, conflictsResolved, reindexed, summary };
  } catch (error) {
    const summary = error instanceof Error ? error.message : "Maintenance failed";
    await finishMaintenanceRun(runId, { status: "failed", deduplicated, conflictsResolved, reindexed, summary });
    return { runId, status: "failed", deduplicated, conflictsResolved, reindexed, summary };
  }
}
