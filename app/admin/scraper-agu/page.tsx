'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const ScraperAGUClient = dynamic(() => import('./ScraperAGUClient'), {
  loading: () => (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  ),
  ssr: false,
});

export default function ScraperAGUPage() {
  return (
      <ScraperAGUClient />
  );
}
