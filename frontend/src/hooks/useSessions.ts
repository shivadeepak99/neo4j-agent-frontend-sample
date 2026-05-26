import { useState } from 'react';
import type { ApiSession, Session, SessionDetail } from '@/lib/api-types';
import { apiFetch } from '@/lib/api-client';

const defaultSession = (): Session => ({
  sessionId: 'default',
  title: 'New Search',
  createdAt: new Date().toISOString(),
});

const toSession = (session: ApiSession): Session => ({
  sessionId: session.id,
  title: session.title || 'New Search',
  createdAt: session.createdAt,
  updatedAt: session.updatedAt,
});

export function useSessions(accessToken: string | null) {
  const [sessions, setSessions] = useState<Session[]>([defaultSession()]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('default');

  const setActiveSession = (id: string) => {
     setCurrentSessionId(id);
  };

  const createSession = async (title?: string) => {
    if (!accessToken) return 'default';
    const sessionTitle = title || 'New Search';
    try {
      const response = await apiFetch('/api/sessions', accessToken, {
         method: 'POST',
         body: JSON.stringify({ title: sessionTitle })
      });

      const newSession = toSession(response.session);
      
      setSessions(prev => {
         if (prev.some(s => s.sessionId === newSession.sessionId)) return prev;
         return [newSession, ...prev]; // Push newest session up top
      });
      setActiveSession(newSession.sessionId);
      return newSession.sessionId;
    } catch (e) {
      console.error("Failed to create session against backend", e);
      return 'default';
    }
  };

  const loadSession = async (sessionId: string) => {
    setActiveSession(sessionId);
    if (sessionId === 'default') return null;
    if (!accessToken) return null;

    try {
       const response = await apiFetch(`/api/sessions/${sessionId}`, accessToken);
       const sessionDetail = response as SessionDetail;
       
       setSessions(prev => prev.map(s => 
          s.sessionId === sessionId 
            ? { ...s, title: sessionDetail.session?.title || s.title }
            : s
        ));
        
       return sessionDetail;
    } catch (e) {
       console.error(`Failed to load history for ${sessionId}`, e);
       return null;
    }
  };

  const loadSessionsList = async () => {
     if (!accessToken) {
       setSessions([defaultSession()]);
       setCurrentSessionId('default');
       return [];
     }
     try {
       const response = await apiFetch('/api/sessions', accessToken);
       
       if (response.sessions && Array.isArray(response.sessions)) {
          const formattedSessions = response.sessions.map(toSession);
          
          const validFetched = formattedSessions.filter((s: Session) => s.sessionId && s.sessionId !== 'default');
          
          setSessions([
            defaultSession(),
            ...validFetched
          ]);
          
          // Return valid fetched sessions so the caller can auto-load the most recent one
          return validFetched;
       }
     } catch (e) {
        console.error("Failed to load sessions list mapping via API.", e);
        // Fallback or do nothing if disconnected
     }
     return [];
  };

  const resetSessionFilter = async (sessionId: string) => {
    return sessionId === 'default';
  }

  const deleteSession = async (sessionId: string) => {
    try {
       if (sessionId === 'default') return true;
       if (!accessToken) return false;
       await apiFetch(`/api/sessions/${sessionId}`, accessToken, { method: 'DELETE' });
       
       setSessions(prev => prev.filter(s => s.sessionId !== sessionId));
       if (currentSessionId === sessionId) {
          setCurrentSessionId('default');
       }
       return true;
    } catch (e) {
      console.error(`Failed to delete session ${sessionId}`, e);
      return false;
    }
  }

  const switchSessionIdLocallyOnly = (id: string) => {
      setCurrentSessionId(id);
  }

  return {
    sessions,
    currentSessionId,
    createSession,
    loadSession,
    loadSessionsList,
    resetSessionFilter,
    deleteSession,
    switchSessionIdLocallyOnly
  };
}
