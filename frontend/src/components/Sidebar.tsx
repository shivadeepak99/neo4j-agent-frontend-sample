"use client";

import { Anchor, Plus, MessageSquare, Trash2, LogOut, Building2, PanelLeftClose } from "lucide-react";
import type { Session } from "@/lib/types";

interface SidebarProps {
  sessions: Session[];
  currentSessionId: string | null;
  email?: string | null;
  orgName?: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onSignOut: () => void;
  onToggle?: () => void;
}

export function Sidebar({
  sessions, currentSessionId, email, orgName, onSelect, onNew, onDelete, onSignOut, onToggle,
}: SidebarProps) {
  return (
    <aside className="flex h-full w-[272px] shrink-0 flex-col glass border-r">
      {/* Brand */}
      <div className="flex items-center gap-2.5 border-b px-4 py-4">
        <div className="brand-mark grid size-9 shrink-0 place-items-center rounded-xl btn-brass">
          <Anchor className="size-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[15px] font-semibold leading-none text-[var(--fg)]">Seafarer Graph</p>
          <p className="mt-1 text-[11px] text-[var(--fg-faint)]">Maritime crew search</p>
        </div>
        {onToggle && (
          <button
            onClick={onToggle}
            className="btn-ghost -mr-1 rounded-lg p-1.5"
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
          >
            <PanelLeftClose className="size-4.5" />
          </button>
        )}
      </div>

      {/* New chat */}
      <div className="p-3">
        <button
          onClick={onNew}
          className="btn-brass flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13.5px]"
        >
          <Plus className="size-4" /> New chat
        </button>
      </div>

      {/* Sessions */}
      <div className="scroll flex-1 space-y-1 overflow-y-auto px-2.5 pb-3">
        <p className="tick px-2 py-1.5">Sessions</p>
        {sessions.length === 0 && (
          <p className="px-2 py-3 text-[12px] text-[var(--fg-faint)]">No sessions yet.</p>
        )}
        {sessions.map((s) => {
          const active = s.sessionId === currentSessionId;
          return (
            <div key={s.sessionId} className="group relative">
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-[var(--brass)]" />
              )}
              <button
                onClick={() => onSelect(s.sessionId)}
                className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-[13.5px] transition-all ${
                  active
                    ? "border-[var(--brass-line)] bg-[var(--brass-soft)] text-[var(--fg)] shadow-[0_1px_0_rgba(255,255,255,0.03)_inset]"
                    : "border-transparent text-[var(--fg-dim)] hover:bg-[var(--panel-2)] hover:text-[var(--fg)]"
                }`}
              >
                <MessageSquare className={`size-4 shrink-0 ${active ? "text-[var(--brass)]" : "text-[var(--fg-faint)]"}`} />
                <span className="truncate font-medium">{s.title}</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(s.sessionId); }}
                className="btn-ghost absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 opacity-0 transition-opacity hover:text-[var(--danger)] group-hover:opacity-100"
                aria-label="Delete session"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* User */}
      <div className="border-t p-3">
        <div className="flex items-center gap-2.5 px-1.5">
          <div className="grid size-8 shrink-0 place-items-center rounded-full surface-2">
            <Building2 className="size-4 text-[var(--cyan)]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-medium text-[var(--fg-dim)]">{email ?? "Not signed in"}</p>
            {orgName && <p className="truncate text-[11px] text-[var(--fg-faint)]">{orgName}</p>}
          </div>
          <button onClick={onSignOut} className="btn-ghost rounded-md p-1.5 hover:text-[var(--danger)]" aria-label="Sign out">
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
