import { useState, useEffect, useCallback } from 'react';
import { pub, stats as statsApi } from '../api/client';
import { useLikedScreenshots } from '../hooks/useLikedScreenshots';
import { useLightbox } from '../hooks/useLightbox';
import Lightbox from '../components/Lightbox/Lightbox';
import ImageCard from '../components/ImageCard/ImageCard';
import LikeButton from '../components/LikeButton/LikeButton';
import GridSkeleton from '../components/GridSkeleton/GridSkeleton';
import Pagination from '../components/Pagination/Pagination';
import CustomSelect from '../components/CustomSelect/CustomSelect';
import { screenshotUrl, thumbnailUrl } from '../utils/media';
import type { Screenshot, Game, Stats } from '../types';

export default function Explore() {
  const { likedIds } = useLikedScreenshots();
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [gameFilter, setGameFilter] = useState('');
  const [search, setSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [sort, setSort] = useState(() => localStorage.getItem('explore_sort') || 'date_desc');
  const [columns, setColumns] = useState(() => parseInt(localStorage.getItem('explore_columns') || '5'));
  const [actualColumns, setActualColumns] = useState(columns);
  const [columnOptions, setColumnOptions] = useState<{ value: string; label: string }[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Responsive column clamping + dynamic column options
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w < 640) {
        setActualColumns(Math.min(columns, 2));
        setColumnOptions([{ value: '2', label: '2 列' }]);
      } else if (w < 1024) {
        setActualColumns(Math.min(columns, 4));
        setColumnOptions([
          { value: '2', label: '2 列' },
          { value: '3', label: '3 列' },
          { value: '4', label: '4 列' },
        ]);
      } else {
        setActualColumns(columns);
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
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({ totalScreenshots: 0, totalUsers: 0, totalGames: 0 });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: '40', sort };
      if (gameFilter) params['game_id'] = gameFilter;
      if (search) params['search'] = search;
      if (userSearch) params['user_search'] = userSearch;
      const [scrData, gamesData, statsData] = await Promise.all([
        pub.screenshots(params),
        pub.games(),
        statsApi.public(),
      ]);
      setScreenshots(scrData.screenshots);
      setTotal(scrData.total);
      setGames(gamesData.games);
      setStats(statsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, gameFilter, search, userSearch, sort]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const lightboxImages = screenshots.map((s) => ({
    id: s.id,
    file_path: s.file_path,
    title: s.title,
    game_name: s.game_name,
    username: s.username,
    display_name: s.display_name,
    user_id: s.user_id,
    width: s.width ?? undefined,
    height: s.height ?? undefined,
    created_at: s.created_at,
  }));

  const lightbox = useLightbox(lightboxImages);
  const totalPages = Math.ceil(total / 40);
  const hasActiveFilters = Boolean(search || userSearch || gameFilter || sort !== 'date_desc');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
      <div
        className="mb-5 sm:mb-6"
        style={{ animation: 'pageEnter 0.5s ease-out forwards' }}
      >
        <p className="mb-1 text-[11px] font-mono uppercase tracking-[0.18em] text-cyan-100/90 sm:hidden">
          Public feed
        </p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-display text-3xl sm:text-2xl text-white leading-none">探索广场</h1>
          <div className="hidden sm:flex items-center gap-4 text-sm text-white">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 animate-glow-pulse" />
              {stats.totalScreenshots.toLocaleString()} 张
            </span>
            <span>{stats.totalUsers} 位用户</span>
            <span>{stats.totalGames} 款游戏</span>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:hidden">
          <StatPill label="截图" value={stats.totalScreenshots} />
          <StatPill label="用户" value={stats.totalUsers ?? 0} />
          <StatPill label="游戏" value={stats.totalGames ?? 0} />
        </div>
      </div>

      <section
        className="mb-5 sm:mb-7 rounded-2xl border border-white/[0.16] bg-black/55 p-3 shadow-2xl shadow-black/30 backdrop-blur-2xl sm:p-4"
        style={{ animation: 'pageEnter 0.5s ease-out 0.1s forwards', opacity: 0 }}
      >
        <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(180px,1.3fr)_minmax(150px,1fr)_minmax(180px,1.15fr)_140px_96px_auto] lg:items-center lg:gap-2">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 lg:contents">
            <label className="sr-only" htmlFor="explore-search">搜索截图</label>
            <input
              id="explore-search"
              type="text"
              placeholder="搜索截图"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="input-field min-h-11"
            />
            <label className="sr-only" htmlFor="explore-user-search">搜索用户</label>
            <input
              id="explore-user-search"
              type="text"
              placeholder="搜索用户"
              value={userSearch}
              onChange={(e) => { setUserSearch(e.target.value); setPage(1); }}
              className={`${filtersOpen ? 'block' : 'hidden'} input-field min-h-11 col-span-2 lg:col-span-1 lg:block`}
            />
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              className="btn-primary relative min-h-11 px-3 sm:hidden"
              aria-expanded={filtersOpen}
              aria-label="打开筛选"
            >
              <FilterIcon />
              {hasActiveFilters && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-white" />}
            </button>
          </div>

          <div className={`${filtersOpen ? 'grid' : 'hidden'} grid-cols-2 gap-2 border-t border-white/[0.12] pt-3 sm:grid sm:grid-cols-[minmax(180px,260px)_150px_96px_auto] sm:items-center lg:contents lg:border-0 lg:pt-0`}>
            <CustomSelect
              value={gameFilter}
              onChange={(v) => { setGameFilter(v); setPage(1); }}
              options={[{ value: '', label: '全部游戏' }, ...games.map((g) => ({ value: String(g.id), label: `${g.name} (${g.screenshot_count})` }))]}
              className="col-span-2 sm:col-span-1"
            />
            <CustomSelect
              value={sort}
              onChange={(v) => { setSort(v); localStorage.setItem('explore_sort', v); setPage(1); }}
              options={[
                { value: 'date_desc', label: '最新优先' },
                { value: 'date_asc', label: '最早优先' },
                { value: 'popular', label: '最多点赞' },
                { value: 'name_asc', label: '名称 A-Z' },
                { value: 'name_desc', label: '名称 Z-A' },
              ]}
            />
            <CustomSelect
              value={String(columns)}
              onChange={(v) => { setColumns(parseInt(v)); localStorage.setItem('explore_columns', v); }}
              options={columnOptions}
            />
            <div className="col-span-2 flex items-center justify-end gap-2 sm:col-span-1">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => { setSearch(''); setUserSearch(''); setGameFilter(''); setSort('date_desc'); localStorage.setItem('explore_sort', 'date_desc'); setPage(1); }}
                  className="btn-secondary min-h-10 px-3 text-xs"
                >
                  重置
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {loading ? (
        <GridSkeleton columns={actualColumns} />
      ) : screenshots.length === 0 ? (
        <div className="text-center py-24 text-text-secondary" style={{ animation: 'pageEnter 0.4s ease-out forwards' }}>
          还没有公开的截图
        </div>
      ) : (
        <>
          <div className="grid gap-2.5 sm:gap-3" style={{ gridTemplateColumns: `repeat(${actualColumns}, minmax(0, 1fr))` }}>
            {screenshots.map((s, i) => (
              <ImageCard
                key={s.id}
                src={screenshotUrl(s.id)}
                thumbnailSrc={s.thumbnail_path ? thumbnailUrl(s.id) : undefined}
                alt={s.title}
                title={s.game_name || '未知游戏'}
                subtitle={s.username ? `by ${s.display_name || s.username}` : undefined}
                onClick={() => lightbox.open(i)}
                index={i}
                topRightAction={
                  <LikeButton
                    screenshotId={s.id}
                    initialLiked={likedIds.has(s.id)}
                    initialCount={s.likes_count ?? 0}
                  />
                }
              />
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

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/[0.10] bg-black/45 px-3 py-2 backdrop-blur-xl">
      <div className="text-base font-semibold tabular-nums text-white">{value.toLocaleString()}</div>
      <div className="mt-0.5 text-[11px] text-white/70">{label}</div>
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
