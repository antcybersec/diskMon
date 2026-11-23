import { useEffect, useRef, useState } from 'react';

/**
 * Returns a ref and a progress value that animates from 0 to 1 the first time the element
 * scrolls into view. With reduced motion it jumps straight to 1.
 */
export function useRevealProgress<T extends Element>(duration = 1200, threshold = 0.35) {
  const ref = useRef<T>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      observer.disconnect();
      if (reduced) { setProgress(1); return; }
      const start = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - start) / duration);
        setProgress(p);
        if (p < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    }, { threshold });
    observer.observe(el);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [duration, threshold]);

  return [ref, progress] as const;
}
