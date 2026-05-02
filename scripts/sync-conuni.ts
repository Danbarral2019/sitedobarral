/**
 * Sync CONUNI (Consultoria Nacional da União de Uniformização) — sucessor do DECOR.
 *
 * Fetch único da API REST pública (sem auth/captcha) → ~1.681 manifestações.
 * - Insere novas
 * - Atualiza existentes (match por número/ano/órgão no título atual)
 * - Reclassifica categoria (decor → parecer/nota-tecnica/despacho/parecer-vinculante)
 * - Marca revogadas em aiClassification.vigencia (badge na UI)
 * - Marca embeddingStatus='pending' em alterados pra cron processar
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/sync-conuni.ts             # dry-run
 *   npx dotenv -e .env.local -- npx tsx scripts/sync-conuni.ts --apply
 *   npx dotenv -e .env.local -- npx tsx scripts/sync-conuni.ts --refetch   # força redownload da API
 */

import { prisma } from '../lib/prisma';
import fs from 'fs';
import path from 'path';

const API_URL = 'https://cgu.agu.gov.br/cgi-bin/sapiens_com/relsapiens/coleta.py';
const API_BODY = 'script=53&base=1&sqlpronto=VAZIO&param1=NULL&param2=NULL&param3=NULL&param4=NULL&param5=NULL';
const SNAPSHOT_DIR = path.join(process.cwd(), 'data');
const SNAPSHOT_PATH = path.join(SNAPSHOT_DIR, 'conuni-snapshot.json');

const APPLY = process.argv.includes('--apply');
const REFETCH = process.argv.includes('--refetch') || !fs.existsSync(SNAPSHOT_PATH);

interface ConuniItem {
  manifestacao: string;
  origem_manifestacao: number;
  link_manifestacao: string;
  tipo_de_manifestacao: number;
  assunto: string;
  ementa: string;
  natureza: string;
  ano: number;
  numero: number;
  id: number;
  orgao: string;
  vigencia: number;
  manifestacoes_relacionadas: string;
  manifestacao_revogadora: string;
  efeito_modificacao: string;
  aprovacao: string;
  anexos: unknown;
  // Cadeia de despachos (não persistimos individualmente, mas guardamos no aiClassification)
  despacho_do_coordenador?: string;
  despacho_do_diretor?: string;
  despacho_cgu?: string;
  despacho_agu?: string;
  despacho_SGU?: string;
  despacho_pres_rep?: string;
}

function classifyCategory(item: ConuniItem): string {
  if (item.natureza === 'Toda a Administração Pública Federal') {
    return 'parecer-vinculante';
  }
  switch (item.tipo_de_manifestacao) {
    case 1: case 4: return 'parecer';
    case 2: case 5: return 'despacho';
    case 3: return 'nota-tecnica';
    default: return 'parecer';
  }
}

function buildExternalUrl(item: ConuniItem): string {
  const link = (item.link_manifestacao || '').trim();
  if (!link) return 'https://cgu.agu.gov.br/conuni/';
  if (link.toLowerCase().endsWith('.pdf')) {
    return `https://cgu.agu.gov.br/decor/arquivos/${link}`;
  }
  // Sapiens — link_manifestacao é um id numérico
  return `https://sapiens.agu.gov.br/valida_publico?id=${link}`;
}

function vigenciaLabel(v: number): string {
  switch (v) {
    case 1: return 'vigente';
    case 0: return 'revogado';
    case 2: return 'modificado';
    default: return 'outro';
  }
}

function buildContent(item: ConuniItem): string {
  const parts = [
    item.manifestacao,
    '',
    'ASSUNTO:',
    (item.assunto || '').trim(),
    '',
    'EMENTA:',
    (item.ementa || '').trim(),
  ];
  if (item.aprovacao) parts.push('', `APROVAÇÃO: ${item.aprovacao}`);
  if (item.natureza) parts.push(`NATUREZA: ${item.natureza}`);
  if (item.manifestacao_revogadora) {
    parts.push(`REVOGADO POR: ${item.manifestacao_revogadora}`);
  }
  return parts.join('\n');
}

function buildTitle(item: ConuniItem): string {
  const subject = (item.assunto || '').trim().replace(/\s+/g, ' ');
  const truncated = subject.length > 120 ? subject.slice(0, 117) + '...' : subject;
  return truncated ? `${item.manifestacao} — ${truncated}` : item.manifestacao;
}

type ExistingDoc = { id: string; title: string; category: string; content: string | null; url: string; aiClassification: string | null };

/**
 * Tenta achar um Document existente que corresponde a este item CONUNI.
 * Heurística: title deve conter padrão (numero/ano) E (orgao OU sinônimo DECOR/CONUNI).
 */
