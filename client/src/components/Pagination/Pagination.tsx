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
    <div className="flex justify-center items-center gap-1.5 mt-10 pb-6">
      <button
        disabled={page <= 1}
        onClick={() => goTo(1)}
        className="px-3 py-2 text-xs text-white font-semibold hover:text-white/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        首页
      </button>
      <button
        disabled={page <= 1}
        onClick={() => goTo(page - 1)}
        className="bg-black/30 border border-white/[0.15] backdrop-blur-xl rounded-xl text-xs text-white font-semibold px-3 py-2 hover:bg-black/45 hover:border-white/[0.20] transition-all duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
      >
        上一页
      </button>
      {pageNumbers.map((p, i) =>
        p === '...' ? (
          <span key={`ellipsis-${i}`} className="px-1.5 text-xs text-text-muted">...</span>
        ) : (
          <button
            key={p}
            onClick={() => goTo(p)}
            className={`w-8 h-8 rounded-lg text-xs font-medium transition-all duration-200 ${
              p === page
                ? 'bg-white/20 text-white font-semibold'
                : 'text-text-muted hover:text-text-primary hover:bg-black/25'
            }`}
          >
            {p}
          </button>
        )
      )}
      <button
        disabled={page >= totalPages}
        onClick={() => goTo(page + 1)}
        className="bg-black/30 border border-white/[0.15] backdrop-blur-xl rounded-xl text-xs text-white font-semibold px-3 py-2 hover:bg-black/45 hover:border-white/[0.20] transition-all duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
      >
        下一页
      </button>
      <button
        disabled={page >= totalPages}
        onClick={() => goTo(totalPages)}
        className="px-3 py-2 text-xs text-white font-semibold hover:text-white/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
        className="flex items-center gap-1 ml-3"
      >
        <input
          name="jump"
          type="number"
          min={1}
          max={totalPages}
          placeholder={`1-${totalPages}`}
          className="w-16 px-2 py-1.5 bg-black/30 border border-white/[0.15] backdrop-blur-xl rounded-lg text-xs text-white placeholder:text-text-muted text-center focus:outline-none focus:border-white/[0.25]"
        />
        <button type="submit" className="text-xs text-white font-semibold hover:text-white/80 transition-colors px-1">
          跳转
        </button>
      </form>
    </div>
  );
}
