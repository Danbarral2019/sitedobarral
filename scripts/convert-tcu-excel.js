/**
 * Conversor de Excel do TCU para formato do sistema
 *
 * Converte a planilha oficial do TCU (com colunas específicas) para o formato
 * de importação do sistema, pronto para usar em /admin/importar
 *
 * Colunas esperadas do TCU:
 * - Enunciado
 * - Area
 * - Tema
 * - Subtema
 * - Data
 * - Acordao
 * - Autor da tese
 * - Legislacao
 * - Outros indexadores
 * - Tipo do processo
 *
 * Uso:
 *   node scripts/convert-tcu-excel.js caminho/para/TCU_Acordaos.xlsx
 *   node scripts/convert-tcu-excel.js caminho/para/TCU_Acordaos.xlsx --output=saida.xlsx
 */

const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

// Mapeamento inteligente de Area/Tema para Cursos
const CURSO_MAPPING = {
  // Lei 14.133 e licitacoes em geral
  'licitacao|licitacoes|pregao|edital|modalidade|registro de precos': 'planejamento-contratacoes',

  // Planejamento
  'planejamento|etp|estudo tecnico|termo de referencia|projeto basico|analise de riscos': 'planejamento-contratacoes',

  // Gestao e fiscalizacao
  'gestao contratual|fiscalizacao|acompanhamento|medicao|recebimento|gestor|fiscal': 'gestao-fiscalizacao-contratos',

  // Sancoes
  'sancao|penalidade|multa|advertencia|impedimento|suspensao|declaracao de inidoneidade': 'processo-sancionador',

  // Inovacao
  'inovacao|startup|dialogo competitivo|pmi|encomenda tecnologica': 'contratacao-direta',

  // Tercerizacao e precos
  'tercerizacao|mao de obra|planilha de custos|formacao de precos|encargos': 'gestao-fiscalizacao-contratos',

  // Assessoramento juridico
  'parecer juridico|assessoria juridica|procuradoria|agu|consultivo': 'assessoramento-juridico',

  // Reequilibrio
  'reajuste|repactuacao|revisao|reequilibrio economico|alea': 'revisao-reajuste-repactuacao',

  // Alteracoes contratuais
  'aditivo|acrescimo|supressao|prorrogacao|alteracao contratual': 'alteracoes-contratuais',

  // Contratacao direta
  'dispensa|inexigibilidade|contratacao direta|emergencia|notoria especializacao': 'contratacao-direta',
};

// Nomes dos cursos para referencia
const CURSO_NAMES = {
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
function identificarCursos(area, tema, subtema, enunciado) {
  const cursos = new Set();
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

  // Se nao encontrou nenhum curso, adiciona o padrao
  if (cursos.size === 0) {
    cursos.add('planejamento-contratacoes');
  }

  return Array.from(cursos);
}

/**
 * Gera tags a partir dos metadados
 */
function gerarTags(area, tema, subtema, autorTese, legislacao, outrosIndexadores) {
  const tags = new Set();

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

  // Adiciona legislacao (pode ter multiplas separadas por virgula ou ponto-virgula)
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

  return Array.from(tags).slice(0, 15); // Maximo 15 tags
}

/**
 * Constroi URL do acordao no site do TCU
 */
function construirUrlTCU(acordao) {
  // Formato comum: "1234/2024" ou "Acordao 1234/2024"
  const match = acordao.match(/(\d+)\/(\d{4})/);
  if (!match) {
    return ''; // URL vazia se nao conseguir extrair numero
  }

  const [, numero, ano] = match;

  // URL do TCU (formato novo, desde ~2025)
  return `https://pesquisa.apps.tcu.gov.br/doc/acordao-completo/${numero}/${ano}/${encodeURIComponent('Plenário')}`;
}

/**
 * Formata data do TCU (DD/MM/YYYY) para usar na ordenacao
 */
function formatarData(dataStr) {
  if (!dataStr) return '';

  // Tenta varios formatos
  const match = dataStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (match) {
    const [, dia, mes, ano] = match;
    return `${ano}-${mes}-${dia}`;
  }

  return dataStr;
}

/**
 * Converte linha do Excel do TCU para formato do sistema
 */
function converterLinha(row, index) {
  const enunciado = row['Enunciado'] || row['enunciado'] || '';
  const area = row['Area'] || row['area'] || row['Área'] || '';
  const tema = row['Tema'] || row['tema'] || '';
  const subtema = row['Subtema'] || row['subtema'] || '';
  const data = row['Data'] || row['data'] || '';
  const acordao = row['Acordao'] || row['acordao'] || row['Acórdão'] || '';
  const autorTese = row['Autor da tese'] || row['autor da tese'] || '';
  const legislacao = row['Legislacao'] || row['legislacao'] || row['Legislação'] || '';
  const outrosIndexadores = row['Outros indexadores'] || row['outros indexadores'] || '';
  const tipoProcesso = row['Tipo do processo'] || row['tipo do processo'] || '';

  // Identifica cursos relevantes
  const cursos = identificarCursos(area, tema, subtema, enunciado);

  // Gera tags
  const tags = gerarTags(area, tema, subtema, autorTese, legislacao, outrosIndexadores);

  // Constroi URL
  const url = construirUrlTCU(acordao);

  // Formata titulo
  const titulo = acordao || `Acordao ${index + 1}`;

  // Formata descricao (enunciado + contexto adicional)
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
    Arquivo: '', // Vazio - acordaos sao links
    // Metadados adicionais (opcional, para referencia)
    _Area: area,
    _Tema: tema,
    _Subtema: subtema,
    _Data: formatarData(data),
    _AutorTese: autorTese,
  };
}

/**
 * Converte Excel do TCU
 */
