/**
 * Auditoria de integridade de referências (linkage) na base de conhecimento.
 *
 * Frentes:
 * 1. LegislativeAct.leiArticles — array JSON de números de artigos da Lei
 *    14.133 que cada ato regulamenta. Cada número deve existir em
 *    data/lei-14133-artigos.ts. Referências mortas viram links quebrados
 *    na UI ("Art. 999º não encontrado").
 *
 * 2. TribunalDecision.leiArticles — mesma coisa, decisões judiciais que
 *    citam artigos.
 *
 * 3. LegislativeActRelation — relações revoga/altera/regulamenta entre atos.
 *    sourceActId e targetActId têm FK garantida; o que pode ter problema
 *    é o `excerpt` ficar obsoleto se o source mudou.
 *
 * Read-only — só reporta.
 */
import { prisma } from '../lib/prisma';
import { LEI_14133_ARTIGOS } from '../data/lei-14133-artigos';

interface BadLink {
  table: string;
  recordId: string;
  recordLabel: string;
  field: string;
  badValue: string;
  reason: string;
}

const VALID_ARTICLES = new Set(Object.keys(LEI_14133_ARTIGOS));

function parseLeiArticles(json: string | null): string[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

async function auditLeiArticlesInLegislativeActs(): Promise<BadLink[]> {
  const acts = await prisma.legislativeAct.findMany({
    where: { leiArticles: { not: null } },
    select: { id: true, fullNumber: true, leiArticles: true },
  });
  const bad: BadLink[] = [];
  for (const a of acts) {
    const arts = parseLeiArticles(a.leiArticles);
    for (const num of arts) {
      if (!VALID_ARTICLES.has(num)) {
        bad.push({
          table: 'LegislativeAct',
          recordId: a.id,
          recordLabel: a.fullNumber,
          field: 'leiArticles',
          badValue: num,
          reason: `Artigo ${num} não existe em data/lei-14133-artigos.ts`,
        });
      }
    }
  }
  console.log(`✅ LegislativeAct.leiArticles: ${acts.length} atos com leiArticles, ${bad.length} referências mortas`);
  return bad;
}

async function auditLeiArticlesInTribunalDecisions(): Promise<BadLink[]> {
  const decisions = await prisma.tribunalDecision.findMany({
    where: { leiArticles: { not: null } },
    select: { id: true, tribunalCode: true, decisionNumber: true, leiArticles: true },
  });
  const bad: BadLink[] = [];
  for (const d of decisions) {
    const arts = parseLeiArticles(d.leiArticles);
    for (const num of arts) {
      if (!VALID_ARTICLES.has(num)) {
        bad.push({
          table: 'TribunalDecision',
          recordId: d.id,
          recordLabel: `${d.tribunalCode} ${d.decisionNumber}`,
          field: 'leiArticles',
          badValue: num,
          reason: `Artigo ${num} não existe em data/lei-14133-artigos.ts`,
        });
      }
    }
  }
  console.log(`✅ TribunalDecision.leiArticles: ${decisions.length} decisões com leiArticles, ${bad.length} referências mortas`);
  return bad;
}

async function auditRelationsExcerpts(): Promise<BadLink[]> {
  const relations = await prisma.legislativeActRelation.findMany({
    select: {
      id: true,
      sourceActId: true,
      targetActId: true,
      excerpt: true,
      relationType: true,
      reviewStatus: true,
      sourceAct: { select: { fullNumber: true, ementa: true, content: true } },
      targetAct: { select: { fullNumber: true } },
    },
  });
  const bad: BadLink[] = [];
  let stale = 0;
  for (const r of relations) {
    if (!r.excerpt || r.excerpt.length < 20) continue;
    // Excerpt deve aparecer literalmente na ementa ou content do source.
    const haystack = (r.sourceAct.ementa || '') + '\n' + (r.sourceAct.content || '');
    // Normalize whitespace pra comparação (excerpt pode ter sido salvo com
    // formatação ligeiramente diferente do texto atual após backfill).
    const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
    if (!norm(haystack).includes(norm(r.excerpt))) {
      stale++;
      if (bad.length < 30) {
        bad.push({
          table: 'LegislativeActRelation',
          recordId: r.id,
          recordLabel: `${r.sourceAct.fullNumber} → ${r.relationType} → ${r.targetAct.fullNumber}`,
          field: 'excerpt',
          badValue: r.excerpt.slice(0, 80) + (r.excerpt.length > 80 ? '...' : ''),
          reason: `Excerpt não aparece mais no texto do source (provavelmente texto foi reescrito após o detect)`,
        });
      }
    }
  }
  console.log(`✅ LegislativeActRelation.excerpt: ${relations.length} relações, ${stale} excerpts não casam mais com source`);
  return bad;
}

async function auditOrphanRelations(): Promise<BadLink[]> {
  // FKs garantem integridade, mas pode haver relations onde reviewStatus='pending'
  // há muito tempo (sinaliza backlog de revisão).
  const pending = await prisma.legislativeActRelation.findMany({
    where: { reviewStatus: 'pending' },
    select: { id: true, detectedAt: true, sourceAct: { select: { fullNumber: true } }, targetAct: { select: { fullNumber: true } }, relationType: true },
    orderBy: { detectedAt: 'asc' },
  });
  console.log(`📋 LegislativeActRelation pendentes de revisão: ${pending.length}`);
  if (pending.length > 0) {
    const oldest = pending[0];
    const ageMs = Date.now() - oldest.detectedAt.getTime();
    const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
    console.log(`   Mais antiga: ${oldest.sourceAct.fullNumber} → ${oldest.relationType} → ${oldest.targetAct.fullNumber} (${ageDays} dias)`);
  }
  return [];
}

async function main() {
  console.log('🔍 Auditoria de linkage integrity\n');

  const all: BadLink[] = [];
  all.push(...(await auditLeiArticlesInLegislativeActs()));
  all.push(...(await auditLeiArticlesInTribunalDecisions()));
  all.push(...(await auditRelationsExcerpts()));
  await auditOrphanRelations();

  console.log(`\n${'─'.repeat(80)}`);
  if (all.length === 0) {
    console.log('✅ Nenhum link quebrado encontrado.');
  } else {
    console.log(`⚠️ ${all.length} link(s) com problema:`);
    const byTable = new Map<string, BadLink[]>();
    for (const b of all) {
      const arr = byTable.get(b.table) ?? [];
      arr.push(b);
      byTable.set(b.table, arr);
    }
    for (const [table, items] of byTable) {
      console.log(`\n[${table}] ${items.length}:`);
      for (const i of items.slice(0, 15)) {
        console.log(`   ${i.recordLabel}`);
        console.log(`     ${i.field}=${JSON.stringify(i.badValue)} — ${i.reason}`);
      }
      if (items.length > 15) console.log(`   ... +${items.length - 15} outros`);
    }
  }

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
