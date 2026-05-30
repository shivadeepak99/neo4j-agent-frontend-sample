import { useState, useCallback, useRef } from 'react';
import type { Candidate, CandidateReference, ChatMessage, UIMessagePart } from '@/lib/api-types';
import { API_URL } from '@/lib/api-client';

export type HistoricalTurn = {
  type: 'user' | 'agent';
  text: string;
  candidates?: Candidate[];
  messageId?: string;
  reasoning?: string;
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
      turns.push({ type: 'user', text, messageId: message.id });
      continue;
    }

    const toolPart = message.parts.find((part) => part.type?.startsWith('tool-') && part.output);
    const candidates = candidatesFromToolOutput(toolPart?.output);
    turns.push({
      type: 'agent',
      text: text || 'Search finished',
      messageId: message.id,
      candidates: candidates.length > 0 ? candidates : undefined,
    });
  }
  console.log('[history] hydrated turns', {
    count: turns.length,
    agentCount: turns.filter(turn => turn.type === 'agent').length,
  });
  return turns;
}

function parseUiStreamPayload(payload: string) {
  const colonIndex = payload.indexOf(':');
  if (colonIndex <= 0) return null;
  const prefix = payload.slice(0, colonIndex);
  if (prefix.length !== 1) return null;
  const jsonText = payload.slice(colonIndex + 1);
  if (!jsonText) return null;
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
  const activeAgentIndexRef = useRef<number | null>(null);
  const activeMessageIdRef = useRef<string | null>(null);
  
  const [lastQuery, setLastQuery] = useState<string | null>(null);

  const resetQueryState = useCallback(() => {
    setConversationHistory([]);
    setLastQuery(null);
    activeAgentIndexRef.current = null;
    activeMessageIdRef.current = null;
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

    activeAgentIndexRef.current = null;
    setLoading(true);
    setLoadingProgress('Connecting to search...');
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

      const ensureAgentMessage = (messageId?: string) => {
        const id = messageId ?? activeMessageIdRef.current ?? undefined;
        if (id) {
          activeMessageIdRef.current = id;
        }

        setConversationHistory(prev => {
          const byId = id ? prev.findIndex(turn => turn.type === 'agent' && turn.messageId === id) : -1;
          if (byId >= 0) {
            activeAgentIndexRef.current = byId;
            return prev;
          }

          const activeIndex = activeAgentIndexRef.current;
          if (activeIndex != null && prev[activeIndex]?.type === 'agent') {
            if (id && prev[activeIndex].messageId !== id) {
              const next = prev.slice();
              next[activeIndex] = { ...prev[activeIndex], messageId: id };
              return next;
            }
            return prev;
          }

          const next = [...prev, { type: 'agent' as const, text: '', messageId: id }];
          activeAgentIndexRef.current = next.length - 1;
          return next;
        });
      };

      const updateAgentMessage = (updater: (current: HistoricalTurn) => HistoricalTurn) => {
        const id = activeMessageIdRef.current ?? undefined;

        setConversationHistory(prev => {
          let index = id ? prev.findIndex(turn => turn.type === 'agent' && turn.messageId === id) : -1;
          if (index < 0) {
            const activeIndex = activeAgentIndexRef.current;
            index = activeIndex != null && prev[activeIndex]?.type === 'agent' ? activeIndex : -1;
          }

          const next = prev.slice();
          if (index >= 0) {
            next[index] = updater(prev[index]);
            activeAgentIndexRef.current = index;
            return next;
          }

          const created = updater({ type: 'agent', text: '', messageId: id });
          next.push(created);
          activeAgentIndexRef.current = next.length - 1;
          return next;
        });
      };

      const processLine = (rawLine: string, elapsed: string) => {
        const trimmedLine = rawLine.trim();
        if (!trimmedLine.startsWith('data:')) return;
        const dataStr = trimmedLine.slice(5).trim();
        if (!dataStr || dataStr === '[DONE]') return;

        const event = parseUiStreamPayload(dataStr);
        if (!event) return;

        if (event.prefix === 'p') {
          // Real-time progress label emitted by each LangGraph node as it starts.
          // Arrives while the agent is still running — update the loading status
          // without touching the message bubble.
          const label = typeof event.value?.label === 'string' ? event.value.label : null;
          if (label) setLoadingProgress(label);
          return;
        }

        if (event.prefix === 'f') {
          const messageId = typeof event.value?.messageId === 'string' ? event.value.messageId : undefined;
          console.log(`[useQuery] 📡 Stream connected: ${elapsed}ms`);
          if (messageId) {
            activeMessageIdRef.current = messageId;
          }
          // Set a generic label so the user sees something right away.
          // The backend's `p:` node events will replace this as each node completes.
          setLoadingProgress('Processing query...');
          return;
        }

        if (event.prefix === 'g') {
          // Kept for protocol compatibility; backend does not currently emit 'g' events.
          const reasoningText = typeof event.value?.text === 'string' ? event.value.text : '';
          console.log(`[useQuery] 🧠 Reasoning: ${elapsed}ms`);
          if (reasoningText) {
            ensureAgentMessage();
            updateAgentMessage(current => ({ ...current, reasoning: reasoningText }));
          }
          return;
        }

        if (event.prefix === '9') {
          // Tool call event — just log. The real progress label already came via `p:`.
          const toolName = event.value?.toolName as string | undefined;
          console.log(`[useQuery] 🛠️ Tool call (${toolName || 'search'}): ${elapsed}ms`);
          // Do NOT override loadingProgress here — backend `p:` events carry the
          // correct per-node label (e.g. "Searching candidate database...").
          return;
        }

        if (event.prefix === 'a') {
          console.log(`[useQuery] 📊 Tool result received: ${elapsed}ms`);
          const result = event.value?.result as UIMessagePart['output'];
          const found = candidatesFromToolOutput(result);
          if (found.length > 0) {
            streamedCandidates = found;
            // Show count as a supplemental label — the `p:` from `narrate` node
            // will replace this with "Writing answer..." when narration starts.
            setLoadingProgress(`Found ${found.length} candidate${found.length !== 1 ? 's' : ''}...`);
            ensureAgentMessage();
            updateAgentMessage(current => ({ ...current, candidates: found }));
          }
          return;
        }

        if (event.prefix === '0') {
          const delta = typeof event.value === 'string' ? event.value : String(event.value ?? '');
          if (!delta) return;
          if (!streamedText) {
            console.log(`[useQuery] 🔤 First text token (TTFT): ${elapsed}ms`);
            // narrate's `p:` already set "Writing answer..." — clear spinner label
            // now that actual text is arriving.
            setLoadingProgress(null);
          }
          streamedText += delta;
          ensureAgentMessage();
          updateAgentMessage(current => ({
            ...current,
            text: streamedText,
            candidates: streamedCandidates.length > 0 ? streamedCandidates : current.candidates,
          }));
          return;
        }

        if (event.prefix === 'e' || event.prefix === 'd') {
          console.log(`[useQuery] ✅ Stream complete / Step finish: ${elapsed}ms`);
          setLoadingProgress(null);
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        
        const readTime = performance.now();
        const elapsed = (readTime - startTime).toFixed(0);

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          processLine(line, elapsed);
        }
      }

      buffer += decoder.decode();
      if (buffer.trim()) {
        const elapsed = (performance.now() - startTime).toFixed(0);
        processLine(buffer, elapsed);
      }

      setLoading(false);
      setLoadingProgress(null);
      // Capture ref values into locals NOW — the setState updater runs asynchronously
      // during React's render phase, by which point the refs below would already be
      // cleared (null). Closures capture locals, not live ref reads.
      const _finalIndex = activeAgentIndexRef.current;
      const _finalMessageId = activeMessageIdRef.current;
      activeAgentIndexRef.current = null;
      activeMessageIdRef.current = null;
      setConversationHistory(prev => {
        const finalIndexById = _finalMessageId
          ? prev.findIndex(turn => turn.type === 'agent' && turn.messageId === _finalMessageId)
          : -1;
        const finalIndex = finalIndexById >= 0
          ? finalIndexById
          : (_finalIndex != null && prev[_finalIndex]?.type === 'agent' ? _finalIndex : -1);

        if (finalIndex < 0) {
          if (!streamedText && streamedCandidates.length === 0) return prev;
          return [...prev, {
            type: 'agent',
            text: streamedText || 'Search finished.',
            messageId: _finalMessageId ?? undefined,
            candidates: streamedCandidates.length > 0 ? streamedCandidates : undefined,
          }];
        }

        if (!prev[finalIndex].text || !prev[finalIndex].text.trim()) {
          const next = prev.slice();
          next[finalIndex] = {
            ...prev[finalIndex],
            messageId: prev[finalIndex].messageId ?? _finalMessageId ?? undefined,
            text: streamedText || 'Search finished.',
            candidates: streamedCandidates.length > 0 ? streamedCandidates : prev[finalIndex].candidates,
          };
          return next;
        }
        return prev;
      });

    } catch (e) {
       console.error("Stream failed", e);
       setLoading(false);
       setLoadingProgress(null);
       setConversationHistory(prev => {
         const index = activeAgentIndexRef.current;
         if (index == null || !prev[index]) {
           return [...prev, { type: 'agent', text: 'Failed to connect to backend search streams natively.' }];
         }
         const next = prev.slice();
         next[index] = { ...prev[index], text: 'Failed to connect to backend search streams natively.' };
         return next;
       });
       activeAgentIndexRef.current = null;
       activeMessageIdRef.current = null;
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
