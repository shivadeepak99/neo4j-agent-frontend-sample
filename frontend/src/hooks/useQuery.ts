import { useState, useCallback } from 'react';
import type { Candidate, QueryResponse } from '@/lib/api-types';
import { API_URL, USER_ID, ORG_ID } from '@/lib/api-client';

export type HistoricalTurn = {
  type: 'user' | 'agent';
  text: string;
  candidates?: Candidate[];
  clarification?: {
    question: string;
    options: string[];
  };
};

export function useQuery() {
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<string | null>(null);
  
  // Track conversational history inline for the current active view limit
  const [conversationHistory, setConversationHistory] = useState<HistoricalTurn[]>([]); 
  
  const [lastQuery, setLastQuery] = useState<string | null>(null);

  const resetQueryState = useCallback(() => {
    setConversationHistory([]);
    setLastQuery(null);
  }, []);

  const setInitialHistory = useCallback((turns: HistoricalTurn[]) => {
      setConversationHistory(turns);
  }, []);

  const sendQuery = useCallback(async (query: string, sessionId: string, clarificationAnswer?: string) => {
    setLoading(true);
    setLoadingProgress('Connecting...');
    setLastQuery(clarificationAnswer ? lastQuery : query);

    // If answering clarification, we don't necessarily want to duplicate the question text as a new bubble unless requested, 
    // but we will render the user's new clarification requirement into the timeline securely.
    const userTextContent = clarificationAnswer || query;
    setConversationHistory(prev => [...prev, { type: 'user', text: userTextContent }]);
    
    // Constructing request payload strictly matching the integration guide
    const payload = {
       query: clarificationAnswer ? lastQuery || query : query,
       session_id: sessionId !== 'default' ? sessionId : "default",
       user_id: USER_ID,
       clarification_answer: clarificationAnswer || null,
       org_id: ORG_ID 
    };

    // Use SSE Streaming for all queries as requested
    const endpoint = `/query/stream`;

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
         method: 'POST',
         headers: {
            'Content-Type': 'application/json',
            'X-Org-Id': ORG_ID
         },
         body: JSON.stringify(payload)
      });

      if (!response.body) throw new Error('No readable stream from the server');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      
      let resData: any = null;
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
           if (line.startsWith('data: ')) {
               const dataStr = line.replace('data: ', '').trim();
               if (!dataStr || dataStr === '[DONE]') continue;
               
               try {
                  const event = JSON.parse(dataStr);
                  
                  // SSE Event mappings
                  if (event.type === 'progress') {
                     setLoadingProgress(event.label);
                  } 
                  else if (event.type === 'result') {
                     resData = event.data;
                  }
                  else if (event.type === 'error') {
                     console.error("Agent Streaming Error:", event.detail);
                     setConversationHistory(prev => [...prev, { type: 'agent', text: event.detail }]);
                  }
               } catch (e) {
                  console.error("Failed parsing SSE chunk:", dataStr);
               }
           }
        }
      }

      setLoading(false);
      setLoadingProgress(null);

      if (!resData) {
         return; // If error already pushed by SSE stream
      }

      // Handle Clarification Needs securely by pushing a new turn structured explicitly for asking
      if (resData.clarificationNeeded) {
         setConversationHistory(prev => [...prev, { 
            type: 'agent', 
            text: "", 
            clarification: {
               question: resData.pendingQuestion,
               options: resData.clarificationOptions || []
            }
         }]);
         return;
      }
      
      // Extract final message & candidates
      let textBound = "";
      let fetchedCandidates: Candidate[] = [];

      if (resData.response) {
         textBound = resData.response.answer || "";
         fetchedCandidates = resData.response.candidates || [];
      } else if (resData.messageResponse) {
         textBound = resData.messageResponse.answer || "";
         fetchedCandidates = resData.messageResponse.candidates || [];
      }

      // Push final agent response natively into history bounds
      setConversationHistory(prev => [...prev, { 
         type: 'agent', 
         text: textBound,
         candidates: fetchedCandidates.length > 0 ? fetchedCandidates : undefined
      }]);

    } catch (e) {
       console.error("Stream failed", e);
       setLoading(false);
       setLoadingProgress(null);
       setConversationHistory(prev => [...prev, { type: 'agent', text: "Failed to connect to backend search streams natively." }]);
    }
  }, [lastQuery]);

  return {
    loading,
    loadingProgress,
    conversationHistory, 
    sendQuery,
    lastQuery,
    resetQueryState,
    setInitialHistory
  };
}
