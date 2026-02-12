/**
 * Importação em massa de acórdãos TCU a partir de planilha Excel
 *
 * Lê a planilha do TCU (2021–2025) e insere diretamente no banco via Prisma.
 * Cada linha da planilha = 1 documento (tese), mesmo acórdão pode ter múltiplas teses.
 *
 * Uso:
 *   cd sitedobarral
 *   export $(grep DATABASE_URL .env.local | xargs)
 *   npx tsx scripts/import-tcu-excel.ts "/caminho/para/planilha.xls"
 *   npx tsx scripts/import-tcu-excel.ts "/caminho/para/planilha.xls" --dry-run
 */

import * as xlsx from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Mapeamento de curso (slug → ID numérico) ───────────────────────────────

const SLUG_TO_ID: Record<string, string> = {
  'planejamento-contratacoes': '2',
  'gestao-fiscalizacao-contratos': '3',
  'processo-sancionador': '4',
  'assessoramento-juridico': '7',
  'revisao-reajuste-repactuacao': '8',
  'alteracoes-contratuais': '9',
  'contratacao-direta': '10',
};

// Keywords → slug do curso (reutilizado de convert-tcu-excel.js)
const CURSO_MAPPING: Record<string, string> = {
  'licitacao|licitacoes|pregao|edital|modalidade|registro de precos': 'planejamento-contratacoes',
  'planejamento|etp|estudo tecnico|termo de referencia|projeto basico|analise de riscos': 'planejamento-contratacoes',
  'gestao contratual|fiscalizacao|acompanhamento|medicao|recebimento|gestor|fiscal': 'gestao-fiscalizacao-contratos',
  'sancao|penalidade|multa|advertencia|impedimento|suspensao|declaracao de inidoneidade': 'processo-sancionador',
  'inovacao|startup|dialogo competitivo|pmi|encomenda tecnologica': 'contratacao-direta',
  'tercerizacao|mao de obra|planilha de custos|formacao de precos|encargos': 'gestao-fiscalizacao-contratos',
  'parecer juridico|assessoria juridica|procuradoria|agu|consultivo': 'assessoramento-juridico',
  'reajuste|repactuacao|revisao|reequilibrio economico|alea': 'revisao-reajuste-repactuacao',
  'aditivo|acrescimo|supressao|prorrogacao|alteracao contratual': 'alteracoes-contratuais',
  'dispensa|inexigibilidade|contratacao direta|emergencia|notoria especializacao': 'contratacao-direta',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Remove tags HTML do enunciado */
function limparHtml(texto: string): string {
  if (!texto) return '';
  return texto
    .replace(/<\/?[^>]+(>|$)/g, '') // remove qualquer tag HTML
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Parseia acórdão no formato "AC-2002/25-P" → { numero, ano, colegiado } */
function parsearAcordao(acordao: string): {
  numero: number | null;
  ano: number | null;
  colegiado: string | null;
  numeroAcordao: string | null;
} {
  if (!acordao) return { numero: null, ano: null, colegiado: null, numeroAcordao: null };

  // Formato: AC-{numero}/{anoAbreviado}-{colegiado}
  // Exemplo: AC-2002/25-P, AC-1106/24-P, AC-500/23-1C
  const match = acordao.match(/AC-(\d+)\/(\d{2,4})-(\w+)/i);
  if (match) {
    const numero = parseInt(match[1], 10);
    let ano = parseInt(match[2], 10);
    // Se ano tem 2 dígitos, expandir para 4
    if (ano < 100) {
      ano = ano >= 21 ? 2000 + ano : 2000 + ano;
    }
    const colegiadoCode = match[3].toUpperCase();
    let colegiado = 'Plenário';
    if (colegiadoCode === '1C' || colegiadoCode === '1') colegiado = '1ª Câmara';
    if (colegiadoCode === '2C' || colegiadoCode === '2') colegiado = '2ª Câmara';

    return {
      numero,
      ano,
      colegiado,
      numeroAcordao: `${numero}/${ano}`,
    };
  }

  // Fallback: tenta extrair número/ano genérico
  const fallback = acordao.match(/(\d+)\/(\d{2,4})/);
  if (fallback) {
    const numero = parseInt(fallback[1], 10);
    let ano = parseInt(fallback[2], 10);
    if (ano < 100) ano = 2000 + ano;
    return { numero, ano, colegiado: null, numeroAcordao: `${numero}/${ano}` };
  }

  return { numero: null, ano: null, colegiado: null, numeroAcordao: null };
}

/** Identifica o primeiro curso relevante */
function identificarCurso(area: string, tema: string, subtema: string, enunciado: string): { courseId: string | null; isCommon: boolean } {
  const textoCompleto = [area, tema, subtema, enunciado]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  for (const [keywords, slug] of Object.entries(CURSO_MAPPING)) {
    const patterns = keywords.split('|');
    for (const pattern of patterns) {
      if (textoCompleto.includes(pattern)) {
        return { courseId: SLUG_TO_ID[slug], isCommon: false };
      }
    }
  }

  // Sem match → isCommon
  return { courseId: null, isCommon: true };
}

/** Gera tags a partir dos metadados (max 15) */
function gerarTags(
  area: string, tema: string, subtema: string,
  legislacao: string, outrosIndexadores: string,
): string[] {
  const tags = new Set<string>();
  tags.add('TCU');
  tags.add('Acórdão');

  if (area) tags.add(area.trim());
  if (tema) tags.add(tema.trim());
  if (subtema) tags.add(subtema.trim());

  if (legislacao) {
    for (const lei of legislacao.split(/[,;]/)) {
      const t = lei.trim();
      if (t) tags.add(t);
    }
  }
  if (outrosIndexadores) {
    for (const idx of outrosIndexadores.split(/[,;]/)) {
      const t = idx.trim();
      if (t) tags.add(t);
    }
  }

  return Array.from(tags).slice(0, 15);
}

/** Constrói URL de pesquisa do TCU */
function construirUrlTCU(numero: number | null, ano: number | null, colegiado?: string | null): string {
  if (!numero || !ano) return '';
  const col = mapearColegiado(colegiado || 'Plenário');
  return `https://pesquisa.apps.tcu.gov.br/doc/acordao-completo/${numero}/${ano}/${encodeURIComponent(col)}`;
}

/** Mapeia código de colegiado para nome completo usado na URL do TCU */
function mapearColegiado(colegiado: string): string {
  const c = colegiado.trim();
  if (/1[ªa]\s*c/i.test(c) || c === 'Primeira Câmara') return 'Primeira Câmara';
  if (/2[ªa]\s*c/i.test(c) || c === 'Segunda Câmara') return 'Segunda Câmara';
  return 'Plenário';
}

/** Parseia data no formato DD/MM/YYYY ou serial do Excel */
function parsearData(dataStr: unknown): Date | null {
  if (!dataStr) return null;

  // Se for número (serial do Excel), converter
  if (typeof dataStr === 'number') {
    // Excel serial date: dias desde 1900-01-01 (com bug do leap year)
    const excelEpoch = new Date(1899, 11, 30); // 30 Dec 1899
    const msPerDay = 24 * 60 * 60 * 1000;
    return new Date(excelEpoch.getTime() + dataStr * msPerDay);
  }

  const str = String(dataStr).trim();

  // Formato DD/MM/YYYY
  const match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, dia, mes, ano] = match;
    return new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
  }

  // Formato YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return new Date(str);
  }

  return null;
}

