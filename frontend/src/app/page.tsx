"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@/hooks/useQuery";
import { useSessions } from "@/hooks/useSessions";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { QueryInput } from "@/components/QueryInput";
import { CandidateList } from "@/components/CandidateList";
import type { ChatMessage } from "@/lib/api-types";
import {
  MessageSquare, Plus, Menu, X, HelpCircle, ChevronRight, Building,
  Trash2, User, Loader2, LogIn, LogOut, AlertCircle, Anchor, Sparkles,
  Users, Moon, Sun, Bug, Clock, Zap, Cpu,
} from "lucide-react";
import { DebugPanel } from "@/components/DebugPanel";
import type { DebugSections } from "@/components/DebugPanel";
import { ContextMeter } from "@/components/ContextMeter";
import { clearDebugCache } from "@/lib/debugCache";

type RightTab = "candidates" | "inspector";

export default function Dashboard() {
  const { session, user, orgName, loading: authLoading, authError, accessToken, signIn, signOut } = useSupabaseAuth();
  const { sessions, currentSessionId, createSession, loadSession, loadSessionsList, deleteSession } = useSessions(accessToken);
  const { conversationHistory, loading, loadingProgress, sendQuery, lastQuery, resetQueryState, setInitialHistoryFromMessages } = useQuery(accessToken);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [debugMode, setDebugMode] = useState(true); // ON by default
  const [rightTab, setRightTab] = useState<RightTab>("candidates");
  const [viewedTurnIndex, setViewedTurnIndex] = useState<number | null>(null);
  const [debugSections, setDebugSections] = useState<DebugSections>({
    steps: true, plan: true, tools: true, memory: true, perf: true,
  });
  const [email, setEmail] = useState("org1@gmail.com");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // ─── Cache helpers ────────────────────────────────────────────────────────
  const readCachedMessages = (sessionId: string) => {
    try {
      const raw = localStorage.getItem(`session-cache:${sessionId}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as ChatMessage[];
      return Array.isArray(parsed) ? parsed : null;
    } catch { return null; }
  };

  const writeCachedMessages = (sessionId: string, messages: ChatMessage[]) => {
    try { localStorage.setItem(`session-cache:${sessionId}`, JSON.stringify(messages)); }
    catch { /* ignore */ }
  };

  const loadSessionHistory = async (sessionId: string, cachedMessages?: ChatMessage[] | null) => {
    resetQueryState();
    setViewedTurnIndex(null);
    if (cachedMessages && cachedMessages.length > 0) setInitialHistoryFromMessages(cachedMessages, sessionId);
    const sessionDetails = await loadSession(sessionId);
    if (sessionDetails?.messages) {
      setInitialHistoryFromMessages(sessionDetails.messages, sessionId);
      writeCachedMessages(sessionId, sessionDetails.messages);
    }
  };

  // ─── Init / persisted prefs ────────────────────────────────────────────────
  useEffect(() => {
    try {
      const dbg = localStorage.getItem("pref:debug");
      if (dbg !== null) setDebugMode(dbg === "1");
      const thm = localStorage.getItem("pref:theme");
      if (thm) setIsDarkMode(thm === "dark");
    } catch { /* ignore */ }
    document.documentElement.classList.add("dark");
  }, []);

  useEffect(() => {
    const init = async () => {
      if (!accessToken) return;
      const fetched = await loadSessionsList();
      if (fetched && fetched.length > 0) {
        const firstId = fetched[0].sessionId;
        await loadSessionHistory(firstId, readCachedMessages(firstId));
      }
    };
    init();
  }, [accessToken]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkMode);
    try { localStorage.setItem("pref:theme", isDarkMode ? "dark" : "light"); } catch { /* ignore */ }
  }, [isDarkMode]);

  useEffect(() => {
    try { localStorage.setItem("pref:debug", debugMode ? "1" : "0"); } catch { /* ignore */ }
  }, [debugMode]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [loading, loadingProgress, conversationHistory.length]);

  // ─── Actions ──────────────────────────────────────────────────────────────
  const handleSearch = async (query: string) => {
    if (!accessToken) return;
    setViewedTurnIndex(null);
    let activeSessionId = currentSessionId;
    if (activeSessionId === "default") activeSessionId = await createSession(query.substring(0, 30));
    sendQuery(query, activeSessionId);
  };

  const handleClarification = async (answer: string) => {
    if (!accessToken) return;
    let activeSessionId = currentSessionId;
    if (activeSessionId === "default") {
      const titleSource = lastQuery ? lastQuery : answer;
      activeSessionId = await createSession(titleSource.substring(0, 30));
    }
    if (lastQuery) sendQuery(lastQuery, activeSessionId, answer);
  };

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    await deleteSession(sessionId);
    clearDebugCache(sessionId);
    if (currentSessionId === sessionId) resetQueryState();
  };

  const handleSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSigningIn(true);
    const ok = await signIn(email.trim(), password);
    setSigningIn(false);
    if (ok) { setPassword(""); resetQueryState(); }
  };

  const handleSignOut = async () => { await signOut(); resetQueryState(); };

  const openInspector = (i: number) => { setViewedTurnIndex(i); setRightTab("inspector"); };
  const openCandidates = (i: number) => { setViewedTurnIndex(i); setRightTab("candidates"); };

  // ─── Derived ──────────────────────────────────────────────────────────────
  const latestAgentIdx = (() => {
    for (let i = conversationHistory.length - 1; i >= 0; i--) if (conversationHistory[i]?.type === "agent") return i;
    return -1;
  })();
  const selectedIdx = viewedTurnIndex ?? (latestAgentIdx >= 0 ? latestAgentIdx : null);

  const latestCandidates = conversationHistory.slice().reverse().find((m) => m.candidates && m.candidates.length > 0)?.candidates;
  const activeCandidates = selectedIdx != null ? (conversationHistory[selectedIdx]?.candidates ?? latestCandidates) : latestCandidates;
  const activeDebug = selectedIdx != null ? conversationHistory[selectedIdx]?.debugInfo : undefined;

  const hasCandidates = !!activeCandidates && activeCandidates.length > 0;
  const hasDebug = debugMode && !!activeDebug;
  const dockOpen = hasCandidates || hasDebug;

  const latestSessionStatus = conversationHistory.slice().reverse()
    .find((m) => m.type === "agent" && m.debugInfo?.sessionStatus)?.debugInfo?.sessionStatus;

  const formatAgentText = (text: string) =>
    text.split("\n").map((line, i) => {
      if (!line.trim()) return <span key={i} className="block h-2" />;
      const parts = line.split(/\*\*(.*?)\*\*/g);
      return (
        <span key={i} className="block mb-1">
          {parts.map((part, j) =>
            j % 2 === 1 ? <strong key={j} className="font-semibold text-[var(--fg)]">{part}</strong> : part
          )}
        </span>
      );
    });

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden relative bg-[var(--app-bg)] text-[var(--fg)]">

      {/* ── Aurora background ─────────────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 dot-grid opacity-40" />
        <div className="aurora-a absolute -top-40 -left-40 w-[680px] h-[680px] rounded-full" style={{ background: "radial-gradient(circle, var(--aurora-1) 0%, transparent 70%)" }} />
        <div className="aurora-b absolute -bottom-56 -right-24 w-[600px] h-[600px] rounded-full" style={{ background: "radial-gradient(circle, var(--aurora-2) 0%, transparent 70%)" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[480px] rounded-full" style={{ background: "radial-gradient(circle, var(--aurora-3) 0%, transparent 70%)" }} />
      </div>

      {/* ── Mobile overlay ────────────────────────────────────────────────── */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* ═══ SIDEBAR ══════════════════════════════════════════════════════════ */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-[260px] flex flex-col glass
        transform transition-transform duration-300 ease-out
        md:relative md:translate-x-0
        ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        <div className="p-4 flex items-center gap-2.5 border-b border-[var(--line)]">
          <div className="w-9 h-9 shrink-0 rounded-xl btn-brand grid place-items-center">
            <Anchor className="w-4.5 h-4.5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display font-bold text-[15px] leading-none">MFA Search</p>
            <p className="text-[11px] text-[var(--fg-faint)] mt-1">Maritime Crew Intelligence</p>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="p-1.5 text-[var(--fg-faint)] hover:text-[var(--fg)] rounded-md md:hidden">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3">
          <motion.button
            suppressHydrationWarning
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              loadSession("default"); resetQueryState(); setViewedTurnIndex(null);
              if (window.innerWidth < 768) setIsSidebarOpen(false);
            }}
            className="btn-brand w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-[13.5px] font-semibold"
          >
            <Plus className="w-4 h-4" /> New Session
          </motion.button>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar px-3 pb-3 space-y-1">
          <p className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--fg-faint)]">Sessions</p>
          {sessions.map((sess) => (
            <div key={sess.sessionId} className="relative group">
              <button
                suppressHydrationWarning
                onClick={async () => {
                  await loadSessionHistory(sess.sessionId, readCachedMessages(sess.sessionId));
                  if (window.innerWidth < 768) setIsSidebarOpen(false);
                }}
                className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-2.5 transition-colors text-[13.5px] ${
                  currentSessionId === sess.sessionId
                    ? "bg-[var(--brand-soft)] text-[var(--fg)] border border-[var(--brand-line)]"
                    : "text-[var(--fg-dim)] hover:bg-[var(--panel-2)] border border-transparent"
                }`}
              >
                <MessageSquare className={`w-4 h-4 shrink-0 ${currentSessionId === sess.sessionId ? "text-[var(--brand)]" : "text-[var(--fg-faint)]"}`} />
                <span className="truncate font-medium">{sess.title}</span>
              </button>
              {sess.sessionId !== "default" && (
                <button
                  onClick={(e) => handleDeleteSession(e, sess.sessionId)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-[var(--fg-faint)] hover:text-[var(--bad)] hover:bg-[var(--bad-soft)] rounded-md opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-[var(--line)]">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 grid place-items-center shrink-0">
              <Building className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-[var(--fg-dim)] truncate">{user?.email || "Not signed in"}</p>
              {orgName && <p className="text-[11px] text-[var(--fg-faint)] truncate">{orgName}</p>}
            </div>
          </div>
        </div>
      </aside>

      {/* ═══ MAIN ═════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <header className="relative shrink-0 z-10 glass border-b border-[var(--line)]">
          <div className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 text-[var(--fg-faint)] hover:text-[var(--fg)] rounded-lg">
                <Menu className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl btn-brand grid place-items-center">
                  <Sparkles className="w-4.5 h-4.5 text-white" />
                </div>
                <div>
                  <h1 className="font-display text-[16px] font-bold leading-none">Candidate Search</h1>
                  <p className="text-[11px] text-[var(--fg-faint)] mt-1">Natural language → Neo4j, fully traced</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                suppressHydrationWarning
                onClick={() => setIsDarkMode(!isDarkMode)}
                title="Toggle theme"
                className="p-2 text-[var(--fg-faint)] hover:text-[var(--fg)] hover:bg-[var(--panel-2)] rounded-lg transition-colors"
              >
                {isDarkMode ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
              </button>
              <button
                suppressHydrationWarning
                onClick={() => setDebugMode(!debugMode)}
                title="Toggle agent inspector"
                className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[12px] font-semibold transition-colors ${
                  debugMode
                    ? "text-[var(--brand)] bg-[var(--brand-soft)] border border-[var(--brand-line)]"
                    : "text-[var(--fg-faint)] hover:text-[var(--fg)] hover:bg-[var(--panel-2)] border border-transparent"
                }`}
              >
                <Bug className="w-4 h-4" /> <span className="hidden sm:inline">Inspector</span>
              </button>

              <div className="h-5 w-px bg-[var(--line-strong)] mx-1" />

              {session && (
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg surface-2">
                  <div className="w-6 h-6 rounded-full btn-brand grid place-items-center"><User className="w-3 h-3 text-white" /></div>
                  <span className="hidden sm:block text-[12.5px] font-medium text-[var(--fg-dim)] max-w-[150px] truncate">{user?.email}</span>
                </div>
              )}
              {session && (
                <button onClick={handleSignOut} title="Sign out" className="p-2 text-[var(--fg-faint)] hover:text-[var(--bad)] hover:bg-[var(--bad-soft)] rounded-lg transition-colors">
                  <LogOut className="w-4.5 h-4.5" />
                </button>
              )}
            </div>
          </div>

          {/* Inspector section toggles */}
          <AnimatePresence>
            {debugMode && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }} className="overflow-hidden"
              >
                <div className="px-4 py-1.5 flex items-center gap-2 bg-[var(--brand-soft)] border-t border-[var(--line)]">
                  <Bug className="w-3.5 h-3.5 text-[var(--brand)] shrink-0" />
                  <span className="text-[10px] uppercase tracking-wider text-[var(--fg-faint)] font-bold mr-1">sections:</span>
                  {(["steps", "plan", "tools", "memory", "perf"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setDebugSections((prev) => ({ ...prev, [s]: !prev[s] }))}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-semibold capitalize transition-colors ${
                        debugSections[s]
                          ? "bg-[var(--brand-soft)] text-[var(--brand)] border border-[var(--brand-line)]"
                          : "text-[var(--fg-faint)] hover:text-[var(--fg-dim)] border border-transparent"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        {/* ── Body: chat + right dock ─────────────────────────────────────── */}
        <div className="flex-1 flex overflow-hidden">

          {/* Chat column */}
          <div className="flex-1 flex flex-col h-full overflow-hidden relative">
            <main className="flex-1 overflow-y-auto no-scrollbar px-4 md:px-8 pt-6 pb-40">
              <div className="max-w-3xl mx-auto">

                {/* Sign-in */}
                {!session && !authLoading && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="mb-8 mt-8 max-w-sm mx-auto">
                    <div className="rounded-2xl elevated p-6">
                      <div className="flex items-center gap-3 mb-5">
                        <div className="w-11 h-11 rounded-xl btn-brand grid place-items-center"><LogIn className="w-5 h-5 text-white" /></div>
                        <div>
                          <h2 className="font-display font-bold text-[16px]">Welcome back</h2>
                          <p className="text-[12px] text-[var(--fg-faint)]">Sign in to your organisation</p>
                        </div>
                      </div>
                      <form onSubmit={handleSignIn} className="space-y-3">
                        {[
                          { type: "email", value: email, onChange: setEmail, placeholder: "Email address" },
                          { type: "password", value: password, onChange: setPassword, placeholder: "Password" },
                        ].map((field) => (
                          <input
                            key={field.type}
                            type={field.type}
                            value={field.value}
                            onChange={(e) => field.onChange(e.target.value)}
                            placeholder={field.placeholder}
                            className="focus-ring w-full rounded-xl surface-2 px-4 py-2.5 text-[14px] text-[var(--fg)] placeholder:text-[var(--fg-faint)] outline-none transition-shadow"
                          />
                        ))}
                        {authError && (
                          <div className="flex gap-2 rounded-xl border border-[var(--bad-soft)] bg-[var(--bad-soft)] p-3 text-[12.5px] text-[var(--bad)]">
                            <AlertCircle className="w-4 h-4 shrink-0" /><span>{authError}</span>
                          </div>
                        )}
                        <motion.button
                          type="submit" disabled={signingIn || authLoading || !email || !password}
                          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                          className="btn-brand w-full rounded-xl py-2.5 text-[14px] font-semibold flex items-center justify-center gap-2"
                        >
                          {signingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                          {signingIn ? "Signing in…" : "Sign in"}
                        </motion.button>
                      </form>
                    </div>
                  </motion.div>
                )}

                {/* Empty state */}
                {conversationHistory.length === 0 && !loading && (
                  <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className={`mb-8 text-center mt-10 ${!session ? "opacity-40 pointer-events-none" : ""}`}>
                    <div className="relative inline-flex mx-auto mb-6">
                      <div className="w-20 h-20 rounded-2xl surface grid place-items-center"><Anchor className="w-9 h-9 text-[var(--brand)]" /></div>
                    </div>
                    <h2 className="font-display text-2xl sm:text-3xl font-bold mb-2 text-gradient">Candidate Search Workspace</h2>
                    <p className="text-[var(--fg-dim)] max-w-lg mx-auto text-[14px] mb-8 leading-relaxed">
                      Ask in plain English. Every run is fully traced — open the Inspector to see the plan, Cypher, tool calls, results, and timings.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto text-left">
                      {[
                        "Find a Master with VLCC experience available next month",
                        "Show Chief Officers currently available for Aframax",
                        "Engineers with LNG experience and valid STCW",
                        "Filipino masters available ASAP with DP cert",
                      ].map((q, i) => (
                        <button key={i} onClick={() => session && handleSearch(q)} className="group surface hover:border-[var(--brand-line)] rounded-xl p-3.5 text-left transition-colors">
                          <ChevronRight className="w-3.5 h-3.5 text-[var(--brand)] mb-1.5 opacity-70 group-hover:opacity-100 transition-opacity" />
                          <p className="text-[13px] text-[var(--fg-dim)] leading-relaxed">&ldquo;{q}&rdquo;</p>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Conversation */}
                {conversationHistory.map((msg, i) => {
                  const isStreaming = loading && i === conversationHistory.length - 1 && msg.type === "agent";
                  return (
                    <motion.div key={i} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mb-5">
                      {msg.type === "user" ? (
                        <div className="flex gap-3 justify-end ml-auto max-w-2xl">
                          <div className="btn-brand rounded-2xl rounded-tr-sm px-4 py-2.5 text-[14px] font-medium">{msg.text}</div>
                          <div className="w-8 h-8 shrink-0 mt-0.5 rounded-full btn-brand grid place-items-center"><User className="w-4 h-4 text-white" /></div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3">
                          {/* Clarification */}
                          {msg.clarification && (
                            <div className="flex gap-3 max-w-2xl w-full">
                              <div className="w-8 h-8 shrink-0 mt-0.5 rounded-full bg-[var(--brand-soft)] border border-[var(--brand-line)] grid place-items-center"><HelpCircle className="w-4 h-4 text-[var(--brand)]" /></div>
                              <div className="flex-1 rounded-2xl rounded-tl-sm surface p-4">
                                <p className="text-[var(--fg)] font-medium text-[14px] mb-3">{msg.clarification.question}</p>
                                {msg.clarification.options && msg.clarification.options.length > 0 ? (
                                  <div className="flex flex-wrap gap-2">
                                    {msg.clarification.options.map((opt, oi) => (
                                      <button key={oi} onClick={() => handleClarification(opt)} className="px-3.5 py-1.5 rounded-full bg-[var(--brand-soft)] border border-[var(--brand-line)] text-[var(--brand)] text-[12.5px] font-medium hover:opacity-80 transition-opacity">{opt}</button>
                                    ))}
                                  </div>
                                ) : (
                                  <form onSubmit={(e) => { e.preventDefault(); const val = new FormData(e.currentTarget).get("clarify") as string; if (val.trim()) handleClarification(val); }} className="flex gap-2">
                                    <input type="text" name="clarify" placeholder="Type your answer…" className="focus-ring flex-1 px-3.5 py-2 rounded-xl surface-2 text-[var(--fg)] text-[14px] placeholder:text-[var(--fg-faint)] outline-none" />
                                    <button type="submit" className="btn-brand px-4 py-2 rounded-xl text-[13.5px] font-semibold">Reply</button>
                                  </form>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Text response */}
                          {msg.text && (
                            <div className="flex gap-3 max-w-2xl w-full">
                              <div className="w-8 h-8 shrink-0 mt-0.5 rounded-full bg-[var(--panel-2)] border border-[var(--line)] grid place-items-center"><MessageSquare className="w-4 h-4 text-[var(--accent)]" /></div>
                              <div className="flex flex-col gap-2.5 flex-1 min-w-0">
                                <div className="rounded-2xl rounded-tl-sm surface p-4 text-[14px] text-[var(--fg-dim)] leading-relaxed">
                                  {formatAgentText(msg.text)}
                                  {isStreaming && <span className="inline-block w-0.5 h-4 bg-[var(--brand)] ml-0.5 align-middle rounded-sm cursor-blink" />}
                                </div>

                                {/* Action chips: candidates + inspector */}
                                <div className="flex flex-wrap items-center gap-2">
                                  {msg.candidates && msg.candidates.length > 0 && (
                                    <button
                                      onClick={() => openCandidates(i)}
                                      className={`inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
                                        selectedIdx === i && rightTab === "candidates"
                                          ? "bg-[var(--brand-soft)] text-[var(--brand)] border border-[var(--brand-line)]"
                                          : "surface-2 text-[var(--fg-dim)] hover:text-[var(--fg)]"
                                      }`}
                                    >
                                      <Users className="w-3.5 h-3.5" /> {msg.candidates.length} candidate{msg.candidates.length !== 1 ? "s" : ""}
                                      <ChevronRight className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  {debugMode && msg.debugInfo && (
                                    <button
                                      onClick={() => openInspector(i)}
                                      className={`inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
                                        selectedIdx === i && rightTab === "inspector"
                                          ? "bg-[var(--brand-soft)] text-[var(--brand)] border border-[var(--brand-line)]"
                                          : "surface-2 text-[var(--fg-dim)] hover:text-[var(--fg)]"
                                      }`}
                                    >
                                      <Bug className="w-3.5 h-3.5" /> Inspect run
                                      <RunChips info={msg.debugInfo} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  );
                })}

                {/* Conversation-full banner */}
                {latestSessionStatus?.shouldStartNewConversation && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex items-center gap-3 rounded-xl border border-[var(--warn-soft)] bg-[var(--warn-soft)] px-4 py-3">
                    <AlertCircle className="w-4 h-4 text-[var(--warn)] shrink-0" />
                    <span className="text-[13.5px] text-[var(--fg-dim)] flex-1">{latestSessionStatus.message ?? "This conversation is getting long."}</span>
                    <button onClick={() => { loadSession("default"); resetQueryState(); }} className="text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-[var(--warn-soft)] text-[var(--warn)] hover:opacity-80 transition-opacity shrink-0">New chat</button>
                  </motion.div>
                )}

                {/* Streaming progress */}
                <AnimatePresence>
                  {loading && loadingProgress && (
                    <motion.div key="progress" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }} className="mb-6">
                      <div className="flex gap-3">
                        <div className="w-8 h-8 shrink-0 mt-0.5 rounded-full bg-[var(--brand-soft)] border border-[var(--brand-line)] grid place-items-center"><Loader2 className="w-4 h-4 text-[var(--brand)] animate-spin" /></div>
                        <div className="rounded-2xl rounded-tl-sm surface overflow-hidden">
                          <div className="h-0.5 progress-animated" />
                          <div className="px-4 py-3 flex items-center gap-3">
                            <div className="flex gap-1 shrink-0">
                              {[0, 1, 2].map((j) => (
                                <motion.div key={j} className="w-1.5 h-1.5 rounded-full bg-[var(--brand)]" animate={{ y: [0, -5, 0] }} transition={{ duration: 0.7, repeat: Infinity, delay: j * 0.12 }} />
                              ))}
                            </div>
                            <AnimatePresence mode="wait">
                              <motion.span key={loadingProgress} initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }} transition={{ duration: 0.16 }} className="text-[14px] text-[var(--fg-dim)]">
                                {loadingProgress}
                              </motion.span>
                            </AnimatePresence>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div ref={bottomRef} className="h-6" />
              </div>
            </main>

            {/* Floating input */}
            <div className="absolute bottom-0 left-0 w-full px-4 sm:px-8 pb-5 pt-12 pointer-events-none z-20" style={{ background: "linear-gradient(to top, var(--app-bg) 35%, transparent)" }}>
              <div className="max-w-3xl mx-auto pointer-events-auto">
                <QueryInput onSearch={handleSearch} loading={loading || !session} />
                {session && latestSessionStatus && (latestSessionStatus.softLimit ?? 0) > 0 && (
                  <div className="mt-2 flex justify-end pr-1">
                    <ContextMeter tokensUsed={latestSessionStatus.tokensUsed ?? 0} softLimit={latestSessionStatus.softLimit ?? 0} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ═══ RIGHT DOCK ═══════════════════════════════════════════════════ */}
          <AnimatePresence>
            {dockOpen && (
              <motion.aside
                key="dock"
                initial={{ x: 460, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 460, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 32, mass: 0.9 }}
                className="hidden lg:flex w-[30rem] flex-col h-full shrink-0 glass border-l border-[var(--line)]"
              >
                {/* Dock tabs */}
                <div className="p-3 border-b border-[var(--line)] flex items-center gap-1.5">
                  <DockTab active={rightTab === "candidates"} onClick={() => setRightTab("candidates")} icon={<Users className="w-4 h-4" />} label="Candidates" count={hasCandidates ? activeCandidates!.length : undefined} />
                  {debugMode && (
                    <DockTab active={rightTab === "inspector"} onClick={() => setRightTab("inspector")} icon={<Bug className="w-4 h-4" />} label="Inspector" />
                  )}
                  {viewedTurnIndex !== null && (
                    <button onClick={() => setViewedTurnIndex(null)} className="ml-auto text-[11px] font-medium text-[var(--fg-faint)] hover:text-[var(--fg)] px-2 py-1 rounded-md surface-2">
                      Latest
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto no-scrollbar p-3">
                  {rightTab === "candidates" ? (
                    hasCandidates ? <CandidateList candidates={activeCandidates} /> : <DockEmpty icon={<Users className="w-7 h-7" />} text="No candidates for this turn." />
                  ) : (
                    hasDebug ? <DebugPanel info={activeDebug!} visibleSections={debugSections} /> : <DockEmpty icon={<Bug className="w-7 h-7" />} text="No trace captured for this turn yet." />
                  )}
                </div>
              </motion.aside>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ─── Small inline helpers ─────────────────────────────────────────────────────

function RunChips({ info }: { info: NonNullable<ReturnType<typeof useQuery>["conversationHistory"][number]["debugInfo"]> }) {
  const totalMs = Object.values(info.summary?.nodeLatencies ?? {}).reduce((a, b) => a + b, 0);
  const tokens = info.summary?.tokenUsage ? info.summary.tokenUsage.input + info.summary.tokenUsage.output : null;
  const tools = info.toolObservations?.observations?.length ?? 0;
  const path = info.summary?.executionPath ?? info.plan?.path;
  return (
    <span className="hidden sm:inline-flex items-center gap-2 ml-1 pl-2 border-l border-[var(--line-strong)] text-[11px] font-normal text-[var(--fg-faint)]">
      {path && <span className="font-semibold text-[var(--brand)]">{String(path)}</span>}
      {totalMs > 0 && <span className="inline-flex items-center gap-0.5"><Clock className="w-3 h-3" />{totalMs}ms</span>}
      {tokens != null && <span className="inline-flex items-center gap-0.5"><Zap className="w-3 h-3" />{(tokens / 1000).toFixed(1)}k</span>}
      {tools > 0 && <span className="inline-flex items-center gap-0.5"><Cpu className="w-3 h-3" />{tools}</span>}
    </span>
  );
}

function DockTab({ active, onClick, icon, label, count }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count?: number }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-semibold transition-colors ${
        active ? "bg-[var(--brand-soft)] text-[var(--brand)] border border-[var(--brand-line)]" : "text-[var(--fg-dim)] hover:bg-[var(--panel-2)] border border-transparent"
      }`}
    >
      {icon}{label}
      {count != null && (
        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold bg-[var(--brand-soft)] text-[var(--brand)]">{count}</span>
      )}
    </button>
  );
}

function DockEmpty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="h-full grid place-items-center text-center px-6">
      <div>
        <div className="w-14 h-14 rounded-2xl surface-2 grid place-items-center mx-auto mb-3 text-[var(--fg-faint)]">{icon}</div>
        <p className="text-[13px] text-[var(--fg-faint)]">{text}</p>
      </div>
    </div>
  );
}
