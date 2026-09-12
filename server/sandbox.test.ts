import { describe, expect, it } from "vitest";
import { runSandboxWithHealing } from "./sandbox";

describe("UDIE sandbox boundary", () => {
  it("returns a safe preview without requiring Docker or Pyodide", async () => {
    const result = await runSandboxWithHealing("const answer = 2 + 2\nreturn answer");
    expect(result.ok).toBe(true);
    expect(result.provider).toBe("policy");
    expect(result.attempts).toBe(1);
  });

  it("blocks process, network, and destructive filesystem calls", async () => {
    const result = await runSandboxWithHealing("import subprocess\nsubprocess.run('whoami')");
    expect(result.ok).toBe(false);
    expect(result.provider).toBe("policy");
    expect(result.output).toContain("rejected");
  });
});
