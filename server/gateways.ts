import { invokeLLM, listLLMModels } from "./_core/llm";

export type GatewayMode = "hybrid" | "local" | "cloud";
export type GatewayProvider = "ollama" | "vllm" | "openrouter" | "openai" | "anthropic" | "builtin";
export type GatewayConfig = { provider: GatewayProvider; label: string; endpoint?: string; model: string; enabled: boolean };
export type GatewayMessage = { role: "system" | "user" | "assistant"; content: string };
export type GatewayRequest = { mode: GatewayMode; provider?: GatewayProvider; apiKey?: string; messages: GatewayMessage[]; temperature: number; topP: number; onToken?: (token: string) => void };

const defaults: GatewayConfig[] = [
  { provider: "builtin", label: "Built-in gateway", model: process.env.UDIE_BUILTIN_MODEL ?? "default", enabled: true },
  { provider: "ollama", label: "Local Ollama", endpoint: process.env.UDIE_OLLAMA_URL ?? "http://localhost:11434", model: process.env.UDIE_OLLAMA_MODEL ?? "llama3.1", enabled: Boolean(process.env.UDIE_OLLAMA_URL) },
  { provider: "vllm", label: "Local vLLM", endpoint: process.env.UDIE_VLLM_URL ?? "http://localhost:8000", model: process.env.UDIE_VLLM_MODEL ?? "Qwen/Qwen2.5-7B-Instruct", enabled: Boolean(process.env.UDIE_VLLM_URL) },
  { provider: "openrouter", label: "OpenRouter", endpoint: "https://openrouter.ai/api/v1", model: process.env.UDIE_OPENROUTER_MODEL ?? "openai/gpt-4o-mini", enabled: Boolean(process.env.OPENROUTER_API_KEY) },
  { provider: "openai", label: "OpenAI", endpoint: "https://api.openai.com/v1", model: process.env.UDIE_OPENAI_MODEL ?? "gpt-4o-mini", enabled: Boolean(process.env.OPENAI_API_KEY) },
  { provider: "anthropic", label: "Anthropic", endpoint: "https://api.anthropic.com/v1", model: process.env.UDIE_ANTHROPIC_MODEL ?? "claude-3-5-sonnet-latest", enabled: Boolean(process.env.ANTHROPIC_API_KEY) },
];

export function listConfiguredGateways(): GatewayConfig[] { return defaults.map(config => ({ ...config })); }

function chooseGateway(mode: GatewayMode, provider?: GatewayProvider, apiKey?: string) {
  if (provider) {
    const explicit = defaults.find(config => config.provider === provider);
    if (explicit && (explicit.enabled || apiKey)) return explicit;
    if (provider === "openrouter" && apiKey) return defaults.find(config => config.provider === "openrouter")!;
  }
  const available = defaults.filter(config => config.enabled);
  if (mode === "local") return available.find(config => config.provider === "ollama" || config.provider === "vllm") ?? available[0];
  if (mode === "cloud") return available.find(config => config.provider === "openrouter" || config.provider === "anthropic" || config.provider === "openai") ?? available[0];
  return available.find(config => config.provider !== "builtin") ?? available[0];
}

function credentialFor(config: GatewayConfig, apiKey?: string) {
  if (apiKey?.trim()) return apiKey.trim();
  if (config.provider === "openrouter") return process.env.OPENROUTER_API_KEY;
  if (config.provider === "openai") return process.env.OPENAI_API_KEY;
  return undefined;
}

async function parseSse(response: Response, onToken: (token: string) => void) {
  if (!response.body) throw new Error("Gateway returned no streaming body");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const data = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string } }> };
        const token = data.choices?.[0]?.delta?.content;
        if (token) onToken(token);
      } catch { /* ignore keep-alive or malformed SSE lines */ }
    }
    if (done) break;
  }
}

async function openAiCompatible(config: GatewayConfig, input: GatewayRequest) {
  if (!config.endpoint) throw new Error("Gateway endpoint is not configured");
  const key = credentialFor(config, input.apiKey);
  if ((config.provider === "openrouter" || config.provider === "openai") && !key) throw new Error(`${config.label} API key is not configured`);
  const streaming = Boolean(input.onToken);
  const response = await fetch(`${config.endpoint.replace(/\/$/, "")}/chat/completions`, { method: "POST", headers: { "content-type": "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}), ...(config.provider === "openrouter" ? { "HTTP-Referer": process.env.UDIE_PUBLIC_URL ?? "https://manus.im", "X-Title": "UDIE" } : {}) }, body: JSON.stringify({ model: config.model, messages: input.messages, temperature: input.temperature, top_p: input.topP, ...(streaming ? { stream: true } : {}) }) });
  if (!response.ok) throw new Error(`${config.label} returned HTTP ${response.status}`);
  if (streaming) { let content = ""; await parseSse(response, token => { content += token; input.onToken?.(token); }); return content; }
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error(`${config.label} returned no text content`);
  return content;
}

async function anthropic(config: GatewayConfig, input: GatewayRequest) {
  if (!config.endpoint || !(input.apiKey?.trim() || process.env.ANTHROPIC_API_KEY)) throw new Error("Anthropic credentials are not configured");
  const key = input.apiKey?.trim() || process.env.ANTHROPIC_API_KEY;
  const system = input.messages.find(message => message.role === "system")?.content;
  const response = await fetch(`${config.endpoint.replace(/\/$/, "")}/messages`, { method: "POST", headers: { "content-type": "application/json", "x-api-key": key!, "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model: config.model, max_tokens: 1400, temperature: input.temperature, top_p: input.topP, system, messages: input.messages.filter(message => message.role !== "system").map(message => ({ role: message.role, content: message.content })) }) });
  if (!response.ok) throw new Error(`${config.label} returned HTTP ${response.status}`);
  const data = await response.json() as { content?: Array<{ type: string; text?: string }> };
  const content = data.content?.find(item => item.type === "text")?.text;
  if (!content) throw new Error(`${config.label} returned no text content`);
  input.onToken?.(content);
  return content;
}

export async function generateWithGateway(input: GatewayRequest) {
  const config = chooseGateway(input.mode, input.provider, input.apiKey);
  if (!config || config.provider === "builtin") {
    const response = await invokeLLM({ messages: input.messages });
    const content = response.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) throw new Error("Built-in gateway returned no content");
    input.onToken?.(content);
    return { content, provider: "builtin" as GatewayProvider, model: config?.model ?? "default" };
  }
  const content = config.provider === "anthropic" ? await anthropic(config, input) : await openAiCompatible(config, input);
  return { content, provider: config.provider, model: config.model };
}

export async function discoverBuiltinModels() {
  try { const result = await listLLMModels(); return result.data.map(model => ({ id: model.id, ownedBy: model.owned_by ?? "gateway" })); } catch { return []; }
}
