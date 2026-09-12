import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const workspaces = mysqlTable("workspaces", {
  id: varchar("id", { length: 64 }).primaryKey(),
  ownerId: int("ownerId").notNull(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  name: varchar("name", { length: 256 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const threads = mysqlTable("threads", {
  id: varchar("id", { length: 64 }).primaryKey(),
  workspaceId: varchar("workspaceId", { length: 64 }).notNull(),
  ownerId: int("ownerId").notNull(),
  title: varchar("title", { length: 512 }).notNull(),
  mode: mysqlEnum("mode", ["hybrid", "local", "cloud"]).default("hybrid").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const threadMessages = mysqlTable("threadMessages", {
  id: varchar("id", { length: 64 }).primaryKey(),
  threadId: varchar("threadId", { length: 64 }).notNull(),
  ownerId: int("ownerId").notNull(),
  role: mysqlEnum("role", ["user", "assistant", "system"]).notNull(),
  content: text("content").notNull(),
  source: varchar("source", { length: 128 }),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const memoryDocuments = mysqlTable("memoryDocuments", {
  id: varchar("id", { length: 64 }).primaryKey(),
  title: varchar("title", { length: 512 }).notNull(),
  sourceUrl: text("sourceUrl"),
  sourceType: mysqlEnum("sourceType", ["text", "url", "file"]).default("text").notNull(),
  content: text("content").notNull(),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const memoryChunks = mysqlTable("memoryChunks", {
  id: varchar("id", { length: 64 }).primaryKey(),
  documentId: varchar("documentId", { length: 64 }).notNull(),
  chunkIndex: int("chunkIndex").notNull(),
  content: text("content").notNull(),
  tokenCount: int("tokenCount").notNull(),
  keywords: text("keywords"),
  embedding: text("embedding"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const memoryEdges = mysqlTable("memoryEdges", {
  id: varchar("id", { length: 64 }).primaryKey(),
  fromId: varchar("fromId", { length: 64 }).notNull(),
  toId: varchar("toId", { length: 64 }).notNull(),
  relation: varchar("relation", { length: 128 }).notNull(),
  weight: int("weight").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const ingestionJobs = mysqlTable("ingestionJobs", {
  id: varchar("id", { length: 64 }).primaryKey(),
  source: text("source").notNull(),
  status: mysqlEnum("status", ["queued", "running", "completed", "failed"]).default("queued").notNull(),
  documentId: varchar("documentId", { length: 64 }),
  error: text("error"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const gatewayConfigs = mysqlTable("gatewayConfigs", {
  id: varchar("id", { length: 64 }).primaryKey(),
  provider: mysqlEnum("provider", ["ollama", "vllm", "openrouter", "openai", "anthropic", "builtin"]).notNull(),
  label: varchar("label", { length: 128 }).notNull(),
  endpoint: text("endpoint"),
  model: varchar("model", { length: 256 }).notNull(),
  enabled: int("enabled").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const maintenanceSchedules = mysqlTable("maintenanceSchedules", {
  id: varchar("id", { length: 64 }).primaryKey(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }).unique(),
  cron: varchar("cron", { length: 64 }).notNull().default("0 0 3 * * *"),
  enabled: int("enabled").notNull().default(1),
  lastRunAt: timestamp("lastRunAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const maintenanceRuns = mysqlTable("maintenanceRuns", {
  id: varchar("id", { length: 64 }).primaryKey(),
  status: mysqlEnum("status", ["running", "completed", "failed"]).notNull(),
  deduplicated: int("deduplicated").notNull().default(0),
  conflictsResolved: int("conflictsResolved").notNull().default(0),
  reindexed: int("reindexed").notNull().default(0),
  summary: text("summary"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  finishedAt: timestamp("finishedAt"),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Workspace = typeof workspaces.$inferSelect;
export type Thread = typeof threads.$inferSelect;
export type ThreadMessage = typeof threadMessages.$inferSelect;
export type MemoryDocument = typeof memoryDocuments.$inferSelect;
export type MemoryChunk = typeof memoryChunks.$inferSelect;
export type MemoryEdge = typeof memoryEdges.$inferSelect;
export type GatewayConfig = typeof gatewayConfigs.$inferSelect;
