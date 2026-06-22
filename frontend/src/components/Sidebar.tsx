"use client";

import { Compass, Plus, MessagesSquare, Trash2, LogOut, Building2, PanelLeftClose } from "lucide-react";
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
    <aside className="sidebar-panel flex h-full w-[272px] shrink-0 flex-col border-r">

      {/* Brand */}
      <div className="flex items-center gap-3 border-b px-4 py-[17px]">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[var(--teal-line)] bg-[var(--teal-soft)]">
          <Compass className="size-4 text-[var(--teal)]" />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="text-[14px] font-semibold leading-none tracking-tight text-[var(--fg)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Seafarer Graph
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--fg-3)]">MFA Intelligence</p>
        </div>
        {onToggle && (
          <button
            onClick={onToggle}
            className="btn-ghost -mr-1 p-1.5"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="size-4" />
          </button>
        )}
      </div>

      {/* New chat */}
      <div className="px-3 pb-2 pt-3">
        <button
          onClick={onNew}
          className="btn-primary flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-[13px]"
        >
          <Plus className="size-3.5" />
          New conversation
        </button>
      </div>

      {/* Sessions list */}
      <div className="scroll flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
        <p className="tag px-2.5 py-2">Conversations</p>
        {sessions.length === 0 && (
          <p className="px-2.5 py-3 text-[12px] text-[var(--fg-3)]">No conversations yet.</p>
        )}
        {sessions.map((s) => {
          const active = s.sessionId === currentSessionId;
          return (
            <div key={s.sessionId} className="group relative">
              <button
                onClick={() => onSelect(s.sessionId)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-all ${
                  active
                    ? "border border-[var(--teal-line)] bg-[var(--teal-soft)] text-[var(--fg)]"
                    : "border border-transparent text-[var(--fg-2)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
                }`}
              >
                <MessagesSquare
                  className={`size-3.5 shrink-0 ${active ? "text-[var(--teal)]" : "text-[var(--fg-3)]"}`}
                />
                <span className="truncate font-medium">{s.title}</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(s.sessionId); }}
                className="btn-ghost absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 opacity-0 transition-all hover:text-[var(--danger)] group-hover:opacity-100"
                aria-label="Delete conversation"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* User footer */}
      <div className="border-t px-3 py-3">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface-3)]">
            <Building2 className="size-3.5 text-[var(--teal)]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-medium text-[var(--fg-2)]">{email ?? "—"}</p>
            {orgName && <p className="truncate text-[11px] text-[var(--fg-3)]">{orgName}</p>}
          </div>
          <button
            onClick={onSignOut}
            className="btn-ghost rounded p-1.5 hover:text-[var(--danger)]"
            aria-label="Sign out"
          >
            <LogOut className="size-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
