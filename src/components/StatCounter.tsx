"use client";

import { useEffect, useRef, useState } from "react";

interface StatCounterProps {
  target: string;
  label: string;
}

export default function StatCounter({ target, label }: StatCounterProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [display, setDisplay] = useState(target);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;

    // Check if target is purely numeric (with optional + suffix)
    const numMatch = target.match(/^(\d+)(\+?)$/);
    if (!numMatch) {
      // Non-numeric — just show it
      setDisplay(target);
      return;
    }

    const targetNum = parseInt(numMatch[1], 10);
    const suffix = numMatch[2] || "";
    const duration = 1200;
    const startTime = performance.now();

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * targetNum);
      setDisplay(`${current}${suffix}`);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    }

    // Check for reduced motion
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReduced) {
      setDisplay(target);
    } else {
      setDisplay(`0${suffix}`);
      requestAnimationFrame(animate);
    }
  }, [visible, target]);

  return (
    <div ref={ref} className="text-center">
      <div className="font-syne text-5xl font-extrabold text-cyan">
        {display}
      </div>
      <div className="text-sm text-gray-400 mt-2 uppercase tracking-wide">
        {label}
      </div>
    </div>
  );
}
