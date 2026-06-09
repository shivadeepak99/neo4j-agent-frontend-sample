"use client";

/**
 * DebugPanel.tsx — Agent Run Inspector
 *
 * A fully transparent, readable view of everything the backend reports for one
 * agent turn. Designed to live in a tall right-hand dock (or inline), with
 * stacked, collapsible sections that are expanded by default.
 *
 * Sections:
 *   Steps   — ordered run timeline (node starts + milestones from the SSE stream)
 *   Plan    — guardAndPlan decision: path, answerMode, requestedFields, cypher
 *   Tools   — every toolLoop call (execute_cypher / find_concept / search_payload)
 *             with purpose, args, latency, row counts, and full results
 *   Memory  — three-tier context: Redis continuation, Postgres turns, observations
 *   Perf    — token usage + per-node latency
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, Code2, Cpu, Database, BarChart3,
  AlertTriangle, CheckCircle2, XCircle, Clock, Zap, ChevronRight, Sparkles,
} from "lucide-react";
import type { DebugInfo, DebugToolObservation, DebugStep } from "@/hooks/useQuery";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DebugSections = {
  steps:  boolean;
  plan:   boolean;
  tools:  boolean;
  memory: boolean;
  perf:   boolean;
};

interface DebugPanelProps {
  info:            DebugInfo;
  visibleSections: DebugSections;
}

const SECTION_META: Record<keyof DebugSections, { icon: React.ReactNode; label: string }> = {
  steps:  { icon: <Activity  className="w-3.5 h-3.5" />, label: "Run timeline" },
  plan:   { icon: <Code2     className="w-3.5 h-3.5" />, label: "Plan & Cypher" },
  tools:  { icon: <Cpu       className="w-3.5 h-3.5" />, label: "Tool calls" },
  memory: { icon: <Database  className="w-3.5 h-3.5" />, label: "Memory & context" },
  perf:   { icon: <BarChart3 className="w-3.5 h-3.5" />, label: "Performance" },
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function DebugPanel({ info, visibleSections }: DebugPanelProps) {
  const summary     = info.summary;
  const hasErrors   = (summary?.nonFatalErrors?.length ?? 0) > 0 || !!info.executeQuery?.queryError;
  const totalMs     = Object.values(summary?.nodeLatencies ?? {}).reduce((a, b) => a + b, 0);
  const totalTokens = summary?.tokenUsage ? summary.tokenUsage.input + summary.tokenUsage.output : null;
  const execPath    = summary?.executionPath ?? info.plan?.path;
  const toolCount   = info.toolObservations?.observations?.length ?? 0;

  const order: (keyof DebugSections)[] = ["steps", "plan", "tools", "memory", "perf"];
  const visible = order.filter((s) => visibleSections[s]);

  return (
    <div className="flex flex-col gap-3">
      {/* ── Summary strip ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl px-3 py-2.5 surface-2">
        {execPath && (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wide bg-[var(--brand-soft)] text-[var(--brand)] border border-[var(--brand-line)]">
            {String(execPath)}
          </span>
        )}
        <Metric icon={<Clock className="w-3 h-3" />} label={`${totalMs}ms`} />
        {totalTokens !== null && (
          <Metric icon={<Zap className="w-3 h-3" />} label={`${totalTokens.toLocaleString()} tok`} />
        )}
        <Metric icon={<Cpu className="w-3 h-3" />} label={`${toolCount} tool${toolCount !== 1 ? "s" : ""}`} />
        {hasErrors
          ? <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--warn)]"><AlertTriangle className="w-3.5 h-3.5" /> issues</span>
          : <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--ok)]"><CheckCircle2 className="w-3.5 h-3.5" /> clean</span>}
      </div>

      {/* ── Stacked sections ───────────────────────────────────────────────── */}
      {visible.map((id) => (
        <Section key={id} icon={SECTION_META[id].icon} title={SECTION_META[id].label} defaultOpen>
          {id === "steps"  && <StepsSection  info={info} />}
          {id === "plan"   && <PlanSection   info={info} />}
          {id === "tools"  && <ToolsSection  info={info} />}
          {id === "memory" && <MemorySection info={info} />}
          {id === "perf"   && <PerfSection   info={info} />}
        </Section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collapsible section shell
// ---------------------------------------------------------------------------

function Section({
  icon, title, defaultOpen = true, children,
}: { icon: React.ReactNode; title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl overflow-hidden surface">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-[var(--panel-2)] transition-colors"
      >
        <span className="text-[var(--brand)]">{icon}</span>
        <span className="text-[12.5px] font-semibold text-[var(--fg)]">{title}</span>
        <ChevronRight className={`w-4 h-4 ml-auto text-[var(--fg-faint)] transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 border-t border-[var(--line)]">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Steps / run timeline
// ---------------------------------------------------------------------------

function StepsSection({ info }: { info: DebugInfo }) {
  const steps = info.steps ?? [];
  if (steps.length === 0) return <Empty text="No timeline captured yet." />;

  const dotColor = (k: DebugStep["kind"]) =>
    k === "milestone" ? "var(--accent)" : k === "tool" ? "var(--brand-2)" : "var(--brand)";

  return (
    <ol className="relative pl-4 pt-1.5">
      <span className="absolute left-[5px] top-2 bottom-2 w-px bg-[var(--line-strong)]" />
      {steps.map((s, i) => (
        <li key={i} className="relative pb-2.5 last:pb-0">
          <span
            className="absolute -left-[11px] top-1 w-2.5 h-2.5 rounded-full ring-2 ring-[var(--app-bg)]"
            style={{ background: dotColor(s.kind) }}
          />
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[13px] text-[var(--fg)] leading-snug">{s.label}</span>
            <span className="text-[11px] font-mono text-[var(--fg-faint)] tnum shrink-0">{formatMs(s.atMs)}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

function PlanSection({ info }: { info: DebugInfo }) {
  const plan = info.plan;
  if (!plan?.path) return <Empty text="No plan (preFilter short-circuit, or not received yet)." />;

  return (
    <div className="space-y-3 pt-1.5">
      <div className="flex flex-wrap gap-1.5">
        <Badge label="path" value={String(plan.path)} />
        {plan.answerMode && <Badge label="mode" value={String(plan.answerMode)} />}
      </div>

      {plan.requestedFields && plan.requestedFields.length > 0 && (
        <div>
          <FieldLabel>requested fields</FieldLabel>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {plan.requestedFields.map((f) => (
              <span key={f} className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-[var(--brand-soft)] text-[var(--brand)] border border-[var(--brand-line)]">
                {f}
              </span>
            ))}
          </div>
        </div>
      )}

      {plan.cypher && (
        <div>
          <FieldLabel>generated cypher (pre safety-gate)</FieldLabel>
          <Code className="mt-1.5">{plan.cypher}</Code>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

function ToolsSection({ info }: { info: DebugInfo }) {
  const obs = info.toolObservations?.observations ?? [];
  if (obs.length === 0) return <Empty text="No tool calls (direct path, or not run yet)." />;

  return (
    <div className="space-y-2 pt-1.5">
      {obs.map((o, i) => <ToolCard key={i} idx={i + 1} obs={o} />)}
      {(info.toolObservations?.loopIterations ?? 0) > 0 && (
        <p className="text-[11px] text-[var(--fg-faint)] pt-0.5">
          {info.toolObservations!.loopIterations} loop iteration{info.toolObservations!.loopIterations !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}

function ToolCard({ idx, obs }: { idx: number; obs: DebugToolObservation }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg overflow-hidden surface-2">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-[var(--panel-3)] transition-colors text-left">
        <span className="w-5 h-5 rounded-md grid place-items-center text-[11px] font-bold shrink-0 bg-[var(--brand-soft)] text-[var(--brand)]">{idx}</span>
        <span className="font-mono text-[12px] font-semibold shrink-0 text-[var(--fg)]">{obs.tool}</span>
        {obs.purpose && <span className="text-[12px] text-[var(--fg-dim)] truncate flex-1">{obs.purpose}</span>}
        <span className="ml-auto flex items-center gap-2 shrink-0">
          {obs.latencyMs != null && <span className="text-[11px] font-mono text-[var(--fg-faint)] tnum">{obs.latencyMs}ms</span>}
          {obs.ok
            ? <CheckCircle2 className="w-4 h-4 text-[var(--ok)]" />
            : <XCircle className="w-4 h-4 text-[var(--bad)]" />}
          <ChevronRight className={`w-3.5 h-3.5 text-[var(--fg-faint)] transition-transform ${open ? "rotate-90" : ""}`} />
        </span>
      </button>

      {open && (
        <div className="px-2.5 pb-2.5 pt-2 border-t border-[var(--line)] space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {obs.rowCount != null && (
              <Pill tone="ok">{obs.tool === "find_concept" ? `${obs.rowCount} match${obs.rowCount !== 1 ? "es" : ""}` : `${obs.rowCount} row${obs.rowCount !== 1 ? "s" : ""}`}</Pill>
            )}
            {obs.safetyGateCleared === true && <Pill tone="ok">safetyGate cleared</Pill>}
            {obs.safetyGateCleared === false && <Pill tone="warn">blocked by safetyGate</Pill>}
          </div>

          {obs.summary && <p className="text-[12px] text-[var(--fg-dim)] leading-relaxed">{obs.summary}</p>}
          {!obs.ok && obs.error && <p className="text-[12px] text-[var(--bad)] leading-relaxed break-words">{obs.error}</p>}

          <JsonBlock label="arguments" value={obs.toolArgs} />
          {obs.matches && obs.matches.length > 0 && <JsonBlock label="matches" value={obs.matches.slice(0, 10)} />}
          {obs.rows && obs.rows.length > 0 && <JsonBlock label="result rows" value={obs.rows.slice(0, 8)} />}
          {!obs.matches?.length && !obs.rows?.length && obs.result != null && <JsonBlock label="result" value={obs.result} />}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Memory
// ---------------------------------------------------------------------------

function MemorySection({ info }: { info: DebugInfo }) {
  const mem = info.memory;
  const obs = info.toolObservations?.observations ?? [];

  return (
    <div className="space-y-3 pt-1.5">
      <Tier label="Tier 1 · Redis continuation (hot)">
        {!mem ? <Empty text="Waiting for loadContext…" />
          : !mem.continuation ? <Muted>no active continuation (first turn or expired)</Muted>
          : (
            <div className="space-y-1">
              {mem.continuation.lastResultDirIds && mem.continuation.lastResultDirIds.length > 0 && (
                <KV label="lastResultIds">
                  {mem.continuation.lastResultDirIds.slice(0, 4).join(", ")}
                  {mem.continuation.lastResultDirIds.length > 4 ? ` +${mem.continuation.lastResultDirIds.length - 4} more` : ""}
                </KV>
              )}
              {mem.continuation.activeFilters && Object.keys(mem.continuation.activeFilters).length > 0 && (
                <KV label="activeFilters"><code className="font-mono text-[11px]">{JSON.stringify(mem.continuation.activeFilters)}</code></KV>
              )}
            </div>
          )}
      </Tier>

      <Tier label={`Tier 2 · Session turns, Postgres (${mem?.conversationHistory?.length ?? 0})`}>
        {!mem?.conversationHistory?.length ? <Muted>no previous turns in window</Muted> : (
          <div className="space-y-2.5">
            {mem.conversationHistory.map((t, i) => {
              const q = String((t as Record<string, unknown>)["userQuery"] ?? "");
              const a = String((t as Record<string, unknown>)["agentAnswer"] ?? "");
              const path = String((t as Record<string, unknown>)["executionPath"] ?? "");
              return (
                <div key={i} className="space-y-1">
                  <div className="flex gap-2"><RoleDot tone="brand">U</RoleDot><span className="text-[12px] text-[var(--fg)] leading-snug break-words min-w-0">{clip(q, 160)}</span></div>
                  <div className="flex gap-2">
                    <RoleDot tone="accent">A</RoleDot>
                    <span className="text-[12px] text-[var(--fg-dim)] leading-snug break-words min-w-0">
                      {clip(a, 160)}{path ? <span className="ml-1 text-[10px] text-[var(--fg-faint)]">[{path}]</span> : null}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Tier>

      <Tier label="Rolling summary (older turns)">
        {mem?.conversationSummary
          ? <p className="text-[12px] text-[var(--fg-dim)] leading-relaxed italic">{mem.conversationSummary}</p>
          : <Muted>no summary yet — turns fold in once they age out of the verbatim window</Muted>}
        {(mem?.turnCount != null || mem?.sessionTokensUsed != null) && (
          <div className="flex gap-4 mt-2 text-[11px] text-[var(--fg-faint)]">
            {mem?.turnCount != null && <span>turns: {mem.turnCount}</span>}
            {mem?.sessionTokensUsed != null && <span>session tokens: {mem.sessionTokensUsed.toLocaleString()}</span>}
          </div>
        )}
      </Tier>

      <Tier label={`Tier 3 · In-request observations (${obs.length})`}>
        {obs.length === 0 ? <Muted>no tool calls this turn (direct path)</Muted> : (
          <div className="space-y-1">
            {obs.map((o, i) => (
              <div key={i} className="flex gap-2 text-[12px]">
                <span className="text-[var(--fg-faint)] shrink-0">{i + 1}.</span>
                <span className="text-[var(--fg-dim)]">
                  <span className="font-mono text-[var(--brand)]">{o.tool}</span>
                  {o.purpose ? `: ${clip(o.purpose, 60)} → ` : " → "}
                  {o.ok ? <span className="text-[var(--ok)]">{o.rowCount ?? 0} rows</span> : <span className="text-[var(--bad)]">{o.error ?? "error"}</span>}
                </span>
              </div>
            ))}
          </div>
        )}
      </Tier>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Perf
// ---------------------------------------------------------------------------

function PerfSection({ info }: { info: DebugInfo }) {
  const s = info.summary;
  const usage = s?.tokenUsage;
  const lats = s?.nodeLatencies ?? {};
  const repairs = s?.repairAttempts ?? 0;
  const maxMs = Math.max(...Object.values(lats), 1);
  const errors = s?.nonFatalErrors ?? [];
  const qErr = info.executeQuery?.queryError;

  return (
    <div className="space-y-3 pt-1.5">
      <div>
        <FieldLabel>token usage</FieldLabel>
        {usage ? (
          <div className="grid grid-cols-3 gap-2 mt-1.5">
            {[
              { label: "input",  val: usage.input },
              { label: "output", val: usage.output },
              { label: "total",  val: usage.input + usage.output },
            ].map((d) => (
              <div key={d.label} className="rounded-lg px-2 py-2 text-center surface-2">
                <p className="text-[17px] font-bold text-[var(--fg)] tnum">{d.val.toLocaleString()}</p>
                <p className="text-[10px] uppercase tracking-wide text-[var(--fg-faint)]">{d.label}</p>
              </div>
            ))}
          </div>
        ) : <Muted>not yet available</Muted>}
      </div>

      {Object.keys(lats).length > 0 && (
        <div>
          <FieldLabel>per-node latency</FieldLabel>
          <div className="mt-1.5 space-y-1.5">
            {Object.entries(lats).sort(([, a], [, b]) => b - a).map(([node, ms]) => (
              <div key={node} className="flex items-center gap-2">
                <span className="w-28 text-[12px] text-[var(--fg-dim)] truncate shrink-0">{node}</span>
                <div className="flex-1 h-2 rounded-full overflow-hidden bg-[var(--panel-3)]">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(3, (ms / maxMs) * 100)}%`, background: "linear-gradient(90deg, var(--brand), var(--brand-2))" }} />
                </div>
                <span className="w-14 text-right font-mono text-[11px] text-[var(--fg-dim)] tnum shrink-0">{ms}ms</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {repairs > 0 && <Pill tone="warn">{repairs} self-correction retr{repairs > 1 ? "ies" : "y"}</Pill>}
      {qErr && <p className="text-[12px] text-[var(--bad)]">executeQuery: {qErr}</p>}
      {errors.map((e, i) => <Pill key={i} tone="warn">{e}</Pill>)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

function Metric({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-[var(--fg-dim)]">
      <span className="text-[var(--fg-faint)]">{icon}</span>{label}
    </span>
  );
}

function Badge({ label, value }: { label: string; value: string }) {
  return (
    <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-[var(--brand-soft)] text-[var(--brand)] border border-[var(--brand-line)]">
      <span className="opacity-70">{label}:</span> {value}
    </span>
  );
}

function Pill({ tone, children }: { tone: "ok" | "warn" | "bad"; children: React.ReactNode }) {
  const map = {
    ok:   "text-[var(--ok)] bg-[var(--ok-soft)]",
    warn: "text-[var(--warn)] bg-[var(--warn-soft)]",
    bad:  "text-[var(--bad)] bg-[var(--bad-soft)]",
  }[tone];
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${map}`}>{children}</span>;
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  if (value == null) return null;
  const text = JSON.stringify(value, null, 2);
  if (!text || text === "{}" || text === "[]") return null;
  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-wide font-bold text-[var(--fg-faint)]">{label}</p>
      <Code className="max-h-56 overflow-auto">{text}</Code>
    </div>
  );
}

function Code({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <pre
      className={`rounded-lg p-2.5 text-[12px] leading-relaxed font-mono whitespace-pre-wrap break-words border border-[var(--line)] ${className}`}
      style={{ background: "var(--code-bg)", color: "var(--code-fg)" }}
    >
      {children}
    </pre>
  );
}

function Tier({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--fg-faint)] mb-1.5 flex items-center gap-1.5">
        <Sparkles className="w-3 h-3 text-[var(--brand)]" />{label}
      </p>
      {children}
    </div>
  );
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2 text-[12px]">
      <span className="text-[var(--fg-faint)] shrink-0">{label}:</span>
      <span className="text-[var(--fg-dim)] break-words min-w-0">{children}</span>
    </div>
  );
}

function RoleDot({ tone, children }: { tone: "brand" | "accent"; children: React.ReactNode }) {
  const bg = tone === "brand" ? "var(--brand-soft)" : "var(--ok-soft)";
  const fg = tone === "brand" ? "var(--brand)" : "var(--accent)";
  return (
    <span className="w-4 h-4 rounded grid place-items-center text-[9px] font-bold shrink-0 mt-0.5" style={{ background: bg, color: fg }}>
      {children}
    </span>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] uppercase tracking-wide font-bold text-[var(--fg-faint)]">{children}</p>;
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] text-[var(--fg-faint)]">{children}</p>;
}

function Empty({ text }: { text: string }) {
  return <p className="text-[12px] italic text-[var(--fg-faint)] py-1">{text}</p>;
}

// ---------------------------------------------------------------------------
// utils
// ---------------------------------------------------------------------------

function clip(s: string, n: number) { return s.length > n ? `${s.slice(0, n)}…` : s; }
function formatMs(ms: number) { return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`; }
