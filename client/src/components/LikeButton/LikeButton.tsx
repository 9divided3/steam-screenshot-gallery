import { useState } from 'react';
import { likes } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

interface LikeButtonProps {
  screenshotId: number;
  initialLiked?: boolean;
  initialCount?: number;
  onLikeChange?: (liked: boolean, count: number) => void;
}

export default function LikeButton({ screenshotId, initialLiked = false, initialCount = 0, onLikeChange }: LikeButtonProps) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [pending, setPending] = useState(false);

  if (!user) return null;

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (pending) return;
    setPending(true);
    const prevLiked = liked;
    const prevCount = count;
    setLiked(!liked);
    setCount((c) => (liked ? Math.max(0, c - 1) : c + 1));
    try {
      if (prevLiked) {
        const data = await likes.unlike(screenshotId);
        setCount(data.likes_count);
        onLikeChange?.(false, data.likes_count);
      } else {
        const data = await likes.like(screenshotId);
        setCount(data.likes_count);
        onLikeChange?.(true, data.likes_count);
      }
    } catch {
      setLiked(prevLiked);
      setCount(prevCount);
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className={`btn-chip ${
        liked
          ? '!border-rose-200/70 !bg-rose-400/[0.38] !text-rose-50 hover:!bg-rose-400/[0.48]'
          : '!border-slate-200/55 !bg-slate-500/[0.34] !text-white hover:!border-rose-200/60 hover:!bg-rose-400/[0.30]'
      }`}
    >
      <span className={`transition-transform duration-200 ${liked ? 'scale-110' : ''}`}>
        {liked ? (
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
        )}
      </span>
      {count > 0 && <span>{count}</span>}
    </button>
  );
}
