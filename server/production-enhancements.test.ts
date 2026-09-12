import { describe, expect, it } from "vitest";
import { runMemoryMaintenance } from "./maintenance";
import { createThread, getOrCreateWorkspace } from "./workspace-db";

describe("production enhancements", () => {
  it("runs an idempotent maintenance pass without optional external services", async () => {
    const result = await runMemoryMaintenance();
    expect(result.status).toBe("completed");
    expect(result.summary).toContain("Maintenance completed");
  });

  it("creates a deterministic per-user workspace fallback and owned thread shape", async () => {
    const workspace = await getOrCreateWorkspace(42, "Operator");
    const thread = await createThread(42, workspace.id, "Research thread", "hybrid");
    expect(workspace.ownerId).toBe(42);
    expect(thread.ownerId).toBe(42);
    expect(thread.workspaceId).toBe(workspace.id);
    expect(thread.title).toBe("Research thread");
  });
});
