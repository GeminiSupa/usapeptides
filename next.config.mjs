/** @type {import('next').NextConfig} */
const nextConfig = {
  // NOTE: this project previously used `output: 'export'` (static HTML).
  // API routes and server-side Supabase access cannot run under a static
  // export, so it is deliberately disabled. Vercel now builds this as a
  // normal server-rendered Next.js app.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
