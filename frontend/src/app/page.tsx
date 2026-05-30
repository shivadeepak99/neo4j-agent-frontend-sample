"use client";

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@/hooks/useQuery';
import { useSessions } from '@/hooks/useSessions';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { QueryInput } from '@/components/QueryInput';
import { CandidateList } from '@/components/CandidateList';
import type { ChatMessage } from '@/lib/api-types';
import { MessageSquare, Plus, Menu, X, HelpCircle, ChevronRight, Building, Trash2, User, Loader2, Moon, Sun, LogIn, LogOut, AlertCircle } from 'lucide-react';

export default function Dashboard() {
  const { session, user, orgName, loading: authLoading, authError, accessToken, signIn, signOut } = useSupabaseAuth();
  const { sessions, currentSessionId, createSession, loadSession, loadSessionsList, deleteSession } = useSessions(accessToken);
  const { conversationHistory, loading, loadingProgress, sendQuery, lastQuery, resetQueryState, setInitialHistoryFromMessages } = useQuery(accessToken);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [viewedCandidatesIndex, setViewedCandidatesIndex] = useState<number | null>(null);
  const [email, setEmail] = useState('org1@gmail.com');
  const [password, setPassword] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  
  // Ref for auto-scrolling to bottom when messages change
  const bottomRef = useRef<HTMLDivElement>(null);

   const readCachedMessages = (sessionId: string) => {
      try {
         const raw = localStorage.getItem(`session-cache:${sessionId}`);
         if (!raw) return null;
         const parsed = JSON.parse(raw) as ChatMessage[];
         return Array.isArray(parsed) ? parsed : null;
      } catch {
         return null;
      }
   };

   const writeCachedMessages = (sessionId: string, messages: ChatMessage[]) => {
      try {
         localStorage.setItem(`session-cache:${sessionId}`, JSON.stringify(messages));
      } catch {
         // Ignore cache errors (storage full, blocked, etc.)
      }
   };

   const loadSessionHistory = async (sessionId: string, cachedMessages?: ChatMessage[] | null) => {
    resetQueryState();
      if (cachedMessages && cachedMessages.length > 0) {
          setInitialHistoryFromMessages(cachedMessages);
      }
    const sessionDetails = await loadSession(sessionId);
    if (sessionDetails?.messages) {
       setInitialHistoryFromMessages(sessionDetails.messages);
          writeCachedMessages(sessionId, sessionDetails.messages);
    }
  };

  useEffect(() => {
   const init = async () => {
       if (!accessToken) return;
       const fetched = await loadSessionsList();
       if (fetched && fetched.length > 0) {
      const firstSessionId = fetched[0].sessionId;
      const cachedMessages = readCachedMessages(firstSessionId);
      await loadSessionHistory(firstSessionId, cachedMessages);
       }
     };
     init();
     
     // Initialize dark mode class on document body
     if (isDarkMode) {
        document.documentElement.classList.add('dark');
     }
  }, [accessToken]);

  // Sync dark mode state with Tailwind class
  useEffect(() => {
     if (isDarkMode) {
        document.documentElement.classList.add('dark');
     } else {
        document.documentElement.classList.remove('dark');
     }
  }, [isDarkMode]);

  useEffect(() => {
     if (bottomRef.current) {
        bottomRef.current.scrollIntoView({ behavior: 'smooth' });
     }
  }, [loading, loadingProgress, conversationHistory.length]);

  const handleSearch = async (query: string) => {
    if (!accessToken) return;
    setViewedCandidatesIndex(null);
    let activeSessionId = currentSessionId;
    if (activeSessionId === 'default') {
       activeSessionId = await createSession(query.substring(0, 30));
    }
    sendQuery(query, activeSessionId);
  };

  const handleClarification = async (answer: string) => {
     if (!accessToken) return;
     let activeSessionId = currentSessionId;
     if (activeSessionId === 'default') {
        const titleSource = lastQuery ? lastQuery : answer;
        activeSessionId = await createSession(titleSource.substring(0, 30));
     }
     if (lastQuery) {
        sendQuery(lastQuery, activeSessionId, answer);
     }
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const toggleTheme = () => {
     setIsDarkMode(!isDarkMode);
  };

  const latestCandidates = conversationHistory.slice().reverse().find(msg => msg.candidates && msg.candidates.length > 0)?.candidates;
  
  // Determine which candidates are currently populating the right sidebar
  const activeCandidates = viewedCandidatesIndex !== null 
     ? conversationHistory[viewedCandidatesIndex]?.candidates 
     : latestCandidates;

  const formatAgentText = (text: string) => {
    return text.split('\n').map((line, i) => {
       if (!line.trim()) return <span key={i} className="block h-2"></span>;
       const parts = line.split(/\*\*(.*?)\*\*/g);
       return (
          <span key={i} className="block mb-1">
             {parts.map((part, j) => 
                j % 2 === 1 ? <strong key={j} className="font-semibold text-gray-900 dark:text-white">{part}</strong> : part
             )}
          </span>
       );
    });
  };

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
     e.stopPropagation();
     await deleteSession(sessionId);
     if (currentSessionId === sessionId) {
        resetQueryState();
     }
  };

  const handleSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
     event.preventDefault();
     setSigningIn(true);
     const ok = await signIn(email.trim(), password);
     setSigningIn(false);
     if (ok) {
        setPassword('');
        resetQueryState();
     }
  };

  const handleSignOut = async () => {
     await signOut();
     resetQueryState();
  };

   return (
      <div className="flex h-screen overflow-hidden relative bg-slate-50 dark:bg-[#0B111A] text-slate-900 dark:text-slate-100 transition-colors duration-300">
         <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(1200px_circle_at_12%_-10%,#dbeafe_0,transparent_55%),radial-gradient(900px_circle_at_100%_0%,#e2e8f0_0,transparent_45%)] dark:bg-[radial-gradient(900px_circle_at_10%_-20%,#1f2a44_0,transparent_55%),radial-gradient(700px_circle_at_100%_0%,#111827_0,transparent_45%)]"
         />
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Sessions */}
         <div className={`
            fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-[#0C1420] border-r border-slate-200/80 dark:border-white/10 flex flex-col transform transition-all duration-300 ease-in-out
        md:relative md:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
            <div className="p-4 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between">
          <button 
            suppressHydrationWarning
            onClick={() => {
              loadSession('default');
              resetQueryState();
              if (window.innerWidth < 768) setIsSidebarOpen(false);
            }}
                  className="flex-1 flex flex-col sm:flex-row items-center justify-center gap-2 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white dark:text-slate-100 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all shadow-sm active:scale-95 border border-transparent dark:border-white/10"
          >
            <Plus className="w-5 h-5 flex-shrink-0" />
                  <span className="whitespace-nowrap">New Session</span>
          </button>
          
          <button 
             onClick={() => setIsSidebarOpen(false)}
                   className="ml-2 p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md md:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
            <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-2 relative">
          {sessions.map(session => (
            <div key={session.sessionId} className="relative group">
               <button
                 suppressHydrationWarning
                         onClick={async () => {
                            const cachedMessages = readCachedMessages(session.sessionId);
                            await loadSessionHistory(session.sessionId, cachedMessages);
                   if (window.innerWidth < 768) setIsSidebarOpen(false);
                 }}
                         className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between gap-3 transition-all duration-200 ${
                   currentSessionId === session.sessionId
                               ? 'bg-slate-100 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 font-semibold'
                               : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                 }`}
               >
                 <div className="flex items-center gap-3 overflow-hidden">
                              <MessageSquare className={`w-4 h-4 flex-shrink-0 ${currentSessionId === session.sessionId ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}`} />
                    <span className="truncate text-sm">{session.title}</span>
                 </div>
               </button>
               {session.sessionId !== 'default' && (
                  <button 
                     onClick={(e) => handleDeleteSession(e, session.sessionId)}
                               className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded opacity-0 group-hover:opacity-100 transition-all"
                  >
                     <Trash2 className="w-3.5 h-3.5" />
                  </button>
               )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden w-full md:w-auto">
        {/* Header */}
            <header className="bg-white dark:bg-[#0C1420] border-b border-slate-200/80 dark:border-white/10 p-4 flex items-center justify-between flex-shrink-0 z-10 transition-colors duration-300">
          <div className="flex items-center gap-2 sm:gap-3">
             <button 
               onClick={toggleSidebar}
                      className="md:hidden p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 rounded-md transition-colors"
             >
                <Menu className="w-5 h-5" />
             </button>
                   <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-slate-900 dark:text-white truncate flex items-center gap-2">
                        Candidate Search Console
             </h1>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <button 
                suppressHydrationWarning
                onClick={toggleTheme}
                        className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 rounded-md transition-colors"
                title="Toggle Theme"
            >
               {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
                  <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
            <div className="flex flex-row items-center gap-2">
                      <div className="w-8 h-8 flex-shrink-0 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md flex items-center justify-center font-semibold text-sm" title={orgName || 'Organization'}>
                 <Building className="w-4 h-4" />
               </div>
               <div className="hidden sm:flex flex-col">
                         <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                   {user?.email || 'Not signed in'}
                 </span>
                 {orgName && (
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                     {orgName}
                   </span>
                 )}
               </div>
            </div>
            {session && (
              <button
                onClick={handleSignOut}
                        className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 rounded-md transition-colors"
                title="Sign out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden w-full">
          {/* Chat Panel */}
               <div className="flex-1 flex flex-col h-full overflow-hidden relative border-r border-slate-200/80 dark:border-white/10">
            {/* Scrollable Content Area (History & Results) */}
            <main className="flex-1 overflow-y-auto no-scrollbar p-4 md:p-8 pb-32">
              <div className="max-w-5xl mx-auto pb-6">
            
            {/* Introductory Text if no message logs exist */}
                  {!session && !authLoading && (
                     <div className="mb-8 mt-6 sm:mt-10 animate-in fade-in max-w-md mx-auto">
                        <div className="bg-white dark:bg-[#0F1724] border border-slate-200 dark:border-white/10 rounded-xl p-5 shadow-sm">
                           <div className="flex items-center gap-3 mb-4">
                              <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                 <LogIn className="w-5 h-5 text-slate-900 dark:text-white" />
                              </div>
                              <div>
                                 <h2 className="font-semibold text-slate-900 dark:text-white">Sign in to continue</h2>
                                 <p className="text-xs text-slate-500 dark:text-slate-400">Use your organization credentials to access search.</p>
                              </div>
                           </div>
                           <form onSubmit={handleSignIn} className="space-y-3">
                              <input
                                 type="email"
                                 value={email}
                                 onChange={(event) => setEmail(event.target.value)}
                                 placeholder="Email"
                                 className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-slate-400"
                              />
                              <input
                                 type="password"
                                 value={password}
                                 onChange={(event) => setPassword(event.target.value)}
                                 placeholder="Password"
                                 className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-slate-400"
                              />
                              {authError && (
                                 <div className="flex gap-2 rounded-lg border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                    <span>{authError}</span>
                                 </div>
                              )}
                              <button
                                 type="submit"
                                 disabled={signingIn || authLoading || !email || !password}
                                 className="w-full rounded-lg bg-slate-900 dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2"
                              >
                                 {signingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                                 Sign in
                              </button>
                           </form>
                        </div>
                     </div>
                  )}

            {conversationHistory.length === 0 && !loading && (
              <div className={`mb-8 text-center mt-6 sm:mt-10 animate-in fade-in ${!session ? 'opacity-40' : ''}`}>
                <div className="w-16 h-16 bg-white dark:bg-[#0F1724] rounded-xl flex items-center justify-center mx-auto mb-6 border border-slate-200 dark:border-white/10 shadow-sm">
                   <MessageSquare className="w-7 h-7 text-slate-700 dark:text-slate-200" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white mb-3">Candidate Search Workspace</h2>
                <p className="text-slate-500 dark:text-slate-400 max-w-xl mx-auto text-sm sm:text-base mb-8">
                  Use natural language to filter candidates by role, vessel experience, availability, or compliance status.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto text-left">
                   <div className="bg-white dark:bg-[#0F1724] p-4 rounded-lg border border-slate-200 dark:border-white/10 shadow-sm">
                      <p className="text-sm text-slate-600 dark:text-slate-300">"Find a Master with VLCC experience available next month"</p>
                   </div>
                   <div className="bg-white dark:bg-[#0F1724] p-4 rounded-lg border border-slate-200 dark:border-white/10 shadow-sm">
                      <p className="text-sm text-slate-600 dark:text-slate-300">"Show Chief Officers currently available for Aframax"</p>
                   </div>
                </div>
              </div>
            )}

            {/* Conversation History */}
            {conversationHistory.map((msg, i) => {
               const isStreaming = loading && i === conversationHistory.length - 1 && msg.type === 'agent';
               return (
               <motion.div
                 key={i}
                 initial={{ opacity: 0, y: 16 }}
                 animate={{ opacity: 1, y: 0 }}
                 transition={{ duration: 0.3, ease: 'easeOut' }}
                 className="mb-6"
               >
                 {msg.type === 'user' ? (
                   <div className="flex gap-4 max-w-4xl justify-end ml-auto">
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, x: 12 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        transition={{ duration: 0.25, ease: 'easeOut' }}
                        className="bg-slate-900 dark:bg-slate-800 text-white dark:text-slate-100 border border-transparent dark:border-white/10 shadow-sm rounded-xl rounded-tr-none px-5 py-3 text-sm font-medium"
                      >
                          <p>{msg.text}</p>
                      </motion.div>
                      <div className="w-8 h-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                         <User className="w-4 h-4 text-slate-500 dark:text-slate-300" />
                      </div>
                   </div>
                 ) : (
                   /* Agent Response Turn Block */
                   <div className="flex flex-col gap-4">
                      
                      {/* Agent Clarification Asking Flow */}
                      {msg.clarification && (
                         <div className="flex gap-4 max-w-4xl w-full">
                            <div className="w-8 h-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                               <HelpCircle className="w-4 h-4 text-slate-700 dark:text-white" />
                            </div>
                            <div className="bg-white dark:bg-[#0F1724] border border-slate-200 dark:border-white/10 shadow-sm rounded-xl rounded-tl-none p-5 flex-1">
                               <p className="text-slate-800 dark:text-white font-medium mb-4">{msg.clarification.question}</p>
                               
                               {msg.clarification.options && msg.clarification.options.length > 0 ? (
                                 <div className="flex flex-wrap gap-2">
                                    {msg.clarification.options.map((opt, i) => (
                                       <button 
                                         key={i}
                                         onClick={() => handleClarification(opt)}
                                         className="px-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-full text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                       >
                                          {opt}
                                       </button>
                                    ))}
                                 </div>
                               ) : (
                                 <form onSubmit={(e) => {
                                    e.preventDefault();
                                    const val = new FormData(e.currentTarget).get("clarify") as string;
                                    if (val.trim()) handleClarification(val);
                                 }} className="flex gap-2 mt-2">
                                   <input type="text" name="clarify" placeholder="Type clarification..." className="flex-1 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-200 bg-white dark:bg-slate-900 dark:text-white" />
                                   <button type="submit" className="px-5 py-2 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors">Reply</button>
                                 </form>
                               )}
                            </div>
                         </div>
                      )}

                      {/* Ordinary text Agent Response bubble */}
                      {msg.text && (
                         <div className="flex gap-4 max-w-4xl w-full">
                            <div className="w-8 h-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                               <MessageSquare className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                            </div>
                            <div className="flex flex-col gap-2 w-full">
                               <motion.div
                                 initial={{ opacity: 0, y: 8 }}
                                 animate={{ opacity: 1, y: 0 }}
                                 transition={{ duration: 0.3, ease: 'easeOut' }}
                                 className="bg-white dark:bg-[#0F1724] border border-slate-200 dark:border-white/10 shadow-sm rounded-xl rounded-tl-none p-5 text-slate-800 dark:text-slate-300 w-full overflow-hidden text-[13px] sm:text-sm leading-relaxed"
                               >
                                   {formatAgentText(msg.text)}
                                   {/* Blinking cursor while this message is still streaming */}
                                   {isStreaming && (
                                     <motion.span
                                       className="inline-block w-0.5 h-3.5 bg-blue-400 dark:bg-blue-500 ml-0.5 align-middle rounded-sm"
                                       animate={{ opacity: [1, 0, 1] }}
                                       transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
                                     />
                                   )}
                               </motion.div>
                               
                               {/* Inline candidate badge linking to the sidebar */}
                               {msg.candidates && msg.candidates.length > 0 && (
                                  <button 
                                     onClick={() => setViewedCandidatesIndex(i)}
                                     className={`rounded-lg p-3 flex items-center justify-between shadow-sm max-w-[220px] w-full transition-all group mt-1 border ${
                                       msg.candidates === activeCandidates 
                                       ? 'bg-slate-100 dark:bg-slate-800/60 border-slate-200 dark:border-slate-600'
                                       : 'bg-white dark:bg-[#0F1724] border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-slate-600'
                                     }`}
                                  >
                                     <div className={`flex items-center gap-3 text-sm font-semibold transition-colors ${
                                       msg.candidates === activeCandidates
                                       ? 'text-slate-800 dark:text-slate-100'
                                       : 'text-slate-700 dark:text-slate-300'
                                     }`}>
                                        <div className="w-7 h-7 rounded-md flex items-center justify-center bg-slate-100 dark:bg-slate-800">
                                           <User className="w-3.5 h-3.5 text-slate-500 dark:text-slate-300" />
                                        </div>
                                        <span>{msg.candidates.length} candidates</span>
                                     </div>
                                     <ChevronRight className={`w-4 h-4 transition-all ${
                                        msg.candidates === activeCandidates
                                        ? 'text-slate-600'
                                        : 'text-slate-400 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0'
                                     }`} />
                                  </button>
                               )}
                            </div>
                         </div>
                      )}

                   </div>
                 )}
               </motion.div>
               );
            })}

            {/* Agent Live SSE Streaming Progress Bubble — label crossfades on every node update */}
            <AnimatePresence>
            {loading && loadingProgress && (
               <motion.div
                 key="progress-bubble"
                 initial={{ opacity: 0, y: 12 }}
                 animate={{ opacity: 1, y: 0 }}
                 exit={{ opacity: 0, y: -8 }}
                 transition={{ duration: 0.25, ease: 'easeOut' }}
                 className="mb-8"
               >
                 <div className="flex gap-4 max-w-3xl">
                    <div className="w-8 h-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                       <Loader2 className="w-4 h-4 text-slate-500 dark:text-slate-400 animate-spin" />
                    </div>
                    <div className="bg-white dark:bg-[#0F1724] border border-slate-200 dark:border-white/10 shadow-sm rounded-xl rounded-tl-none px-4 py-3 flex items-center gap-2.5 overflow-hidden">
                       {/* Animated dot row */}
                       <div className="flex gap-1 flex-shrink-0">
                         {[0,1,2].map(i => (
                           <motion.div
                             key={i}
                             className="w-1.5 h-1.5 rounded-full bg-blue-400 dark:bg-blue-500"
                             animate={{ y: [0, -4, 0] }}
                             transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
                           />
                         ))}
                       </div>
                       {/* Label crossfades on each node completion */}
                       <AnimatePresence mode="wait">
                         <motion.span
                           key={loadingProgress}
                           initial={{ opacity: 0, x: 6 }}
                           animate={{ opacity: 1, x: 0 }}
                           exit={{ opacity: 0, x: -6 }}
                           transition={{ duration: 0.18, ease: 'easeOut' }}
                           className="text-sm text-slate-600 dark:text-slate-300"
                         >
                           {loadingProgress}
                         </motion.span>
                       </AnimatePresence>
                    </div>
                 </div>
               </motion.div>
            )}
            </AnimatePresence>

                <div ref={bottomRef} className="h-10"></div>
              </div>
            </main>

            {/* Bottom Input Area Floating style */}
                  <div className="absolute bottom-0 left-0 w-full p-4 sm:p-6 bg-gradient-to-t from-slate-50 via-slate-50/95 to-transparent dark:from-[#0B111A] dark:via-[#0B111A]/95 pointer-events-none z-20">
              <div className="max-w-5xl mx-auto pointer-events-auto">
                         <div className="shadow-xl rounded-lg">
                   <QueryInput 
                     onSearch={handleSearch} 
                     loading={loading || !session} 
                   />
                 </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Latest Candidates — slides in/out from the right */}
          <AnimatePresence>
          {activeCandidates && activeCandidates.length > 0 && (
            <motion.div
              key="candidate-panel"
              initial={{ x: 420, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 420, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32, mass: 0.9 }}
              className="hidden lg:flex w-[26rem] flex-col h-full bg-white dark:bg-[#0C1420] border-l border-slate-200/80 dark:border-white/10 overflow-hidden flex-shrink-0"
            >
               {/* Header with animated count badge */}
               <div className="p-5 border-b border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#0C1420] z-10 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2 tracking-tight">
                     <User className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                     Candidates
                     {/* Animated count badge */}
                     <AnimatePresence mode="wait">
                       <motion.span
                         key={activeCandidates.length}
                         initial={{ opacity: 0, scale: 0.7 }}
                         animate={{ opacity: 1, scale: 1 }}
                         exit={{ opacity: 0, scale: 0.7 }}
                         transition={{ duration: 0.2, ease: 'backOut' }}
                         className="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                       >
                         {activeCandidates.length}
                       </motion.span>
                     </AnimatePresence>
                     {viewedCandidatesIndex !== null && (
                        <span className="ml-1 text-[10px] uppercase font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/10 px-2 py-0.5 rounded border border-slate-200 dark:border-white/10">Past</span>
                     )}
                  </h2>
               </div>
               <div className="flex-1 overflow-y-auto no-scrollbar p-3">
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
