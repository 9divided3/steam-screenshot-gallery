interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function getPageNumbers(page: number, totalPages: number): (number | '...')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages: (number | '...')[] = [1];
  if (page > 3) pages.push('...');
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (page < totalPages - 2) pages.push('...');
  pages.push(totalPages);
  return pages;
}

export default function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  const goTo = (p: number) => {
    onPageChange(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const pageNumbers = getPageNumbers(page, totalPages);

  return (
    <div className="flex justify-center items-center gap-1 sm:gap-1.5 mt-8 sm:mt-10 pb-6">
      <button
        disabled={page <= 1}
        onClick={() => goTo(1)}
        className="btn-ghost hidden min-h-9 px-3 py-1.5 text-xs sm:inline-flex"
      >
        首页
      </button>
      <button
        disabled={page <= 1}
        onClick={() => goTo(page - 1)}
        className="btn-secondary min-h-11 min-w-11 px-2.5 py-2 text-base sm:min-h-9 sm:min-w-0 sm:px-3 sm:text-xs"
      >
        <span className="hidden sm:inline">上一页</span>
        <span className="sm:hidden">‹</span>
      </button>
      {pageNumbers.map((p, i) =>
        p === '...' ? (
          <span key={`ellipsis-${i}`} className="px-0.5 sm:px-1.5 text-xs text-text-muted">...</span>
        ) : (
          <button
            key={p}
            onClick={() => goTo(p)}
            className={`h-9 w-9 rounded-xl text-sm font-semibold transition-all duration-200 sm:h-8 sm:w-8 sm:rounded-lg sm:text-xs ${
              p === page
                ? 'border border-cyan-100/85 bg-cyan-400/[0.55] text-white shadow-lg shadow-cyan-400/30'
                : 'border border-violet-200/55 bg-violet-500/[0.34] text-white hover:border-violet-100 hover:bg-violet-500/[0.48]'
            }`}
          >
            {p}
          </button>
        )
      )}
      <button
        disabled={page >= totalPages}
        onClick={() => goTo(page + 1)}
        className="btn-secondary min-h-11 min-w-11 px-2.5 py-2 text-base sm:min-h-9 sm:min-w-0 sm:px-3 sm:text-xs"
      >
        <span className="hidden sm:inline">下一页</span>
        <span className="sm:hidden">›</span>
      </button>
      <button
        disabled={page >= totalPages}
        onClick={() => goTo(totalPages)}
        className="btn-ghost hidden min-h-9 px-3 py-1.5 text-xs sm:inline-flex"
      >
        末页
      </button>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const input = (e.currentTarget.elements.namedItem('jump') as HTMLInputElement);
          const n = parseInt(input.value);
          if (n >= 1 && n <= totalPages) {
            goTo(n);
          }
          input.value = '';
        }}
        className="hidden sm:flex items-center gap-1 ml-3"
      >
        <input
          name="jump"
          type="number"
          min={1}
          max={totalPages}
          placeholder={`1-${totalPages}`}
          className="w-16 px-2 py-1.5 bg-black/30 border border-white/[0.15] backdrop-blur-xl rounded-lg text-xs text-white placeholder:text-text-muted text-center focus:outline-none focus:border-white/[0.25]"
        />
        <button type="submit" className="btn-ghost min-h-8 px-2 py-1 text-xs">
          跳转
        </button>
      </form>
    </div>
  );
}
