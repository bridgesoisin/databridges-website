"use client";

import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-navy py-12 border-t border-white/10">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {/* Left, Wordmark and tagline */}
          <div>
            <span className="inline-flex items-center gap-2.5 text-xl font-bold tracking-tight">
              <span
                aria-hidden="true"
                className="inline-block h-2.5 w-2.5 rotate-45 bg-cyan"
              />
              <span>
                <span className="text-white">data</span>
                <span className="text-cyan">bridges</span>
              </span>
            </span>
            <p className="text-sm text-gray-400 mt-3">
              Making AI Useful (and mildly tolerable)
            </p>
          </div>

          {/* Centre, Nav links */}
          <nav aria-label="Footer navigation" className="flex flex-col gap-3">
            <p className="db-eyebrow db-eyebrow--dark mb-1">Explore</p>
            {[
              { href: "/", label: "Home" },
              { href: "/services", label: "Services" },
              { href: "/work", label: "Work" },
              { href: "/seo-aeo", label: "SEO & AEO" },
              { href: "/about", label: "About" },
              { href: "/faq", label: "FAQ" },
              { href: "/contact", label: "Contact" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-gray-400 hover:text-white transition-colors duration-200"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right, Contact */}
          <div className="flex flex-col gap-3">
            <p className="db-eyebrow db-eyebrow--dark mb-1">Get in touch</p>
            <a
              href="mailto:oisin@databridges.ie"
              className="text-sm text-gray-400 hover:text-white transition-colors duration-200"
            >
              oisin@databridges.ie
            </a>
            <a
              href="tel:+353851364920"
              className="text-sm text-gray-400 hover:text-white transition-colors duration-200"
            >
              085 136 4920
            </a>
            <a
              href="https://linkedin.com/company/databridges"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-400 hover:text-white transition-colors duration-200"
            >
              linkedin.com/company/databridges
            </a>
            <p className="text-sm text-gray-400">
              Kilcock, Co. Kildare, Ireland
            </p>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-white/10 flex flex-wrap justify-between gap-4">
          <p className="text-xs text-gray-400">
            &copy; {new Date().getFullYear()} DataBridges | Kilcock, Co. Kildare
          </p>
          <p className="text-xs text-gray-400">
            Built with Next.js &middot; Hosted on Netlify
          </p>
        </div>
      </div>
    </footer>
  );
}
