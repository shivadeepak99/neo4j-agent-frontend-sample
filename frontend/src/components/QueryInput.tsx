"use client";

import { useRef } from "react";
import { Send, Loader2, Search } from "lucide-react";
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
    <form onSubmit={handleSubmit} className="w-full">
      <div className="focus-ring flex items-center gap-2.5 rounded-2xl glass px-3.5 py-2.5 transition-shadow">
        <Search className="w-4.5 h-4.5 text-[var(--fg-faint)] shrink-0" />
        <input
          ref={inputRef}
          suppressHydrationWarning
          name="query"
          type="text"
          placeholder="Search by role, vessel type, availability, credentials, or anything in the CV…"
          className="flex-1 bg-transparent text-[14.5px] text-[var(--fg)] placeholder:text-[var(--fg-faint)] outline-none caret-[var(--brand)]"
          disabled={loading}
          autoComplete="off"
        />
        <motion.button
          suppressHydrationWarning
          type="submit"
          disabled={loading}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.95 }}
          className="btn-brand shrink-0 grid place-items-center w-9 h-9 rounded-xl"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </motion.button>
      </div>
    </form>
  );
}
