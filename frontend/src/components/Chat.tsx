"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Search, Users, ChevronDown, AlertCircle, ExternalLink, Send, Loader2, Compass,
} from "lucide-react";
import { API_URL } from "@/lib/api-client";
import type { Reference } from "@/lib/types";

const SUGGESTIONS = [
  "Masters with tanker experience",
  "Crew who sailed with Anglo Eastern",
  "Engineers with LNG experience and a valid COC",
  "Top 5 by total sea service",
];

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
        return {
          body: { message: msgs[msgs.length - 1], sessionId },
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
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
      {/* Stream */}
      <div className="scroll min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-7 px-5 py-8 sm:px-8">
          {messages.length === 0 && <EmptyState onPick={submit} disabled={busy} />}

          {messages.map((m) => (
            <Message key={m.id} message={m} />
          ))}

          {busy && <Thinking />}

          {error && (
            <div className="surface flex items-center gap-2 rounded-xl border-[var(--danger)] px-4 py-3 text-sm text-[var(--danger)]">
              <AlertCircle className="size-4 shrink-0" />
              {error.message}
            </div>
          )}
          <div ref={bottomRef} className="h-2" />
        </div>
      </div>

      {/* Composer */}
      <div className="px-5 pb-5 pt-3 sm:px-8">
        <form
          onSubmit={(e) => { e.preventDefault(); submit(); }}
          className="focus-within-ring mx-auto flex max-w-3xl items-end gap-2 rounded-2xl surface px-3.5 py-2.5"
        >
          <textarea
            ref={taRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onInput={grow}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
            placeholder="Ask the seafarer graph…"
            rows={1}
            disabled={busy}
            className="max-h-44 flex-1 resize-none bg-transparent py-1.5 text-sm text-[var(--fg)] placeholder:text-[var(--fg-faint)] focus:outline-none disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="btn-brass mb-0.5 grid size-8 shrink-0 place-items-center rounded-xl"
            aria-label="Send"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </button>
        </form>
        <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-[var(--fg-faint)]">
          <kbd className="rounded border px-1">Enter</kbd> send · <kbd className="rounded border px-1">⇧ Enter</kbd> newline
        </p>
      </div>
    </div>
  );
}

/* ── Empty state ───────────────────────────────────────────────────────────── */
function EmptyState({ onPick, disabled }: { onPick: (s: string) => void; disabled: boolean }) {
  return (
    <div className="fade-up pt-6">
      <span className="tick">// natural language → neo4j</span>
      <h1 className="font-display mt-3 text-3xl font-semibold tracking-tight text-[var(--fg)]">
        Ask the seafarer graph
      </h1>
      <p className="mt-2 max-w-md text-sm text-[var(--fg-dim)]">
        Plain-English search over your organisation&apos;s crew. Every answer is grounded in the
        rows the agent actually retrieved.
      </p>
      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            disabled={disabled}
            className="group surface-2 flex items-center gap-2.5 rounded-xl px-3.5 py-3 text-left text-[13px] text-[var(--fg-dim)] transition-colors hover:border-[var(--brass-line)] hover:text-[var(--fg)]"
          >
            <Compass className="size-4 shrink-0 text-[var(--brass)] opacity-70 transition-opacity group-hover:opacity-100" />
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
    <div className="flex items-center gap-2.5 text-[var(--fg-faint)]">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="size-1.5 rounded-full bg-[var(--brass)]"
            animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.13 }}
          />
        ))}
      </div>
      <span className="text-xs">Charting a course…</span>
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
        <div className="max-w-xl rounded-2xl rounded-br-sm bg-[var(--panel-3)] px-4 py-2.5 text-sm text-[var(--fg)]">
          {text}
        </div>
      </div>
    );
  }

  return (
    <div className="fade-up space-y-3">
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
            return null; // find_concept / search_payload tool parts are not surfaced (POC parity)
        }
      })}
    </div>
  );
}

