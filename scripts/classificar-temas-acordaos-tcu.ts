/**
 * Classifica os acórdãos-ALVO do grafo por matéria, gravando em `AcordaoTema`.
 *
 * É o que permite destilar por assunto em vez de por volume de citação. O
 * limiar de citação no voto sozinho seleciona matéria repetitiva (pessoal), e a
 * base do site é sobre licitações e contratos — ver lib/tcu/tema-acordao.ts.
 *
 * Ordem de preferência do insumo, da mais confiável para a mais barata:
 *   1. `DocumentMetaTcu.area` — vem do próprio TCU (jurisprudência selecionada).
 *      Custo zero e não é palpite: quando existe, ganha do modelo.
 *   2. `Document.description` — o SUMÁRIO do acórdão, que é ementa temática.
 *   3. Recorte do inteiro teor.
 *   4. Se o alvo não foi ingerido mas JÁ TEM destilação, o assunto e a tese
 *      destilada servem de insumo — descrevem a matéria melhor que a ementa.
 *      Isso cobre os leading cases antigos (2005-2019), que são muito citados
 *      mas ficaram fora da campanha de ingestão (que varreu 2023-2026).
 * O que sobra sem insumo é reportado: existe só como destino de citação, e
 * classificar exigiria montar o dossiê inteiro.
 *
 * Uso:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/classificar-temas-acordaos-tcu.ts --min-no-voto=2
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/classificar-temas-acordaos-tcu.ts --min-no-voto=2 --dry-run
 */
import { prisma } from '../lib/prisma';
import {
  TEMAS,
  classificarPorLLM,
  gravarTema,
  temaDaAreaOficial,
  type AlvoParaClassificar,
  type Tema,
} from '../lib/tcu/tema-acordao';

const LOTE = 25;

function flagNumero(nome: string, padrao: number): number {
  const arg = process.argv.find((a) => a.startsWith(`--${nome}=`));
  if (!arg) return padrao;
  const n = Number(arg.split('=')[1]);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`--${nome} precisa ser um número positivo`);
  return n;
}

