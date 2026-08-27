/** @type {import('next').NextConfig} */

const DOCUMENT_SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com https://*.vercel-scripts.com https://vercel.live",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https://*.vercel.com https://*.vercel-scripts.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https://*.vercel-scripts.com https://vitals.vercel-insights.com https://vercel.live wss://*.vercel.live",
      "media-src 'self' blob:",
      "frame-src 'self' https://vercel.live",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  },
]

const PRIVATE_UTILITY_ROBOT_HEADERS = [
  "/admin/:path*",
  "/api/:path*",
  "/login",
  "/forgot-password",
  "/reset-password",
].map((source) => ({
  source,
  headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
}))

function isPreviewNoindex(env = process.env) {
  return env.VERCEL_ENV?.trim().toLowerCase() === "preview"
    || env.SEARCH_INDEXING_ENABLED?.trim().toLowerCase() !== "true"
}

const nextConfig = {
  serverExternalPackages: ["sharp"],
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.vercel-storage.com",
      },
    ],
  },
  async headers() {
    const headers = [
      {
        source: "/",
        headers: DOCUMENT_SECURITY_HEADERS,
      },
      {
        source: "/:path*",
        headers: DOCUMENT_SECURITY_HEADERS,
      },
      ...PRIVATE_UTILITY_ROBOT_HEADERS,
    ]

    if (isPreviewNoindex()) {
      headers.push({
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      })
    }

    return headers
  },
}

export default nextConfig
