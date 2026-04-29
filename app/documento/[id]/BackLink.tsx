'use client';

import Link from 'next/link';
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
    if (typeof window !== 'undefined' && window.history.length > 1) {
      e.preventDefault();
      router.back();
    }
    // else: deixa o Link normal navegar pra /busca
  }

  return (
    <Link
      href="/busca"
      onClick={handleClick}
      className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
    >
      <ArrowLeft className="w-4 h-4" />
      Voltar
    </Link>
  );
}
