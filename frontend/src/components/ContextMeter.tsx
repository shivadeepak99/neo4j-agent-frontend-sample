"use client";

/**
 * ContextMeter — a small circular gauge showing how "full" the current
 * conversation is, relative to the backend's SESSION_TOKEN_SOFT_LIMIT.
 *
 * The backend streams a `sessionStatus` debug event each turn carrying the
 * cumulative session token usage and the soft limit. We render that ratio as
 * an SVG progress ring next to the input bar so the user has an ambient sense
 * of context budget — the same idea as the context-window indicators in modern
 * chat UIs. Purely informational; the agent keeps answering past the limit.
 */

import { useMemo } from "react";

interface ContextMeterProps {
  /** Cumulative input+output tokens used this session (incl. current turn). */
  tokensUsed: number;
  /** The soft ceiling from the backend (SESSION_TOKEN_SOFT_LIMIT). */
  softLimit: number;
}

/** Format a token count compactly: 1234 → "1.2k", 200000 → "200k". */
function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(n);
}

export function ContextMeter({ tokensUsed, softLimit }: ContextMeterProps) {
  const { pct, stroke, dash } = useMemo(() => {
    const ratio = softLimit > 0 ? Math.min(tokensUsed / softLimit, 1) : 0;
    // SVG geometry: r=10 ring inside a 24x24 viewBox.
    const circ = 2 * Math.PI * 10;
    // Color ramp: calm indigo → amber (≥75%) → rose (≥90%).
    const color = ratio >= 0.9 ? "var(--bad)" : ratio >= 0.75 ? "var(--warn)" : "var(--brand)";
    return {
      pct: Math.round(ratio * 100),
      stroke: color,
      dash: `${ratio * circ} ${circ}`,
    };
  }, [tokensUsed, softLimit]);

  return (
    <div
      className="flex items-center gap-1.5 select-none"
      title={`Conversation context: ${tokensUsed.toLocaleString()} / ${softLimit.toLocaleString()} tokens (${pct}%)`}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" className="-rotate-90">
        <circle cx="12" cy="12" r="10" fill="none" stroke="var(--line-strong)" strokeWidth="2.5" />
        <circle
          cx="12"
          cy="12"
          r="10"
          fill="none"
          stroke={stroke}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={dash}
          strokeDashoffset={0}
          style={{ transition: "stroke-dasharray 0.5s ease, stroke 0.5s ease" }}
        />
      </svg>
      <span className="text-[11px] font-medium text-[var(--fg-faint)] tnum">
        {formatTokens(tokensUsed)}
      </span>
    </div>
  );
}
