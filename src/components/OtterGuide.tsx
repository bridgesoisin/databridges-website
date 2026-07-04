"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";

/**
 * OtterGuide — the DataBridges mascot.
 *
 * Pure guide, no chatbot (the AI chat is paused until a backend/API is wired;
 * see src/app/api/otter/route.ts for the ready seam). The otter:
 *   - plays an entrance wave, then floats
 *   - shows a "works-at-laptop" reading pose when the visitor scrolls calmly
 *   - perks into a "searching" pose on chaotic scrolling and offers a guide
 *   - surfaces contextual + AI-usage tips, capped at MAX_TIPS per visitor
 *   - opens a small navigation menu when clicked
 * All motion is CSS in globals.css and respects prefers-reduced-motion.
 */

interface QuickReply {
  label: string;
  replyText?: string;
  scrollTo?: string;
  href?: string;
}

interface Tip {
  message: string;
  replies: QuickReply[];
  kind?: "ai" | "guide" | "section" | "menu";
}

type VisualState = "idle" | "reading" | "searching";

/* Contextual tips per on-page section (guides the user through the page) */
const SECTION_TIPS: Record<string, Tip> = {
  services: {
    kind: "section",
    message: "Spreadsheet chaos sound familiar? I can point you at the right fix.",
    replies: [
      { label: "Show me what you actually do", scrollTo: "what-we-do" },
      { label: "Read the FAQ", href: "/faq" },
    ],
  },
  "what-we-do": {
    kind: "section",
    message: "Four services, one honest question: which one's actually your problem?",
    replies: [
      { label: "I'm buried in spreadsheets", href: "/services#power-platform" },
      { label: "I want AI that actually works", href: "/services#ai-consulting" },
    ],
  },
  "eu-ai-act-checker": {
    kind: "section",
    message:
      "The AI Act's August 2026 transparency deadline catches more businesses than people expect — chatbots and AI content count. Worth 30 seconds.",
    replies: [
      { label: "Take the check below", scrollTo: "eu-ai-act-checker" },
      { label: "More questions? FAQ", href: "/faq" },
    ],
  },
  "about-teaser": {
    kind: "section",
    message:
      "Oisín's the one you'd actually be talking to, not a rotating cast of account managers.",
    replies: [{ label: "Read the full story", href: "/about" }],
  },
  "footer-cta": {
    kind: "section",
    message: "No sales script, thirty minutes, an honest chat. That's really it.",
    replies: [{ label: "Book a free chat", href: "mailto:hello@databridges.ie" }],
  },
};

const PATHNAME_FALLBACK: Record<string, Tip> = {
  "/services": {
    kind: "section",
    message: "Not sure which service fits? The FAQ answers most of it in a sentence each.",
    replies: [
      { label: "Read the FAQ", href: "/faq" },
      { label: "Talk to Oisín", href: "mailto:hello@databridges.ie" },
    ],
  },
  "/about": {
    kind: "section",
    message: "Curious what an astrophysicist is doing fixing spreadsheets for a living?",
    replies: [{ label: "Book a free chat", href: "mailto:hello@databridges.ie" }],
  },
  "/faq": {
    kind: "section",
    message: "Can't find your question here? A real answer is one email away.",
    replies: [{ label: "Email hello@databridges.ie", href: "mailto:hello@databridges.ie" }],
  },
  "/contact": {
    kind: "section",
    message: "Stuck on what to write? Just say what's broken, that's enough to start.",
    replies: [{ label: "Email hello@databridges.ie", href: "mailto:hello@databridges.ie" }],
  },
};

/* AI-usage tips shown when the user goes idle */
const AI_TIPS: Tip[] = [
  {
    kind: "ai",
    message:
      "AI tip: before automating a task, write down the exact steps you do by hand. Half of them usually turn out to be unnecessary.",
    replies: [
      { label: "Show me what you'd automate", href: "/services" },
      { label: "Read the FAQ", href: "/faq" },
    ],
  },
  {
    kind: "ai",
    message:
      "AI tip: treat AI like a fast intern. Brilliant first drafts, but keep a human check on anything that leaves the building.",
    replies: [
      {
        label: "How do you build that in?",
        replyText:
          "We design workflows with a human approval step where it matters, so AI speeds you up without making unchecked decisions.",
      },
      { label: "Book a free chat", href: "mailto:hello@databridges.ie" },
    ],
  },
  {
    kind: "ai",
    message:
      "AI tip: your messiest spreadsheet is usually the best place to start. That's where AI saves the most time.",
    replies: [
      { label: "That's basically all of them", href: "/services#power-platform" },
      { label: "See common questions", href: "/faq" },
    ],
  },
];

