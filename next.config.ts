import type { NextConfig } from "next";

const siteContentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "connect-src 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

const adminContentSecurityPolicy = siteContentSecurityPolicy.replace(
  "connect-src 'self'",
  "connect-src 'self' https://api.netlify.com"
);

const securityHeaders = (contentSecurityPolicy: string) => [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    unoptimized: true,
  },
  // Netlify's file-level header rules do not apply to responses produced by
  // its Next.js function/edge runtime. Set the policy in Next as well so every
  // application response, including API responses, carries it. The later
  // admin rule overrides only connect-src for Decap's required Netlify API.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders(siteContentSecurityPolicy),
      },
      {
        source: "/admin/:path*",
        headers: securityHeaders(adminContentSecurityPolicy),
      },
    ];
  },
  // /admin has no app route of its own (it's the static Decap CMS shell in
  // public/admin/index.html); Next's router 404s on the bare path, so
  // rewrite it to the actual file, keeping the clean /admin URL.
  async rewrites() {
    return [{ source: "/admin", destination: "/admin/index.html" }];
  },
};

export default nextConfig;
