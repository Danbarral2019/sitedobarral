import { NextResponse } from 'next/server';
import { withAdminApi } from '@/lib/api/handler';
import { ValidationError } from '@/lib/errors/api-error';
import * as xlsx from 'xlsx';
import { apiLogger } from "@/lib/logger";
import { validateWorkbookShape, validateWorkbookUpload } from '@/lib/excel-processor';

// Mapeamento inteligente de Area/Tema para Cursos
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

const CURSO_NAMES: Record<string, string> = {
  'planejamento-contratacoes': 'Planejamento das Contratacoes',
  'gestao-fiscalizacao-contratos': 'Gestao e Fiscalizacao de Contratos',
  'processo-sancionador': 'Processo Sancionador',
  'assessoramento-juridico': 'Assessoramento Juridico',
  'revisao-reajuste-repactuacao': 'Revisao, Reajuste e Repactuacao',
  'alteracoes-contratuais': 'Alteracoes Contratuais',
  'contratacao-direta': 'Contratacao Direta',
};

/**
 * Identifica cursos relevantes baseado em area, tema e subtema
 */
function identificarCursos(area: string, tema: string, subtema: string, enunciado: string): string[] {
  const cursos = new Set<string>();
  const textoCompleto = [area, tema, subtema, enunciado]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remove acentos

  for (const [keywords, curso] of Object.entries(CURSO_MAPPING)) {
    const patterns = keywords.split('|');
    for (const pattern of patterns) {
      if (textoCompleto.includes(pattern)) {
        cursos.add(curso);
        break;
      }
    }
  }

  // Se não encontrou nenhum curso, adiciona o padrão
  if (cursos.size === 0) {
    cursos.add('planejamento-contratacoes');
  }

  return Array.from(cursos);
}

/**
 * Gera tags a partir dos metadados
 */
function gerarTags(
  area: string,
  tema: string,
  subtema: string,
  autorTese: string,
  legislacao: string,
  outrosIndexadores: string
): string[] {
  const tags = new Set<string>();

  // Sempre adiciona TCU
  tags.add('TCU');
  tags.add('Acordao');

  // Adiciona area, tema, subtema
  if (area) tags.add(area.trim());
  if (tema) tags.add(tema.trim());
  if (subtema) tags.add(subtema.trim());

  // Adiciona autor da tese
  if (autorTese) {
    tags.add(autorTese.trim());
  }

  // Adiciona legislacao
  if (legislacao) {
    const leis = legislacao.split(/[,;]/);
    leis.forEach(lei => {
      const leiTrim = lei.trim();
      if (leiTrim) tags.add(leiTrim);
    });
  }

  // Adiciona outros indexadores
  if (outrosIndexadores) {
    const indexadores = outrosIndexadores.split(/[,;]/);
    indexadores.forEach(idx => {
      const idxTrim = idx.trim();
      if (idxTrim) tags.add(idxTrim);
    });
  }

  return Array.from(tags).slice(0, 15); // Máximo 15 tags
}

/**
 * Constroi URL do acordao no site do TCU
 */
function construirUrlTCU(acordao: string): string {
  const match = acordao.match(/(\d+)\/(\d{4})/);
  if (!match) {
    return '';
  }

  const [, numero, ano] = match;
  return `https://pesquisa.apps.tcu.gov.br/doc/acordao-completo/${numero}/${ano}/${encodeURIComponent('Plenário')}`;
}

/**
 * Formata data do TCU
 */
function formatarData(dataStr: string): string {
  if (!dataStr) return '';

  const match = dataStr.toString().match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (match) {
    const [, dia, mes, ano] = match;
    return `${ano}-${mes}-${dia}`;
  }

  return dataStr;
}

/**
 * Converte linha do Excel do TCU
 */
function converterLinha(row: Record<string, unknown>, index: number) {
  const enunciado = (row['Enunciado'] || row['enunciado'] || '') as string;
  const area = (row['Area'] || row['area'] || row['Área'] || '') as string;
  const tema = (row['Tema'] || row['tema'] || '') as string;
  const subtema = (row['Subtema'] || row['subtema'] || '') as string;
  const data = (row['Data'] || row['data'] || '') as string;
  const acordao = (row['Acordao'] || row['acordao'] || row['Acórdão'] || '') as string;
  const autorTese = (row['Autor da tese'] || row['autor da tese'] || '') as string;
  const legislacao = (row['Legislacao'] || row['legislacao'] || row['Legislação'] || '') as string;
  const outrosIndexadores = (row['Outros indexadores'] || row['outros indexadores'] || '') as string;
  const tipoProcesso = (row['Tipo do processo'] || row['tipo do processo'] || '') as string;

  // Identifica cursos relevantes
  const cursos = identificarCursos(area, tema, subtema, enunciado);

  // Gera tags
  const tags = gerarTags(area, tema, subtema, autorTese, legislacao, outrosIndexadores);

  // Constroi URL
  const url = construirUrlTCU(acordao);

  // Formata titulo
  const titulo = acordao || `Acordao ${index + 1}`;

  // Formata descricao
  let descricao = enunciado;
  if (tipoProcesso) {
    descricao += `\n\nTipo: ${tipoProcesso}`;
  }

  return {
    Titulo: titulo,
    Descricao: descricao,
    Categoria: 'acordao',
    Curso: cursos.join(','),
    Tags: tags.join(','),
    Publico: 'SIM',
    URL: url,
    Arquivo: '',
    _Area: area,
    _Tema: tema,
    _Subtema: subtema,
    _Data: formatarData(data),
    _AutorTese: autorTese,
  };
}

