"use client";

import { useEffect } from "react";

/**
 * LoopPauser, pauses off-screen looping graphics to save CPU/GPU.
 *
 * Mounted once in layout.tsx, renders nothing. A single IntersectionObserver
 * watches every `[data-gfx-loop]` graphic wrapper and toggles the `.gfx-idle`
 * class when it leaves / re-enters the viewport. globals.css then sets
 * `animation-play-state: paused` on that wrapper and its descendants, so all
 * the infinite CSS loops (drifting blobs, marquee, pulsing nodes, travelling
 * packets, shimmer cells…) stop consuming frames while off-screen and resume
 * seamlessly on return.
 *
 * No-op under reduced motion: there are no loops to pause, and the observer is
 * never attached. A rootMargin buffer starts loops just before they scroll in.
 */
export default function LoopPauser() {
  useEffect(() => {
    if (
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          e.target.classList.toggle("gfx-idle", !e.isIntersecting);
        }
      },
      { rootMargin: "200px 0px" }
    );

    // Track what's already observed so re-scans (route changes) stay cheap.
    const observed = new WeakSet<Element>();
    let scheduled = 0;

    const scan = () => {
      scheduled = 0;
      document.querySelectorAll("[data-gfx-loop]").forEach((el) => {
        if (!observed.has(el)) {
          observed.add(el);
          io.observe(el);
        }
      });
    };
    const scheduleScan = () => {
      if (!scheduled) scheduled = requestAnimationFrame(scan);
    };

    scan();
    // App Router swaps page content without remounting layout, re-scan for
    // graphics added by client navigation. Coalesced to one rAF per burst.
    const mo = new MutationObserver(scheduleScan);
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
      if (scheduled) cancelAnimationFrame(scheduled);
    };
  }, []);

  return null;
}
