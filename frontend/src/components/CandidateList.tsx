"use client";

import type { Candidate, CardField, FieldType } from '@/lib/api-types';
import { Anchor, Clock, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function availabilityBadgeClass(status: string | undefined): string {
  if (!status) return 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400';
  const s = status.toUpperCase();
  if (s === 'ASAP' || s === 'AVAILABLE') return 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300';
  if (s.startsWith('SOON') || s === 'LEAVE' || s === 'DATED') return 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300';
  return 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400';
}

/**
 * Format a CardField value for display.
 * Converts booleans, arrays, dates, and numbers into a readable string.
 */
function formatFieldValue(f: CardField): string {
  const v = f.value;
  if (v === null || v === undefined) return '—';

  switch (f.type as FieldType) {
    case 'boolean':
      return v ? 'Yes' : 'No';

    case 'array': {
      const arr = Array.isArray(v) ? v : [v];
      if (arr.length === 0) return '—';
      return arr.map(String).join(', ');
    }

    case 'date': {
      // Neo4j date objects are serialised as ISO strings or { year, month, day } objects.
      const raw = typeof v === 'object' && v !== null && 'year' in v
        ? `${(v as { year: number; month: number; day: number }).year}-${String((v as { year: number; month: number; day: number }).month).padStart(2, '0')}-${String((v as { year: number; month: number; day: number }).day).padStart(2, '0')}`
        : String(v);
      try {
        const d = new Date(raw);
        if (!isNaN(d.getTime())) {
          return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
        }
      } catch {
        // fall through
      }
      return raw;
    }

    case 'number':
      return typeof v === 'number' ? v.toString() : String(v);

    default:
      return String(v);
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CandidateList({ candidates }: { candidates: Candidate[] | null | undefined }) {
  if (!candidates || candidates.length === 0) return null;

  return (
    <motion.div layout className="space-y-2.5">
      <AnimatePresence mode="popLayout">
        {candidates.map((c, idx) => {
          const name = String(
            c.fullName || c.name || c.fullname || c.full_name || 'Unknown'
          );
          const dirId = String(
            c.candidateDirId || c.candidate_dir_id || c.directoryId || c.dirId || ''
          );
          const id = String(c.candidateId || c.id || dirId || `cand-${idx}`);

          // The backend sends 'rank', 'nationality', 'availability' (short names).
          // Fall back to Neo4j property names for historical responses.
          const rank = String(c.rank || c.presentRankText || c.role || '');
          const nationality = String(c.nationality || c.nationalityText || '');
          const avail = String(c.availability || c.availabilityStatus || '');
          const seaMonths = c.totalServiceMonths as number | undefined;

          const initials = name === 'Unknown'
            ? 'UK'
            : name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();

          // Dynamic fields the user explicitly asked for (requested: true).
          // These are the core reason we pass `fields` — so "show their ages" or
          // "list their addresses" actually renders on every card.
          const requestedFields: CardField[] = Array.isArray(c.fields)
            ? (c.fields as CardField[]).filter(
                f => f.requested && f.value !== null && f.value !== undefined
              )
            : [];

          return (
            <motion.div
              layout
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94, y: -8, transition: { duration: 0.18 } }}
              transition={{
                duration: 0.38,
                delay: Math.min(idx * 0.045, 0.5),  // cap stagger at 0.5s so long lists don't wait forever
                type: 'spring',
                stiffness: 340,
                damping: 26,
              }}
              whileHover={{ y: -2, transition: { duration: 0.15 } }}
              key={id}
              className="bg-white dark:bg-[#0F1724] rounded-lg border border-slate-200 dark:border-white/10 shadow-sm p-3 hover:shadow-md hover:border-blue-200 dark:hover:border-blue-800/50 transition-colors duration-200 group cursor-default"
            >
              <div className="flex items-start gap-2.5">
                {/* Avatar */}
                <div className="w-8 h-8 flex-shrink-0 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-md flex items-center justify-center font-semibold text-[11px]">
                  {initials}
                </div>

                <div className="min-w-0 flex-1">
                  {/* Name + availability badge */}
                  <div className="flex items-center justify-between gap-1">
                    <h3
                      className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 truncate"
                      title={name}
                    >
                      {name}
                    </h3>
                    {avail && (
                      <span
                        className={`flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${availabilityBadgeClass(avail)}`}
                      >
                        {avail}
                      </span>
                    )}
                  </div>

                  {/* Rank */}
                  {rank && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Anchor className="w-3 h-3 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                      <span className="text-[11px] text-slate-600 dark:text-slate-400 truncate">{rank}</span>
                    </div>
                  )}

                  {/* Nationality + sea months */}
                  <div className="flex items-center gap-3 mt-1">
                    {nationality && (
                      <div className="flex items-center gap-1">
                        <Globe className="w-3 h-3 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                        <span className="text-[11px] text-slate-500 dark:text-slate-500">{nationality}</span>
                      </div>
                    )}
                    {seaMonths != null && seaMonths > 0 && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                        <span className="text-[11px] text-slate-500 dark:text-slate-500">{seaMonths} months sea time</span>
                      </div>
                    )}
                  </div>

                  {/* Dynamic requested fields — age, address, email, etc.
                      These are injected by the backend when the user asks for them.
                      Each chip: label + coerced value with a blue accent. */}
                  {requestedFields.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-100 dark:border-white/5 flex flex-wrap gap-1.5">
                      {requestedFields.map(f => (
                        <div
                          key={f.key}
                          className="flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-700/30 text-blue-800 dark:text-blue-200 rounded px-2 py-0.5 text-[10px] font-medium"
                        >
                          <span className="text-blue-400 dark:text-blue-400 font-normal">{f.label}:</span>
                          <span>{formatFieldValue(f)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </motion.div>
  );
}
