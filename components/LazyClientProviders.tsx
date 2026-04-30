'use client';

import dynamic from 'next/dynamic';

const PWAProvider = dynamic(() => import('@/components/PWAProvider').then(mod => ({ default: mod.PWAProvider })), { ssr: false });

export function LazyClientProviders() {
  return (
    <>
      <PWAProvider />
    </>
  );
}
