"use client";

import { useMemo, useState } from "react";

/**
 * AEOReadiness — a small interactive self-check.
 * Clients tick what they already do; the score and advice update live.
 * Native checkboxes keep it keyboard- and screen-reader friendly.
 */

const ITEMS: { id: string; label: string; hint: string }[] = [
  {
    id: "answers",
    label: "Each key page answers one clear question in its first paragraph",
    hint: "Answer engines lift the first direct answer they can find.",
  },
  {
    id: "schema",
    label: "Your pages use structured data (FAQ, Article, Organization schema)",
    hint: "Schema tells engines exactly what your content means.",
  },
  {
    id: "headings",
    label: "Headings are written as real questions people ask",
    hint: '"How much does X cost?" beats "Pricing".',
  },
  {
    id: "freshness",
    label: "Important pages have been updated in the last 6 months",
    hint: "Freshness is a strong signal for both Google and AI answers.",
  },
  {
    id: "entity",
    label: "Your business name, location and services are stated consistently",
    hint: "Consistent facts help engines trust and cite you.",
  },
  {
    id: "speed",
    label: "Pages load fast on mobile and pass Core Web Vitals",
    hint: "Slow pages get demoted before content even matters.",
  },
  {
    id: "citations",
    label: "You are mentioned on other trusted sites (directories, press, partners)",
    hint: "Off-site mentions build the authority engines look for.",
  },
];

function tier(pct: number): { label: string; note: string; color: string } {
  if (pct >= 85)
    return {
      label: "Answer-ready",
      note: "You are in strong shape. A focused audit can squeeze out the last gains and defend your position.",
      color: "var(--color-cyan)",
    };
  if (pct >= 50)
    return {
      label: "On your way",
      note: "Good foundations, clear gaps. A few targeted fixes could move you into AI answers quickly.",
      color: "var(--color-yellow)",
    };
  return {
    label: "Lots of upside",
    note: "Plenty of quick wins here. This is exactly the kind of starting point where results come fastest.",
    color: "#FF8A6B",
  };
}

export default function AEOReadiness() {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const pct = useMemo(
    () => Math.round((checked.size / ITEMS.length) * 100),
    [checked]
  );
  const t = tier(pct);

  return (
    <div className="mx-auto max-w-3xl rounded-3xl bg-white border border-gray-100 p-6 md:p-10"
      style={{ boxShadow: "0 12px 40px rgba(10,30,61,0.10)" }}>
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <h3 className="font-syne text-2xl md:text-3xl font-bold text-navy">
          Is your site ready for AI answers?
        </h3>
        <span
          className="font-jetbrains text-sm"
          style={{ color: "var(--color-grey-mid)" }}
        >
          {checked.size}/{ITEMS.length} ticked
        </span>
      </div>
      <p className="text-gray-500 mt-2 text-base">
        Tick everything you already do. No email required, your answers stay in
        your browser.
      </p>

      {/* Score bar */}
      <div className="mt-6">
        <div
          className="h-3 w-full rounded-full overflow-hidden"
          style={{ background: "var(--color-grey-light)" }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="AEO readiness score"
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: t.color,
              transition: "width 400ms cubic-bezier(0.22,1,0.36,1)",
            }}
          />
        </div>
        <div className="flex items-center justify-between mt-3">
          <span className="font-syne text-xl font-bold text-navy">
            {t.label}
          </span>
          <span className="font-syne text-2xl font-extrabold text-navy">
            {pct}%
          </span>
        </div>
        <p className="text-gray-600 mt-1 text-sm leading-relaxed">{t.note}</p>
      </div>

      {/* Checklist */}
      <ul className="mt-6 flex flex-col gap-3">
        {ITEMS.map((item) => {
          const on = checked.has(item.id);
          return (
            <li key={item.id}>
              <label
                className="seo-card flex items-start gap-3 rounded-xl border p-4 cursor-pointer"
                style={{
                  borderColor: on ? "var(--color-cyan)" : "var(--color-grey-light)",
                  background: on ? "rgba(61,224,232,0.08)" : "var(--color-white)",
                }}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(item.id)}
                  className="mt-1 h-5 w-5 shrink-0 accent-cyan"
                  style={{ accentColor: "var(--color-cyan)" }}
                />
                <span>
                  <span className="block text-navy font-medium text-[15px]">
                    {item.label}
                  </span>
                  <span className="block text-gray-500 text-sm mt-0.5">
                    {item.hint}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <a
          href="mailto:hello@databridges.ie?subject=AEO%20audit"
          className="inline-block rounded-full bg-navy px-7 py-3 font-semibold text-white transition-transform hover:scale-105"
        >
          Get a full audit
        </a>
        <button
          type="button"
          onClick={() => setChecked(new Set())}
          className="text-sm font-medium text-gray-500 underline underline-offset-4 hover:text-navy"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
