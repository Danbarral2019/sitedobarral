#!/usr/bin/env npx tsx
/**
 * Limpeza de Boas Práticas — Remover Atos Concretos
 *
 * Remove documentos da categoria 'boa_pratica' que são atos administrativos
 * concretos (designações, pensões, nomeações, etc.) e NÃO atos normativos gerais.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/cleanup-boas-praticas.ts --dry-run
 *   npx dotenv -e .env.local -- npx tsx scripts/cleanup-boas-praticas.ts --execute
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const execute = args.includes('--execute');

if (!dryRun && !execute) {
  console.log('Uso: npx tsx scripts/cleanup-boas-praticas.ts --dry-run|--execute');
  process.exit(1);
}

// --- Fase 1A: Tipos de título sempre concretos ---
const CONCRETE_TITLE_PREFIXES = [
  /^despacho\b/i,
  /^ata\s+n[ºo°]/i,
  /^autoriza[çc][ãa]o\b/i,
  /^portarias\s+de\s+\d/i,
  /^ato\s+declarat[óo]rio/i,
  /^alvar[áa]\b/i,
  /^adendo\b/i,
  /^aditamento\b/i,
  /^decis[ãa]o\s+de\b/i,
];

// --- Fase 1B: Padrões concretos no conteúdo do título ---
const CONCRETE_CONTENT_PATTERNS = [
  // Pessoal
  'conceder pensão', 'conceder aposentadoria', 'pensão civil',
  'aposentar', 'nomear', 'exonerar',
  'dispensar a pedido', 'substituir',
  'conceder abono', 'conceder licença',
  'autorizar o afastamento', 'licença para tratar',
  // Identificadores individuais
  'matrícula siape', 'matricula siape',
  'processo nº', 'processo n°',
  'uasg', 'cpf', 'cnpj',
  // Cargos/funções específicas
  'fiscal de contrato', 'gestor de contrato', 'pregoeiro',
];

// Regex para "designar Fulano de Tal" (nome próprio após designar)
const DESIGNAR_NOME_REGEX = /designar\s+[A-ZÀ-Ú][a-zà-ú]+\s+[A-ZÀ-Ú]/;

// --- Fase 1C: Indicadores de ato normativo geral (manter) ---
const GENERAL_INDICATORS = [
  // Regulatório
  'regulamenta', 'dispõe sobre', 'dispoe sobre', 'disciplina',
  'estabelece', 'institui', 'define critérios', 'normas gerais',
  'procedimentos', 'diretrizes',
  // Procurement
  'licitação', 'licitações', 'contratação', 'contratações',
  'pregão', 'dispensa de licitação', 'inexigibilidade',
  'registro de preços', 'sanção', 'sanções',
  'processo sancionador', 'fase preparatória',
  'planejamento da contratação', 'compras públicas',
  'gestão de contratos', 'fiscalização de contratos',
];

// Tipos inerentemente normativos (manter sempre)
const NORMATIVE_TYPE_PREFIXES = [
  /^instru[çc][ãa]o\s+normativa\b/i,
  /^resolu[çc][ãa]o\s+normativa\b/i,
  /^orienta[çc][ãa]o\s+normativa\b/i,
];

// --- Filtro obrigatório: keywords de licitações/contratações ---
// Todo documento precisa ter pelo menos uma dessas keywords no título para ficar
const PROCUREMENT_TITLE_KEYWORDS = [
  'licitação', 'licitações', 'licitar', 'licitatório', 'licitatória',
  'contratação', 'contratações', 'contratar',
  'pregão', 'pregões', 'pregão eletrônico',
  'dispensa de licitação', 'inexigibilidade',
  'registro de preços', 'ata de registro',
  'lei 14.133', 'lei nº 14.133', 'lei 14133', '14.133/2021',
  'sanção administrativa', 'processo sancionador', 'sanções administrativas',
  'planejamento da contratação', 'fase preparatória',
  'gestão de contratos', 'fiscalização de contratos',
  'compras públicas', 'compras governamentais',
  'gestão e inovação em serviços públicos', // MGI — órgão central de compras
  'seges', // Secretaria de Gestão
];

function isProcurementRelevant(title: string): boolean {
  const titleLower = title.toLowerCase();
  return PROCUREMENT_TITLE_KEYWORDS.some(k => titleLower.includes(k));
}

type CleanupAction = 'remove' | 'keep';
type CleanupReason =
  | 'concrete_title_prefix'
  | 'concrete_content_pattern'
  | 'designar_nome_proprio'
  | 'ambiguous_no_indicators'
  | 'not_procurement_related'
  | 'procurement_relevant'
  | 'general_indicators';

interface CleanupResult {
  id: string;
  title: string;
  action: CleanupAction;
  reason: CleanupReason;
}

function classifyDocument(title: string, issuerOrg: string | null): { action: CleanupAction; reason: CleanupReason } {
  const titleLower = title.toLowerCase().trim();
  const titleClean = title.replace(/<[^>]*>/g, '').trim();

  // 1. Título com prefixo concreto → REMOVER (sempre)
  if (CONCRETE_TITLE_PREFIXES.some(p => p.test(titleClean))) {
    return { action: 'remove', reason: 'concrete_title_prefix' };
  }

  // 2. Padrões concretos no título → REMOVER
  if (CONCRETE_CONTENT_PATTERNS.some(p => titleLower.includes(p))) {
    return { action: 'remove', reason: 'concrete_content_pattern' };
  }

  // 3. "designar" seguido de nome próprio → REMOVER
  if (DESIGNAR_NOME_REGEX.test(title)) {
    return { action: 'remove', reason: 'designar_nome_proprio' };
  }

  // 4. FILTRO OBRIGATÓRIO: relevância para licitações/contratações
  //    INs do BCB sobre Pix, RNs da ANS sobre saúde, portarias da SPU sobre
  //    patrimônio — nenhuma regulamenta a Lei 14.133
  if (!isProcurementRelevant(title)) {
    return { action: 'remove', reason: 'not_procurement_related' };
  }

  // 5. Passou no filtro de relevância → MANTER
  return { action: 'keep', reason: 'procurement_relevant' };
}

async function main() {
  console.log('=== Limpeza de Boas Práticas ===');
  console.log(`Modo: ${dryRun ? 'DRY-RUN (apenas relatório)' : 'EXECUTE (remover documentos)'}`);
  console.log('');

  // Buscar todas as boas práticas
  const boasPraticas = await prisma.document.findMany({
    where: { category: 'boa_pratica' },
    select: { id: true, title: true, issuerOrg: true },
    orderBy: { title: 'asc' },
  });

  console.log(`Total de boas práticas: ${boasPraticas.length}`);
  console.log('');

  const results: CleanupResult[] = [];

  for (const doc of boasPraticas) {
    const { action, reason } = classifyDocument(doc.title, doc.issuerOrg);
    results.push({ id: doc.id, title: doc.title, action, reason });
  }

  // --- Contagens ---
  const toRemove = results.filter(r => r.action === 'remove');
  const toKeep = results.filter(r => r.action === 'keep');

  console.log('========================================');
  console.log('       RESUMO DA CLASSIFICAÇÃO');
  console.log('========================================');
  console.log(`Total: ${results.length}`);
  console.log(`Remover: ${toRemove.length}`);
  console.log(`Manter: ${toKeep.length}`);
  console.log('');

  // Contagens por razão de remoção
  const removeReasons = new Map<string, number>();
  for (const r of toRemove) {
    removeReasons.set(r.reason, (removeReasons.get(r.reason) || 0) + 1);
  }
  console.log('--- Motivos de remoção ---');
  for (const [reason, count] of [...removeReasons.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${reason}: ${count}`);
  }

  // Contagens por razão de manutenção
  const keepReasons = new Map<string, number>();
  for (const r of toKeep) {
    keepReasons.set(r.reason, (keepReasons.get(r.reason) || 0) + 1);
  }
  console.log('');
  console.log('--- Motivos de manutenção ---');
  for (const [reason, count] of [...keepReasons.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${reason}: ${count}`);
  }

  // Listar os que serão mantidos (para revisão)
  console.log('');
  console.log(`--- Documentos a MANTER (${toKeep.length}) ---`);
  for (const r of toKeep) {
    console.log(`  [${r.reason}] ${r.title.substring(0, 120)}`);
  }

  // Amostra dos que serão removidos
  console.log('');
  console.log(`--- Amostra de documentos a REMOVER (primeiros 30 de ${toRemove.length}) ---`);
  for (const r of toRemove.slice(0, 30)) {
    console.log(`  [${r.reason}] ${r.title.substring(0, 120)}`);
  }

  // Executar remoção
  if (execute && toRemove.length > 0) {
    console.log('');
    console.log('========================================');
    console.log('       EXECUTANDO REMOÇÃO');
    console.log('========================================');

    const idsToRemove = toRemove.map(r => r.id);

    // Remover relações dependentes (em lotes para evitar timeout)
    const BATCH_SIZE = 500;
    for (let i = 0; i < idsToRemove.length; i += BATCH_SIZE) {
      const batch = idsToRemove.slice(i, i + BATCH_SIZE);
      console.log(`Processando lote ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(idsToRemove.length / BATCH_SIZE)}...`);

      // Chunks de embedding (onDelete: Cascade, mas limpar explicitamente)
      await prisma.documentChunk.deleteMany({ where: { documentId: { in: batch } } });

      // Favoritos (onDelete: SetNull)
      await prisma.favorite.deleteMany({ where: { documentId: { in: batch } } });

      // Versões (onDelete: Cascade)
      await prisma.documentVersion.deleteMany({ where: { documentId: { in: batch } } });

      // Análises
      await prisma.documentAnalysis.deleteMany({ where: { documentId: { in: batch } } });

      // Lesson documents (onDelete: Cascade)
      await prisma.lessonDocument.deleteMany({ where: { documentId: { in: batch } } });

      // TCU Highlights (onDelete: Cascade)
      await prisma.tcuHighlight.deleteMany({ where: { documentId: { in: batch } } });

      // Limpar referência no DOUStagingDocument
      await prisma.dOUStagingDocument.updateMany({
        where: { documentId: { in: batch } },
        data: { documentId: null },
      });

      // Remover os documentos do lote
      const deleted = await prisma.document.deleteMany({ where: { id: { in: batch } } });
      console.log(`  Removidos: ${deleted.count} documentos`);
    }

    console.log('');

    // Verificar restantes
    const remaining = await prisma.document.count({
      where: { category: 'boa_pratica' },
    });
    console.log(`Boas práticas restantes: ${remaining}`);
  }

  console.log('\n========================================');
  console.log('Concluído!');

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('Erro fatal:', error);
  await prisma.$disconnect();
  process.exit(1);
});
