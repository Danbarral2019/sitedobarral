/**
 * Verifica quais artigos foram extraídos e quais estão faltando
 */

import { downloadLeiHTML, extractArticlesFromHTML } from './update-lei-14133-data-file';

async function main() {
  console.log('📊 VERIFICAÇÃO DE COBERTURA - LEI 14.133/2021\n');
  console.log('='.repeat(70));

  // Baixar e extrair
  const html = await downloadLeiHTML();
  const artigos = extractArticlesFromHTML(html);

  // Análise
  const numerosExtraidos = artigos.map(a => parseInt(a.numero)).sort((a, b) => a - b);
  const todoNumeros = Array.from({ length: 193 }, (_, i) => i + 1);
  const faltando = todoNumeros.filter(n => !numerosExtraidos.includes(n));

  console.log('\n' + '='.repeat(70));
  console.log('📈 ESTATÍSTICAS:');
  console.log('='.repeat(70));
  console.log(`Total esperado:     193 artigos`);
  console.log(`Total extraído:     ${numerosExtraidos.length} artigos`);
  console.log(`Taxa de sucesso:    ${((numerosExtraidos.length / 193) * 100).toFixed(1)}%`);
  console.log(`Artigos faltando:   ${faltando.length} artigos`);
  console.log('='.repeat(70));

  if (faltando.length > 0) {
    console.log('\n⚠️  ARTIGOS NÃO EXTRAÍDOS:');
    console.log('-'.repeat(70));

    // Agrupar por sequências
    const grupos: number[][] = [];
    let grupoAtual: number[] = [];

    faltando.forEach((num, i) => {
      if (i === 0 || num !== faltando[i - 1] + 1) {
        if (grupoAtual.length > 0) grupos.push(grupoAtual);
        grupoAtual = [num];
      } else {
        grupoAtual.push(num);
      }
    });
    if (grupoAtual.length > 0) grupos.push(grupoAtual);

    grupos.forEach(grupo => {
      if (grupo.length === 1) {
        console.log(`Art. ${grupo[0]}º`);
      } else {
        console.log(`Art. ${grupo[0]}º a ${grupo[grupo.length - 1]}º (${grupo.length} artigos)`);
      }
    });
  } else {
    console.log('\n🎉 PERFEITO! Todos os 193 artigos foram extraídos!');
  }

  console.log('\n' + '='.repeat(70));
  console.log('📋 PRIMEIROS 20 ARTIGOS EXTRAÍDOS:');
  console.log('='.repeat(70));
  console.log(numerosExtraidos.slice(0, 20).join(', '));

  console.log('\n' + '='.repeat(70));
  console.log('📋 ÚLTIMOS 20 ARTIGOS EXTRAÍDOS:');
  console.log('='.repeat(70));
  console.log(numerosExtraidos.slice(-20).join(', '));
}

main()
  .then(() => console.log('\n✅ Verificação concluída\n'))
  .catch(error => {
    console.error('\n❌ Erro:', error);
    process.exit(1);
  });
