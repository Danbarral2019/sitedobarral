/**
 * Script de debug para analisar o HTML da Lei 14.133
 */

async function debugHTML() {
  const url = 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm';

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  const html = await response.text();

  console.log('=== ANÁLISE DO HTML ===\n');
  console.log(`Tamanho total: ${html.length} chars (${(html.length / 1024).toFixed(2)} KB)\n`);

  // Ver primeiros 2000 caracteres
  console.log('=== PRIMEIROS 2000 CARACTERES ===');
  console.log(html.substring(0, 2000));
  console.log('\n');

  // Buscar "Art. 1"
  const indexArt1 = html.indexOf('Art. 1');
  console.log(`=== POSIÇÃO "Art. 1": ${indexArt1} ===`);
  if (indexArt1 > -1) {
    console.log(html.substring(indexArt1, indexArt1 + 500));
  }
  console.log('\n');

  // Contar ocorrências
  const matches = html.match(/Art\.\s*\d+/g);
  console.log(`=== OCORRÊNCIAS DE "Art. X" ===`);
  console.log(`Total: ${matches ? matches.length : 0}`);
  if (matches) {
    console.log('Primeiras 20:', matches.slice(0, 20));
  }
}

debugHTML();
