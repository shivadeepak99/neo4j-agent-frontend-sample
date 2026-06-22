"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Database, Users, ChevronDown, AlertCircle, ExternalLink, Send, Loader2, Waves,
} from "lucide-react";
import { API_URL } from "@/lib/api-client";
import type { Reference } from "@/lib/types";
import { ContextMeter, type ContextStatus } from "@/components/ContextMeter";

interface CypherOutput {
  rowCount?: number;
  references?: Reference[];
  rows?: Record<string, unknown>[];
  truncated?: boolean;
  error?: string;
}

interface ChatProps {
  sessionId: string;
  initialMessages: UIMessage[];
  accessToken: string;
  onFirstReply?: () => void;
}

export function Chat({ sessionId, initialMessages, accessToken, onFirstReply }: ChatProps) {
  const [input, setInput] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const firstExchange = useRef(initialMessages.length === 0);

  const { messages, sendMessage, status, error } = useChat({
    id: sessionId,
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: `${API_URL}/api/query`,
      headers: { Authorization: `Bearer ${accessToken}` },
      prepareSendMessagesRequest({ messages: msgs }) {
        // NOTE: do NOT set Content-Type here — the SDK adds it; duplicate yields Fastify 415.
        return {
          body: { message: msgs[msgs.length - 1], sessionId },
          headers: { Authorization: `Bearer ${accessToken}` },
        };
      },
    }),
    onFinish() {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
      if (firstExchange.current) {
        firstExchange.current = false;
        onFirstReply?.();
      }
    },
  });

  const busy = status === "submitted" || status === "streaming";

  const latestCtx = useMemo<ContextStatus | null>(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role !== "assistant") continue;
      const part = (m.parts as Array<{ type: string; data?: unknown }>).find((p) => p.type === "data-context");
      if (part?.data) return part.data as ContextStatus;
    }
    return null;
  }, [messages]);

  const submit = (text?: string) => {
    const v = (text ?? input).trim();
    if (!v || busy) return;
    sendMessage({ text: v });
    setInput("");
    if (taRef.current) taRef.current.style.height = "auto";
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, busy]);

  const grow = () => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  };

  return (
    <div className="flex h-full flex-col">
      {/* Message stream */}
      <div className="scroll min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-6 px-5 py-8 sm:px-6">
          {messages.length === 0 && <EmptyState onSuggest={submit} />}

          {messages.map((m) => (
            <Message key={m.id} message={m} />
          ))}

          {busy && <Thinking />}

          {error && (
            <div className="surface flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm text-[var(--danger)]">
              <AlertCircle className="size-4 shrink-0" />
              {error.message}
            </div>
          )}
          <div ref={bottomRef} className="h-2" />
        </div>
      </div>

      {/* Composer */}
      <div className="composer-dock px-5 pb-5 pt-3 sm:px-6">
        <form
          onSubmit={(e) => { e.preventDefault(); submit(); }}
          className="composer mx-auto flex max-w-2xl items-end gap-2 rounded-2xl px-4 py-3"
        >
          <textarea
            ref={taRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onInput={grow}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
            }}
            placeholder="Search the crew graph in plain English…"
            rows={1}
            disabled={busy}
            className="max-h-44 flex-1 resize-none bg-transparent py-0.5 text-sm text-[var(--fg)] placeholder:text-[var(--fg-3)] focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="btn-primary mb-0.5 grid size-8 shrink-0 place-items-center rounded-xl"
            aria-label="Send"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-3.5" />}
          </button>
        </form>
        <div className="mx-auto mt-2 flex max-w-2xl items-center gap-3">
          <p className="text-[11px] text-[var(--fg-3)]">
            <kbd className="rounded border border-[var(--border-2)] px-1">Enter</kbd> send ·{" "}
            <kbd className="rounded border border-[var(--border-2)] px-1">⇧ Enter</kbd> newline
          </p>
          {latestCtx && (
            <>
              <span className="text-[var(--border-2)]">|</span>
              <ContextMeter ctx={latestCtx} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Empty state with suggestion chips ─────────────────────────────────────── */
const SUGGESTIONS = [
  "Filipino chief engineers with tanker experience",
  "Officers available in the next 30 days",
  "Candidates with GMDSS certification",
  "Compare top 5 masters by sea service",
];

function EmptyState({ onSuggest }: { onSuggest: (text: string) => void }) {
  return (
    <div className="fade-up flex min-h-[55vh] flex-col items-center justify-center text-center">
      <div className="relative mb-5">
        <div className="grid size-14 place-items-center rounded-2xl border border-[var(--teal-line)] bg-[var(--teal-soft)]">
          <Waves className="size-7 text-[var(--teal)]" />
        </div>
        <span className="pulse-dot absolute -right-0.5 -top-0.5" />
      </div>
      <p className="tag mb-2">natural language → crew graph</p>
      <h1
        className="mt-1 text-[1.85rem] font-semibold tracking-tight text-[var(--fg)]"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Find your crew
      </h1>
      <p className="mt-2.5 max-w-sm text-[13.5px] leading-relaxed text-[var(--fg-3)]">
        Ask anything about your organisation&apos;s seafarers in plain English. Every result is
        grounded in the graph.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onSuggest(s)}
            className="rounded-full border border-[var(--border-2)] bg-[var(--surface-2)] px-3.5 py-1.5 text-[12.5px] text-[var(--fg-2)] transition-all hover:border-[var(--teal-line)] hover:bg-[var(--teal-soft)] hover:text-[var(--teal)]"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Thinking indicator ────────────────────────────────────────────────────── */
function Thinking() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-[var(--teal-line)] bg-[var(--teal-soft)]">
        <div className="flex gap-[3px]">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="size-1 rounded-full bg-[var(--teal)]"
              animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 0.65, repeat: Infinity, delay: i * 0.12 }}
            />
          ))}
        </div>
      </div>
      <span className="text-xs text-[var(--fg-3)]">Querying the graph…</span>
    </div>
  );
}

