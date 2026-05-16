import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { verifyCronAuth } from '@/lib/cron-auth';
import { withCronTelemetry } from '@/lib/cron-telemetry';

/**
 * Invalida cache ISR das páginas do acervo. Útil quando scripts CLI mudam
 * o DB sem mudar código (ex: reclassify, sync manual de pareceres) e o
 * `revalidate=N` da página ainda está válido.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const paths = [
    '/base-conhecimento',
    '/base-conhecimento/pareceres',
    '/base-conhecimento/orientacoes-normativas',
    '/base-conhecimento/enunciados',
    '/base-conhecimento/manual-tcu',
  ];

  try {
    await withCronTelemetry('revalidate-acervo', async () => {
      for (const p of paths) revalidatePath(p);
      return { itemsFound: paths.length, itemsNew: paths.length };
    });
    return NextResponse.json({ revalidated: paths });
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro ao revalidar', details: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 },
    );
  }
}
