/**
 * Mostra conteúdo completo de artigos específicos extraídos
 */

// @ts-expect-error Module was renamed to .DISABLED to prevent accidental execution
import { downloadLeiHTML, extractArticlesFromHTML } from './update-lei-14133-data-file';

async function showArticles(numeros: number[]) {
  const html = await downloadLeiHTML();
  const artigos = extractArticlesFromHTML(html);

  console.log('📄 CONTEÚDO DOS ARTIGOS EXTRAÍDOS\n');
  console.log('='.repeat(70));

  for (const num of numeros) {
    const artigo = artigos.find((a: { numero: string }) => parseInt(a.numero) === num);

    if (artigo) {
      console.log(`\n📌 ARTIGO ${artigo.numero}:\n`);
      console.log(artigo.texto);
      console.log('\n' + '-'.repeat(70));
      console.log(`Tamanho: ${artigo.texto.length} caracteres`);
    } else {
      console.log(`\n❌ Artigo ${num} não foi extraído!`);
    }

    console.log('\n' + '='.repeat(70));
  }
}

showArticles([172, 177, 180, 188])
  .then(() => console.log('\n✅ Visualização concluída\n'))
  .catch(error => {
    console.error('\n❌ Erro:', error);
    process.exit(1);
  });
