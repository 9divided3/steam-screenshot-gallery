import { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { stats as statsApi, pub, likes as likesApi } from '../api/client';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { useCountUp } from '../hooks/useCountUp';
import { useLightbox } from '../hooks/useLightbox';
import { useLikedScreenshots } from '../hooks/useLikedScreenshots';
import ImageCard from '../components/ImageCard/ImageCard';
import LikeButton from '../components/LikeButton/LikeButton';
import Lightbox from '../components/Lightbox/Lightbox';
import { screenshotUrl, thumbnailUrl } from '../utils/media';
import type { Screenshot, Stats } from '../types';

interface MyStats {
  totalScreenshots: number;
  publicCount: number;
}

function wrapIndex(current: number, delta: 1 | -1, length: number): number {
  return (current + delta + length) % length;
}

function CountUpStat({ value, label }: { value: number; label: string }) {
  const { ref, isVisible } = useScrollReveal(0.3);
  const count = useCountUp(value, 1800, isVisible);
  return (
    <div ref={ref} className="p-5 rounded-2xl glass-hover cursor-pointer hover:shadow-lg hover:shadow-black/20 transition-all duration-300">
      <p className="font-mono text-3xl font-medium text-text-primary tracking-tight tabular-nums">
        {count.toLocaleString()}
      </p>
      <p className="text-xs text-text-secondary mt-1.5 font-medium tracking-wide">{label}</p>
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const { likedIds } = useLikedScreenshots();
  const [publicStats, setPublicStats] = useState<Stats>({ totalScreenshots: 0, totalUsers: 0, totalGames: 0 });
  const [myStats, setMyStats] = useState<MyStats | null>(null);
  const [recent, setRecent] = useState<Screenshot[]>([]);
  const [topLiked, setTopLiked] = useState<Screenshot[]>([]);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const statsRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [logoHovered, setLogoHovered] = useState(false);
  const [heroSinkProgress, setHeroSinkProgress] = useState(0);

  useEffect(() => {
    pub.screenshots({ limit: '10' }).then((data) => {
      setRecent(data.screenshots);
    }).catch((err) => console.error('Failed to load recent screenshots:', err));
    statsApi.public().then(setPublicStats).catch((err) => console.error('Failed to load public stats:', err));
    likesApi.top(5).then((data) => {
      setTopLiked(data.screenshots);
    }).catch((err) => console.error('Failed to load top liked screenshots:', err));
  }, []);

  useEffect(() => {
    if (user) {
      statsApi.my().then(setMyStats).catch((err) => console.error('Failed to load my stats:', err));
    }
  }, [user]);

  const carouselItems = topLiked.slice(0, 5);

  const lightboxImages = useMemo(() => recent.map((screenshot) => ({
    id: screenshot.id,
    file_path: screenshot.file_path,
    title: screenshot.title,
    game_name: screenshot.game_name,
    username: screenshot.username,
    display_name: screenshot.display_name,
    user_id: screenshot.user_id,
    width: screenshot.width ?? undefined,
    height: screenshot.height ?? undefined,
    created_at: screenshot.created_at,
  })), [recent]);

  const lightbox = useLightbox(lightboxImages);

  // Auto-rotate carousel
  useEffect(() => {
    if (carouselItems.length === 0) return;
    const timer = setInterval(() => {
      setCarouselIndex((i) => (i + 1) % carouselItems.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [carouselItems.length]);

  useEffect(() => {
    const handleCarouselKey = (e: KeyboardEvent) => {
      if (lightbox.isOpen) return;
      if (carouselItems.length <= 1) return;
      if (e.key === 'ArrowLeft') {
        setCarouselIndex((i) => wrapIndex(i, -1, carouselItems.length));
      } else if (e.key === 'ArrowRight') {
        setCarouselIndex((i) => wrapIndex(i, 1, carouselItems.length));
      }
    };
    window.addEventListener('keydown', handleCarouselKey);
    return () => window.removeEventListener('keydown', handleCarouselKey);
  }, [carouselItems.length, lightbox.isOpen]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({
        x: (e.clientX / window.innerWidth - 0.5) * 20,
        y: (e.clientY / window.innerHeight - 0.5) * 20,
      });
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    let ticking = false;
    const update = () => {
      const progress = Math.min(1, Math.max(0, window.scrollY / 260));
      setHeroSinkProgress((prev) => {
        const next = Math.round(progress * 1000) / 1000;
        return Math.abs(prev - next) > 0.01 ? next : prev;
      });
      ticking = false;
    };
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const heroLogoStyle = {
    transform: `translateY(${heroSinkProgress * 118}px) scale(${1 - heroSinkProgress * 0.085})`,
    opacity: 1 - heroSinkProgress * 0.18,
    filter: `blur(${heroSinkProgress * 0.9}px)`,
  };

  const heroTextStyle = {
    transform: `translateY(${heroSinkProgress * 42}px) scale(${1 - heroSinkProgress * 0.025})`,
    opacity: 1 - heroSinkProgress * 0.62,
    filter: `blur(${heroSinkProgress * 1.8}px)`,
  };

  const showcaseSinkStyle = {
    transform: `translateY(${-heroSinkProgress * 96}px) scale(${1 + heroSinkProgress * 0.035})`,
  };

  return (
    <div>
      {/* Hero */}
      <section ref={heroRef} className="home-sink-hero relative overflow-hidden pt-12 pb-10 md:pt-20 md:pb-16">
        {/* Ambient orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute top-1/4 -left-32 w-96 h-96 rounded-full opacity-15 blur-3xl animate-breathe"
            style={{
              background: 'radial-gradient(circle, rgba(232,196,154,0.2) 0%, transparent 70%)',
              transform: `translate(${mousePos.x * 0.3}px, ${mousePos.y * 0.3}px)`,
              transition: 'transform 0.8s ease-out',
            }}
          />
          <div
            className="absolute bottom-1/4 -right-32 w-80 h-80 rounded-full opacity-10 blur-3xl"
            style={{
              background: 'radial-gradient(circle, rgba(180,160,200,0.15) 0%, transparent 70%)',
              transform: `translate(${-mousePos.x * 0.2}px, ${-mousePos.y * 0.2}px)`,
              transition: 'transform 1s ease-out',
            }}
          />
          <div
            className="absolute top-3/4 left-1/2 w-64 h-64 rounded-full opacity-8 blur-3xl"
            style={{
              background: 'radial-gradient(circle, rgba(232,196,154,0.1) 0%, transparent 70%)',
              transform: `translate(${mousePos.x * 0.4}px, ${-mousePos.y * 0.3}px)`,
              transition: 'transform 1.2s ease-out',
            }}
          />
        </div>

        <div
          className="home-sink-copy max-w-5xl mx-auto px-6 text-center relative"
        >
          {/* Logo mark */}
          <div
            className="home-logo-sink-layer inline-flex"
            style={heroLogoStyle}
            onMouseEnter={() => setLogoHovered(true)}
            onMouseLeave={() => setLogoHovered(false)}
          >
          <div
            className={`home-logo-stage home-logo-mark inline-flex flex-col items-center justify-center mb-6 sm:mb-7 ${
              logoHovered ? 'home-logo-mark-hovered' : ''
            }`}
            style={{ animation: 'fadeUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
          >
            <h1 className="home-logo-word home-logo-word-redesign cursor-default select-none" aria-label="光匣">
              <span className="home-logo-glyph">光</span>
              <span className="home-logo-glyph">匣</span>
            </h1>
            <div className="home-logo-accent" />
          </div>
          </div>
          <div style={heroTextStyle}>
          <p
            className="home-logo-subtitle text-base sm:text-lg max-w-lg mx-auto mb-10 text-balance"
            style={{ animation: 'fadeUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.12s forwards', opacity: 0 }}
          >
            记录和分享游戏中的精彩瞬间
          </p>
          </div>
        </div>
      </section>

      {/* Carousel with Ken Burns */}
      {carouselItems.length > 0 && (
        <section
          className="home-sink-showcase home-product-carousel max-w-7xl mx-auto px-6 pb-10"
          style={{
            animation: 'fadeUp 0.7s ease-out 0.3s forwards',
            opacity: 0,
            ...showcaseSinkStyle,
          }}
        >
          <div
            className="home-carousel-frame"
            style={{ '--carousel-count': carouselItems.length } as React.CSSProperties}
          >
            {carouselItems.map((item, i) => (
              <div
                key={item.id}
                className={`home-carousel-slide ${
                  i === carouselIndex ? 'home-carousel-slide-active' : 'home-carousel-slide-idle'
                }`}
              >
                <img
                  src={screenshotUrl(item.id)}
                  alt={item.title}
                  className="home-carousel-image"
                />
                <div className="home-carousel-shade" />
                <div className="home-carousel-copy">
                  <h2 className="home-carousel-title">{item.game_name || '未知游戏'}</h2>
                  <p className="home-carousel-meta">by {item.display_name || item.username}</p>
                </div>
              </div>
            ))}
            {carouselItems.length > 1 && (
              <>
                <button
                  onClick={() => setCarouselIndex((i) => wrapIndex(i, -1, carouselItems.length))}
                  className="home-carousel-arrow home-carousel-arrow-prev"
                  aria-label="上一张"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={() => setCarouselIndex((i) => wrapIndex(i, 1, carouselItems.length))}
                  className="home-carousel-arrow home-carousel-arrow-next"
                  aria-label="下一张"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}
            {carouselItems.length > 1 && (
              <div className="home-carousel-progress">
              {carouselItems.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCarouselIndex(i)}
                  className={`home-carousel-dot ${i === carouselIndex ? 'home-carousel-dot-active' : ''}`}
                  aria-label={`切换到第 ${i + 1} 张`}
                />
              ))}
              </div>
            )}
          </div>
          {carouselItems.length > 1 && (
            <div className="home-carousel-count">
              <span>{String(carouselIndex + 1).padStart(2, '0')}</span>
              <span>{String(carouselItems.length).padStart(2, '0')}</span>
            </div>
          )}
        </section>
      )}

      {/* Stats with count-up */}
      <section ref={statsRef} className="max-w-7xl mx-auto px-6 pb-10">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <CountUpStat label="平台截图" value={publicStats.totalScreenshots} />
          <CountUpStat label="活跃用户" value={publicStats.totalUsers ?? 0} />
          <CountUpStat label="游戏数量" value={publicStats.totalGames ?? 0} />
          {myStats && (
            <>
              <Link to="/gallery">
                <CountUpStat label="我的截图" value={myStats.totalScreenshots} />
              </Link>
              <Link to="/gallery?public=1">
                <CountUpStat label="公开展示" value={myStats.publicCount} />
              </Link>
            </>
          )}
        </div>
      </section>

      {/* Recent with scroll reveal */}
      {recent.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 pb-20">
          <div
            className="flex items-center justify-between mb-5"
            style={{ animation: 'fadeUp 0.5s ease-out 0.4s forwards', opacity: 0 }}
          >
            <h2 className="font-display text-xl text-text-primary">最新公开展示</h2>
            <Link to="/explore" className="text-sm text-white hover:text-white/80 transition-colors duration-200 group">
              查看全部
              <span className="inline-block ml-1 transition-transform duration-200 group-hover:translate-x-0.5">-&gt;</span>
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {recent.map((screenshot, i) => (
              <div key={screenshot.id} style={{ animation: `fadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.07}s forwards`, opacity: 0 }}>
                <ImageCard
                  src={screenshotUrl(screenshot.id)}
                  thumbnailSrc={screenshot.thumbnail_path ? thumbnailUrl(screenshot.id) : undefined}
                  alt={screenshot.title}
                  title={screenshot.game_name || '未知游戏'}
                  subtitle={`by ${screenshot.display_name || screenshot.username}`}
                  onClick={() => lightbox.open(i)}
                  index={i}
                  topRightAction={
                    <LikeButton
                      screenshotId={screenshot.id}
                      initialLiked={likedIds.has(screenshot.id)}
                      initialCount={screenshot.likes_count ?? 0}
                    />
                  }
                />
              </div>
            ))}
          </div>
        </section>
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