/* ── Collapsible reasoning ─────────────────────────────────────────────────── */
function Reasoning({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  if (!text.trim()) return null;
  return (
    <div className="rounded-lg border border-dashed border-[var(--line-2)] bg-[var(--panel)]/40 text-xs">
      <button
        onClick={() => setOpen((o) => !o)}
        className="btn-ghost flex w-full items-center gap-2 rounded-lg px-3 py-2"
      >
        <Brain className="size-3.5 shrink-0 text-[var(--cyan)]" />
        <span className="flex-1 text-left tracking-wide">Reasoning</span>
        <ChevronDown className={`size-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-dashed border-[var(--line)] px-3 py-2.5">
          <p className="font-mono whitespace-pre-wrap leading-relaxed text-[var(--fg-faint)]">{text}</p>
        </div>
      )}
    </div>
  );
}

/* ── runCypher tool call (POC contract) ────────────────────────────────────── */
function ToolCall({ part }: { part: { state?: string; output?: CypherOutput; errorText?: string } }) {
  const state = part.state;

  if (state === "input-streaming" || state === "input-available") {
    return (
      <div className="inline-flex items-center gap-2 rounded-full surface-2 px-3.5 py-1.5 text-xs text-[var(--fg-dim)]">
        <Search className="size-3.5 animate-pulse text-[var(--brass)]" />
        Searching the graph…
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
      <div className="flex items-center gap-2 text-xs text-[var(--fg-faint)]">
        <Users className="size-3.5" /> 0 results
      </div>
    );
  }
  return <References refs={refs} truncated={out.truncated} rowCount={out.rowCount} />;
}

function ErrorCard({ title, detail, mono }: { title: string; detail?: string; mono?: boolean }) {
  return (
    <div className="surface rounded-xl border-[var(--danger)] bg-[var(--danger-soft)] p-3 text-sm">
      <div className="flex items-center gap-2 text-[var(--danger)]">
        <AlertCircle className="size-4" /> {title}
      </div>
      {detail && <p className={`mt-1 text-xs text-[var(--fg-dim)] ${mono ? "font-mono" : ""}`}>{detail}</p>}
    </div>
  );
}

/* ── References table (name / rank / passport + candidate link) ─────────────── */
function References({ refs, truncated, rowCount }: { refs: Reference[]; truncated?: boolean; rowCount?: number }) {
  const [open, setOpen] = useState(false);
  const showPassport = refs.some(
    (r) => r.passportId && !r.passportId.startsWith("GEN-") && r.passportId !== r.directoryId,
  );
  return (
    <div className="overflow-hidden rounded-xl surface text-xs">
      <button onClick={() => setOpen((o) => !o)} className="btn-ghost flex w-full items-center gap-2 px-3.5 py-2.5">
        <Users className="size-3.5 shrink-0 text-[var(--brass)]" />
        <span className="flex-1 text-left font-medium text-[var(--fg-dim)]">
          {refs.length} candidate{refs.length === 1 ? "" : "s"}
          {typeof rowCount === "number" && rowCount > refs.length ? ` of ${rowCount}` : ""}
        </span>
        {truncated && (
          <span className="rounded-full bg-[var(--brass-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--brass-2)]">
            showing 50
          </span>
        )}
        <ChevronDown className={`size-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-[var(--line)]"
          >
            <table className="w-full">
              <thead>
                <tr className="text-left text-[var(--fg-faint)]">
                  <th className="px-3.5 py-2 font-medium">Name</th>
                  <th className="px-3.5 py-2 font-medium">Rank</th>
                  {showPassport && <th className="px-3.5 py-2 font-medium">Passport</th>}
                  <th className="w-9 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {refs.map((r) => {
                  const name = r.fullname?.trim() || r.directoryId;
                  const showThis = r.passportId && !r.passportId.startsWith("GEN-") && r.passportId !== r.directoryId;
                  const href = `/candidate/${encodeURIComponent(r.directoryId)}?orgId=${encodeURIComponent(r.orgId)}`;
                  return (
                    <tr key={`${r.orgId}:${r.directoryId}`} className="border-t border-[var(--line)]">
                      <td className="px-3.5 py-2 font-medium text-[var(--fg)]">{name}</td>
                      <td className="px-3.5 py-2 text-[var(--fg-dim)]">{r.rank ?? "—"}</td>
                      {showPassport && (
                        <td className="font-mono px-3.5 py-2 text-[var(--fg-dim)]">{showThis ? r.passportId : "—"}</td>
                      )}
                      <td className="px-2 py-2">
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-ghost inline-flex rounded p-1"
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
