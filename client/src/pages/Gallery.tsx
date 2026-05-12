import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { screenshots as scrApi, games as gamesApi } from '../api/client';
import { useLightbox } from '../hooks/useLightbox';
import Lightbox from '../components/Lightbox/Lightbox';
import ImageCard from '../components/ImageCard/ImageCard';
import GridSkeleton from '../components/GridSkeleton/GridSkeleton';
import Pagination from '../components/Pagination/Pagination';
import CustomSelect from '../components/CustomSelect/CustomSelect';
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
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [selectingAll, setSelectingAll] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const limit = Math.ceil(40 / columns) * columns;
      const params: Record<string, string> = { page: String(page), limit: String(limit), sort };
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
  }, [page, publicFilter, gameFilter, search, sort, columns]);

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

  const limit = Math.ceil(40 / columns) * columns;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <h1 className="font-display text-2xl text-text-primary mb-6" style={{ animation: 'pageEnter 0.5s ease-out forwards' }}>
        我的图库
      </h1>

      <div className="flex flex-wrap items-center gap-2.5 mb-6" style={{ animation: 'pageEnter 0.5s ease-out 0.1s forwards', opacity: 0 }}>
        <input
          type="text"
          placeholder="搜索截图..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="input-field w-44"
        />
        <CustomSelect
          value={gameFilter}
          onChange={(v) => { setGameFilter(v); setPage(1); }}
          options={[{ value: '', label: '全部游戏' }, ...games.map((g) => ({ value: String(g.id), label: `${g.name} (${g.screenshot_count})` }))]}
          className="w-36"
        />
        <CustomSelect
          value={publicFilter}
          onChange={(v) => { setPublicFilter(v); setPage(1); }}
          options={[{ value: '', label: '全部可见' }, { value: '1', label: '已公开' }, { value: '0', label: '私密' }]}
          className="w-28"
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
          className="w-28"
        />
        <CustomSelect
          value={String(columns)}
          onChange={(v) => { setColumns(parseInt(v)); localStorage.setItem('gallery_columns', v); }}
          options={[
            { value: '3', label: '3 列' },
            { value: '4', label: '4 列' },
            { value: '5', label: '5 列' },
            { value: '6', label: '6 列' },
          ]}
          className="w-20"
        />
        {selectMode && (
          <>
            <button onClick={exitSelectMode} className="bg-black/30 border border-white/[0.15] backdrop-blur-xl rounded-xl text-sm text-white font-semibold px-5 py-2.5 hover:bg-black/45 hover:border-white/[0.20] transition-all duration-200 cursor-pointer">
              取消选择
            </button>
            <button onClick={selectAllPage} className="bg-black/30 border border-white/[0.15] backdrop-blur-xl rounded-xl text-sm text-white font-semibold px-5 py-2.5 hover:bg-black/45 hover:border-white/[0.20] transition-all duration-200 cursor-pointer">
              {screenshots.length > 0 && selected.size === screenshots.length && screenshots.every((s) => selected.has(s.id)) ? '取消全选' : `全选本页 (${screenshots.length})`}
            </button>
            {total > screenshots.length && (
              <button
                onClick={selectAllGallery}
                disabled={selectingAll}
                className="bg-black/30 border border-white/[0.15] backdrop-blur-xl rounded-xl text-sm text-white font-semibold px-5 py-2.5 hover:bg-black/45 hover:border-white/[0.20] transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {selectingAll ? '获取中...' : total > 0 && selected.size === total ? '取消全选' : `全选图库 (${total})`}
              </button>
            )}
          </>
        )}
        {!selectMode && (
          <button onClick={enterSelectMode} className="bg-black/30 border border-white/[0.15] backdrop-blur-xl rounded-xl text-sm text-white font-semibold px-5 py-2.5 hover:bg-black/45 hover:border-white/[0.20] transition-all duration-200 cursor-pointer">
            选择
          </button>
        )}
        {selectMode && selected.size > 0 && (
          <div className="flex items-center gap-2" style={{ animation: 'toastIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
            <button onClick={() => batchTogglePublic(true)} className="btn-success text-sm">
              公开选中 ({selected.size})
            </button>
            <button onClick={() => batchTogglePublic(false)} className="btn-secondary text-sm !bg-blue-500/60 !text-blue-300 !border-blue-500/85 hover:!bg-blue-500/70 hover:!border-blue-500 hover:!text-blue-200">
              私密选中 ({selected.size})
            </button>
            <button onClick={batchDelete} className="btn-danger text-sm whitespace-nowrap">
              删除选中 ({selected.size})
            </button>
          </div>
        )}
        <span className="text-xs text-text-muted font-mono ml-auto">共 {total} 张</span>
      </div>

      {loading ? (
        <GridSkeleton columns={columns} />
      ) : screenshots.length === 0 ? (
        <div className="text-center py-24 text-text-secondary" style={{ animation: 'pageEnter 0.4s ease-out forwards' }}>
          还没有截图，<a href="/import" className="text-accent hover:text-accent-hover transition-colors">去导入</a>
        </div>
      ) : (
        <>
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
            {screenshots.map((s, i) => (
              <div key={s.id} className="relative">
                <ImageCard
                  src={`/uploads/${s.file_path}`}
                  thumbnailSrc={s.thumbnail_path ? `/thumbnails/${s.thumbnail_path}` : undefined}
                  alt={s.title}
                  title={s.game_name || '未知游戏'}
                  onClick={selectMode ? () => toggleSelect(s.id) : () => lightbox.open(i)}
                  index={i}
                  showOverlay={false}
                  topLeftAction={
                    <div
                      className={`w-5 h-5 rounded-md border flex items-center justify-center text-[10px] transition-all duration-200 pointer-events-none ${
                        selected.has(s.id)
                          ? 'bg-accent border-accent text-primary scale-100'
                          : selectMode
                            ? 'border-border bg-white/[0.05] backdrop-blur-md'
                            : 'hidden'
                      }`}
                    >
                      {selected.has(s.id) && '✓'}
                    </div>
                  }
                  topRightAction={
                    <button
                      onClick={(e) => { e.stopPropagation(); togglePublic(s.id, !s.is_public); }}
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-200 hover:scale-110 ${
                        s.is_public
                          ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                          : 'bg-white/[0.04] backdrop-blur-md border border-border text-text-muted hover:border-border-hover'
                      }`}
                      title={s.is_public ? '已公开，点击设为私密' : '私密，点击设为公开'}
                    >
                      {s.is_public ? 'P' : 'S'}
                    </button>
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
