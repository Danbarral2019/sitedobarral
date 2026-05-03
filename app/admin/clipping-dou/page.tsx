import { Suspense } from 'react';
import ClippingDouClient from './ClippingDouClient';

export const dynamic = 'force-dynamic';

export default function ClippingDouPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-gray-400">Carregando...</div>}>
      <ClippingDouClient />
    </Suspense>
  );
}
