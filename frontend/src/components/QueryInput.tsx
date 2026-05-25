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
            placeholder="Type requirements (e.g., 'Find me a Master for VLCC...')"
            className="w-full pl-5 pr-14 py-3 sm:py-3.5 text-sm rounded-full border border-gray-200/80 dark:border-white/10 bg-white/90 dark:bg-[#111622]/90 backdrop-blur-xl text-gray-900 dark:text-slate-200 shadow-sm focus:outline-none focus:border-gray-400 dark:focus:border-slate-500 focus:ring-2 focus:ring-gray-200 dark:focus:ring-white/10 transition-all font-medium placeholder:font-normal placeholder:text-gray-400 dark:placeholder:text-slate-500"
            disabled={loading}
            autoComplete="off"
          />
          <button
             suppressHydrationWarning
             type="submit"
             disabled={loading}
             className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-gray-900 dark:bg-slate-800 text-white dark:text-gray-200 rounded-full hover:bg-gray-800 dark:hover:bg-slate-700 shadow-sm transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center border border-transparent dark:border-white/10"
          >
            {loading ? <Loader2 className="w-4 h-4 sm:w-4 sm:h-4 animate-spin" /> : <Search className="w-4 h-4 sm:w-4 sm:h-4" />}
          </button>
        </div>
      </form>
    </div>
  )
}
