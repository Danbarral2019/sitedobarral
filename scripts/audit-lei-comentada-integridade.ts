/**
 * AUDITORIA — Integridade da Lei 14.133 Comentada (Fase 0)
 *
 * Referência: docs/superpowers/specs/2026-07-15-lei-comentada-integridade-design.md
 *
 * Mede, sem corrigir nada:
 *   A0.1 Volume e contadores reais (vínculos por artigo)
 *   A0.2 Truncamento de content das ONs (3 sinais, não piso de 50)
 *   A0.3 content derivado de IA alimentando o RAG
 *   A0.4 Links quebrados (rota inexistente, url vazia, fallback AGU)
 *   A0.5 Quanto se perde com a régua nova (citação vs. tema) ← O NÚMERO DECISIVO
 *   A0.6 Padrões de título das ONs
 *
 * ⚠️ READ-ONLY ESTRITO. Nenhum write. Nenhum LLM. Custo zero.
 *
 * Uso: npx tsx scripts/audit-lei-comentada-integridade.ts
 *      npx tsx scripts/audit-lei-comentada-integridade.ts --json=out.json
 */
import { prisma } from '../lib/prisma';
import { citesArticle } from '../lib/lei-14133/citation-extractor';
import { writeFileSync } from 'fs';

const AGU_FALLBACK_URL = 'https://www.gov.br/agu/pt-br/composicao/cgu/cgu/onsagu';

const report: Record<string, unknown> = {};
const h = (s: string) => console.log(`\n${'='.repeat(72)}\n${s}\n${'='.repeat(72)}`);
const sub = (s: string) => console.log(`\n--- ${s} ---`);

// A extração de citação usa o extrator compartilhado (lib/lei-14133/
// citation-extractor.ts) — a mesma lógica do write-path (backfill/análise),
// incl. `boundToOtherNorm`. Antes havia aqui uma cópia inline que divergiu e
// virou auditor cego; ver docs/audits/2026-07-15-*.

