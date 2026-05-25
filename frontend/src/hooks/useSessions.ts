import { useState, useCallback, useEffect } from 'react';
import type { Session, SessionDetail } from '@/lib/api-types';
import { fetchWithOrg, USER_ID, ORG_ID } from '@/lib/api-client';

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([{ sessionId: 'default', title: 'New Search', userId: USER_ID, createdAt: new Date().toISOString() }]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('default');

  const setActiveSession = (id: string) => {
     setCurrentSessionId(id);
  };

  const createSession = async (title?: string) => {
    const sessionTitle = title || 'New Search';
    try {
      const response = await fetchWithOrg('/sessions', {
         method: 'POST',
         body: JSON.stringify({
            user_id: USER_ID,
            title: sessionTitle 
         })
      });

      // Based on API Contract mapping specifically:
      // {"sessionId": "ses_...", "userId": "...", "title": "...", "createdAt": "..."}
      const newSession: Session = {
        sessionId: response.sessionId || response.session_id || `ses_${Date.now()}`,
        title: response.title || sessionTitle,
        userId: response.userId || response.user_id || USER_ID,
        createdAt: response.createdAt || response.created_at || new Date().toISOString()
      };
      
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

    try {
       // GET /sessions/{session_id} - Repopulate Chat Details
       const response = await fetchWithOrg(`/sessions/${sessionId}`);
       const sessionDetail = response as SessionDetail;
       
       setSessions(prev => prev.map(s => 
          s.sessionId === sessionId 
            ? { ...s, title: sessionDetail.title || s.title }
            : s
        ));
        
       return sessionDetail;
    } catch (e) {
       console.error(`Failed to load history for ${sessionId}`, e);
       return null;
    }
  };

  const loadSessionsList = async () => {
     try {
       // GET /sessions?user_id=... Limit mapping from guide
       const response = await fetchWithOrg(`/sessions?user_id=${USER_ID}&limit=20&offset=0`);
       
       if (response.sessions && Array.isArray(response.sessions)) {
          const formattedSessions = response.sessions.map((s: any) => ({
             sessionId: s.sessionId || s.session_id,
             title: s.title || 'Search',
             userId: s.userId || s.user_id,
             createdAt: s.createdAt || s.created_at
          }));
          
          const validFetched = formattedSessions.filter((s: Session) => s.sessionId && s.sessionId !== 'default');
          
          setSessions([
            { sessionId: 'default', title: 'New Search', userId: USER_ID, createdAt: new Date().toISOString() }, 
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
    try {
       if (sessionId === 'default') return true;
       await fetchWithOrg(`/sessions/${sessionId}/reset`, { method: 'POST' });
       return true;
    } catch (e) {
      console.error(`Failed to reset constraints for session ${sessionId}`, e);
      return false;
    }
  }

  const deleteSession = async (sessionId: string) => {
    try {
       if (sessionId === 'default') return true;
       await fetchWithOrg(`/sessions/${sessionId}`, { method: 'DELETE' });
       
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
