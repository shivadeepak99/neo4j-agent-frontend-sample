"use client";

import { Candidate } from '@/lib/api-types';
import { Anchor, Clock, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function availabilityBadgeClass(status: string | undefined): string {
  if (!status) return 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400';
  const s = status.toUpperCase();
  if (s === 'ASAP' || s === 'AVAILABLE') return 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400';
  if (s.startsWith('SOON') || s === 'LEAVE') return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
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
              className="bg-white/70 dark:bg-white/[0.03] backdrop-blur-md rounded-xl border border-gray-200 dark:border-white/10 shadow-sm p-3 hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-500/30 transition-all duration-200 group"
            >
              {/* Row 1: avatar + name + availability badge */}
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 flex-shrink-0 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-300 rounded-full flex items-center justify-center font-bold text-[11px] shadow-sm mt-0.5">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <h3 className="text-[13px] font-semibold text-gray-900 dark:text-slate-100 truncate" title={name}>
                      {name}
                    </h3>
                    {avail && (
                      <span className={`flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${availabilityBadgeClass(avail)}`}>
                        {avail}
                      </span>
                    )}
                  </div>

                  {/* Row 2: rank */}
                  {rank && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Anchor className="w-2.5 h-2.5 text-gray-400 dark:text-slate-500 flex-shrink-0" />
                      <span className="text-[11px] text-gray-600 dark:text-slate-400 truncate">{rank}</span>
                    </div>
                  )}

                  {/* Row 3: nationality + sea months */}
                  <div className="flex items-center gap-3 mt-1">
                    {nationality && (
                      <div className="flex items-center gap-1">
                        <Globe className="w-2.5 h-2.5 text-gray-400 dark:text-slate-500 flex-shrink-0" />
                        <span className="text-[11px] text-gray-500 dark:text-slate-500">{nationality}</span>
                      </div>
                    )}
                    {seaMonths != null && seaMonths > 0 && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5 text-gray-400 dark:text-slate-500 flex-shrink-0" />
                        <span className="text-[11px] text-gray-500 dark:text-slate-500">{seaMonths}mo sea time</span>
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
