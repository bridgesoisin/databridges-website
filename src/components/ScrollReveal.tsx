"use client";

import { useEffect, useRef, type JSX } from "react";

type RevealVariant =
  | "fade" // opacity only
  | "fade-up" // opacity + rise (current default)
  | "fade-down"
  | "slide-left" // enters from right
  | "slide-right" // enters from left
  | "zoom"; // opacity + slight scale

interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number; // ms
  variant?: RevealVariant; // default "fade-up"
  stagger?: boolean; // if true, direct children reveal in sequence
  staggerStep?: number; // ms between children, default 90
  as?: keyof JSX.IntrinsicElements; // default "div"
}

export default function ScrollReveal({
  children,
  className = "",
  delay = 0,
  variant = "fade-up",
  stagger = false,
  staggerStep = 90,
  as = "div",
}: ScrollRevealProps) {
  const ref = useRef<HTMLElement>(null);
  const Tag = as as React.ElementType;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            el.classList.add("revealed");
          }, delay);
          observer.unobserve(el);
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [delay]);

  const classes = [
    "scroll-reveal",
    `sr-${variant}`,
    stagger ? "sr-stagger" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Tag
      ref={ref}
      className={classes}
      style={stagger ? ({ "--sr-step": `${staggerStep}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}
