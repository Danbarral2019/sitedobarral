/**
 * Script de teste para o conversor TCU
 * Simula o processamento que aconteceria na API
 */

const xlsx = require('xlsx');
const path = require('path');

const filePath = 'C:\\Users\\Administrador\\Downloads\\pesquisaExportada (4).xlsx';

console.log('=== TESTE DO CONVERSOR TCU ===\n');
console.log('Arquivo:', filePath);

try {
  // Lê o Excel
  const workbook = xlsx.readFile(filePath, {
    cellDates: true,
    cellNF: false,
    cellText: false,
  });

  console.log('\nPlanilhas encontradas:', workbook.SheetNames);

  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Converte para JSON
  let data = xlsx.utils.sheet_to_json(worksheet);

  console.log(`\n✓ Total de registros: ${data.length}`);

  // Limpar nomes de colunas (trim)
  data = data.map(row => {
    const cleanedRow = {};
    Object.entries(row).forEach(([key, value]) => {
      const cleanKey = key.trim(); // Remove espaços extras
      cleanedRow[cleanKey] = value;
    });
    return cleanedRow;
  });

  console.log('✓ Colunas limpas (trim aplicado)');

  if (data.length === 0) {
    console.error('\n❌ ERRO: Planilha vazia!');
    process.exit(1);
  }

  // Mostra colunas
  const firstRow = data[0];
  const columns = Object.keys(firstRow);

  console.log(`\n✓ Colunas encontradas (${columns.length}):`);
  columns.forEach((col, idx) => {
    console.log(`  ${idx + 1}. ${col}`);
  });

  // Mostra primeiros 3 registros
  console.log('\n=== PRIMEIROS 3 REGISTROS ===\n');

  data.slice(0, 3).forEach((row, idx) => {
    console.log(`--- Registro ${idx + 1} ---`);
    Object.entries(row).forEach(([key, value]) => {
      const valueStr = String(value).substring(0, 100);
      console.log(`  ${key}: ${valueStr}`);
    });
    console.log('');
  });

  // Estatísticas
  console.log('=== ESTATÍSTICAS ===\n');

  const stats = {
    total: data.length,
    comEnunciado: data.filter(r => r['Enunciado'] || r['enunciado']).length,
    comAcordao: data.filter(r => r['Acordao'] || r['acordao'] || r['Acórdão']).length,
    comArea: data.filter(r => r['Area'] || r['area'] || r['Área']).length,
    comTema: data.filter(r => r['Tema'] || r['tema']).length,
    comData: data.filter(r => r['Data'] || r['data']).length,
  };

  console.log(`Total de registros: ${stats.total}`);
  console.log(`Com Enunciado: ${stats.comEnunciado} (${((stats.comEnunciado/stats.total)*100).toFixed(1)}%)`);
  console.log(`Com Acórdão: ${stats.comAcordao} (${((stats.comAcordao/stats.total)*100).toFixed(1)}%)`);
  console.log(`Com Área: ${stats.comArea} (${((stats.comArea/stats.total)*100).toFixed(1)}%)`);
  console.log(`Com Tema: ${stats.comTema} (${((stats.comTema/stats.total)*100).toFixed(1)}%)`);
  console.log(`Com Data: ${stats.comData} (${((stats.comData/stats.total)*100).toFixed(1)}%)`);

  // Verifica mapeamento de colunas do TCU
  console.log('\n=== MAPEAMENTO DE COLUNAS ===\n');

  const expectedColumns = [
    'Enunciado',
    'Acordao',
    'Acórdão',
    'Area',
    'Área',
    'Tema',
    'Subtema',
    'Data',
    'Autor da tese',
    'Legislacao',
    'Legislação',
    'Outros indexadores'
  ];

  expectedColumns.forEach(col => {
    const found = columns.some(c =>
      c.toLowerCase() === col.toLowerCase() ||
      c.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') ===
      col.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    );
    console.log(`  ${found ? '✓' : '✗'} ${col}`);
  });

  console.log('\n=== CONCLUSÃO ===\n');

  if (stats.comEnunciado > 0 && stats.comAcordao > 0) {
    console.log('✓ Arquivo parece estar no formato correto do TCU');
    console.log('✓ Pronto para ser processado pelo conversor');
    console.log('\nPróximos passos:');
    console.log('1. Acesse http://localhost:3000/admin/tcu-converter');
    console.log('2. Faça upload do arquivo .xlsx');
    console.log('3. Baixe o arquivo convertido');
    console.log('4. Importe em /admin/importar');
  } else {
    console.log('⚠  ATENÇÃO: Arquivo pode não estar no formato esperado');
    console.log('   Verifique se as colunas Enunciado e Acórdão existem');
  }

} catch (error) {
  console.error('\n❌ ERRO ao processar arquivo:', error.message);
  process.exit(1);
}