/* ── One message ───────────────────────────────────────────────────────────── */
function Message({ message }: { message: UIMessage }) {
  const parts = message.parts as Array<{ type: string; [k: string]: unknown }>;

  if (message.role === "user") {
    const text = parts.filter((p) => p.type === "text").map((p) => p.text as string).join(" ");
    return (
      <div className="fade-up flex justify-end">
        <div className="max-w-[72%] rounded-2xl rounded-br-md border border-[var(--teal-line)] bg-[var(--surface-2)] px-4 py-2.5 text-sm text-[var(--fg)]">
          {text}
        </div>
      </div>
    );
  }

  return (
    <div className="fade-up flex gap-3">
      <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-[var(--teal-line)] bg-[var(--teal-soft)]">
        <Sparkles className="size-3.5 text-[var(--teal)]" />
      </div>
      <div className="min-w-0 flex-1 space-y-3 pt-0.5">
        {parts.map((part, i) => {
          switch (part.type) {
            case "reasoning":
              return <Reasoning key={i} text={String(part.text ?? "")} />;
            case "text":
              return part.text ? (
                <div key={i} className="prose-chat max-w-none">
                  <ReactMarkdown>{String(part.text)}</ReactMarkdown>
                </div>
              ) : null;
            case "tool-runCypher":
              return (
                <ToolCall
                  key={(part.toolCallId as string) ?? i}
                  part={part as unknown as { state?: string; output?: CypherOutput; errorText?: string }}
                />
              );
            default:
              return null;
          }
        })}
      </div>
    </div>
  );
}

