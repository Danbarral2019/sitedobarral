/**
 * Backfill da onda A-W2: destila em lote a tese dos leading cases do TCU.
 *
 * O cron `destilar-teses-tcu` faz 5 casos por dia, o que levaria ~3 meses para
 * cobrir os 438 casos que a campanha de ingestão deixou acima do limiar. Este
 * script é a mesma destilação sem a espera, e reusa o núcleo compartilhado
 * (`selecionarElegiveis` + `persistirDestilacao`) para não divergir do cron.
 *
 * Retomável por construção: `selecionarElegiveis` já exclui quem tem versão
 * atual, então re-rodar depois de uma interrupção continua de onde parou.
 *
 * Uso:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-teses-tcu.ts --min-no-voto=10 --dry-run
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-teses-tcu.ts --min-no-voto=10 --limite=3
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-teses-tcu.ts --min-no-voto=10
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-teses-tcu.ts --min-no-voto=10 --realinhar
 */
import { prisma } from '../lib/prisma';
import { selecionarElegiveis, persistirDestilacao, MIN_NO_VOTO, type Candidato } from '../lib/tcu/persistir-tese';
import { coletarTrechosDoAlvo } from '../lib/tcu/trechos-de-citacao';
import { montarPromptTese, parseRespostaTese } from '../lib/tcu/destilar-tese';
import { buscarAcordaoPorNumero, escolherCandidato } from '../lib/tcu/buscar-acordao-tcu';
import { generate } from '../lib/ai';

/**
 * Preço do modelo de `enhancement` (claude-sonnet-5), US$ por milhão de tokens.
 * Promocional de lançamento, vigente até 31/08/2026 — depois sobe para 3/15.
 * Serve só para o relatório de custo; não influencia nenhuma decisão do script.
 */
const USD_POR_MTOK_IN = 2;
const USD_POR_MTOK_OUT = 10;

/** O TCU tolera ~1 req/s; o cron usa a mesma pausa. */
const PAUSA_TCU_MS = 1100;
const dorme = (ms: number) => new Promise((r) => setTimeout(r, ms));

function flagNumero(nome: string, padrao: number): number {
  const arg = process.argv.find((a) => a.startsWith(`--${nome}=`));
  if (!arg) return padrao;
  const n = Number(arg.split('=')[1]);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`--${nome} precisa ser um número positivo`);
  return n;
}

/**
 * Casos cuja destilação atual não é mais auditável: o dossiê gravado tem um
 * número de trechos diferente do que o grafo produz hoje, então os índices de
 * `trechosFonte` não apontam mais para os trechos que o modelo leu e a folha de
 * calibração não pode exibir a evidência. Acontece com o que o cron destilou
 * enquanto a fila de catalogação ainda drenava e o grafo crescia por baixo.
 *
 * Redestilar é seguro: `persistirDestilacao` versiona e `carregarVeredito`
 * transporta o julgamento do Daniel para todo enunciado de texto idêntico.
 */
async function selecionarDesalinhados(limite: number, minNoVoto: number): Promise<Candidato[]> {
  const atuais = await prisma.teseDestilacao.findMany({
    where: { atual: true },
    select: { numeroAlvo: true, anoAlvo: true, chave: true, dossieTrechos: true },
  });
  const contagens = await prisma.$queryRaw<Array<{ numero: number; ano: number; no_voto: number }>>`
    SELECT "numeroAlvo" AS numero, "anoAlvo" AS ano,
           count(DISTINCT "origemId") FILTER (WHERE "noVoto")::int AS no_voto
    FROM "AcordaoCitacao"
    GROUP BY 1, 2
    HAVING count(DISTINCT "origemId") FILTER (WHERE "noVoto") >= ${minNoVoto}`;
  const noVotoPorChave = new Map(contagens.map((c) => [`${c.numero}/${c.ano}`, c.no_voto]));

  const out: Candidato[] = [];
  for (const a of atuais) {
    const noVoto = noVotoPorChave.get(a.chave);
    if (noVoto === undefined) continue;
    const dossie = await coletarTrechosDoAlvo({ numero: a.numeroAlvo, ano: a.anoAlvo });
    if (dossie.trechos.length === a.dossieTrechos) continue;
    out.push({ numero: a.numeroAlvo, ano: a.anoAlvo, chave: a.chave, noVoto });
    if (out.length >= limite) break;
  }
  return out.sort((x, y) => y.noVoto - x.noVoto);
}

