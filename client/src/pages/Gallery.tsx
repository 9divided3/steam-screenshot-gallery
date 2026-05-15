import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { screenshots as scrApi, games as gamesApi } from '../api/client';
import { useLightbox } from '../hooks/useLightbox';
import Lightbox from '../components/Lightbox/Lightbox';
import ImageCard from '../components/ImageCard/ImageCard';
import GridSkeleton from '../components/GridSkeleton/GridSkeleton';
import Pagination from '../components/Pagination/Pagination';
import CustomSelect from '../components/CustomSelect/CustomSelect';
import { screenshotUrl, thumbnailUrl } from '../utils/media';
import type { Screenshot, Game } from '../types';

export default function Gallery() {
  const [searchParams] = useSearchParams();
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [publicFilter, setPublicFilter] = useState(searchParams.get('public') || '');
  const [gameFilter, setGameFilter] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState(() => localStorage.getItem('gallery_sort') || 'date_desc');
  const [columns, setColumns] = useState(() => parseInt(localStorage.getItem('gallery_columns') || '5'));
  const [actualColumns, setActualColumns] = useState(columns);
  const [pageSize, setPageSize] = useState(Math.ceil(40 / columns) * columns);
  const [columnOptions, setColumnOptions] = useState<{ value: string; label: string }[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w < 640) {
        const mobileColumns = Math.min(columns, 2);
        setActualColumns(mobileColumns);
        setPageSize(10);
        setColumnOptions([{ value: '2', label: '2 列' }]);
      } else if (w < 1024) {
        const tabletColumns = Math.min(columns, 4);
        setActualColumns(tabletColumns);
        setPageSize(Math.ceil(32 / tabletColumns) * tabletColumns);
        setColumnOptions([
          { value: '2', label: '2 列' },
          { value: '3', label: '3 列' },
          { value: '4', label: '4 列' },
        ]);
      } else {
        setActualColumns(columns);
        setPageSize(Math.ceil(40 / columns) * columns);
        setColumnOptions([
          { value: '3', label: '3 列' },
          { value: '4', label: '4 列' },
          { value: '5', label: '5 列' },
          { value: '6', label: '6 列' },
        ]);
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [columns]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [selectingAll, setSelectingAll] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: String(pageSize), sort };
      if (publicFilter) params['public'] = publicFilter;
      if (gameFilter) params['game_id'] = gameFilter;
      if (search) params['search'] = search;
      const [scrData, gamesData] = await Promise.all([scrApi.list(params), gamesApi.list()]);
      setScreenshots(scrData.screenshots);
      setTotal(scrData.total);
      setGames(gamesData.games);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, publicFilter, gameFilter, search, sort, pageSize]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function togglePublic(id: number, isPublic: boolean) {
    await scrApi.togglePublic(id, isPublic);
    setScreenshots((prev) => prev.map((s) => (s.id === id ? { ...s, is_public: isPublic ? 1 : 0 } : s)));
  }

  async function batchTogglePublic(isPublic: boolean) {
    if (selected.size === 0) return;
    await scrApi.batchPublic(Array.from(selected), isPublic);
    setScreenshots((prev) =>
      prev.map((s) => (selected.has(s.id) ? { ...s, is_public: isPublic ? 1 : 0 } : s))
    );
    setSelected(new Set());
  }

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function enterSelectMode() {
    setSelectMode(true);
    setSelected(new Set());
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelected(new Set());
  }

  function selectAllPage() {
    const pageIds = screenshots.map((s) => s.id);
    if (selected.size === pageIds.length && pageIds.every((id) => selected.has(id))) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pageIds));
    }
  }

  async function selectAllGallery() {
    if (selected.size === total && total > 0) {
      setSelected(new Set());
      return;
    }
    setSelectingAll(true);
    try {
      const params: Record<string, string> = { limit: String(total || 9999) };
      if (publicFilter) params['public'] = publicFilter;
      if (gameFilter) params['game_id'] = gameFilter;
      if (search) params['search'] = search;
      const data = await scrApi.list(params);
      if (data.screenshots && Array.isArray(data.screenshots)) {
        setSelected(new Set(data.screenshots.map((s: Screenshot) => s.id)));
      }
    } catch (err: any) {
      alert(`获取全图库列表失败：${err.message}`);
    } finally {
      setSelectingAll(false);
    }
  }


  async function batchDownload() {
    if (selected.size === 0) return;
    setDownloading(true);
    try {
      await scrApi.batchDownload(Array.from(selected));
    } catch (err: any) {
      alert(`下载失败：${err.message}`);
    } finally {
      setDownloading(false);
    }
  }

  async function batchDelete() {
    if (selected.size === 0) return;
    if (!confirm(`确定要删除选中的 ${selected.size} 张截图吗？此操作不可撤销。`)) return;
    try {
      const result = await scrApi.batchDelete(Array.from(selected));
      const remainingOnPage = screenshots.filter((s) => !selected.has(s.id)).length;
      setTotal((t) => t - result.deleted);
      setSelected(new Set());
      if (remainingOnPage === 0 && page > 1) {
        setPage((p) => p - 1);
      } else {
        // Force refetch
        setScreenshots((prev) => prev.filter((s) => !selected.has(s.id)));
      }
    } catch (err: any) {
      alert(`删除失败：${err.message}`);
    }
  }

  const lightboxImages = screenshots.map((s) => ({
    id: s.id,
    file_path: s.file_path,
    title: s.title,
    game_name: s.game_name,
    user_id: s.user_id,
    width: s.width ?? undefined,
    height: s.height ?? undefined,
    created_at: s.created_at,
  }));

  const lightbox = useLightbox(lightboxImages);

  const totalPages = Math.ceil(total / pageSize);
  const hasActiveFilters = Boolean(search || gameFilter || publicFilter || sort !== 'date_desc');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-8 pb-28 sm:pb-8">
      <div
        className="mb-5 sm:mb-6 flex items-end justify-between gap-3"
        style={{ animation: 'pageEnter 0.5s ease-out forwards' }}
      >
        <div className="min-w-0">
          <p className="mb-1 text-[11px] font-mono uppercase tracking-[0.18em] text-cyan-100/90 sm:hidden">
            Personal vault
          </p>
          <h1 className="font-display text-3xl sm:text-2xl text-text-primary leading-none">
            我的图库
          </h1>
          <p className="mt-2 text-sm text-white/80 sm:hidden">
            {total.toLocaleString()} 张截图 · {selected.size > 0 ? `已选 ${selected.size} 张` : '点击图片查看大图'}
          </p>
        </div>
        <button
          onClick={selectMode ? exitSelectMode : enterSelectMode}
          className={`sm:hidden min-h-11 rounded-xl px-4 text-sm font-semibold transition-all duration-200 border backdrop-blur-xl cursor-pointer shadow-lg ${
            selectMode
              ? 'border-sky-200/70 bg-sky-500/[0.42] text-white shadow-sky-500/20'
              : 'border-cyan-100/85 bg-cyan-400/[0.55] text-white shadow-cyan-400/30'
          }`}
        >
          {selectMode ? '完成' : '选择'}
        </button>
      </div>

      <section
        className="mb-5 sm:mb-6 rounded-2xl border border-white/[0.12] bg-black/45 p-3 shadow-2xl shadow-black/25 backdrop-blur-2xl sm:bg-black/30 sm:p-4"
        style={{ animation: 'pageEnter 0.5s ease-out 0.1s forwards', opacity: 0 }}
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2 lg:w-[320px] xl:w-[360px]">
              <label className="sr-only" htmlFor="gallery-search">搜索截图</label>
              <div className="relative min-w-0 flex-1">
                <SearchIcon />
                <input
                  id="gallery-search"
                  type="text"
                  placeholder="搜索截图"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="input-field min-h-10 rounded-xl py-2 pl-10 pr-9 text-sm sm:min-h-10"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => { setSearch(''); setPage(1); }}
                    className="btn-icon btn-close-red absolute right-2 top-1/2 h-7 w-7 -translate-y-1/2 rounded-lg"
                    aria-label="清空搜索"
                  >
                    ×
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setFiltersOpen((v) => !v)}
                className={`btn-icon relative min-h-10 min-w-10 sm:hidden ${
                  filtersOpen || hasActiveFilters
                    ? '!border-cyan-100/85 !bg-cyan-400/[0.55] !text-white'
                    : ''
                }`}
                aria-expanded={filtersOpen}
                aria-label="打开筛选"
              >
                <FilterIcon />
              </button>
            </div>

            <div className={`${filtersOpen ? 'grid' : 'hidden'} grid-cols-2 items-center gap-2 sm:grid sm:grid-cols-[minmax(160px,220px)_128px_128px_88px] lg:flex lg:justify-end`}>
              <CustomSelect
                value={gameFilter}
                onChange={(v) => { setGameFilter(v); setPage(1); }}
                options={[{ value: '', label: '全部游戏' }, ...games.map((g) => ({ value: String(g.id), label: `${g.name} (${g.screenshot_count})` }))]}
                className="col-span-2 sm:col-span-1 lg:w-52"
              />
              <CustomSelect
                value={publicFilter}
                onChange={(v) => { setPublicFilter(v); setPage(1); }}
                options={[{ value: '', label: '全部可见' }, { value: '1', label: '已公开' }, { value: '0', label: '私密' }]}
                className="lg:w-32"
              />
              <CustomSelect
                value={sort}
                onChange={(v) => { setSort(v); localStorage.setItem('gallery_sort', v); setPage(1); }}
                options={[
                  { value: 'date_desc', label: '最新优先' },
                  { value: 'date_asc', label: '最早优先' },
                  { value: 'name_asc', label: '名称 A-Z' },
                  { value: 'name_desc', label: '名称 Z-A' },
                ]}
                className="lg:w-32"
              />
              <CustomSelect
                value={String(columns)}
                onChange={(v) => { setColumns(parseInt(v)); localStorage.setItem('gallery_columns', v); }}
                options={columnOptions}
                className="lg:w-24"
              />
            </div>
          </div>

          <div className="hidden border-t border-white/[0.08] pt-3 sm:flex sm:flex-wrap sm:items-center sm:gap-2">
            <div className="mr-auto flex items-center gap-3">
              <span className="font-mono text-xs text-text-muted">共 {total} 张</span>
              {selected.size > 0 && <span className="font-mono text-xs text-cyan-100">已选 {selected.size} 张</span>}
            </div>

            {selectMode && (
              <div className="flex flex-wrap gap-2">
                <button onClick={exitSelectMode} className="btn-secondary">
                  取消选择
                </button>
                <button onClick={selectAllPage} className="btn-secondary">
                  {screenshots.length > 0 && selected.size === screenshots.length && screenshots.every((s) => selected.has(s.id)) ? '取消本页' : `全选本页 (${screenshots.length})`}
                </button>
                {total > screenshots.length && (
                  <button
                    onClick={selectAllGallery}
                    disabled={selectingAll}
                    className="btn-secondary"
                  >
                    {selectingAll ? '获取中...' : total > 0 && selected.size === total ? '取消图库' : `全选图库 (${total})`}
                  </button>
                )}
              </div>
            )}

            {!selectMode && (
              <button onClick={enterSelectMode} className="btn-primary">
                选择
              </button>
            )}

            {selectMode && selected.size > 0 && (
              <div className="flex flex-wrap items-center gap-2" style={{ animation: 'toastIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
                <button onClick={() => batchTogglePublic(true)} className="btn-public">
                  公开
                </button>
                <button onClick={() => batchTogglePublic(false)} className="btn-private">
                  私密
                </button>
                <button onClick={batchDownload} className="btn-download">
                  下载
                </button>
                <button onClick={batchDelete} className="btn-delete">
                  删除
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {loading ? (
        <GridSkeleton columns={actualColumns} />
      ) : screenshots.length === 0 ? (
        <div className="text-center py-24 text-text-secondary" style={{ animation: 'pageEnter 0.4s ease-out forwards' }}>
          还没有截图，<a href="/import" className="text-cyan-100 hover:text-white transition-colors">去导入</a>
        </div>
      ) : (
        <>
          <div className="grid gap-2.5 sm:gap-3" style={{ gridTemplateColumns: `repeat(${actualColumns}, minmax(0, 1fr))` }}>
            {screenshots.map((s, i) => (
              <div key={s.id} className="relative">
                <ImageCard
                  src={screenshotUrl(s.id)}
                  thumbnailSrc={s.thumbnail_path ? thumbnailUrl(s.id) : undefined}
                  alt={s.title}
                  title={s.game_name || '未知游戏'}
                  onClick={selectMode ? () => toggleSelect(s.id) : () => lightbox.open(i)}
                  index={i}
                  showOverlay={false}
                  topLeftAction={
                    <div
                      className={`w-8 h-8 sm:w-5 sm:h-5 rounded-xl sm:rounded-md border flex items-center justify-center text-xs sm:text-[10px] font-bold transition-all duration-200 pointer-events-none shadow-lg shadow-black/30 ${
                        selected.has(s.id)
                          ? 'bg-cyan-400/[0.60] border-cyan-50 text-white scale-100'
                          : selectMode
                            ? 'border-white/[0.34] bg-white/[0.30] backdrop-blur-md'
                            : 'hidden'
                      }`}
                    >
                      {selected.has(s.id) && '✓'}
                    </div>
                  }
                />
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          )}
        </>
      )}

      {selectMode && (
        <div className="sm:hidden fixed left-3 right-3 bottom-3 z-40 rounded-3xl border border-white/[0.14] bg-black/85 p-3 shadow-2xl shadow-black/60 backdrop-blur-2xl">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-sm font-semibold text-white">已选 {selected.size} 张</span>
            <button
              onClick={selectAllPage}
              className="btn-secondary min-h-10 px-3 text-xs"
            >
              {screenshots.length > 0 && selected.size === screenshots.length && screenshots.every((s) => selected.has(s.id)) ? '取消本页' : '全选本页'}
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <button onClick={() => batchTogglePublic(true)} disabled={selected.size === 0} className="btn-public min-h-11 px-2 text-xs">
              公开
            </button>
            <button onClick={() => batchTogglePublic(false)} disabled={selected.size === 0} className="btn-private min-h-11 px-2 text-xs">
              私密
            </button>
            <button onClick={batchDownload} disabled={selected.size === 0 || downloading} className="btn-download min-h-11 px-2 text-xs">
              {downloading ? '下载中' : '下载'}
            </button>
            <button onClick={batchDelete} disabled={selected.size === 0} className="btn-delete min-h-11 px-2 text-xs">
              删除
            </button>
          </div>
        </div>
      )}

      {lightbox.isOpen && (
        <Lightbox
          images={lightboxImages}
          currentIndex={lightbox.currentIndex!}
          onClose={lightbox.close}
          onPrev={lightbox.prev}
          onNext={lightbox.next}
        />
      )}
    </div>
  );
}

function FilterIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M7 12h10M10 17h4" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-white/55"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.3-4.3M10.8 18a7.2 7.2 0 1 1 0-14.4 7.2 7.2 0 0 1 0 14.4Z" />
    </svg>
  );
}
