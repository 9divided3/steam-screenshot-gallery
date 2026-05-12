import { useEffect, useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { profile as profileApi } from '../../api/client';
import FollowButton from '../FollowButton/FollowButton';

interface LightboxImage {
  id: number;
  file_path: string;
  title?: string;
  game_name?: string;
  username?: string;
  display_name?: string;
  user_id?: number;
  width?: number;
  height?: number;
  created_at?: string;
}

interface LightboxProps {
  images: LightboxImage[];
  currentIndex: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}

const SWIPE_THRESHOLD_PX = 60;

function stopPropagation(fn: () => void) {
  return (e: React.MouseEvent) => { e.stopPropagation(); fn(); };
}

export default function Lightbox({ images, currentIndex, onClose, onPrev, onNext }: LightboxProps) {
  const { user: myUser } = useAuth();
  const current = images[currentIndex];
  const [imageLoaded, setImageLoaded] = useState(false);
  const [swipeStartX, setSwipeStartX] = useState<number | null>(null);
  const [showcased, setShowcased] = useState(false);
  const [showcaseLoading, setShowcaseLoading] = useState(false);
  const [showcaseError, setShowcaseError] = useState('');

  const isOwnImage = !!(myUser && current.user_id && current.user_id === myUser.id);

  // Check showcase status when image changes
  useEffect(() => {
    if (!isOwnImage) { setShowcased(false); return; }
    profileApi.showcase().then((data) => {
      setShowcased(data.screenshots.some((s: any) => s.id === current.id));
    }).catch(() => {});
  }, [current.id, currentIndex, isOwnImage]);

  const toggleShowcase = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setShowcaseLoading(true);
    const wasShowcased = showcased;
    setShowcased(!wasShowcased);
    try {
      const data = await profileApi.showcase();
      const screenshots = data.screenshots || [];
      let ids: number[] = screenshots.map((s: any) => s.id);
      if (wasShowcased) {
        ids = ids.filter((id: number) => id !== current.id);
        await profileApi.updateShowcase(ids);
      } else {
        if (ids.length >= 6) {
          setShowcased(false);
          setShowcaseError('最多展示 6 张图片');
          setTimeout(() => setShowcaseError(''), 3000);
          return;
        }
        ids.push(current.id);
        await profileApi.updateShowcase(ids);
      }
    } catch (err: any) {
      setShowcased(wasShowcased);
      setShowcaseError(err?.message || '操作失败，请重试');
      setTimeout(() => setShowcaseError(''), 3000);
    } finally {
      setShowcaseLoading(false);
    }
  };

  useEffect(() => {
    setImageLoaded(false);
  }, [currentIndex]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    switch (e.key) {
      case 'Escape': onClose(); break;
      case 'ArrowLeft': onPrev(); break;
      case 'ArrowRight': onNext(); break;
    }
  }, [onClose, onPrev, onNext]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setSwipeStartX(e.touches[0].clientX);
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (swipeStartX === null) return;
    const diff = e.changedTouches[0].clientX - swipeStartX;
    if (Math.abs(diff) > SWIPE_THRESHOLD_PX) {
      diff > 0 ? onPrev() : onNext();
    }
    setSwipeStartX(null);
  };

  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/15 backdrop-blur-lg flex flex-col"
      style={{ animation: 'fadeIn 0.25s ease-out forwards' }}
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <button
        onClick={stopPropagation(onClose)}
        className="absolute top-5 right-5 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/25 text-white/80 hover:text-white text-2xl transition-all duration-200 hover:scale-110 active:scale-90"
        aria-label="关闭"
      >
        &times;
      </button>

      <div
        className="flex-1 flex items-center justify-center p-6 md:p-12"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          {!imageLoaded && (
            <div className="w-48 h-48 skeleton rounded-xl" />
          )}
          <img
            src={`/uploads/${current.file_path}`}
            alt={current.title || 'Screenshot'}
            className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
            style={{
              animation: imageLoaded ? 'scaleIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards' : 'none',
              opacity: imageLoaded ? undefined : 0,
            }}
            key={current.id}
            onLoad={() => setImageLoaded(true)}
          />
        </div>
      </div>

      {images.length > 1 && (
        <>
          <button
            onClick={stopPropagation(onPrev)}
            className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white text-2xl transition-all duration-200 hover:scale-110 active:scale-90"
            aria-label="上一张"
            style={{ animation: 'fadeIn 0.3s ease-out 0.2s forwards', opacity: 0 }}
          >
            &#8249;
          </button>
          <button
            onClick={stopPropagation(onNext)}
            className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white text-2xl transition-all duration-200 hover:scale-110 active:scale-90"
            aria-label="下一张"
            style={{ animation: 'fadeIn 0.3s ease-out 0.2s forwards', opacity: 0 }}
          >
            &#8250;
          </button>
        </>
      )}

      <div
        className="px-6 py-4 flex items-center justify-between text-sm border-t border-white/[0.06] bg-black/10 backdrop-blur-md"
        style={{ animation: 'fadeUp 0.4s ease-out 0.25s forwards', opacity: 0 }}
      >
        <div className="flex items-center gap-4">
          {current.game_name && (
            <span className="text-white font-medium">{current.game_name}</span>
          )}
          {current.username && current.user_id && (
            <Link
              to={`/profile/${current.user_id}`}
              className="text-white/80 hover:text-accent transition-colors duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              by {current.display_name || current.username}
            </Link>
          )}
          {current.user_id && myUser && current.user_id !== myUser.id && (
            <FollowButton userId={current.user_id} />
          )}
          {isOwnImage && (
            <button
              onClick={toggleShowcase}
              disabled={showcaseLoading}
              className={`text-xs font-medium rounded-lg px-2.5 py-1.5 transition-all duration-200 flex items-center gap-1 ${
                showcased
                  ? 'bg-accent/20 text-accent border border-accent/30 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30'
                  : 'bg-black/30 text-white/80 hover:bg-black/50 hover:text-white'
              } disabled:opacity-50`}
              title={showcased ? '从主页移除' : '展示到个人主页'}
            >
              {showcaseLoading ? '...' : showcased ? '已展示' : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                  展示
                </>
              )}
            </button>
          )}
          {showcaseError && (
            <span className="text-xs text-red-400 animate-toast-in">{showcaseError}</span>
          )}
        </div>
        <div className="flex items-center gap-5 text-white/80 font-mono text-xs">
          {current.width && current.height && (
            <span>{current.width} &times; {current.height}</span>
          )}
          <span>{currentIndex + 1} / {images.length}</span>
        </div>
      </div>
    </div>
  );
}
