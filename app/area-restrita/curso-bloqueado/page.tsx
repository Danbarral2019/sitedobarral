import { Suspense } from 'react';
import CursoBloqueadoContent from './CursoBloqueadoContent';

export default function CursoBloqueadoPage() {
 return (
 <Suspense fallback={
 <div className="min-h-screen bg-surface-raised flex items-center justify-center">
 <div className="text-center">
 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto mb-4"></div>
 <p className="text-ink-secondary">Carregando...</p>
 </div>
 </div>
 }>
 <CursoBloqueadoContent />
 </Suspense>
 );
}
