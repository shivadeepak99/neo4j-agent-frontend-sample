"use client";

import { useRef } from "react";
import { Send, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

interface QueryInputProps {
  onSearch: (query: string) => void;
  loading: boolean;
}

export function QueryInput({ onSearch, loading }: QueryInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const query = formData.get("query") as string;
    if (query.trim()) {
      onSearch(query);
      e.currentTarget.reset();
    }
  };

  return (
    <div className="w-full relative">
      <form onSubmit={handleSubmit} className="relative">
        {/* Outer glow wrapper */}
        <div className="relative input-glow rounded-xl transition-all duration-300">
          {/* Glass background */}
          <div className="relative flex items-center gap-2 rounded-xl border border-[rgba(99,130,220,0.2)] bg-[rgba(7,17,31,0.85)] backdrop-blur-xl px-4 py-3 transition-all duration-300 focus-within:border-[rgba(99,102,241,0.5)]">

            {/* Subtle inner gradient top highlight */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-xl bg-gradient-to-r from-transparent via-[rgba(99,102,241,0.4)] to-transparent" />

            <input
              ref={inputRef}
              suppressHydrationWarning
              name="query"
              type="text"
              placeholder="Search by role, vessel type, availability, or compliance status…"
              className="flex-1 bg-transparent text-[0.875rem] text-white placeholder:text-[#9BB4D6] outline-none caret-indigo-400"
              disabled={loading}
              autoComplete="off"
            />

            <motion.button
              suppressHydrationWarning
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.95 }}
              className="relative flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg overflow-hidden disabled:opacity-40 transition-opacity"
            >
              {/* Gradient fill */}
              <span className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-violet-500 to-sky-500 opacity-90" />
              {/* Hover shimmer */}
              <span className="absolute inset-0 opacity-0 hover:opacity-100 bg-gradient-to-br from-indigo-400 via-violet-400 to-sky-400 transition-opacity" />
              <span className="relative z-10">
                {loading
                  ? <Loader2 className="w-4 h-4 text-white animate-spin" />
                  : <Send className="w-4 h-4 text-white" />
                }
              </span>
            </motion.button>
          </div>
        </div>
      </form>
    </div>
  );
}
