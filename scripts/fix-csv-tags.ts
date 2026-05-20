/**
 * Script de Migração - Corrige Tags em Formato CSV
 *
 * Converte tags e leiArticles de formato CSV para JSON no banco de dados
 * Exemplo: "AGU,Súmula,Súmula 86" -> ["AGU","Súmula","Súmula 86"]
 */

// IMPORTANTE: Carregar dotenv ANTES de qualquer import que use env vars
import * as dotenv from 'dotenv';
import * as path from 'path';

const envPath = path.join(__dirname, '..', '.env.local');
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('❌ Erro ao carregar .env.local:', result.error);
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL não encontrada no ambiente');
  process.exit(1);
}

console.log('✅ Variáveis de ambiente carregadas de:', envPath);

import { prisma } from '../lib/prisma';

interface MigrationStats {
  total: number;
  tagsFixed: number;
  leiArticlesFixed: number;
  errors: number;
}

/**
 * Verifica se uma string está em formato CSV (não é JSON válido)
 */
function isCsvFormat(value: string): boolean {
  try {
    JSON.parse(value);
    return false; // É JSON válido
  } catch {
    return true; // Não é JSON, pode ser CSV
  }
}

/**
 * Converte CSV para JSON array
 */
function csvToJsonArray(value: string): string {
  const items = value
    .split(',')
    .map(item => item.trim())
    .filter(item => item.length > 0);

  return JSON.stringify(items);
}

async function main() {
  console.log('='.repeat(80));
  console.log('MIGRAÇÃO: TAGS CSV → JSON');
  console.log('='.repeat(80));
  console.log('');

  const stats: MigrationStats = {
    total: 0,
    tagsFixed: 0,
    leiArticlesFixed: 0,
    errors: 0
  };

  try {
    // Buscar todos os documentos
    const documents = await prisma.document.findMany({
      select: {
        id: true,
        title: true,
        tags: true,
        leiArticlesArr: true
      }
    });

    stats.total = documents.length;
    console.log(`📄 Total de documentos encontrados: ${stats.total}`);
    console.log('');

    // Processar cada documento
    for (const doc of documents) {
      let needsUpdate = false;
      const updates: { tags?: string; leiArticles?: string } = {};

      // Verificar tags
      if (doc.tags && isCsvFormat(doc.tags)) {
        const jsonTags = csvToJsonArray(doc.tags);
        updates.tags = jsonTags;
        stats.tagsFixed++;
        needsUpdate = true;
        console.log(`✅ Tags corrigidas: ${doc.title.substring(0, 50)}`);
        console.log(`   Antes: ${doc.tags.substring(0, 80)}`);
        console.log(`   Depois: ${jsonTags}`);
      }

      // Verificar leiArticles
      if (doc.leiArticles && isCsvFormat(doc.leiArticles)) {
        const jsonArticles = csvToJsonArray(doc.leiArticles);
        updates.leiArticles = jsonArticles;
        stats.leiArticlesFixed++;
        needsUpdate = true;
        console.log(`✅ Lei Articles corrigidos: ${doc.title.substring(0, 50)}`);
        console.log(`   Antes: ${doc.leiArticles.substring(0, 80)}`);
        console.log(`   Depois: ${jsonArticles}`);
      }

      // Atualizar documento se necessário
      if (needsUpdate) {
        try {
          await prisma.document.update({
            where: { id: doc.id },
            data: updates
          });
        } catch (error) {
          stats.errors++;
          console.error(`❌ Erro ao atualizar documento ${doc.id}:`, error);
        }
      }
    }

    console.log('');
    console.log('='.repeat(80));
    console.log('✅ MIGRAÇÃO CONCLUÍDA');
    console.log('='.repeat(80));
    console.log(`Total de documentos: ${stats.total}`);
    console.log(`Tags corrigidas: ${stats.tagsFixed}`);
    console.log(`Lei Articles corrigidos: ${stats.leiArticlesFixed}`);
    console.log(`Erros: ${stats.errors}`);
    console.log('');

  } catch (error) {
    console.error('❌ Erro fatal na migração:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error('Erro fatal:', error);
    process.exit(1);
  });
