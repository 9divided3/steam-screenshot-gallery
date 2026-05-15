import { useState, useEffect } from 'react';
import { follows as followsApi } from '../../api/client';

interface FollowButtonProps {
  userId: number;
  initialIsFollowing?: boolean;
  onToggle?: (isFollowing: boolean) => void;
  className?: string;
}

export default function FollowButton({ userId, initialIsFollowing, onToggle, className = '' }: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing ?? false);
  const [loading, setLoading] = useState(false);
  const [statusLoaded, setChecked] = useState(initialIsFollowing !== undefined);

  useEffect(() => {
    if (initialIsFollowing !== undefined) {
      setIsFollowing(initialIsFollowing);
      setChecked(true);
      return;
    }
    // Auto-detect follow status
    followsApi.status(userId).then((data) => {
      setIsFollowing(data.is_following);
      setChecked(true);
    }).catch(() => {
      setChecked(true);
    });
  }, [userId, initialIsFollowing]);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!statusLoaded) return;
    setLoading(true);
    const wasFollowing = isFollowing;
    // Optimistic update
    setIsFollowing(!wasFollowing);
    try {
      if (wasFollowing) {
        await followsApi.unfollow(userId);
      } else {
        await followsApi.follow(userId);
      }
      onToggle?.(!wasFollowing);
    } catch {
      // Revert on failure
      setIsFollowing(wasFollowing);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading || !statusLoaded}
      className={`btn-chip ${
        className.includes('btn-profile')
          ? '!border-zinc-100/60 !bg-zinc-500/[0.58] !text-white hover:!border-white hover:!bg-zinc-400/[0.68]'
          :
        !statusLoaded
          ? '!border-white/[0.18] !bg-white/[0.12] !text-text-muted'
          : isFollowing
            ? '!border-red-200/55 !bg-red-500/[0.18] !text-red-100 hover:!border-red-200/80 hover:!bg-red-500/[0.38] hover:!text-white'
            : '!border-red-200/85 !bg-red-500/[0.58] !text-white hover:!border-red-100 hover:!bg-red-500/[0.72] hover:!text-white'
      } ${className}`}
    >
      {!statusLoaded ? '' : loading ? '...' : isFollowing ? '已关注' : '+ 关注'}
    </button>
  );
}