// ─────────────────────────────────────────────────────────────────────────────
// A0.1 — Volume e contadores
// ─────────────────────────────────────────────────────────────────────────────
async function a01() {
  h('A0.1 — VOLUME E CONTADORES REAIS');

  const [doc, act, trib, blog, pub, gloss, lesson] = await Promise.all([
    prisma.document.count({ where: { leiArticlesArr: { isEmpty: false } } }),
    prisma.legislativeAct.count({ where: { leiArticlesArr: { isEmpty: false } } }),
    prisma.tribunalDecision.count({ where: { leiArticlesArr: { isEmpty: false } } }),
    prisma.blogPost.count({ where: { leiArticlesArr: { isEmpty: false } } }),
    prisma.publication.count({ where: { leiArticlesArr: { isEmpty: false } } }),
    prisma.glossaryTerm.count({ where: { leiArticlesArr: { isEmpty: false } } }),
    prisma.lesson.count({ where: { leiArticlesArr: { isEmpty: false } } }),
  ]);
  const totalDocs = await prisma.document.count();
  sub('Registros com leiArticlesArr não-vazio');
  console.table({ Document: doc, LegislativeAct: act, TribunalDecision: trib, BlogPost: blog, Publication: pub, GlossaryTerm: gloss, Lesson: lesson });
  console.log(`Document total (com e sem vínculo): ${totalDocs}`);
  report.a01_counts = { doc, act, trib, blog, pub, gloss, lesson, totalDocs };

  sub('Top 30 artigos por nº de vínculos (Document)');
  const topDoc = await prisma.$queryRaw<{ art: string; n: bigint }[]>`
    SELECT unnest("leiArticlesArr") AS art, COUNT(*) AS n
    FROM "Document" GROUP BY 1 ORDER BY n DESC LIMIT 30`;
  console.table(topDoc.map((r) => ({ artigo: r.art, docs: Number(r.n) })));
  report.a01_topDocument = topDoc.map((r) => ({ art: r.art, n: Number(r.n) }));

  sub('Top 15 artigos por nº de vínculos (LegislativeAct)');
  const topAct = await prisma.$queryRaw<{ art: string; n: bigint }[]>`
    SELECT unnest("leiArticlesArr") AS art, COUNT(*) AS n
    FROM "LegislativeAct" GROUP BY 1 ORDER BY n DESC LIMIT 15`;
  console.table(topAct.map((r) => ({ artigo: r.art, atos: Number(r.n) })));
  report.a01_topAct = topAct.map((r) => ({ art: r.art, n: Number(r.n) }));

  sub('Contador da UI = Document + LegislativeAct (a soma que gera o "240")');
  const merged: Record<string, number> = {};
  for (const r of topDoc) merged[r.art] = (merged[r.art] || 0) + Number(r.n);
  for (const r of topAct) merged[r.art] = (merged[r.art] || 0) + Number(r.n);
  const mergedTop = Object.entries(merged).sort((a, b) => b[1] - a[1]).slice(0, 12);
  console.table(mergedTop.map(([art, n]) => ({ artigo: art, 'total exibido': n })));
  report.a01_merged = mergedTop;

  sub('Categorias vazando para "Outros Documentos"');
  const CATEGORY_DISPLAY_KEYS = ['lei', 'medida-provisoria', 'decreto', 'portaria', 'in', 'orientacao-normativa', 'parecer', 'parecer-vinculante', 'decor', 'nota-tecnica', 'despacho', 'sumula', 'consulta_tcu', 'informativo', 'acordao'];
  const cats = await prisma.$queryRaw<{ category: string | null; n: bigint }[]>`
    SELECT category, COUNT(*) AS n FROM "Document"
    WHERE array_length("leiArticlesArr", 1) > 0 GROUP BY 1 ORDER BY n DESC`;
  const leaking = cats.filter((c) => !CATEGORY_DISPLAY_KEYS.includes(c.category || ''));
  console.table(cats.map((c) => ({ categoria: c.category, docs: Number(c.n), 'vaza p/ Outros?': !CATEGORY_DISPLAY_KEYS.includes(c.category || '') ? '⚠️ SIM' : '' })));
  report.a01_leakingCategories = leaking.map((c) => ({ cat: c.category, n: Number(c.n) }));

  const leiArtigo = cats.find((c) => c.category === 'lei-artigo');
  console.log(`\n>>> Sintoma 1 — Documents com category='lei-artigo' vinculados: ${leiArtigo ? Number(leiArtigo.n) : 0}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// A0.2 — Truncamento de content das ONs
// ─────────────────────────────────────────────────────────────────────────────
async function a02() {
  h('A0.2 — TRUNCAMENTO DE CONTENT DAS ONs (o achado mais grave)');

  const stats = await prisma.$queryRaw<{ n: bigint; nulos: bigint; min: number; p50: number; p90: number; max: number; avg: number }[]>`
    SELECT COUNT(*) AS n,
           COUNT(*) FILTER (WHERE content IS NULL OR LENGTH(content) < 50) AS nulos,
           MIN(LENGTH(content)) AS min,
           PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY LENGTH(content))::int AS p50,
           PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY LENGTH(content))::int AS p90,
           MAX(LENGTH(content)) AS max,
           AVG(LENGTH(content))::int AS avg
    FROM "Document" WHERE category = 'orientacao-normativa'`;
  sub('Distribuição de LENGTH(content) — ONs');
  console.table(stats.map((s) => ({ ONs: Number(s.n), 'sem content (<50)': Number(s.nulos), min: s.min, mediana: s.p50, p90: s.p90, max: s.max, média: s.avg })));
  report.a02_stats = stats.map((s) => ({ ...s, n: Number(s.n), nulos: Number(s.nulos) }));

  sub('SINAL 1 — content batendo no teto de 800 (assinatura do .substring(0,800))');
  const teto = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*) AS n FROM "Document"
    WHERE category='orientacao-normativa' AND LENGTH(content) BETWEEN 780 AND 805`;
  console.log(`ONs com content entre 780-805 chars: ${Number(teto[0].n)}`);
  report.a02_noTeto = Number(teto[0].n);

  sub('SINAL 2 — content termina sem pontuação final (corte no meio da frase)');
  // Exclui boilerplate DOU/assinatura em CAIXA ALTA (lição: falso positivo conhecido)
  const semPonto = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*) AS n FROM "Document"
    WHERE category='orientacao-normativa' AND content IS NOT NULL AND LENGTH(content) >= 50
      AND RIGHT(TRIM(content), 1) NOT IN ('.', '!', '?', ')', '"')
      AND RIGHT(TRIM(content), 40) <> UPPER(RIGHT(TRIM(content), 40))`;
  console.log(`ONs cortadas no meio da frase (excluindo boilerplate CAIXA ALTA): ${Number(semPonto[0].n)}`);
  report.a02_semPontuacao = Number(semPonto[0].n);

  sub('SINAL 3 — ONs sem o preâmbulo "O ADVOGADO-GERAL DA UNIÃO" (critério do import-ons-2026.ts:116)');
  const semPreambulo = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*) AS n FROM "Document"
    WHERE category='orientacao-normativa' AND content IS NOT NULL
      AND content NOT ILIKE '%ADVOGADO-GERAL DA UNIÃO%'`;
  console.log(`ONs sem preâmbulo AGU: ${Number(semPreambulo[0].n)}`);
  report.a02_semPreambulo = Number(semPreambulo[0].n);

  sub('Amostra — as 15 ONs mais suspeitas (com o final do texto)');
  const amostra = await prisma.$queryRaw<{ id: string; title: string; len: number; tail: string }[]>`
    SELECT id, title, LENGTH(content) AS len, RIGHT(TRIM(content), 70) AS tail
    FROM "Document"
    WHERE category='orientacao-normativa' AND content IS NOT NULL AND LENGTH(content) >= 50
      AND RIGHT(TRIM(content), 1) NOT IN ('.', '!', '?', ')', '"')
    ORDER BY LENGTH(content) DESC LIMIT 15`;
  for (const r of amostra) console.log(`  [${String(r.len).padStart(5)}] ${r.title.slice(0, 45).padEnd(45)} …${r.tail.replace(/\s+/g, ' ')}`);
  report.a02_amostra = amostra;

  sub('>>> A ON 94/2024 relatada pelo Daniel');
  const on94 = await prisma.$queryRaw<{ id: string; title: string; len: number; url: string; tail: string }[]>`
    SELECT id, title, LENGTH(content) AS len, url, RIGHT(TRIM(content), 90) AS tail
    FROM "Document" WHERE "onNumber"=94 AND "onYear"=2024`;
  if (!on94.length) console.log('  (não encontrada por onNumber/onYear — tentando por título)');
  const on94b = on94.length ? on94 : await prisma.$queryRaw<{ id: string; title: string; len: number; url: string; tail: string }[]>`
    SELECT id, title, LENGTH(content) AS len, url, RIGHT(TRIM(content), 90) AS tail
    FROM "Document" WHERE category='orientacao-normativa' AND title ILIKE '%94%2024%'`;
  for (const r of on94b) console.log(`  id=${r.id}\n  título: ${r.title}\n  content: ${r.len} chars\n  url: ${r.url}\n  final: …${(r.tail || '').replace(/\s+/g, ' ')}`);
  report.a02_on94 = on94b;
}

