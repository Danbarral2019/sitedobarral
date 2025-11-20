/**
 * Script para importar Pareceres Vinculantes relevantes no banco de dados
 *
 * Lê pareceres-vinculantes-relevantes.json e importa usando sistema de versionamento
 */

import { prisma } from '@/lib/prisma';
import { readFileSync } from 'fs';
import { join } from 'path';

interface ParecerRelevante {
  numeroCompleto: string;
  prefixo: string;
  numero: string;
  assunto: string;
  ementa: string;
  relevanciaScore: number;
  isRelevante: boolean;
  cursosRelevantes: string[];
  razaoRelevancia: string;
}

/**
 * Importa um parecer vinculante no banco com tags e categorias
 */
async function importParecer(parecer: ParecerRelevante) {
  try {
    console.log(`\n📝 Processando: ${parecer.numeroCompleto}`);
    console.log(`   Relevância: ${parecer.relevanciaScore}/100`);
    console.log(`   Cursos: ${parecer.cursosRelevantes.join(', ') || 'Nenhum'}`);

    // Mapear IDs de curso para nomes
    const courseNames: Record<string, string> = {
      '1': 'Nova Lei de Licitações',
      '3': 'Gestão e Fiscalização de Contratos',
      '4': 'Processo Sancionador',
      '7': 'Assessoramento Jurídico'
    };

    const tags = parecer.cursosRelevantes.map(id => courseNames[id] || `Curso ${id}`);

    // Preparar dados para o banco
    const documentData = {
      title: `Parecer Vinculante ${parecer.numeroCompleto} - ${parecer.assunto.substring(0, 100)}`,
      description: parecer.ementa,
      type: 'link' as const,
      url: 'https://siscon.agu.gov.br/consultivo/vinculantes/',
      category: 'parecer-vinculante',
      isPublic: false,

      // Tags como JSON
      tags: JSON.stringify(tags),

      // Conteúdo completo
      content: `PARECER VINCULANTE ${parecer.numeroCompleto}\n\nASSUNTO:\n${parecer.assunto}\n\nEMENTA:\n${parecer.ementa}\n\nRELEVÂNCIA: ${parecer.razaoRelevancia}`,

      // Análise de IA
      aiClassification: JSON.stringify({
        category: 'parecer-vinculante',
        courses: parecer.cursosRelevantes,
        relevanceScore: parecer.relevanciaScore,
        reasoning: parecer.razaoRelevancia,
        confidence: parecer.relevanciaScore >= 80 ? 'high' : parecer.relevanciaScore >= 60 ? 'medium' : 'low'
      })
    };

    // Verificar se já existe (buscar por título único)
    const existing = await prisma.document.findFirst({
      where: {
        title: {
          contains: parecer.numeroCompleto
        },
        category: 'parecer-vinculante'
      }
    });

    let result;
    if (existing) {
      // Atualizar se já existe
      result = await prisma.document.update({
        where: { id: existing.id },
        data: documentData
      });
      console.log(`   🔄 Documento ATUALIZADO: ${result.id}`);
    } else {
      // Criar novo
      result = await prisma.document.create({
        data: documentData
      });
      console.log(`   ✅ NOVO documento criado: ${result.id}`);
    }

    return { success: true, document: result, isNew: !existing };

  } catch (error) {
    console.error(`   ❌ Erro ao processar ${parecer.numeroCompleto}:`, error);
    return { success: false, error };
  }
}

/**
 * Importa todos os pareceres relevantes
 */
async function main() {
  console.log('🚀 Iniciando importação de Pareceres Vinculantes\n');

  // 1. Ler arquivo JSON com pareceres relevantes
  const inputPath = join(process.cwd(), 'data', 'pareceres-vinculantes-relevantes.json');
  const pareceresRelevantes: ParecerRelevante[] = JSON.parse(readFileSync(inputPath, 'utf-8'));

  console.log(`📊 Total de pareceres a importar: ${pareceresRelevantes.length}\n`);

  let sucessos = 0;
  let erros = 0;
  let novos = 0;
  let atualizados = 0;

  for (const parecer of pareceresRelevantes) {
    const result = await importParecer(parecer);

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
  console.log(`✅ Sucessos: ${sucessos}/${pareceresRelevantes.length}`);
  console.log(`🆕 Novos: ${novos}`);
  console.log(`🔄 Atualizados: ${atualizados}`);
  console.log(`❌ Erros: ${erros}`);
  console.log('='.repeat(60));

  // Estatísticas por categoria
  console.log('\n📊 Estatísticas no Banco:');
  const stats = await prisma.document.groupBy({
    by: ['category'],
    where: {
      category: 'parecer-vinculante'
    },
    _count: true
  });

  for (const stat of stats) {
    console.log(`   ${stat.category}: ${stat._count} documentos`);
  }

  console.log('\n✅ Importação concluída com sucesso!');
}

main()
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
