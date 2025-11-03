/**
 * Script de Importação - Documentos AGU
 *
 * Importa ONs e Súmulas da AGU do arquivo agu-scraper-v4-import.json
 * Trata corretamente documentos com múltiplos cursos
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Carregar variáveis de ambiente do .env.local
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

import { prisma } from '../lib/prisma';
import * as fs from 'fs/promises';

interface AGUDocumentImport {
  title: string;
  description: string;
  category: string;
  type: 'pdf' | 'link' | 'video' | 'doc';
  url: string;
  tags?: string[];
  isPublic: boolean;
  courseIds: string[];
  onNumber?: number;
  onYear?: number;
  entityType?: string;
  enunciadoNumber?: string;
}

interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  errorDetails: string[];
}

async function main() {
  console.log('='.repeat(80));
  console.log('IMPORTAÇÃO DE DOCUMENTOS AGU');
  console.log('='.repeat(80));
  console.log('');

  const mode = process.argv[2] || 'incremental'; // 'incremental' ou 'full'
  console.log(`Modo: ${mode}`);
  console.log('');

  // Ler o arquivo JSON
  const fileContent = await fs.readFile('agu-scraper-v4-import.json', 'utf-8');
  const documents: AGUDocumentImport[] = JSON.parse(fileContent);

  console.log(`📄 Total de documentos no arquivo: ${documents.length}`);
  console.log('');

  const startTime = Date.now();
  const result: ImportResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    errorDetails: []
  };

  // Estatísticas
  let totalRelevance = 0;
  let relevanceCount = 0;

  for (const doc of documents) {
    try {
      // Para cada documento que tem múltiplos cursos, criar um registro para cada curso
      // OU se for comum a todos, criar um único registro com isCommon=true

      const isCommonDoc = doc.courseIds.length > 3; // Se tem mais de 3 cursos, marca como comum

      if (isCommonDoc) {
        // Documento comum a todos os cursos
        await processDocument({
          ...doc,
          courseId: null,
          isCommon: true
        }, mode, result);
      } else {
        // Criar um documento para cada curso
        for (const courseId of doc.courseIds) {
          await processDocument({
            ...doc,
            courseId,
            isCommon: false
          }, mode, result);
        }
      }

    } catch (error) {
      result.errors++;
      const errorMsg = `${doc.title}: ${error instanceof Error ? error.message : String(error)}`;
      result.errorDetails.push(errorMsg);
      console.error(`❌ ${errorMsg}`);
    }
  }

  const endTime = Date.now();
  const executionTime = (endTime - startTime) / 1000;

  // Estatísticas finais
  console.log('\n');
  console.log('='.repeat(80));
  console.log('✅ Importação Concluída com Sucesso!');
  console.log('='.repeat(80));
  console.log(`${result.created.toString().padStart(4)} Criados`);
  console.log(`${result.updated.toString().padStart(4)} Atualizados`);
  console.log(`${result.skipped.toString().padStart(4)} Pulados`);
  console.log(`${result.errors.toString().padStart(4)} Erros`);
  console.log(`Modo: ${mode}`);
  console.log('');

  if (relevanceCount > 0) {
    console.log(`Relevância média: ${(totalRelevance / relevanceCount).toFixed(1)}/100`);
    console.log('');
  }

  console.log(`Tempo de execução: ${executionTime.toFixed(2)}s`);
  console.log('');

  if (result.errorDetails.length > 0 && result.errorDetails.length <= 10) {
    console.log('Detalhes dos erros:');
    result.errorDetails.forEach(err => console.log(`  - ${err}`));
    console.log('');
  } else if (result.errorDetails.length > 10) {
    console.log(`Muitos erros (${result.errorDetails.length}). Primeiros 10:`);
    result.errorDetails.slice(0, 10).forEach(err => console.log(`  - ${err}`));
    console.log('');
  }

  await prisma.$disconnect();
}

async function processDocument(
  doc: AGUDocumentImport & { courseId: string | null; isCommon: boolean },
  mode: string,
  result: ImportResult
) {
  // Identificador único baseado em:
  // - ONs: onNumber + onYear + courseId
  // - Súmulas: title + courseId
  const isON = doc.category === 'orientacao-normativa';
  const isSumula = doc.category === 'sumula';

  let existingDoc = null;

  if (isON && doc.onNumber && doc.onYear) {
    // Buscar ON existente por número, ano e curso
    existingDoc = await prisma.document.findFirst({
      where: {
        onNumber: doc.onNumber,
        onYear: doc.onYear,
        courseId: doc.courseId,
      }
    });
  } else if (isSumula) {
    // Buscar Súmula por título e curso
    existingDoc = await prisma.document.findFirst({
      where: {
        title: doc.title,
        courseId: doc.courseId,
        category: 'sumula'
      }
    });
  } else {
    // Buscar por título e curso
    existingDoc = await prisma.document.findFirst({
      where: {
        title: doc.title,
        courseId: doc.courseId,
      }
    });
  }

  if (existingDoc) {
    if (mode === 'incremental') {
      // Não atualizar, apenas pular
      result.skipped++;
      return;
    } else {
      // Atualizar documento existente
      await prisma.document.update({
        where: { id: existingDoc.id },
        data: {
          description: doc.description,
          url: doc.url,
          tags: JSON.stringify(doc.tags || []),
          isPublic: doc.isPublic,
          onNumber: doc.onNumber,
          onYear: doc.onYear,
          entityType: doc.entityType,
          enunciadoNumber: doc.enunciadoNumber,
          updatedAt: new Date(),
        }
      });
      result.updated++;
      return;
    }
  } else {
    // Criar novo documento
    await prisma.document.create({
      data: {
        title: doc.title,
        description: doc.description,
        type: doc.type,
        url: doc.url,
        category: doc.category,
        courseId: doc.courseId,
        isCommon: doc.isCommon,
        isPublic: doc.isPublic,
        tags: JSON.stringify(doc.tags || []),
        leiArticles: '[]',
        onNumber: doc.onNumber,
        onYear: doc.onYear,
        entityType: doc.entityType,
        enunciadoNumber: doc.enunciadoNumber,
        reviewed: false,
      }
    });
    result.created++;
  }
}

main()
  .catch((error) => {
    console.error('Erro fatal:', error);
    process.exit(1);
  });
