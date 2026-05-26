"use client";

import { Candidate } from '@/lib/api-types';
import { Anchor, Clock, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function availabilityBadgeClass(status: string | undefined): string {
  if (!status) return 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400';
  const s = status.toUpperCase();
  if (s === 'ASAP' || s === 'AVAILABLE') return 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300';
  if (s.startsWith('SOON') || s === 'LEAVE') return 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300';
  return 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400';
}

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
          const rank = String(c.presentRankText || c.role || '');
          const nationality = String(c.nationalityText || '');
          const avail = String(c.availabilityStatus || '');
          const seaMonths = c.totalServiceMonths as number | undefined;
          const initials = name === 'Unknown'
            ? 'UK'
            : name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();

          return (
            <motion.div
              layout
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
              transition={{ duration: 0.35, delay: idx * 0.04, type: 'spring', bounce: 0.25 }}
              key={id}
              className="bg-white dark:bg-[#0F1724] rounded-lg border border-slate-200 dark:border-white/10 shadow-sm p-3 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200 group"
            >
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 flex-shrink-0 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-md flex items-center justify-center font-semibold text-[11px]">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <h3 className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 truncate" title={name}>
                      {name}
                    </h3>
                    {avail && (
                      <span className={`flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${availabilityBadgeClass(avail)}`}>
                        {avail}
                      </span>
                    )}
                  </div>

                  {rank && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Anchor className="w-3 h-3 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                      <span className="text-[11px] text-slate-600 dark:text-slate-400 truncate">{rank}</span>
                    </div>
                  )}

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
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </motion.div>
  );
}
