/**
 * Indexa (chunks + embeddings) de uma vez as decisões de tribunais aprovadas
 * que ainda aguardam embedding. Faz o mesmo que o cron process-index-jobs,
 * que só dá conta de ~30 por dia e deixou 1.519 fora da busca em 27/09/2026
 * (cargas de TCDF, TRF5 e TJDFT).
 *
 * Para no primeiro erro de teto/cota do Gemini e devolve a decisão para
 * 'pending' (o processador a marca 'failed', e o cron não pega 'failed').
 * Sem --aplicar, só conta o que faria.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/indexar-decisoes-pendentes.ts [--tribunal TCDF] [--limite N] [--aplicar]
 */
import 'dotenv/config';
import { prisma } from '@/lib/prisma';
import { processTribunalDecision } from '@/lib/embeddings/tribunal-decision-processor';

const CONCORRENCIA = 5;
const ERRO_DE_COTA = /spending cap|RESOURCE_EXHAUSTED|quota|429/i;

function arg(nome: string): string | undefined {
  const i = process.argv.indexOf(nome);
  return i > 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const aplicar = process.argv.includes('--aplicar');
  const tribunal = arg('--tribunal');
  const limite = Number(arg('--limite')) || undefined;

  const pendentes = await prisma.tribunalDecision.findMany({
    where: {
      ...(tribunal ? { tribunalCode: tribunal } : {}),
      approvalStatus: { in: ['auto_approved', 'manually_approved'] },
      OR: [{ embeddingStatus: null }, { embeddingStatus: 'pending' }],
    },
    select: { id: true, tribunalCode: true },
    orderBy: { createdAt: 'asc' },
    take: limite,
  });
  const porTribunal: Record<string, number> = {};
  for (const d of pendentes) porTribunal[d.tribunalCode] = (porTribunal[d.tribunalCode] || 0) + 1;
  console.log(`aguardando embedding: ${pendentes.length}`);
  console.table(porTribunal);
  if (!aplicar) {
    console.log('SIMULAÇÃO (use --aplicar para gravar)');
    return;
  }

  const inicio = Date.now();
  let feitas = 0;
  const falhas: Array<{ id: string; erro: string }> = [];
  for (let i = 0; i < pendentes.length; i += CONCORRENCIA) {
    const lote = pendentes.slice(i, i + CONCORRENCIA);
    const resultados = await Promise.all(lote.map((d) => processTribunalDecision(d.id)));

    const cota = resultados.filter((r) => !r.success && ERRO_DE_COTA.test(r.error || ''));
    if (cota.length > 0) {
      await prisma.tribunalDecision.updateMany({
        where: { id: { in: cota.map((r) => r.decisionId) }, embeddingStatus: 'failed' },
        data: { embeddingStatus: 'pending' },
      });
      console.error(`\nPARADO: erro de cota/teto do Gemini ("${cota[0].error}").`);
      console.error(`Indexadas até aqui: ${feitas + resultados.filter((r) => r.success).length}. As ${cota.length} deste lote voltaram para 'pending'.`);
      process.exitCode = 1;
      return;
    }

    for (const r of resultados) {
      if (r.success) feitas++;
      else falhas.push({ id: r.decisionId, erro: r.error || '?' });
    }
    const n = Math.min(i + CONCORRENCIA, pendentes.length);
    if (n % 50 < CONCORRENCIA || n === pendentes.length) {
      const min = ((Date.now() - inicio) / 60000).toFixed(1);
      console.log(`  ${n}/${pendentes.length} (${feitas} ok, ${falhas.length} falhas, ${min} min)`);
    }
  }

  console.log(`\nAPLICADO: ${feitas} indexadas, ${falhas.length} falhas.`);
  if (falhas.length > 0) {
    const motivos: Record<string, number> = {};
    for (const f of falhas) motivos[f.erro.slice(0, 80)] = (motivos[f.erro.slice(0, 80)] || 0) + 1;
    console.table(motivos);
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