/** Gera título padronizado */
function gerarTitulo(numero: number | null, ano: number | null, tema: string, subtema: string): string {
  const base = numero && ano ? `Acórdão TCU ${numero}/${ano}` : 'Acórdão TCU';
  const detalhe = subtema ? `${tema} - ${subtema}` : tema;
  return detalhe ? `${base} - ${detalhe}` : base;
}

/** Normaliza as chaves de um row (trim + lowercase sem acentos) para acesso uniforme */
function normalizarRow(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const normalKey = key
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    result[normalKey] = value;
  }
  return result;
}

/** Lê um campo normalizado */
function lerCampo(row: Record<string, unknown>, chave: string): string {
  const val = row[chave];
  if (val === undefined || val === null) return '';
  return String(val).trim();
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const inputPath = args.find(a => !a.startsWith('--'));

  if (!inputPath) {
    console.log('Uso: npx tsx scripts/import-tcu-excel.ts <arquivo.xls> [--dry-run]');
    process.exit(1);
  }

  if (!fs.existsSync(inputPath)) {
    console.error(`Arquivo não encontrado: ${inputPath}`);
    process.exit(1);
  }

  if (dryRun) console.log('[DRY RUN] Nenhum dado será inserido no banco.\n');

  // 1. Ler planilha
  console.log(`Lendo planilha: ${path.basename(inputPath)}`);
  const workbook = xlsx.readFile(inputPath);
  const sheetName = workbook.SheetNames[0];
  const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]) as Record<string, unknown>[];
  console.log(`${data.length} linhas encontradas na aba "${sheetName}"\n`);

  if (data.length === 0) {
    console.error('Planilha vazia!');
    process.exit(1);
  }

  // Mostrar colunas encontradas
  const colunas = Object.keys(data[0]);
  console.log(`Colunas: ${colunas.join(', ')}\n`);

  // 2. Buscar documentos existentes para detecção de duplicatas
  console.log('Buscando documentos existentes no banco...');
  const existentes = await prisma.document.findMany({
    where: { category: 'acordao' },
    select: { acordaoNumero: true, acordaoAno: true, description: true },
  });

  // Construir set de chaves únicas: "numero|ano|hash(description)"
  const existentesSet = new Set<string>();
  for (const doc of existentes) {
    if (doc.acordaoNumero && doc.acordaoAno) {
      const key = `${doc.acordaoNumero}|${doc.acordaoAno}|${(doc.description || '').substring(0, 100)}`;
      existentesSet.add(key);
    }
  }
  console.log(`${existentes.length} acórdãos já existem no banco.\n`);

  // 3. Processar linhas
  console.log('Processando linhas...');

  interface DocumentData {
    title: string;
    description: string;
    category: string;
    type: string;
    url: string;
    courseId: string | null;
    isCommon: boolean;
    isPublic: boolean;
    tags: string;
    reviewed: boolean;
    tcuNumeroAcordao: string | null;
    tcuAutorTese: string | null;
    tcuArea: string | null;
    tcuTema: string | null;
    tcuSubtema: string | null;
    tcuLegislacao: string | null;
    tcuIndexadores: string | null;
    tcuTipoProcesso: string | null;
    tcuDataJulgamento: Date | null;
    tcuOrgaoJulgador: string | null;
    acordaoNumero: number | null;
    acordaoAno: number | null;
  }

  const documentos: DocumentData[] = [];
  let duplicatas = 0;
  let erros = 0;

  // Também detectar duplicatas internas na planilha
  const vistos = new Set<string>();

  for (let i = 0; i < data.length; i++) {
    const row = normalizarRow(data[i]);

    try {
      const enunciado = lerCampo(row, 'enunciado');
      const area = lerCampo(row, 'area');
      const tema = lerCampo(row, 'tema');
      const subtema = lerCampo(row, 'subtema');
      const dataJulg = row['data'] ?? null;
      const acordao = lerCampo(row, 'acordao');
      const autorTese = lerCampo(row, 'autor da tese');
      const legislacao = lerCampo(row, 'legislacao');
      const outrosIndexadores = lerCampo(row, 'outros indexadores');
      const tipoProcesso = lerCampo(row, 'tipo do processo');

      if (!enunciado && !acordao) {
        erros++;
        continue;
      }

      // Parsear acórdão
      const parsed = parsearAcordao(acordao);
      const descricaoLimpa = limparHtml(enunciado);

      // Detecção de duplicata (banco)
      const dupeKey = `${parsed.numero}|${parsed.ano}|${descricaoLimpa.substring(0, 100)}`;
      if (existentesSet.has(dupeKey)) {
        duplicatas++;
        continue;
      }

      // Detecção de duplicata (interna na planilha)
      if (vistos.has(dupeKey)) {
        duplicatas++;
        continue;
      }
      vistos.add(dupeKey);

      // Identificar curso
      const { courseId, isCommon } = identificarCurso(area, tema, subtema, descricaoLimpa);

      // Gerar tags
      const tags = gerarTags(area, tema, subtema, legislacao, outrosIndexadores);

      // Gerar título
      const titulo = gerarTitulo(parsed.numero, parsed.ano, tema, subtema);

      // Construir URL
      const url = construirUrlTCU(parsed.numero, parsed.ano, parsed.colegiado);

      // Parsear data de julgamento
      const dataJulgamento = parsearData(dataJulg);

      documentos.push({
        title: titulo,
        description: descricaoLimpa,
        category: 'acordao',
        type: 'link',
        url: url || `https://pesquisa.apps.tcu.gov.br/pesquisa/acordao-completo`,
        courseId,
        isCommon,
        isPublic: false,
        tags: JSON.stringify(tags),
        reviewed: true,
        tcuNumeroAcordao: parsed.numeroAcordao || acordao || null,
        tcuAutorTese: autorTese || null,
        tcuArea: area || null,
        tcuTema: tema || null,
        tcuSubtema: subtema || null,
        tcuLegislacao: legislacao || null,
        tcuIndexadores: outrosIndexadores || null,
        tcuTipoProcesso: tipoProcesso || null,
        tcuDataJulgamento: dataJulgamento,
        tcuOrgaoJulgador: parsed.colegiado || null,
        acordaoNumero: parsed.numero,
        acordaoAno: parsed.ano,
      });
    } catch (err) {
      erros++;
      console.error(`  Erro na linha ${i + 2}: ${err instanceof Error ? err.message : err}`);
    }
  }

  // 4. Estatísticas pré-importação
  const comCurso = documentos.filter(d => d.courseId !== null).length;
  const isCommonCount = documentos.filter(d => d.isCommon).length;

  const porCurso: Record<string, number> = {};
  for (const doc of documentos) {
    if (doc.courseId) {
      const slug = Object.entries(SLUG_TO_ID).find(([, id]) => id === doc.courseId)?.[0] || doc.courseId;
      porCurso[slug] = (porCurso[slug] || 0) + 1;
    }
  }

  const porArea: Record<string, number> = {};
  for (const doc of documentos) {
    const area = doc.tcuArea || '(sem área)';
    porArea[area] = (porArea[area] || 0) + 1;
  }

  console.log('\n─── Resumo ──────────────────────────────────────');
  console.log(`  Total de linhas:     ${data.length}`);
  console.log(`  A importar:          ${documentos.length}`);
  console.log(`  Duplicatas (skip):   ${duplicatas}`);
  console.log(`  Erros (skip):        ${erros}`);
  console.log(`  Com curso:           ${comCurso}`);
  console.log(`  isCommon (geral):    ${isCommonCount}`);

  console.log('\n  Por curso:');
  for (const [slug, count] of Object.entries(porCurso).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${slug}: ${count}`);
  }

  console.log('\n  Por área TCU:');
  for (const [area, count] of Object.entries(porArea).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${area}: ${count}`);
  }

  if (dryRun) {
    console.log('\n[DRY RUN] Fim da simulação. Nenhum dado inserido.');

    // Mostrar amostra
    console.log('\n─── Amostra (3 primeiros) ──────────────────────');
    for (const doc of documentos.slice(0, 3)) {
      console.log(`  Título: ${doc.title}`);
      console.log(`  Descrição: ${doc.description.substring(0, 120)}...`);
      console.log(`  Curso: ${doc.courseId || 'isCommon'} | Área: ${doc.tcuArea}`);
      console.log(`  Tags: ${doc.tags}`);
      console.log(`  URL: ${doc.url}`);
      console.log('  ---');
    }
    return;
  }

  // 5. Inserir em batch
  console.log(`\nInserindo ${documentos.length} documentos no banco...`);

  const BATCH_SIZE = 100;
  let inseridos = 0;

  for (let i = 0; i < documentos.length; i += BATCH_SIZE) {
    const batch = documentos.slice(i, i + BATCH_SIZE);
    const result = await prisma.document.createMany({
      data: batch,
      skipDuplicates: true,
    });
    inseridos += result.count;

    const progresso = Math.min(i + BATCH_SIZE, documentos.length);
    process.stdout.write(`\r  [${progresso}/${documentos.length}] ${inseridos} inseridos`);
  }

  console.log(`\n\nImportação concluída!`);
  console.log(`  Inseridos: ${inseridos}`);
  console.log(`  Duplicatas: ${duplicatas}`);

  // Contar total no banco
  const totalBanco = await prisma.document.count({ where: { category: 'acordao' } });
  console.log(`  Total de acórdãos no banco: ${totalBanco}`);
}

main()
  .catch((err) => {
    console.error('Erro fatal:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
