import { useEffect, useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { profile as profileApi } from '../../api/client';
import { screenshotUrl } from '../../utils/media';
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
const CLOSE_ANIMATION_MS = 260;

function stopPropagation(fn: () => void) {
  return (e: React.MouseEvent) => { e.stopPropagation(); fn(); };
}

export default function Lightbox({ images, currentIndex, onClose, onPrev, onNext }: LightboxProps) {
  const { user: myUser } = useAuth();
  const current = images[currentIndex];
  const [imageLoaded, setImageLoaded] = useState(false);
  const [navigationDirection, setNavigationDirection] = useState<'prev' | 'next'>('next');
  const [swipeStartX, setSwipeStartX] = useState<number | null>(null);
  const [showcased, setShowcased] = useState(false);
  const [showcaseLoading, setShowcaseLoading] = useState(false);
  const [showcaseError, setShowcaseError] = useState('');
  const [isClosing, setIsClosing] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

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

  const handleRequestClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      onClose();
    }, CLOSE_ANIMATION_MS);
  }, [isClosing, onClose]);

  const showPrev = useCallback(() => {
    if (isClosing) return;
    setNavigationDirection('prev');
    onPrev();
  }, [isClosing, onPrev]);

  const showNext = useCallback(() => {
    if (isClosing) return;
    setNavigationDirection('next');
    onNext();
  }, [isClosing, onNext]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    switch (e.key) {
      case 'Escape': handleRequestClose(); break;
      case 'ArrowLeft': showPrev(); break;
      case 'ArrowRight': showNext(); break;
    }
  }, [handleRequestClose, showPrev, showNext]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    setSwipeStartX(e.touches[0].clientX);
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (swipeStartX === null) return;
    const diff = e.changedTouches[0].clientX - swipeStartX;
    if (Math.abs(diff) > SWIPE_THRESHOLD_PX) {
      diff > 0 ? showPrev() : showNext();
    }
    setSwipeStartX(null);
  };

  if (!current) return null;

  const content = (
    <div
      className="fixed inset-0 z-[9999] flex h-[100dvh] w-screen flex-col overflow-hidden bg-slate-950/[0.42] backdrop-blur-[32px]"
      style={{
        animation: isClosing
          ? `lightboxBackdropOut ${CLOSE_ANIMATION_MS}ms cubic-bezier(0.7, 0, 0.84, 0) forwards`
          : 'lightboxBackdropIn 0.32s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      }}
      onClick={handleRequestClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(125,211,252,0.35),transparent_32%),radial-gradient(circle_at_82%_18%,rgba(216,180,254,0.28),transparent_34%),radial-gradient(circle_at_52%_92%,rgba(45,212,191,0.22),transparent_36%),linear-gradient(135deg,rgba(15,23,42,0.28),rgba(2,6,23,0.58))]" />
      <div className="pointer-events-none absolute inset-0 bg-white/[0.035] [mask-image:linear-gradient(135deg,rgba(0,0,0,0.9),rgba(0,0,0,0.18),rgba(0,0,0,0.75))]" />
      <button
        onClick={stopPropagation(handleRequestClose)}
        className="btn-icon-round btn-close-red absolute top-4 right-4 z-20 h-11 w-11 text-2xl sm:top-5 sm:right-5"
        aria-label="关闭"
      >
        &times;
      </button>

      <div
        className="relative z-10 flex flex-1 items-center justify-center p-4 sm:p-6 md:p-12"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="relative rounded-[26px] border border-white/[0.16] bg-white/[0.08] p-1 shadow-2xl shadow-black/60 backdrop-blur-3xl"
          style={{
            animation: isClosing
              ? `lightboxImageOut ${CLOSE_ANIMATION_MS}ms cubic-bezier(0.7, 0, 0.84, 0) forwards`
              : 'lightboxImageIn 0.42s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          }}
        >
          {!imageLoaded && (
            <div className="w-48 h-48 skeleton rounded-xl" />
          )}
          <img
            src={screenshotUrl(current.id)}
            alt={current.title || 'Screenshot'}
            className="max-w-full max-h-[82vh] object-contain rounded-[22px] shadow-2xl shadow-black/70"
            style={{
              animation: imageLoaded
                ? `lightboxImageSwitch${navigationDirection === 'prev' ? 'Prev' : 'Next'} 0.36s cubic-bezier(0.16, 1, 0.3, 1) forwards`
                : 'none',
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
            onClick={stopPropagation(showPrev)}
            className="btn-icon-round absolute left-4 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 hover:!border-cyan-200/70 hover:!text-cyan-100 sm:inline-flex md:left-8"
            aria-label="上一张"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={stopPropagation(showNext)}
            className="btn-icon-round absolute right-4 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 hover:!border-cyan-200/70 hover:!text-cyan-100 sm:inline-flex md:right-8"
            aria-label="下一张"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      <div
        className="relative z-20 mx-3 mb-3 flex flex-col items-start justify-between gap-2 rounded-2xl border border-white/[0.18] bg-white/[0.16] px-4 py-3 text-sm shadow-2xl shadow-black/45 backdrop-blur-3xl sm:mx-5 sm:mb-5 sm:flex-row sm:items-center sm:px-5 sm:py-4"
        style={{
          animation: isClosing
            ? `lightboxTrayOut ${CLOSE_ANIMATION_MS}ms cubic-bezier(0.7, 0, 0.84, 0) forwards`
            : 'lightboxTrayIn 0.42s cubic-bezier(0.16, 1, 0.3, 1) 0.08s forwards',
          opacity: isClosing ? undefined : 0,
        }}
      >
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          {current.game_name && (
            <span className="text-white font-medium text-xs sm:text-sm">{current.game_name}</span>
          )}
          {current.username && current.user_id && (
            <Link
              to={`/profile/${current.user_id}`}
              className="text-white/80 hover:text-cyan-100 transition-colors duration-200 text-xs sm:text-sm"
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
              className={`btn-chip ${
                showcased
                  ? '!border-cyan-100/85 !bg-cyan-400/[0.55] !text-white hover:!border-red-300/80 hover:!bg-red-500/[0.52] hover:!text-white'
                  : ''
              }`}
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
        <div className="flex items-center gap-3 sm:gap-5 text-white/80 font-mono text-xs">
          <a
            href={screenshotUrl(current.id)}
            download
            onClick={(e) => e.stopPropagation()}
            className="btn-download min-h-9 px-3 py-1.5 text-xs"
            title="下载图片"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            <span className="hidden sm:inline">下载</span>
          </a>
          {current.width && current.height && (
            <span className="hidden sm:inline">{current.width} &times; {current.height}</span>
          )}
          <span>{currentIndex + 1} / {images.length}</span>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