function matchExisting(item: ConuniItem, candidates: ExistingDoc[]): ExistingDoc | null {
  if (candidates.length === 0) return null;

  // Variações do número
  const numStrs = [
    String(item.numero),
    String(item.numero).padStart(3, '0'),
    String(item.numero).padStart(4, '0'),
    String(item.numero).padStart(5, '0'),
  ];
  const yearStr = String(item.ano);

  // CONUNI hoje usa orgao="CONUNI" pra antigos do DECOR. Nossos títulos antigos têm "/DECOR/".
  // Aceita match se title contém o orgao OU (orgao=CONUNI E title contém /DECOR/).
  const orgaoUpper = item.orgao.toUpperCase();
  const orgaoVariants = [orgaoUpper];
  if (orgaoUpper === 'CONUNI') orgaoVariants.push('DECOR');

  for (const cand of candidates) {
    const titleUpper = cand.title.toUpperCase();
    if (!titleUpper.includes(yearStr)) continue;

    const hasOrgao = orgaoVariants.some(o => titleUpper.includes(`/${o}/`) || titleUpper.includes(`${o}/CGU`));
    if (!hasOrgao) continue;

    for (const n of numStrs) {
      const re = new RegExp(`\\b${n}\\s*/\\s*${yearStr}\\b`);
      if (re.test(cand.title)) return cand;
    }
  }
  return null;
}

async function fetchApi(): Promise<{ info: ConuniItem[] }> {
  console.log(`Fetching ${API_URL} ...`);
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: API_BODY,
  });
  if (!res.ok) throw new Error(`API HTTP ${res.status}`);
  const data = await res.json() as { erro: string; info: ConuniItem[] };
  if (data.erro !== 'OK') throw new Error(`API erro: ${data.erro}`);
  return { info: data.info };
}

async function loadSnapshot(): Promise<ConuniItem[]> {
  if (REFETCH) {
    const data = await fetchApi();
    if (!fs.existsSync(SNAPSHOT_DIR)) fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
    fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(data, null, 2));
    console.log(`Snapshot salvo em ${SNAPSHOT_PATH} (${data.info.length} itens)\n`);
    return data.info;
  }
  console.log(`Lendo snapshot cacheado: ${SNAPSHOT_PATH}`);
  const data = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf-8'));
  return data.info;
}