// ─────────────────────────────────────────────────────────────────────────────
// A0.3 — content derivado de IA no RAG
// ─────────────────────────────────────────────────────────────────────────────
async function a03() {
  h('A0.3 — CONTENT DERIVADO DE IA ALIMENTANDO O RAG');

  const semContent = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*) AS n FROM "Document"
    WHERE category='orientacao-normativa' AND (content IS NULL OR LENGTH(content) < 50)`;
  console.log(`ONs SEM content → RAG cai no fallback description: ${Number(semContent[0].n)}`);
  report.a03_semContent = Number(semContent[0].n);

  sub('Descriptions com "cheiro" de resumo de IA (entre as ONs sem content)');
  const iaish = await prisma.$queryRaw<{ id: string; title: string; description: string }[]>`
    SELECT id, title, LEFT(description, 100) AS description FROM "Document"
    WHERE category='orientacao-normativa' AND (content IS NULL OR LENGTH(content) < 50)
      AND (description ILIKE '%esclarece que%' OR description ILIKE '%estabelece que%'
           OR description ILIKE '%A Orientação Normativa%' OR description ILIKE '%determina que%')
    LIMIT 15`;
  for (const r of iaish) console.log(`  ${r.title.slice(0, 40).padEnd(40)} → "${(r.description || '').replace(/\s+/g, ' ')}…"`);
  console.log(`\n>>> ${iaish.length} amostras. Estes textos são o que o assistente cita como se fosse a norma.`);
  report.a03_iaish = iaish;
}

// ─────────────────────────────────────────────────────────────────────────────
// A0.4 — Links quebrados
// ─────────────────────────────────────────────────────────────────────────────
async function a04() {
  h('A0.4 — LINKS QUEBRADOS');

  sub('LegislativeActs sem officialUrl → 404 garantido em /atos-normativos/[id] (rota inexistente)');
  const actsSemUrl = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*) AS n FROM "LegislativeAct"
    WHERE ("officialUrl" IS NULL OR "officialUrl" = '') AND array_length("leiArticlesArr",1) > 0`;
  console.log(`⚠️ ${Number(actsSemUrl[0].n)} atos vinculados a artigos geram 404 certo`);
  report.a04_actsSemUrl = Number(actsSemUrl[0].n);

  sub('Documents com url vazia → 404 "Arquivo no servidor não encontrado"');
  const docsUrlVazia = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*) AS n FROM "Document"
    WHERE (url = '' OR url IS NULL) AND array_length("leiArticlesArr",1) > 0`;
  console.log(`⚠️ ${Number(docsUrlVazia[0].n)} documents vinculados com url vazia`);
  report.a04_docsUrlVazia = Number(docsUrlVazia[0].n);

  sub('Documents apontando para o filesystem local (public/uploads — não existe em produção)');
  const docsLocal = await prisma.$queryRaw<{ n: bigint; comR2: bigint }[]>`
    SELECT COUNT(*) AS n, COUNT(*) FILTER (WHERE "r2Key" IS NOT NULL) AS "comR2"
    FROM "Document" WHERE url NOT ILIKE 'http%' AND url <> ''`;
  console.log(`⚠️ ${Number(docsLocal[0].n)} documents com url relativa (${Number(docsLocal[0].comR2)} têm r2Key mas a rota de download NÃO consulta r2Key)`);
  report.a04_docsLocal = { n: Number(docsLocal[0].n), comR2: Number(docsLocal[0].comR2) };

  sub('ONs com URL de fallback (página-índice da AGU, não o documento)');
  const fallback = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*) AS n FROM "Document" WHERE url = ${AGU_FALLBACK_URL}`;
  console.log(`⚠️ ${Number(fallback[0].n)} ONs apontam para a página-índice (esperado ~57)`);
  report.a04_fallbackAgu = Number(fallback[0].n);

  sub('>>> ON 2/2012 (relatada pelo Daniel)');
  const on2 = await prisma.$queryRaw<{ id: string; title: string; url: string; type: string; isPublic: boolean; r2Key: string | null; len: number | null }[]>`
    SELECT id, title, url, type, "isPublic", "r2Key", LENGTH(content) AS len
    FROM "Document" WHERE "onNumber"=2 AND "onYear"=2012`;
  const on2b = on2.length ? on2 : await prisma.$queryRaw<{ id: string; title: string; url: string; type: string; isPublic: boolean; r2Key: string | null; len: number | null }[]>`
    SELECT id, title, url, type, "isPublic", "r2Key", LENGTH(content) AS len
    FROM "Document" WHERE category='orientacao-normativa' AND (title ILIKE '%2/2012%' OR title ILIKE '%ON 2/%')`;
  for (const r of on2b) console.log(`  id=${r.id}\n  título: ${r.title}\n  url: ${r.url}\n  type=${r.type} isPublic=${r.isPublic} r2Key=${r.r2Key ?? 'NULL'} content=${r.len ?? 'NULL'} chars`);
  if (!on2b.length) console.log('  ❌ não encontrada');
  report.a04_on2 = on2b;

  sub('>>> Quadro comparativo 8.666 x 14.133 (link morto relatado)');
  const quadro = await prisma.$queryRaw<{ id: string; title: string; category: string | null; type: string; url: string; r2Key: string | null }[]>`
    SELECT id, title, category, type, url, "r2Key" FROM "Document"
    WHERE title ILIKE '%comparativ%' OR id LIKE '487c1978%'`;
  for (const r of quadro) console.log(`  id=${r.id}\n  título: ${r.title}\n  category=${r.category} type=${r.type} r2Key=${r.r2Key ?? 'NULL'}\n  url: "${r.url}"`);
  if (!quadro.length) console.log('  (não encontrado)');
  report.a04_quadro = quadro;
}

