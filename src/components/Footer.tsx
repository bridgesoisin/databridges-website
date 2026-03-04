import Link from "next/link";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[#0A1E3D] text-gray-300">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <div className="text-[#3DE0E8] font-bold text-xl mb-3">
              Data<span className="text-[#FFC857]">Bridges</span>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              Making AI useful — and mildly tolerable — for Irish businesses.
            </p>
            <p className="text-sm text-gray-400 mt-2">Kilcock, Co. Kildare, Ireland</p>
          </div>

          {/* Links */}
          <div>
            <h3 className="text-white font-semibold mb-3 text-sm uppercase tracking-wide">Navigation</h3>
            <ul className="space-y-2 text-sm">
              {[
                { href: "/", label: "Home" },
                { href: "/services/", label: "Services" },
                { href: "/about/", label: "About" },
                { href: "/contact/", label: "Contact" },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="hover:text-[#3DE0E8] transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-white font-semibold mb-3 text-sm uppercase tracking-wide">Get in Touch</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="mailto:hello@databridges.ie"
                  className="hover:text-[#3DE0E8] transition-colors"
                >
                  hello@databridges.ie
                </a>
              </li>
              <li>
                <a
                  href="https://linkedin.com/company/databridges"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#3DE0E8] transition-colors flex items-center gap-1"
                >
                  LinkedIn
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-[#1a3a6e] mt-8 pt-6 text-center text-xs text-gray-500">
          © {year} DataBridges. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
