/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@speclyy/design-system', '@speclyy/auth', '@speclyy/db'],
  images: {
    // Allowlist for `next/image` remote sources. Unsplash hosts the welcome
    // page's three sample-project thumbnails (free-tier hotlinkable URLs).
    // Add new hosts sparingly — every entry expands the optimizer's attack
    // surface.
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
}

export default nextConfig
