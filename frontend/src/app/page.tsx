"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { UIMessage } from "ai";
import { motion } from "framer-motion";
import { Compass, Loader2, LogIn, AlertCircle, PanelLeft } from "lucide-react";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { useSessions } from "@/hooks/useSessions";
import { Sidebar } from "@/components/Sidebar";
import { Chat } from "@/components/Chat";
import type { StoredMessage } from "@/lib/types";

function toUiMessages(msgs: StoredMessage[]): UIMessage[] {
  return msgs
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ id: m.id, role: m.role, parts: m.parts })) as unknown as UIMessage[];
}

export default function Home() {
  const { session, user, orgName, loading: authLoading, authError, accessToken, signIn, signOut } =
    useSupabaseAuth();
  const sessions = useSessions(accessToken);
  const { currentSessionId, setCurrentSessionId } = sessions;

  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const bootstrapped = useRef(false);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("sidebarOpen") : null;
    if (saved !== null) setSidebarOpen(saved === "1");
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((o) => {
      const next = !o;
      try { window.localStorage.setItem("sidebarOpen", next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const selectSession = useCallback(async (id: string) => {
    setCurrentSessionId(id);
    setInitialMessages([]);
    setSessionLoading(true);
    try {
      const detail = await sessions.loadDetail(id);
      if (detail?.messages) setInitialMessages(toUiMessages(detail.messages));
    } finally {
      setSessionLoading(false);
    }
  }, [sessions, setCurrentSessionId]);

  const newChat = useCallback(async () => {
    const id = await sessions.create();
    if (id) { setCurrentSessionId(id); setInitialMessages([]); }
  }, [sessions, setCurrentSessionId]);

  useEffect(() => {
    if (!accessToken || bootstrapped.current) return;
    bootstrapped.current = true;
    setBootstrapping(true);
    (async () => {
      const rows = await sessions.list();
      if (rows.length > 0) await selectSession(rows[0].sessionId);
      else await newChat();
      setBootstrapping(false);
    })();
  }, [accessToken, sessions, selectSession, newChat]);

  useEffect(() => { if (!accessToken) bootstrapped.current = false; }, [accessToken]);

  const handleDelete = useCallback(async (id: string) => {
    await sessions.remove(id);
    if (id === currentSessionId) {
      const remaining = sessions.sessions.filter((s) => s.sessionId !== id);
      if (remaining.length > 0) await selectSession(remaining[0].sessionId);
      else await newChat();
    }
  }, [sessions, currentSessionId, selectSession, newChat]);

  const onFirstReply = useCallback(() => {
    if (!currentSessionId) return;
    setTimeout(() => sessions.refreshTitle(currentSessionId), 2200);
    setTimeout(() => sessions.refreshTitle(currentSessionId), 5000);
  }, [sessions, currentSessionId]);

  // ── Auth gate ──────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="grid h-screen place-items-center">
        <Loader2 className="size-5 animate-spin text-[var(--teal)]" />
      </div>
    );
  }
  if (!session) {
    return <Login signIn={signIn} authError={authError} loading={authLoading} />;
  }

  // ── App ──────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden">
      <motion.div
        initial={false}
        animate={{ width: sidebarOpen ? 272 : 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="hidden shrink-0 overflow-hidden md:block"
      >
        <Sidebar
          sessions={sessions.sessions}
          currentSessionId={currentSessionId}
          email={user?.email}
          orgName={orgName}
          onSelect={selectSession}
          onNew={newChat}
          onDelete={handleDelete}
          onSignOut={signOut}
          onToggle={toggleSidebar}
        />
      </motion.div>

      <main className="relative min-w-0 flex-1">
        {/* Floating reopen — only when sidebar is collapsed */}
        <motion.button
          initial={false}
          animate={{
            opacity: sidebarOpen ? 0 : 1,
            x: sidebarOpen ? -8 : 0,
            pointerEvents: sidebarOpen ? "none" : "auto",
          }}
          transition={{ duration: 0.2 }}
          onClick={toggleSidebar}
          className="surface absolute left-4 top-4 z-20 hidden rounded-xl p-2 md:grid md:place-items-center"
          aria-label="Open sidebar"
        >
          <PanelLeft className="size-4" />
        </motion.button>

        {currentSessionId && !bootstrapping && !sessionLoading ? (
          <Chat
            key={currentSessionId}
            sessionId={currentSessionId}
            initialMessages={initialMessages}
            accessToken={accessToken!}
            onFirstReply={onFirstReply}
          />
        ) : (
          <div className="grid h-full place-items-center">
            <Loader2 className="size-5 animate-spin text-[var(--teal)]" />
          </div>
        )}
      </main>
    </div>
  );
}

/* ── Sign-in page ──────────────────────────────────────────────────────────── */
function Login({
  signIn, authError, loading,
}: {
  signIn: (email: string, password: string) => Promise<boolean>;
  authError: string | null;
  loading: boolean;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    await signIn(email.trim(), password);
    setBusy(false);
  };

  return (
    <div className="grid h-screen place-items-center px-6">
      <div className="fade-up w-full max-w-sm">

        {/* Logo + wordmark */}
        <div className="mb-7 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl border border-[var(--teal-line)] bg-[var(--teal-soft)]">
            <Compass className="size-5 text-[var(--teal)]" />
          </div>
          <div>
            <h1
              className="text-[18px] font-semibold leading-none text-[var(--fg)]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Seafarer Graph
            </h1>
            <p className="mt-0.5 text-[11.5px] text-[var(--fg-3)]">Sign in to your organisation</p>
          </div>
        </div>

        {/* Card */}
        <div className="surface-raised rounded-2xl p-5 space-y-3">
          <div>
            <label className="tag mb-1.5 block">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="focus-ring w-full rounded-lg bg-[var(--surface-3)] px-3.5 py-2.5 text-sm text-[var(--fg)] placeholder:text-[var(--fg-3)] outline-none"
            />
          </div>
          <div>
            <label className="tag mb-1.5 block">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="focus-ring w-full rounded-lg bg-[var(--surface-3)] px-3.5 py-2.5 text-sm text-[var(--fg)] placeholder:text-[var(--fg-3)] outline-none"
            />
          </div>

          {authError && (
            <div className="flex items-center gap-2 rounded-lg bg-[var(--danger-soft)] px-3 py-2.5 text-[12.5px] text-[var(--danger)]">
              <AlertCircle className="size-3.5 shrink-0" /> {authError}
            </div>
          )}

          <button
            type="button"
            onClick={(e) => { submit(e as unknown as React.FormEvent); }}
            disabled={busy || loading || !email || !password}
            className="btn-primary flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm mt-1"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
            {busy ? "Signing in…" : "Continue"}
          </button>
        </div>

        <p className="mt-4 text-center text-[11.5px] text-[var(--fg-3)]">
          Access is restricted to authorised organisations.
        </p>
      </div>
    </div>
  );
}
