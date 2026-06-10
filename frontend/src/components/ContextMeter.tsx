"use client";

/**
 * ContextMeter — a premium circular gauge showing how "full" the current
 * conversation is, relative to the backend's SESSION_TOKEN_SOFT_LIMIT.
 *
 * Clicking the ring opens a breakdown popover (similar to Claude Code's
 * context window inspector) with:
 *   • A linear progress bar for the session total.
 *   • Per-category bars for the last turn: input / output / thinking.
 *
 * The backend streams a `sessionStatus` debug event each turn carrying the
 * cumulative session token usage, the soft limit, exact percentUsed, and the
 * current-turn token breakdown. Purely informational; the agent keeps
 * answering past the soft limit.
 */

import { useMemo, useState, useRef, useEffect, useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Layers, Sparkles } from "lucide-react";

interface CurrentTurnTokens {
  input:    number;
  output:   number;
  thinking: number;
  total:    number;
}

interface PhaseTokens extends CurrentTurnTokens {}

interface ToolStats {
  toolCalls:     number;
  rowsReturned:  number;
  tools:         string[];
}

interface ContextMeterProps {
  /** Cumulative input+output+thinking tokens used this session (incl. current turn). */
  tokensUsed:         number;
  /** The soft ceiling from the backend (SESSION_TOKEN_SOFT_LIMIT). */
  softLimit:          number;
  /** Exact 0–100 figure from the backend; falls back to tokensUsed/softLimit. */
  percentUsed?:       number;
  /** Per-category breakdown for the most recent turn. */
  currentTurnTokens?: CurrentTurnTokens;
  /** LLM token split by pipeline phase (guardAndPlan, toolLoop, narrate, …). */
  byPhase?:           Record<string, PhaseTokens>;
  /** Multistep tool-loop stats (calls + rows fed back to the model). */
  toolStats?:         ToolStats;
  /** When true, sits inline beside the search bar — compact on small screens. */
  inline?:            boolean;
}

type Level = "calm" | "warn" | "critical";

/** Format a token count compactly: 1234 → "1.2k", 200000 → "200k". */
function fmt(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(n);
}

/** Format with locale thousands separator for the popover. */
function fmtFull(n: number): string {
  return n.toLocaleString();
}

function levelFromRatio(ratio: number): Level {
  if (ratio >= 0.9) return "critical";
  if (ratio >= 0.75) return "warn";
  return "calm";
}

const LEVEL_COLORS: Record<Level, string> = {
  calm:     "var(--brand)",
  warn:     "var(--warn)",
  critical: "var(--bad)",
};

/** Human label for a LangGraph phase key. */
function phaseLabel(key: string): string {
  const map: Record<string, string> = {
    guardAndPlan: 'Plan',
    toolLoop:     'Tool loop',
    narrate:      'Narrate',
    repairQuery:  'Repair',
    summarize:    'Summarize',
  };
  return map[key] ?? key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
}

