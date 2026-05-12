import { useRef, useState, useEffect } from 'react';

export function useCountUp(end: number, duration = 1800, trigger = true) {
  const [count, setCount] = useState(0);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!trigger || end <= 0) {
      setCount(end);
      return;
    }
    setCount(0);
    startTimeRef.current = 0;
    const step = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * end));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [end, duration, trigger]);

  return count;
}
