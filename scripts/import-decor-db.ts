/**
 * Script para importar Pareceres DECOR relevantes no banco de dados
 *
 * Lê decor-relevantes.json e importa usando sistema de versionamento
 */

import { prisma } from '@/lib/prisma';
import { readFileSync } from 'fs';
import { join } from 'path';

interface DecorRelevante {
  numeroCompleto: string;
  assunto: string;
  ementa: string;
  urlDocumento: string;
  relevanciaScore: number;
  isRelevante: boolean;
  cursosRelevantes: string[];
  razaoRelevancia: string;
}

/**
 * Importa um parecer DECOR no banco com tags e categorias
 */
async function importDecor(decor: DecorRelevante) {
  try {
    console.log(`\n📝 Processando: ${decor.numeroCompleto}`);
    console.log(`   Relevância: ${decor.relevanciaScore}/100`);
    console.log(`   Cursos: ${decor.cursosRelevantes.join(', ') || 'Nenhum'}`);

    // Mapear IDs de curso para nomes
    const courseNames: Record<string, string> = {
      '1': 'Nova Lei de Licitações',
      '2': 'Planejamento das Contratações',
      '3': 'Gestão e Fiscalização de Contratos',
      '4': 'Processo Sancionador',
      '7': 'Assessoramento Jurídico',
    };

    const tags = decor.cursosRelevantes.map(id => courseNames[id] || `Curso ${id}`);

    // Preparar dados para o banco
    const documentData = {
      title: `DECOR ${decor.numeroCompleto} - ${decor.assunto.substring(0, 100)}`,
      description: decor.ementa.substring(0, 500),
      type: 'link' as const,
      url: decor.urlDocumento || 'https://cgu.agu.gov.br/decor/',
      category: 'decor',
      isPublic: false,

      // Tags como JSON
      tags: JSON.stringify(tags),

      // Conteúdo completo
      content: `DECOR ${decor.numeroCompleto}\n\nASSUNTO:\n${decor.assunto}\n\nEMENTA:\n${decor.ementa}\n\nRELEVÂNCIA: ${decor.razaoRelevancia}`,

      // Análise de IA
      aiClassification: JSON.stringify({
        category: 'decor',
        courses: decor.cursosRelevantes,
        relevanceScore: decor.relevanciaScore,
        reasoning: decor.razaoRelevancia,
        confidence: decor.relevanciaScore >= 80 ? 'high' : decor.relevanciaScore >= 60 ? 'medium' : 'low',
      }),
    };

    // Verificar se já existe (buscar por título único)
    const existing = await prisma.document.findFirst({
      where: {
        title: {
          contains: decor.numeroCompleto,
        },
        category: 'decor',
      },
    });

    let result;
    if (existing) {
      // Atualizar se já existe
      result = await prisma.document.update({
        where: { id: existing.id },
        data: documentData,
      });
      console.log(`   🔄 Documento ATUALIZADO: ${result.id}`);
    } else {
      // Criar novo
      result = await prisma.document.create({
        data: documentData,
      });
      console.log(`   ✅ NOVO documento criado: ${result.id}`);
    }

    return { success: true, document: result, isNew: !existing };
  } catch (error) {
    console.error(`   ❌ Erro ao processar ${decor.numeroCompleto}:`, error);
    return { success: false, error };
  }
}

/**
 * Importa todos os pareceres DECOR relevantes
 */
async function main() {
  console.log('🚀 Iniciando importação de Pareceres DECOR\n');

  // 1. Ler arquivo JSON com pareceres relevantes
  const inputPath = join(process.cwd(), 'data', 'decor-relevantes.json');
  const decorRelevantes: DecorRelevante[] = JSON.parse(readFileSync(inputPath, 'utf-8'));

  console.log(`📊 Total de pareceres DECOR a importar: ${decorRelevantes.length}\n`);

  let sucessos = 0;
  let erros = 0;
  let novos = 0;
  let atualizados = 0;

  for (const decor of decorRelevantes) {
    const result = await importDecor(decor);

    if (result.success) {
      sucessos++;
      if (result.isNew) {
        novos++;
      } else {
        atualizados++;
      }
    } else {
      erros++;
    }

    // Pequeno delay para não sobrecarregar o banco
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n' + '='.repeat(60));
  console.log('📈 Resumo da Importação');
  console.log('='.repeat(60));
  console.log(`✅ Sucessos: ${sucessos}/${decorRelevantes.length}`);
  console.log(`🆕 Novos: ${novos}`);
  console.log(`🔄 Atualizados: ${atualizados}`);
  console.log(`❌ Erros: ${erros}`);
  console.log('='.repeat(60));

  // Estatísticas por categoria
  console.log('\n📊 Estatísticas no Banco:');
  const stats = await prisma.document.groupBy({
    by: ['category'],
    where: {
      category: 'decor',
    },
    _count: true,
  });

  for (const stat of stats) {
    console.log(`   ${stat.category}: ${stat._count} documentos`);
  }

  console.log('\n✅ Importação concluída com sucesso!');
}

main()
  .catch(error => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