/* ── Collapsible reasoning — violet accent ─────────────────────────────────── */
function Reasoning({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  if (!text.trim()) return null;
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--violet-line)] bg-[var(--violet-soft)] text-xs">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--surface-2)]"
      >
        <span className="size-1.5 shrink-0 rounded-full bg-[var(--violet)]" />
        <span className="flex-1 font-medium tracking-wide text-[var(--fg-2)]">Reasoning</span>
        <ChevronDown
          className={`size-3.5 shrink-0 text-[var(--fg-3)] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="border-t border-[var(--violet-line)] px-3 py-2.5">
          <p className="font-mono whitespace-pre-wrap leading-relaxed text-[var(--fg-3)]">{text}</p>
        </div>
      )}
    </div>
  );
}

/* ── runCypher tool call ────────────────────────────────────────────────────── */
function ToolCall({ part }: { part: { state?: string; output?: CypherOutput; errorText?: string } }) {
  const state = part.state;

  if (state === "input-streaming" || state === "input-available") {
    return (
      <div className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-2)] bg-[var(--surface-2)] px-3 py-1.5 text-xs text-[var(--fg-3)]">
        <Database className="size-3.5 animate-pulse text-[var(--teal)]" />
        Running graph query…
      </div>
    );
  }

  if (state === "output-error") {
    return <ErrorCard title="Query failed" detail={part.errorText} />;
  }

  const out = part.output;
  if (!out) return null;
  if (out.error) return <ErrorCard title="Query error" detail={out.error} mono />;

  const refs = out.references ?? [];
  if (refs.length === 0) {
    return (
      <div className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-2)] bg-[var(--surface-2)] px-3 py-1.5 text-xs text-[var(--fg-3)]">
        <Users className="size-3.5" /> No results found
      </div>
    );
  }
  return <References refs={refs} truncated={out.truncated} rowCount={out.rowCount} />;
}

function ErrorCard({ title, detail, mono }: { title: string; detail?: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-[var(--danger)] border-opacity-25 bg-[var(--danger-soft)] p-3 text-sm">
      <div className="flex items-center gap-2 text-[var(--danger)]">
        <AlertCircle className="size-3.5 shrink-0" /> {title}
      </div>
      {detail && (
        <p className={`mt-1 text-xs text-[var(--fg-3)] ${mono ? "font-mono" : ""}`}>{detail}</p>
      )}
    </div>
  );
}

/* ── References table ──────────────────────────────────────────────────────── */
function References({
  refs, truncated, rowCount,
}: { refs: Reference[]; truncated?: boolean; rowCount?: number }) {
  const [open, setOpen] = useState(false);
  const showPassport = refs.some(
    (r) => r.passportId && !r.passportId.startsWith("GEN-") && r.passportId !== r.directoryId,
  );

  return (
    <div className="overflow-hidden rounded-xl surface text-xs">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-[var(--surface-2)]"
      >
        <Database className="size-3.5 shrink-0 text-[var(--teal)]" />
        <span className="flex-1 font-medium text-[var(--fg-2)]">
          {refs.length} candidate{refs.length === 1 ? "" : "s"}
          {typeof rowCount === "number" && rowCount > refs.length ? ` of ${rowCount}` : ""}
        </span>
        {truncated && (
          <span className="rounded-full border border-[var(--teal-line)] bg-[var(--teal-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--teal)]">
            top 50
          </span>
        )}
        <ChevronDown
          className={`size-3.5 shrink-0 text-[var(--fg-3)] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden border-t border-[var(--border)]"
          >
            <table className="w-full">
              <thead>
                <tr className="bg-[var(--surface-2)] text-left text-[var(--fg-3)]">
                  <th className="px-3.5 py-2 font-medium">Name</th>
                  <th className="px-3.5 py-2 font-medium">Rank</th>
                  {showPassport && <th className="px-3.5 py-2 font-medium">Passport</th>}
                  <th className="w-9 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {refs.map((r) => {
                  const name = r.fullname?.trim() || r.directoryId;
                  const showThis =
                    r.passportId &&
                    !r.passportId.startsWith("GEN-") &&
                    r.passportId !== r.directoryId;
                  const href = `/candidate/${encodeURIComponent(r.directoryId)}?orgId=${encodeURIComponent(r.orgId)}`;
                  return (
                    <tr
                      key={`${r.orgId}:${r.directoryId}`}
                      className="border-t border-[var(--border)] transition-colors hover:bg-[var(--surface-2)]"
                    >
                      <td className="px-3.5 py-2.5 font-medium text-[var(--fg)]">{name}</td>
                      <td className="px-3.5 py-2.5 text-[var(--fg-2)]">{r.rank ?? "—"}</td>
                      {showPassport && (
                        <td className="font-mono px-3.5 py-2.5 text-[var(--fg-3)]">
                          {showThis ? r.passportId : "—"}
                        </td>
                      )}
                      <td className="px-2 py-2.5">
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-ghost inline-flex rounded p-1 hover:text-[var(--teal)]"
                          aria-label="Open candidate"
                        >
                          <ExternalLink className="size-3.5" />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
