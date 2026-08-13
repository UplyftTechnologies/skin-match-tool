/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output exists for the Render container, which runs `npm start`
  // against a self-contained server bundle. Vercel builds its own output and
  // treats this as redundant work, so skip it there.
  output: process.env.VERCEL ? undefined : "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
      },
    ],
  },
  experimental: {
    optimizeCss: true,
  },
};

export default nextConfig;
