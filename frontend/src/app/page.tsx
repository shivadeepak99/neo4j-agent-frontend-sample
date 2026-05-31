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
  Users, Moon, Sun,
} from "lucide-react";

export default function Dashboard() {
  const { session, user, orgName, loading: authLoading, authError, accessToken, signIn, signOut } = useSupabaseAuth();
  const { sessions, currentSessionId, createSession, loadSession, loadSessionsList, deleteSession } = useSessions(accessToken);
  const { conversationHistory, loading, loadingProgress, sendQuery, lastQuery, resetQueryState, setInitialHistoryFromMessages } = useQuery(accessToken);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [viewedCandidatesIndex, setViewedCandidatesIndex] = useState<number | null>(null);
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
    if (cachedMessages && cachedMessages.length > 0) setInitialHistoryFromMessages(cachedMessages);
    const sessionDetails = await loadSession(sessionId);
    if (sessionDetails?.messages) {
      setInitialHistoryFromMessages(sessionDetails.messages);
      writeCachedMessages(sessionId, sessionDetails.messages);
    }
  };

  // ─── Init ─────────────────────────────────────────────────────────────────
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
    document.documentElement.classList.add("dark");
  }, [accessToken]);

  useEffect(() => {
    isDarkMode
      ? document.documentElement.classList.add("dark")
      : document.documentElement.classList.remove("dark");
  }, [isDarkMode]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [loading, loadingProgress, conversationHistory.length]);

  // ─── Actions ──────────────────────────────────────────────────────────────
  const handleSearch = async (query: string) => {
    if (!accessToken) return;
    setViewedCandidatesIndex(null);
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

  // ─── Derived ──────────────────────────────────────────────────────────────
  const latestCandidates = conversationHistory.slice().reverse().find((m) => m.candidates && m.candidates.length > 0)?.candidates;
  const activeCandidates = viewedCandidatesIndex !== null
    ? conversationHistory[viewedCandidatesIndex]?.candidates
    : latestCandidates;

  const formatAgentText = (text: string) =>
    text.split("\n").map((line, i) => {
      if (!line.trim()) return <span key={i} className="block h-2" />;
      const parts = line.split(/\*\*(.*?)\*\*/g);
      return (
        <span key={i} className="block mb-1">
          {parts.map((part, j) =>
            j % 2 === 1
              ? <strong key={j} className="font-semibold text-white">{part}</strong>
              : part
          )}
        </span>
      );
    });

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden relative bg-[#02060F] text-white">

      {/* ── Animated nebula background ─────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Dot grid texture */}
        <div className="absolute inset-0 dot-grid opacity-40" />
        {/* Nebula blobs */}
        <div className="nebula-a absolute -top-40 -left-40 w-[700px] h-[700px] rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.12)_0%,transparent_70%)]" />
        <div className="nebula-b absolute -bottom-60 -right-20 w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.10)_0%,transparent_70%)]" />
        <div className="nebula-c absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.04)_0%,transparent_70%)]" />
      </div>

      {/* ── Mobile overlay ────────────────────────────────────────────────── */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* ═══ SIDEBAR ══════════════════════════════════════════════════════════ */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 flex flex-col
        bg-[rgba(7,17,31,0.95)] backdrop-blur-xl
        border-r border-[rgba(99,130,220,0.1)]
        transform transition-all duration-300 ease-in-out
        md:relative md:translate-x-0
        ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        {/* Sidebar glow edge */}
        <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-[rgba(99,102,241,0.3)] to-transparent" />

        {/* Sidebar header */}
        <div className="p-4 border-b border-[rgba(99,130,220,0.1)] flex items-center gap-2">
          {/* Logo mark */}
          <div className="w-8 h-8 flex-shrink-0 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg">
            <Anchor className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-sm text-white tracking-tight flex-1">MFA Search</span>
          <button onClick={() => setIsSidebarOpen(false)} className="p-1.5 text-[#7A92B8] hover:text-[#C5D3F0] rounded-md md:hidden transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* New Session button */}
        <div className="p-3">
          <motion.button
            suppressHydrationWarning
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              loadSession("default");
              resetQueryState();
              if (window.innerWidth < 768) setIsSidebarOpen(false);
            }}
            className="relative w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold text-white overflow-hidden group transition-all"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-violet-600 opacity-90 group-hover:opacity-100 transition-opacity" />
            <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-violet-500" />
            </span>
            {/* Top highlight */}
            <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
            <Plus className="w-4 h-4 relative z-10" />
            <span className="relative z-10 whitespace-nowrap">New Session</span>
          </motion.button>
        </div>

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto no-scrollbar px-3 pb-3 space-y-1">
          {sessions.map((sess) => (
            <div key={sess.sessionId} className="relative group">
              <button
                suppressHydrationWarning
                onClick={async () => {
                  await loadSessionHistory(sess.sessionId, readCachedMessages(sess.sessionId));
                  if (window.innerWidth < 768) setIsSidebarOpen(false);
                }}
                className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-2.5 transition-all duration-200 text-sm ${
                  currentSessionId === sess.sessionId
                    ? "bg-[rgba(99,102,241,0.15)] text-[#C7D2FE] border border-[rgba(99,102,241,0.25)]"
                    : "text-[#C5D3F0] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#A8B5D0] border border-transparent"
                }`}
              >
                <MessageSquare className={`w-3.5 h-3.5 flex-shrink-0 ${currentSessionId === sess.sessionId ? "text-indigo-400" : "text-[#7A92B8]"}`} />
                <span className="truncate font-medium">{sess.title}</span>
              </button>
              {sess.sessionId !== "default" && (
                <button
                  onClick={(e) => handleDeleteSession(e, sess.sessionId)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-[#7A92B8] hover:text-rose-400 hover:bg-[rgba(244,63,94,0.1)] rounded-md opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Sidebar footer */}
        <div className="p-3 border-t border-[rgba(99,130,220,0.1)]">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
              <Building className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-[#A8B5D0] truncate">{user?.email || "Not signed in"}</p>
              {orgName && <p className="text-[10px] text-[#7A92B8] truncate">{orgName}</p>}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ MAIN CONTENT ═════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <header className="relative flex-shrink-0 z-10 border-b border-[rgba(99,130,220,0.1)] bg-[rgba(7,17,31,0.8)] backdrop-blur-xl">
          {/* Bottom glow line */}
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[rgba(99,102,241,0.4)] to-transparent" />

          <div className="px-4 py-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="md:hidden p-2 text-[#7A92B8] hover:text-[#C5D3F0] hover:bg-[rgba(255,255,255,0.05)] rounded-lg transition-all"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2.5">
                {/* Glowing icon */}
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h1 className="text-[15px] font-semibold tracking-tight text-white leading-none">
                    Candidate Search
                  </h1>
                  <p className="text-[10px] text-[#7A92B8] font-medium mt-0.5">Maritime Intelligence</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Theme toggle */}
              <button
                suppressHydrationWarning
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-2 text-[#7A92B8] hover:text-[#C5D3F0] hover:bg-[rgba(255,255,255,0.05)] rounded-lg transition-all"
              >
                {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              <div className="h-5 w-px bg-[rgba(99,130,220,0.15)]" />

              {/* User chip */}
              {session && (
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(99,130,220,0.1)]">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                    <User className="w-3 h-3 text-white" />
                  </div>
                  <span className="hidden sm:block text-[12px] font-medium text-[#A8B5D0] max-w-[140px] truncate">
                    {user?.email}
                  </span>
                </div>
              )}

              {session && (
                <button
                  onClick={handleSignOut}
                  title="Sign out"
                  className="p-2 text-[#7A92B8] hover:text-rose-400 hover:bg-[rgba(244,63,94,0.08)] rounded-lg transition-all"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </header>

        {/* ── Body: chat + right panel ────────────────────────────────────── */}
        <div className="flex-1 flex overflow-hidden">

          {/* Chat column */}
          <div className="flex-1 flex flex-col h-full overflow-hidden relative">
            <main className="flex-1 overflow-y-auto no-scrollbar px-4 md:px-8 pt-6 pb-36">
              <div className="max-w-3xl mx-auto">

                {/* ── Sign-in card ─────────────────────────────────────────── */}
                {!session && !authLoading && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                    className="mb-8 mt-8 max-w-sm mx-auto"
                  >
                    <div className="relative rounded-2xl overflow-hidden">
                      {/* Gradient border */}
                      <div className="absolute inset-0 rounded-2xl p-px bg-gradient-to-br from-indigo-500/40 via-violet-500/20 to-sky-500/30">
                        <div className="w-full h-full rounded-2xl bg-[#07111F]" />
                      </div>
                      <div className="relative p-6">
                        {/* Header */}
                        <div className="flex items-center gap-3 mb-5">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg">
                            <LogIn className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h2 className="font-semibold text-white text-[15px]">Welcome back</h2>
                            <p className="text-[11px] text-[#7A92B8]">Sign in to your organisation</p>
                          </div>
                        </div>

                        <form onSubmit={handleSignIn} className="space-y-3">
                          {[
                            { type: "email",    value: email,    onChange: (v: string) => setEmail(v),    placeholder: "Email address" },
                            { type: "password", value: password, onChange: (v: string) => setPassword(v), placeholder: "Password" },
                          ].map((field) => (
                            <div key={field.type} className="relative">
                              <input
                                type={field.type}
                                value={field.value}
                                onChange={(e) => field.onChange(e.target.value)}
                                placeholder={field.placeholder}
                                className="w-full rounded-xl border border-[rgba(99,130,220,0.15)] bg-[rgba(255,255,255,0.04)] px-4 py-2.5 text-sm text-white placeholder:text-[#9BB4D6] outline-none focus:border-[rgba(99,102,241,0.5)] focus:bg-[rgba(99,102,241,0.05)] transition-all"
                              />
                            </div>
                          ))}

                          {authError && (
                            <div className="flex gap-2 rounded-xl border border-[rgba(244,63,94,0.2)] bg-[rgba(244,63,94,0.08)] p-3 text-xs text-rose-300">
                              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                              <span>{authError}</span>
                            </div>
                          )}

                          <motion.button
                            type="submit"
                            disabled={signingIn || authLoading || !email || !password}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.97 }}
                            className="relative w-full rounded-xl py-2.5 text-sm font-semibold text-white overflow-hidden disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                          >
                            <span className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-violet-600" />
                            <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
                            <span className="relative z-10 flex items-center gap-2">
                              {signingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                              {signingIn ? "Signing in…" : "Sign in"}
                            </span>
                          </motion.button>
                        </form>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ── Empty state ──────────────────────────────────────────── */}
                {conversationHistory.length === 0 && !loading && (
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className={`mb-8 text-center mt-8 ${!session ? "opacity-30 pointer-events-none" : ""}`}
                  >
                    {/* Hero icon */}
                    <div className="relative inline-flex mx-auto mb-6">
                      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-600/20 border border-[rgba(99,102,241,0.2)] flex items-center justify-center backdrop-blur-sm">
                        <Anchor className="w-9 h-9 text-indigo-400" />
                      </div>
                      {/* Glow rings */}
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10 blur-xl" />
                    </div>

                    <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 tracking-tight">
                      Candidate Search Workspace
                    </h2>
                    <p className="text-[#C5D3F0] max-w-lg mx-auto text-sm mb-8 leading-relaxed">
                      Use natural language to find maritime crew by role, vessel experience,
                      availability, or compliance status.
                    </p>

                    {/* Sample query chips */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto text-left">
                      {[
                        "Find a Master with VLCC experience available next month",
                        "Show Chief Officers currently available for Aframax",
                        "Engineers with LNG experience and valid STCW",
                        "Filipino masters available ASAP with DP cert",
                      ].map((q, i) => (
                        <div
                          key={i}
                          className="group relative rounded-xl overflow-hidden cursor-pointer"
                          onClick={() => session && handleSearch(q)}
                        >
                          <div className="absolute inset-0 bg-gradient-to-br from-[rgba(99,102,241,0.08)] to-[rgba(139,92,246,0.05)] opacity-0 group-hover:opacity-100 transition-opacity" />
                          <div className="relative p-3.5 bg-[rgba(255,255,255,0.03)] border border-[rgba(99,130,220,0.1)] rounded-xl group-hover:border-[rgba(99,102,241,0.3)] transition-all">
                            <ChevronRight className="w-3 h-3 text-indigo-500 mb-1.5 opacity-60 group-hover:opacity-100 transition-opacity" />
                            <p className="text-[12px] text-[#C5D3F0] group-hover:text-[#A8B5D0] transition-colors leading-relaxed">"{q}"</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* ── Conversation ─────────────────────────────────────────── */}
                {conversationHistory.map((msg, i) => {
                  const isStreaming = loading && i === conversationHistory.length - 1 && msg.type === "agent";
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      className="mb-5"
                    >
                      {msg.type === "user" ? (
                        /* User bubble */
                        <div className="flex gap-3 justify-end ml-auto max-w-2xl">
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, x: 10 }}
                            animate={{ opacity: 1, scale: 1, x: 0 }}
                            transition={{ duration: 0.22, ease: "easeOut" }}
                            className="relative rounded-2xl rounded-tr-sm overflow-hidden"
                          >
                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-violet-600" />
                            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
                            <p className="relative z-10 px-5 py-3 text-sm font-medium text-white">{msg.text}</p>
                          </motion.div>
                          <div className="w-8 h-8 flex-shrink-0 mt-1 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg">
                            <User className="w-3.5 h-3.5 text-white" />
                          </div>
                        </div>
                      ) : (
                        /* Agent response */
                        <div className="flex flex-col gap-3">

                          {/* Clarification card */}
                          {msg.clarification && (
                            <div className="flex gap-3 max-w-2xl w-full">
                              <div className="w-8 h-8 flex-shrink-0 mt-1 rounded-full bg-[rgba(99,102,241,0.15)] border border-[rgba(99,102,241,0.25)] flex items-center justify-center">
                                <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
                              </div>
                              <div className="relative flex-1 rounded-2xl rounded-tl-sm overflow-hidden">
                                <div className="absolute inset-0 bg-[rgba(99,102,241,0.06)] border border-[rgba(99,102,241,0.2)]" />
                                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-indigo-500/30 via-violet-500/20 to-transparent" />
                                <div className="relative p-4">
                                  <p className="text-[#C7D2FE] font-medium text-sm mb-3">{msg.clarification.question}</p>
                                  {msg.clarification.options && msg.clarification.options.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                      {msg.clarification.options.map((opt, oi) => (
                                        <button
                                          key={oi}
                                          onClick={() => handleClarification(opt)}
                                          className="px-3.5 py-1.5 bg-[rgba(99,102,241,0.12)] border border-[rgba(99,102,241,0.25)] rounded-full text-indigo-200 text-xs font-medium hover:bg-[rgba(99,102,241,0.22)] hover:border-[rgba(99,102,241,0.45)] transition-all"
                                        >
                                          {opt}
                                        </button>
                                      ))}
                                    </div>
                                  ) : (
                                    <form
                                      onSubmit={(e) => {
                                        e.preventDefault();
                                        const val = new FormData(e.currentTarget).get("clarify") as string;
                                        if (val.trim()) handleClarification(val);
                                      }}
                                      className="flex gap-2 mt-1"
                                    >
                                      <input
                                        type="text"
                                        name="clarify"
                                        placeholder="Type your answer…"
                                        className="flex-1 px-3.5 py-2 rounded-xl border border-[rgba(99,130,220,0.15)] bg-[rgba(255,255,255,0.04)] text-white text-sm placeholder:text-[#9BB4D6] outline-none focus:border-[rgba(99,102,241,0.45)] transition-all"
                                      />
                                      <button
                                        type="submit"
                                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                                      >
                                        Reply
                                      </button>
                                    </form>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Text response */}
                          {msg.text && (
                            <div className="flex gap-3 max-w-2xl w-full">
                              <div className="w-8 h-8 flex-shrink-0 mt-1 rounded-full bg-[rgba(56,189,248,0.12)] border border-[rgba(56,189,248,0.2)] flex items-center justify-center">
                                <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
                              </div>
                              <div className="flex flex-col gap-2.5 flex-1">
                                <motion.div
                                  initial={{ opacity: 0, y: 6 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ duration: 0.28, ease: "easeOut" }}
                                  className="relative rounded-2xl rounded-tl-sm overflow-hidden"
                                >
                                  <div className="absolute inset-0 bg-[rgba(7,17,31,0.9)] border border-[rgba(99,130,220,0.12)]" />
                                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-sky-500/20 via-indigo-500/15 to-transparent" />
                                  <div className="relative p-4 text-[13px] sm:text-sm text-[#A8B5D0] leading-relaxed">
                                    {formatAgentText(msg.text)}
                                    {isStreaming && (
                                      <span className="inline-block w-0.5 h-3.5 bg-indigo-400 ml-0.5 align-middle rounded-sm cursor-blink" />
                                    )}
                                  </div>
                                </motion.div>

                                {/* Candidate count badge */}
                                {msg.candidates && msg.candidates.length > 0 && (
                                  <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => setViewedCandidatesIndex(i)}
                                    className={`relative rounded-xl overflow-hidden max-w-[200px] w-full transition-all group/badge ${
                                      msg.candidates === activeCandidates
                                        ? "border border-[rgba(99,102,241,0.4)]"
                                        : "border border-[rgba(99,130,220,0.1)] hover:border-[rgba(99,102,241,0.35)]"
                                    }`}
                                  >
                                    <div className={`absolute inset-0 transition-opacity ${
                                      msg.candidates === activeCandidates
                                        ? "bg-[rgba(99,102,241,0.12)] opacity-100"
                                        : "bg-[rgba(99,102,241,0.06)] opacity-0 group-hover/badge:opacity-100"
                                    }`} />
                                    <div className="relative p-2.5 flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-md bg-[rgba(99,102,241,0.2)] flex items-center justify-center">
                                          <Users className="w-3 h-3 text-indigo-400" />
                                        </div>
                                        <span className="text-[12px] font-semibold text-[#A8B5D0]">
                                          {msg.candidates.length} candidates
                                        </span>
                                      </div>
                                      <ChevronRight className="w-3.5 h-3.5 text-[#7A92B8] group-hover/badge:text-indigo-400 transition-colors" />
                                    </div>
                                  </motion.button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  );
                })}

                {/* ── Streaming progress ───────────────────────────────────── */}
                <AnimatePresence>
                  {loading && loadingProgress && (
                    <motion.div
                      key="progress"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                      className="mb-6"
                    >
                      <div className="flex gap-3">
                        <div className="w-8 h-8 flex-shrink-0 mt-1 rounded-full bg-[rgba(99,102,241,0.12)] border border-[rgba(99,102,241,0.2)] flex items-center justify-center">
                          <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                        </div>
                        <div className="relative rounded-2xl rounded-tl-sm overflow-hidden">
                          <div className="absolute inset-0 bg-[rgba(7,17,31,0.9)] border border-[rgba(99,130,220,0.12)]" />
                          {/* Animated gradient top border */}
                          <div className="absolute inset-x-0 top-0 h-px progress-animated" />
                          <div className="relative px-4 py-3 flex items-center gap-3">
                            {/* Bouncing dots */}
                            <div className="flex gap-1 flex-shrink-0">
                              {[0, 1, 2].map((j) => (
                                <motion.div
                                  key={j}
                                  className="w-1.5 h-1.5 rounded-full bg-indigo-400"
                                  animate={{ y: [0, -5, 0] }}
                                  transition={{ duration: 0.7, repeat: Infinity, delay: j * 0.12, ease: "easeInOut" }}
                                />
                              ))}
                            </div>
                            <AnimatePresence mode="wait">
                              <motion.span
                                key={loadingProgress}
                                initial={{ opacity: 0, x: 6 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -6 }}
                                transition={{ duration: 0.16, ease: "easeOut" }}
                                className="text-sm text-[#C5D3F0]"
                              >
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

            {/* ── Floating input bar ─────────────────────────────────────── */}
            <div className="absolute bottom-0 left-0 w-full px-4 sm:px-8 pb-5 pt-10 bg-gradient-to-t from-[#02060F] via-[#02060F]/90 to-transparent pointer-events-none z-20">
              <div className="max-w-3xl mx-auto pointer-events-auto">
                <QueryInput onSearch={handleSearch} loading={loading || !session} />
              </div>
            </div>
          </div>

          {/* ═══ RIGHT PANEL ════════════════════════════════════════════════ */}
          <AnimatePresence>
            {activeCandidates && activeCandidates.length > 0 && (
              <motion.div
                key="candidate-panel"
                initial={{ x: 440, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 440, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30, mass: 0.9 }}
                className="hidden lg:flex w-[26rem] flex-col h-full flex-shrink-0 relative"
                style={{ background: "rgba(7,17,31,0.95)" }}
              >
                {/* Left glow edge */}
                <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-[rgba(99,102,241,0.25)] to-transparent" />
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                  <div className="absolute -top-20 -right-10 w-60 h-60 rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.07)_0%,transparent_70%)]" />
                </div>

                {/* Panel header */}
                <div className="relative p-4 border-b border-[rgba(99,130,220,0.1)] flex items-center justify-between z-10">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-[rgba(99,102,241,0.15)] border border-[rgba(99,102,241,0.25)] flex items-center justify-center">
                      <Users className="w-3.5 h-3.5 text-indigo-400" />
                    </div>
                    <h2 className="text-sm font-semibold text-white tracking-tight">Candidates</h2>
                    {/* Animated count */}
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={activeCandidates.length}
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.6 }}
                        transition={{ duration: 0.2, ease: "backOut" }}
                        className="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full text-[10px] font-bold bg-[rgba(99,102,241,0.2)] text-indigo-300 border border-[rgba(99,102,241,0.3)]"
                      >
                        {activeCandidates.length}
                      </motion.span>
                    </AnimatePresence>
                    {viewedCandidatesIndex !== null && (
                      <span className="text-[9px] uppercase font-bold text-[#7A92B8] bg-[rgba(255,255,255,0.05)] px-2 py-0.5 rounded-md border border-[rgba(99,130,220,0.1)] tracking-wider">
                        Past
                      </span>
                    )}
                  </div>
                </div>

                {/* Candidates list */}
                <div className="flex-1 overflow-y-auto no-scrollbar p-3 relative z-10">
                  <CandidateList candidates={activeCandidates} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
