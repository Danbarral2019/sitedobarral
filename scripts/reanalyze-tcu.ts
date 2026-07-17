/**
 * Reanalisa os acórdãos do TCU a partir do `tcuTextoCompleto` JÁ GUARDADO —
 * sem re-baixar o RTF do TCU. Use quando a mudança for na ANÁLISE
 * (seccionamento ou contagem de termos), não na extração do texto.
 *
 * Recomputa `tcuAnalise` + `leiArticlesDebated` com o código atual e grava
 * `v: ANALISE_VERSAO`. Idempotente: pula quem já está na versão corrente
 * (a não ser com --force). Não toca em `tcuTextoCompleto` nem faz rede.
 *
 * Foi criado para a v3 (17/07): o seccionamento passou a pegar o ÚLTIMO "VOTO"
 * antes do dispositivo. Como a correção opera sobre o texto que já está no
 * banco, reprocessar do zero (re-download) seria desperdício e carga inútil no
 * TCU — daí este caminho "reanalisa do texto guardado".
 *
 * Uso: npx tsx scripts/reanalyze-tcu.ts                 # dry-run
 *      npx tsx scripts/reanalyze-tcu.ts --execute
 *      npx tsx scripts/reanalyze-tcu.ts --execute --force   # reprocessa todos
 *
 * Ref.: docs/superpowers/specs/2026-07-15-tcu-inteiro-teor-relevancia-design.md
 */
import { prisma } from '../lib/prisma';
import { analisarAcordao, artigosDebatidos, ANALISE_VERSAO } from '../lib/tcu/analise-relevancia';

const EXECUTE = process.argv.includes('--execute');
const FORCE = process.argv.includes('--force');

async function main() {
  console.log(EXECUTE ? '🔴 EXECUÇÃO\n' : '🔵 DRY-RUN — nada será gravado (use --execute)\n');

  const docs = await prisma.document.findMany({
    where: { category: 'acordao', tcuTextoCompleto: { not: null } },
    select: { id: true, title: true, tcuTextoCompleto: true, leiArticlesArr: true, tcuAnalise: true },
    orderBy: { id: 'asc' },
  });
  console.log(`Acórdãos com texto guardado: ${docs.length}\n`);

  let reanalisados = 0, pulados = 0, mudouDebate = 0;

  for (const d of docs) {
    const vAtual = (d.tcuAnalise as { v?: number } | null)?.v;
    if (vAtual === ANALISE_VERSAO && !FORCE) { pulados++; continue; }

    const texto = d.tcuTextoCompleto ?? '';
    const truncado = (d.tcuAnalise as { truncado?: boolean } | null)?.truncado ?? false;
    const analise = analisarAcordao(texto, d.leiArticlesArr, { truncado });
    const debatidos = artigosDebatidos(analise);

    const antes = ((d.tcuAnalise as { artigos?: unknown } | null) && [...d.leiArticlesArr]) || [];
    const debatidosAntes = await debatidosDoJson(d.tcuAnalise);
    const mudou = debatidosAntes.sort().join(',') !== [...debatidos].sort().join(',');
    if (mudou) mudouDebate++;

    if (mudou || reanalisados < 5) {
      console.log(`  ${mudou ? '🔀' : '  '} ${d.title.slice(0, 44).padEnd(46)} debatidos: [${debatidosAntes.join(',')}] → [${debatidos.join(',')}]`);
    }

    if (EXECUTE) {
      await prisma.document.update({
        where: { id: d.id },
        data: { tcuAnalise: analise as never, leiArticlesDebated: debatidos },
      });
    }
    reanalisados++;
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Reanalisados: ${reanalisados} · Pulados (já v${ANALISE_VERSAO}): ${pulados}`);
  console.log(`Com mudança na lista de artigos debatidos: ${mudouDebate}`);
  if (!EXECUTE) console.log('\n🔵 DRY-RUN — nada gravado.');
  await prisma.$disconnect();
}

/** Extrai os artigos que estavam marcados como debatidos no JSON anterior. */
async function debatidosDoJson(analise: unknown): Promise<string[]> {
  const { artigosDebatidos } = await import('../lib/tcu/analise-relevancia');
  if (!analise || typeof analise !== 'object') return [];
  try { return artigosDebatidos(analise as never); } catch { return []; }
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
