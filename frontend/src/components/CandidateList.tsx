"use client";

import { useState } from "react";
import type { Candidate, CardField, FieldType } from "@/lib/api-types";
import { Anchor, Clock, Globe, AlertTriangle, ChevronRight, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function availabilityConfig(status: string | undefined): { label: string; cls: string; dot: string } {
  if (!status) return { label: "Unknown", cls: "text-[var(--fg-faint)] bg-[var(--panel-3)]", dot: "bg-[var(--fg-faint)]" };
  const s = status.toUpperCase();
  if (s === "ASAP" || s === "AVAILABLE")
    return { label: s === "ASAP" ? "ASAP" : "Available", cls: "text-[var(--ok)] bg-[var(--ok-soft)]", dot: "bg-[var(--ok)]" };
  if (s.startsWith("SOON") || s === "LEAVE" || s === "DATED")
    return { label: status, cls: "text-[var(--warn)] bg-[var(--warn-soft)]", dot: "bg-[var(--warn)]" };
  return { label: status, cls: "text-[var(--fg-dim)] bg-[var(--panel-3)]", dot: "bg-[var(--fg-faint)]" };
}

function formatFieldValue(f: CardField): string {
  const v = f.value;
  if (v === null || v === undefined || v === "") return "—";
  switch (f.type as FieldType) {
    case "boolean":
      return v ? "Yes" : "No";
    case "array": {
      const arr = Array.isArray(v) ? v : [v];
      if (arr.length === 0) return "—";
      return arr.map((item) => {
        if (typeof item !== "object" || item === null) return String(item);
        const o = item as Record<string, unknown>;
        const title = o["title"] ?? o["name"] ?? o["credential_title"] ?? null;
        const status = o["status"] ?? o["expiry_status"] ?? o["validity_status"] ?? null;
        const expiry = o["expiry"] ?? o["date_of_expiry"] ?? null;
        if (title && status && expiry) return `${title} (${status}, exp: ${expiry})`;
        if (title && status) return `${title} (${status})`;
        if (title) return String(title);
        return Object.values(o).filter((v2) => v2 != null).map(String).join(", ");
      }).join(" · ");
    }
    case "date": {
      const ymd = v as { year: number; month: number; day: number };
      const raw = typeof v === "object" && v !== null && "year" in v
        ? `${ymd.year}-${String(ymd.month).padStart(2, "0")}-${String(ymd.day).padStart(2, "0")}`
        : String(v);
      try {
        const d = new Date(raw);
        if (!isNaN(d.getTime())) return d.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
      } catch { /* fall through */ }
      return raw;
    }
    case "number":
      return typeof v === "number" ? v.toLocaleString() : String(v);
    default:
      if (Array.isArray(v)) return formatFieldValue({ ...f, value: v, type: "array" });
      return String(v);
  }
}

const AVATAR_GRADIENTS = [
  "from-indigo-500 to-violet-600",
  "from-violet-500 to-purple-600",
  "from-sky-500 to-indigo-600",
  "from-teal-500 to-cyan-600",
  "from-rose-500 to-pink-600",
  "from-amber-500 to-orange-500",
];
function avatarGradient(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return AVATAR_GRADIENTS[Math.abs(h) % AVATAR_GRADIENTS.length];
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CandidateList({ candidates }: { candidates: Candidate[] | null | undefined }) {
  if (!candidates || candidates.length === 0) return null;
  return (
    <motion.div layout className="space-y-2.5">
      <AnimatePresence mode="popLayout">
        {candidates.map((c, idx) => <CandidateCard key={cardId(c, idx)} c={c} idx={idx} />)}
      </AnimatePresence>
    </motion.div>
  );
}

function cardId(c: Candidate, idx: number) {
  return String(c.candidateId || c.id || c.candidateDirId || c.candidate_dir_id || `cand-${idx}`);
}

function CandidateCard({ c, idx }: { c: Candidate; idx: number }) {
  const [open, setOpen] = useState(false);

  const name = String(c.fullName || c.name || c.fullname || c.full_name || "Unknown");
  const rank = String(c.rank || c.presentRankText || c.role || "");
  const nationality = String(c.nationality || c.nationalityText || "");
  const avail = String(c.availability || c.availabilityStatus || "");
  const seaMonths = c.totalServiceMonths as number | undefined;
  const justification = typeof c.justification === "string" ? c.justification : "";
  const certWarnings: string[] = Array.isArray(c.certWarnings) ? c.certWarnings : [];
  const gaps: string[] = Array.isArray(c.gaps) ? c.gaps : [];

  const initials = name === "Unknown" ? "?" : name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase();
  const grad = avatarGradient(name);
  const { cls: availCls, dot: availDot } = availabilityConfig(avail);

  const HARDCODED_KEYS = new Set(["full_name", "present_rank_text", "nationality_text", "availability_status", "total_service_months"]);
  const allFields: CardField[] = Array.isArray(c.fields) ? c.fields.filter((f) => f.value != null && f.value !== "") : [];
  const chipFields = allFields.filter((f) => f.requested && !HARDCODED_KEYS.has(f.key));
  const detailFields = allFields.filter((f) => !HARDCODED_KEYS.has(f.key));
  const hasDetails = detailFields.length > 0 || !!justification || gaps.length > 0 || certWarnings.length > 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, y: -8, transition: { duration: 0.16 } }}
      transition={{ duration: 0.36, delay: Math.min(idx * 0.035, 0.4), type: "spring", stiffness: 340, damping: 28 }}
      className="rounded-2xl overflow-hidden elevated"
    >
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="p-3.5">
        <div className="flex items-start gap-3">
          <div className={`w-11 h-11 shrink-0 rounded-xl bg-gradient-to-br ${grad} grid place-items-center font-bold text-[13px] text-white shadow-lg`}>
            {initials}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[15px] font-semibold text-[var(--fg)] truncate font-display" title={name}>{name}</h3>
              {avail && (
                <span className={`shrink-0 inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${availCls}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${availDot}`} />{avail}
                </span>
              )}
            </div>

            {rank && (
              <div className="flex items-center gap-1.5 mt-1">
                <Anchor className="w-3.5 h-3.5 text-[var(--brand)] shrink-0" />
                <span className="text-[13px] text-[var(--fg-dim)] truncate">{rank}</span>
              </div>
            )}

            <div className="flex items-center gap-4 mt-1.5 flex-wrap">
              {nationality && <Meta icon={<Globe className="w-3.5 h-3.5" />}>{nationality}</Meta>}
              {seaMonths != null && seaMonths > 0 && <Meta icon={<Clock className="w-3.5 h-3.5" />}>{seaMonths} mo sea time</Meta>}
            </div>
          </div>
        </div>

        {/* Requested-field chips */}
        {chipFields.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {chipFields.map((f) => (
              <span key={f.key} className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11.5px] bg-[var(--brand-soft)] border border-[var(--brand-line)]">
                <span className="text-[var(--brand)] font-medium">{f.label}:</span>
                <span className="text-[var(--fg-dim)]">{formatFieldValue(f)}</span>
              </span>
            ))}
          </div>
        )}

        {/* Cert warnings (first one, inline) */}
        {certWarnings.length > 0 && (
          <div className="mt-2 flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-[var(--warn)] shrink-0 mt-0.5" />
            <span className="text-[12px] text-[var(--warn)] leading-snug">{certWarnings[0]}{certWarnings.length > 1 ? ` +${certWarnings.length - 1} more` : ""}</span>
          </div>
        )}

        {hasDetails && (
          <button
            onClick={() => setOpen((o) => !o)}
            className="mt-2.5 inline-flex items-center gap-1 text-[12px] font-medium text-[var(--brand)] hover:opacity-80 transition-opacity"
          >
            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-90" : ""}`} />
            {open ? "Hide details" : "View full details"}
          </button>
        )}
      </div>

      {/* ── Expanded details ─────────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {open && hasDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3.5 pb-3.5 pt-1 border-t border-[var(--line)] space-y-3">
              {justification && (
                <div>
                  <DetailLabel icon={<ShieldCheck className="w-3.5 h-3.5" />}>Why this match</DetailLabel>
                  <p className="text-[13px] text-[var(--fg-dim)] leading-relaxed mt-1">{justification}</p>
                </div>
              )}

              {detailFields.length > 0 && (
                <div>
                  <DetailLabel>All fields</DetailLabel>
                  <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                    {detailFields.map((f) => (
                      <div key={f.key} className="flex items-baseline justify-between gap-2 border-b border-[var(--line)] pb-1">
                        <span className="text-[12px] text-[var(--fg-faint)] shrink-0">{f.label}</span>
                        <span className="text-[12.5px] text-[var(--fg)] text-right break-words">{formatFieldValue(f)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {certWarnings.length > 0 && (
                <div>
                  <DetailLabel icon={<AlertTriangle className="w-3.5 h-3.5 text-[var(--warn)]" />}>Credential warnings</DetailLabel>
                  <ul className="mt-1 space-y-1">
                    {certWarnings.map((w, i) => <li key={i} className="text-[12.5px] text-[var(--warn)] leading-snug">• {w}</li>)}
                  </ul>
                </div>
              )}

              {gaps.length > 0 && (
                <div>
                  <DetailLabel>Gaps vs query</DetailLabel>
                  <ul className="mt-1 space-y-1">
                    {gaps.map((g, i) => <li key={i} className="text-[12.5px] text-[var(--fg-dim)] leading-snug">• {g}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Meta({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--fg-dim)]">
      <span className="text-[var(--fg-faint)]">{icon}</span>{children}
    </span>
  );
}

function DetailLabel({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <p className="text-[10px] uppercase tracking-wide font-bold text-[var(--fg-faint)] flex items-center gap-1.5">
      {icon && <span className="text-[var(--brand)]">{icon}</span>}{children}
    </p>
  );
}
