"use client";

import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@/hooks/useQuery';
import { useSessions } from '@/hooks/useSessions';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { QueryInput } from '@/components/QueryInput';
import { CandidateList } from '@/components/CandidateList';
import { MessageSquare, Plus, Menu, X, HelpCircle, ChevronRight, Building, Sparkles, Trash2, User, Loader2, Moon, Sun, LogIn, LogOut, AlertCircle } from 'lucide-react';

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

  const loadSessionHistory = async (sessionId: string) => {
    resetQueryState();
    const sessionDetails = await loadSession(sessionId);
    if (sessionDetails?.messages) {
       setInitialHistoryFromMessages(sessionDetails.messages);
    }
  };

  useEffect(() => {
     const init = async () => {
       if (!accessToken) return;
       const fetched = await loadSessionsList();
       if (fetched && fetched.length > 0) {
          await loadSessionHistory(fetched[0].sessionId);
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
    <div className="flex h-screen bg-slate-50 dark:bg-[#0B0E14] overflow-hidden relative transition-colors duration-300">
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Sessions */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white/90 dark:bg-[#0B0E14]/90 backdrop-blur-2xl border-r border-gray-200 dark:border-white/5 flex flex-col transform transition-all duration-300 ease-in-out
        md:relative md:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-4 border-b border-gray-200 dark:border-white/5 flex items-center justify-between">
          <button 
            suppressHydrationWarning
            onClick={() => {
              loadSession('default');
              resetQueryState();
              if (window.innerWidth < 768) setIsSidebarOpen(false);
            }}
            className="flex-1 flex flex-col sm:flex-row items-center justify-center gap-2 bg-gray-900 dark:bg-slate-800 hover:bg-gray-800 dark:hover:bg-slate-700 text-white dark:text-gray-100 py-2.5 px-4 rounded-xl font-semibold transition-all shadow-sm active:scale-95 border border-transparent dark:border-white/10"
          >
            <Plus className="w-5 h-5 flex-shrink-0" />
            <span className="whitespace-nowrap">New Search</span>
          </button>
          
          <button 
             onClick={() => setIsSidebarOpen(false)}
             className="ml-2 p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-md md:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-2 relative group-container">
          {sessions.map(session => (
            <div key={session.sessionId} className="relative group">
               <button
                 suppressHydrationWarning
                 onClick={async () => {
                   await loadSessionHistory(session.sessionId);
                   if (window.innerWidth < 768) setIsSidebarOpen(false);
                 }}
                 className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between gap-3 transition-all duration-300 ${
                   currentSessionId === session.sessionId
                     ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-semibold shadow-sm' 
                     : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'
                 }`}
               >
                 <div className="flex items-center gap-3 overflow-hidden">
                    <MessageSquare className={`w-4 h-4 flex-shrink-0 ${currentSessionId === session.sessionId ? 'text-indigo-500' : 'text-gray-400'}`} />
                    <span className="truncate text-sm">{session.title}</span>
                 </div>
               </button>
               {session.sessionId !== 'default' && (
                  <button 
                     onClick={(e) => handleDeleteSession(e, session.sessionId)}
                     className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded opacity-0 group-hover:opacity-100 transition-all"
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
        <header className="bg-white/80 dark:bg-[#0B0E14]/80 backdrop-blur-xl border-b border-gray-200 dark:border-white/5 p-4 flex items-center justify-between flex-shrink-0 z-10 transition-colors duration-300">
          <div className="flex items-center gap-2 sm:gap-3">
             <button 
               onClick={toggleSidebar}
               className="md:hidden p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors"
             >
                <Menu className="w-5 h-5" />
             </button>
             <h1 className="text-lg sm:text-xl font-bold tracking-tight text-gray-900 dark:text-white truncate flex items-center gap-2">
                Candidate Search Agent
             </h1>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <button 
                suppressHydrationWarning
                onClick={toggleTheme}
                className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors"
                title="Toggle Theme"
            >
               {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <div className="h-6 w-px bg-gray-200 dark:bg-slate-700 hidden sm:block"></div>
            <div className="flex flex-row items-center gap-2">
               <div className="w-8 h-8 flex-shrink-0 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-400 rounded-full flex items-center justify-center font-bold text-sm" title={orgName || 'Building'}>
                 <Building className="w-4 h-4" />
               </div>
               <div className="hidden sm:flex flex-col">
                 <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                   {user?.email || 'Not signed in'}
                 </span>
                 {orgName && (
                   <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                     {orgName}
                   </span>
                 )}
               </div>
            </div>
            {session && (
              <button
                onClick={handleSignOut}
                className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors"
                title="Sign out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden w-full">
          {/* Chat Panel */}
          <div className="flex-1 flex flex-col h-full overflow-hidden relative border-r border-gray-200 dark:border-white/5">
            {/* Scrollable Content Area (History & Results) */}
            <main className="flex-1 overflow-y-auto no-scrollbar p-4 md:p-8 pb-32">
              <div className="max-w-5xl mx-auto pb-6">
            
            {/* Introductory Text if no message logs exist */}
            {!session && !authLoading && (
              <div className="mb-8 mt-6 sm:mt-10 animate-in fade-in max-w-md mx-auto">
                <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
                      <LogIn className="w-5 h-5 text-gray-900 dark:text-white" />
                    </div>
                    <div>
                      <h2 className="font-bold text-gray-900 dark:text-white">Sign in with Supabase</h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Uses the real JWT flow for /api/*.</p>
                    </div>
                  </div>
                  <form onSubmit={handleSignIn} className="space-y-3">
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="Email"
                      className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-indigo-400"
                    />
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Password"
                      className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-indigo-400"
                    />
                    {authError && (
                      <div className="flex gap-2 rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>{authError}</span>
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={signingIn || authLoading || !email || !password}
                      className="w-full rounded-xl bg-gray-900 dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2"
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
                <div className="w-16 h-16 bg-gray-100 dark:bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-gray-200 dark:border-white/10 shadow-sm">
                   <Sparkles className="w-8 h-8 text-gray-900 dark:text-white" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3">Company Candidate Database</h2>
                <p className="text-gray-500 dark:text-gray-400 max-w-xl mx-auto text-sm sm:text-base mb-8">
                  Search through your organization&apos;s internal candidate pool using natural language. Query by specific roles, vessel experience, availability, or status.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto text-left">
                   <div className="bg-white dark:bg-white/[0.02] dark:backdrop-blur-md p-4 rounded-xl border border-gray-200 dark:border-white/5 shadow-sm hover:shadow-md transition-shadow">
                      <p className="text-sm text-gray-600 dark:text-slate-300">&quot;Find me a Master with VLCC experience ready to join next month&quot;</p>
                   </div>
                   <div className="bg-white dark:bg-white/[0.02] dark:backdrop-blur-md p-4 rounded-xl border border-gray-200 dark:border-white/5 shadow-sm hover:shadow-md transition-shadow">
                      <p className="text-sm text-gray-600 dark:text-slate-300">&quot;Show me Chief Officers currently available for Aframax&quot;</p>
                   </div>
                </div>
              </div>
            )}

            {/* Conversation History Log (Maps all user inquiries and agent responses structurally top-to-bottom) */}
            {conversationHistory.map((msg, i) => (
               <div key={i} className="mb-6 animate-in slide-in-from-bottom-2 fade-in">
                 
                 {msg.type === 'user' ? (
                   <div className="flex gap-4 max-w-4xl justify-end ml-auto">
                      <div className="bg-gray-900 dark:bg-slate-800 text-white dark:text-gray-100 border border-transparent dark:border-white/10 shadow-sm rounded-2xl rounded-tr-none px-5 py-3 text-sm font-medium">
                          <p>{msg.text}</p>
                      </div>
                      <div className="w-8 h-8 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-white/10 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                         <User className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                      </div>
                   </div>
                 ) : (
                   /* Agent Response Turn Block */
                   <div className="flex flex-col gap-4">
                      
                      {/* Agent Clarification Asking Flow */}
                      {msg.clarification && (
                         <div className="flex gap-4 max-w-4xl w-full">
                            <div className="w-8 h-8 bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                               <HelpCircle className="w-4 h-4 text-gray-900 dark:text-white" />
                            </div>
                            <div className="bg-white dark:bg-white/[0.02] dark:backdrop-blur-md border border-gray-200 dark:border-white/10 shadow-sm rounded-2xl rounded-tl-none p-5 flex-1">
                               <p className="text-gray-800 dark:text-white font-medium mb-4">{msg.clarification.question}</p>
                               
                               {msg.clarification.options && msg.clarification.options.length > 0 ? (
                                 <div className="flex flex-wrap gap-2">
                                    {msg.clarification.options.map((opt, i) => (
                                       <button 
                                         key={i}
                                         onClick={() => handleClarification(opt)}
                                         className="px-4 py-2 bg-blue-50 dark:bg-slate-700 border border-blue-200 dark:border-slate-600 rounded-full text-blue-700 dark:text-blue-300 text-sm font-medium hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 transition-colors"
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
                                   <input type="text" name="clarify" placeholder="Type clarification..." className="flex-1 px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-600 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 bg-gray-50 dark:bg-slate-900 dark:text-white" />
                                   <button type="submit" className="px-5 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">Reply</button>
                                 </form>
                               )}
                            </div>
                         </div>
                      )}

                      {/* Ordinary text Agent Response bubble */}
                      {msg.text && (
                         <div className="flex gap-4 max-w-4xl w-full">
                            <div className="w-8 h-8 bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/10 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                               <Sparkles className="w-4 h-4 text-gray-900 dark:text-gray-300" />
                            </div>
                            <div className="flex flex-col gap-2 w-full">
                               <div className="bg-white dark:bg-white/[0.03] dark:backdrop-blur-md border border-gray-200 dark:border-white/10 shadow-sm rounded-2xl rounded-tl-none p-5 text-gray-800 dark:text-slate-300 w-full overflow-hidden text-[13px] sm:text-sm leading-relaxed">
                                   {formatAgentText(msg.text)}
                               </div>
                               
                               {/* Inline candidate badge linking to the sidebar */}
                               {msg.candidates && msg.candidates.length > 0 && (
                                  <button 
                                     onClick={() => setViewedCandidatesIndex(i)}
                                     className={`rounded-xl p-3 flex items-center justify-between shadow-sm max-w-[200px] w-full transition-all group mt-1 border ${
                                       msg.candidates === activeCandidates 
                                       ? 'bg-indigo-50/80 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30'
                                       : 'bg-white/80 dark:bg-white/[0.02] border-gray-200 dark:border-white/5 hover:border-indigo-200 dark:hover:border-indigo-500/30 hover:bg-indigo-50 dark:hover:bg-indigo-500/10'
                                     }`}
                                  >
                                     <div className={`flex items-center gap-3 text-sm font-semibold transition-colors ${
                                       msg.candidates === activeCandidates
                                       ? 'text-blue-700 dark:text-blue-400'
                                       : 'text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400'
                                     }`}>
                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                                          msg.candidates === activeCandidates
                                          ? 'bg-blue-200 dark:bg-blue-800/50'
                                          : 'bg-gray-100 dark:bg-slate-700 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50'
                                        }`}>
                                           <User className={`w-3.5 h-3.5 transition-colors ${
                                              msg.candidates === activeCandidates
                                              ? 'text-blue-700 dark:text-blue-300'
                                              : 'text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400'
                                           }`} />
                                        </div>
                                        <span>{msg.candidates.length} candidates</span>
                                     </div>
                                     <ChevronRight className={`w-4 h-4 transition-all ${
                                        msg.candidates === activeCandidates
                                        ? 'text-blue-500'
                                        : 'text-gray-400 group-hover:text-blue-500 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0'
                                     }`} />
                                  </button>
                               )}
                            </div>
                         </div>
                      )}

                   </div>
                 )}
               </div>
            ))}

            {/* Agent Live SSE Streaming Progress Bubble pinned to end of conversation */}
            {loading && loadingProgress && (
               <div className="mb-8 animate-in slide-in-from-bottom-2 fade-in">
                 <div className="flex gap-4 max-w-3xl">
                    <div className="w-8 h-8 bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/10 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                       <Loader2 className="w-4 h-4 text-gray-900 dark:text-gray-300 animate-spin" />
                    </div>
                    <div className="bg-white dark:bg-white/[0.03] dark:backdrop-blur-md border border-gray-200 dark:border-white/10 shadow-sm rounded-2xl rounded-tl-none p-4 text-gray-600 dark:text-slate-300 flex items-center gap-2">
                        <span className="font-medium text-sm text-gray-900 dark:text-slate-200">Agent thinking:</span>
                        <span className="text-sm animate-pulse">{loadingProgress}</span>
                    </div>
                 </div>
               </div>
            )}

                <div ref={bottomRef} className="h-10"></div>
              </div>
            </main>

            {/* Bottom Input Area Floating style */}
            <div className="absolute bottom-0 left-0 w-full p-4 sm:p-6 bg-gradient-to-t from-slate-50 via-slate-50/90 to-transparent dark:from-[#0B0E14] dark:via-[#0B0E14]/90 pointer-events-none z-20">
              <div className="max-w-5xl mx-auto pointer-events-auto">
                 <div className="shadow-2xl rounded-full">
                   <QueryInput 
                     onSearch={handleSearch} 
                     loading={loading || !session} 
                   />
                 </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Latest Candidates */}
          {activeCandidates && activeCandidates.length > 0 && (
            <div className="hidden lg:flex w-[26rem] flex-col h-full bg-slate-50/30 dark:bg-[#0B0E14]/30 border-l border-gray-200/50 dark:border-white/5 overflow-hidden">
               <div className="p-5 border-b border-gray-200/50 dark:border-white/5 bg-white/60 dark:bg-[#0B0E14]/60 backdrop-blur-md z-10 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2 tracking-tight">
                     <User className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                     Candidates ({activeCandidates.length})
                     {viewedCandidatesIndex !== null && (
                        <span className="ml-2 text-[10px] uppercase font-bold text-gray-600 dark:text-gray-300 bg-gray-200/50 dark:bg-white/10 px-2 py-0.5 rounded border border-gray-300 dark:border-white/10">Viewing Past</span>
                     )}
                  </h2>
               </div>
               <div className="flex-1 overflow-y-auto no-scrollbar p-3">
                  <CandidateList candidates={activeCandidates} />
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
