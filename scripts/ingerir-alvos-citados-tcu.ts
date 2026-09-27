/**
 * Baixa e cataloga o inteiro teor dos acórdãos do TCU que são citados no voto
 * de 2 ou mais acórdãos do acervo, mas não existem como Document nem têm
 * destilação de tese (docs/HANDOFF-2026-09-27-nuvem-alvos-citados-tcu.md).
 *
 * SEM IA: não classifica, não resume, não embeda, não destila. Os acórdãos
 * entram invisíveis (categoria do grafo, isPublic false, reviewedBy
 * 'alvos-citados-tcu') e FORA da fila de embeddings (embeddingStatus
 * 'skipped'); a promoção automática a acervo público fica desligada. Nunca
 * exclui documento.
 *
 * Como funciona. A busca por número dá a identidade oficial (KEY, colegiado),
 * mas não o link do RTF, que só vem no feed de dados abertos. O feed não
 * filtra por número, então o script o caminha para trás, com cursor no banco
 * (BackfillCursor 'alvos-citados-tcu'), e decide cada item que é alvo
 * pendente (lib/tcu/alvos-citados.ts).
 *
 * Estado por item, no banco:
 *   ingerido      → Document com tcuTextoCompleto
 *   falha         → Document sem texto, tcuAnaliseTentativas (retentado até 3)
 *   ambíguo       → AlvoIdentidadeIrresolvida 'ambiguo'
 *   não encontrado→ AlvoIdentidadeIrresolvida 'naoEncontrado'
 * Rodar de novo pula tudo isso e retoma do cursor.
 *
 * Uso: npx tsx scripts/ingerir-alvos-citados-tcu.ts                 # dry-run
 *      npx tsx scripts/ingerir-alvos-citados-tcu.ts --execute --limite=20
 *      opções: --pagina=5000 (itens por chamada do feed) --pausa-ms=2000
 *
 * Custo medido em 27/09/2026: o feed profundo leva ~150 s por chamada,
 * qualquer que seja o tamanho da página, e vai até 2001 por volta do offset
 * 520.000. O RTF leva ~12 s por acórdão.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { buscarAcordaoPorNumero, type CandidatoAcordao } from '../lib/tcu/buscar-acordao-tcu';
import { registrarIdentidadeIrresolvida } from '../lib/tcu/resolver-identidade';
import { colegiadoPorConvergencia } from '../lib/tcu/colegiado-por-convergencia';
import { catalogarAcordao, type ResultadoCatalogacao } from '../lib/tcu/catalogar-acordao';
import {
  selecionarPendentes,
  decidirItemDoFeed,
  montarDocumentoAlvo,
  feedPassouDoAno,
  colegiadoCanonico,
  chaveDe,
  MARCA_ALVOS_CITADOS,
  type AlvoPendente,
  type ItemFeedComKey,
} from '../lib/tcu/alvos-citados';

const EXECUTE = process.argv.includes('--execute');

function flagNumero(nome: string, padrao: number): number {
  const arg = process.argv.find((a) => a.startsWith(`--${nome}=`));
  if (!arg) return padrao;
  const n = Number(arg.split('=')[1]);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`--${nome} precisa ser um número positivo`);
  return n;
}

const LIMITE = flagNumero('limite', 100_000);
const PAGINA = flagNumero('pagina', 5000);
const PAUSA_MS = flagNumero('pausa-ms', 2000);

const FEED = 'https://dados-abertos.apps.tcu.gov.br/api/acordao/recupera-acordaos';
const UA = 'Mozilla/5.0 (compatible; SiteDoBarral/1.0)';
const CURSOR_ID = MARCA_ALVOS_CITADOS;
const MAX_TENTATIVAS = 3;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Mesmo retry de conexão de scripts/backfill-tcu-inteiro-teor.ts (WebSocket do Neon). */
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
      console.log(`   ⏳ conexão caiu em "${rotulo}" (tentativa ${i}/${TENTATIVAS}): ${msg.slice(0, 60)}; retry em ${espera}ms`);
      await sleep(espera);
    }
  }
  throw new Error('inalcançável');
}

