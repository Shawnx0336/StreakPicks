/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remove output: 'export' - we want regular Next.js build
  images: {
    unoptimized: true
  }
}

module.exports = nextConfig