import { and, asc, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "./db";
import { maintenanceRuns, maintenanceSchedules, threadMessages, threads, workspaces } from "../drizzle/schema";

export async function getOrCreateWorkspace(ownerId: number, ownerName?: string | null) {
  const db = await getDb();
  if (!db) return { id: `memory-${ownerId}`, ownerId, slug: `user-${ownerId}`, name: ownerName ? `${ownerName}'s workspace` : "Personal workspace" };
  const existing = await db.select().from(workspaces).where(eq(workspaces.ownerId, ownerId)).limit(1);
  if (existing[0]) return existing[0];
  const workspace = { id: nanoid(16), ownerId, slug: `user-${ownerId}-${nanoid(6).toLowerCase()}`, name: ownerName ? `${ownerName}'s workspace` : "Personal workspace" };
  await db.insert(workspaces).values(workspace);
  return workspace;
}

export async function listUserThreads(ownerId: number, workspaceId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(threads).where(and(eq(threads.ownerId, ownerId), eq(threads.workspaceId, workspaceId))).orderBy(desc(threads.updatedAt));
}

export async function createThread(ownerId: number, workspaceId: string, title: string, mode: "hybrid" | "local" | "cloud") {
  const db = await getDb();
  const thread = { id: nanoid(16), workspaceId, ownerId, title: title.trim().slice(0, 512) || "Untitled intelligence thread", mode };
  if (db) await db.insert(threads).values(thread);
  return thread;
}

export async function getOwnedThread(ownerId: number, threadId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(threads).where(and(eq(threads.id, threadId), eq(threads.ownerId, ownerId))).limit(1);
  return result[0];
}

export async function listThreadMessages(ownerId: number, threadId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(threadMessages).where(and(eq(threadMessages.ownerId, ownerId), eq(threadMessages.threadId, threadId))).orderBy(asc(threadMessages.createdAt));
}

export async function appendThreadMessage(input: { threadId: string; ownerId: number; role: "user" | "assistant" | "system"; content: string; source?: string; metadata?: unknown }) {
  const db = await getDb();
  const message = { id: nanoid(16), threadId: input.threadId, ownerId: input.ownerId, role: input.role, content: input.content, source: input.source, metadata: input.metadata ? JSON.stringify(input.metadata) : null };
  if (db) {
    await db.insert(threadMessages).values(message);
    await db.update(threads).set({ updatedAt: new Date() }).where(and(eq(threads.id, input.threadId), eq(threads.ownerId, input.ownerId)));
  }
  return message;
}

export async function getMaintenanceSchedule() {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(maintenanceSchedules).limit(1);
  return result[0];
}

export async function getMaintenanceStatus() {
  const db = await getDb();
  if (!db) return { schedule: undefined, lastRun: undefined };
  const schedule = await getMaintenanceSchedule();
  const runs = await db.select().from(maintenanceRuns).orderBy(desc(maintenanceRuns.startedAt)).limit(1);
  return { schedule, lastRun: runs[0] };
}

export async function saveMaintenanceTaskUid(taskUid: string) {
  const db = await getDb();
  if (!db) return;
  const current = await getMaintenanceSchedule();
  if (current) await db.update(maintenanceSchedules).set({ scheduleCronTaskUid: taskUid, enabled: 1, updatedAt: new Date() }).where(eq(maintenanceSchedules.id, current.id));
  else await db.insert(maintenanceSchedules).values({ id: nanoid(16), scheduleCronTaskUid: taskUid, enabled: 1 });
}

export async function markMaintenanceScheduleDisabled() {
  const db = await getDb();
  const current = await getMaintenanceSchedule();
  if (db && current) await db.update(maintenanceSchedules).set({ enabled: 0, updatedAt: new Date() }).where(eq(maintenanceSchedules.id, current.id));
}

export async function startMaintenanceRun() {
  const db = await getDb();
  const id = nanoid(16);
  if (db) await db.insert(maintenanceRuns).values({ id, status: "running" });
  return id;
}

export async function finishMaintenanceRun(id: string, result: { status: "completed" | "failed"; deduplicated?: number; conflictsResolved?: number; reindexed?: number; summary?: string }) {
  const db = await getDb();
  if (!db) return;
  await db.update(maintenanceRuns).set({ ...result, finishedAt: new Date() }).where(eq(maintenanceRuns.id, id));
  const schedule = await getMaintenanceSchedule();
  if (schedule) await db.update(maintenanceSchedules).set({ lastRunAt: new Date(), updatedAt: new Date() }).where(eq(maintenanceSchedules.id, schedule.id));
}
