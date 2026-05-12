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
      className={`text-xs font-medium rounded-lg px-3 py-1.5 transition-all duration-200 ${
        !statusLoaded
          ? 'bg-white/[0.04] border border-border backdrop-blur-sm text-text-muted'
          : isFollowing
            ? 'bg-white/[0.04] backdrop-blur-sm text-text-secondary border border-border hover:border-red-500/30 hover:text-red-400'
            : 'bg-accent text-primary hover:bg-accent-hover active:scale-[0.97]'
      } disabled:opacity-50 ${className}`}
    >
      {!statusLoaded ? '' : loading ? '...' : isFollowing ? '已关注' : '+ 关注'}
    </button>
  );
}
