import { describe, expect, it, vi } from "vitest";
import { memoryMaintenanceHandler } from "./scheduled";

describe("scheduled maintenance callback", () => {
  it("rejects requests without a cron session cookie", async () => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    await memoryMaintenanceHandler({ headers: {}, originalUrl: "/api/scheduled/memory-maintenance" } as any, { status } as any);
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({ error: "cron-only" });
  });
});
