'use client';

import dynamic from 'next/dynamic';

const WelcomeModal = dynamic(() => import('@/components/WelcomeModal'), { ssr: false });
const PWAProvider = dynamic(() => import('@/components/PWAProvider').then(mod => ({ default: mod.PWAProvider })), { ssr: false });

export function LazyClientProviders() {
  return (
    <>
      <WelcomeModal />
      <PWAProvider />
    </>
  );
}
