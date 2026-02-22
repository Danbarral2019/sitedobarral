/**
 * Debug de artigos específicos que não foram extraídos
 */

// @ts-expect-error Module was renamed to .DISABLED to prevent accidental execution
import { downloadLeiHTML } from './update-lei-14133-data-file';

async function debugArticles(numeros: number[]) {
  const html = await downloadLeiHTML();

  console.log('🔍 DEBUGGING ARTIGOS ESPECÍFICOS\n');
  console.log('='.repeat(70));

  for (const num of numeros) {
    console.log(`\n📄 ARTIGO ${num}:\n`);

    // Encontrar posição no HTML original
    const regex = new RegExp(`Art\\.\\s+${num}\\s*[ºº°]?[\\s\\S]{0,500}`, 'i');
    const match = html.match(regex);

    if (match) {
      console.log('HTML ORIGINAL:');
      console.log('-'.repeat(70));
      console.log(match[0].substring(0, 400));
      console.log('...');
      console.log('-'.repeat(70));
    } else {
      console.log('❌ Não encontrado no HTML!');
    }

    console.log('\n' + '='.repeat(70));
  }
}

debugArticles([172, 177, 180, 188])
  .then(() => console.log('\n✅ Debug concluído\n'))
  .catch(error => {
    console.error('\n❌ Erro:', error);
    process.exit(1);
  });
