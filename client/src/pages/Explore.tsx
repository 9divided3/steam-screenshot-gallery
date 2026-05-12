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

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex flex-wrap items-center gap-4 mb-6" style={{ animation: 'pageEnter 0.5s ease-out forwards' }}>
        <h1 className="font-display text-2xl text-white">探索广场</h1>
        <div className="hidden sm:flex items-center gap-4 text-sm text-white">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-glow-pulse" />
            {stats.totalScreenshots.toLocaleString()} 张
          </span>
          <span>{stats.totalUsers} 位用户</span>
          <span>{stats.totalGames} 款游戏</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 mb-6" style={{ animation: 'pageEnter 0.5s ease-out 0.1s forwards', opacity: 0 }}>
        <input
          type="text"
          placeholder="搜索截图..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="input-field w-44"
        />
        <input
          type="text"
          placeholder="搜索用户..."
          value={userSearch}
          onChange={(e) => { setUserSearch(e.target.value); setPage(1); }}
          className="input-field w-36"
        />
        <CustomSelect
          value={gameFilter}
          onChange={(v) => { setGameFilter(v); setPage(1); }}
          options={[{ value: '', label: '全部游戏' }, ...games.map((g) => ({ value: String(g.id), label: `${g.name} (${g.screenshot_count})` }))]}
          className="w-36"
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
          className="w-28"
        />
        <CustomSelect
          value={String(columns)}
          onChange={(v) => { setColumns(parseInt(v)); localStorage.setItem('explore_columns', v); }}
          options={[
            { value: '3', label: '3 列' },
            { value: '4', label: '4 列' },
            { value: '5', label: '5 列' },
            { value: '6', label: '6 列' },
          ]}
          className="w-20"
        />
        {total > 0 && (
          <span className="text-xs text-text-muted ml-auto font-mono">{total.toLocaleString()} 张</span>
        )}
      </div>

      {loading ? (
        <GridSkeleton columns={columns} />
      ) : screenshots.length === 0 ? (
        <div className="text-center py-24 text-text-secondary" style={{ animation: 'pageEnter 0.4s ease-out forwards' }}>
          还没有公开的截图
        </div>
      ) : (
        <>
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
            {screenshots.map((s, i) => (
              <ImageCard
                key={s.id}
                src={`/uploads/${s.file_path}`}
                thumbnailSrc={s.thumbnail_path ? `/thumbnails/${s.thumbnail_path}` : undefined}
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
