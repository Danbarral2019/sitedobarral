'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

/**
 * Volta à página anterior preservando query/estado (busca da área restrita,
 * busca pública, lei-comentada, etc.). Cai para /busca se não houver histórico
 * (ex.: link aberto direto, sem referrer interno).
 */
export default function BackLink() {
  const router = useRouter();

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    // Se o usuário chegou via link interno, history.length > 1 e router.back()
    // restaura a página de origem com seu estado (query string, scroll, etc.).
    // Se chegou direto (history.length === 1), mantemos o fallback /busca.
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/busca');
    }
  }

  return (
    <a
      href="/busca"
      onClick={handleClick}
      className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
    >
      <ArrowLeft className="w-4 h-4" />
      Voltar
    </a>
  );
}
