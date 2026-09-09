import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  // /admin has no app route of its own (it's the static Decap CMS shell in
  // public/admin/index.html); Next's router 404s on the bare path, so
  // rewrite it to the actual file, keeping the clean /admin URL.
  async rewrites() {
    return [{ source: "/admin", destination: "/admin/index.html" }];
  },
};

export default nextConfig;
