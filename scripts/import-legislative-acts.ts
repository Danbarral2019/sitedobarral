/**
 * Script de Importação - Atos Normativos (LegislativeAct)
 *
 * Importa decretos, portarias, INs, leis e outros atos normativos
 * de um arquivo JSON estruturado.
 *
 * Uso:
 *   npx tsx scripts/import-legislative-acts.ts [arquivo.json] [--dry-run] [--update]
 *
 * Opções:
 *   --dry-run    Apenas valida sem inserir no banco
 *   --update     Atualiza registros existentes (por fullNumber)
 *
 * Exemplo:
 *   npx tsx scripts/import-legislative-acts.ts atos-normativos.json
 *   npx tsx scripts/import-legislative-acts.ts atos-normativos.json --dry-run
 *   npx tsx scripts/import-legislative-acts.ts atos-normativos.json --update
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Carregar variáveis de ambiente
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

import { prisma } from '../lib/prisma';
import { CacheInvalidation } from '../lib/cache/redis-client';
import * as fs from 'fs/promises';

// ============================================================================
// TIPOS
// ============================================================================

type ActType = 'decreto' | 'portaria' | 'in' | 'ordem-servico' | 'lei' | 'medida-provisoria' | 'resolucao' | 'instrucao';
type Issuer = 'Presidência' | 'MGI' | 'SEGES' | 'AGU' | 'TCU' | 'Congresso' | 'CGU' | 'MPOG' | 'Casa Civil' | string;
type Status = 'vigente' | 'revogada' | 'parcialmente-revogada';

interface LegislativeActImport {
  // Identificação (obrigatórios)
  type: ActType;
  number: string;
  year: number;
  fullNumber?: string; // Se não fornecido, será gerado automaticamente

  // Conteúdo (obrigatórios)
  title: string;
  ementa: string;

  // Conteúdo (opcionais)
  summary?: string;
  content?: string;

  // Metadados (obrigatórios)
  issuer: Issuer;
  publishDate: string; // formato: "YYYY-MM-DD"
  hierarchyLevel: number; // 1-5

  // Metadados (opcionais)
  effectiveDate?: string;
  leiArticles?: string[];
  officialUrl?: string;
  pdfUrl?: string;

  // Status e notas (opcionais)
  status?: Status;
  revokedBy?: string;
  practicalNotes?: string;
  relevance?: 'alta' | 'media' | 'baixa';
}

interface ImportFile {
  legislativeActs: LegislativeActImport[];
  metadata?: {
    source?: string;
    createdAt?: string;
    version?: string;
  };
}

interface ImportResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  errorDetails: Array<{ fullNumber: string; error: string }>;
}

// ============================================================================
// VALIDAÇÃO
// ============================================================================

const VALID_TYPES: ActType[] = ['decreto', 'portaria', 'in', 'ordem-servico', 'lei', 'medida-provisoria', 'resolucao', 'instrucao'];

function validateAct(act: LegislativeActImport, index: number): string[] {
  const errors: string[] = [];
  const prefix = `[Item ${index + 1}]`;

  // Campos obrigatórios
  if (!act.type) errors.push(`${prefix} Campo 'type' é obrigatório`);
  if (!act.number) errors.push(`${prefix} Campo 'number' é obrigatório`);
  if (!act.year) errors.push(`${prefix} Campo 'year' é obrigatório`);
  if (!act.title) errors.push(`${prefix} Campo 'title' é obrigatório`);
  if (!act.ementa) errors.push(`${prefix} Campo 'ementa' é obrigatório`);
  if (!act.issuer) errors.push(`${prefix} Campo 'issuer' é obrigatório`);
  if (!act.publishDate) errors.push(`${prefix} Campo 'publishDate' é obrigatório`);
  if (act.hierarchyLevel === undefined) errors.push(`${prefix} Campo 'hierarchyLevel' é obrigatório`);

  // Validações de tipo
  if (act.type && !VALID_TYPES.includes(act.type)) {
    errors.push(`${prefix} Tipo '${act.type}' inválido. Válidos: ${VALID_TYPES.join(', ')}`);
  }

  // Validação de ano
  if (act.year && (act.year < 1900 || act.year > 2100)) {
    errors.push(`${prefix} Ano '${act.year}' inválido`);
  }

  // Validação de data
  if (act.publishDate && isNaN(Date.parse(act.publishDate))) {
    errors.push(`${prefix} Data '${act.publishDate}' inválida. Use formato YYYY-MM-DD`);
  }

  // Validação de hierarchyLevel
  if (act.hierarchyLevel !== undefined && (act.hierarchyLevel < 1 || act.hierarchyLevel > 5)) {
    errors.push(`${prefix} hierarchyLevel '${act.hierarchyLevel}' inválido. Use 1-5`);
  }

  return errors;
}

// ============================================================================
// GERAÇÃO DE fullNumber
// ============================================================================

function generateFullNumber(act: LegislativeActImport): string {
  if (act.fullNumber) return act.fullNumber;

  const typeLabels: Record<ActType, string> = {
    'decreto': 'Decreto',
    'portaria': 'Portaria',
    'in': 'IN',
    'ordem-servico': 'OS',
    'lei': 'Lei',
    'medida-provisoria': 'MP',
    'resolucao': 'Resolução',
    'instrucao': 'Instrução',
  };

  const label = typeLabels[act.type] || act.type;
  const issuerPrefix = act.issuer !== 'Presidência' && act.issuer !== 'Congresso'
    ? ` ${act.issuer}`
    : '';

  return `${label}${issuerPrefix} ${act.number}/${act.year}`;
}

// ============================================================================
// IMPORTAÇÃO
// ============================================================================

async function importActs(
  acts: LegislativeActImport[],
  options: { dryRun: boolean; update: boolean }
): Promise<ImportResult> {
  const result: ImportResult = {
    total: acts.length,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    errorDetails: [],
  };

  for (let i = 0; i < acts.length; i++) {
    const act = acts[i];
    const fullNumber = generateFullNumber(act);

    try {
      // Verificar se já existe
      const existing = await prisma.legislativeAct.findUnique({
        where: { fullNumber },
      });

      if (existing && !options.update) {
        console.log(`  ⏭️  Pulando (já existe): ${fullNumber}`);
        result.skipped++;
        continue;
      }

      // Preparar dados
      const data = {
        type: act.type,
        number: act.number,
        year: act.year,
        fullNumber,
        title: act.title,
        ementa: act.ementa,
        summary: act.summary || null,
        content: act.content || null,
        issuer: act.issuer,
        publishDate: new Date(act.publishDate),
        effectiveDate: act.effectiveDate ? new Date(act.effectiveDate) : null,
        hierarchyLevel: act.hierarchyLevel,
        leiArticles: act.leiArticles ? JSON.stringify(act.leiArticles) : null,
        officialUrl: act.officialUrl || null,
        pdfUrl: act.pdfUrl || null,
      };

      if (options.dryRun) {
        console.log(`  ✅ [DRY-RUN] ${existing ? 'Atualizaria' : 'Criaria'}: ${fullNumber}`);
        if (existing) result.updated++;
        else result.created++;
        continue;
      }

      if (existing) {
        // Atualizar
        await prisma.legislativeAct.update({
          where: { fullNumber },
          data,
        });
        console.log(`  🔄 Atualizado: ${fullNumber}`);
        result.updated++;
      } else {
        // Criar
        await prisma.legislativeAct.create({ data });
        console.log(`  ✅ Criado: ${fullNumber}`);
        result.created++;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`  ❌ Erro: ${fullNumber} - ${errorMessage}`);
      result.errors++;
      result.errorDetails.push({ fullNumber, error: errorMessage });
    }
  }

  return result;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('');
  console.log('═'.repeat(80));
  console.log('  IMPORTAÇÃO DE ATOS NORMATIVOS (LegislativeAct)');
  console.log('═'.repeat(80));
  console.log('');

  // Parse argumentos
  const args = process.argv.slice(2);
  const fileName = args.find(a => !a.startsWith('--')) || 'atos-normativos.json';
  const dryRun = args.includes('--dry-run');
  const update = args.includes('--update');

  console.log(`📄 Arquivo: ${fileName}`);
  console.log(`🔧 Modo: ${dryRun ? 'DRY-RUN (apenas validação)' : 'PRODUÇÃO'}`);
  console.log(`🔄 Atualizar existentes: ${update ? 'Sim' : 'Não'}`);
  console.log('');

  // Ler arquivo
  let fileContent: string;
  try {
    fileContent = await fs.readFile(fileName, 'utf-8');
  } catch (error) {
    console.error(`❌ Erro ao ler arquivo: ${fileName}`);
    console.error('   Certifique-se de que o arquivo existe no diretório raiz do projeto.');
    console.log('');
    console.log('💡 Exemplo de uso:');
    console.log('   npx tsx scripts/import-legislative-acts.ts atos-normativos.json');
    console.log('   npx tsx scripts/import-legislative-acts.ts atos-normativos.json --dry-run');
    process.exit(1);
  }

  // Parse JSON
  let data: ImportFile;
  try {
    data = JSON.parse(fileContent);
  } catch (error) {
    console.error('❌ Erro ao parsear JSON. Verifique a sintaxe do arquivo.');
    process.exit(1);
  }

  if (!data.legislativeActs || !Array.isArray(data.legislativeActs)) {
    console.error('❌ Arquivo inválido. Esperado: { "legislativeActs": [...] }');
    process.exit(1);
  }

  const acts = data.legislativeActs;
  console.log(`📊 Total de atos no arquivo: ${acts.length}`);

  if (data.metadata) {
    console.log(`   Fonte: ${data.metadata.source || 'não especificada'}`);
    console.log(`   Versão: ${data.metadata.version || 'não especificada'}`);
  }
  console.log('');

  // Validar todos
  console.log('─'.repeat(80));
  console.log('VALIDAÇÃO');
  console.log('─'.repeat(80));

  const allErrors: string[] = [];
  for (let i = 0; i < acts.length; i++) {
    const errors = validateAct(acts[i], i);
    allErrors.push(...errors);
  }

  if (allErrors.length > 0) {
    console.log('');
    console.log('❌ ERROS DE VALIDAÇÃO:');
    allErrors.forEach(e => console.log(`   ${e}`));
    console.log('');
    console.log('Corrija os erros acima antes de importar.');
    process.exit(1);
  }

  console.log('✅ Todos os registros validados com sucesso!');
  console.log('');

  // Importar
  console.log('─'.repeat(80));
  console.log('IMPORTAÇÃO');
  console.log('─'.repeat(80));
  console.log('');

  const startTime = Date.now();
  const result = await importActs(acts, { dryRun, update });
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  // Relatório final
  console.log('');
  console.log('─'.repeat(80));
  console.log('RELATÓRIO FINAL');
  console.log('─'.repeat(80));
  console.log('');
  console.log(`  📊 Total processado: ${result.total}`);
  console.log(`  ✅ Criados:          ${result.created}`);
  console.log(`  🔄 Atualizados:      ${result.updated}`);
  console.log(`  ⏭️  Pulados:          ${result.skipped}`);
  console.log(`  ❌ Erros:            ${result.errors}`);
  console.log(`  ⏱️  Tempo:            ${duration}s`);
  console.log('');

  if (result.errorDetails.length > 0) {
    console.log('Detalhes dos erros:');
    result.errorDetails.forEach(({ fullNumber, error }) => {
      console.log(`  - ${fullNumber}: ${error}`);
    });
    console.log('');
  }

  if (dryRun) {
    console.log('💡 Este foi um DRY-RUN. Nenhum dado foi alterado.');
    console.log('   Para executar de verdade, remova a flag --dry-run');
  } else if (result.created > 0 || result.updated > 0) {
    // Invalidar cache Redis para que contadores reflitam novos dados
    try {
      const invalidated = await CacheInvalidation.legislativeActs();
      console.log(`🗑️  Cache Redis invalidado (${invalidated} chaves removidas)`);
    } catch {
      console.log('⚠️  Cache Redis não disponível (contadores atualizarão em até 2h)');
    }
  }

  console.log('═'.repeat(80));
  console.log('');

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('Erro fatal:', error);
  await prisma.$disconnect();
  process.exit(1);
});
