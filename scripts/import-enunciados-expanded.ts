/**
 * Importação de Enunciados expandidos: IBDA, INCP, CJF, FONACON, PGE-SP, AGE-MG
 *
 * Lê planilha Excel com 6 abas e insere diretamente no banco via Prisma.
 * Suporta classificação IA via classifyWithClaude (opcional).
 *
 * Uso:
 *   cd sitedobarral
 *   export $(grep DATABASE_URL .env.local | xargs)
 *   npx tsx scripts/import-enunciados-expanded.ts [--dry-run] [--entity=IBDA] [--skip-ai] [--limit=10]
 */

import * as xlsx from 'xlsx';
import * as fs from 'fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Constantes ──────────────────────────────────────────────────────────────

const EXCEL_PATH = '/Users/danba/Downloads/Enunciados IBDA, INCP, CJF, FONACON, PGE-SP, AGE-MG - controle Natally Vasconcelos (1).xlsx';

const VALID_ENTITIES = ['IBDA', 'INCP', 'CJF', 'FONACON', 'PGE-SP', 'AGE-MG'] as const;
type EntityType = typeof VALID_ENTITIES[number];

// Mapeamento slug → ID numérico dos cursos
const SLUG_TO_ID: Record<string, string> = {
  'planejamento-contratacoes': '2',
  'gestao-fiscalizacao-contratos': '3',
  'processo-sancionador': '4',
  'assessoramento-juridico': '7',
  'revisao-reajuste-repactuacao': '8',
  'alteracoes-contratuais': '9',
  'contratacao-direta': '10',
};

// Keywords → slug do curso (classificação local por keywords)
const CURSO_MAPPING: Record<string, string> = {
  'licitacao|licitacoes|pregao|edital|modalidade|registro de precos': 'planejamento-contratacoes',
  'planejamento|etp|estudo tecnico|termo de referencia|projeto basico|analise de riscos|pca': 'planejamento-contratacoes',
  'gestao contratual|fiscalizacao|acompanhamento|medicao|recebimento|gestor|fiscal': 'gestao-fiscalizacao-contratos',
  'sancao|penalidade|multa|advertencia|impedimento|suspensao|declaracao de inidoneidade|sancionador': 'processo-sancionador',
  'parecer juridico|assessoria juridica|procuradoria|agu|consultivo|assessoramento': 'assessoramento-juridico',
  'reajuste|repactuacao|revisao|reequilibrio economico|alea': 'revisao-reajuste-repactuacao',
  'aditivo|acrescimo|supressao|prorrogacao|alteracao contratual': 'alteracoes-contratuais',
  'dispensa|inexigibilidade|contratacao direta|emergencia|notoria especializacao': 'contratacao-direta',
};

