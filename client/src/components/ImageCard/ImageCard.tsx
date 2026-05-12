import { useState, useRef, useCallback } from 'react';

interface ImageCardProps {
  src: string;
  thumbnailSrc?: string;
  alt?: string;
  title?: string;
  subtitle?: string;
  onClick?: () => void;
  className?: string;
  aspectRatio?: string;
  index?: number;
  showOverlay?: boolean;
  overlayContent?: React.ReactNode;
  topLeftAction?: React.ReactNode;
  topRightAction?: React.ReactNode;
}

export default function ImageCard({
  src,
  thumbnailSrc,
  alt = '',
  title,
  subtitle,
  onClick,
  className = '',
  aspectRatio = '16/10',
  index = 0,
  showOverlay = true,
  overlayContent,
  topLeftAction,
  topRightAction,
}: ImageCardProps) {
  const [loaded, setLoaded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState('');
  const [shinePos, setShinePos] = useState({ x: 50, y: 50 });

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const rotateX = (y - 0.5) * -8;
    const rotateY = (x - 0.5) * 8;
    setTransform(`perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`);
    setShinePos({ x: x * 100, y: y * 100 });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTransform('');
    setShinePos({ x: 50, y: 50 });
  }, []);

  const imgSrc = thumbnailSrc || src;

  return (
    <div
      ref={cardRef}
      className={`group relative rounded-xl overflow-hidden glass cursor-pointer hover-lift hover-glow ${className}`}
      style={{
        aspectRatio,
        transform: transform || undefined,
        transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease, border-color 0.3s ease',
        opacity: 0,
        animation: `fadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${(index % 20) * 0.05}s forwards`,
      }}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Image with zoom + shine */}
      <div className="img-hover-zoom absolute inset-0">
        {!loaded && <div className="absolute inset-0 skeleton" />}
        <img
          src={imgSrc}
          alt={alt}
          className={`w-full h-full object-cover ${loaded ? 'img-blur-in' : ''}`}
          style={{ animationDelay: `${(index % 20) * 0.05 + 0.1}s` }}
          onLoad={() => setLoaded(true)}
          loading="lazy"
        />
        {/* Dynamic shine following cursor */}
        <div
          className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle at ${shinePos.x}% ${shinePos.y}%, rgba(255,255,255,0.08) 0%, transparent 60%)`,
          }}
        />
      </div>

      {/* Top actions */}
      {topLeftAction && (
        <div className="absolute top-2 left-2 z-10">
          {topLeftAction}
        </div>
      )}
      {topRightAction && (
        <div className="absolute top-2 right-2 z-10" onClick={(e) => e.stopPropagation()}>
          {topRightAction}
        </div>
      )}

      {/* Overlay */}
      {showOverlay && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent opacity-80 group-hover:opacity-100 transition-all duration-300" />
      )}

      {/* Bottom info */}
      {(title || subtitle || overlayContent) && (
        <div className="absolute bottom-0 left-0 right-0 p-3 z-10">
          {overlayContent}
          {title && <p className="text-xs text-white/90 truncate font-medium">{title}</p>}
          {subtitle && <p className="text-[10px] text-white/85 truncate mt-0.5">{subtitle}</p>}
        </div>
      )}
    </div>
  );
}
