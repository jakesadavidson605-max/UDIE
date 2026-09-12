import { Streamdown } from "streamdown";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowUp,
  Bell,
  BookOpen,
  Bot,
  BrainCircuit,
  Check,
  ChevronDown,
  CircleDot,
  Code2,
  Command,
  Cpu,
  Database,
  FlaskConical,
  GitBranch,
  Globe2,
  Layers3,
  MessageSquareText,
  Network,
  PanelRight,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Terminal,
  Workflow,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { IntegrationDrawer } from "@/components/IntegrationDrawer";
import { useAuth } from "@/_core/hooks/useAuth";

type Panel = "memory" | "agents" | "system";
type ChatMessage = { role: "user" | "assistant"; content: string; source?: string; warning?: string | null; events?: { agent: string; status: string; detail: string; durationMs: number }[]; citations?: { label: string; href: string; citation: string }[] };

const initialMessages: ChatMessage[] = [
  {
    role: "assistant",
    source: "orchestrator",
    content:
      "## Workspace online\n\nUDIE is ready. I can decompose a task, inspect the memory graph, route through the local/cloud gateway, or preview a safe sandbox run.\n\n**What are we solving?**",
  },
];

const accentClasses: Record<string, string> = {
  cyan: "bg-cyan-400 shadow-[0_0_18px_rgba(34,211,238,.75)]",
  violet: "bg-violet-400 shadow-[0_0_18px_rgba(167,139,250,.7)]",
  amber: "bg-amber-300 shadow-[0_0_18px_rgba(252,211,77,.6)]",
  emerald: "bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,.65)]",
  rose: "bg-rose-400 shadow-[0_0_18px_rgba(251,113,133,.65)]",
};

