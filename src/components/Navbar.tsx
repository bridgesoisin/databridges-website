"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/", label: "Home" },
  { href: "/services/", label: "Services" },
  { href: "/about/", label: "About" },
  { href: "/contact/", label: "Contact" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <nav className="bg-[#0A1E3D] text-white sticky top-0 z-50 shadow-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <span className="text-[#3DE0E8] font-bold text-xl tracking-tight group-hover:text-white transition-colors">
              Data<span className="text-[#FFC857]">Bridges</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`text-sm font-medium transition-colors hover:text-[#3DE0E8] ${
                  pathname === href || (href !== "/" && pathname.startsWith(href.replace(/\/$/, "")))
                    ? "text-[#3DE0E8] border-b-2 border-[#3DE0E8] pb-0.5"
                    : "text-gray-200"
                }`}
              >
                {label}
              </Link>
            ))}
            <Link
              href="/contact/"
              className="bg-[#3DE0E8] text-[#0A1E3D] px-4 py-2 rounded-full text-sm font-semibold hover:bg-[#FFC857] transition-colors"
            >
              Get in Touch
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded text-gray-300 hover:text-white"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {open ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-[#0f2a52] px-4 pb-4">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={`block py-3 text-sm font-medium border-b border-[#1a3a6e] transition-colors hover:text-[#3DE0E8] ${
                pathname === href ? "text-[#3DE0E8]" : "text-gray-200"
              }`}
            >
              {label}
            </Link>
          ))}
          <Link
            href="/contact/"
            onClick={() => setOpen(false)}
            className="block mt-4 bg-[#3DE0E8] text-[#0A1E3D] px-4 py-2 rounded-full text-sm font-semibold text-center hover:bg-[#FFC857] transition-colors"
          >
            Get in Touch
          </Link>
        </div>
      )}
    </nav>
  );
}
