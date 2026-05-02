import type { PrismaClient } from '@prisma/client';

const API_URL = 'https://cgu.agu.gov.br/cgi-bin/sapiens_com/relsapiens/coleta.py';
const API_BODY = 'script=53&base=1&sqlpronto=VAZIO&param1=NULL&param2=NULL&param3=NULL&param4=NULL&param5=NULL';

export interface ConuniItem {
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
}

export interface SyncResult {
  itemsTotal: number;
  existingTotal: number;
  inserted: number;
  updated: number;
  skipped: number;
  reclassifications: Record<string, number>;
  vigenciaCounts: Record<string, number>;
  orphans: number;
  errors: number;
  errorSamples: string[];
  startedAt: string;
  finishedAt: string;
  elapsedSeconds: number;
}

type ExistingDoc = {
  id: string;
  title: string;
  category: string;
  content: string | null;
  url: string;
  aiClassification: string | null;
};

export function classifyCategory(item: ConuniItem): string {
  if (item.natureza === 'Toda a Administração Pública Federal') {
    return 'parecer-vinculante';
  }
  switch (item.tipo_de_manifestacao) {
    case 1:
    case 4:
      return 'parecer';
    case 2:
    case 5:
      return 'despacho';
    case 3:
      return 'nota-tecnica';
    default:
      return 'parecer';
  }
}

export function buildExternalUrl(item: ConuniItem): string {
  const link = (item.link_manifestacao || '').trim();
  if (!link) return 'https://cgu.agu.gov.br/conuni/';
  if (link.toLowerCase().endsWith('.pdf')) {
    return `https://cgu.agu.gov.br/decor/arquivos/${link}`;
  }
  return `https://sapiens.agu.gov.br/valida_publico?id=${link}`;
}

export function vigenciaLabel(v: number): string {
  switch (v) {
    case 1:
      return 'vigente';
    case 0:
      return 'revogado';
    case 2:
      return 'modificado';
    default:
      return 'outro';
  }
}

export function buildContent(item: ConuniItem): string {
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

export function buildTitle(item: ConuniItem): string {
  const subject = (item.assunto || '').trim().replace(/\s+/g, ' ');
  const truncated = subject.length > 120 ? subject.slice(0, 117) + '...' : subject;
  return truncated ? `${item.manifestacao} — ${truncated}` : item.manifestacao;
}

export function matchExisting(item: ConuniItem, candidates: ExistingDoc[]): ExistingDoc | null {
  if (candidates.length === 0) return null;
  const numStrs = [
    String(item.numero),
    String(item.numero).padStart(3, '0'),
    String(item.numero).padStart(4, '0'),
    String(item.numero).padStart(5, '0'),
  ];
  const yearStr = String(item.ano);
  const orgaoUpper = item.orgao.toUpperCase();
  const orgaoVariants = [orgaoUpper];
  if (orgaoUpper === 'CONUNI') orgaoVariants.push('DECOR');

  for (const cand of candidates) {
    const titleUpper = cand.title.toUpperCase();
    if (!titleUpper.includes(yearStr)) continue;
    const hasOrgao = orgaoVariants.some(
      (o) => titleUpper.includes(`/${o}/`) || titleUpper.includes(`${o}/CGU`),
    );
    if (!hasOrgao) continue;
    for (const n of numStrs) {
      const re = new RegExp(`\\b${n}\\s*/\\s*${yearStr}\\b`);
      if (re.test(cand.title)) return cand;
    }
  }
  return null;
}

export async function fetchConuniApi(): Promise<ConuniItem[]> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: API_BODY,
  });
  if (!res.ok) throw new Error(`CONUNI API HTTP ${res.status}`);
  const data = (await res.json()) as { erro: string; info: ConuniItem[] };
  if (data.erro !== 'OK') throw new Error(`CONUNI API erro: ${data.erro}`);
  return data.info;
}

/**
 * Executa o sync completo do CONUNI. Idempotente: chamadas subsequentes só
 * inserem manifestações novas e atualizam as que mudaram.
 */
