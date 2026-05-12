import { useState, useEffect, useRef, useCallback } from 'react';

const VIDEO_FILES = [
  '/videos/2024steam娘动态背景合集.春促1-春季快递.27429634281.mp4',
  '/videos/2024steam娘动态背景合集.春促2-喵喵邮件.27447789161.mp4',
  '/videos/2024steam娘动态背景合集.夏促1-阳光海岸.27429634299.mp4',
  '/videos/2024steam娘动态背景合集.秋促1-寂静树林.27447789669.mp4',
  '/videos/2024steam娘动态背景合集.秋促2-秋季聚会.27429634347.mp4',
  '/videos/2024steam娘动态背景合集.冬促1-静夜思.27447789838.mp4',
  '/videos/2024steam娘动态背景合集.冬促2-沉睡蓝.27429634291.mp4',
];

const FADE_DURATION = 1000;

export default function VideoBackground() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nextIndex, setNextIndex] = useState<number | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  const goToNext = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    const next = (currentIndex + 1) % VIDEO_FILES.length;
    setNextIndex(next);
  }, [currentIndex, isTransitioning]);

  useEffect(() => {
    if (nextIndex === null) return;
    const timer = setTimeout(() => {
      setCurrentIndex(nextIndex);
      setNextIndex(null);
      setIsTransitioning(false);
    }, FADE_DURATION);
    return () => clearTimeout(timer);
  }, [nextIndex]);

  const handleVideoEnded = useCallback(() => {
    goToNext();
  }, [goToNext]);

  useEffect(() => {
    const video = videoRefs.current[currentIndex];
    if (video) {
      video.currentTime = 0;
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {});
      }
    }
  }, [currentIndex]);

  useEffect(() => {
    if (nextIndex !== null) {
      const video = videoRefs.current[nextIndex];
      if (video) {
        video.currentTime = 0;
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {});
        }
      }
    }
  }, [nextIndex]);

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: -1,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {VIDEO_FILES.map((src, i) => (
        <video
          key={src}
          ref={(el) => { videoRefs.current[i] = el; }}
          src={src}
          muted
          playsInline
          preload="metadata"
          onEnded={handleVideoEnded}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: i === currentIndex ? 1 : i === nextIndex ? 1 : 0,
            transition: `opacity ${FADE_DURATION}ms ease-in-out`,
          }}
        />
      ))}
      {/* Subtle dark overlay for readability with gradient edges */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, rgba(10, 16, 24, 0.30) 0%, rgba(10, 16, 24, 0.50) 100%)',
          zIndex: 1,
        }}
      />
    </div>
  );
}
