const XLSX = require('xlsx');

const filePath = 'C:\\Users\\Administrador\\Downloads\\pesquisaExportada (4).xlsx';

console.log('Analisando arquivo XLSX convertido...\n');

try {
  const workbook = XLSX.readFile(filePath, { cellDates: true });

  console.log('Planilhas encontradas:', workbook.SheetNames);

  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Converter para JSON
  const data = XLSX.utils.sheet_to_json(worksheet);

  console.log(`\nTotal de registros: ${data.length}`);

  if (data.length > 0) {
    const firstRecord = data[0];

    console.log('\nColunas encontradas:');
    Object.keys(firstRecord).forEach((key, index) => {
      console.log(`  ${index + 1}. ${key}`);
    });

    console.log('\nPrimeiro registro:');
    console.log(JSON.stringify(firstRecord, null, 2));

    console.log('\nSegundo registro:');
    if (data[1]) {
      console.log(JSON.stringify(data[1], null, 2));
    }

    console.log('\nTerceiro registro:');
    if (data[2]) {
      console.log(JSON.stringify(data[2], null, 2));
    }

    // Estatísticas
    console.log('\n=== ESTATISTICAS ===');
    console.log(`Total de registros: ${data.length}`);

    // Verificar campos vazios
    let comEnunciado = 0;
    let comAcordao = 0;
    let comArea = 0;

    data.forEach(row => {
      if (row['Enunciado'] || row['enunciado']) comEnunciado++;
      if (row['Acordao'] || row['acordao'] || row['Acórdão']) comAcordao++;
      if (row['Area'] || row['area'] || row['Área']) comArea++;
    });

    console.log(`Com Enunciado: ${comEnunciado}`);
    console.log(`Com Acordao: ${comAcordao}`);
    console.log(`Com Area: ${comArea}`);
  }

} catch (error) {
  console.error('Erro ao analisar:', error.message);
}