async function main() {
  const minNoVoto = flagNumero('min-no-voto', 2);
  const limite = flagNumero('limite', 100_000);
  const dryRun = process.argv.includes('--dry-run');
  const force = process.argv.includes('--force');

  const alvos = await prisma.$queryRaw<Array<{ numero: number; ano: number; no_voto: number }>>`
    SELECT "numeroAlvo" AS numero, "anoAlvo" AS ano,
           count(DISTINCT "origemId") FILTER (WHERE "noVoto")::int AS no_voto
    FROM "AcordaoCitacao"
    GROUP BY 1, 2
    HAVING count(DISTINCT "origemId") FILTER (WHERE "noVoto") >= ${minNoVoto}
    ORDER BY no_voto DESC`;

  const jaClassificados = force
    ? new Set<string>()
    : new Set((await prisma.acordaoTema.findMany({ select: { chave: true } })).map((t) => t.chave));

  const pendentes = alvos
    .map((a) => ({ ...a, chave: `${a.numero}/${a.ano}` }))
    .filter((a) => !jaClassificados.has(a.chave))
    .slice(0, limite);

  console.log(`=== CLASSIFICAÇÃO TEMÁTICA DE ALVOS (>= ${minNoVoto} citações no voto) ===`);
  console.log(`  alvos acima do limiar: ${alvos.length}`);
  console.log(`  já classificados:      ${jaClassificados.size}`);
  console.log(`  a classificar:         ${pendentes.length}${dryRun ? '  (DRY-RUN)' : ''}\n`);
  if (!pendentes.length) return;

  // Uma consulta só: N+1 sobre milhares de alvos seria o gargalo do script.
  const docs = await prisma.document.findMany({
    where: {
      OR: pendentes.map((p) => ({ acordaoNumero: p.numero, acordaoAno: p.ano })),
    },
    select: {
      acordaoNumero: true,
      acordaoAno: true,
      description: true,
      tcuTextoCompleto: true,
      metaTcu: { select: { area: true, tema: true, subtema: true, ementaCompleta: true } },
    },
  });
  const porChave = new Map(docs.map((d) => [`${d.acordaoNumero}/${d.acordaoAno}`, d]));

  const destilacoes = await prisma.teseDestilacao.findMany({
    where: { atual: true, chave: { in: pendentes.map((p) => p.chave) } },
    select: { chave: true, assunto: true, enunciados: { select: { enunciado: true }, take: 1, orderBy: { ordem: 'asc' } } },
  });
  const destPorChave = new Map(
    destilacoes.map((d) => [d.chave, [d.assunto, d.enunciados[0]?.enunciado].filter(Boolean).join(' — ')])
  );

  const paraLLM: AlvoParaClassificar[] = [];
  let oficiais = 0;
  let semInsumo = 0;
  const contagem = new Map<string, number>();

  for (const p of pendentes) {
    const doc = porChave.get(p.chave);
    if (!doc) {
      // Alvo não ingerido: a destilação que já existe descreve a matéria.
      const daTese = destPorChave.get(p.chave);
      if (daTese && daTese.replace(/\s+/g, ' ').trim().length >= 60) {
        paraLLM.push({ numero: p.numero, ano: p.ano, chave: p.chave, insumo: daTese });
      } else {
        semInsumo++;
      }
      continue;
    }

    const temaOficial = temaDaAreaOficial(doc.metaTcu?.area);
    if (temaOficial) {
      oficiais++;
      contagem.set(temaOficial, (contagem.get(temaOficial) ?? 0) + 1);
      if (!dryRun) {
        await gravarTema(
          { numero: p.numero, ano: p.ano, chave: p.chave },
          {
            tema: temaOficial,
            subtema: [doc.metaTcu?.tema, doc.metaTcu?.subtema].filter(Boolean).join(' · ').slice(0, 80) || 'area oficial do TCU',
            fronteirico: false,
          },
          'area-oficial',
          doc.metaTcu?.area ?? null
        );
      }
      continue;
    }

    const insumo = (doc.metaTcu?.ementaCompleta || doc.description || doc.tcuTextoCompleto || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (insumo.length < 60) {
      semInsumo++;
      continue;
    }
    paraLLM.push({ numero: p.numero, ano: p.ano, chave: p.chave, insumo });
  }

  console.log(`  por área oficial do TCU: ${oficiais}`);
  console.log(`  por LLM:                 ${paraLLM.length}`);
  console.log(`  sem insumo (alvo não ingerido ou texto curto): ${semInsumo}\n`);
  if (dryRun) return;

  for (let i = 0; i < paraLLM.length; i += LOTE) {
    const lote = paraLLM.slice(i, i + LOTE);
    const nLotes = Math.ceil(paraLLM.length / LOTE);
    try {
      const itens = await classificarPorLLM(lote);
      const porChaveLote = new Map(lote.map((l) => [l.chave, l]));
      for (const it of itens) {
        const alvo = porChaveLote.get(it.chave)!;
        contagem.set(it.tema, (contagem.get(it.tema) ?? 0) + 1);
        await gravarTema(alvo, it, 'llm', alvo.insumo);
      }
      console.log(`  lote ${i / LOTE + 1}/${nLotes}: ${itens.length}/${lote.length} classificados`);
    } catch (e) {
      // Um lote que falha não derruba a rodada; re-rodar repesca o que faltou.
      console.error(`  lote ${i / LOTE + 1}/${nLotes} — ERRO: ${(e as Error).message}`);
    }
  }

  console.log(`\n=== DISTRIBUIÇÃO DESTA RODADA ===`);
  for (const [t, n] of [...contagem.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${t} — ${TEMAS[t as Tema]}`);
  }
  const total = await prisma.acordaoTema.count();
  console.log(`\n  total classificado no banco: ${total}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
