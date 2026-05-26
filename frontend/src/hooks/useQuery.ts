import { useState, useCallback } from 'react';
import type { Candidate, CandidateReference, ChatMessage, UIMessagePart } from '@/lib/api-types';
import { API_URL } from '@/lib/api-client';

export type HistoricalTurn = {
  type: 'user' | 'agent';
  text: string;
  candidates?: Candidate[];
  clarification?: {
    question: string;
    options: string[];
  };
};

function textFromParts(parts: UIMessagePart[] = []) {
  return parts
    .filter((part) => part?.type === 'text' && part.text)
    .map((part) => String(part.text))
    .join(' ')
    .trim();
}

function candidatesFromToolOutput(output: UIMessagePart['output']): Candidate[] {
  // Prefer full rows (contain all candidate fields from the backend)
  const rows = Array.isArray(output?.rows) ? output.rows : [];
  if (rows.length > 0) {
    return rows as Candidate[];
  }
  // Fall back to reference stubs (only directoryId + name available)
  const refs = Array.isArray(output?.references) ? output.references : [];
  return refs.map((ref: CandidateReference) => ({
    id: ref.directoryId,
    candidateDirId: ref.directoryId,
    candidateId: ref.directoryId,
    fullName: ref.fullname || ref.directoryId,
    passportId: ref.passportId,
    orgId: ref.orgId,
  }));
}

function historyFromMessages(messages: ChatMessage[]): HistoricalTurn[] {
  const turns: HistoricalTurn[] = [];
  for (const message of messages) {
    const text = textFromParts(message.parts);
    if (message.role === 'user') {
      turns.push({ type: 'user', text });
      continue;
    }

    const toolPart = message.parts.find((part) => part.type?.startsWith('tool-') && part.output);
    const candidates = candidatesFromToolOutput(toolPart?.output);
    turns.push({
      type: 'agent',
      text: text || 'Search finished',
      candidates: candidates.length > 0 ? candidates : undefined,
    });
  }
  return turns;
}

function parseUiStreamPayload(payload: string) {
  const prefix = payload.slice(0, 1);
  const jsonText = payload.slice(2);
  if (!payload[1] || payload[1] !== ':') return null;
  try {
    return { prefix, value: JSON.parse(jsonText) };
  } catch {
    return null;
  }
}

export function useQuery(accessToken: string | null) {
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

  const setInitialHistoryFromMessages = useCallback((messages: ChatMessage[]) => {
      setConversationHistory(historyFromMessages(messages));
  }, []);

  const sendQuery = useCallback(async (query: string, sessionId: string, clarificationAnswer?: string) => {
    if (!accessToken) {
      setConversationHistory(prev => [...prev, { type: 'agent', text: "Sign in before searching." }]);
      return;
    }
    if (sessionId === 'default') {
      setConversationHistory(prev => [...prev, { type: 'agent', text: "Create a session before searching." }]);
      return;
    }

    setLoading(true);
    setLoadingProgress('Connecting...');
    setLastQuery(clarificationAnswer ? lastQuery : query);

    const startTime = performance.now();
    console.log(`[useQuery] 🚀 Request started at 0ms`);

    // If answering clarification, we don't necessarily want to duplicate the question text as a new bubble unless requested, 
    // but we will render the user's new clarification requirement into the timeline securely.
    const userTextContent = clarificationAnswer || query;
    setConversationHistory(prev => [...prev, { type: 'user', text: userTextContent }]);
    
    const payload = {
       sessionId,
       message: {
         role: 'user',
         parts: [{ type: 'text', text: userTextContent }]
       }
    };

    const endpoint = `/api/query`;

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
         method: 'POST',
         headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
         },
         body: JSON.stringify(payload)
      });

      const firstByteTime = performance.now();
      console.log(`[useQuery] ⏱️ TTFB (Time to First Byte): ${(firstByteTime - startTime).toFixed(0)}ms`);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(`API error ${response.status}${errorText ? `: ${errorText}` : ""}`);
      }
      if (!response.body) throw new Error('No readable stream from the server');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      
      let buffer = '';
      let streamedText = '';
      let streamedCandidates: Candidate[] = [];

      while (true) {
        const { value, done } = await reader.read();
        
        const readTime = performance.now();
        const elapsed = (readTime - startTime).toFixed(0);

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
           if (!line.startsWith('data: ')) continue;
           const dataStr = line.slice(6).trim();
           if (!dataStr || dataStr === '[DONE]') continue;

           const event = parseUiStreamPayload(dataStr);
           if (!event) continue;

           if (event.prefix === 'f') {
             // stream start — backend connected
             console.log(`[useQuery] 📡 Stream connected: ${elapsed}ms`);
             setLoadingProgress('Connected, analysing query...');
           } else if (event.prefix === 'g') {
             // reasoning / chain-of-thought part — show brief status
             console.log(`[useQuery] 🧠 Reasoning started: ${elapsed}ms`);
             setLoadingProgress('Reasoning...');
           } else if (event.prefix === '9') {
             // tool call input-available — search is executing
             const toolName = event.value?.toolName as string | undefined;
             console.log(`[useQuery] 🛠️ Tool run (${toolName || 'search'}): ${elapsed}ms`);
             setLoadingProgress(
               toolName === 'runSearch' || toolName?.startsWith('search')
                 ? 'Searching candidate database...'
                 : 'Running tool: ' + (toolName || 'search') + '...'
             );
           } else if (event.prefix === 'a') {
             // tool result received — extract candidates
             console.log(`[useQuery] 📊 Tool result received: ${elapsed}ms`);
             const result = event.value?.result as UIMessagePart['output'];
             const found = candidatesFromToolOutput(result);
             if (found.length > 0) {
               streamedCandidates = found;
               setLoadingProgress(`Found ${found.length} candidate${found.length !== 1 ? 's' : ''}, composing answer...`);
             } else {
               setLoadingProgress('Search complete, composing answer...');
             }
           } else if (event.prefix === '0') {
             // text delta — answer is streaming in
             if (!streamedText) {
                console.log(`[useQuery] 🔤 First text token (TTFT): ${elapsed}ms`);
             }
             streamedText += String(event.value || '');
             if (!streamedText.trim()) continue;
             setLoadingProgress('Writing answer...');
           } else if (event.prefix === 'e' || event.prefix === 'd') {
             // step-finish / message-done — clear progress
             console.log(`[useQuery] ✅ Stream complete / Step finish: ${elapsed}ms`);
             setLoadingProgress(null);
           }
        }
      }

      setLoading(false);
      setLoadingProgress(null);

      setConversationHistory(prev => [...prev, { 
         type: 'agent', 
         text: streamedText || "Search finished.",
         candidates: streamedCandidates.length > 0 ? streamedCandidates : undefined
      }]);

    } catch (e) {
       console.error("Stream failed", e);
       setLoading(false);
       setLoadingProgress(null);
       setConversationHistory(prev => [...prev, { type: 'agent', text: "Failed to connect to backend search streams natively." }]);
    }
  }, [accessToken, lastQuery]);

  return {
    loading,
    loadingProgress,
    conversationHistory, 
    sendQuery,
    lastQuery,
    resetQueryState,
    setInitialHistory,
    setInitialHistoryFromMessages
  };
}