function Pill({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "cyan" | "violet" | "amber" | "green" }) {
  const tones = {
    slate: "border-white/10 bg-white/[.04] text-slate-300",
    cyan: "border-cyan-400/20 bg-cyan-400/10 text-cyan-200",
    violet: "border-violet-400/20 bg-violet-400/10 text-violet-200",
    amber: "border-amber-300/20 bg-amber-300/10 text-amber-200",
    green: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
  };
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[.14em] ${tones[tone]}`}>{children}</span>;
}

function IconButton({ label, children, active = false, onClick }: { label: string; children: React.ReactNode; active?: boolean; onClick?: () => void }) {
  return <button aria-label={label} onClick={onClick} className={`icon-button ${active ? "icon-button-active" : ""}`}>{children}</button>;
}

function Sidebar({ onNewThread }: { onNewThread: () => void }) {
  return (
    <aside className="hidden w-[236px] shrink-0 flex-col border-r border-white/[.07] bg-[#0b0e16]/90 px-3 py-4 lg:flex">
      <div className="mb-7 flex items-center gap-3 px-2">
        <div className="brand-mark"><BrainCircuit size={18} /></div>
        <div>
          <div className="font-display text-[15px] font-bold tracking-[.18em] text-white">UDIE</div>
          <div className="mono text-[9px] uppercase tracking-[.22em] text-slate-500">intelligence engine</div>
        </div>
      </div>

      <button onClick={onNewThread} className="mb-5 flex items-center justify-between rounded-xl border border-cyan-400/25 bg-cyan-400/[.08] px-3 py-2.5 text-left text-sm text-cyan-100 transition hover:border-cyan-300/50 hover:bg-cyan-400/[.13] active:scale-[.98]">
        <span className="flex items-center gap-2"><Plus size={15} /> New thread</span><Command size={13} className="text-cyan-300/60" />
      </button>

      <div className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[.18em] text-slate-600">Workspace</div>
      <nav className="space-y-1">
        {[
          [MessageSquareText, "Operator chat", true],
          [Network, "Memory graph", false],
          [Workflow, "Agent runs", false],
          [FlaskConical, "Sandbox", false],
        ].map(([Icon, label, active]) => {
          const Component = Icon as typeof MessageSquareText;
          return <button key={label as string} onClick={() => !active && toast("This view is represented in the control plane for the MVP.")} className={`sidebar-link ${active ? "sidebar-link-active" : ""}`}><Component size={16} /><span>{label as string}</span>{active && <CircleDot size={10} className="ml-auto text-cyan-300" />}</button>;
        })}
      </nav>

      <div className="mt-8 mb-2 px-2 text-[10px] font-bold uppercase tracking-[.18em] text-slate-600">Collections</div>
      <div className="space-y-1">
        {["UDIE master build", "Research notes", "Experiments"].map((item, index) => <button key={item} className="sidebar-link text-slate-400 hover:text-slate-200"><span className={`h-1.5 w-1.5 rounded-full ${index === 0 ? "bg-cyan-300" : index === 1 ? "bg-violet-300" : "bg-amber-300"}`} />{item}</button>)}
      </div>

      <div className="mt-auto rounded-2xl border border-white/[.07] bg-white/[.025] p-3">
        <div className="mb-3 flex items-center justify-between"><span className="text-xs font-medium text-slate-300">System health</span><Pill tone="green"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> nominal</Pill></div>
        <div className="space-y-2.5 text-[11px] text-slate-500">
          {["Gateway", "Memory index", "Sandbox"].map((label, index) => <div key={label} className="flex items-center justify-between"><span>{label}</span><span className="flex items-center gap-1.5 text-slate-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{index === 0 ? "hybrid" : "ready"}</span></div>)}
        </div>
      </div>
    </aside>
  );
}

function ThreadHeader({ onNewThread }: { onNewThread: () => void }) {
  return <header className="flex h-[66px] items-center justify-between border-b border-white/[.07] px-5 md:px-7">
    <div className="flex min-w-0 items-center gap-3">
      <div className="lg:hidden brand-mark"><BrainCircuit size={17} /></div>
      <div className="min-w-0"><div className="flex items-center gap-2"><h1 className="truncate text-sm font-semibold text-white">Untitled intelligence thread</h1><ChevronDown size={14} className="shrink-0 text-slate-500" /></div><div className="mono mt-1 flex items-center gap-2 text-[10px] uppercase tracking-[.16em] text-slate-600"><span>Local session</span><span className="h-1 w-1 rounded-full bg-cyan-400" /><span>Updated just now</span></div></div>
    </div>
    <div className="flex items-center gap-1.5"><IconButton label="Refresh thread" onClick={() => toast("Thread state is already current.")}><RefreshCw size={15} /></IconButton><IconButton label="Notifications" onClick={() => toast("No new system notifications.")}><Bell size={15} /></IconButton><button onClick={onNewThread} className="ml-1 hidden items-center gap-2 rounded-lg border border-white/10 bg-white/[.04] px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/[.08] sm:flex"><Plus size={14} /> New</button></div>
  </header>;
}

function AgentRail({ agents }: { agents: { id: string; name: string; role: string; status: string; detail: string; accent: string }[] | undefined }) {
  return <div className="mb-5 overflow-hidden rounded-2xl border border-white/[.07] bg-[#0c1019]/80">
    <div className="flex items-center justify-between border-b border-white/[.06] px-4 py-3"><div className="flex items-center gap-2 text-xs font-semibold text-slate-200"><Workflow size={14} className="text-cyan-300" /> Execution graph</div><Pill tone="cyan"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300" /> live</Pill></div>
    <div className="grid grid-cols-2 gap-px bg-white/[.05] md:grid-cols-4">
      {(agents ?? []).map((agent, index) => <div key={agent.id} className="relative bg-[#0c1019] p-3"><div className="mb-3 flex items-center justify-between"><span className={`h-2 w-2 rounded-full ${accentClasses[agent.accent] ?? accentClasses.cyan} ${agent.status === "active" ? "animate-pulse" : ""}`} /><span className="mono text-[9px] uppercase tracking-[.14em] text-slate-600">0{index + 1}</span></div><div className="text-xs font-semibold text-slate-200">{agent.name}</div><div className="mt-1 text-[10px] text-slate-500">{agent.role}</div><div className={`mt-3 text-[10px] ${agent.status === "active" ? "text-cyan-200" : "text-slate-600"}`}>{agent.status === "active" ? agent.detail : agent.status}</div>{index < 3 && <div className="agent-connector" />}</div>)}
    </div>
  </div>;
}

function MemoryGraph({ nodes }: { nodes: { id: string; title: string; type: string; excerpt: string; score: number; connections: number; color: string }[] }) {
  return <div className="relative mt-4 h-[190px] overflow-hidden rounded-xl border border-white/[.06] bg-[#090c14] grid-bg">
    <div className="absolute inset-0 opacity-60"><svg viewBox="0 0 500 190" className="h-full w-full"><path d="M60 92 C140 26 205 154 274 78 S390 44 454 112" fill="none" stroke="#25364c" strokeWidth="1" /><path d="M78 145 C180 122 208 54 306 120 S390 156 442 56" fill="none" stroke="#1b2c3d" strokeWidth="1" /><path d="M60 92 L306 120 M274 78 L442 56" fill="none" stroke="#1c3549" strokeDasharray="3 5" strokeWidth="1" /></svg></div>
    {nodes.slice(0, 5).map((node, index) => { const spots = [[12, 42], [31, 17], [53, 57], [72, 30], [86, 60]]; const [left, top] = spots[index] ?? [50, 50]; return <div key={node.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${left}%`, top: `${top}%` }}><div className={`memory-node ${node.color}`}><span /></div><div className="mt-1 whitespace-nowrap text-[9px] text-slate-500">{node.title.split(" ").slice(0, 2).join(" ")}</div></div>; })}
    <div className="absolute bottom-3 left-3 flex items-center gap-2"><Pill tone="slate"><Network size={11} /> 38 nodes</Pill><Pill tone="slate"><GitBranch size={11} /> 71 edges</Pill></div>
  </div>;
}

