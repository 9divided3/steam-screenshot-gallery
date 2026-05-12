import { useState, useEffect } from 'react';
import { likes as likesApi } from '../api/client';
import { useAuth } from '../context/AuthContext';

export function useLikedScreenshots() {
  const { user } = useAuth();
  const [likedIds, setLikedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!user) {
      setLikedIds(new Set());
      return;
    }
    likesApi.myLikes().then((data) => {
      setLikedIds(new Set(data.likedIds));
    }).catch(() => {});
  }, [user]);

  return { likedIds, isLiked: (id: number) => likedIds.has(id) };
}
