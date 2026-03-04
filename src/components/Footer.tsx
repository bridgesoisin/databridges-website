import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="bg-navy py-12 border-t border-white/10">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {/* Left — Logo and tagline */}
          <div>
            <Image
              src="/images/logo-wordmark.png"
              alt="DataBridges"
              width={120}
              height={28}
              className="h-7 w-auto"
            />
            <p
              className="text-sm text-gray-400 mt-3"
              style={{ fontFamily: "var(--font-dm-sans)" }}
            >
              Making AI Useful (and mildly tolerable)
            </p>
          </div>

          {/* Centre — Nav links */}
          <nav aria-label="Footer navigation" className="flex flex-col gap-3">
            {[
              { href: "/", label: "Home" },
              { href: "/services", label: "Services" },
              { href: "/about", label: "About" },
              { href: "/contact", label: "Contact" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-gray-400 hover:text-white transition-colors duration-200"
                style={{ fontFamily: "var(--font-dm-sans)" }}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right — Contact */}
          <div
            className="flex flex-col gap-3"
            style={{ fontFamily: "var(--font-dm-sans)" }}
          >
            
            <a
              href="mailto:hello@databridges.ie"
              className="text-sm text-gray-400 hover:text-white transition-colors duration-200"
            >
              hello@databridges.ie
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
          <p
            className="text-xs text-gray-500"
            style={{ fontFamily: "var(--font-dm-sans)" }}
          >
            &copy; 2026 DataBridges | Kilcock, Co. Kildare
          </p>
          <p
            className="text-xs text-gray-500"
            style={{ fontFamily: "var(--font-dm-sans)" }}
          >
            Built with Next.js &middot; Hosted on Netlify
          </p>
        </div>
      </div>
    </footer>
  );
}
