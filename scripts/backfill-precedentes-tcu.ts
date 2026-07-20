/**
 * Popula a rede de precedentes (AcordaoCitacao) a partir do tcuTextoCompleto
 * JÁ GUARDADO — sem rede. Backfill do passivo; as futuras inclusões entram
 * pelo cron sync-precedentes-tcu. Idempotente (persistir apaga+reinsere por
 * origem e marca precedentesVersao). Pula quem já está na versão corrente.
 *
 * Uso: npx tsx scripts/backfill-precedentes-tcu.ts               # dry-run
 *      npx tsx scripts/backfill-precedentes-tcu.ts --execute
 *      npx tsx scripts/backfill-precedentes-tcu.ts --execute --limit=50
 *      npx tsx scripts/backfill-precedentes-tcu.ts --execute --force
 *
 * ⚠️ Com --force, RERODE ATÉ COMPLETAR se cair no meio: --force desliga a guarda
 * de versão e reprocessa docs já na versão corrente. Como persistir grava em
 * sequência (deleteMany → createMany → marca versão), um crash entre o delete e
 * o createMany deixaria o doc na versão corrente com as arestas apagadas — e um
 * run normal (sem --force) NÃO o repesca (versão == corrente, não nula). Rerodar
 * --force até o fim reprocessa tudo e autocorrige. (Sem --force não há esse buraco:
 * o doc fica com versão nula e volta à fila.)
 *
 * Ref.: docs/superpowers/specs/2026-07-18-rede-precedentes-tcu-fase1-grafo-design.md
 */
import { prisma } from '../lib/prisma';
import {
  arestasDeAcordao,
  persistirArestasDeAcordao,
  PRECEDENTES_VERSAO,
} from '../lib/tcu/extrair-arestas-precedentes';
import { CATEGORIAS_ACORDAO } from '../lib/tcu/categorias';

const EXECUTE = process.argv.includes('--execute');
const FORCE = process.argv.includes('--force');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;

async function main() {
  console.log(EXECUTE ? '🔴 EXECUÇÃO\n' : '🔵 DRY-RUN — nada será gravado (use --execute)\n');

  const docs = await prisma.document.findMany({
    where: {
      category: { in: [...CATEGORIAS_ACORDAO] },
      tcuTextoCompleto: { not: null },
      ...(FORCE ? {} : { OR: [{ precedentesVersao: null }, { precedentesVersao: { lt: PRECEDENTES_VERSAO } }] }),
    },
    select: { id: true, title: true, acordaoNumero: true, acordaoAno: true, tcuTextoCompleto: true },
    orderBy: { id: 'asc' },
    ...(LIMIT ? { take: LIMIT } : {}),
  });
  console.log(`Acórdãos a processar: ${docs.length}\n`);

  let comArestas = 0, semArestas = 0, totalArestas = 0;
  for (let i = 0; i < docs.length; i++) {
    const d = docs[i];
    const texto = d.tcuTextoCompleto ?? '';
    if (EXECUTE) {
      const n = await persistirArestasDeAcordao({
        origemId: d.id,
        numeroSelf: d.acordaoNumero,
        anoSelf: d.acordaoAno,
        texto,
      });
      totalArestas += n;
      if (n > 0) comArestas++; else semArestas++;
    } else {
      const n = arestasDeAcordao(texto, { numero: d.acordaoNumero, ano: d.acordaoAno }).length;
      totalArestas += n;
      if (n > 0) comArestas++; else semArestas++;
    }
    if (i < 5 || i % 200 === 0) {
      const n = EXECUTE ? '' : ' (dry-run)';
      console.log(`  [${i + 1}/${docs.length}] ${d.title.slice(0, 44).padEnd(46)} arestas até aqui: ${totalArestas}${n}`);
    }
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Documentos: ${docs.length} · com arestas: ${comArestas} · sem arestas: ${semArestas}`);
  console.log(`Total de arestas: ${totalArestas} (média ${(totalArestas / (docs.length || 1)).toFixed(1)}/doc)`);
  if (!EXECUTE) console.log('\n🔵 DRY-RUN — nada gravado.');
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
