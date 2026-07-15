/**
 * Baixa o inteiro teor dos acórdãos do TCU, analisa e persiste.
 *
 * Idempotente e retomável: pula quem já tem `tcuAnalise.v` na versão atual.
 * Um acórdão que falha não interrompe os demais — registra o erro em
 * tcuEnriquecimentoErro e segue.
 *
 * Uso: npx tsx scripts/backfill-tcu-inteiro-teor.ts                # dry-run
 *      npx tsx scripts/backfill-tcu-inteiro-teor.ts --execute
 *      npx tsx scripts/backfill-tcu-inteiro-teor.ts --execute --limit=20
 *      npx tsx scripts/backfill-tcu-inteiro-teor.ts --execute --force
 *
 * Estimativa: ~1.835 acórdãos, ~50 min, ~640 MB de tráfego.
 * Falha esperada: amostra de 20 (--limit=20) deu 15% de falha (3/20) — projeta
 * ~275 falhas no total. Causas conhecidas: RTF malformado ("empty control
 * word", determinístico — ex. 1204/2024), stack overflow do rtf-parser
 * (ex. 1359/2024) e timeout de rede (ex. 456/2026). Falhas não têm mitigação
 * automática; ficam registradas em tcuEnriquecimentoErro para triagem manual.
 *
 * ⚠️ Script one-shot para rodar manualmente. NÃO agendar em cron: documentos
 * que falham nunca recebem `tcuAnalise.v`, então são retentados a cada
 * execução (comportamento correto para uma rodada manual, mas viraria loop
 * de retentativa infinita em cron, pois não há marcação de "falha permanente").
 *
 * Ref.: docs/superpowers/specs/2026-07-15-tcu-inteiro-teor-relevancia-design.md
 */
import { prisma } from '../lib/prisma';
import { fetchInteiroTeor } from '../lib/tcu/inteiro-teor-fetch';
import { rtfToText } from '../lib/tcu/rtf-to-text';
import { analisarAcordao, artigosDebatidos, ANALISE_VERSAO } from '../lib/tcu/analise-relevancia';

const EXECUTE = process.argv.includes('--execute');
const FORCE = process.argv.includes('--force');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;

const CONCORRENCIA = 3;   // mesmo padrão de lib/tcu-scraper.ts:524-527
const DELAY_MS = 1000;    // 1 req/s — o TCU não documenta rate limit (escalonado dentro do lote, não rajada)
const TETO_CHARS = 500_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Alvo { id: string; title: string; tcuLinkPDF: string | null; leiArticlesArr: string[]; tcuAnalise: unknown }

async function processar(d: Alvo): Promise<'ok' | 'falha' | 'pulado'> {
  const jaFeito = (d.tcuAnalise as { v?: number } | null)?.v === ANALISE_VERSAO;
  if (jaFeito && !FORCE) return 'pulado';

  const r = await fetchInteiroTeor(d.tcuLinkPDF!);
  if (!r.ok) {
    console.log(`   ❌ ${d.title.slice(0, 40)} — ${r.erro}`);
    if (EXECUTE) {
      await prisma.document.update({
        where: { id: d.id },
        data: { tcuEnriquecimentoStatus: 'failed', tcuEnriquecimentoErro: r.erro },
      });
    }
    return 'falha';
  }

  let texto: string;
  try {
    texto = await rtfToText(r.buf);
  } catch (e) {
    const erro = `extração RTF: ${(e as Error).message.slice(0, 80)}`;
    console.log(`   ❌ ${d.title.slice(0, 40)} — ${erro}`);
    if (EXECUTE) {
      await prisma.document.update({
        where: { id: d.id },
        data: { tcuEnriquecimentoStatus: 'failed', tcuEnriquecimentoErro: erro },
      });
    }
    return 'falha';
  }

  const truncado = texto.length > TETO_CHARS;
  const final = truncado ? texto.slice(0, TETO_CHARS) : texto;
  const analise = analisarAcordao(final, d.leiArticlesArr, { truncado });
  const debatidos = artigosDebatidos(analise);

  console.log(
    `   ✅ ${d.title.slice(0, 40)} — ${final.length} chars` +
    `${analise.secoes ? '' : ' (sem seções)'}${truncado ? ' [truncado]' : ''}` +
    `${debatidos.length ? ` → debate: ${debatidos.join(',')}` : ''}`
  );

  if (EXECUTE) {
    await prisma.document.update({
      where: { id: d.id },
      data: {
        tcuTextoCompleto: final,
        tcuAnalise: analise as never,
        leiArticlesDebated: debatidos,
        tcuEnriquecimentoStatus: 'success',
        tcuEnriquecimentoErro: null,
        tcuEnriquecidoEm: new Date(),
      },
    });
  }
  return 'ok';
}

async function main() {
  console.log(EXECUTE ? '🔴 EXECUÇÃO\n' : '🔵 DRY-RUN — nada será gravado (use --execute)\n');

  const alvos = await prisma.document.findMany({
    where: { category: 'acordao', tcuLinkPDF: { not: null } },
    select: { id: true, title: true, tcuLinkPDF: true, leiArticlesArr: true, tcuAnalise: true },
    orderBy: { id: 'asc' },
    ...(LIMIT ? { take: LIMIT } : {}),
  });
  console.log(`Acórdãos com link: ${alvos.length}\n`);

  const t0 = Date.now();
  let ok = 0, falha = 0, pulado = 0;

  for (let i = 0; i < alvos.length; i += CONCORRENCIA) {
    const lote = alvos.slice(i, i + CONCORRENCIA);
    // Delay progressivo dentro do lote (item 0 imediato, item 1 em +1s, item 2 em +2s)
    // — mesmo padrão de lib/tcu-scraper.ts:544-547, evita rajada simultânea.
    const rs = await Promise.all(
      lote.map(async (d, idx) => {
        if (idx > 0) await sleep(DELAY_MS * idx);
        return processar(d as Alvo);
      })
    );
    for (const r of rs) r === 'ok' ? ok++ : r === 'falha' ? falha++ : pulado++;

    const feitos = i + lote.length;
    const eta = Math.round(((Date.now() - t0) / feitos) * (alvos.length - feitos) / 1000 / 60);
    console.log(`   [${feitos}/${alvos.length}] ok=${ok} falha=${falha} pulado=${pulado} · ETA ~${eta}min`);
    // Delay entre lotes — não roda após o último.
    if (i + CONCORRENCIA < alvos.length) await sleep(DELAY_MS);
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`ok: ${ok} · falha: ${falha} · pulado: ${pulado}`);
  console.log(`tempo: ${Math.round((Date.now() - t0) / 1000 / 60)} min`);
  if (!EXECUTE) console.log('\n🔵 DRY-RUN — nada gravado.');
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
