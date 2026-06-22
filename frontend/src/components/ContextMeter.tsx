"use client";

/**
 * ContextMeter — compact gauge of context window fill on the last turn.
 * The backend streams a `data-context` part with promptTokens / windowTokens
 * plus per-category billed token breakdown.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity } from "lucide-react";

export interface ContextStatus {
  windowTokens: number;
  promptTokens: number;
  input: number;
  output: number;
  thinking: number;
  steps: number;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(n);
}

type Level = "ok" | "warn" | "critical";
function levelOf(ratio: number): Level {
  if (ratio >= 0.85) return "critical";
  if (ratio >= 0.6) return "warn";
  return "ok";
}

const LEVEL_COLOR: Record<Level, string> = {
  ok:       "var(--teal)",
  warn:     "var(--warn, #fb923c)",
  critical: "var(--danger)",
};

export function ContextMeter({ ctx }: { ctx: ContextStatus | null }) {
  const [open, setOpen] = useState(false);
  if (!ctx || !ctx.windowTokens) return null;

  const ratio = Math.min(1, ctx.promptTokens / ctx.windowTokens);
  const pct = ratio * 100;
  const level = levelOf(ratio);
  const color = LEVEL_COLOR[level];
  const pctLabel = pct < 1 ? pct.toFixed(1) : pct.toFixed(0);

  const r = 7;
  const c = 2 * Math.PI * r;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] text-[var(--fg-3)] transition-colors hover:text-[var(--fg-2)]"
        title="Context window used on the last turn"
        aria-label={`Context window ${pctLabel}% used`}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" className="-rotate-90 shrink-0">
          <circle cx="9" cy="9" r={r} fill="none" stroke="var(--border-2)" strokeWidth="2" />
          <circle
            cx="9" cy="9" r={r}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - Math.max(ratio, 0.012))}
          />
        </svg>
        <span className="tabular-nums">
          {fmt(ctx.promptTokens)}
          <span className="opacity-40"> / {fmt(ctx.windowTokens)}</span>
        </span>
        <span className="opacity-40">·</span>
        <span className="tabular-nums" style={{ color }}>{pctLabel}%</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.14 }}
            className="surface-raised absolute bottom-full left-1/2 z-20 mb-2 w-60 -translate-x-1/2 rounded-xl p-3 text-xs"
          >
            <div className="mb-2.5 flex items-center gap-1.5 font-medium text-[var(--fg-2)]">
              <Activity className="size-3.5 text-[var(--teal)]" />
              Context window — last turn
            </div>

            <div className="mb-3">
              <div className="h-1 overflow-hidden rounded-full bg-[var(--surface-3)]">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.max(pct, 1)}%`, background: color }}
                />
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-[var(--fg-3)]">
                <span>{fmt(ctx.promptTokens)} prompt</span>
                <span>{pctLabel}% of {fmt(ctx.windowTokens)}</span>
              </div>
            </div>

            <Row label="Prompt (peak)" value={ctx.promptTokens} />
            <Row label="Input (billed)" value={ctx.input} />
            <Row label="Output" value={ctx.output} />
            <Row label="Thinking" value={ctx.thinking} />
            <Row label="Steps" value={ctx.steps} raw />

            <p className="mt-2 border-t border-[var(--border)] pt-2 text-[10px] leading-snug text-[var(--fg-3)]">
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
      <span className="text-[var(--fg-3)]">{label}</span>
      <span className="tabular-nums font-medium text-[var(--fg-2)]">{raw ? value : fmt(value)}</span>
    </div>
  );
}