/**
 * POST /api/admin/convert-tcu
 * Converte Excel do TCU para formato do sistema
 */
export const POST = withAdminApi(async (request) => {
  // Pega o arquivo do form data
  const formData = await request.formData();
  const file = formData.get('file') as File;

  if (!file) {
    throw new ValidationError('Nenhum arquivo enviado');
  }

  validateWorkbookUpload({ filename: file.name, mimeType: file.type, size: file.size });

  console.log('[Convert TCU] Processando arquivo:', file.name);

  // Converte file para buffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Lê o Excel com configuração para arquivos antigos (.xls)
  let workbook;
  try {
    // Tenta ler com suporte a arquivos .xls antigos (CFB)
    workbook = xlsx.read(buffer, {
      type: 'buffer',
      cellDates: true,
      cellNF: false,
      cellText: false,
    });
    validateWorkbookShape(workbook);
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    apiLogger.error({ err: error }, '[Convert TCU] Erro ao ler arquivo:');
    throw new ValidationError(
      'Erro ao ler arquivo. Por favor, converta o arquivo .xls para .xlsx no Excel/LibreOffice antes de importar.',
      { details: error instanceof Error ? error.message : String(error) }
    );
  }
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Converte para JSON
  let data = xlsx.utils.sheet_to_json(worksheet) as Record<string, unknown>[];

  console.log(`[Convert TCU] Total de linhas: ${data.length}`);

  // Limpar nomes de colunas (trim) e normalizar
  data = data.map(row => {
    const cleanedRow: Record<string, unknown> = {};
    Object.entries(row).forEach(([key, value]) => {
      const cleanKey = key.trim(); // Remove espaços extras
      cleanedRow[cleanKey] = value;
    });
    return cleanedRow;
  });

  if (data.length === 0) {
    throw new ValidationError('Nenhum dado encontrado na planilha');
  }

  // Converte linhas
  const linhasConvertidas = data.map((row, index) => converterLinha(row, index));

  // Estatísticas
  const stats = {
    total: linhasConvertidas.length,
    porCurso: {} as Record<string, number>,
    comUrl: linhasConvertidas.filter(l => l.URL).length,
    semUrl: linhasConvertidas.filter(l => !l.URL).length,
  };

  linhasConvertidas.forEach(linha => {
    const cursos = linha.Curso.split(',');
    cursos.forEach(curso => {
      stats.porCurso[curso] = (stats.porCurso[curso] || 0) + 1;
    });
  });

  // Cria novo workbook
  const newWorkbook = xlsx.utils.book_new();

  // Aba 1: Instruções
  const instrucoes = [
    ['INSTRUCOES PARA IMPORTACAO'],
    [''],
    ['Este arquivo foi gerado automaticamente a partir do Excel do TCU.'],
    [''],
    ['PROXIMOS PASSOS:'],
    ['1. Baixe este arquivo'],
    ['2. Revise os dados na aba "Dados"'],
    ['3. Importe em /admin/importar'],
    [''],
    ['COLUNAS:'],
    ['- Titulo: Numero do acordao'],
    ['- Descricao: Enunciado da tese'],
    ['- Categoria: Sempre "acordao"'],
    ['- Curso: Cursos identificados automaticamente'],
    ['- Tags: Tags geradas dos metadados'],
    ['- Publico: SIM (acordaos sao publicos)'],
    ['- URL: Link para o acordao no site do TCU'],
  ];
  const wsInstrucoes = xlsx.utils.aoa_to_sheet(instrucoes);
  xlsx.utils.book_append_sheet(newWorkbook, wsInstrucoes, 'Instrucoes');

  // Aba 2: Dados
  const wsDados = xlsx.utils.json_to_sheet(linhasConvertidas);
  xlsx.utils.book_append_sheet(newWorkbook, wsDados, 'Dados');

  // Aba 3: Estatísticas
  const estatisticas = [
    ['ESTATISTICAS DA CONVERSAO'],
    [''],
    ['Total de acordaos:', stats.total],
    ['Com URL:', stats.comUrl],
    ['Sem URL:', stats.semUrl],
    [''],
    ['DISTRIBUICAO POR CURSO:'],
    ...Object.entries(stats.porCurso)
      .sort((a, b) => b[1] - a[1])
      .map(([curso, count]) => [CURSO_NAMES[curso] || curso, count]),
  ];
  const wsStats = xlsx.utils.aoa_to_sheet(estatisticas);
  xlsx.utils.book_append_sheet(newWorkbook, wsStats, 'Estatisticas');

  // Gera buffer do Excel convertido
  const outputBuffer = xlsx.write(newWorkbook, { type: 'buffer', bookType: 'xlsx' });

  console.log('[Convert TCU] Conversão concluída. Stats:', stats);

  // Retorna o arquivo Excel
  return new NextResponse(outputBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="TCU_Convertido_${new Date().toISOString().split('T')[0]}.xlsx"`,
    },
  });

});