async function main() {
  const tag = APPLY ? '[APPLY]' : '[DRY-RUN]';
  console.log(`${tag} Sync CONUNI\n`);

  const items = await loadSnapshot();
  console.log(`Items CONUNI: ${items.length}`);

  // Carrega existentes (incluindo categorias antigas)
  const existing = await prisma.document.findMany({
    where: { category: { in: ['parecer', 'parecer-vinculante', 'decor', 'nota-tecnica', 'despacho'] } },
    select: { id: true, title: true, category: true, content: true, url: true, aiClassification: true },
  });
  console.log(`Existentes (parecer/decor/etc): ${existing.length}\n`);

  const matchedExistingIds = new Set<string>();

  // Plan
  const plan = {
    insert: [] as ConuniItem[],
    update: [] as Array<{ existing: ExistingDoc; item: ConuniItem; reasons: string[] }>,
    skip: [] as ConuniItem[],
  };

  for (const item of items) {
    const newCategory = classifyCategory(item);
    // Match contra todos os existentes ainda não casados (heurística faz tudo)
    const remaining = existing.filter(e => !matchedExistingIds.has(e.id));
    const matched = matchExisting(item, remaining);
    if (matched) matchedExistingIds.add(matched.id);

    if (!matched) {
      plan.insert.push(item);
      continue;
    }

    const newContent = buildContent(item);
    const newTitle = buildTitle(item);
    const newUrl = buildExternalUrl(item);

    const reasons: string[] = [];
    if (matched.category !== newCategory) reasons.push(`category ${matched.category}→${newCategory}`);
    if (matched.content !== newContent) reasons.push('content');
    if (matched.url !== newUrl) reasons.push('url');
    if (matched.title !== newTitle) reasons.push('title');

    // Sempre regrava aiClassification (com vigência atualizada)
    const oldAi = matched.aiClassification ? safeParseJson(matched.aiClassification) : null;
    const newAiVigencia = vigenciaLabel(item.vigencia);
    if (!oldAi || oldAi.vigencia !== newAiVigencia || oldAi.conuniId !== item.id) {
      reasons.push('aiClassification');
    }

    if (reasons.length > 0) {
      plan.update.push({ existing: matched, item, reasons });
    } else {
      plan.skip.push(item);
    }
  }

  // Resumo
  console.log('=== Plano ===');
  console.log(`Insert:    ${plan.insert.length}`);
  console.log(`Update:    ${plan.update.length}`);
  console.log(`Skip:      ${plan.skip.length}`);
  console.log(`Total:     ${plan.insert.length + plan.update.length + plan.skip.length}\n`);

  // Distribuição final por categoria (estimada)
  const finalCat: Record<string, number> = {};
  for (const item of items) {
    const c = classifyCategory(item);
    finalCat[c] = (finalCat[c] || 0) + 1;
  }
  console.log('Categorização final (CONUNI):');
  Object.entries(finalCat).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

  // Reclassificações detectadas
  const reclassif = plan.update.filter(u => u.reasons.some(r => r.startsWith('category')));
  console.log(`\nReclassificações de categoria: ${reclassif.length}`);
  const byTransition: Record<string, number> = {};
  reclassif.forEach(u => {
    const t = u.reasons.find(r => r.startsWith('category'))!;
    byTransition[t] = (byTransition[t] || 0) + 1;
  });
  Object.entries(byTransition).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

  // Revogações detectadas
  const revogados = items.filter(i => i.vigencia !== 1);
  console.log(`\nDocs com vigencia != vigente: ${revogados.length}`);
  const byVig: Record<string, number> = {};
  revogados.forEach(r => {
    const v = vigenciaLabel(r.vigencia);
    byVig[v] = (byVig[v] || 0) + 1;
  });
  Object.entries(byVig).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

  // Existentes que NÃO bateram com nada do CONUNI (curiosidade — preserved)
  const orphans = existing.filter(e => !matchedExistingIds.has(e.id));
  console.log(`\nDocs existentes sem match no CONUNI (preservados): ${orphans.length}`);
  if (orphans.length > 0 && orphans.length <= 25) {
    console.log('  Órfãos:');
    orphans.forEach(o => console.log(`    [${o.category}] ${o.title.slice(0, 90)}`));
  } else if (orphans.length > 0) {
    const byCat: Record<string, number> = {};
    orphans.forEach(o => byCat[o.category] = (byCat[o.category] || 0) + 1);
    Object.entries(byCat).forEach(([k, v]) => console.log(`    ${k}: ${v}`));
  }

  // Sample 5 inserts e 5 updates
  console.log('\n=== Amostra de inserts (5) ===');
  plan.insert.slice(0, 5).forEach(i => console.log(`  + [${classifyCategory(i)}] ${i.manifestacao}`));
  console.log('\n=== Amostra de updates (5) ===');
  plan.update.slice(0, 5).forEach(u => console.log(`  ~ [${u.existing.category}→${classifyCategory(u.item)}] ${u.item.manifestacao} (${u.reasons.join(', ')})`));

  if (!APPLY) {
    console.log(`\n[DRY-RUN] Use --apply pra executar.`);
    return;
  }

  // === APPLY ===
  console.log(`\n=== Executando ===`);

  let inserted = 0;
  let updated = 0;
  let errors = 0;

  for (const item of plan.insert) {
    try {
      const category = classifyCategory(item);
      const aiClassification = JSON.stringify({
        category,
        conuniId: item.id,
        vigencia: vigenciaLabel(item.vigencia),
        natureza: item.natureza,
        aprovacao: item.aprovacao,
        orgao: item.orgao,
        revogadoPor: item.manifestacao_revogadora || null,
        source: 'conuni-sync',
        syncedAt: new Date().toISOString(),
      });
      await prisma.document.create({
        data: {
          title: buildTitle(item),
          description: (item.ementa || '').slice(0, 500),
          type: 'link',
          url: buildExternalUrl(item),
          category,
          isPublic: true,
          tags: JSON.stringify([item.orgao]),
          content: buildContent(item),
          aiClassification,
          embeddingStatus: 'pending',
        },
      });
      inserted++;
    } catch (e) {
      errors++;
      console.error(`  ✗ Insert falhou: ${item.manifestacao}`, (e as Error).message);
    }
  }

  for (const { existing: doc, item } of plan.update) {
    try {
      const category = classifyCategory(item);
      const newContent = buildContent(item);
      const contentChanged = doc.content !== newContent;
      const aiClassification = JSON.stringify({
        category,
        conuniId: item.id,
        vigencia: vigenciaLabel(item.vigencia),
        natureza: item.natureza,
        aprovacao: item.aprovacao,
        orgao: item.orgao,
        revogadoPor: item.manifestacao_revogadora || null,
        source: 'conuni-sync',
        syncedAt: new Date().toISOString(),
      });
      await prisma.document.update({
        where: { id: doc.id },
        data: {
          title: buildTitle(item),
          description: (item.ementa || '').slice(0, 500),
          type: 'link',
          url: buildExternalUrl(item),
          category,
          tags: JSON.stringify([item.orgao]),
          content: newContent,
          aiClassification,
          // Só re-indexa se conteúdo mudou
          ...(contentChanged ? { embeddingStatus: 'pending' } : {}),
        },
      });
      updated++;
    } catch (e) {
      errors++;
      console.error(`  ✗ Update falhou: ${item.manifestacao}`, (e as Error).message);
    }
  }

  console.log(`\n[APPLY] Concluído: ${inserted} inseridos, ${updated} atualizados, ${errors} erros.`);
  console.log(`Cron de embeddings vai processar os pending nos próximos ciclos.`);

  await prisma.$disconnect();
}

function safeParseJson(s: string): { vigencia?: string; conuniId?: number } | null {
  try { return JSON.parse(s); } catch { return null; }
}

main()
  .catch(e => {
    console.error('Erro fatal:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
