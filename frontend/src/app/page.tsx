"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { UIMessage } from "ai";
import { Anchor, Loader2, LogIn, AlertCircle } from "lucide-react";
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
  const { session, user, orgName, loading: authLoading, authError, accessToken, signIn, signOut } = useSupabaseAuth();
  const sessions = useSessions(accessToken);
  const { currentSessionId, setCurrentSessionId } = sessions;

  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [bootstrapping, setBootstrapping] = useState(false);
  const bootstrapped = useRef(false);

  const selectSession = useCallback(async (id: string) => {
    setCurrentSessionId(id);
    setInitialMessages([]);
    const detail = await sessions.loadDetail(id);
    if (detail?.messages) setInitialMessages(toUiMessages(detail.messages));
  }, [sessions, setCurrentSessionId]);

  const newChat = useCallback(async () => {
    const id = await sessions.create();
    if (id) { setCurrentSessionId(id); setInitialMessages([]); }
  }, [sessions, setCurrentSessionId]);

  // On sign-in: load sessions, open the most recent (or create one).
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
        <Loader2 className="size-6 animate-spin text-[var(--brass)]" />
      </div>
    );
  }
  if (!session) {
    return <Login signIn={signIn} authError={authError} loading={authLoading} />;
  }

  // ── App ──────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden">
      <div className="hidden md:block">
        <Sidebar
          sessions={sessions.sessions}
          currentSessionId={currentSessionId}
          email={user?.email}
          orgName={orgName}
          onSelect={selectSession}
          onNew={newChat}
          onDelete={handleDelete}
          onSignOut={signOut}
        />
      </div>
      <main className="relative min-w-0 flex-1">
        {currentSessionId && !bootstrapping ? (
          <Chat
            key={currentSessionId}
            sessionId={currentSessionId}
            initialMessages={initialMessages}
            accessToken={accessToken!}
            onFirstReply={onFirstReply}
          />
        ) : (
          <div className="grid h-full place-items-center">
            <Loader2 className="size-6 animate-spin text-[var(--brass)]" />
          </div>
        )}
      </main>
    </div>
  );
}

/* ── Sign-in ───────────────────────────────────────────────────────────────── */
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
        <div className="mb-6 flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl btn-brass">
            <Anchor className="size-5" />
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold text-[var(--fg)]">Seafarer Graph</h1>
            <p className="text-[12px] text-[var(--fg-faint)]">Sign in to your organisation</p>
          </div>
        </div>
        <form onSubmit={submit} className="surface space-y-3 rounded-2xl p-5">
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address" autoComplete="email"
            className="focus-ring w-full rounded-xl surface-2 px-4 py-2.5 text-sm text-[var(--fg)] placeholder:text-[var(--fg-faint)] outline-none"
          />
          <input
            type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Password" autoComplete="current-password"
            className="focus-ring w-full rounded-xl surface-2 px-4 py-2.5 text-sm text-[var(--fg)] placeholder:text-[var(--fg-faint)] outline-none"
          />
          {authError && (
            <div className="flex items-center gap-2 rounded-xl bg-[var(--danger-soft)] px-3 py-2.5 text-[12.5px] text-[var(--danger)]">
              <AlertCircle className="size-4 shrink-0" /> {authError}
            </div>
          )}
          <button
            type="submit" disabled={busy || loading || !email || !password}
            className="btn-brass flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
