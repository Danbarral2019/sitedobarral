import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api-middleware';
import * as xlsx from 'xlsx';

// Reutiliza a lógica do conversor TCU existente
const CURSO_MAPPING: Record<string, string> = {
  'licitacao|licitacoes|pregao|edital|modalidade|registro de precos': 'nova-lei-licitacoes',
  'planejamento|etp|estudo tecnico|termo de referencia|projeto basico|analise de riscos': 'planejamento-contratacoes',
  'gestao contratual|fiscalizacao|acompanhamento|medicao|recebimento|gestor|fiscal': 'gestao-fiscalizacao-contratos',
  'sancao|penalidade|multa|advertencia|impedimento|suspensao|declaracao de inidoneidade': 'processo-sancionador',
  'inovacao|startup|dialogo competitivo|pmi|encomenda tecnologica': 'inovacao-contratacoes',
  'tercerizacao|mao de obra|planilha de custos|formacao de precos|encargos': 'terceirizacao-formacao-precos',
  'parecer juridico|assessoria juridica|procuradoria|agu|consultivo': 'assessoramento-juridico',
  'reajuste|repactuacao|revisao|reequilibrio economico|alea': 'revisao-reajuste-repactuacao',
  'aditivo|acrescimo|supressao|prorrogacao|alteracao contratual': 'alteracoes-contratuais',
  'dispensa|inexigibilidade|contratacao direta|emergencia|notoria especializacao': 'contratacao-direta',
};

function identificarCursos(area: string, tema: string, subtema: string, enunciado: string): string[] {
  const cursos = new Set<string>();
  const textoCompleto = [area, tema, subtema, enunciado]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  for (const [keywords, curso] of Object.entries(CURSO_MAPPING)) {
    const patterns = keywords.split('|');
    for (const pattern of patterns) {
      if (textoCompleto.includes(pattern)) {
        cursos.add(curso);
        break;
      }
    }
  }

  if (cursos.size === 0) {
    cursos.add('nova-lei-licitacoes');
  }

  return Array.from(cursos);
}

function gerarTags(
  area: string,
  tema: string,
  subtema: string,
  autorTese: string,
  legislacao: string,
  outrosIndexadores: string
): string[] {
  const tags = new Set<string>();
  tags.add('TCU');
  tags.add('Acordao');

  if (area) tags.add(area.trim());
  if (tema) tags.add(tema.trim());
  if (subtema) tags.add(subtema.trim());
  if (autorTese) tags.add(autorTese.trim());

  if (legislacao) {
    legislacao.split(/[,;]/).forEach(lei => {
      const leiTrim = lei.trim();
      if (leiTrim) tags.add(leiTrim);
    });
  }

  if (outrosIndexadores) {
    outrosIndexadores.split(/[,;]/).forEach(idx => {
      const idxTrim = idx.trim();
      if (idxTrim) tags.add(idxTrim);
    });
  }

  return Array.from(tags).slice(0, 15);
}

function construirUrlTCU(acordao: string): string {
  const match = acordao.match(/(\d+)\/(\d{2,4})/);
  if (!match) return '';

  const [, numero, ano] = match;
  return `https://pesquisa.apps.tcu.gov.br/#/documento/acordao-completo/*/NUMACORDAO%253A${numero}%2520ANOACORDAO%253A${ano}`;
}

function formatarData(dataStr: string): string {
  if (!dataStr) return '';

  const match = dataStr.toString().match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (match) {
    const [, dia, mes, ano] = match;
    return `${ano}-${mes}-${dia}`;
  }

  return dataStr;
}

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

  const cursos = identificarCursos(area, tema, subtema, enunciado);
  const tags = gerarTags(area, tema, subtema, autorTese, legislacao, outrosIndexadores);
  const url = construirUrlTCU(acordao);

  const titulo = acordao || `Acordao ${index + 1}`;

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
 * POST /api/admin/tcu-manager/convert
 * Converte Excel do TCU para formato do sistema (retorna JSON em vez de arquivo)
 */
export const POST = withAdminAuth(async (request: NextRequest) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'Nenhum arquivo enviado' },
        { status: 400 }
      );
    }

    console.log('[TCU Manager Convert] Processando arquivo:', file.name);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const workbook = xlsx.read(buffer, {
      type: 'buffer',
      cellDates: true,
    });

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    let data = xlsx.utils.sheet_to_json(worksheet) as Record<string, unknown>[];

    // Limpar nomes de colunas (trim)
    data = data.map(row => {
      const cleanedRow: Record<string, unknown> = {};
      Object.entries(row).forEach(([key, value]) => {
        cleanedRow[key.trim()] = value;
      });
      return cleanedRow;
    });

    console.log(`[TCU Manager Convert] Total de linhas: ${data.length}`);

    if (data.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum dado encontrado na planilha' },
        { status: 400 }
      );
    }

    const linhasConvertidas = data.map((row, index) => converterLinha(row, index));

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

    console.log('[TCU Manager Convert] Conversão concluída. Stats:', stats);

    return NextResponse.json({
      success: true,
      stats,
      documents: linhasConvertidas,
    });

  } catch (error) {
    console.error('[TCU Manager Convert] Erro:', error);
    return NextResponse.json(
      {
        error: 'Erro ao converter arquivo',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
});
