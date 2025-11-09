/**
 * Script de migração: Lei 14.133/2021 - Arquivo TypeScript → Banco de Dados
 *
 * Este script importa os 193 artigos do arquivo lei-14133-artigos.ts
 * para a tabela LeiArticle no banco de dados.
 *
 * Uso: npx tsx scripts/migrate-lei-14133-to-db.ts
 */

import { PrismaClient } from '@prisma/client';
import { LEI_14133_ARTIGOS } from '../data/lei-14133-artigos';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Iniciando migração Lei 14.133/2021 → Banco de Dados\n');

  const artigos = Object.entries(LEI_14133_ARTIGOS);
  console.log(`📊 Total de artigos a migrar: ${artigos.length}\n`);

  let importados = 0;
  let atualizados = 0;
  let erros = 0;

  for (const [numero, artigo] of artigos) {
    try {
      // Tentar encontrar artigo existente
      const existente = await prisma.leiArticle.findUnique({
        where: { numero },
      });

      if (existente) {
        // Atualizar artigo existente
        await prisma.leiArticle.update({
          where: { numero },
          data: {
            titulo: artigo.titulo || null,
            capituloCompleto: artigo.capituloCompleto || null,
            ementa: artigo.ementa,
            capitulo: artigo.capitulo,
            secao: artigo.secao || null,
          },
        });
        atualizados++;
        console.log(`✓ Atualizado: Art. ${numero}`);
      } else {
        // Criar novo artigo
        await prisma.leiArticle.create({
          data: {
            numero,
            titulo: artigo.titulo || null,
            capituloCompleto: artigo.capituloCompleto || null,
            ementa: artigo.ementa,
            capitulo: artigo.capitulo,
            secao: artigo.secao || null,
          },
        });
        importados++;
        console.log(`✓ Importado: Art. ${numero}`);
      }
    } catch (error) {
      erros++;
      console.error(`✗ Erro no Art. ${numero}:`, error instanceof Error ? error.message : error);
    }
  }

  console.log('\n📊 Resumo da Migração:');
  console.log(`   ✅ Importados: ${importados}`);
  console.log(`   🔄 Atualizados: ${atualizados}`);
  console.log(`   ❌ Erros: ${erros}`);
  console.log(`   📝 Total: ${artigos.length}`);

  // Verificar contagem final no banco
  const totalNoBanco = await prisma.leiArticle.count();
  console.log(`\n✅ Total de artigos no banco: ${totalNoBanco}`);

  if (totalNoBanco === artigos.length) {
    console.log('🎉 Migração concluída com sucesso!');
  } else {
    console.log(`⚠️  Atenção: Esperado ${artigos.length}, mas encontrado ${totalNoBanco} no banco`);
  }
}

main()
  .catch((e) => {
    console.error('\n❌ Erro durante migração:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
