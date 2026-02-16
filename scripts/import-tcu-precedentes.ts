/**
 * Importação de precedentes do TCU: Súmulas, Consultas e Informativos
 *
 * Lê planilhas Excel do TCU e insere diretamente no banco via Prisma.
 * Suporta classificação IA (via Claude) e deduplicação automática.
 *
 * Uso:
 *   cd sitedobarral
 *   npx tsx scripts/import-tcu-precedentes.ts --file=sumulas [--dry-run] [--limit=N] [--skip-ai]
 *   npx tsx scripts/import-tcu-precedentes.ts --file=consultas [--dry-run] [--limit=N] [--skip-ai]
 *   npx tsx scripts/import-tcu-precedentes.ts --file=informativos [--dry-run] [--limit=N] [--skip-ai]
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import * as xlsx from 'xlsx';
import * as fs from 'fs';
import { PrismaClient } from '@prisma/client';
import Anthropic from '@anthropic-ai/sdk';

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

// Keywords → slug do curso (copiado de convert-tcu-excel.js)
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

// ─── Caminhos dos arquivos ───────────────────────────────────────────────────

const FILE_PATHS: Record<string, string> = {
  sumulas: '/Users/danba/Downloads/Sumulas TCU.xls',
  consultas: '/Users/danba/Downloads/respostas a consultas tcu.xls',
  informativos: '/Users/danba/Downloads/informativos de licitação.xls',
};

// Áreas relevantes para filtragem (súmulas e consultas)
const AREAS_RELEVANTES = ['licitação', 'contrato', 'gestão administrativa'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Remove tags HTML e decodifica entities */
function stripHtml(texto: string): string {
  if (!texto) return '';
  return texto
    .replace(/<\/?[^>]+(>|$)/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normaliza as chaves de um row (trim) para acesso uniforme */
function normalizarRow(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    result[key.trim()] = value;
  }
  return result;
}

/** Lê um campo trimado */
function lerCampo(row: Record<string, unknown>, chave: string): string {
  const val = row[chave];
  if (val === undefined || val === null) return '';
  return String(val).trim();
}

/** Parseia data no formato DD/MM/YYYY ou serial do Excel */
function parsearData(dataStr: unknown): Date | null {
  if (!dataStr) return null;

  // Se for número (serial do Excel), converter
  if (typeof dataStr === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
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

/** Identifica o primeiro curso relevante */
function identificarCursos(area: string, tema: string, subtema: string, enunciado: string): string[] {
  const cursos = new Set<string>();
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
        cursos.add(slug);
        break;
      }
    }
  }

  if (cursos.size === 0) {
    cursos.add('planejamento-contratacoes');
  }

  return Array.from(cursos);
}

