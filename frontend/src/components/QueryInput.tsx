import { Search, Loader2 } from "lucide-react"

interface QueryInputProps {
  onSearch: (query: string) => void;
  loading: boolean;
}

export function QueryInput({ onSearch, loading }: QueryInputProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const query = formData.get('query') as string;
    if (query.trim()) {
      onSearch(query);
      e.currentTarget.reset();
    }
  }

  return (
    <div className="w-full relative">
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative flex items-center">
          <input
            suppressHydrationWarning
            name="query"
            type="text"
            placeholder="Search by role, vessel type, availability, or status"
            className="w-full pl-4 pr-12 py-3 text-sm rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0F1724] text-slate-900 dark:text-slate-100 shadow-sm focus:outline-none focus:border-slate-400 dark:focus:border-slate-500 focus:ring-2 focus:ring-slate-200 dark:focus:ring-white/10 transition-all placeholder:text-slate-400"
            disabled={loading}
            autoComplete="off"
          />
          <button
             suppressHydrationWarning
             type="submit"
             disabled={loading}
             className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-slate-900 dark:bg-slate-800 text-white dark:text-slate-100 rounded-md hover:bg-slate-800 dark:hover:bg-slate-700 shadow-sm transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center border border-transparent dark:border-white/10"
          >
            {loading ? <Loader2 className="w-4 h-4 sm:w-4 sm:h-4 animate-spin" /> : <Search className="w-4 h-4 sm:w-4 sm:h-4" />}
          </button>
        </div>
      </form>
    </div>
  )
}
