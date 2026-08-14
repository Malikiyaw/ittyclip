import type { NextConfig } from "next";

const baseHeaders = [{ key: "X-Content-Type-Options", value: "nosniff" }];

// COOP/COEP are only required on /studio (SharedArrayBuffer for ffmpeg-mt + whisper pthreads).
// The landing page embeds a third-party CloudFront video that sends no CORP/CORS headers,
// so cross-origin isolation must not apply there.
const studioHeaders = [
  ...baseHeaders,
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: baseHeaders },
      { source: "/studio/:path*", headers: studioHeaders },
    ];
  },
};

export default nextConfig;
