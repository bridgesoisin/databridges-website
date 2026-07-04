"use client";

import { useEffect } from "react";

/**
 * CursorTracer, a neon-cyan trailing cursor for desktop pointers.
 *
 * Mounted once in layout.tsx, renders nothing itself (it appends two fixed,
 * pointer-events:none nodes to <body>). Strictly gated: only runs on a real
 * mouse (pointer: fine) and never under prefers-reduced-motion; on touch it
 * attaches nothing. CSS in globals.css double-guards with (pointer: coarse)
 * and reduced-motion display:none. A single rAF lerp trails the ring toward
 * the pointer; the dot snaps each frame.
 */
export default function CursorTracer() {
  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)");
    const rm = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!fine.matches || rm.matches) return;

    const dot = document.createElement("div");
    const ring = document.createElement("div");
    dot.className = "cursor-tracer-dot";
    ring.className = "cursor-tracer-ring";
    dot.setAttribute("aria-hidden", "true");
    ring.setAttribute("aria-hidden", "true");
    document.body.append(ring, dot);

    let tx = window.innerWidth / 2;
    let ty = window.innerHeight / 2;
    let rx = tx;
    let ry = ty;
    let raf = 0;
    let shown = false;

    const onMove = (e: MouseEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      if (!shown) {
        shown = true;
        document.body.classList.add("cursor-tracer-on");
      }
      dot.style.transform = `translate3d(${tx}px, ${ty}px, 0) translate(-50%, -50%)`;
      if (!raf) raf = requestAnimationFrame(loop);
    };
    const loop = () => {
      raf = 0;
      rx += (tx - rx) * 0.15;
      ry += (ty - ry) * 0.15;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -50%)`;
      if (Math.abs(tx - rx) > 0.5 || Math.abs(ty - ry) > 0.5)
        raf = requestAnimationFrame(loop);
    };
    const onLeave = () => {
      document.body.classList.remove("cursor-tracer-on");
      shown = false;
    };
    const onDown = () => document.body.classList.add("cursor-tracer-press");
    const onUp = () => document.body.classList.remove("cursor-tracer-press");
    const onOver = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      document.body.classList.toggle(
        "cursor-tracer-hot",
        !!t.closest("a,button,[role='button'],input,textarea,select,summary")
      );
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseleave", onLeave);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("mouseover", onOver, { passive: true });

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("mouseover", onOver);
      if (raf) cancelAnimationFrame(raf);
      ring.remove();
      dot.remove();
      document.body.classList.remove(
        "cursor-tracer-on",
        "cursor-tracer-press",
        "cursor-tracer-hot"
      );
    };
  }, []);

  return null;
}
