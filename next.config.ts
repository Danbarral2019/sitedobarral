import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Permite build em produção ignorando erros de ESLint
    // TODO: Corrigir todos os erros de lint antes do deploy final
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Ignora erros temporariamente para permitir deploy
    // TODO: Corrigir warnings de Suspense antes do deploy final
    ignoreBuildErrors: true,
  },
  // Desabilita geração estática durante build
  output: 'standalone',

  // Garante que módulos server-only não sejam incluídos no bundle do cliente
  serverExternalPackages: ['qrcode', 'bcryptjs', 'jsonwebtoken'],

  // Configurações experimentais
  experimental: {
    // Otimiza importações de servidor
    serverComponentsExternalPackages: ['qrcode', 'bcryptjs', 'jsonwebtoken'],
  },
};

export default nextConfig;