/* Shown when the user scrolls around chaotically (looks like they're searching) */
const SEARCH_GUIDE: Tip = {
  kind: "guide",
  message: "Looking for something specific? I can take you straight there.",
  replies: [
    { label: "See all services", href: "/services" },
    { label: "Read the FAQ", href: "/faq" },
    { label: "Get in touch", href: "mailto:hello@databridges.ie" },
  ],
};

/* Opened when the visitor clicks the otter (does not count toward the tip cap) */
const GUIDE_MENU: Tip = {
  kind: "menu",
  message: "Hi, I'm the DataBridges otter. Where can I take you?",
  replies: [
    { label: "What we do", href: "/services" },
    { label: "Common questions (FAQ)", href: "/faq" },
    { label: "About Oisín", href: "/about" },
    { label: "Book a free chat", href: "mailto:hello@databridges.ie" },
  ],
};

const IDLE_MS = 9000;
const TIP_COOLDOWN_MS = 20000;
const DIRECTION_WINDOW_MS = 4000;
const DIRECTION_CHANGES_TO_TRIGGER = 3;
const READING_REVERT_MS = 2600;
const SEARCHING_REVERT_MS = 4000;
const MAX_TIPS = 5; // hard cap on auto tips per visitor (persisted)
const TIP_COUNT_KEY = "db_otter_tip_count";