// ─────────────────────────────────────────────────────────────────────────────
// A0.5 — O NÚMERO DECISIVO: quanto se perde com a régua nova
// ─────────────────────────────────────────────────────────────────────────────
async function a05() {
  h('A0.5 — CITAÇÃO vs. TEMA (o número que decide a régua)');
  console.log('Extrator: regex de citação + janela de ±250 chars procurando "14.133". Sem LLM, custo zero.\n');

  const ALVOS = ['1', '5', '6', '75', '107'];
  const resumo: Record<string, unknown>[] = [];

  for (const art of ALVOS) {
    const docs = await prisma.document.findMany({
      where: { leiArticlesArr: { has: art } },
      select: { id: true, title: true, category: true, content: true, description: true },
    });
    let cita = 0, ambiguo = 0, naoCita = 0;
    const exemplosNaoCita: string[] = [];
    for (const d of docs) {
      const texto = [d.content, d.description].filter(Boolean).join('\n');
      const r = citesArticle(texto, art);
      if (r.cites) cita++;
      else if (r.ambiguous) ambiguo++;
      else {
        naoCita++;
        if (exemplosNaoCita.length < 12) exemplosNaoCita.push(`[${d.category}] ${d.title.slice(0, 62)}`);
      }
    }
    const pct = docs.length ? Math.round((cita / docs.length) * 100) : 0;
    resumo.push({ artigo: art, total: docs.length, 'cita (14.133)': cita, 'ambíguo': ambiguo, 'NÃO cita': naoCita, '% cita': `${pct}%` });

    sub(`Art. ${art} — ${docs.length} docs | cita: ${cita} | ambíguo: ${ambiguo} | NÃO cita: ${naoCita}`);
    if (exemplosNaoCita.length) {
      console.log('  Exemplos que NÃO citam o artigo (virariam "tema" ou sairiam):');
      for (const e of exemplosNaoCita) console.log(`    · ${e}`);
    }
  }
  console.log('\n>>> RESUMO — impacto da régua nova');
  console.table(resumo);
  report.a05 = resumo;
}

