/**
 * debugCache.ts — browser-only persistence of per-message debug info.
 *
 * The `D:` SSE debug events (plan, memory, tools, perf, sessionStatus) are only
 * streamed live during a turn. On reload or when switching/continuing a session,
 * the message history is rehydrated from the server — which does NOT store debug
 * data — so every debug panel would come back empty.
 *
 * This is a TEST-ONLY convenience: we stash each turn's debugInfo in localStorage
 * keyed by sessionId → messageId, and re-attach it on hydration. It is NOT sent
 * to or stored in the backend DB. Delete this module (and its two call sites in
 * useQuery) before production — it exists purely to make debugging across
 * reloads bearable while the agent is being tuned.
 */

import type { DebugInfo } from '@/hooks/useQuery';

const KEY = (sessionId: string) => `debug-cache:${sessionId}`;
/** Cap entries per session so localStorage never grows unbounded during testing. */
const MAX_ENTRIES = 100;

type DebugMap = Record<string, DebugInfo>;

/** Read the whole {messageId → debugInfo} map for a session (empty on miss/parse error). */
export function loadDebugMap(sessionId: string): DebugMap {
  if (typeof window === 'undefined' || !sessionId) return {};
  try {
    const raw = window.localStorage.getItem(KEY(sessionId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as DebugMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** Persist one message's debugInfo. No-ops on SSR, missing ids, or quota errors. */
export function saveDebugInfo(sessionId: string, messageId: string, info: DebugInfo): void {
  if (typeof window === 'undefined' || !sessionId || !messageId || !info) return;
  try {
    const map = loadDebugMap(sessionId);
    map[messageId] = info;
    // Evict oldest insertion-order keys if we exceed the cap (FIFO is fine here).
    const keys = Object.keys(map);
    if (keys.length > MAX_ENTRIES) {
      for (const stale of keys.slice(0, keys.length - MAX_ENTRIES)) delete map[stale];
    }
    window.localStorage.setItem(KEY(sessionId), JSON.stringify(map));
  } catch {
    /* quota / serialization failure — debug cache is best-effort only */
  }
}

/** Drop a session's cached debug data (e.g. when the session is deleted). */
export function clearDebugCache(sessionId: string): void {
  if (typeof window === 'undefined' || !sessionId) return;
  try {
    window.localStorage.removeItem(KEY(sessionId));
  } catch {
    /* ignore */
  }
}
