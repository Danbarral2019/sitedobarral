/**
 * Script para extrair TODOS os artigos da Lei 14.133/2021 do Planalto
 * Usa Playwright MCP para extrair em lotes e salva no banco de dados
 */

import { prisma } from '@/lib/prisma';

interface ArtigoExtraido {
  numero: string;
  texto: string;
}

/**
 * Extrai artigos em lotes do navegador
 * NOTA: Este script deve ser executado com Playwright MCP ativo
 * Use: mcp__playwright__browser_evaluate para extrair os artigos
 */
async function extractArticlesBatch(startIndex: number, endIndex: number): Promise<ArtigoExtraido[]> {
  console.log(`📄 Extraindo artigos ${startIndex} a ${endIndex}...`);

  // Esta função será chamada via Playwright MCP
  // Por enquanto, retorna array vazio - deve ser preenchido via MCP
  return [];
}

async function saveArticleToDatabase(artigo: ArtigoExtraido) {
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
      // Atualizar artigo existente
      await prisma.legislativeAct.update({
        where: { id: existing.id },
        data: {
          fullText: artigo.texto,
          updatedAt: new Date(),
        },
      });

      console.log(`✅ Artigo ${artigo.numero} atualizado`);
      return { action: 'updated' };
    } else {
      // Criar novo artigo
      await prisma.legislativeAct.create({
        data: {
          lawNumber: '14133',
          lawYear: 2021,
          articleNumber: numeroArtigo,
          articleLabel: `Art. ${artigo.numero}º`,
          title: `Artigo ${artigo.numero}`,
          fullText: artigo.texto,
          summary: artigo.texto.substring(0, 200) + '...',
          isActive: true,
        },
      });

      console.log(`🆕 Artigo ${artigo.numero} criado`);
      return { action: 'created' };
    }
  } catch (error) {
    console.error(`❌ Erro no artigo ${artigo.numero}:`, error);
    return { action: 'error', error };
  }
}

/**
 * Processa artigos extraídos do Playwright MCP
 */
export async function processExtractedArticles(artigos: ArtigoExtraido[]) {
  console.log(`\n📊 Processando ${artigos.length} artigos...\n`);

  let atualizados = 0;
  let novos = 0;
  let erros = 0;

  for (const artigo of artigos) {
    const result = await saveArticleToDatabase(artigo);

    if (result.action === 'updated') atualizados++;
    else if (result.action === 'created') novos++;
    else erros++;
  }

  console.log('\n' + '='.repeat(70));
  console.log('📊 RESUMO DO PROCESSAMENTO:');
  console.log('='.repeat(70));
  console.log(`✅ Atualizados: ${atualizados}`);
  console.log(`🆕 Novos: ${novos}`);
  console.log(`❌ Erros: ${erros}`);
  console.log(`📝 Total processado: ${artigos.length}`);
  console.log('='.repeat(70));

  return { atualizados, novos, erros };
}

async function main() {
  console.log('🚀 Extração Completa da Lei 14.133/2021 - Site do Planalto\n');
  console.log('='.repeat(70));
  console.log('\n⚠️  Este script requer Playwright MCP ativo!');
  console.log('⚠️  Execute os comandos manualmente via Claude Code:\n');
  console.log('1. Navegue: https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm');
  console.log('2. Use browser_evaluate para extrair artigos em lotes');
  console.log('3. Chame processExtractedArticles() com os artigos extraídos\n');
  console.log('='.repeat(70));
}

// Se executado diretamente, mostra instruções
if (require.main === module) {
  main()
    .then(() => console.log('\n✅ Script finalizado'))
    .catch((error) => {
      console.error('\n❌ Erro:', error);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}

// Exportar funções para uso via Claude Code
export { saveArticleToDatabase };