async function main() {
  const minNoVoto = flagNumero('min-no-voto', MIN_NO_VOTO);
  const limite = flagNumero('limite', 10_000);
  const dryRun = process.argv.includes('--dry-run');
  const realinhar = process.argv.includes('--realinhar');

  const candidatos = realinhar
    ? await selecionarDesalinhados(limite, minNoVoto)
    : await selecionarElegiveis(limite, minNoVoto);

  console.log(`=== BACKFILL DE TESES DO TCU (onda A-W2)${realinhar ? ' — MODO REALINHAMENTO' : ''} ===`);
  console.log(`  limiar:      >= ${minNoVoto} citações no voto`);
  console.log(`  candidatos:  ${candidatos.length}${dryRun ? '  (DRY-RUN — nada será destilado)' : ''}`);
  if (candidatos.length === 0) {
    console.log(
      realinhar
        ? '\nNada a realinhar: toda destilação atual bate com o dossiê do grafo.'
        : '\nNada a destilar: todos os casos acima do limiar já têm versão atual.'
    );
    return;
  }
  const faixaA = candidatos.filter((c) => c.noVoto >= 20).length;
  console.log(`  faixa A (>=20 no voto): ${faixaA}  ·  faixa B (10-19): ${candidatos.length - faixaA}`);
  console.log(`  primeiro: ${candidatos[0].chave} (${candidatos[0].noVoto} no voto)`);
  console.log(`  último:   ${candidatos.at(-1)!.chave} (${candidatos.at(-1)!.noVoto} no voto)\n`);

  if (dryRun) {
    for (const c of candidatos.slice(0, 20)) console.log(`  ${c.chave.padStart(10)}  ${c.noVoto} no voto`);
    if (candidatos.length > 20) console.log(`  … e mais ${candidatos.length - 20}`);
    return;
  }

  const inicio = Date.now();
  let ok = 0, semTese = 0, erros = 0, herdadosTotal = 0, tokIn = 0, tokOut = 0;

  for (const [i, c] of candidatos.entries()) {
    const prefixo = `[${String(i + 1).padStart(3)}/${candidatos.length}] ${c.chave} (${c.noVoto} no voto)`;
    try {
      const dossie = await coletarTrechosDoAlvo({ numero: c.numero, ano: c.ano });

      const cands = await buscarAcordaoPorNumero(c.numero, c.ano).catch(() => []);
      await dorme(PAUSA_TCU_MS);
      const proprio = escolherCandidato(cands);

      const { systemPrompt, userContent } = montarPromptTese({
        chave: c.chave,
        ementaPropria: proprio?.ementa ?? null,
        colegiado: proprio?.colegiado ?? null,
        relator: proprio?.relator ?? null,
        dossie,
      });

      // Sem `temperature`: o modelo de `enhancement` a depreciou (HTTP 400).
      const resposta = await generate('enhancement', {
        systemPrompt,
        messages: [{ role: 'user', content: userContent }],
        maxTokens: 4096,
        jsonMode: true,
      });
      tokIn += resposta.inputTokens ?? 0;
      tokOut += resposta.outputTokens ?? 0;

      const tese = parseRespostaTese(c.chave, resposta.text);
      const r = await persistirDestilacao({ numero: c.numero, ano: c.ano }, tese, dossie);
      herdadosTotal += r.herdados;

      const n = (tese.teses ?? []).length;
      if (n === 0) {
        semTese++;
        console.log(`${prefixo} — sem tese (modelo se calou): ${tese.assunto.slice(0, 90)}`);
      } else {
        ok++;
        console.log(`${prefixo} — ${n} tese(s), confiança ${tese.confianca}, ${dossie.trechos.length} trechos`);
      }
    } catch (e) {
      // Um caso que falha não pode derrubar a onda; re-rodar o script o repesca.
      erros++;
      console.error(`${prefixo} — ERRO: ${(e as Error).message}`);
    }
  }

  const custo = (tokIn / 1e6) * USD_POR_MTOK_IN + (tokOut / 1e6) * USD_POR_MTOK_OUT;
  const minutos = (Date.now() - inicio) / 60_000;
  const processados = ok + semTese;
  const totalComTeseAtual = await prisma.teseDestilacao.count({ where: { atual: true } });

  console.log(`\n=== RESUMO ===`);
  console.log(`  com tese:    ${ok}`);
  console.log(`  sem tese:    ${semTese}  (o motor optou por se calar — é o comportamento conservador esperado)`);
  console.log(`  erros:       ${erros}`);
  console.log(`  vereditos herdados da versão anterior: ${herdadosTotal}`);
  console.log(`  tokens:      ${tokIn.toLocaleString('pt-BR')} in · ${tokOut.toLocaleString('pt-BR')} out`);
  console.log(`  custo:       US$ ${custo.toFixed(2)}${processados ? `  (US$ ${(custo / processados).toFixed(4)}/caso)` : ''}`);
  console.log(`  tempo:       ${minutos.toFixed(1)} min${processados ? `  (${(minutos * 60 / processados).toFixed(0)}s/caso)` : ''}`);
  console.log(`  destilações atuais no banco: ${totalComTeseAtual}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