// ─────────────────────────────────────────────────────────────────────────────
// A0.6 — Padrões de título das ONs
// ─────────────────────────────────────────────────────────────────────────────
async function a06() {
  h('A0.6 — PADRÕES DE TÍTULO DAS ONs');
  const padroes = await prisma.$queryRaw<{ padrao: string; n: bigint }[]>`
    SELECT CASE
      WHEN title ~ '^Orientação Normativa AGU nº [0-9]{1,3}/[0-9]{4}$' THEN '1. canônico'
      WHEN title ~ '^ON [0-9]' THEN '2. abreviado (cron import-documents:143)'
      WHEN title = UPPER(title) THEN '3. DOU verbatim (CAIXA ALTA)'
      WHEN title ~ 'CNU|CGU' THEN '4. CNU/CGU zero-padded'
      ELSE '5. outro' END AS padrao, COUNT(*) AS n
    FROM "Document" WHERE category = 'orientacao-normativa' GROUP BY 1 ORDER BY n DESC`;
  console.table(padroes.map((p) => ({ padrão: p.padrao, ONs: Number(p.n) })));
  report.a06_padroes = padroes.map((p) => ({ padrao: p.padrao, n: Number(p.n) }));

  sub('Amostra de títulos fora do padrão canônico');
  const fora = await prisma.$queryRaw<{ title: string }[]>`
    SELECT title FROM "Document"
    WHERE category='orientacao-normativa'
      AND title !~ '^Orientação Normativa AGU nº [0-9]{1,3}/[0-9]{4}$' LIMIT 15`;
  for (const r of fora) console.log(`  · ${r.title.slice(0, 88)}`);

  sub('Efeito colateral: filtro por ano (busca "/AAAA/" no título) não encontra estes');
  const semBarraAno = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*) AS n FROM "Document"
    WHERE category='orientacao-normativa' AND title !~ '/[0-9]{4}'`;
  console.log(`⚠️ ${Number(semBarraAno[0].n)} ONs invisíveis ao filtro por ano da Base de Conhecimento`);
  report.a06_invisiveisFiltroAno = Number(semBarraAno[0].n);
}

// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('AUDITORIA — Integridade da Lei 14.133 Comentada (Fase 0)');
  console.log('READ-ONLY. Nenhuma escrita. Nenhum LLM.\n');
  const t0 = Date.now();

  await a01();
  await a02();
  await a03();
  await a04();
  await a05();
  await a06();

  h('FIM');
  console.log(`Tempo: ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  const jsonArg = process.argv.find((a) => a.startsWith('--json='));
  if (jsonArg) {
    const path = jsonArg.split('=')[1];
    writeFileSync(path, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`Relatório JSON: ${path}`);
  }
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('ERRO:', e);
  await prisma.$disconnect();
  process.exit(1);
});