function converterExcelTCU(inputPath, outputPath) {
  console.log('📂 Lendo arquivo do TCU:', inputPath);

  // Le arquivo
  const workbook = xlsx.readFile(inputPath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  console.log(`📊 Planilha encontrada: ${sheetName}`);

  // Converte para JSON
  const data = xlsx.utils.sheet_to_json(worksheet);

  console.log(`📋 Total de linhas: ${data.length}`);

  if (data.length === 0) {
    console.error('❌ Nenhum dado encontrado na planilha!');
    process.exit(1);
  }

  // Verifica colunas esperadas
  const primeiraLinha = data[0];
  const colunasEsperadas = ['Enunciado', 'Area', 'Tema', 'Acordao'];
  const colunasFaltando = colunasEsperadas.filter(col => {
    const variacoes = [col, col.toLowerCase(), col.normalize('NFD').replace(/[\u0300-\u036f]/g, '')];
    return !variacoes.some(v => primeiraLinha[v] !== undefined);
  });

  if (colunasFaltando.length > 0) {
    console.warn('⚠️  Colunas esperadas nao encontradas:', colunasFaltando.join(', '));
    console.warn('⚠️  Colunas encontradas:', Object.keys(primeiraLinha).join(', '));
    console.warn('⚠️  Continuando mesmo assim...\n');
  }

  // Converte linhas
  console.log('🔄 Convertendo linhas...\n');
  const linhasConvertidas = data.map((row, index) => converterLinha(row, index));

  // Estatisticas
  const stats = {
    total: linhasConvertidas.length,
    porCurso: {},
    comUrl: linhasConvertidas.filter(l => l.URL).length,
    semUrl: linhasConvertidas.filter(l => !l.URL).length,
  };

  linhasConvertidas.forEach(linha => {
    const cursos = linha.Curso.split(',');
    cursos.forEach(curso => {
      stats.porCurso[curso] = (stats.porCurso[curso] || 0) + 1;
    });
  });

  console.log('📊 ESTATISTICAS:');
  console.log(`   Total de acordaos: ${stats.total}`);
  console.log(`   Com URL: ${stats.comUrl}`);
  console.log(`   Sem URL: ${stats.semUrl}`);
  console.log('\n📚 Distribuicao por curso:');
  Object.entries(stats.porCurso)
    .sort((a, b) => b[1] - a[1])
    .forEach(([curso, count]) => {
      const nome = CURSO_NAMES[curso] || curso;
      console.log(`   ${nome}: ${count}`);
    });

  // Cria novo workbook
  const newWorkbook = xlsx.utils.book_new();

  // Aba 1: Instrucoes
  const instrucoes = [
    ['INSTRUCOES PARA IMPORTACAO'],
    [''],
    ['Este arquivo foi gerado automaticamente a partir do Excel do TCU.'],
    [''],
    ['PROXIMOS PASSOS:'],
    ['1. Revise os dados na aba "Dados"'],
    ['2. Ajuste cursos e tags se necessario'],
    ['3. Importe em /admin/importar'],
    [''],
    ['COLUNAS:'],
    ['- Titulo: Numero do acordao'],
    ['- Descricao: Enunciado da tese'],
    ['- Categoria: Sempre "acordao"'],
    ['- Curso: Cursos identificados automaticamente (separados por virgula)'],
    ['- Tags: Tags geradas dos metadados'],
    ['- Publico: SIM (acordaos sao publicos)'],
    ['- URL: Link para o acordao no site do TCU'],
    [''],
    ['METADADOS ADICIONAIS:'],
    ['As colunas iniciadas com _ contem metadados do TCU para referencia.'],
    ['Elas NAO serao importadas, servem apenas para consulta.'],
  ];
  const wsInstrucoes = xlsx.utils.aoa_to_sheet(instrucoes);
  xlsx.utils.book_append_sheet(newWorkbook, wsInstrucoes, 'Instrucoes');

  // Aba 2: Dados
  const wsDados = xlsx.utils.json_to_sheet(linhasConvertidas);
  xlsx.utils.book_append_sheet(newWorkbook, wsDados, 'Dados');

  // Aba 3: Estatisticas
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

  // Salva arquivo
  xlsx.writeFile(newWorkbook, outputPath);

  console.log('\n✅ Conversao concluida!');
  console.log(`📄 Arquivo salvo em: ${outputPath}`);
  console.log('\n📌 Proximo passo: Importe em /admin/importar');
}

// Main
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Uso: node scripts/convert-tcu-excel.js <arquivo-entrada.xlsx> [--output=arquivo-saida.xlsx]');
  console.log('\nExemplo:');
  console.log('  node scripts/convert-tcu-excel.js TCU_Acordaos.xlsx');
  console.log('  node scripts/convert-tcu-excel.js TCU_Acordaos.xlsx --output=convertido.xlsx');
  process.exit(1);
}

const inputPath = args[0];

// Verifica se arquivo existe
if (!fs.existsSync(inputPath)) {
  console.error(`❌ Arquivo nao encontrado: ${inputPath}`);
  process.exit(1);
}

// Define arquivo de saida
let outputPath = args.find(arg => arg.startsWith('--output='));
if (outputPath) {
  outputPath = outputPath.replace('--output=', '');
} else {
  const baseName = path.basename(inputPath, path.extname(inputPath));
  const dirName = path.dirname(inputPath);
  const timestamp = new Date().toISOString().split('T')[0];
  outputPath = path.join(dirName, `${baseName}_Convertido_${timestamp}.xlsx`);
}

// Executa conversao
try {
  converterExcelTCU(inputPath, outputPath);
} catch (error) {
  console.error('❌ Erro ao converter:', error.message);
  console.error(error);
  process.exit(1);
}
