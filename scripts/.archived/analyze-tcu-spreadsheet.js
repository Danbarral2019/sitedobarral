const XLSX = require('xlsx');
const path = require('path');

// Caminho da planilha
const filePath = 'C:\\Users\\Administrador\\Downloads\\pesquisaExportada (4).xls';

try {
  console.log('📊 Analisando planilha TCU...\n');

  // Ler arquivo
  const workbook = XLSX.readFile(filePath);

  // Informações gerais
  console.log('📋 Planilhas disponíveis:', workbook.SheetNames);

  // Primeira planilha
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Converter para array
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });

  console.log('\n📊 Informações da planilha:');
  console.log(`- Total de linhas: ${data.length}`);
  console.log(`- Total de colunas: ${data[0]?.length || 0}`);

  // Cabeçalhos
  console.log('\n📝 Colunas encontradas:');
  if (data[0]) {
    data[0].forEach((col, index) => {
      console.log(`  ${index + 1}. ${col}`);
    });
  }

  // Primeiras 5 linhas de dados (com cabeçalhos)
  console.log('\n📄 Primeiras 5 linhas (com cabeçalhos):');
  data.slice(0, 6).forEach((row, index) => {
    console.log(`\nLinha ${index}:`, JSON.stringify(row, null, 2));
  });

  // Converter para JSON com cabeçalhos
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false });

  console.log('\n📋 Primeiro registro (como objeto):');
  console.log(JSON.stringify(jsonData[0], null, 2));

  // Estatísticas
  console.log('\n📈 Estatísticas:');
  console.log(`- Registros de dados: ${jsonData.length}`);
  console.log(`- Colunas: ${Object.keys(jsonData[0] || {}).length}`);

  // Verificar campos importantes
  if (jsonData.length > 0) {
    const firstRecord = jsonData[0];
    console.log('\n🔍 Campos disponíveis no primeiro registro:');
    Object.keys(firstRecord).forEach(key => {
      const value = firstRecord[key];
      const preview = typeof value === 'string' && value.length > 100
        ? value.substring(0, 100) + '...'
        : value;
      console.log(`  - ${key}: ${preview}`);
    });
  }

  console.log('\n✅ Análise concluída!');

} catch (error) {
  console.error('❌ Erro ao analisar planilha:', error.message);
  process.exit(1);
}
