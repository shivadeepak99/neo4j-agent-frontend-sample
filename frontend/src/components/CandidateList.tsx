"use client";

import { Candidate } from '@/lib/api-types';
import { User, FileText, Anchor, Clock, DollarSign, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function CandidateList({ candidates }: { candidates: Candidate[] | null | undefined }) {
  if (!candidates || candidates.length === 0) {
    return null;
  }

  return (
    <motion.div layout className="space-y-3">
      <AnimatePresence mode="popLayout">
        {candidates.map((candidate, idx) => {
          // Map backend field names to the ones expected by the UI
          const name = candidate.name || candidate.fullName || 'Unknown Candidate';
          const dirId = candidate.candidateDirId || candidate.dirId || candidate.dir_id || 'No Directory ID';
          const id = candidate.id || candidate.candidateId || `candidate-${idx}`;
          
          return (
          <motion.div 
            layout
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
            transition={{ duration: 0.4, delay: idx * 0.05, type: "spring", bounce: 0.3 }}
            key={id} 
            className="bg-white/60 dark:bg-white/[0.02] backdrop-blur-md rounded-xl border border-gray-200 dark:border-white/10 shadow-sm p-3 hover:shadow-md hover:border-gray-300 dark:hover:border-white/20 transition-all duration-300 group"
          >
            <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex-shrink-0 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-white/5 text-gray-700 dark:text-gray-300 rounded-full flex items-center justify-center font-bold text-[11px] shadow-sm">
              {(name === 'Unknown Candidate' ? 'U K' : name).split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-[13px] font-semibold text-gray-900 dark:text-slate-200 truncate transition-colors" title={name}>{name}</h3>
              <div className="flex items-center gap-1 mt-0.5 text-[11px] font-mono text-gray-500 dark:text-slate-400 truncate bg-gray-100/50 dark:bg-slate-900/50 px-1.5 py-0.5 rounded flex-inline max-w-full" title={dirId}>
                <FileText className="w-2.5 h-2.5 flex-shrink-0 opacity-70" />
                <span className="truncate">{dirId}</span>
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
