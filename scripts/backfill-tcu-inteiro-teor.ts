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
 * Estimativa: ~1.835 acórdãos, ~3-4h (1 req/s escalonado), ~640 MB de tráfego.
 * Falha esperada: baixa depois do fix do "empty control word". O primeiro
 * backfill (370 docs antes de a conexão cair) deu 28%, mas 64 desses eram o
 * bug do `\_`/`\~` no rtf-parser — já corrigido em lib/tcu/rtf-to-text.ts, os
 * 15 testados reprocessaram 15/15. Sobram: arquivos acima do teto de 20 MB
 * (atas de sessão inteiras), stack overflow do rtf-parser, encoding não
 * reconhecido e timeouts. Falhas ficam em tcuEnriquecimentoErro p/ triagem.
 * Retry de conexão embutido (comRetryDB) para o WebSocket do Neon não derrubar
 * o run — o primeiro morreu no doc ~370 com um ErrorEvent de socket.
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

/**
 * Executa uma operação de banco com retry em erro transitório de conexão.
 *
 * O adapter é PrismaNeon (WebSocket). Num processo de ~4h, o Neon derruba
 * sockets ociosos — o primeiro backfill morreu no doc ~370 com um `ErrorEvent`
 * de WebSocket. Aqui: até 4 tentativas com backoff (1s, 2s, 4s), e só para
 * erros que parecem de conexão, não de dado (um `where` inválido não deve
 * retentar 4 vezes). Se esgotar, propaga — aí o run realmente falhou.
 */
async function comRetryDB<T>(op: () => Promise<T>, rotulo: string): Promise<T> {
  const TENTATIVAS = 4;
  for (let i = 1; i <= TENTATIVAS; i++) {
    try {
      return await op();
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      const transitorio =
        /ErrorEvent|WebSocket|socket|ECONNRESET|ETIMEDOUT|Connection|terminat|closed|P1001|P1017|fetch failed/i.test(msg);
      if (!transitorio || i === TENTATIVAS) throw e;
      const espera = 1000 * 2 ** (i - 1);
      console.log(`   ⏳ conexão caiu em "${rotulo}" (tentativa ${i}/${TENTATIVAS}): ${msg.slice(0, 60)} — retry em ${espera}ms`);
      await sleep(espera);
    }
  }
  throw new Error('inalcançável');
}

interface Alvo { id: string; title: string; tcuLinkPDF: string | null; leiArticlesArr: string[]; tcuAnalise: unknown }

/**
 * Resultado de `processar`. `'ok-sem-secoes'` é um subcaso de sucesso
 * (`status: 'success'` gravado normalmente, `secoes: null` no `tcuAnalise`)
 * — acórdão curto que só tem dispositivo, sem Relatório/Voto (~13% da
 * amostra). Separado de `'ok'` só para o sumário do run não confundir
 * "não debatido" (analisado, sem seções, `leiArticlesDebated: []`) com
 * "não consegui seccionar" — quem olha a coluna sem abrir o JSON não vê
 * a diferença; quem olha o log do run, vê.
 */
type Resultado = 'ok' | 'ok-sem-secoes' | 'falha' | 'pulado';

async function processar(d: Alvo): Promise<Resultado> {
  const jaFeito = (d.tcuAnalise as { v?: number } | null)?.v === ANALISE_VERSAO;
  if (jaFeito && !FORCE) return 'pulado';

  const r = await fetchInteiroTeor(d.tcuLinkPDF!);
  if (!r.ok) {
    console.log(`   ❌ ${d.title.slice(0, 40)} — ${r.erro}`);
    if (EXECUTE) {
      await comRetryDB(() => prisma.document.update({
        where: { id: d.id },
        data: { tcuEnriquecimentoStatus: 'failed', tcuEnriquecimentoErro: r.erro },
      }), `update failed ${d.id}`);
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
      await comRetryDB(() => prisma.document.update({
        where: { id: d.id },
        data: { tcuEnriquecimentoStatus: 'failed', tcuEnriquecimentoErro: erro },
      }), `update RTF-fail ${d.id}`);
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
    await comRetryDB(() => prisma.document.update({
      where: { id: d.id },
      data: {
        tcuTextoCompleto: final,
        tcuAnalise: analise as never,
        leiArticlesDebated: debatidos,
        tcuEnriquecimentoStatus: 'success',
        tcuEnriquecimentoErro: null,
        tcuEnriquecidoEm: new Date(),
      },
    }), `update ok ${d.id}`);
  }
  return analise.secoes === null ? 'ok-sem-secoes' : 'ok';
}

async function main() {
  console.log(EXECUTE ? '🔴 EXECUÇÃO\n' : '🔵 DRY-RUN — nada será gravado (use --execute)\n');

  const alvos = await comRetryDB(() => prisma.document.findMany({
    where: { category: 'acordao', tcuLinkPDF: { not: null } },
    select: { id: true, title: true, tcuLinkPDF: true, leiArticlesArr: true, tcuAnalise: true },
    orderBy: { id: 'asc' },
    ...(LIMIT ? { take: LIMIT } : {}),
  }), 'findMany alvos');
  console.log(`Acórdãos com link: ${alvos.length}\n`);

  const t0 = Date.now();
  let ok = 0, falha = 0, pulado = 0, semSecoes = 0;

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
    for (const r of rs) {
      if (r === 'ok') ok++;
      else if (r === 'ok-sem-secoes') { ok++; semSecoes++; }
      else if (r === 'falha') falha++;
      else pulado++;
    }

    const feitos = i + lote.length;
    const eta = Math.round(((Date.now() - t0) / feitos) * (alvos.length - feitos) / 1000 / 60);
    console.log(`   [${feitos}/${alvos.length}] ok=${ok} falha=${falha} pulado=${pulado} · ETA ~${eta}min`);
    // Delay entre lotes — não roda após o último.
    if (i + CONCORRENCIA < alvos.length) await sleep(DELAY_MS);
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`ok: ${ok} · falha: ${falha} · pulado: ${pulado} · sem seções: ${semSecoes}`);
  console.log(`tempo: ${Math.round((Date.now() - t0) / 1000 / 60)} min`);
  if (!EXECUTE) console.log('\n🔵 DRY-RUN — nada gravado.');
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
