/**
 * Script para baixar e processar TODOS os artigos da Lei 14.133/2021
 * Usa fetch + regex para extrair artigos diretamente do HTML do Planalto
 */

import { prisma } from '@/lib/prisma';

interface ArtigoExtraido {
  numero: string;
  texto: string;
}

/**
 * Baixa o HTML completo da lei do Planalto
 */
async function downloadLeiHTML(): Promise<string> {
  console.log('📥 Baixando HTML da Lei 14.133/2021...\n');

  const url = 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm';

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    console.log(`✅ HTML baixado com sucesso (${(html.length / 1024).toFixed(2)} KB)\n`);

    return html;
  } catch (error) {
    console.error('❌ Erro ao baixar HTML:', error);
    throw error;
  }
}

/**
 * Extrai todos os artigos do HTML usando regex
 */
function extractArticlesFromHTML(html: string): ArtigoExtraido[] {
  console.log('🔍 Extraindo artigos do HTML...\n');

  const artigos: ArtigoExtraido[] = [];

  // Normalizar quebras de linha e caracteres especiais ANTES de remover tags
  let textoNormalizado = html
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/�/g, 'º'); // Corrigir encoding do símbolo grau

  // Remover tags HTML
  textoNormalizado = textoNormalizado
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

  // Regex mais flexível para capturar artigos
  // Formato: "Art." + espaços + número + opcional(º/°) + texto
  const regexArtigo = /Art\.\s+(\d+)\s*[ºº°]?\s+([\s\S]*?)(?=\s+Art\.\s+\d+\s*[ºº°]?|\s+CAPÍTULO|\s+SEÇÃO|\s+TÍTULO|$)/gi;

  let match;
  while ((match = regexArtigo.exec(textoNormalizado)) !== null) {
    const numero = match[1];
    const textoArtigo = match[2].trim();

    // Validar: apenas artigos de 1 a 193
    const num = parseInt(numero);
    if (num >= 1 && num <= 193 && textoArtigo.length > 10) {
      // Limpar texto
      const textoLimpo = textoArtigo
        .replace(/\s+/g, ' ')
        .replace(/\s+\./g, '.')
        .replace(/\s+,/g, ',')
        .replace(/\s+;/g, ';')
        .replace(/\s+-/g, ' -')
        .trim();

      artigos.push({
        numero: numero,
        texto: `Art. ${numero}º ${textoLimpo}`,
      });
    }
  }

  // Remover duplicatas (manter primeira ocorrência)
  const artigosUnicos = artigos.filter((artigo, index, self) =>
    index === self.findIndex(a => a.numero === artigo.numero)
  );

  console.log(`✅ ${artigosUnicos.length} artigos extraídos\n`);

  return artigosUnicos;
}

/**
 * Salva ou atualiza artigo no banco de dados
 */
async function saveArticle(artigo: ArtigoExtraido): Promise<'created' | 'updated' | 'error'> {
  try {
    const numeroArtigo = parseInt(artigo.numero);

    // Buscar artigo existente
    const existing = await prisma.legislativeAct.findFirst({
      where: {
        lawNumber: '14133',
        lawYear: 2021,
        articleNumber: numeroArtigo,
      },
    });

    if (existing) {
      // Atualizar apenas se o texto mudou
      if (existing.fullText !== artigo.texto) {
        await prisma.legislativeAct.update({
          where: { id: existing.id },
          data: {
            fullText: artigo.texto,
            updatedAt: new Date(),
          },
        });
        return 'updated';
      }
      return 'updated'; // Não mudou, mas considerar como atualizado
    } else {
      // Criar novo artigo
      await prisma.legislativeAct.create({
        data: {
          lawNumber: '14133',
          lawYear: 2021,
          articleNumber: numeroArtigo,
          articleLabel: `Art. ${artigo.numero}º`,
          title: `Lei 14.133/2021 - Artigo ${artigo.numero}`,
          fullText: artigo.texto,
          summary: artigo.texto.substring(0, 200) + (artigo.texto.length > 200 ? '...' : ''),
          isActive: true,
        },
      });
      return 'created';
    }
  } catch (error) {
    console.error(`❌ Erro no artigo ${artigo.numero}:`, error);
    return 'error';
  }
}

/**
 * Processa todos os artigos e salva no banco
 */
async function processAndSaveArticles(artigos: ArtigoExtraido[]) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📊 PROCESSANDO ${artigos.length} ARTIGOS`);
  console.log('='.repeat(70));
  console.log();

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const artigo of artigos) {
    const result = await saveArticle(artigo);

    if (result === 'created') {
      console.log(`🆕 Art. ${artigo.numero}º criado`);
      created++;
    } else if (result === 'updated') {
      console.log(`✅ Art. ${artigo.numero}º atualizado`);
      updated++;
    } else {
      errors++;
    }
  }

  console.log();
  console.log('='.repeat(70));
  console.log('📊 RESUMO FINAL');
  console.log('='.repeat(70));
  console.log(`🆕 Criados:     ${created}`);
  console.log(`✅ Atualizados: ${updated}`);
  console.log(`❌ Erros:       ${errors}`);
  console.log(`📝 Total:       ${artigos.length}`);
  console.log('='.repeat(70));

  return { created, updated, errors, total: artigos.length };
}

/**
 * Função principal
 */
async function main() {
  console.clear();
  console.log('🚀 SCRAPER COMPLETO - LEI 14.133/2021');
  console.log('='.repeat(70));
  console.log();

  try {
    // 1. Baixar HTML
    const html = await downloadLeiHTML();

    // 2. Extrair artigos
    const artigos = extractArticlesFromHTML(html);

    if (artigos.length === 0) {
      console.error('❌ Nenhum artigo foi extraído!');
      console.error('Verifique a estrutura do HTML ou a conexão com o site.');
      process.exit(1);
    }

    // 3. Mostrar preview
    console.log('📄 PREVIEW DOS PRIMEIROS 5 ARTIGOS:');
    console.log('-'.repeat(70));
    artigos.slice(0, 5).forEach(art => {
      console.log(`\nArt. ${art.numero}º:`);
      console.log(art.texto.substring(0, 150) + '...');
    });
    console.log('\n' + '-'.repeat(70) + '\n');

    // 4. Processar e salvar
    const result = await processAndSaveArticles(artigos);

    // 5. Resultado final
    console.log();
    if (result.errors === 0) {
      console.log('🎉 SUCESSO! Todos os artigos foram processados.');
    } else {
      console.log(`⚠️  Concluído com ${result.errors} erro(s).`);
    }

  } catch (error) {
    console.error('\n❌ ERRO FATAL:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar
if (require.main === module) {
  main()
    .then(() => {
      console.log('\n✅ Script finalizado\n');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Erro:', error);
      process.exit(1);
    });
}

export { downloadLeiHTML, extractArticlesFromHTML, saveArticle };
