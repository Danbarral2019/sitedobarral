/**
 * Normaliza TribunalDecision.leiArticles pro formato canônico.
 *
 * Bug histórico: extração legacy gravou refs no formato `"Art. 6"`,
 * `"Art. 75-A"` em vez do canônico (só número, ex: `"6"`, `"75-A"`).
 * Resultado: 2650 referências (em 834 decisões) viram links quebrados na
 * UI porque a UI faz lookup direto em LEI_14133_ARTIGOS["Art. 6"] que
 * não existe.
 *
 * O formato canônico é definido em `lib/article-utils.ts`:
 *   extractArticleNumbers() retorna o JSON parseado direto
 *   formatArticleNumber(num) → `Art. ${num}` é o ÚNICO ponto de prefix
 *   getArticleData(num) → LEI_14133_ARTIGOS[num]
 *
 * Estratégia:
 * - Parse JSON
 * - Pra cada elem, extrair só o número canônico (pode ter sufixo de letra)
 * - Manter na lista APENAS os que existem em LEI_14133_ARTIGOS
 * - Refs inválidas (não casam com nenhum padrão ou não existem na lei) →
 *   reportar pra revisão manual, NÃO salvar
 *
 * Modos: dry-run | --apply
 */
import { prisma } from '../lib/prisma';
import { LEI_14133_ARTIGOS } from '../data/lei-14133-artigos';

const VALID = new Set(Object.keys(LEI_14133_ARTIGOS));

/**
 * Normaliza um item de leiArticles. Retorna:
 * - string: forma canônica que existe em LEI_14133_ARTIGOS
 * - null: não conseguiu mapear pra um artigo válido
 */
function normalizeRef(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();

  // 1. Já está canônico ("75", "178-A")?
  if (VALID.has(trimmed)) return trimmed;

  // 2. Padrões com prefix "Art. ": extrai o número e tenta com/sem letra
  const match = trimmed.match(/^Art\.?\s*(\d+(?:[-\s][A-Z])?)\b/i);
  if (match) {
    const candidate = match[1].replace(/\s+/g, '').toUpperCase();
    if (VALID.has(candidate)) return candidate;
    // Fallback: só o número (caso tenha "Art. 75 A" ou "Art. 75A" mal formado)
    const onlyNumber = candidate.replace(/[-A-Z]+$/, '');
    if (VALID.has(onlyNumber)) return onlyNumber;
  }

  // 3. Padrões "75-A" ou "75 A" sem "Art."
  const m2 = trimmed.match(/^(\d+)[-\s]?([A-Z])$/i);
  if (m2) {
    const candidate = `${m2[1]}-${m2[2].toUpperCase()}`;
    if (VALID.has(candidate)) return candidate;
    if (VALID.has(m2[1])) return m2[1];
  }

  // 4. Só extrair número
  const m3 = trimmed.match(/^(\d+)/);
  if (m3 && VALID.has(m3[1])) return m3[1];

  return null;
}

interface DecisionDiff {
  id: string;
  label: string;
  before: string[];
  after: string[];
  dropped: string[];
}

async function main() {
  const apply = process.argv.includes('--apply');
  const decisions = await prisma.tribunalDecision.findMany({
    where: { leiArticles: { not: null } },
    select: { id: true, tribunalCode: true, decisionNumber: true, leiArticles: true, leiArticlesArr: true },
  });

  const diffs: DecisionDiff[] = [];
  let totalBefore = 0;
  let totalAfter = 0;
  let totalDropped = 0;
  const droppedRefs = new Map<string, number>();

  for (const d of decisions) {
    let before: string[] = [];
    try { before = JSON.parse(d.leiArticles!); } catch { continue; }
    if (!Array.isArray(before)) continue;

    const after: string[] = [];
    const dropped: string[] = [];
    for (const ref of before) {
      const normalized = normalizeRef(String(ref));
      if (normalized && !after.includes(normalized)) {
        after.push(normalized);
      } else if (!normalized) {
        dropped.push(String(ref));
      }
    }

    totalBefore += before.length;
    totalAfter += after.length;
    totalDropped += dropped.length;
    for (const r of dropped) droppedRefs.set(r, (droppedRefs.get(r) ?? 0) + 1);

    if (JSON.stringify(before) !== JSON.stringify(after)) {
      diffs.push({
        id: d.id,
        label: `${d.tribunalCode} ${d.decisionNumber}`,
        before,
        after,
        dropped,
      });
    }
  }

  console.log(`📋 ${decisions.length} decisões com leiArticles`);
  console.log(`   ${diffs.length} precisam normalização ${apply ? '(APPLY)' : '(dry-run)'}\n`);
  console.log(`📊 Refs:`);
  console.log(`   Antes:    ${totalBefore}`);
  console.log(`   Depois:   ${totalAfter}`);
  console.log(`   Dropadas: ${totalDropped} (não casaram com Lei 14.133)\n`);

  // Top 10 refs droppadas (provável bug recorrente de extração)
  if (droppedRefs.size > 0) {
    const topDropped = [...droppedRefs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    console.log(`🔍 Top 10 refs droppadas (precisam de revisão manual):`);
    for (const [ref, count] of topDropped) {
      console.log(`   ${count}× ${JSON.stringify(ref)}`);
    }
  }

  // Sample de 3 diffs
  if (diffs.length > 0) {
    console.log(`\n📝 Sample (3 diffs):`);
    for (const d of diffs.slice(0, 3)) {
      console.log(`\n   ${d.label}:`);
      console.log(`     ANTES:  ${JSON.stringify(d.before.slice(0, 8))}${d.before.length > 8 ? '...' : ''}`);
      console.log(`     DEPOIS: ${JSON.stringify(d.after.slice(0, 8))}${d.after.length > 8 ? '...' : ''}`);
      if (d.dropped.length > 0) {
        console.log(`     DROPADAS: ${JSON.stringify(d.dropped.slice(0, 5))}${d.dropped.length > 5 ? '...' : ''}`);
      }
    }
  }

  if (!apply) {
    console.log(`\n🔒 dry-run. Use --apply pra gravar as ${diffs.length} mudanças.`);
    await prisma.$disconnect();
    return;
  }

  if (diffs.length === 0) {
    console.log(`\n✅ Sem mudanças.`);
    await prisma.$disconnect();
    return;
  }

  console.log(`\n💾 Aplicando ${diffs.length} updates...`);
  let written = 0;
  for (const d of diffs) {
    await prisma.tribunalDecision.update({
      where: { id: d.id },
      data: { leiArticles: JSON.stringify(d.after) },
    });
    written++;
    if (written % 100 === 0) console.log(`   ${written}/${diffs.length}...`);
  }
  console.log(`✅ ${written} updates aplicados.`);
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
