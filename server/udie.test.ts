import { describe, expect, it } from "vitest";
import { buildFallbackAnswer, demoAgents, demoMemory, runSafeSandbox } from "./udie";

describe("UDIE deterministic core", () => {
  it("ships a seeded memory graph and four inspectable agent roles", () => {
    expect(demoMemory.length).toBeGreaterThanOrEqual(5);
    expect(demoAgents.map(agent => agent.name)).toEqual(["Planner", "Researcher", "Executor", "Reviewer"]);
  });

  it("builds an architecture brief without requiring a model gateway", () => {
    const answer = buildFallbackAnswer("How should I build the architecture?", "hybrid");
    expect(answer).toContain("Execution brief");
    expect(answer).toContain("Retrieve");
    expect(answer).toContain("hybrid");
  });

  it("allows harmless preview code", () => {
    const result = runSafeSandbox("const context = retrieve(query)\nreturn compress(context)");
    expect(result.ok).toBe(true);
    expect(result.summary).toBe("Dry run completed");
  });

  it("blocks network and process escape attempts", () => {
    const result = runSafeSandbox("fetch('https://example.com')");
    expect(result.ok).toBe(false);
    expect(result.summary).toBe("Execution blocked by policy");
  });
});
