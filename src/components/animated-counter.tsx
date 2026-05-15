
'use client';

import { useEffect, useState, useRef } from 'react';

interface AnimatedCounterProps {
  from?: number;
  to: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}

const easeOutExpo = (t: number) => {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
};

export function AnimatedCounter({
  from = 0,
  to,
  duration = 1.5,
  prefix = '',
  suffix = '',
  decimals = 0,
}: AnimatedCounterProps) {
  const [count, setCount] = useState(from);
  const targetRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          let startTime: number | null = null;
          const animationFrame = (timestamp: number) => {
            if (!startTime) {
              startTime = timestamp;
            }
            const progress = (timestamp - startTime) / (duration * 1000);
            const easedProgress = easeOutExpo(progress);
            const currentCount = from + (to - from) * easedProgress;

            setCount(currentCount);

            if (progress < 1) {
              requestAnimationFrame(animationFrame);
            } else {
              setCount(to);
            }
          };
          requestAnimationFrame(animationFrame);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (targetRef.current) {
      observer.observe(targetRef.current);
    }

    return () => observer.disconnect();
  }, [to, from, duration]);

  return (
    <span ref={targetRef} className="text-2xl font-bold">
      {prefix}{count.toFixed(decimals)}{suffix}
    </span>
  );
}
