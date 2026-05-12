import { useState } from 'react';

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

function getPrevIndex(i: number | null, length: number): number | null {
  if (i === null) return null;
  return i > 0 ? i - 1 : length - 1;
}

function getNextIndex(i: number | null, length: number): number | null {
  if (i === null) return null;
  return i < length - 1 ? i + 1 : 0;
}

export function useLightbox(images: LightboxImage[]) {
  const [index, setIndex] = useState<number | null>(null);

  return {
    isOpen: index !== null,
    currentIndex: index,
    open: setIndex,
    close: () => setIndex(null),
    prev: () => setIndex((i) => getPrevIndex(i, images.length)),
    next: () => setIndex((i) => getNextIndex(i, images.length)),
  };
}
