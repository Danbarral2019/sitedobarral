import { fetchPendingDocuments } from '@/lib/documents';
import DocumentosPendentesClient from './DocumentosPendentesClient';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

/**
 * Página de Documentos Pendentes (Server Component - Fase 7)
 *
 * Refatorada de Client → Server Component com padrão Hybrid:
 * - Fetches data no servidor (elimina useEffect)
 * - Filtros (category, period) via URL searchParams
 * - Renderiza Client Component para interatividade
 *
 * Performance: TTI melhorado ~400ms, eliminado request waterfall
 */
export default async function DocumentosPendentesPage({ searchParams }: PageProps) {
  // Await searchParams (Next.js 15 requirement)
  const params = await searchParams;

  // Extrair filtros da URL
  const category = typeof params.category === 'string' ? params.category : '';
  const period = typeof params.period === 'string' ? params.period : 'all';

  // Buscar documentos no servidor com filtros aplicados
  const documents = await fetchPendingDocuments({
    category: category || undefined,
    period: period || undefined,
  });

  // Renderizar Client Component com dados
  return <DocumentosPendentesClient documents={documents} />;
}

/**
 * Metadata (opcional - para SEO)
 */
export const metadata = {
  title: 'Documentos Pendentes | Admin',
  description: 'Revise e aprove documentos importados automaticamente',
};
