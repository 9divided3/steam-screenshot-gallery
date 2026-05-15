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
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  };

  const pageNumbers = getPageNumbers(page, totalPages);

  return (
    <nav
      className="pagination-liquid mx-auto mt-8 sm:mt-10"
      aria-label="分页"
    >
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => goTo(1)}
        className="pagination-liquid-control hidden sm:inline-flex"
        aria-label="跳转到首页"
      >
        首页
      </button>
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => goTo(page - 1)}
        className="pagination-liquid-control"
        aria-label="上一页"
      >
        <span className="hidden sm:inline">上一页</span>
        <span className="text-xl leading-none sm:hidden" aria-hidden="true">‹</span>
      </button>
      {pageNumbers.map((p, i) =>
        p === '...' ? (
          <span
            key={`ellipsis-${i}`}
            className="pagination-liquid-ellipsis"
          >
            ...
          </span>
        ) : (
          <button
            type="button"
            key={p}
            onClick={() => goTo(p)}
            aria-label={`跳转到第 ${p} 页`}
            aria-current={p === page ? 'page' : undefined}
            className={`pagination-liquid-page ${p === page ? 'pagination-liquid-page-active' : ''}`}
          >
            {p}
          </button>
        )
      )}
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => goTo(page + 1)}
        className="pagination-liquid-control"
        aria-label="下一页"
      >
        <span className="hidden sm:inline">下一页</span>
        <span className="text-xl leading-none sm:hidden" aria-hidden="true">›</span>
      </button>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => goTo(totalPages)}
        className="pagination-liquid-control hidden sm:inline-flex"
        aria-label="跳转到末页"
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
        className="mt-1 flex w-full items-center justify-center gap-1.5 sm:ml-2 sm:mt-0 sm:w-auto"
        aria-label="跳转到指定页"
      >
        <input
          name="jump"
          type="number"
          min={1}
          max={totalPages}
          aria-label="页码"
          placeholder={`1-${totalPages}`}
          className="pagination-liquid-input"
        />
        <button type="submit" className="pagination-liquid-control pagination-liquid-jump">
          跳转
        </button>
      </form>
    </nav>
  );
}