export function ContextMeter({
  tokensUsed,
  softLimit,
  percentUsed,
  currentTurnTokens,
  byPhase,
  toolStats,
  inline = false,
}: ContextMeterProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const uid = useId().replace(/:/g, "");

  // Close the popover when the user clicks outside it.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const { pct, level, dash } = useMemo(() => {
    const r =
      percentUsed != null
        ? Math.min(percentUsed / 100, 1)
        : softLimit > 0
          ? Math.min(tokensUsed / softLimit, 1)
          : 0;
    const circumference = 2 * Math.PI * 13;
    return {
      pct:   Math.round(r * 100),
      level: levelFromRatio(r),
      dash:  `${r * circumference} ${circumference}`,
    };
  }, [tokensUsed, softLimit, percentUsed]);

  const hasTurn =
    currentTurnTokens != null && currentTurnTokens.total > 0;

  const turnTotal = hasTurn ? Math.max(currentTurnTokens!.total, 1) : 1;

  const categories = hasTurn
    ? [
        {
          label: "Input",
          value: currentTurnTokens!.input,
          color: "var(--brand)",
          glow:  "rgba(79,70,229,0.35)",
          desc:  "Tokens sent to the model (query + history + schema + tool results)",
        },
        {
          label: "Output",
          value: currentTurnTokens!.output,
          color: "var(--accent)",
          glow:  "rgba(14,165,233,0.35)",
          desc:  "Tokens the model generated (answers + tool-call JSON)",
        },
        {
          label: "Thinking",
          value: currentTurnTokens!.thinking,
          color: "#a78bfa",
          glow:  "rgba(167,139,250,0.35)",
          desc:  "Internal reasoning tokens (Gemini 2.5 thinking budget)",
        },
      ]
    : [];

  const phaseEntries = Object.entries(byPhase ?? {})
    .filter(([, v]) => v.total > 0)
    .sort(([, a], [, b]) => b.total - a.total);

  const maxPhaseTotal = phaseEntries.length
    ? Math.max(...phaseEntries.map(([, v]) => v.total), 1)
    : 1;

  const hasToolStats = toolStats != null && toolStats.toolCalls > 0;

  const strokeColor = LEVEL_COLORS[level];
  const gradId = `ctx-grad-${uid}`;
  const glowId = `ctx-glow-${uid}`;

  return (
    <div ref={ref} className={`relative flex items-center select-none shrink-0 ${inline ? "self-center" : ""}`}>
      {/* Ring button */}
      <button
        onClick={() => setOpen((o) => !o)}
        data-open={open}
        data-level={level}
        title={`Context: ${tokensUsed.toLocaleString()} / ${softLimit.toLocaleString()} tokens (${pct}%) — click for breakdown`}
        className={`context-meter-btn flex items-center rounded-full outline-none ${
          inline
            ? "gap-2 pl-1 pr-2.5 sm:pr-3 py-1 h-[46px]"
            : "gap-2.5 pl-1 pr-3 py-1"
        }`}
      >
        {/* Circular gauge */}
        <div className="relative w-9 h-9 shrink-0 grid place-items-center">
          <span
            className="context-ring-glow"
            data-level={level}
            aria-hidden
          />

          <svg
            width="36"
            height="36"
            viewBox="0 0 36 36"
            className="relative z-[1] -rotate-90"
            aria-hidden
          >
            <defs>
              <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={strokeColor} />
                <stop offset="55%" stopColor={level === "calm" ? "var(--brand-2)" : strokeColor} />
                <stop offset="100%" stopColor={level === "calm" ? "var(--accent)" : strokeColor} />
              </linearGradient>
              <filter id={glowId} x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="1.8" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Track */}
            <circle
              cx="18" cy="18" r="13"
              fill="none"
              stroke="var(--line)"
              strokeWidth="3"
              opacity="0.55"
            />
            <circle
              cx="18" cy="18" r="13"
              fill="none"
              stroke="var(--line-strong)"
              strokeWidth="1.5"
              strokeDasharray="2 4"
              opacity="0.35"
            />

            {/* Progress arc */}
            <circle
              cx="18" cy="18" r="13"
              fill="none"
              stroke={`url(#${gradId})`}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={dash}
              strokeDashoffset={0}
              filter={`url(#${glowId})`}
              style={{
                transition: "stroke-dasharray 0.7s cubic-bezier(0.22,1,0.36,1), stroke 0.4s ease",
              }}
            />
          </svg>

          {/* Center percentage */}
          <span className="absolute inset-0 z-[2] grid place-items-center text-[9px] font-bold tnum text-[var(--fg)] leading-none">
            {pct}
          </span>
        </div>

        <div className={`flex flex-col items-start min-w-0 ${inline ? "hidden sm:flex" : ""}`}>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-faint)] leading-none">
            Context
          </span>
          <span className="text-[12px] font-semibold text-[var(--fg-dim)] tnum leading-tight mt-0.5 whitespace-nowrap">
            {fmt(tokensUsed)}
            <span className="text-[var(--fg-faint)] font-medium"> / {fmt(softLimit)}</span>
          </span>
        </div>
      </button>

      {/* ── Breakdown popover ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="context-popover absolute bottom-full right-0 mb-3 w-[min(100vw-2rem,340px)] rounded-2xl border p-4 z-[80] text-[12px] max-h-[min(70vh,520px)] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-start gap-3 mb-4">
              <div
                className="w-9 h-9 rounded-xl grid place-items-center shrink-0 border"
                style={{
                  background: `linear-gradient(135deg, ${strokeColor}28, var(--popover-muted))`,
                  borderColor: `${strokeColor}55`,
                }}
              >
                <Layers className="w-4 h-4" style={{ color: strokeColor }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--fg-faint)]">
                  Context window
                </p>
                <p className="text-[15px] font-display font-bold text-[var(--fg)] mt-0.5">
                  {pct}%
                  <span className="text-[12px] font-medium text-[var(--fg-faint)] ml-1.5">used</span>
                </p>
              </div>
              <span
                className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
                style={{
                  color: strokeColor,
                  background: `${strokeColor}18`,
                  border: `1px solid ${strokeColor}33`,
                }}
              >
                {level}
              </span>
            </div>

            {/* Session progress bar */}
            <div className="mb-4">
              <div className="h-2 rounded-full context-progress-track overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                  className="h-full rounded-full context-progress-fill"
                  data-level={level}
                />
              </div>
              <div className="flex justify-between mt-2 text-[11px]">
                <span className="text-[var(--fg-faint)]">
                  <span className="font-semibold text-[var(--fg-dim)] tnum">{fmtFull(tokensUsed)}</span> used
                </span>
                <span className="text-[var(--fg-faint)]">
                  limit <span className="font-semibold text-[var(--fg-dim)] tnum">{fmtFull(softLimit)}</span>
                </span>
              </div>
            </div>

            {/* Per-category turn breakdown */}
            {hasTurn && (
              <>
                <div className="h-px bg-[var(--popover-border)] mb-4" />

                <div className="flex items-center gap-1.5 mb-3">
                  <Sparkles className="w-3.5 h-3.5 text-[var(--brand)]" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--fg-faint)]">
                    Last turn breakdown
                  </span>
                </div>

                <div className="space-y-3">
                  {categories.map(({ label, value, color, glow, desc }, i) => (
                    <motion.div
                      key={label}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 + i * 0.06, duration: 0.25 }}
                      title={desc}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{
                              background: color,
                              boxShadow: `0 0 8px ${glow}, 0 0 0 2px var(--popover-solid), 0 0 0 3px ${color}55`,
                            }}
                          />
                          <span className="text-[var(--fg-dim)] font-medium">{label}</span>
                        </div>
                        <span className="font-semibold text-[var(--fg)] tnum">
                          {fmtFull(value)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[var(--popover-muted)] overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, Math.round((value / turnTotal) * 100))}%` }}
                          transition={{ delay: 0.1 + i * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                          className="h-full rounded-full context-category-bar"
                          style={{
                            background: `linear-gradient(90deg, ${color}, ${color}cc)`,
                            boxShadow: `0 0 12px ${glow}`,
                            minWidth: value > 0 ? "4px" : undefined,
                          }}
                        />
                      </div>
                    </motion.div>
                  ))}

                  <div className="flex items-center justify-between pt-2.5 mt-1 border-t border-[var(--popover-border)]">
                    <span className="text-[var(--fg-faint)] font-medium">Total this turn</span>
                    <span className="font-bold text-[var(--fg)] tnum text-[13px]">
                      {fmtFull(currentTurnTokens!.total)}
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* Per-phase LLM breakdown */}
            {phaseEntries.length > 0 && (
              <>
                <div className="h-px bg-[var(--popover-border)] my-4" />
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--fg-faint)] mb-3">
                  By pipeline phase
                </p>
                <div className="space-y-2.5">
                  {phaseEntries.map(([phase, counts], i) => (
                    <div key={phase}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[var(--fg-dim)] font-medium">{phaseLabel(phase)}</span>
                        <span className="font-semibold text-[var(--fg)] tnum text-[11px]">
                          {fmtFull(counts.total)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[var(--popover-muted)] overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, Math.round((counts.total / maxPhaseTotal) * 100))}%` }}
                          transition={{ delay: 0.15 + i * 0.05, duration: 0.45 }}
                          className="h-full rounded-full"
                          style={{
                            background: "linear-gradient(90deg, var(--brand-2), var(--accent))",
                            minWidth: "4px",
                          }}
                        />
                      </div>
                      <p className="text-[10px] text-[var(--fg-faint)] mt-1 tnum">
                        in {fmtFull(counts.input)} · out {fmtFull(counts.output)}
                        {counts.thinking > 0 ? ` · think ${fmtFull(counts.thinking)}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Tool-loop context fed back to the model */}
            {hasToolStats && (
              <>
                <div className="h-px bg-[var(--popover-border)] my-4" />
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--fg-faint)] mb-2">
                  Tool results (context)
                </p>
                <div className="rounded-xl border border-[var(--popover-border)] bg-[var(--popover-muted)] px-3 py-2.5 space-y-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[var(--fg-faint)]">Tool calls</span>
                    <span className="font-semibold text-[var(--fg)] tnum">{toolStats!.toolCalls}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[var(--fg-faint)]">Rows returned to model</span>
                    <span className="font-semibold text-[var(--fg)] tnum">{fmtFull(toolStats!.rowsReturned)}</span>
                  </div>
                  {toolStats!.tools.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {toolStats!.tools.map((t) => (
                        <span
                          key={t}
                          className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-[var(--brand-soft)] text-[var(--brand)] border border-[var(--brand-line)]"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {!hasTurn && (
              <p className="text-[11px] text-[var(--fg-faint)] leading-relaxed">
                Per-turn breakdown will appear after your first query completes.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
