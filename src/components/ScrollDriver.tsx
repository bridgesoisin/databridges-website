"use client";

import { useEffect } from "react";

/**
 * ScrollDriver, the single scroll-progress engine for the motion system.
 *
 * Mounted once in layout.tsx, renders nothing. It writes CSS custom properties
 * that the whole system reads, so the actual animation stays in globals.css:
 *   - global (on <html>): --scroll-y, --scroll-progress, --vh
 *   - per-section (on each [data-scroll-section]): --sp
 *
 * Cheap by construction: one rAF loop, passive listeners that only flip a
 * dirty flag, and per-frame math limited to the sections currently on screen
 * (tracked by a single IntersectionObserver). Under prefers-reduced-motion it
 * takes one honest static snapshot and attaches no loop.
 */
export default function ScrollDriver() {
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let sections: HTMLElement[] = [];
    const active = new Set<HTMLElement>();
    let raf = 0;

    const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

    const measure = () => {
      raf = 0;
      const vh = window.innerHeight || 1;
      root.style.setProperty("--vh", `${vh * 0.01}px`);
      const y = window.scrollY;
      root.style.setProperty("--scroll-y", `${y}px`);
      const max = document.documentElement.scrollHeight - vh;
      root.style.setProperty(
        "--scroll-progress",
        (max > 0 ? clamp01(y / max) : 0).toFixed(4)
      );

      active.forEach((el) => {
        const r = el.getBoundingClientRect();
        // sp: 0 when top hits viewport bottom, 1 when bottom leaves viewport top
        const total = r.height + vh;
        const sp = clamp01((vh - r.top) / total);
        el.style.setProperty("--sp", sp.toFixed(4));
      });
    };

    const tick = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    const onScrollResize = () => tick();

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const el = e.target as HTMLElement;
          if (e.isIntersecting) active.add(el);
          else {
            active.delete(el);
            // settle to resting values when it leaves
            el.style.setProperty(
              "--sp",
              e.boundingClientRect.top < 0 ? "1" : "0"
            );
          }
        }
        tick();
      },
      { threshold: 0 }
    );

    const collect = () => {
      sections = Array.from(
        document.querySelectorAll<HTMLElement>("[data-scroll-section]")
      );
      sections.forEach((s) => io.observe(s));
    };

    const staticPass = () => {
      // reduced-motion: one honest snapshot, no loop
      measure();
      sections.forEach((s) => {
        s.style.setProperty("--sp", "0.5");
      });
    };

    collect();
    if (mq.matches) {
      staticPass();
    } else {
      measure();
      window.addEventListener("scroll", onScrollResize, { passive: true });
      window.addEventListener("resize", onScrollResize, { passive: true });
    }

    // Simplest correct re-init when the motion preference changes.
    const onMq = () => window.location.reload();
    mq.addEventListener?.("change", onMq);

    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScrollResize);
      window.removeEventListener("resize", onScrollResize);
      mq.removeEventListener?.("change", onMq);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return null;
}
