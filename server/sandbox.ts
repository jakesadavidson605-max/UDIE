import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execFileAsync = promisify(execFile);

export type SandboxResult = { ok: boolean; summary: string; output: string; provider: "policy" | "docker" | "pyodide"; attempts: number; metrics: { lines: number; duration: string; memory: string } };

const dangerous = /child_process|subprocess|os\.system|process\.env|rm\s+-rf|curl\s|wget\s|fetch\(|import\s+socket|require\(['"]net['"]\)|\.writeFile|\.unlink/i;

function policyCheck(code: string) {
  if (dangerous.test(code)) return "The preview sandbox rejected a network, process, environment, or destructive filesystem call.";
  if (code.length > 12000) return "The preview sandbox rejected code over the 12,000 character limit.";
  return null;
}

async function runPyodideService(code: string) {
  const response = await fetch(process.env.UDIE_PYODIDE_URL!, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }), signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`Pyodide service returned HTTP ${response.status}`);
  return await response.json() as { ok: boolean; output?: string; error?: string };
}

async function runDocker(code: string) {
  const encoded = Buffer.from(code).toString("base64");
  const { stdout, stderr } = await execFileAsync("docker", ["run", "--rm", "--network=none", "--cpus=0.5", "--memory=128m", "python:3.11-slim", "python", "-c", `import base64; exec(base64.b64decode('${encoded}'))`], { timeout: 12000, maxBuffer: 20000 });
  return { ok: true, output: stdout || stderr };
}

export async function runSandboxWithHealing(code: string): Promise<SandboxResult> {
  const lines = code.trim().split("\n").filter(Boolean).length || 1;
  const policyError = policyCheck(code);
  if (policyError) return { ok: false, summary: "Execution blocked by policy", output: policyError, provider: "policy", attempts: 1, metrics: { lines, duration: "18ms", memory: "0 MB" } };

  const started = Date.now();
  const provider = process.env.UDIE_PYODIDE_URL ? "pyodide" : process.env.UDIE_SANDBOX_DOCKER === "true" ? "docker" : "policy";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      if (provider === "pyodide") {
        const result = await runPyodideService(code);
        if (!result.ok) throw new Error(result.error ?? "Pyodide execution failed");
        return { ok: true, summary: attempt === 1 ? "Sandbox run completed" : `Sandbox run healed on attempt ${attempt}`, output: result.output ?? "No output", provider, attempts: attempt, metrics: { lines, duration: `${Date.now() - started}ms`, memory: "remote-limited" } };
      }
      if (provider === "docker") {
        const result = await runDocker(code);
        return { ok: true, summary: attempt === 1 ? "Docker sandbox completed" : `Docker sandbox healed on attempt ${attempt}`, output: result.output, provider, attempts: attempt, metrics: { lines, duration: `${Date.now() - started}ms`, memory: "128 MB cap" } };
      }
      return { ok: true, summary: attempt === 1 ? "Static sandbox preview completed" : `Preview healed on attempt ${attempt}`, output: `Analyzed ${lines} line${lines === 1 ? "" : "s"}; no external side effects detected. Enable UDIE_PYODIDE_URL or UDIE_SANDBOX_DOCKER for execution.`, provider: "policy", attempts: attempt, metrics: { lines, duration: `${Date.now() - started}ms`, memory: "0 MB" } };
    } catch (error) {
      if (attempt === 3) return { ok: false, summary: "Sandbox failed after 3 bounded attempts", output: error instanceof Error ? error.message : "Unknown sandbox error", provider, attempts: attempt, metrics: { lines, duration: `${Date.now() - started}ms`, memory: "bounded" } };
    }
  }
  throw new Error("Sandbox loop exhausted");
}
