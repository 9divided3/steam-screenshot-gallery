import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { games as gamesApi, screenshots as scrApi } from '../api/client';
import { useLightbox } from '../hooks/useLightbox';
import Lightbox from '../components/Lightbox/Lightbox';
import ImageCard from '../components/ImageCard/ImageCard';
import { screenshotUrl, thumbnailUrl } from '../utils/media';
import type { Screenshot, Game } from '../types';

export default function GameDetail() {
  const { id } = useParams<{ id: string }>();
  const [game, setGame] = useState<Game | null>(null);
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      gamesApi.get(parseInt(id)),
      scrApi.list({ game_id: id, limit: '100' }),
    ]).then(([gameData, scrData]) => {
      setGame(gameData.game);
      setScreenshots(scrData.screenshots);
    }).catch(console.error);
  }, [id]);

  const lightboxImages = useMemo(() => screenshots.map((s) => ({
    id: s.id,
    file_path: s.file_path,
    title: s.title,
    game_name: s.game_name,
    user_id: s.user_id,
    width: s.width ?? undefined,
    height: s.height ?? undefined,
    created_at: s.created_at,
  })), [screenshots]);

  const lightbox = useLightbox(lightboxImages);

  if (!game) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-text-secondary" style={{ animation: 'pageEnter 0.4s ease-out forwards' }}>加载中...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-center gap-5 mb-8" style={{ animation: 'pageEnter 0.5s ease-out forwards' }}>
        <div>
          <h1 className="font-display text-3xl text-text-primary">{game.name}</h1>
          <p className="text-sm text-text-muted mt-1">{game.screenshot_count} 张截图</p>
        </div>
      </div>

      {screenshots.length === 0 ? (
        <div className="text-center py-24 text-text-secondary" style={{ animation: 'pageEnter 0.4s ease-out forwards' }}>
          暂无截图
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {screenshots.map((s, i) => (
            <ImageCard
              key={s.id}
              src={screenshotUrl(s.id)}
              thumbnailSrc={s.thumbnail_path ? thumbnailUrl(s.id) : undefined}
              alt={s.title}
              title={s.game_name || game.name}
              onClick={() => lightbox.open(i)}
              index={i}
              showOverlay={false}
            />
          ))}
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