async function lerPagina(offset: number): Promise<ItemFeedComKey[] | null> {
  const esperas = [10_000, 30_000, 60_000];
  for (let i = 0; i <= esperas.length; i++) {
    try {
      const t0 = Date.now();
      const res = await fetch(`${FEED}?inicio=${offset}&quantidade=${PAGINA}`, {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
        signal: AbortSignal.timeout(600_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const itens = (await res.json()) as unknown;
      if (!Array.isArray(itens)) throw new Error('resposta não é array');
      console.log(`   feed offset ${offset}: ${itens.length} itens em ${((Date.now() - t0) / 1000).toFixed(0)} s`);
      return itens as ItemFeedComKey[];
    } catch (e) {
      if (i === esperas.length) {
        console.log(`   ❌ feed offset ${offset} falhou ${esperas.length + 1} vezes: ${(e as Error).message}`);
        return null;
      }
      console.log(`   ⏳ feed offset ${offset}: ${(e as Error).message}; nova tentativa em ${esperas[i] / 1000} s`);
      await sleep(esperas[i]);
    }
  }
  return null;
}

// ── Relatório do run ──────────────────────────────────────────────────────────
const rel = {
  ingeridos: [] as Array<{ chave: string; colegiado: string; origem: string; chars: number; seg: number; status: string }>,
  falhas: [] as Array<{ chave: string; erro: string }>,
  ambiguos: [] as Array<{ chave: string; candidatos: number }>,
  naoEncontrados: [] as string[],
  /** Subconjunto de naoEncontrados: o TCU só tem acórdão de relação para o número. */
  soRelacao: [] as string[],
  ignorados: 0,
  paginas: 0,
};

async function catalogar(
  doc: { id: string; title: string; tcuLinkPDF: string | null; leiArticlesArr: string[] },
  chave: string,
  colegiado: string,
  origem: string
): Promise<void> {
  const t0 = Date.now();
  const r: ResultadoCatalogacao = await comRetryDB(
    () => catalogarAcordao(doc, { enfileirarEmbedding: false, promover: false }),
    `catalogar ${chave}`
  );
  const seg = (Date.now() - t0) / 1000;
  if (r.status === 'falha') {
    rel.falhas.push({ chave, erro: r.erro ?? '?' });
    console.log(`   ❌ ${chave} ${colegiado}: ${r.erro} (${seg.toFixed(0)} s)`);
  } else {
    rel.ingeridos.push({ chave, colegiado, origem, chars: r.chars ?? 0, seg, status: r.status });
    console.log(`   ✅ ${chave} ${colegiado} [${origem}] ${r.status}, ${(r.chars ?? 0).toLocaleString('pt-BR')} chars (${seg.toFixed(0)} s)`);
  }
  await sleep(PAUSA_MS);
}

async function main() {
  const inicioRun = Date.now();
  console.log(`=== INGESTÃO DE ALVOS CITADOS DO TCU ${EXECUTE ? '(EXECUTE)' : '(DRY-RUN)'} ===`);
  console.log(`   limite ${LIMITE} · página ${PAGINA} · pausa ${PAUSA_MS} ms\n`);

  // ── Seleção ────────────────────────────────────────────────────────────────
  const alvos = await comRetryDB(
    () =>
      prisma.$queryRaw<Array<{ numero: number; ano: number; no_voto: number }>>`
        SELECT "numeroAlvo" AS numero, "anoAlvo" AS ano,
               count(DISTINCT "origemId") FILTER (WHERE "noVoto")::int AS no_voto
        FROM "AcordaoCitacao"
        GROUP BY 1, 2
        HAVING count(DISTINCT "origemId") FILTER (WHERE "noVoto") >= 2
        ORDER BY no_voto DESC`,
    'alvos'
  );
  const docs = await comRetryDB(
    () =>
      prisma.document.findMany({
        where: { acordaoNumero: { not: null }, acordaoAno: { not: null } },
        select: { acordaoNumero: true, acordaoAno: true },
      }),
    'documentos'
  );
  const teses = await comRetryDB(
    () => prisma.teseDestilacao.findMany({ where: { atual: true }, select: { chave: true } }),
    'teses'
  );
  const irresolvidos = await comRetryDB(
    () => prisma.alvoIdentidadeIrresolvida.findMany({ select: { chave: true } }),
    'irresolvidos'
  );
  const pendentes = selecionarPendentes(alvos, {
    documentos: new Set(docs.map((d) => chaveDe(d.acordaoNumero!, d.acordaoAno!))),
    teses: new Set(teses.map((t) => t.chave)),
    irresolvidos: new Set(irresolvidos.map((i) => i.chave)),
  });
  const porChave = new Map<string, AlvoPendente>(pendentes.map((p) => [p.chave, p]));
  const pendentesNoInicio = pendentes.length;
  console.log(`   alvos com ≥2 citações no voto: ${alvos.length}`);
  console.log(`   pendentes (sem Document, sem tese, sem veredito de irresolvido): ${pendentesNoInicio}\n`);

  let decididos = 0;

  // ── Fase 1: retomar catalogação que falhou em execução anterior ────────────
  const retomar = await comRetryDB(
    () =>
      prisma.document.findMany({
        where: { reviewedBy: MARCA_ALVOS_CITADOS, tcuTextoCompleto: null, tcuAnaliseTentativas: { lt: MAX_TENTATIVAS } },
        select: { id: true, title: true, tcuLinkPDF: true, leiArticlesArr: true, acordaoNumero: true, acordaoAno: true, tcuOrgaoJulgador: true },
      }),
    'retomar'
  );
  if (retomar.length) console.log(`── Fase 1: ${retomar.length} catalogações a retomar`);
  for (const d of retomar) {
    if (decididos >= LIMITE) break;
    const chave = chaveDe(d.acordaoNumero!, d.acordaoAno!);
    if (EXECUTE) await catalogar(d, chave, d.tcuOrgaoJulgador ?? '?', 'retomada');
    else console.log(`   [dry-run] retomaria ${chave}`);
    decididos++;
  }

  // ── Fase 2: caminhar o feed ────────────────────────────────────────────────
  const cursor = EXECUTE
    ? await comRetryDB(
        () => prisma.backfillCursor.upsert({ where: { id: CURSOR_ID }, create: { id: CURSOR_ID }, update: {} }),
        'cursor'
      )
    : (await prisma.backfillCursor.findUnique({ where: { id: CURSOR_ID } })) ?? { offset: 0, concluido: false };
  let offset = cursor.offset;
  let concluido = cursor.concluido;
  let motivoParada = concluido ? 'feed já caminhado até o fim (cursor concluído)' : '';
  const cacheBusca = new Map<string, CandidatoAcordao[]>();

  console.log(`\n── Fase 2: feed a partir do offset ${offset}`);
  while (!concluido && decididos < LIMITE && porChave.size > 0) {
    const itens = await lerPagina(offset);
    if (itens === null) { motivoParada = `feed indisponível no offset ${offset}`; break; }
    if (itens.length === 0) { motivoParada = `feed devolveu página vazia no offset ${offset} (não conclui; retomar depois)`; break; }
    rel.paginas++;

    let paginaInteira = true;
    const antesIngeridos = rel.ingeridos.length + rel.falhas.length;
    const antesIrresolvidos = rel.ambiguos.length + rel.naoEncontrados.length;
    for (const item of itens) {
      if (decididos >= LIMITE) { paginaInteira = false; break; }
      const num = Number(item.numeroAcordao);
      const ano = Number(item.anoAcordao);
      const chave = chaveDe(num, ano);
      const alvo = porChave.get(chave);
      if (!alvo) continue;

      let candidatos = cacheBusca.get(chave);
      if (!candidatos) {
        try {
          candidatos = await buscarAcordaoPorNumero(num, ano);
        } catch (e) {
          // Falha transitória: não decide e NÃO avança o cursor, para o item
          // não ficar para trás. A próxima execução reprocessa a página.
          motivoParada = `busca do TCU falhou em ${chave}: ${(e as Error).message}`;
          paginaInteira = false;
          break;
        }
        cacheBusca.set(chave, candidatos);
        await sleep(1000);
      }

      const completos = candidatos.filter((c) => !c.isRelacao);
      const convergencia =
        completos.length > 1 ? (await comRetryDB(() => colegiadoPorConvergencia(num, ano), `convergência ${chave}`))?.colegiado ?? null : null;
      const decisao = decidirItemDoFeed({ item, candidatos, convergencia });

      if (decisao.tipo === 'ignorar') { rel.ignorados++; continue; }

      porChave.delete(chave);
      decididos++;

      if (decisao.tipo === 'ambiguo' || decisao.tipo === 'naoEncontrado') {
        const candidatosN = decisao.tipo === 'ambiguo' ? decisao.candidatos : undefined;
        if (decisao.tipo === 'ambiguo') rel.ambiguos.push({ chave, candidatos: decisao.candidatos });
        else {
          rel.naoEncontrados.push(chave);
          if (candidatos.length > 0) rel.soRelacao.push(chave);
        }
        console.log(`   ⚠️  ${chave}: ${decisao.tipo}${candidatosN ? ` (${candidatosN} candidatos)` : ''}`);
        if (EXECUTE) await comRetryDB(() => registrarIdentidadeIrresolvida(num, ano, decisao.tipo as 'ambiguo' | 'naoEncontrado', candidatosN), `irresolvido ${chave}`);
        continue;
      }

      const colegiado = colegiadoCanonico(item.colegiado);
      if (!EXECUTE) {
        console.log(`   [dry-run] ingeriria ${chave} ${colegiado} [${decisao.origem}] (${alvo.no_voto} citações no voto)`);
        continue;
      }
      const dados = montarDocumentoAlvo(item)!;
      let doc;
      try {
        doc = await comRetryDB(
          () =>
            prisma.document.create({
              data: dados as Prisma.DocumentCreateInput,
              select: { id: true, title: true, tcuLinkPDF: true, leiArticlesArr: true },
            }),
          `criar ${chave}`
        );
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          console.log(`   ↷ ${chave} ${colegiado}: já existe (P2002), nada a fazer`);
          continue;
        }
        throw e;
      }
      await catalogar(doc, chave, colegiado, decisao.origem);
    }

    if (!paginaInteira) break;
    concluido = feedPassouDoAno(itens, Math.min(...[...porChave.values()].map((p) => p.ano), 9999));
    offset += PAGINA;
    if (EXECUTE) {
      const ultimo = itens[itens.length - 1];
      await comRetryDB(
        () =>
          prisma.backfillCursor.update({
            where: { id: CURSOR_ID },
            data: {
              offset,
              concluido,
              ultimoAcordao: `${ultimo.numeroAcordao}/${ultimo.anoAcordao}`,
              ultimaData: ultimo.dataSessao ?? null,
              totalInserido: { increment: rel.ingeridos.length + rel.falhas.length - antesIngeridos },
              totalIgnorado: { increment: rel.ambiguos.length + rel.naoEncontrados.length - antesIrresolvidos },
            },
          }),
        'cursor'
      );
    }
    if (concluido) motivoParada = 'feed passou do ano do alvo mais antigo (fim determinístico)';
  }
  if (!motivoParada) {
    motivoParada = decididos >= LIMITE ? `limite de ${LIMITE} atingido` : porChave.size === 0 ? 'nenhum alvo pendente' : 'fim do laço';
  }

  // ── Relatório ──────────────────────────────────────────────────────────────
  const n = rel.ingeridos.length;
  const tentados = n + rel.falhas.length;
  const media = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
  const falhasPorMotivo = new Map<string, number>();
  for (const f of rel.falhas) {
    const motivo = f.erro.replace(/\d+/g, 'N').slice(0, 60);
    falhasPorMotivo.set(motivo, (falhasPorMotivo.get(motivo) ?? 0) + 1);
  }
  console.log('\n=== RESULTADO ===');
  console.log(`   parada: ${motivoParada}`);
  console.log(`   cursor: offset ${offset}${concluido ? ' (concluído)' : ''} · páginas lidas neste run: ${rel.paginas}`);
  console.log(`   ingeridos com inteiro teor: ${n}`);
  console.log(`   falhas de download/extração: ${rel.falhas.length}${tentados ? ` (${((100 * rel.falhas.length) / tentados).toFixed(0)}% dos tentados)` : ''}`);
  for (const [m, q] of falhasPorMotivo) console.log(`      ${q}× ${m}`);
  console.log(`   ambíguos (não ingeridos): ${rel.ambiguos.length}${rel.ambiguos.length ? ` → ${rel.ambiguos.map((a) => a.chave).join(', ')}` : ''}`);
  console.log(`   não encontrados no TCU: ${rel.naoEncontrados.length}${rel.naoEncontrados.length ? ` → ${rel.naoEncontrados.join(', ')}` : ''}`);
  console.log(`      dos quais só existe acórdão de relação: ${rel.soRelacao.length}`);
  console.log(`   itens do feed ignorados (outra variante do número): ${rel.ignorados}`);
  console.log(`   tempo médio por acórdão catalogado: ${media(rel.ingeridos.map((i) => i.seg)).toFixed(1)} s`);
  console.log(`   tamanho médio do texto: ${Math.round(media(rel.ingeridos.map((i) => i.chars))).toLocaleString('pt-BR')} chars`);
  console.log(`   alvos que ainda faltam: ${porChave.size} de ${pendentesNoInicio}`);
  console.log(`   duração do run: ${((Date.now() - inicioRun) / 60000).toFixed(1)} min`);
  if (!EXECUTE) console.log('\n   DRY-RUN: nada foi gravado. Use --execute.');
}

main()
  .catch((e) => {
    console.error('💥 run abortado:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
