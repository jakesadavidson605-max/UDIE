import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { buildFallbackAnswer, demoAgents, demoMemory, runSafeSandbox } from "./udie";

const chatInput = z.object({
  message: z.string().min(1).max(8000),
  mode: z.enum(["hybrid", "local", "cloud"]),
  prompt: z.string().min(1).max(4000),
  temperature: z.number().min(0).max(2),
  topP: z.number().min(0).max(1),
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
  udie: router({
    chat: publicProcedure.input(chatInput).mutation(async ({ input }) => {
      try {
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `${input.prompt}\n\nYou are the UDIE orchestration core. Be precise, structured, and transparent about uncertainty. Keep the response useful for a technical operator.`,
            },
            { role: "user", content: input.message },
          ],
        });
        const content = response.choices?.[0]?.message?.content;
        if (typeof content === "string" && content.trim()) {
          return { content, source: "gateway" as const, warning: null };
        }
        throw new Error("The gateway returned no text content");
      } catch (error) {
        console.warn("[UDIE] Gateway unavailable, using deterministic local fallback", error);
        return {
          content: buildFallbackAnswer(input.message, input.mode),
          source: "local-fallback" as const,
          warning: "Gateway unavailable — deterministic local fallback used.",
        };
      }
    }),
    memory: publicProcedure.input(z.object({ query: z.string().default("") })).query(({ input }) => {
      const query = input.query.trim().toLowerCase();
      if (!query) return demoMemory;
      return demoMemory.filter(item => `${item.title} ${item.excerpt} ${item.type}`.toLowerCase().includes(query));
    }),
    agents: publicProcedure.query(() => demoAgents),
    sandbox: publicProcedure.input(z.object({ code: z.string().max(12000) })).mutation(({ input }) => runSafeSandbox(input.code)),
  }),
});

export type AppRouter = typeof appRouter;
