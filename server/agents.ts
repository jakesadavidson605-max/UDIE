import { buildFallbackAnswer, demoAgents } from "./udie";
import { compressContext, hybridSearch } from "./memory";
import { GatewayMode, generateWithGateway } from "./gateways";
import { runSandboxWithHealing } from "./sandbox";

export type AgentEvent = { agent: string; status: "started" | "completed" | "failed"; detail: string; durationMs: number };

function planIntent(message: string) {
  const lower = message.toLowerCase();
  return { intent: lower.includes("code") || lower.includes("run") ? "execution" : lower.includes("research") || lower.includes("source") ? "research" : "analysis", needsRetrieval: !lower.includes("hello"), needsSandbox: lower.includes("run") || lower.includes("execute") || lower.includes("code") };
}

export async function orchestrate(input: { message: string; mode: GatewayMode; prompt: string; temperature: number; topP: number; sandboxCode?: string }) {
  const started = Date.now();
  const events: AgentEvent[] = [];
  const emit = (agent: string, status: AgentEvent["status"], detail: string, at: number) => events.push({ agent, status, detail, durationMs: Date.now() - at });
  const plannerStarted = Date.now();
  const plan = planIntent(input.message);
  emit("Planner", "completed", `Classified as ${plan.intent}; retrieval=${plan.needsRetrieval}; sandbox=${plan.needsSandbox}`, plannerStarted);

  const researcherStarted = Date.now();
  const hits = plan.needsRetrieval ? await hybridSearch(input.message, 6) : [];
  const context = compressContext(hits.map(hit => `${hit.content}\nCitation: ${hit.citation}`), 4000);
  emit("Researcher", "completed", `${hits.length} memory matches; context compressed to ${context.join(" ").split(/\s+/).length} tokens`, researcherStarted);

  let sandbox;
  if (plan.needsSandbox && input.sandboxCode) {
    const executorStarted = Date.now();
    sandbox = await runSandboxWithHealing(input.sandboxCode);
    emit("Executor", sandbox.ok ? "completed" : "failed", sandbox.summary, executorStarted);
  }

  const synthesisStarted = Date.now();
  const messages = [{ role: "system" as const, content: `${input.prompt}\n\nYou are the UDIE Executor. Use the retrieved evidence below. Cite relevant memory records and state what is uncertain.\n\n${context.join("\n\n")}` }, { role: "user" as const, content: input.message }];
  let result: { content: string; provider: string; model: string };
  try {
    result = await generateWithGateway({ mode: input.mode, messages, temperature: input.temperature, topP: input.topP });
  } catch {
    result = { content: buildFallbackAnswer(input.message, input.mode), provider: "local-fallback", model: "deterministic" };
  }
  emit("Executor", "completed", `Synthesized with ${result.provider}/${result.model}`, synthesisStarted);

  const reviewerStarted = Date.now();
  const citations = hits.map(hit => ({ label: hit.title, href: hit.sourceUrl ?? `memory://${hit.documentId}`, citation: hit.citation }));
  const reviewedContent = citations.length > 0 && !result.content.includes("Sources") ? `${result.content}\n\n### Sources\n${citations.map(citation => `- ${citation.citation} — ${citation.label}`).join("\n")}` : result.content;
  emit("Reviewer", "completed", `Checked ${citations.length} citations and ${sandbox ? "sandbox result" : "no sandbox request"}`, reviewerStarted);

  return { content: reviewedContent, provider: result.provider, model: result.model, events, citations, sandbox, durationMs: Date.now() - started, agents: demoAgents };
}
