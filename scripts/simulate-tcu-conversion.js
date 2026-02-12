/**
 * Simula a conversão completa do arquivo TCU
 * Mostra como os dados serão convertidos para o formato do sistema
 */

const xlsx = require('xlsx');

const filePath = 'C:\\Users\\Administrador\\Downloads\\pesquisaExportada (4).xlsx';

console.log('=== SIMULAÇÃO DE CONVERSÃO TCU ===\n');

// Mapeamento de cursos (mesmo do conversor real)
const CURSO_MAPPING = {
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

function identificarCursos(area, tema, subtema, enunciado) {
  const cursos = new Set();
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
    cursos.add('planejamento-contratacoes');
  }

  return Array.from(cursos);
}

function gerarTags(area, tema, subtema, autorTese, legislacao, outrosIndexadores) {
  const tags = new Set();
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

function construirUrlTCU(acordao) {
  const match = acordao.match(/(\d+)\/(\d{2,4})/);
  if (!match) return '';

  const [, numero, ano] = match;
  return `https://pesquisa.apps.tcu.gov.br/doc/acordao-completo/${numero}/${ano}/${encodeURIComponent('Plenário')}`;
}

try {
  const workbook = xlsx.readFile(filePath, { cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  let data = xlsx.utils.sheet_to_json(worksheet);

  // Limpar colunas
  data = data.map(row => {
    const cleanedRow = {};
    Object.entries(row).forEach(([key, value]) => {
      cleanedRow[key.trim()] = value;
    });
    return cleanedRow;
  });

  console.log(`Total de acórdãos: ${data.length}\n`);

  // Converte os primeiros 5
  console.log('=== CONVERSÃO DOS PRIMEIROS 5 ACÓRDÃOS ===\n');

  const converted = data.slice(0, 5).map((row, idx) => {
    const enunciado = row['Enunciado'] || '';
    const area = row['Área'] || '';
    const tema = row['Tema'] || '';
    const subtema = row['Subtema'] || '';
    const data_acordao = row['Data'] || '';
    const acordao = row['Acórdão'] || '';
    const autorTese = row['Autor da tese'] || '';
    const legislacao = row['Legislação'] || '';
    const outrosIndexadores = row['Outros indexadores'] || '';
    const tipoProcesso = row['Tipo do processo'] || '';

    const cursos = identificarCursos(area, tema, subtema, enunciado);
    const tags = gerarTags(area, tema, subtema, autorTese, legislacao, outrosIndexadores);
    const url = construirUrlTCU(acordao);

    const convertido = {
      Titulo: acordao,
      Descricao: enunciado,
      Categoria: 'acordao',
      Curso: cursos.join(','),
      Tags: tags.join(','),
      Publico: 'SIM',
      URL: url,
      Arquivo: '',
    };

    console.log(`--- Acórdão ${idx + 1} ---`);
    console.log(`Original:`);
    console.log(`  Acórdão: ${acordao}`);
    console.log(`  Área: ${area}`);
    console.log(`  Tema: ${tema}`);
    console.log(`  Enunciado: ${enunciado.substring(0, 100)}...`);
    console.log();
    console.log(`Convertido:`);
    console.log(`  Titulo: ${convertido.Titulo}`);
    console.log(`  Categoria: ${convertido.Categoria}`);
    console.log(`  Cursos: ${convertido.Curso}`);
    console.log(`  Tags (${tags.length}): ${convertido.Tags.substring(0, 100)}...`);
    console.log(`  URL: ${convertido.URL}`);
    console.log(`  Publico: ${convertido.Publico}`);
    console.log();

    return convertido;
  });

  // Estatísticas gerais
  console.log('=== ESTATÍSTICAS COMPLETAS ===\n');

  const allConverted = data.map((row, idx) => {
    const enunciado = row['Enunciado'] || '';
    const area = row['Área'] || '';
    const tema = row['Tema'] || '';
    const subtema = row['Subtema'] || '';
    const acordao = row['Acórdão'] || '';
    const autorTese = row['Autor da tese'] || '';
    const legislacao = row['Legislação'] || '';
    const outrosIndexadores = row['Outros indexadores'] || '';

    const cursos = identificarCursos(area, tema, subtema, enunciado);
    const url = construirUrlTCU(acordao);

    return {
      cursos,
      temUrl: !!url,
    };
  });

  const stats = {
    total: data.length,
    comUrl: allConverted.filter(c => c.temUrl).length,
    semUrl: allConverted.filter(c => !c.temUrl).length,
    porCurso: {},
  };

  allConverted.forEach(item => {
    item.cursos.forEach(curso => {
      stats.porCurso[curso] = (stats.porCurso[curso] || 0) + 1;
    });
  });

  console.log(`Total de acórdãos: ${stats.total}`);
  console.log(`Com URL gerada: ${stats.comUrl} (${((stats.comUrl/stats.total)*100).toFixed(1)}%)`);
  console.log(`Sem URL: ${stats.semUrl} (${((stats.semUrl/stats.total)*100).toFixed(1)}%)`);
  console.log();
  console.log('Distribuição por curso:');

  const cursosOrdenados = Object.entries(stats.porCurso)
    .sort((a, b) => b[1] - a[1]);

  cursosOrdenados.forEach(([curso, count]) => {
    const percent = ((count/stats.total)*100).toFixed(1);
    console.log(`  ${curso}: ${count} (${percent}%)`);
  });

  console.log();
  console.log('=== RESULTADO ===');
  console.log();
  console.log('✓ Conversão simulada com sucesso!');
  console.log(`✓ ${stats.total} acórdãos serão convertidos`);
  console.log(`✓ Distribuídos em ${Object.keys(stats.porCurso).length} cursos`);
  console.log();
  console.log('Próximos passos:');
  console.log('1. Acesse http://localhost:3000/admin/tcu-converter');
  console.log('2. Faça upload do arquivo: pesquisaExportada (4).xlsx');
  console.log('3. Baixe o arquivo convertido');
  console.log('4. Importe em /admin/importar');

} catch (error) {
  console.error('\n❌ ERRO:', error.message);
  process.exit(1);
}
