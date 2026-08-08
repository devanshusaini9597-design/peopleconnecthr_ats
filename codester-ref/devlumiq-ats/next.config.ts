import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https:",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Keep jsdom/DOMPurify out of the webpack bundle (avoids build-time stylesheet ENOENT)
  serverExternalPackages: ['isomorphic-dompurify', 'jsdom', 'parse5'],
  // Ensure bundled skills catalog is available to API routes in serverless deploys
  outputFileTracingIncludes: {
    '/api/skills/**/*': ['./data/onet-skills.json'],
    '/api/skills/import/**/*': ['./data/onet-skills.json'],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'media.licdn.com' },
      { protocol: 'https', hostname: 'www.gravatar.com' },
      { protocol: 'https', hostname: 'ui-avatars.com' },
      { protocol: 'https', hostname: '*.amazonaws.com' },
      { protocol: 'https', hostname: '*.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
      // Add your file storage domain here (S3 bucket, Cloudflare R2, etc.)
    ],
  },
  compress: true,
  async headers() {
    const embedCsp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https:",
      'frame-ancestors *',
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ');

    return [
      {
        // Allow third-party sites to iframe the careers chatbot embed
        source: '/embed/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: embedCsp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      {
        source: '/careers-chatbot.js',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
      {
        source: '/((?!embed/).*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
