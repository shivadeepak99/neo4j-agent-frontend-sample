"use client";

import type { Candidate, CardField, FieldType } from "@/lib/api-types";
import { Anchor, Clock, Globe, ShieldCheck, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function availabilityConfig(status: string | undefined): {
  label: string;
  cls: string;
  dot: string;
} {
  if (!status) return { label: "Unknown", cls: "bg-[rgba(99,130,220,0.08)] text-[#7A92B8] border border-[rgba(99,130,220,0.12)]", dot: "bg-[#4E6080]" };
  const s = status.toUpperCase();
  if (s === "ASAP" || s === "AVAILABLE")
    return {
      label: s === "ASAP" ? "ASAP" : "Available",
      cls: "bg-[rgba(16,185,129,0.12)] text-emerald-300 border border-[rgba(16,185,129,0.25)]",
      dot: "bg-emerald-400",
    };
  if (s.startsWith("SOON") || s === "LEAVE" || s === "DATED")
    return {
      label: status,
      cls: "bg-[rgba(245,158,11,0.12)] text-amber-300 border border-[rgba(245,158,11,0.25)]",
      dot: "bg-amber-400",
    };
  return {
    label: status,
    cls: "bg-[rgba(99,130,220,0.08)] text-[#C5D3F0] border border-[rgba(99,130,220,0.12)]",
    dot: "bg-[#7B91B6]",
  };
}


function formatFieldValue(f: CardField): string {
  const v = f.value;
  if (v === null || v === undefined) return "—";
  switch (f.type as FieldType) {
    case "boolean":
      return v ? "Yes" : "No";
    case "array": {
      const arr = Array.isArray(v) ? v : [v];
      if (arr.length === 0) return "—";
      return arr
        .map((item) => {
          if (typeof item !== "object" || item === null) return String(item);
          const o = item as Record<string, unknown>;
          const title = o["title"] ?? o["name"] ?? o["credential_title"] ?? null;
          const status = o["status"] ?? o["expiry_status"] ?? o["validity_status"] ?? null;
          const expiry = o["expiry"] ?? o["date_of_expiry"] ?? null;
          if (title && status && expiry) return `${title} (${status}, exp: ${expiry})`;
          if (title && status) return `${title} (${status})`;
          if (title) return String(title);
          return Object.values(o)
            .filter((v2) => v2 !== null && v2 !== undefined)
            .map(String)
            .join(", ");
        })
        .join(" · ");
    }
    case "date": {
      const raw =
        typeof v === "object" && v !== null && "year" in v
          ? `${(v as { year: number; month: number; day: number }).year}-${String(
              (v as { year: number; month: number; day: number }).month
            ).padStart(2, "0")}-${String(
              (v as { year: number; month: number; day: number }).day
            ).padStart(2, "0")}`
          : String(v);
      try {
        const d = new Date(raw);
        if (!isNaN(d.getTime()))
          return d.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
      } catch {
        // fall through
      }
      return raw;
    }
    case "number":
      return typeof v === "number" ? v.toString() : String(v);
    default: {
      if (Array.isArray(v)) return formatFieldValue({ ...f, value: v, type: "array" });
      return String(v);
    }
  }
}

// ─── Gradient initials colors (deterministic from name) ───────────────────────
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
    <motion.div layout className="space-y-2">
      <AnimatePresence mode="popLayout">
        {candidates.map((c, idx) => {
          const name = String(c.fullName || c.name || c.fullname || c.full_name || "Unknown");
          const dirId = String(c.candidateDirId || c.candidate_dir_id || c.directoryId || c.dirId || "");
          const id = String(c.candidateId || c.id || dirId || `cand-${idx}`);
          const rank = String(c.rank || c.presentRankText || c.role || "");
          const nationality = String(c.nationality || c.nationalityText || "");
          const avail = String(c.availability || c.availabilityStatus || "");
          const seaMonths = c.totalServiceMonths as number | undefined;
          const certWarnings: string[] = Array.isArray((c as {certWarnings?: string[]}).certWarnings) ? (c as {certWarnings: string[]}).certWarnings : [];

          const initials =
            name === "Unknown"
              ? "?"
              : name
                  .split(" ")
                  .map((n: string) => n[0])
                  .join("")
                  .substring(0, 2)
                  .toUpperCase();

          const grad = avatarGradient(name);
          const { cls: availCls, dot: availDot } = availabilityConfig(avail);

          // Keys that the card header already renders — never show as chips (duplicates).
          const HARDCODED_KEYS = new Set([
            "full_name", "present_rank_text", "nationality_text",
            "availability_status", "total_service_months",
          ]);

          const requestedFields: CardField[] = Array.isArray(c.fields)
            ? (c.fields as CardField[]).filter(
                (f) =>
                  f.requested &&
                  !HARDCODED_KEYS.has(f.key) &&
                  f.value !== null &&
                  f.value !== undefined
              )
            : [];

          return (
            <motion.div
              layout
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, y: -8, transition: { duration: 0.16 } }}
              transition={{
                duration: 0.4,
                delay: Math.min(idx * 0.04, 0.45),
                type: "spring",
                stiffness: 340,
                damping: 28,
              }}
              whileHover={{ y: -2, transition: { duration: 0.14 } }}
              key={id}
              className="relative rounded-xl overflow-hidden cursor-default group"
            >
              {/* Gradient border glow on hover */}
              <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.3) 0%, rgba(139,92,246,0.15) 50%, rgba(56,189,248,0.2) 100%)", padding: "1px" }}>
              </div>

              {/* Card body */}
              <div className="relative bg-[#0A1628] border border-[rgba(99,130,220,0.1)] group-hover:border-[rgba(99,102,241,0.35)] rounded-xl p-3 transition-all duration-300 group-hover:bg-[#0D1D36]">

                {/* Subtle top highlight line */}
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(99,102,241,0.3)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-t-xl" />

                <div className="flex items-start gap-2.5">
                  {/* Avatar */}
                  <div className={`w-9 h-9 flex-shrink-0 rounded-lg bg-gradient-to-br ${grad} flex items-center justify-center font-bold text-[11px] text-white shadow-lg`}>
                    {initials}
                  </div>

                  <div className="min-w-0 flex-1">
                    {/* Name + availability */}
                    <div className="flex items-center justify-between gap-1.5">
                      <h3 className="text-[13px] font-semibold text-white truncate leading-tight" title={name}>
                        {name}
                      </h3>
                      {avail && (
                        <span className={`flex-shrink-0 inline-flex items-center gap-1 text-[9.5px] font-semibold px-2 py-0.5 rounded-full ${availCls}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${availDot} flex-shrink-0`} />
                          {avail}
                        </span>
                      )}
                    </div>

                    {/* Rank */}
                    {rank && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Anchor className="w-2.5 h-2.5 text-indigo-400 flex-shrink-0" />
                        <span className="text-[11px] text-[#C5D3F0] truncate">{rank}</span>
                      </div>
                    )}

                    {/* Nationality + sea months */}
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {nationality && (
                        <div className="flex items-center gap-1">
                          <Globe className="w-2.5 h-2.5 text-[#7A92B8] flex-shrink-0" />
                          <span className="text-[11px] text-[#C5D3F0]">{nationality}</span>
                        </div>
                      )}
                      {seaMonths != null && seaMonths > 0 && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5 text-[#7A92B8] flex-shrink-0" />
                          <span className="text-[11px] text-[#C5D3F0]">{seaMonths}mo sea time</span>
                        </div>
                      )}
                    </div>


                    {/* Cert warnings */}
                    {certWarnings.length > 0 && (
                      <div className="mt-1.5 flex items-center gap-1">
                        <AlertTriangle className="w-2.5 h-2.5 text-amber-400 flex-shrink-0" />
                        <span className="text-[10px] text-amber-400/80 truncate">{certWarnings[0]}</span>
                      </div>
                    )}

                    {/* Dynamic requested fields */}
                    {requestedFields.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-[rgba(99,130,220,0.08)] flex flex-wrap gap-1.5">
                        {requestedFields.map((f) => (
                          <div
                            key={f.key}
                            className="flex items-center gap-1 bg-[rgba(99,102,241,0.1)] border border-[rgba(99,102,241,0.2)] text-indigo-200 rounded-md px-2 py-0.5 text-[10px] font-medium"
                          >
                            <span className="text-indigo-400 font-normal">{f.label}:</span>
                            <span>{formatFieldValue(f)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </motion.div>
  );
}
