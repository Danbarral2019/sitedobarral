'use client';

import { GoogleAnalytics } from '@next/third-parties/google';

export default function Analytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;

  // Só renderiza em produção e se o ID estiver configurado
  if (!gaId || process.env.NODE_ENV !== 'production') {
    return null;
  }

  return <GoogleAnalytics gaId={gaId} />;
}
