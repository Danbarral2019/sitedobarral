import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Prof. Daniel Barral',
    short_name: 'Prof. Barral',
    description: 'Repositório especializado de materiais jurídicos em Direito Administrativo, Licitações e Contratos.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#20364e',
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ],
  }
}