export default function OtterGuide() {
  const pathname = usePathname();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [entering, setEntering] = useState(false);
  const [bubble, setBubble] = useState<Tip | null>(null);
  const [visual, setVisual] = useState<VisualState>("idle");

  const activeSectionRef = useRef<string | null>(null);
  const shownKeysRef = useRef<Set<string>>(new Set());
  const lastActivityRef = useRef<number>(0);
  const lastTipAtRef = useRef<number>(0);
  const scrollYRef = useRef<number>(0);
  const lastDirectionRef = useRef<"up" | "down" | null>(null);
  const directionChangesRef = useRef<number[]>([]);
  const reducedMotionRef = useRef(false);
  const aiTipIndexRef = useRef(0);
  const tipCountRef = useRef(0);
  const menuOpenRef = useRef(false);
  const readingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toggleBtnRef = useRef<HTMLButtonElement>(null);

  const menuOpen = bubble?.kind === "menu";
  useEffect(() => {
    menuOpenRef.current = menuOpen;
  }, [menuOpen]);

  // Entrance + reduced motion + restore persisted tip count
  useEffect(() => {
    reducedMotionRef.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    lastActivityRef.current = Date.now();
    try {
      tipCountRef.current = Number(
        window.localStorage.getItem(TIP_COUNT_KEY) ?? "0"
      );
    } catch {
      tipCountRef.current = 0;
    }
    const t = setTimeout(
      () => {
        setMounted(true);
        if (!reducedMotionRef.current) {
          setEntering(true);
          setTimeout(() => setEntering(false), 1300);
        }
      },
      reducedMotionRef.current ? 0 : 700
    );
    return () => clearTimeout(t);
  }, []);

  // Track which tagged section is most visible
  useEffect(() => {
    const sections = Array.from(
      document.querySelectorAll<HTMLElement>("[data-otter-section]")
    );
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let best: { id: string; ratio: number } | null = null;
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.otterSection;
          if (!id) continue;
          if (entry.isIntersecting) {
            if (!best || entry.intersectionRatio > best.ratio) {
              best = { id, ratio: entry.intersectionRatio };
            }
          }
        }
        if (best) activeSectionRef.current = best.id;
      },
      { threshold: [0.3, 0.5, 0.7] }
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [pathname]);

  const enterSearching = useCallback(() => {
    if (menuOpenRef.current) return;
    setVisual("searching");
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(
      () => setVisual("idle"),
      SEARCHING_REVERT_MS
    );
  }, []);

  const enterReading = useCallback(() => {
    if (menuOpenRef.current) return;
    setVisual((prev) => (prev === "searching" ? prev : "reading"));
    if (readingTimerRef.current) clearTimeout(readingTimerRef.current);
    readingTimerRef.current = setTimeout(
      () => setVisual((prev) => (prev === "reading" ? "idle" : prev)),
      READING_REVERT_MS
    );
  }, []);

  // Show an auto tip, respecting the per-visitor cap
  const showAutoTip = useCallback((tip: Tip, key: string) => {
    if (tipCountRef.current >= MAX_TIPS) return;
    lastTipAtRef.current = Date.now();
    shownKeysRef.current.add(key);
    tipCountRef.current += 1;
    try {
      window.localStorage.setItem(TIP_COUNT_KEY, String(tipCountRef.current));
    } catch {
      /* storage unavailable, cap still holds for the session */
    }
    setBubble(tip);
  }, []);

  const maybeShowIdleTip = useCallback(() => {
    if (menuOpenRef.current) return;
    if (tipCountRef.current >= MAX_TIPS) return;
    const now = Date.now();
    if (now - lastTipAtRef.current < TIP_COOLDOWN_MS) return;

    const sectionId = activeSectionRef.current;
    if (
      sectionId &&
      SECTION_TIPS[sectionId] &&
      !shownKeysRef.current.has(sectionId)
    ) {
      showAutoTip(SECTION_TIPS[sectionId], sectionId);
      return;
    }
    if (PATHNAME_FALLBACK[pathname] && !shownKeysRef.current.has(pathname)) {
      showAutoTip(PATHNAME_FALLBACK[pathname], pathname);
      return;
    }
    const tip = AI_TIPS[aiTipIndexRef.current % AI_TIPS.length];
    aiTipIndexRef.current += 1;
    showAutoTip(tip, tip.message);
  }, [pathname, showAutoTip]);

  // Idle detection
  useEffect(() => {
    const resetActivity = () => {
      lastActivityRef.current = Date.now();
    };
    const events: (keyof WindowEventMap)[] = [
      "mousemove",
      "keydown",
      "click",
      "touchstart",
    ];
    events.forEach((e) =>
      window.addEventListener(e, resetActivity, { passive: true })
    );

    const interval = setInterval(() => {
      if (Date.now() - lastActivityRef.current > IDLE_MS) {
        maybeShowIdleTip();
      }
    }, 2000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, resetActivity));
      clearInterval(interval);
    };
  }, [maybeShowIdleTip]);

  // Scroll: distinguishes calm reading from chaotic searching
  useEffect(() => {
    scrollYRef.current = window.scrollY;
    const handleScroll = () => {
      lastActivityRef.current = Date.now();
      const y = window.scrollY;
      const direction: "up" | "down" | null =
        y > scrollYRef.current ? "down" : y < scrollYRef.current ? "up" : null;
      const delta = Math.abs(y - scrollYRef.current);
      scrollYRef.current = y;

      let chaotic = false;
      if (
        direction &&
        lastDirectionRef.current &&
        direction !== lastDirectionRef.current
      ) {
        const now = Date.now();
        directionChangesRef.current.push(now);
        directionChangesRef.current = directionChangesRef.current.filter(
          (t) => now - t < DIRECTION_WINDOW_MS
        );
        if (directionChangesRef.current.length >= DIRECTION_CHANGES_TO_TRIGGER) {
          directionChangesRef.current = [];
          chaotic = true;
        }
      }
      if (direction) lastDirectionRef.current = direction;

      if (chaotic) {
        enterSearching();
        const now = Date.now();
        if (
          tipCountRef.current < MAX_TIPS &&
          now - lastTipAtRef.current >= TIP_COOLDOWN_MS &&
          !menuOpenRef.current
        ) {
          showAutoTip(SEARCH_GUIDE, "__search_guide__");
        }
      } else if (delta > 4) {
        enterReading();
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [enterReading, enterSearching, showAutoTip]);

  const goTo = useCallback(
    (r: QuickReply) => {
      if (r.scrollTo) {
        const el = document.getElementById(r.scrollTo);
        el?.scrollIntoView({
          behavior: reducedMotionRef.current ? "auto" : "smooth",
          block: "start",
        });
      }
      if (r.href) {
        if (r.href.startsWith("mailto:") || r.href.startsWith("http")) {
          window.location.href = r.href;
        } else {
          router.push(r.href);
        }
      }
    },
    [router]
  );

  const handleReply = (r: QuickReply) => {
    // A reply that carries a longer answer expands the bubble in place.
    if (r.replyText) {
      setBubble({
        kind: bubble?.kind ?? "ai",
        message: r.replyText,
        replies: [{ label: "Got it" }],
      });
      return;
    }
    setBubble(null);
    if (r.scrollTo || r.href) goTo(r);
  };

  const dismissBubble = () => setBubble(null);

  const toggleMenu = () => {
    if (menuOpen) {
      setBubble(null);
      return;
    }
    setVisual("idle");
    setBubble(GUIDE_MENU);
  };

  // Escape closes any open bubble
  useEffect(() => {
    if (!bubble) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setBubble(null);
        toggleBtnRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bubble]);

  const stateClass = menuOpen ? "" : `otter-${visual}`;
  const showLaptop = !menuOpen && visual === "reading";
  const showSearch = !menuOpen && visual === "searching";
  const showSpark = !menuOpen && !!bubble && bubble.kind === "ai";

  return (
    <div
      className={`otter-guide-root ${mounted ? "otter-mounted" : ""} ${
        entering ? "otter-enter" : ""
      } ${stateClass}`}
      style={{ position: "fixed", right: "20px", bottom: "20px", zIndex: 60 }}
    >
      {/* Speech bubble: tips + guide menu */}
      {bubble && (
        <div
          className="otter-bubble"
          role="status"
          aria-live="polite"
          style={{
            position: "absolute",
            bottom: "76px",
            right: "0",
            width: "268px",
            background: "var(--color-white)",
            border: "1px solid var(--color-grey-light)",
            borderRadius: "16px",
            padding: "14px 16px",
            boxShadow: "0 8px 24px rgba(10,30,61,0.15)",
            zIndex: 5,
          }}
        >
          <button
            onClick={dismissBubble}
            aria-label="Dismiss"
            style={{
              position: "absolute",
              top: "8px",
              right: "8px",
              width: "20px",
              height: "20px",
              lineHeight: 1,
              color: "var(--color-grey-mid)",
              fontSize: "14px",
            }}
          >
            &times;
          </button>
          <p
            className="text-navy"
            style={{ fontSize: "14px", lineHeight: 1.5, paddingRight: "10px" }}
          >
            {bubble.message}
          </p>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              marginTop: "10px",
            }}
          >
            {bubble.replies.map((r) => (
              <button
                key={r.label}
                onClick={() => handleReply(r)}
                className="hover:bg-offwhite"
                style={{
                  textAlign: "left",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "var(--color-navy)",
                  border: "1px solid var(--color-grey-light)",
                  borderRadius: "999px",
                  padding: "6px 12px",
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              bottom: "-6px",
              right: "24px",
              width: "12px",
              height: "12px",
              background: "var(--color-white)",
              borderRight: "1px solid var(--color-grey-light)",
              borderBottom: "1px solid var(--color-grey-light)",
              transform: "rotate(45deg)",
            }}
          />
        </div>
      )}

      {/* Reading prop: otter working at a little laptop */}
      <div
        className={`otter-prop otter-laptop ${
          showLaptop ? "otter-prop-visible" : ""
        }`}
        aria-hidden="true"
      >
        <svg width="34" height="26" viewBox="0 0 34 26" fill="none">
          <rect x="6" y="2" width="22" height="15" rx="2" fill="var(--color-navy)" />
          <rect x="8.5" y="4.5" width="17" height="10" rx="1" fill="var(--color-cyan)" />
          <path d="M2 22 L32 22 L29 17 L5 17 Z" fill="var(--color-navy)" />
          <g fill="var(--color-white)">
            <rect className="otter-key" x="11" y="8" width="3" height="2.4" rx="0.6" />
            <rect className="otter-key" x="15.5" y="8" width="3" height="2.4" rx="0.6" />
            <rect className="otter-key" x="20" y="8" width="3" height="2.4" rx="0.6" />
            <rect className="otter-key" x="13" y="11.4" width="8" height="2" rx="0.6" />
          </g>
        </svg>
      </div>

      {/* Searching prop: magnifier glow while the user hunts around */}
      <div
        className={`otter-prop otter-search ${
          showSearch ? "otter-prop-visible" : ""
        }`}
        aria-hidden="true"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle
            cx="10"
            cy="10"
            r="6.5"
            stroke="var(--color-navy)"
            strokeWidth="2.4"
            fill="var(--color-cyan)"
            fillOpacity="0.35"
          />
          <line
            x1="15"
            y1="15"
            x2="21"
            y2="21"
            stroke="var(--color-navy)"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Sparkle prop: shown with an AI usage tip */}
      <div
        className={`otter-prop otter-spark ${
          showSpark ? "otter-prop-visible" : ""
        }`}
        aria-hidden="true"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path
            d="M10 1 L11.6 7 L18 8.6 L11.6 10.2 L10 16 L8.4 10.2 L2 8.6 L8.4 7 Z"
            fill="var(--color-yellow)"
          />
        </svg>
      </div>

      {/* Toggle avatar button. Wrapped in a scroll-layer span so the
          scroll-driven lean (globals.css) composes with, rather than
          clobbers, the button's own idle/state pose animations. */}
      <span className="otter-scroll-layer">
        <button
          ref={toggleBtnRef}
          onClick={toggleMenu}
          aria-label={
            menuOpen
              ? "Close the DataBridges otter menu"
              : "Open the DataBridges otter guide"
          }
          aria-expanded={menuOpen}
          className="otter-avatar-btn"
          style={{
            position: "relative",
            background: "transparent",
            border: "none",
            padding: 0,
          }}
        >
          <Image
            src="/images/mascot/otter-avatar.png"
            alt=""
            fill
            sizes="(max-width: 640px) 140px, 256px"
            style={{
              objectFit: "contain",
              filter: "drop-shadow(0 6px 8px rgba(10, 30, 61, 0.28))",
            }}
          />
        </button>
      </span>
    </div>
  );
}
