"use client";

import { useState } from "react";

export default function BeforeAfterToggle() {
  const [showAfter, setShowAfter] = useState(false);

  return (
    <section
      aria-labelledby="before-after-heading"
      className="bg-navy py-24 px-6"
    >
      <div className="mx-auto max-w-4xl">
        <h2
          id="before-after-heading"
          className="font-syne text-4xl font-bold text-white text-center mb-4"
        >
          What We Actually Change
        </h2>
        <p className="text-gray-400 text-center mb-12">
          Same data. Completely different future.
        </p>

        {/* Toggle control */}
        <div className="flex justify-center gap-2 mb-10">
          <button
            onClick={() => setShowAfter(false)}
            aria-pressed={!showAfter}
            className={`px-6 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
              !showAfter
                ? "bg-cyan text-navy"
                : "border border-white/20 text-white/60 hover:text-white"
            }`}
          >
            Before
          </button>
          <button
            onClick={() => setShowAfter(true)}
            aria-pressed={showAfter}
            className={`px-6 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
              showAfter
                ? "bg-cyan text-navy"
                : "border border-white/20 text-white/60 hover:text-white"
            }`}
          >
            After
          </button>
        </div>

        {/* Panels */}
        <div className="relative">
          {/* BEFORE panel */}
          <div
            className={`toggle-panel ${
              !showAfter
                ? "opacity-100 scale-100"
                : "opacity-0 scale-95 absolute inset-0 pointer-events-none"
            }`}
          >
            <div className="font-jetbrains bg-white rounded-xl overflow-hidden text-xs">
              {/* Header row */}
              <div className="bg-gray-200 flex border-b border-gray-300">
                <div className="w-8 py-1.5 px-2 text-gray-500 border-r border-gray-300">
                  &nbsp;
                </div>
                {["A", "B", "C", "D", "E", "F", "G"].map((col) => (
                  <div
                    key={col}
                    className="flex-1 py-1.5 px-2 text-center text-gray-600 border-r border-gray-300 font-medium"
                  >
                    {col}
                  </div>
                ))}
              </div>

              {/* Row 1 */}
              <div className="flex border-b border-gray-200">
                <div className="w-8 py-2 px-2 text-gray-400 border-r border-gray-200 bg-gray-50">
                  1
                </div>
                <div className="flex-1 py-2 px-2 border-r border-gray-200 text-gray-700">
                  Name
                </div>
                <div className="flex-1 py-2 px-2 border-r border-gray-200 text-gray-700">
                  Dept
                </div>
                <div className="flex-1 py-2 px-2 border-r border-gray-200 text-gray-700">
                  Hours
                </div>
                <div className="flex-1 py-2 px-2 border-r border-gray-200 text-red-600 bg-red-50 font-bold">
                  #REF!
                </div>
                <div className="flex-[3] py-2 px-2 text-gray-500 italic col-span-3">
                  FINAL FINAL (use this one)
                </div>
              </div>

              {/* Row 2 */}
              <div className="flex border-b border-gray-200">
                <div className="w-8 py-2 px-2 text-gray-400 border-r border-gray-200 bg-gray-50">
                  2
                </div>
                <div className="flex-1 py-2 px-2 border-r border-gray-200 text-gray-700">
                  Murphy
                </div>
                <div className="flex-1 py-2 px-2 border-r border-gray-200 text-gray-700">
                  Finance
                </div>
                <div className="flex-1 py-2 px-2 border-r border-gray-200 text-gray-700">
                  37.5
                </div>
                <div className="flex-1 py-2 px-2 border-r border-gray-200 text-gray-500 text-[10px]">
                  =SUM(B2:B47) &larr; DO NOT DELETE
                </div>
                <div className="flex-1 py-2 px-2 border-r border-gray-200 text-gray-700">
                  &nbsp;
                </div>
                <div className="flex-1 py-2 px-2 border-r border-gray-200 text-gray-700">
                  &nbsp;
                </div>
                <div className="flex-1 py-2 px-2 text-gray-700">&nbsp;</div>
              </div>

              {/* Row 3 */}
              <div className="flex border-b border-gray-200">
                <div className="w-8 py-2 px-2 text-gray-400 border-r border-gray-200 bg-gray-50">
                  3
                </div>
                <div className="flex-1 py-2 px-2 border-r border-gray-200 text-gray-700">
                  O&apos;Brien
                </div>
                <div className="flex-1 py-2 px-2 border-r border-gray-200 text-gray-700">
                  HR
                </div>
                <div className="flex-1 py-2 px-2 border-r border-gray-200 text-gray-700">
                  40
                </div>
                <div className="flex-1 py-2 px-2 border-r border-gray-200 text-gray-700">
                  €32,100
                </div>
                <div className="flex-1 py-2 px-2 border-r border-gray-200 text-gray-700">
                  &nbsp;
                </div>
                <div className="flex-1 py-2 px-2 border-r border-gray-200 text-gray-400 text-[10px]">
                  40,823 KB
                </div>
                <div className="flex-1 py-2 px-2 text-gray-700">&nbsp;</div>
              </div>

              {/* Row 4 */}
              <div className="flex border-b border-gray-200">
                <div className="w-8 py-2 px-2 text-gray-400 border-r border-gray-200 bg-gray-50">
                  4
                </div>
                <div className="flex-1 py-2 px-2 border-r border-gray-200 text-gray-700">
                  Kelly
                </div>
                <div className="flex-1 py-2 px-2 border-r border-gray-200 text-orange-600">
                  ???
                </div>
                <div className="flex-1 py-2 px-2 border-r border-gray-200 text-gray-700">
                  35
                </div>
                <div className="flex-1 py-2 px-2 border-r border-gray-200 text-gray-700">
                  €28,400
                </div>
                <div className="flex-1 py-2 px-2 border-r border-gray-200 text-gray-700">
                  &nbsp;
                </div>
                <div className="flex-1 py-2 px-2 border-r border-gray-200 text-gray-700">
                  &nbsp;
                </div>
                <div className="flex-1 py-2 px-2 text-gray-700">&nbsp;</div>
              </div>

              {/* Status bar */}
              <div className="bg-gray-100 py-1.5 px-3 text-[10px] text-gray-500 border-t border-gray-300 flex justify-between">
                <span>Ready</span>
                <span className="text-amber-600">
                  ⚠ Circular reference warning
                </span>
              </div>
            </div>
          </div>

          {/* AFTER panel */}
          <div
            className={`toggle-panel ${
              showAfter
                ? "opacity-100 scale-100"
                : "opacity-0 scale-95 absolute inset-0 pointer-events-none"
            }`}
          >
            <div className="bg-gray-50 rounded-xl p-6">
              {/* KPI cards */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                  { value: "€142k", label: "saved" },
                  { value: "14hrs/week", label: "automated" },
                  { value: "0", label: "data errors" },
                ].map((kpi) => (
                  <div
                    key={kpi.label}
                    className="bg-white rounded-xl p-4 text-center border border-gray-100"
                  >
                    <div className="font-syne text-2xl font-bold text-cyan">
                      {kpi.value}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {kpi.label}
                    </div>
                  </div>
                ))}
              </div>

              {/* Bar chart */}
              <div className="bg-white rounded-xl p-4 border border-gray-100 mb-6">
                <p className="text-xs text-gray-500 mb-3 font-medium">
                  Monthly Output
                </p>
                <div className="flex items-end gap-2 h-24">
                  {[30, 40, 45, 55, 65, 80, 90, 95].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t"
                      style={{
                        height: `${h}%`,
                        backgroundColor:
                          i >= 6 ? "var(--color-cyan)" : "var(--color-navy)",
                        opacity: i < 6 ? 0.6 + i * 0.06 : 1,
                      }}
                    />
                  ))}
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-[10px] text-gray-400">
                    Jan
                  </span>
                  <span className="text-[10px] text-gray-400">
                    Aug
                  </span>
                </div>
              </div>

              {/* Clean table */}
              <div className="bg-white rounded-xl overflow-hidden border border-gray-100 text-sm">
                <div className="grid grid-cols-4 bg-navy/5 py-2 px-4 text-xs font-medium text-gray-500">
                  <span>Name</span>
                  <span>Department</span>
                  <span>Hours</span>
                  <span>Status</span>
                </div>
                {[
                  {
                    name: "Murphy",
                    dept: "Finance",
                    hours: "37.5",
                    status: "Active",
                  },
                  {
                    name: "O'Brien",
                    dept: "HR",
                    hours: "40",
                    status: "Active",
                  },
                  {
                    name: "Kelly",
                    dept: "Operations",
                    hours: "35",
                    status: "Active",
                  },
                ].map((row) => (
                  <div
                    key={row.name}
                    className="grid grid-cols-4 py-2 px-4 border-t border-gray-100 text-gray-700"
                  >
                    <span>{row.name}</span>
                    <span>{row.dept}</span>
                    <span>{row.hours}</span>
                    <span className="text-emerald-600 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block" />
                      {row.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <p className="text-sm text-gray-400 text-center mt-8">
          Built with Microsoft Power Platform. No new software licences
          required.
        </p>
      </div>
    </section>
  );
}
