"use client";

/**
 * ContextMeter — a compact gauge of how full the model's context window was on
 * the most recent turn, Claude-Code style.
 *
 * The backend streams a `data-context` part once per turn carrying:
 *   • windowTokens — the model's usable window (Gemini 3 Pro ≈ 1,048,576).
 *   • promptTokens — the PEAK single-step input this turn (static system prompt +
 *                    conversation history + accumulated tool results); the honest
 *                    "fill" numerator (not the summed-across-steps input).
 *   • input / output / thinking — billed token split for the whole turn.
 *   • steps — how many model steps (tool calls + answer) the loop took.
 *
 * Purely informational: the agent keeps answering regardless of fill. The ring
 * reflects promptTokens ÷ windowTokens; click it for the per-turn breakdown.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gauge } from "lucide-react";

export interface ContextStatus {
  windowTokens: number;
  promptTokens: number;
  input: number;
  output: number;
  thinking: number;
  steps: number;
}

/** 1234 → "1.2k", 1_048_576 → "1M". */
function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(n);
}

type Level = "calm" | "warn" | "critical";
function levelOf(ratio: number): Level {
  if (ratio >= 0.85) return "critical";
  if (ratio >= 0.6) return "warn";
  return "calm";
}
const RING: Record<Level, string> = {
  calm: "var(--brass)",
  warn: "var(--warn, #d6a338)",
  critical: "var(--danger, #d05a4f)",
};

export function ContextMeter({ ctx }: { ctx: ContextStatus | null }) {
  const [open, setOpen] = useState(false);
  if (!ctx || !ctx.windowTokens) return null;

  const ratio = Math.min(1, ctx.promptTokens / ctx.windowTokens);
  const pct = ratio * 100;
  const level = levelOf(ratio);
  const color = RING[level];

  // SVG ring geometry
  const r = 7;
  const c = 2 * Math.PI * r;
  const pctLabel = pct < 1 ? pct.toFixed(1) : pct.toFixed(0);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="btn-ghost inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] text-[var(--fg-faint)] transition-colors hover:text-[var(--fg-dim)]"
        title="Context window used on the last turn"
        aria-label={`Context window ${pctLabel}% used`}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" className="-rotate-90 shrink-0">
          <circle cx="9" cy="9" r={r} fill="none" stroke="var(--line-2, #ffffff1a)" strokeWidth="2" />
          <circle
            cx="9"
            cy="9"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - Math.max(ratio, 0.012))}
          />
        </svg>
        <span className="tabular-nums">
          {fmt(ctx.promptTokens)}<span className="opacity-50"> / {fmt(ctx.windowTokens)}</span>
        </span>
        <span className="opacity-50">·</span>
        <span className="tabular-nums" style={{ color }}>{pctLabel}%</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="surface absolute bottom-full left-1/2 z-20 mb-2 w-60 -translate-x-1/2 rounded-xl p-3 text-xs shadow-xl"
          >
            <div className="mb-2 flex items-center gap-1.5 font-medium text-[var(--fg-dim)]">
              <Gauge className="size-3.5 text-[var(--brass)]" /> Context window — last turn
            </div>

            <div className="mb-2.5">
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--line-2,#ffffff14)]">
                <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 1)}%`, background: color }} />
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-[var(--fg-faint)]">
                <span>{fmt(ctx.promptTokens)} prompt</span>
                <span>{pctLabel}% of {fmt(ctx.windowTokens)}</span>
              </div>
            </div>

            <Row label="Prompt (peak)" value={ctx.promptTokens} />
            <Row label="Input (billed)" value={ctx.input} />
            <Row label="Output" value={ctx.output} />
            <Row label="Thinking" value={ctx.thinking} />
            <Row label="Steps" value={ctx.steps} raw />
            <p className="mt-2 border-t border-[var(--line)] pt-2 text-[10px] leading-snug text-[var(--fg-faint)]">
              Fill = peak prompt ÷ model window. Informational — answers continue regardless.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Row({ label, value, raw }: { label: string; value: number; raw?: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[var(--fg-faint)]">{label}</span>
      <span className="tabular-nums font-medium text-[var(--fg-dim)]">{raw ? value : fmt(value)}</span>
    </div>
  );
}
