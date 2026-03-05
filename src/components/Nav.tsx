"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 80);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (menuOpen) {
      document.documentElement.classList.add("overflow-hidden");
    } else {
      document.documentElement.classList.remove("overflow-hidden");
    }
    return () => document.documentElement.classList.remove("overflow-hidden");
  }, [menuOpen]);

  return (
    <nav
      role="navigation"
      aria-label="Main navigation"
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/80 backdrop-blur-md border-b border-gray-100"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto max-w-7xl px-6 flex items-center justify-between h-16">
        <Link href="/" aria-label="DataBridges home">
          <Image
            src="/images/db-monogram.png"
            alt="DataBridges"
            width={40}
            height={40}
            className="h-10 w-auto"
            priority
          />
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-colors duration-200 ${
                pathname === link.href
                  ? "text-cyan"
                  : scrolled
                  ? "text-navy hover:text-cyan"
                  : "text-white hover:text-cyan"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {/* Book a Chat — desktop */}
          <Link
            href="mailto:hello@databridges.ie"
            className="hidden md:inline-flex bg-cyan text-navy font-semibold px-5 py-2 rounded-full text-sm transition-colors duration-200 hover:bg-white"
          >
            Book a Chat
          </Link>

          {/* Book a Chat — mobile icon */}
          <Link
            href="mailto:hello@databridges.ie"
            className="md:hidden"
            aria-label="Book a chat"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke={scrolled ? "#0A1E3D" : "#ffffff"}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </Link>

          {/* Hamburger — mobile */}
          <button
            className="md:hidden"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke={scrolled ? "#0A1E3D" : "#ffffff"}
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              {menuOpen ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile overlay */}
      <div
        className={`nav-overlay ${
          menuOpen ? "open" : ""
        } fixed inset-0 bg-navy flex flex-col items-center justify-center gap-8 md:hidden z-40`}
      >
        <button
          onClick={() => setMenuOpen(false)}
          className="absolute top-5 right-6"
          aria-label="Close menu"
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {navLinks.map((link, i) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={() => setMenuOpen(false)}
            className="nav-overlay-link text-white font-bold text-3xl hover:text-cyan transition-colors duration-200"
            style={{
              transitionDelay: `${i * 80}ms`,
              fontFamily: "var(--font-syne)",
            }}
          >
            {link.label}
          </Link>
        ))}

        <Link
          href="mailto:hello@databridges.ie"
          onClick={() => setMenuOpen(false)}
          className="nav-overlay-link mt-4 bg-cyan text-navy font-semibold px-8 py-4 rounded-full text-lg transition-colors duration-200"
          style={{
            transitionDelay: `${navLinks.length * 80}ms`,
            fontFamily: "var(--font-syne)",
          }}
        >
          Book a Chat
        </Link>
      </div>
    </nav>
  );
}
