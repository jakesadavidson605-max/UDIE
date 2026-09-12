export type MemoryNode = {
  id: string;
  title: string;
  type: "concept" | "source" | "entity" | "decision";
  excerpt: string;
  score: number;
  connections: number;
  color: string;
};

export type AgentStatus = {
  id: string;
  name: string;
  role: string;
  status: "active" | "ready" | "standby";
  detail: string;
  accent: string;
};

export const demoMemory: MemoryNode[] = [
  {
    id: "m-001",
    title: "Hybrid retrieval pipeline",
    type: "concept",
    excerpt: "Dense vectors, BM25 keywords, and graph signals merge before context compression.",
    score: 0.96,
    connections: 14,
    color: "cyan",
  },
  {
    id: "m-002",
    title: "Context compression threshold",
    type: "decision",
    excerpt: "Compress retrieved blocks when the working prompt exceeds 4,000 tokens.",
    score: 0.91,
    connections: 9,
    color: "violet",
  },
  {
    id: "m-003",
    title: "UDIE architecture brief",
    type: "source",
    excerpt: "The master build calls for planner, researcher, executor, and reviewer roles.",
    score: 0.87,
    connections: 11,
    color: "amber",
  },
  {
    id: "m-004",
    title: "Safe execution boundary",
    type: "concept",
    excerpt: "Code experiments remain isolated and resource-limited before any result is promoted.",
    score: 0.82,
    connections: 7,
    color: "emerald",
  },
  {
    id: "m-005",
    title: "Local-first model gateway",
    type: "entity",
    excerpt: "Local endpoints are preferred for iteration; cloud gateways provide escalation.",
    score: 0.78,
    connections: 6,
    color: "rose",
  },
];

export const demoAgents: AgentStatus[] = [
  {
    id: "planner",
    name: "Planner",
    role: "Intent decomposition",
    status: "active",
    detail: "Mapping the request into a small execution graph",
    accent: "cyan",
  },
  {
    id: "researcher",
    name: "Researcher",
    role: "Hybrid retrieval",
    status: "ready",
    detail: "Dense + sparse + graph sources are primed",
    accent: "violet",
  },
  {
    id: "executor",
    name: "Executor",
    role: "Synthesis & tools",
    status: "ready",
    detail: "Gateway available with safe sandbox boundary",
    accent: "amber",
  },
  {
    id: "reviewer",
    name: "Reviewer",
    role: "Quality loop",
    status: "standby",
    detail: "Will inspect citations and unresolved claims",
    accent: "emerald",
  },
];

export function buildFallbackAnswer(message: string, mode: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("architecture") || normalized.includes("build")) {
    return `## Execution brief\n\nI decomposed this into four bounded passes:\n\n1. **Plan** — identify intent, constraints, and the smallest useful artifact.\n2. **Retrieve** — combine semantic, keyword, and graph signals from memory.\n3. **Execute** — synthesize the answer or run a safe experiment.\n4. **Review** — check assumptions, cite sources, and surface uncertainty.\n\nThe current gateway is **${mode}**. In this MVP, the control plane is real and the local fallback keeps the workspace responsive when no model endpoint is available.`;
  }

  if (normalized.includes("memory") || normalized.includes("rag")) {
    return `### Memory readout\n\nThe strongest matches are **Hybrid retrieval pipeline** (0.96), **Context compression threshold** (0.91), and **UDIE architecture brief** (0.87). The next useful implementation step is to persist these records behind the existing tRPC boundary, then replace the seeded graph with a vector + keyword index.`;
  }

  return `I’m operating in **${mode}** mode. I can help you decompose a problem, inspect memory, draft an implementation plan, or run a safe sandbox experiment.\n\nTry asking: **“How should UDIE handle a 12,000-token research task?”**`;
}

export function runSafeSandbox(code: string) {
  const lines = code.trim().split("\n").filter(Boolean).length;
  const hasRiskyCall = /child_process|subprocess|os\.system|rm\s+-rf|fetch\(/i.test(code);
  if (hasRiskyCall) {
    return {
      ok: false,
      summary: "Execution blocked by policy",
      output: "The preview sandbox rejected a network, process, or destructive filesystem call.",
      metrics: { lines, duration: "18ms", memory: "0 MB" },
    };
  }
  return {
    ok: true,
    summary: "Dry run completed",
    output: `Preview sandbox analyzed ${lines || 1} code line${lines === 1 ? "" : "s"}. No external side effects detected.`,
    metrics: { lines, duration: "42ms", memory: "18 MB" },
  };
}