/** Gera tags a partir dos metadados (max 15) */
function gerarTags(
  area: string, tema: string, subtema: string,
  autorTese: string, legislacao: string, outrosIndexadores: string,
  extraTags: string[] = [],
): string[] {
  const tags = new Set<string>();

  tags.add('TCU');

  for (const t of extraTags) {
    tags.add(t);
  }

  if (area) tags.add(area.trim());
  if (tema) tags.add(tema.trim());
  if (subtema) tags.add(subtema.trim());
  if (autorTese) tags.add(autorTese.trim());

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

/** Constrói URL do acórdão no site do TCU */
function construirUrlTCU(acordao: string): string {
  // Formato AC-{numero}/{anoAbreviado}-{colegiado} (ex: AC-2388/25-P)
  const acMatch = acordao.match(/AC-(\d+)\/(\d{2,4})-(\w+)/i);
  if (acMatch) {
    const numero = acMatch[1];
    let ano = parseInt(acMatch[2], 10);
    if (ano < 100) ano = 2000 + ano;
    const colegiadoCode = acMatch[3].toUpperCase();
    let colegiado = 'Plenário';
    if (colegiadoCode === '1C' || colegiadoCode === '1') colegiado = 'Primeira Câmara';
    if (colegiadoCode === '2C' || colegiadoCode === '2') colegiado = 'Segunda Câmara';
    return `https://pesquisa.apps.tcu.gov.br/doc/acordao-completo/${numero}/${ano}/${encodeURIComponent(colegiado)}`;
  }

  // Formato numero/ano (ex: 1234/2024)
  const match = acordao.match(/(\d+)\/(\d{4})/);
  if (!match) return '';
  const [, numero, ano] = match;
  return `https://pesquisa.apps.tcu.gov.br/doc/acordao-completo/${numero}/${ano}/${encodeURIComponent('Plenário')}`;
}

/** Verifica se a área é relevante (licitação, contrato, gestão administrativa) */
function areaRelevante(area: string): boolean {
  if (!area) return false;
  const areaLower = area.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return AREAS_RELEVANTES.some(r => {
    const rNorm = r.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return areaLower.includes(rNorm);
  });
}

/** Extrai número da súmula do enunciado HTML */
function extrairNumeroSumula(enunciado: string): string | null {
  // Formato: <b>SÚMULA TCU 256:</b> ou SÚMULA TCU Nº 256 ou SUMULA 256
  const match = enunciado.match(/S[UÚ]MULA\s+(?:TCU\s+)?(?:N[º°]?\s*)?(\d+)/i);
  return match ? match[1] : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Tipos ───────────────────────────────────────────────────────────────────

type FileType = 'sumulas' | 'consultas' | 'informativos';

interface DocumentData {
  title: string;
  description: string;
  content: string | null;
  type: string;
  url: string;
  category: string;
  isPublic: boolean;
  isCommon: boolean;
  tags: string;
  leiArticles: string | null;
  courseId: string | null;
  tcuArea: string | null;
  tcuTema: string | null;
  tcuSubtema: string | null;
  tcuAutorTese: string | null;
  tcuLegislacao: string | null;
  tcuIndexadores: string | null;
  tcuTipoProcesso: string | null;
  tcuDataJulgamento: Date | null;
  tcuNumeroAcordao: string | null;
  tcuEmentaCompleta: string | null;
}

// ─── Processadores por tipo ──────────────────────────────────────────────────

function processarSumula(row: Record<string, unknown>): DocumentData | null {
  const r = normalizarRow(row);

  const enunciado = lerCampo(r, 'Enunciado');
  const area = lerCampo(r, 'Área') || lerCampo(r, 'Area');
  const tema = lerCampo(r, 'Tema');
  const subtema = lerCampo(r, 'Subtema');
  const data = r['Data'] ?? null;
  const autorTese = lerCampo(r, 'Autor da tese');
  const legislacao = lerCampo(r, 'Legislação') || lerCampo(r, 'Legislacao');
  const outrosIndexadores = lerCampo(r, 'Outros indexadores');
  const tipoProcesso = lerCampo(r, 'Tipo do processo');

  // Filtrar por área relevante
  if (!areaRelevante(area)) return null;

  // Extrair número da súmula
  const numeroSumula = extrairNumeroSumula(enunciado);
  const titulo = numeroSumula ? `Súmula TCU nº ${numeroSumula}` : 'Súmula TCU';

  // Limpar HTML
  const textoLimpo = stripHtml(enunciado);

  // Identificar cursos
  const cursos = identificarCursos(area, tema, subtema, textoLimpo);
  const primeiroCursoId = SLUG_TO_ID[cursos[0]] || null;

  // Gerar tags
  const tags = gerarTags(area, tema, subtema, autorTese, legislacao, outrosIndexadores, ['Súmula']);

  return {
    title: titulo,
    description: textoLimpo.substring(0, 500),
    content: textoLimpo,
    type: 'link',
    url: '',
    category: 'sumula',
    isPublic: true,
    isCommon: true,
    tags: JSON.stringify(tags),
    leiArticles: null,
    courseId: primeiroCursoId,
    tcuArea: area || null,
    tcuTema: tema || null,
    tcuSubtema: subtema || null,
    tcuAutorTese: autorTese || null,
    tcuLegislacao: legislacao || null,
    tcuIndexadores: outrosIndexadores || null,
    tcuTipoProcesso: tipoProcesso || null,
    tcuDataJulgamento: parsearData(data),
    tcuNumeroAcordao: null,
    tcuEmentaCompleta: enunciado,
  };
}

function processarConsulta(row: Record<string, unknown>): DocumentData | null {
  const r = normalizarRow(row);

  const enunciado = lerCampo(r, 'Enunciado');
  const area = lerCampo(r, 'Área') || lerCampo(r, 'Area');
  const tema = lerCampo(r, 'Tema');
  const subtema = lerCampo(r, 'Subtema');
  const data = r['Data'] ?? null;
  const acordao = lerCampo(r, 'Acórdão') || lerCampo(r, 'Acordao') || lerCampo(r, 'Acordão');
  const autorTese = lerCampo(r, 'Autor da tese');
  const legislacao = lerCampo(r, 'Legislação') || lerCampo(r, 'Legislacao');
  const outrosIndexadores = lerCampo(r, 'Outros indexadores');
  const tipoProcesso = lerCampo(r, 'Tipo do processo');

  // Filtrar por área relevante
  if (!areaRelevante(area)) return null;

  // Título baseado no acórdão
  const titulo = acordao
    ? `Resposta a Consulta — Acórdão ${acordao}`
    : 'Resposta a Consulta TCU';

  // URL
  const url = acordao ? construirUrlTCU(acordao) : '';

  // Limpar HTML
  const textoLimpo = stripHtml(enunciado);

  // Identificar cursos
  const cursos = identificarCursos(area, tema, subtema, textoLimpo);
  const primeiroCursoId = SLUG_TO_ID[cursos[0]] || null;

  // Gerar tags
  const tags = gerarTags(area, tema, subtema, autorTese, legislacao, outrosIndexadores, ['Consulta']);

  return {
    title: titulo,
    description: textoLimpo.substring(0, 500),
    content: textoLimpo,
    type: 'link',
    url,
    category: 'consulta_tcu',
    isPublic: true,
    isCommon: true,
    tags: JSON.stringify(tags),
    leiArticles: null,
    courseId: primeiroCursoId,
    tcuArea: area || null,
    tcuTema: tema || null,
    tcuSubtema: subtema || null,
    tcuAutorTese: autorTese || null,
    tcuLegislacao: legislacao || null,
    tcuIndexadores: outrosIndexadores || null,
    tcuTipoProcesso: tipoProcesso || null,
    tcuDataJulgamento: parsearData(data),
    tcuNumeroAcordao: acordao || null,
    tcuEmentaCompleta: enunciado,
  };
}

function processarInformativo(row: Record<string, unknown>): DocumentData | null {
  const r = normalizarRow(row);

  const titulo = lerCampo(r, 'Título') || lerCampo(r, 'Titulo');
  const data = r['Data'] ?? null;
  const enunciado = lerCampo(r, 'Enunciado');
  const texto = lerCampo(r, 'Texto');
  const urlPdf = lerCampo(r, 'Endereço do Arquivo PDF');

  if (!titulo && !enunciado) return null;

  // Limpar HTML
  const enunciadoLimpo = stripHtml(enunciado);
  const textoLimpo = stripHtml(texto);
  const conteudoCompleto = [enunciadoLimpo, textoLimpo].filter(Boolean).join('\n\n');

  // Para informativos, usar identificarCursos com base no conteúdo
  const cursos = identificarCursos('', '', '', conteudoCompleto || titulo);
  const primeiroCursoId = SLUG_TO_ID[cursos[0]] || null;

  // Tags (informativos não têm mesmos metadados)
  const tags = gerarTags('', '', '', '', '', '', ['TCU', 'Informativo']);

  return {
    title: titulo || 'Informativo TCU',
    description: (enunciadoLimpo || conteudoCompleto).substring(0, 500),
    content: conteudoCompleto || null,
    type: 'link',
    url: urlPdf || '',
    category: 'informativo',
    isPublic: true,
    isCommon: true,
    tags: JSON.stringify(tags),
    leiArticles: null,
    courseId: primeiroCursoId,
    tcuArea: null,
    tcuTema: null,
    tcuSubtema: null,
    tcuAutorTese: null,
    tcuLegislacao: null,
    tcuIndexadores: null,
    tcuTipoProcesso: null,
    tcuDataJulgamento: parsearData(data),
    tcuNumeroAcordao: null,
    tcuEmentaCompleta: enunciado || null,
  };
}

// ─── Geração de títulos únicos com IA (Informativos) ────────────────────────

/**
 * Gera título curto e descritivo para informativo TCU usando Claude.
 * Recebe o enunciado (tese) e retorna um título de até 120 caracteres.
 */
async function gerarTituloComIA(enunciado: string, tituloInformativo: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return gerarTituloFallback(enunciado, tituloInformativo);

  try {
    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 100,
      temperature: 0.2,
      messages: [{
        role: 'user',
        content: `Gere um título CURTO (máximo 100 caracteres) que resuma a tese jurídica abaixo. O título deve ser descritivo, começar com substantivo ou verbo no infinitivo, e não conter aspas. Responda APENAS com o título, sem explicações.

Informativo: ${tituloInformativo}
Tese: ${enunciado.substring(0, 800)}`,
      }],
    });

    const titulo = message.content[0].type === 'text'
      ? message.content[0].text.trim().replace(/^["']|["']$/g, '')
      : '';

    if (titulo && titulo.length > 5) {
      // Prefixar com número do informativo para contexto
      const numMatch = tituloInformativo.match(/(\d+\/\d{4})/);
      const prefixo = numMatch ? `Inf. ${numMatch[1]}` : '';
      return prefixo ? `${prefixo} — ${titulo}` : titulo;
    }
  } catch (err) {
    console.error(`  [IA Título] Erro: ${err instanceof Error ? err.message : err}`);
  }

  return gerarTituloFallback(enunciado, tituloInformativo);
}

/** Fallback: título do informativo + início do enunciado */
function gerarTituloFallback(enunciado: string, tituloInformativo: string): string {
  const textoLimpo = stripHtml(enunciado);
  // Pegar as primeiras ~80 chars do enunciado, cortando na última palavra inteira
  let trecho = textoLimpo.substring(0, 80);
  const ultimoEspaco = trecho.lastIndexOf(' ');
  if (ultimoEspaco > 40) trecho = trecho.substring(0, ultimoEspaco);
  trecho += '...';

  const numMatch = tituloInformativo.match(/(\d+\/\d{4})/);
  const prefixo = numMatch ? `Inf. ${numMatch[1]}` : tituloInformativo;
  return `${prefixo} — ${trecho}`;
}

/** Gera títulos em batch para informativos */
async function gerarTitulosInformativos(documentos: DocumentData[]): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log('  [IA Título] API key não configurada. Usando títulos fallback.');
    for (const doc of documentos) {
      if (doc.category === 'informativo') {
        doc.title = gerarTituloFallback(doc.tcuEmentaCompleta || doc.description, doc.title);
      }
    }
    return;
  }

  console.log('Gerando títulos únicos com IA...');
  const BATCH_SIZE = 10;

  for (let i = 0; i < documentos.length; i += BATCH_SIZE) {
    const batch = documentos.slice(i, i + BATCH_SIZE);

    for (let j = 0; j < batch.length; j++) {
      const doc = batch[j];
      if (doc.category === 'informativo') {
        const tituloOriginal = doc.title;
        doc.title = await gerarTituloComIA(
          doc.tcuEmentaCompleta || doc.description,
          tituloOriginal,
        );
      }
    }

    const progresso = Math.min(i + BATCH_SIZE, documentos.length);
    process.stdout.write(`\r  [${progresso}/${documentos.length}] títulos gerados`);

    if (i + BATCH_SIZE < documentos.length) {
      await sleep(1000);
    }
  }

  console.log('');
  console.log('');
}

