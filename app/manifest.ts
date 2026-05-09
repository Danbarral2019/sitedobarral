import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Prof. Daniel Barral',
    short_name: 'Prof. Barral',
    description: 'Repositório especializado de materiais jurídicos em Direito Administrativo, Licitações e Contratos.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#20364e',
    orientation: 'portrait-primary',
    lang: 'pt-BR',
    dir: 'ltr',
    categories: ['education', 'reference'],
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any' as const,
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any' as const,
      },
      {
        src: '/icons/maskable-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable' as const,
      },
      {
        src: '/icons/maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable' as const,
      },
    ],
    shortcuts: [
      {
        name: 'Assistente IA',
        short_name: 'Assistente',
        url: '/area-restrita/assistente',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }],
      },
      {
        name: 'Lei 14.133',
        short_name: 'Lei 14.133',
        url: '/lei-14133',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }],
      },
      {
        name: 'Busca',
        short_name: 'Busca',
        url: '/busca',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }],
      },
      {
        name: 'Contato',
        short_name: 'Contato',
        url: '/contato',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }],
      },
    ],
  }
}
