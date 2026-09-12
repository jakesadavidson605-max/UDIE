import type { Request, Response } from "express";
import { parse as parseCookie } from "cookie";
import { COOKIE_NAME } from "@shared/const";
import { sdk } from "./_core/sdk";
import { runMemoryMaintenance } from "./maintenance";

export async function memoryMaintenanceHandler(req: Request, res: Response) {
  const startedAt = new Date().toISOString();
  try {
    if (!parseCookie(req.headers.cookie ?? "")[COOKIE_NAME]) return res.status(403).json({ error: "cron-only" });
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    const result = await runMemoryMaintenance();
    return res.json({ ok: result.status === "completed", taskUid: user.taskUid, startedAt, result });
  } catch (error) {
    if (error instanceof Error && /invalid session|forbidden|cron session/i.test(error.message)) return res.status(403).json({ error: "cron-only" });
    return res.status(500).json({ error: error instanceof Error ? error.message : "scheduled maintenance failed", stack: error instanceof Error ? error.stack : undefined, context: { url: req.originalUrl, timestamp: startedAt } });
  }
}
