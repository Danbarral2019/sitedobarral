import type { NextConfig } from "next";
import withBundleAnalyzer from '@next/bundle-analyzer';
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Source maps apenas server-side (Sentry via hideSourceMaps, não expõe no browser)
  productionBrowserSourceMaps: false,

  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  // Desabilita geração estática durante build
  output: 'standalone',

  // Garante que módulos server-only não sejam incluídos no bundle do cliente
  serverExternalPackages: ['qrcode', 'bcryptjs', 'jsonwebtoken', 'xlsx'],

  // Tree-shake barrel exports de pacotes pesados
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons', 'date-fns'],
    optimizeCss: true,
  },

  // Otimização de imagens
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Redirects para rotas consolidadas do admin
  async redirects() {
    return [
      { source: '/admin/tcu-manager', destination: '/admin/importacao?tab=tcu', permanent: false },
      { source: '/admin/agu-import', destination: '/admin/importacao?tab=agu', permanent: false },
      { source: '/admin/scraper-agu', destination: '/admin/importacao?tab=agu', permanent: false },
      { source: '/admin/analytics', destination: '/admin/analytics-hub', permanent: false },
      { source: '/admin/analytics-documentos', destination: '/admin/analytics-hub?tab=catalogacao', permanent: false },
      { source: '/admin/adicionar-documentos', destination: '/admin/docs?tab=central', permanent: false },
      { source: '/admin/documentos', destination: '/admin/docs?tab=gerenciar', permanent: false },
      { source: '/admin/blog', destination: '/admin/blog-social', permanent: false },
      { source: '/admin/assistente-social', destination: '/admin/blog-social?tab=social', permanent: false },
      { source: '/admin/videos', destination: '/admin/recursos?tab=videos', permanent: false },
      { source: '/admin/sites', destination: '/admin/recursos?tab=sites', permanent: false },
    ];
  },

  // Headers de Cache para performance
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' https://vercel.live https://va.vercel-scripts.com https://www.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' https://*.sentry.io https://vitals.vercel-insights.com https://va.vercel-scripts.com https://vercel.live https://www.google-analytics.com https://sdk.mercadopago.com wss://vercel.live; frame-src 'self' https://www.youtube.com https://vercel.live https://www.mercadopago.com.br; media-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self'; worker-src 'self' blob:"
          },
        ],
      },
      {
        source: '/public/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/_next/image/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
    ];
  },
};

// Bundle analyzer — ativar com ANALYZE=true npm run build
const analyzedConfig = process.env.ANALYZE === 'true'
  ? withBundleAnalyzer({ enabled: true })(nextConfig)
  : nextConfig;

// Sentry configuration options
const sentryOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,

  // Source maps: upload to Sentry then delete from deployed bundle (replaces hideSourceMaps)
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },

  // Tree-shake Sentry debug statements to reduce bundle size (replaces disableLogger)
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
  },

  // Widen client file upload to include all chunks (fixes "could not determine source map" warnings)
  widenClientFileUpload: true,

  // Webpack-specific options
  webpack: {
    // Automatic instrumentation of Vercel Cron Monitors (replaces top-level automaticVercelMonitors)
    automaticVercelMonitors: true,
  },
};

// Wrap config with Sentry - gracefully handles missing env vars
export default withSentryConfig(analyzedConfig, sentryOptions);