export async function syncConuni(
  prisma: PrismaClient,
  items?: ConuniItem[],
): Promise<SyncResult> {
  const startedAt = new Date();
  const data = items ?? (await fetchConuniApi());

  const existing = await prisma.document.findMany({
    where: { category: { in: ['parecer', 'parecer-vinculante', 'decor', 'nota-tecnica', 'despacho'] } },
    select: { id: true, title: true, category: true, content: true, url: true, aiClassification: true },
  });

  const matchedExistingIds = new Set<string>();
  const reclassifications: Record<string, number> = {};
  const vigenciaCounts: Record<string, number> = {};
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  const errorSamples: string[] = [];

  for (const item of data) {
    const remaining = existing.filter((e) => !matchedExistingIds.has(e.id));
    const matched = matchExisting(item, remaining);
    const newCategory = classifyCategory(item);
    const newContent = buildContent(item);
    const newTitle = buildTitle(item);
    const newUrl = buildExternalUrl(item);
    const aiClassification = JSON.stringify({
      category: newCategory,
      conuniId: item.id,
      vigencia: vigenciaLabel(item.vigencia),
      natureza: item.natureza,
      aprovacao: item.aprovacao,
      orgao: item.orgao,
      revogadoPor: item.manifestacao_revogadora || null,
      source: 'conuni-sync',
      syncedAt: startedAt.toISOString(),
    });

    if (vigenciaLabel(item.vigencia) !== 'vigente') {
      const v = vigenciaLabel(item.vigencia);
      vigenciaCounts[v] = (vigenciaCounts[v] || 0) + 1;
    }

    try {
      if (matched) {
        matchedExistingIds.add(matched.id);
        const contentChanged = matched.content !== newContent;
        const oldCat = matched.category;
        if (oldCat !== newCategory) {
          const transition = `${oldCat}→${newCategory}`;
          reclassifications[transition] = (reclassifications[transition] || 0) + 1;
        }
        // Skip se nada mudou (categoria, content, url, title)
        if (
          oldCat === newCategory &&
          matched.content === newContent &&
          matched.url === newUrl &&
          matched.title === newTitle &&
          matched.aiClassification === aiClassification
        ) {
          skipped++;
          continue;
        }
        await prisma.document.update({
          where: { id: matched.id },
          data: {
            title: newTitle,
            description: (item.ementa || '').slice(0, 500),
            type: 'link',
            url: newUrl,
            category: newCategory,
            tags: JSON.stringify([item.orgao]),
            content: newContent,
            aiClassification,
            ...(contentChanged ? { embeddingStatus: 'pending' } : {}),
          },
        });
        updated++;
      } else {
        await prisma.document.create({
          data: {
            title: newTitle,
            description: (item.ementa || '').slice(0, 500),
            type: 'link',
            url: newUrl,
            category: newCategory,
            isPublic: true,
            tags: JSON.stringify([item.orgao]),
            content: newContent,
            aiClassification,
            embeddingStatus: 'pending',
          },
        });
        inserted++;
      }
    } catch (e) {
      errors++;
      if (errorSamples.length < 5) {
        errorSamples.push(`${item.manifestacao}: ${(e as Error).message}`);
      }
    }
  }

  const orphans = existing.filter((e) => !matchedExistingIds.has(e.id)).length;
  const finishedAt = new Date();

  return {
    itemsTotal: data.length,
    existingTotal: existing.length,
    inserted,
    updated,
    skipped,
    reclassifications,
    vigenciaCounts,
    orphans,
    errors,
    errorSamples,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    elapsedSeconds: Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000),
  };
}

/**
 * Lê metadados do último sync. Usado pelo endpoint /api/conuni-health pra
 * monitoramento remoto (sem expor PII nem secrets).
 */
export async function getLastSyncInfo(prisma: PrismaClient): Promise<{
  lastSyncedAt: string | null;
  totalDocs: number;
  byCategory: Record<string, number>;
  vigenciaCounts: Record<string, number>;
}> {
  const cats = ['parecer', 'parecer-vinculante', 'decor', 'nota-tecnica', 'despacho'];
  const docs = await prisma.document.findMany({
    where: { category: { in: cats } },
    select: { category: true, aiClassification: true },
  });

  const byCategory: Record<string, number> = {};
  const vigenciaCounts: Record<string, number> = {};
  let lastSyncedAt: string | null = null;

  for (const d of docs) {
    byCategory[d.category] = (byCategory[d.category] || 0) + 1;
    if (!d.aiClassification) continue;
    try {
      const parsed = JSON.parse(d.aiClassification) as { syncedAt?: string; vigencia?: string; source?: string };
      if (parsed.source === 'conuni-sync' && parsed.syncedAt) {
        if (!lastSyncedAt || parsed.syncedAt > lastSyncedAt) lastSyncedAt = parsed.syncedAt;
      }
      if (parsed.vigencia && parsed.vigencia !== 'vigente') {
        vigenciaCounts[parsed.vigencia] = (vigenciaCounts[parsed.vigencia] || 0) + 1;
      }
    } catch {
      // ignore
    }
  }

  return { lastSyncedAt, totalDocs: docs.length, byCategory, vigenciaCounts };
}