// ─── Classificação IA ────────────────────────────────────────────────────────

async function classificarComIA(doc: DocumentData): Promise<DocumentData> {
  try {
    // Import dinâmico para evitar problemas com path aliases
    // classifyWithClaude usa @/lib/prisma internamente, pode não funcionar via tsx
    // Usar import relativo
    const { classifyWithClaude } = await import('../lib/claude-classifier');
    const result = await classifyWithClaude(doc.title, doc.description);

    if (result) {
      // Atualizar courseId com base na sugestão da IA
      if (result.courseSlugs.length > 0) {
        const slugPrincipal = result.courseSlugs[0];
        if (SLUG_TO_ID[slugPrincipal]) {
          doc.courseId = SLUG_TO_ID[slugPrincipal];
        }
      }

      // Mesclar tags da IA com as existentes
      const tagsExistentes: string[] = JSON.parse(doc.tags);
      const tagsIA = result.tags || [];
      const todasTags = [...new Set([...tagsExistentes, ...tagsIA])].slice(0, 15);
      doc.tags = JSON.stringify(todasTags);

      // Atualizar leiArticles se IA sugeriu
      if (result.suggestedArticles && result.suggestedArticles.length > 0) {
        doc.leiArticles = JSON.stringify(result.suggestedArticles);
      }
    }
  } catch {
    // Falha silenciosa — usa classificação local
  }

  return doc;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  // Parse CLI args
  const args = process.argv.slice(2);

  const fileArg = args.find(a => a.startsWith('--file='));
  const dryRun = args.includes('--dry-run');
  const skipAi = args.includes('--skip-ai');
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.replace('--limit=', ''), 10) : undefined;

  if (!fileArg) {
    console.log('Uso: npx tsx scripts/import-tcu-precedentes.ts --file=sumulas|consultas|informativos [--dry-run] [--limit=N] [--skip-ai]');
    process.exit(1);
  }

  const fileType = fileArg.replace('--file=', '') as FileType;
  if (!['sumulas', 'consultas', 'informativos'].includes(fileType)) {
    console.error(`Tipo de arquivo invalido: "${fileType}". Use: sumulas, consultas ou informativos`);
    process.exit(1);
  }

  const filePath = FILE_PATHS[fileType];
  if (!fs.existsSync(filePath)) {
    console.error(`Arquivo nao encontrado: ${filePath}`);
    process.exit(1);
  }

  console.log(`=== Importacao de ${fileType.toUpperCase()} do TCU ===`);
  console.log(`Arquivo: ${filePath}`);
  if (dryRun) console.log('[DRY RUN] Nenhum dado sera inserido no banco.');
  if (skipAi) console.log('[SKIP AI] Classificacao por IA desabilitada.');
  if (limit) console.log(`[LIMIT] Processando apenas ${limit} registros.`);
  console.log('');

  // 1. Ler planilha
  console.log('Lendo planilha...');
  const workbook = xlsx.readFile(filePath);
  const sheetName = 'Relatorio';

  if (!workbook.SheetNames.includes(sheetName)) {
    console.error(`Aba "${sheetName}" nao encontrada. Abas disponíveis: ${workbook.SheetNames.join(', ')}`);
    process.exit(1);
  }

  const rawData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]) as Record<string, unknown>[];
  console.log(`${rawData.length} linhas encontradas na aba "${sheetName}"`);

  // Mostrar colunas
  if (rawData.length > 0) {
    const colunas = Object.keys(rawData[0]).map(k => `"${k}"`);
    console.log(`Colunas: ${colunas.join(', ')}`);
  }
  console.log('');

  // 2. Processar cada linha
  const processador = fileType === 'sumulas' ? processarSumula
    : fileType === 'consultas' ? processarConsulta
    : processarInformativo;

  const dados = limit ? rawData.slice(0, limit) : rawData;

  console.log('Processando linhas...');

  const documentos: DocumentData[] = [];
  let filtrados = 0;
  let erros = 0;

  for (let i = 0; i < dados.length; i++) {
    try {
      const doc = processador(dados[i]);
      if (doc) {
        documentos.push(doc);
      } else {
        filtrados++;
      }
    } catch (err) {
      erros++;
      console.error(`  Erro na linha ${i + 2}: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log(`  ${documentos.length} documentos aprovados (${filtrados} filtrados, ${erros} erros)`);
  console.log('');

  // 3. Para informativos, gerar títulos únicos ANTES da deduplicação
  if (fileType === 'informativos' && !skipAi && documentos.length > 0) {
    await gerarTitulosInformativos(documentos);
  } else if (fileType === 'informativos') {
    // Fallback sem IA: gerar títulos únicos localmente
    for (const doc of documentos) {
      doc.title = gerarTituloFallback(doc.tcuEmentaCompleta || doc.description, doc.title);
    }
  }

  // 4. Deduplicar contra o banco
  console.log('Verificando duplicatas no banco...');
  let duplicatas = 0;
  const documentosNovos: DocumentData[] = [];

  for (const doc of documentos) {
    // Títulos agora são únicos (gerados por IA para informativos), deduplicar por título
    const existing = await prisma.document.findFirst({
      where: { title: doc.title },
      select: { id: true },
    });

    if (existing) {
      duplicatas++;
    } else {
      documentosNovos.push(doc);
    }
  }

  console.log(`  ${duplicatas} duplicatas encontradas`);
  console.log(`  ${documentosNovos.length} novos documentos a importar`);
  console.log('');

  // 5. Classificar com IA (se habilitado)
  if (!skipAi && documentosNovos.length > 0) {
    console.log('Classificando com IA...');
    const BATCH_SIZE = 10;

    for (let i = 0; i < documentosNovos.length; i += BATCH_SIZE) {
      const batch = documentosNovos.slice(i, i + BATCH_SIZE);

      for (let j = 0; j < batch.length; j++) {
        const idx = i + j;
        try {
          documentosNovos[idx] = await classificarComIA(documentosNovos[idx]);
        } catch {
          // Falha silenciosa
        }
      }

      const progresso = Math.min(i + BATCH_SIZE, documentosNovos.length);
      process.stdout.write(`\r  [${progresso}/${documentosNovos.length}] classificados`);

      // Rate limiting entre batches
      if (i + BATCH_SIZE < documentosNovos.length) {
        await sleep(1000);
      }
    }

    console.log('');
    console.log('');
  }

  // 5. Estatísticas
  const porCategoria: Record<string, number> = {};
  const porCurso: Record<string, number> = {};

  for (const doc of documentosNovos) {
    porCategoria[doc.category] = (porCategoria[doc.category] || 0) + 1;

    if (doc.courseId) {
      const slug = Object.entries(SLUG_TO_ID).find(([, id]) => id === doc.courseId)?.[0] || doc.courseId;
      porCurso[slug] = (porCurso[slug] || 0) + 1;
    } else {
      porCurso['isCommon'] = (porCurso['isCommon'] || 0) + 1;
    }
  }

  console.log('--- Resumo ---');
  console.log(`  Total lidos:       ${dados.length}`);
  console.log(`  Filtrados (area):  ${filtrados}`);
  console.log(`  Erros:             ${erros}`);
  console.log(`  Duplicatas:        ${duplicatas}`);
  console.log(`  A importar:        ${documentosNovos.length}`);

  if (Object.keys(porCurso).length > 0) {
    console.log('\n  Por curso:');
    for (const [slug, count] of Object.entries(porCurso).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${slug}: ${count}`);
    }
  }

  // 6. Dry run amostra
  if (dryRun) {
    console.log('\n--- Amostra (3 primeiros) ---');
    for (const doc of documentosNovos.slice(0, 3)) {
      console.log(`  Titulo: ${doc.title}`);
      console.log(`  Descricao: ${doc.description.substring(0, 120)}...`);
      console.log(`  Categoria: ${doc.category}`);
      console.log(`  Curso: ${doc.courseId || 'isCommon'}`);
      console.log(`  URL: ${doc.url || '(vazio)'}`);
      console.log(`  Tags: ${doc.tags}`);
      console.log('  ---');
    }

    console.log('\n[DRY RUN] Fim da simulacao. Nenhum dado inserido.');
    return;
  }

  // 7. Inserir no banco
  if (documentosNovos.length === 0) {
    console.log('\nNenhum documento novo para importar.');
    return;
  }

  console.log(`\nInserindo ${documentosNovos.length} documentos no banco...`);
  const BATCH_SIZE = 10;
  let inseridos = 0;
  let errosInsercao = 0;

  for (let i = 0; i < documentosNovos.length; i += BATCH_SIZE) {
    const batch = documentosNovos.slice(i, i + BATCH_SIZE);

    for (const doc of batch) {
      try {
        await prisma.document.create({
          data: {
            title: doc.title,
            description: doc.description,
            content: doc.content,
            type: doc.type,
            url: doc.url,
            category: doc.category,
            isPublic: doc.isPublic,
            isCommon: doc.isCommon,
            tags: doc.tags,
            leiArticles: doc.leiArticles,
            courseId: doc.courseId,
            tcuArea: doc.tcuArea,
            tcuTema: doc.tcuTema,
            tcuSubtema: doc.tcuSubtema,
            tcuAutorTese: doc.tcuAutorTese,
            tcuLegislacao: doc.tcuLegislacao,
            tcuIndexadores: doc.tcuIndexadores,
            tcuTipoProcesso: doc.tcuTipoProcesso,
            tcuDataJulgamento: doc.tcuDataJulgamento,
            tcuNumeroAcordao: doc.tcuNumeroAcordao,
            tcuEmentaCompleta: doc.tcuEmentaCompleta,
          },
        });
        inseridos++;
      } catch (err) {
        errosInsercao++;
        console.error(`  Erro ao inserir "${doc.title}": ${err instanceof Error ? err.message : err}`);
      }
    }

    const progresso = Math.min(i + BATCH_SIZE, documentosNovos.length);
    process.stdout.write(`\r  [${progresso}/${documentosNovos.length}] ${inseridos} inseridos, ${errosInsercao} erros`);
  }

  console.log('');
  console.log('\n=== Importacao concluida ===');
  console.log(`  Inseridos: ${inseridos}`);
  console.log(`  Erros:     ${errosInsercao}`);

  // Contar total no banco
  const totalBanco = await prisma.document.count({ where: { category: documentosNovos[0]?.category } });
  console.log(`  Total de ${documentosNovos[0]?.category} no banco: ${totalBanco}`);
}

main()
  .catch((err) => {
    console.error('Erro fatal:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
