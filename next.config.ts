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
      // Hub TCU (consolidação 2026-05-04)
      { source: '/admin/tcu-highlights', destination: '/admin/tcu?tab=destaques', permanent: false },
      { source: '/admin/tribunal-highlights', destination: '/admin/tcu?tab=tribunais', permanent: false },
      { source: '/admin/tribunal-decisions', destination: '/admin/tcu?tab=tribunais', permanent: false },
      // Hub Lei 14.133 (consolidação 2026-05-04)
      { source: '/admin/lei-14133/comentada', destination: '/admin/lei-14133?tab=comentada', permanent: false },
      { source: '/admin/lei-14133/analytics', destination: '/admin/lei-14133?tab=analytics', permanent: false },
      { source: '/admin/lei-14133/bulk-linker', destination: '/admin/lei-14133?tab=bulk-linker', permanent: false },
      // Search Analytics no Analytics-hub (consolidação 2026-05-04)
      { source: '/admin/search-analytics', destination: '/admin/analytics-hub?tab=busca-ia', permanent: false },
      // Páginas TCU obsoletas removidas em 2026-05-04 (substituídas por /admin/importacao + /admin/tcu)
      { source: '/admin/tcu-import', destination: '/admin/importacao?tab=tcu', permanent: false },
      { source: '/admin/tcu-converter', destination: '/admin/importacao?tab=tcu', permanent: false },
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
            // X-XSS-Protection desabilitado — header depreciado, CSP é a proteção moderna
            key: 'X-XSS-Protection',
            value: '0'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          },
          {
            // NOTA: 'unsafe-inline' em script-src é necessário para Next.js funcionar (inline scripts de hydration).
            // A remoção requer implementação de nonce-based CSP via middleware — melhoria futura.
            // 'strict-dynamic' não é aplicável sem nonces.
            key: 'Content-Security-Policy',
            value: `default-src 'self'; script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''} https://vercel.live https://va.vercel-scripts.com https://www.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' https://*.sentry.io https://vitals.vercel-insights.com https://va.vercel-scripts.com https://vercel.live https://www.google-analytics.com wss://vercel.live${process.env.NODE_ENV === 'development' ? ' ws://localhost:3000' : ''}; frame-src 'self' https://www.youtube.com https://vercel.live; media-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self'; worker-src 'self' blob:`
          },
        ],
      },
      {
        // Next.js serves static files from /public at root path (e.g., /favicon.ico)
        // Static asset caching is handled by /_next/static and /_next/image rules below
        source: '/icons/:path*',
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
      // no-store explícito para famílias de rotas sensíveis (user-specific / mutáveis).
      // Substitui o blanket /api/:path* (removido em 2026-05) que impedia CDN cache
      // até em rotas idempotentes públicas.
      {
        source: '/api/auth/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, must-revalidate' }],
      },
      {
        source: '/api/admin/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, must-revalidate' }],
      },
      {
        source: '/api/area-restrita/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, must-revalidate' }],
      },
      {
        source: '/api/pagamento/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, must-revalidate' }],
      },
      // Cache CDN público para leituras idempotentes não-personalizadas.
      // s-maxage=300 (5min na CDN) + SWR de 10min: ganho enorme de TTFB para usuários
      // repetidos, com janela mínima de defasagem. NÃO usar em rotas que variam por auth.
      {
        source: '/api/testimonials',
        headers: [{ key: 'Cache-Control', value: 'public, s-maxage=300, stale-while-revalidate=600' }],
      },
      {
        source: '/api/glossary',
        headers: [{ key: 'Cache-Control', value: 'public, s-maxage=300, stale-while-revalidate=600' }],
      },
      {
        source: '/api/course-videos',
        headers: [{ key: 'Cache-Control', value: 'public, s-maxage=300, stale-while-revalidate=600' }],
      },
      {
        source: '/api/recommended-sites',
        headers: [{ key: 'Cache-Control', value: 'public, s-maxage=300, stale-while-revalidate=600' }],
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
  ? withBundleAnalyzer({ enabled: true, openAnalyzer: false })(nextConfig)
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