function ControlPanel({ activePanel, setActivePanel, temperature, setTemperature, topP, setTopP, prompt, setPrompt, nodes, agents, sandboxOutput, setSandboxOutput }: { activePanel: Panel; setActivePanel: (panel: Panel) => void; temperature: number; setTemperature: (value: number) => void; topP: number; setTopP: (value: number) => void; prompt: string; setPrompt: (value: string) => void; nodes: { id: string; title: string; type: string; excerpt: string; score: number; connections: number; color: string }[]; agents: { id: string; name: string; role: string; status: string; detail: string; accent: string }[] | undefined; sandboxOutput: { ok: boolean; summary: string; output: string; metrics: { lines: number; duration: string; memory: string } } | null; setSandboxOutput: (output: { ok: boolean; summary: string; output: string; metrics: { lines: number; duration: string; memory: string } } | null) => void }) {
  const sandbox = trpc.udie.sandbox.useMutation({ onSuccess: data => setSandboxOutput(data), onError: () => toast.error("Sandbox preview failed") });
  const tabs: [Panel, string, React.ReactNode][] = [["memory", "Memory", <Network size={14} />], ["agents", "Agents", <Bot size={14} />], ["system", "System", <SlidersHorizontal size={14} />]];
  return <aside className="hidden w-[330px] shrink-0 border-l border-white/[.07] bg-[#0b0e16]/85 xl:flex xl:flex-col"><div className="flex h-[66px] items-center justify-between border-b border-white/[.07] px-4"><div className="flex items-center gap-2 text-xs font-semibold text-slate-200"><PanelRight size={15} className="text-cyan-300" /> Control plane</div><IconButton label="Control plane info" onClick={() => toast("The control plane exposes live MVP controls.")}><Settings2 size={15} /></IconButton></div><div className="flex border-b border-white/[.07] px-3 pt-2">{tabs.map(([id, label, icon]) => <button onClick={() => setActivePanel(id)} key={id} className={`control-tab ${activePanel === id ? "control-tab-active" : ""}`}>{icon}{label}</button>)}</div><div className="flex-1 overflow-y-auto p-4">
    {activePanel === "memory" && <><div className="mb-4 flex items-start justify-between"><div><div className="text-sm font-semibold text-slate-100">Memory field</div><div className="mt-1 text-[11px] leading-relaxed text-slate-500">Hybrid context currently attached to this thread.</div></div><button onClick={() => toast("Memory re-index queued for the MVP preview.")} className="rounded-lg border border-white/10 p-2 text-slate-500 transition hover:border-cyan-400/30 hover:text-cyan-200"><RefreshCw size={14} /></button></div><div className="grid grid-cols-3 gap-2"><div className="metric-tile"><span>Recall</span><strong>0.91</strong></div><div className="metric-tile"><span>Nodes</span><strong>38</strong></div><div className="metric-tile"><span>Tokens</span><strong>2.4k</strong></div></div><MemoryGraph nodes={nodes} /><div className="mt-5 mb-2 flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-600">Top matches</span><button className="text-[10px] text-cyan-300 hover:text-cyan-200">inspect all</button></div><div className="space-y-2">{nodes.slice(0, 4).map(node => <div key={node.id} className="memory-card"><div className="flex items-start justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><span className={`h-2 w-2 shrink-0 rounded-full ${accentClasses[node.color] ?? accentClasses.cyan}`} /><span className="truncate text-xs font-medium text-slate-200">{node.title}</span></div><span className="mono shrink-0 text-[10px] text-cyan-200">{node.score.toFixed(2)}</span></div><p className="mt-2 line-clamp-2 text-[10px] leading-relaxed text-slate-500">{node.excerpt}</p><div className="mt-2 flex items-center gap-2 text-[9px] uppercase tracking-[.12em] text-slate-600"><span>{node.type}</span><span>•</span><span>{node.connections} links</span></div></div>)}</div></>}
    {activePanel === "agents" && <><div className="mb-4"><div className="text-sm font-semibold text-slate-100">Agent roster</div><div className="mt-1 text-[11px] leading-relaxed text-slate-500">Roles stay visible so every synthesis step is inspectable.</div></div><div className="space-y-2">{(agents ?? []).map(agent => <div key={agent.id} className="memory-card"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${accentClasses[agent.accent] ?? accentClasses.cyan}`} /><span className="text-xs font-semibold text-slate-200">{agent.name}</span></div><Pill tone={agent.status === "active" ? "cyan" : "slate"}>{agent.status}</Pill></div><div className="mt-2 text-[10px] text-slate-500">{agent.role}</div><div className="mt-2 text-[10px] leading-relaxed text-slate-400">{agent.detail}</div></div>)}</div><div className="mt-5 rounded-xl border border-amber-300/15 bg-amber-300/[.04] p-3"><div className="flex items-center gap-2 text-xs font-semibold text-amber-100"><ShieldCheck size={14} /> Self-healing loop</div><p className="mt-2 text-[10px] leading-relaxed text-amber-100/50">Stack traces can be routed back to Executor for up to three bounded correction passes.</p></div></>}
    {activePanel === "system" && <><div className="mb-4"><div className="text-sm font-semibold text-slate-100">Gateway controls</div><div className="mt-1 text-[11px] leading-relaxed text-slate-500">Adjust the execution envelope without leaving the thread.</div></div><label className="field-label">System prompt<textarea value={prompt} onChange={event => setPrompt(event.target.value)} className="control-textarea" rows={6} /></label><div className="mt-4"><div className="mb-2 flex justify-between"><span className="field-label mb-0">Temperature</span><span className="mono text-[10px] text-cyan-200">{temperature.toFixed(2)}</span></div><input aria-label="Temperature" type="range" min="0" max="1" step="0.05" value={temperature} onChange={event => setTemperature(Number(event.target.value))} className="control-range" /></div><div className="mt-4"><div className="mb-2 flex justify-between"><span className="field-label mb-0">Top P</span><span className="mono text-[10px] text-cyan-200">{topP.toFixed(2)}</span></div><input aria-label="Top P" type="range" min="0" max="1" step="0.05" value={topP} onChange={event => setTopP(Number(event.target.value))} className="control-range" /></div><div className="mt-5 rounded-xl border border-white/[.07] bg-white/[.025] p-3"><div className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-200"><Code2 size={14} className="text-amber-200" /> Safe sandbox preview</div><pre className="mono overflow-x-auto rounded-lg bg-[#06080d] p-3 text-[10px] leading-relaxed text-slate-400">{`const context = retrieve(query)\nreturn compress(context)`}</pre><button onClick={() => sandbox.mutate({ code: "const context = retrieve(query)\nreturn compress(context)" })} disabled={sandbox.isPending} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-amber-300/20 bg-amber-300/10 py-2 text-xs font-semibold text-amber-100 transition hover:bg-amber-300/15 disabled:opacity-50"><Play size={13} /> {sandbox.isPending ? "Analyzing…" : "Run safe preview"}</button>{sandboxOutput && <div className={`mt-3 rounded-lg border p-2.5 text-[10px] ${sandboxOutput.ok ? "border-emerald-400/20 bg-emerald-400/[.06] text-emerald-100" : "border-rose-400/20 bg-rose-400/[.06] text-rose-100"}`}><div className="font-semibold">{sandboxOutput.summary}</div><div className="mt-1 opacity-70">{sandboxOutput.output}</div><div className="mono mt-2 opacity-50">{sandboxOutput.metrics.duration} · {sandboxOutput.metrics.memory}</div></div>}</div></>}
  </div></aside>;
}

export default function Home() {
  const { isAuthenticated } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [threadId, setThreadId] = useState<string | undefined>();
  const [integrationsOpen, setIntegrationsOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<Panel>("memory");
  const [mode, setMode] = useState<"hybrid" | "local" | "cloud">("hybrid");
  const [temperature, setTemperature] = useState(0.35);
  const [topP, setTopP] = useState(0.9);
  const [prompt, setPrompt] = useState("You are an objective analytical intelligence engine. Prioritize clarity, evidence, and explicit uncertainty.");
  const [sandboxOutput, setSandboxOutput] = useState<{ ok: boolean; summary: string; output: string; metrics: { lines: number; duration: string; memory: string } } | null>(null);
  const memoryInput = useMemo(() => ({ query: "" }), []);
  const { data: threads } = trpc.workspace.threads.useQuery(undefined, { enabled: isAuthenticated });
  const createThread = trpc.workspace.createThread.useMutation({ onSuccess: thread => setThreadId(thread.id) });
  const { data: nodes = [] } = trpc.udie.memory.useQuery(memoryInput);
  const { data: agents } = trpc.udie.agents.useQuery();
  useEffect(() => {
    if (!isAuthenticated || threadId || createThread.isPending || threads === undefined) return;
    if (threads[0]) setThreadId(threads[0].id);
    else createThread.mutate({ title: "Untitled intelligence thread", mode });
  }, [createThread, isAuthenticated, mode, threadId, threads]);
  const chat = trpc.udie.chat.useMutation({
    onSuccess: data => setMessages(previous => [...previous, { role: "assistant", content: data.content, source: data.source, warning: data.warning, events: data.events, citations: data.citations }]),
    onError: () => { setMessages(previous => [...previous, { role: "assistant", content: "The orchestration request could not be completed. Check the gateway configuration and retry." }]); toast.error("Orchestration request failed"); },
  });

  const sendMessage = () => {
    const message = draft.trim();
    if (!message || chat.isPending) return;
    setMessages(previous => [...previous, { role: "user", content: message }]);
    setDraft("");
    chat.mutate({ message, mode, prompt, temperature, topP, threadId });
  };
  const resetThread = () => { setMessages(initialMessages); setDraft(""); toast.success("Fresh intelligence thread created"); };

  return <div className="app-shell"><Sidebar onNewThread={resetThread} /><main className="flex min-w-0 flex-1 flex-col"><ThreadHeader onNewThread={resetThread} /><div className="workspace-scroll flex-1 overflow-y-auto"><div className="mx-auto w-full max-w-[920px] px-4 py-6 md:px-8 md:py-8"><div className="mb-5 flex flex-wrap items-center gap-2"><Pill tone="cyan"><Zap size={11} /> Orchestrator online</Pill><Pill><Database size={11} /> hybrid memory</Pill><Pill><Cpu size={11} /> 12k context</Pill></div><AgentRail agents={agents} /><section className="space-y-6">{messages.map((message, index) => <div key={`${message.role}-${index}`} className={`message-row ${message.role === "user" ? "message-row-user" : ""}`}><div className={`avatar ${message.role === "user" ? "avatar-user" : "avatar-ai"}`}>{message.role === "user" ? "OP" : <Sparkles size={16} />}</div><div className="min-w-0 max-w-[760px] flex-1"><div className="mb-2 flex items-center gap-2"><span className="text-xs font-semibold text-slate-200">{message.role === "user" ? "Operator" : "UDIE core"}</span>{message.source && <span className="mono text-[9px] uppercase tracking-[.12em] text-slate-600">via {message.source}</span>}{message.warning && <span className="text-[10px] text-amber-300">{message.warning}</span>}</div><div className={`message-bubble ${message.role === "user" ? "message-bubble-user" : "message-bubble-ai"}`}>{message.role === "assistant" ? <Streamdown>{message.content}</Streamdown> : <p className="whitespace-pre-wrap text-sm leading-7 text-slate-200">{message.content}</p>}</div>{message.events && <div className="mt-2 flex flex-wrap gap-1.5">{message.events.map((event, eventIndex) => <span key={`${event.agent}-${eventIndex}`} className="trace-chip"><Check size={10} /> {event.agent} · {event.durationMs}ms</span>)}</div>}{message.citations && message.citations.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{message.citations.slice(0, 4).map(citation => <a key={citation.citation} href={citation.href.startsWith("http") ? citation.href : undefined} onClick={event => { if (!citation.href.startsWith("http")) event.preventDefault(); }} className="citation-chip"><BookOpen size={10} /> {citation.citation}</a>)}</div>}</div></div>)}{chat.isPending && <div className="message-row"><div className="avatar avatar-ai"><Sparkles size={16} /></div><div><div className="mb-2 text-xs font-semibold text-slate-200">UDIE core <span className="mono ml-2 text-[9px] uppercase tracking-[.12em] text-cyan-300">orchestrating</span></div><div className="message-bubble message-bubble-ai flex items-center gap-2 text-xs text-slate-500"><span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" /> routing through planner → researcher → reviewer</div></div></div>}</section></div></div><div className="border-t border-white/[.07] bg-[#0b0e16]/95 px-4 pb-5 pt-4 md:px-8"><div className="mx-auto max-w-[920px]"><div className="relative rounded-2xl border border-white/[.1] bg-[#111621] shadow-2xl shadow-black/20 transition focus-within:border-cyan-300/35"><textarea value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} placeholder="Ask UDIE to reason, retrieve, or execute…" rows={2} className="w-full resize-none bg-transparent px-4 pb-12 pt-4 text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-600" /><div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between"><div className="flex items-center gap-1.5"><button className="composer-tool" onClick={() => setIntegrationsOpen(true)}><BookOpen size={13} /> <span className="hidden sm:inline">Attach context</span></button><button className="composer-tool" onClick={() => setActivePanel("system")}><Settings2 size={13} /> <span className="hidden sm:inline">Controls</span></button></div><div className="flex items-center gap-2"><select aria-label="Gateway mode" value={mode} onChange={event => setMode(event.target.value as typeof mode)} className="mode-select"><option value="hybrid">Hybrid gateway</option><option value="local">Local endpoint</option><option value="cloud">Cloud API</option></select><button aria-label="Send message" onClick={sendMessage} className="send-button"><ArrowUp size={16} /></button></div></div></div><div className="mt-2 flex items-center justify-between px-1 text-[10px] text-slate-600"><span>Enter to send · Shift + Enter for newline</span><span className="mono">{draft.length}/8000</span></div></div></div></main><ControlPanel activePanel={activePanel} setActivePanel={setActivePanel} temperature={temperature} setTemperature={setTemperature} topP={topP} setTopP={setTopP} prompt={prompt} setPrompt={setPrompt} nodes={nodes} agents={agents} sandboxOutput={sandboxOutput} setSandboxOutput={setSandboxOutput} /><IntegrationDrawer open={integrationsOpen} onClose={() => setIntegrationsOpen(false)} /></div>;
}
