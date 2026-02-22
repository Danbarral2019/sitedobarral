// Script simplificado para analisar planilha TCU
// Tenta ler com diferentes estratégias

const fs = require('fs');
const path = require('path');

// Verificar se o arquivo existe
const filePath = 'C:\\Users\\Administrador\\Downloads\\pesquisaExportada (4).xls';

console.log('🔍 Verificando arquivo...');

if (!fs.existsSync(filePath)) {
  console.error('❌ Arquivo não encontrado:', filePath);
  process.exit(1);
}

const stats = fs.statSync(filePath);
console.log('✅ Arquivo encontrado!');
console.log(`📊 Tamanho: ${(stats.size / 1024).toFixed(2)} KB`);
console.log(`📅 Última modificação: ${stats.mtime}`);

console.log('\n💡 INSTRUÇÕES:');
console.log('1. Abra o arquivo no Excel ou LibreOffice');
console.log('2. Salve como: "pesquisaExportada.xlsx" (formato XLSX moderno)');
console.log('3. Execute este script novamente');
console.log('\nOu use o conversor online TCU → XLSX');

// Tentar com módulo alternativo
console.log('\n🔄 Tentando ler com método alternativo...');

try {
  // Tentar importar dinamicamente
  const readXlsFile = require('read-excel-file/node');

  readXlsFile(filePath).then((rows) => {
    console.log('\n✅ Leitura bem-sucedida!');
    console.log(`📊 Total de linhas: ${rows.length}`);

    if (rows.length > 0) {
      console.log('\n📝 Cabeçalhos (primeira linha):');
      console.log(rows[0]);

      console.log('\n📄 Primeira linha de dados:');
      if (rows.length > 1) {
        console.log(rows[1]);
      }

      console.log('\n📋 Estrutura completa das primeiras 3 linhas:');
      rows.slice(0, 3).forEach((row, idx) => {
        console.log(`\nLinha ${idx}:`, JSON.stringify(row, null, 2));
      });
    }
  }).catch(err => {
    console.error('\n❌ Erro com read-excel-file:', err.message);
    console.log('\n📦 Instalando dependência necessária...');
    console.log('Execute: npm install read-excel-file');
  });

} catch (err) {
  console.log('\n📦 Pacote "read-excel-file" não instalado');
  console.log('Para ler arquivos .xls antigos, execute:');
  console.log('  npm install read-excel-file');
  console.log('\nOu converta o arquivo para .xlsx manualmente');
}