// Mapeamento de fases para keywords de tags
const FASE_TAGS: Record<string, string[]> = {
  'planejamento': ['planejamento', 'fase interna'],
  'seleção do fornecedor': ['seleção', 'fase externa'],
  'selecao do fornecedor': ['seleção', 'fase externa'],
  'gestão contratual': ['gestão contratual', 'execução'],
  'gestao contratual': ['gestão contratual', 'execução'],
  'contratação direta': ['contratação direta', 'dispensa', 'inexigibilidade'],
  'contratacao direta': ['contratação direta', 'dispensa', 'inexigibilidade'],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Normaliza texto removendo acentos para comparação */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/** Identifica o primeiro curso relevante baseado em keywords */
function identificarCursoLocal(textoEnunciado: string, fase: string): { courseId: string | null; courseSlugs: string[] } {
  const textoCompleto = normalizar(`${textoEnunciado} ${fase}`);
  const slugs: string[] = [];

  for (const [keywords, slug] of Object.entries(CURSO_MAPPING)) {
    const patterns = keywords.split('|');
    for (const pattern of patterns) {
      if (textoCompleto.includes(pattern)) {
        if (!slugs.includes(slug)) slugs.push(slug);
        break;
      }
    }
  }

  // Fallback: se nenhum match, usar planejamento como default
  if (slugs.length === 0) {
    slugs.push('planejamento-contratacoes');
  }

  return {
    courseId: SLUG_TO_ID[slugs[0]] || null,
    courseSlugs: slugs,
  };
}

/** Gera tags baseadas em keywords locais */
function gerarTagsLocal(entityType: string, fase: string, textoEnunciado: string): string[] {
  const tags = new Set<string>();

  // Sempre adicionar entidade
  tags.add(entityType);
  tags.add('Enunciado');

  // Fase como tag
  if (fase) {
    tags.add(fase.trim());
    // Tags extras baseadas na fase
    const faseNorm = normalizar(fase);
    for (const [key, extraTags] of Object.entries(FASE_TAGS)) {
      if (faseNorm.includes(key)) {
        extraTags.forEach(t => tags.add(t));
      }
    }
  }

  // Keywords do texto
  const textoNorm = normalizar(textoEnunciado);
  const keywordsToDetect = [
    'lei 14.133', 'lei 8.666', 'pregão', 'dispensa', 'inexigibilidade',
    'contrato', 'licitação', 'fiscal', 'gestor', 'sanção', 'penalidade',
    'reajuste', 'aditivo', 'edital', 'termo de referência',
  ];
  for (const kw of keywordsToDetect) {
    if (textoNorm.includes(normalizar(kw))) {
      tags.add(kw.charAt(0).toUpperCase() + kw.slice(1));
    }
  }

  return Array.from(tags).slice(0, 15);
}

/** Extrai artigos da Lei 14.133/2021 mencionados no texto */
function extrairArtigosLei(texto: string): number[] {
  const artigos = new Set<number>();

  // Padrões: "art. 75", "artigo 75", "arts. 72 a 75", "Art. 124"
  const matches = texto.matchAll(/art(?:igo|s?)\.\s*(\d+)/gi);
  for (const match of matches) {
    const num = parseInt(match[1], 10);
    if (num > 0 && num <= 194) {
      artigos.add(num);
    }
  }

  return Array.from(artigos).sort((a, b) => a - b);
}

/** Tenta importar e usar classifyWithClaude */
async function tentarClassificacaoIA(
  titulo: string,
  descricao: string,
): Promise<{
  courseSlugs: string[];
  tags: string[];
  leiArticles: number[];
} | null> {
  try {
    const { classifyWithClaude } = await import('../lib/claude-classifier');
    const result = await classifyWithClaude(titulo, descricao);
    if (result) {
      return {
        courseSlugs: result.courseSlugs,
        tags: result.tags,
        leiArticles: result.suggestedArticles,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** Parse de argumentos CLI */
function parseArgs(): {
  dryRun: boolean;
  entity: EntityType | null;
  skipAi: boolean;
  limit: number | null;
} {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const skipAi = args.includes('--skip-ai');

  let entity: EntityType | null = null;
  const entityArg = args.find(a => a.startsWith('--entity='));
  if (entityArg) {
    const val = entityArg.split('=')[1].toUpperCase();
    if (VALID_ENTITIES.includes(val as EntityType)) {
      entity = val as EntityType;
    } else {
      console.error(`Entidade invalida: ${val}. Validas: ${VALID_ENTITIES.join(', ')}`);
      process.exit(1);
    }
  }

  let limit: number | null = null;
  const limitArg = args.find(a => a.startsWith('--limit='));
  if (limitArg) {
    limit = parseInt(limitArg.split('=')[1], 10);
    if (isNaN(limit) || limit <= 0) {
      console.error('--limit deve ser um numero positivo');
      process.exit(1);
    }
  }

  return { dryRun, entity, skipAi, limit };
}

/** Delay helper */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Processamento por Aba ───────────────────────────────────────────────────

interface EnunciadoRow {
  entityType: EntityType;
  numero: string;
  texto: string;
  fase: string;
}

/** Extrai rows de uma aba do Excel */
function extrairRowsDaAba(
  workbook: xlsx.WorkBook,
  sheetName: string,
): EnunciadoRow[] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    console.warn(`  Aba "${sheetName}" nao encontrada. Pulando.`);
    return [];
  }

  const rawRows = xlsx.utils.sheet_to_json(sheet) as Record<string, unknown>[];
  if (rawRows.length === 0) return [];

  // Determinar entityType a partir do nome da aba
  const entityType = sheetName.trim().toUpperCase() as EntityType;
  const isPgeSp = entityType === 'PGE-SP';

  const rows: EnunciadoRow[] = [];
  let seqNumber = 0;

  for (const raw of rawRows) {
    // Normalizar chaves
    const norm: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw)) {
      const normKey = key.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      norm[normKey] = value !== undefined && value !== null ? String(value).trim() : '';
    }

    let texto: string;
    let numero: string;
    const fase = norm['fase correspondente'] || '';

    if (isPgeSp) {
      // PGE-SP: coluna "Orientação" em vez de "Enunciado", sem numero
      texto = norm['orientacao'] || norm['orientação'] || '';
      if (!texto) {
        // Tentar achar qualquer coluna que tenha conteudo relevante
        for (const [key, val] of Object.entries(norm)) {
          if (key !== 'fase correspondente' && val && val.length > 20) {
            texto = val;
            break;
          }
        }
      }
      seqNumber++;
      numero = String(seqNumber);
    } else {
      // Demais abas: colunas "Nº do enunciado" e "Enunciado"
      texto = norm['enunciado'] || '';
      const numRaw = norm['n do enunciado'] || norm['no do enunciado'] || norm['numero do enunciado'] || norm['n° do enunciado'] || '';
      numero = numRaw ? String(numRaw).replace(/[^\d]/g, '') || String(numRaw) : '';
    }

    // Pular linhas vazias
    if (!texto) continue;

    rows.push({
      entityType,
      numero,
      texto,
      fase,
    });
  }

  return rows;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const { dryRun, entity, skipAi, limit } = parseArgs();

  console.log('=== Importacao de Enunciados Expandidos ===');
  console.log(`Arquivo: ${EXCEL_PATH}`);
  if (dryRun) console.log('[DRY RUN] Nenhum dado sera inserido no banco.');
  if (entity) console.log(`Filtrando por entidade: ${entity}`);
  if (skipAi) console.log('Classificacao IA desabilitada.');
  if (limit) console.log(`Limite: ${limit} enunciados por aba.`);
  console.log('');

  // Verificar arquivo
  if (!fs.existsSync(EXCEL_PATH)) {
    console.error(`Arquivo nao encontrado: ${EXCEL_PATH}`);
    process.exit(1);
  }

  // Ler workbook
  const workbook = xlsx.readFile(EXCEL_PATH);
  console.log(`Abas encontradas: ${workbook.SheetNames.join(', ')}\n`);

  // Determinar quais abas processar
  const abasParaProcessar = entity
    ? [entity]
    : workbook.SheetNames.filter(name => {
        const upper = name.trim().toUpperCase();
        return VALID_ENTITIES.includes(upper as EntityType);
      });

  if (abasParaProcessar.length === 0) {
    console.error('Nenhuma aba valida encontrada!');
    process.exit(1);
  }

  // Buscar primeiro curso ID como fallback
  const primeiroCurso = await prisma.document.findFirst({
    where: { category: 'enunciados' },
    select: { courseId: true },
  });
  const fallbackCourseId = primeiroCurso?.courseId || '2'; // Planejamento como fallback

  // Contadores globais
  const summary: Record<string, { total: number; inseridos: number; duplicados: number; erros: number }> = {};
  let totalInseridos = 0;
  let totalDuplicados = 0;
  let totalErros = 0;

  // Testar disponibilidade da IA
  let iaDisponivel = false;
  if (!skipAi) {
    try {
      const { isClaudeAvailable } = await import('../lib/claude-classifier');
      iaDisponivel = isClaudeAvailable();
      console.log(iaDisponivel ? 'Claude AI disponivel para classificacao.' : 'Claude AI indisponivel (sem API key). Usando classificacao local.');
    } catch {
      console.log('Modulo claude-classifier nao encontrado. Usando classificacao local.');
    }
  }
  console.log('');

  // Processar cada aba
  for (const aba of abasParaProcessar) {
    console.log(`--- Processando aba: ${aba} ---`);

    let rows = extrairRowsDaAba(workbook, aba);
    console.log(`  ${rows.length} enunciados encontrados.`);

    if (rows.length === 0) {
      summary[aba] = { total: 0, inseridos: 0, duplicados: 0, erros: 0 };
      continue;
    }

    // Aplicar limit
    if (limit && rows.length > limit) {
      rows = rows.slice(0, limit);
      console.log(`  Limitado a ${limit} enunciados.`);
    }

    let inseridos = 0;
    let duplicados = 0;
    let erros = 0;

    // Processar em batches de 10
    const BATCH_SIZE = 10;

    for (let batchStart = 0; batchStart < rows.length; batchStart += BATCH_SIZE) {
      const batch = rows.slice(batchStart, batchStart + BATCH_SIZE);

      for (const row of batch) {
        try {
          // Deduplicar: buscar enunciado existente
          const existente = await prisma.document.findFirst({
            where: {
              category: 'enunciados',
              entityType: row.entityType,
              enunciadoNumber: String(row.numero),
            },
          });

          if (existente) {
            duplicados++;
            continue;
          }

          // Titulo
          const isPgeSp = row.entityType === 'PGE-SP';
          const titulo = isPgeSp
            ? `Orientacao PGE-SP n ${row.numero}`
            : `Enunciado ${row.entityType} n ${row.numero}`;

          // Classificacao
          let courseId: string | null = fallbackCourseId;
          let tags: string[];
          let leiArticles: number[];

          if (iaDisponivel && !skipAi) {
            // Classificacao IA
            const textoParaIA = `${row.texto}\n\nFase: ${row.fase}`;
            const iaResult = await tentarClassificacaoIA(titulo, textoParaIA);

            if (iaResult && iaResult.courseSlugs.length > 0) {
              courseId = SLUG_TO_ID[iaResult.courseSlugs[0]] || fallbackCourseId;
              tags = [...new Set([row.entityType, ...iaResult.tags])].slice(0, 15);
              leiArticles = iaResult.leiArticles;
            } else {
              // Fallback local
              const local = identificarCursoLocal(row.texto, row.fase);
              courseId = local.courseId || fallbackCourseId;
              tags = gerarTagsLocal(row.entityType, row.fase, row.texto);
              leiArticles = extrairArtigosLei(row.texto);
            }
          } else {
            // Classificacao local
            const local = identificarCursoLocal(row.texto, row.fase);
            courseId = local.courseId || fallbackCourseId;
            tags = gerarTagsLocal(row.entityType, row.fase, row.texto);
            leiArticles = extrairArtigosLei(row.texto);
          }

          // Montar conteudo
          const content = row.fase
            ? `${row.texto}\n\nFase: ${row.fase}`
            : row.texto;

          // Montar dados para inserir
          const docData = {
            title: titulo,
            description: row.texto,
            content,
            type: 'link' as const,
            url: '',
            category: 'enunciados',
            entityType: row.entityType,
            enunciadoNumber: String(row.numero),
            isPublic: true,
            isCommon: true,
            tags: JSON.stringify(tags),
            leiArticles: leiArticles.length > 0 ? JSON.stringify(leiArticles) : null,
            courseId,
          };

          if (dryRun) {
            if (inseridos < 2) {
              console.log(`  [AMOSTRA] ${titulo}`);
              console.log(`    Texto: ${row.texto.substring(0, 100)}...`);
              console.log(`    Fase: ${row.fase}`);
              console.log(`    Curso: ${courseId} | Tags: ${tags.slice(0, 5).join(', ')}`);
              console.log(`    Lei Articles: ${leiArticles.join(', ') || 'nenhum'}`);
            }
            inseridos++;
          } else {
            await prisma.document.create({ data: docData });
            inseridos++;
          }
        } catch (err) {
          erros++;
          console.error(`  Erro: ${err instanceof Error ? err.message : err}`);
        }
      }

      // Rate limiting entre batches (para IA)
      if (iaDisponivel && !skipAi && batchStart + BATCH_SIZE < rows.length) {
        await delay(1000);
      }

      // Progresso
      const progresso = Math.min(batchStart + BATCH_SIZE, rows.length);
      process.stdout.write(`\r  Progresso: ${progresso}/${rows.length} (${inseridos} inseridos, ${duplicados} duplicados, ${erros} erros)`);
    }

    console.log(''); // Nova linha apos progresso

    summary[aba] = { total: rows.length, inseridos, duplicados, erros };
    totalInseridos += inseridos;
    totalDuplicados += duplicados;
    totalErros += erros;
  }

  // Resumo final
  console.log('\n=== RESUMO FINAL ===');
  console.log('');

  const headerLine = 'Entidade'.padEnd(12) + 'Total'.padStart(8) + 'Inseridos'.padStart(12) + 'Duplicados'.padStart(13) + 'Erros'.padStart(8);
  console.log(headerLine);
  console.log('-'.repeat(headerLine.length));

  for (const [aba, stats] of Object.entries(summary)) {
    console.log(
      aba.padEnd(12) +
      String(stats.total).padStart(8) +
      String(stats.inseridos).padStart(12) +
      String(stats.duplicados).padStart(13) +
      String(stats.erros).padStart(8)
    );
  }

  console.log('-'.repeat(headerLine.length));
  console.log(
    'TOTAL'.padEnd(12) +
    String(Object.values(summary).reduce((s, v) => s + v.total, 0)).padStart(8) +
    String(totalInseridos).padStart(12) +
    String(totalDuplicados).padStart(13) +
    String(totalErros).padStart(8)
  );

  if (dryRun) {
    console.log('\n[DRY RUN] Nenhum dado foi inserido no banco.');
  } else {
    // Contar total de enunciados no banco
    const totalBanco = await prisma.document.count({ where: { category: 'enunciados' } });
    console.log(`\nTotal de enunciados no banco: ${totalBanco}`);
  }
}

main()
  .catch((err) => {
    console.error('Erro fatal:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
