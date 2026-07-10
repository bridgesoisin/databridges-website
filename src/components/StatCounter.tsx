"use client";

import { useEffect, useRef, useState } from "react";

interface StatCounterProps {
  target: string;
  label: string;
  /** Accent for the number. One yellow per band max (the "spark"). */
  accent?: "cyan" | "yellow";
}

export default function StatCounter({
  target,
  label,
  accent = "cyan",
}: StatCounterProps) {
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

    // Non-numeric targets (initial state) already display verbatim.
    const numMatch = target.match(/^(\d+)(\+?)$/);
    if (!numMatch) return;

    // Reduced motion: keep the static final value, no count-up.
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReduced) return;

    const targetNum = parseInt(numMatch[1], 10);
    const suffix = numMatch[2] || "";
    const duration = 1200;
    const startTime = performance.now();
    let rafId: number;

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * targetNum);
      setDisplay(`${current}${suffix}`);

      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      }
    }

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [visible, target]);

  return (
    <div ref={ref} className="text-center">
      <div
        className={`font-syne text-5xl font-extrabold tabular-nums ${
          accent === "yellow" ? "text-yellow" : "text-cyan"
        }`}
      >
        {display}
      </div>
      <div className="text-sm text-gray-400 mt-2 uppercase tracking-wide">
        {label}
      </div>
    </div>
  );
}
