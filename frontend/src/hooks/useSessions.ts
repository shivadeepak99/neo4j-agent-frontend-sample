"use client";

import { useCallback, useState } from "react";
import type { ApiSession, Session, SessionDetail } from "@/lib/types";
import { apiFetch } from "@/lib/api-client";

const toSession = (s: ApiSession): Session => ({
  sessionId: s.id,
  title: s.title || "New chat",
  createdAt: s.createdAt,
  updatedAt: s.updatedAt,
});

/**
 * Real server-backed session list. Unlike the V2 hook there is no synthetic
 * "default" session — the V3 agent requires a real session row (POST /api/sessions)
 * before /api/query will accept a turn.
 */
export function useSessions(accessToken: string | null) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const list = useCallback(async (): Promise<Session[]> => {
    if (!accessToken) return [];
    try {
      const res = await apiFetch("/api/sessions", accessToken);
      const rows: Session[] = (res?.sessions ?? []).map(toSession);
      setSessions(rows);
      return rows;
    } catch (e) {
      console.error("sessions.list failed", e);
      return [];
    }
  }, [accessToken]);

  const create = useCallback(async (title?: string): Promise<string | null> => {
    if (!accessToken) return null;
    try {
      const res = await apiFetch("/api/sessions", accessToken, {
        method: "POST",
        body: JSON.stringify({ title: title || "New chat" }),
      });
      const s = toSession(res.session);
      setSessions((prev) => [s, ...prev.filter((p) => p.sessionId !== s.sessionId)]);
      setCurrentSessionId(s.sessionId);
      return s.sessionId;
    } catch (e) {
      console.error("sessions.create failed", e);
      return null;
    }
  }, [accessToken]);

  const loadDetail = useCallback(async (sessionId: string): Promise<SessionDetail | null> => {
    if (!accessToken) return null;
    try {
      const res = (await apiFetch(`/api/sessions/${sessionId}`, accessToken)) as SessionDetail;
      if (res?.session?.title) {
        setSessions((prev) => prev.map((s) => (s.sessionId === sessionId ? { ...s, title: res.session.title } : s)));
      }
      return res;
    } catch (e) {
      console.error("sessions.loadDetail failed", e);
      return null;
    }
  }, [accessToken]);

  const remove = useCallback(async (sessionId: string): Promise<void> => {
    if (!accessToken) return;
    try {
      await apiFetch(`/api/sessions/${sessionId}`, accessToken, { method: "DELETE" });
    } catch (e) {
      console.error("sessions.remove failed", e);
    }
    setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
    setCurrentSessionId((cur) => (cur === sessionId ? null : cur));
  }, [accessToken]);

  /** Refresh a single session's title from the server (after first-message titling). */
  const refreshTitle = useCallback(async (sessionId: string): Promise<void> => {
    if (!accessToken) return;
    try {
      const res = (await apiFetch(`/api/sessions/${sessionId}`, accessToken)) as SessionDetail;
      if (res?.session?.title) {
        setSessions((prev) => prev.map((s) => (s.sessionId === sessionId ? { ...s, title: res.session.title } : s)));
      }
    } catch { /* ignore */ }
  }, [accessToken]);

  return {
    sessions,
    currentSessionId,
    setCurrentSessionId,
    list,
    create,
    loadDetail,
    remove,
    refreshTitle,
  };
}
