import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { demoAgents, demoMemory } from "./udie";
import { orchestrate } from "./agents";
import { discoverBuiltinModels, listConfiguredGateways } from "./gateways";
import { ingestDocument, ingestUrl } from "./ingestion";
import { hybridSearch } from "./memory";
import { runSandboxWithHealing } from "./sandbox";
import { listGateways, upsertGateway } from "./memory-db";
import { appendThreadMessage, createThread, getMaintenanceStatus, getOrCreateWorkspace, getOwnedThread, listThreadMessages, listUserThreads, saveMaintenanceTaskUid } from "./workspace-db";
import { createHeartbeatJob } from "./_core/heartbeat";
import { parse as parseCookie } from "cookie";

const chatInput = z.object({
  message: z.string().min(1).max(8000),
  mode: z.enum(["hybrid", "local", "cloud"]),
  provider: z.enum(["ollama", "vllm", "openrouter", "openai", "anthropic", "builtin"]).optional(),
  apiKey: z.string().max(512).optional(),
  prompt: z.string().min(1).max(4000),
  temperature: z.number().min(0).max(2),
  topP: z.number().min(0).max(1),
  sandboxCode: z.string().max(12000).optional(),
  threadId: z.string().optional(),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  workspace: router({
    me: protectedProcedure.query(({ ctx }) => getOrCreateWorkspace(ctx.user.id, ctx.user.name)),
    threads: protectedProcedure.query(async ({ ctx }) => {
      const workspace = await getOrCreateWorkspace(ctx.user.id, ctx.user.name);
      return listUserThreads(ctx.user.id, workspace.id);
    }),
    createThread: protectedProcedure.input(z.object({ title: z.string().max(512).default("Untitled intelligence thread"), mode: z.enum(["hybrid", "local", "cloud"]).default("hybrid") })).mutation(async ({ ctx, input }) => {
      const workspace = await getOrCreateWorkspace(ctx.user.id, ctx.user.name);
      return createThread(ctx.user.id, workspace.id, input.title, input.mode);
    }),
    messages: protectedProcedure.input(z.object({ threadId: z.string().min(1) })).query(async ({ ctx, input }) => {
      const thread = await getOwnedThread(ctx.user.id, input.threadId);
      if (!thread) return [];
      return listThreadMessages(ctx.user.id, input.threadId);
    }),
    maintenanceStatus: protectedProcedure.query(() => getMaintenanceStatus()),
    scheduleMaintenance: protectedProcedure.input(z.object({ cron: z.string().regex(/^\d+\s+\d+\s+\d+\s+\S+\s+\S+\s+\S+$/).default("0 0 3 * * *") })).mutation(async ({ ctx, input }) => {
      const session = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
      const job = await createHeartbeatJob({ name: "udie-memory-maintenance", cron: input.cron, path: "/api/scheduled/memory-maintenance", description: "Nightly UDIE memory deduplication, conflict resolution, and vector re-indexing" }, session);
      await saveMaintenanceTaskUid(job.taskUid);
      return job;
    }),
  }),
  udie: router({
    chat: publicProcedure.input(chatInput).mutation(async ({ ctx, input }) => {
      const result = await orchestrate(input);
      if (ctx.user && input.threadId) {
        const thread = await getOwnedThread(ctx.user.id, input.threadId);
        if (thread) {
          await appendThreadMessage({ threadId: thread.id, ownerId: ctx.user.id, role: "user", content: input.message });
          await appendThreadMessage({ threadId: thread.id, ownerId: ctx.user.id, role: "assistant", content: result.content, source: result.provider, metadata: { events: result.events, citations: result.citations } });
        }
      }
      return { ...result, source: result.provider, warning: result.provider === "local-fallback" ? "Gateway unavailable — deterministic local fallback used." : null };
    }),
    memory: publicProcedure.input(z.object({ query: z.string().default(""), limit: z.number().min(1).max(30).default(8) })).query(async ({ input }) => {
      const query = input.query.trim();
      if (!query) return demoMemory;
      const hits = await hybridSearch(query, input.limit);
      if (hits.length > 0) return hits.map(hit => ({ id: hit.id, title: hit.title, type: "concept" as const, excerpt: hit.content.slice(0, 180), score: Math.min(0.99, 0.62 + hit.score / 10), connections: 1, color: "cyan" }));
      return demoMemory.filter(item => `${item.title} ${item.excerpt} ${item.type}`.toLowerCase().includes(query.toLowerCase()));
    }),
    agents: publicProcedure.query(() => demoAgents),
    gateways: publicProcedure.query(async () => {
      const stored = await listGateways();
      return stored.length > 0 ? stored : listConfiguredGateways();
    }),
    models: publicProcedure.query(() => discoverBuiltinModels()),
    saveGateway: publicProcedure.input(z.object({ id: z.string().optional(), provider: z.enum(["ollama", "vllm", "openrouter", "openai", "anthropic", "builtin"]), label: z.string().min(1).max(128), endpoint: z.string().url().optional(), model: z.string().min(1).max(256), enabled: z.boolean().default(true) })).mutation(({ input }) => upsertGateway(input)),
    ingestUrl: publicProcedure.input(z.object({ url: z.string().url() })).mutation(({ input }) => ingestUrl(input.url)),
    ingestText: publicProcedure.input(z.object({ title: z.string().min(1).max(512), content: z.string().min(1).max(200000), source: z.string().optional(), sourceType: z.enum(["text", "file"]).default("text") })).mutation(({ input }) => ingestDocument(input)),
    sandbox: publicProcedure.input(z.object({ code: z.string().max(12000) })).mutation(({ input }) => runSandboxWithHealing(input.code)),
  }),
});

export type AppRouter = typeof appRouter;
