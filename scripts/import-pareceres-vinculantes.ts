/**
 * Script para importar Pareceres Vinculantes extraídos via Playwright MCP
 *
 * Este script processa os dados extraídos e salva no banco de dados
 * usando o sistema de versionamento automático.
 */

import { prisma } from '@/lib/prisma';
import { findOrCreateWithVersioning } from '@/lib/agu-modules/versioning';
import type { AGUDocument } from '@/lib/agu-types';

/**
 * Análise de relevância simplificada para pareceres vinculantes
 */
function analyzeRelevance(doc: AGUDocument): AGUDocument {
  // Retorna o próprio documento (relevância já definida na conversão)
  return doc;
}

interface ParecerExtracted {
  numeroCompleto: string;
  prefixo: string;
  numero: string;
  assunto: string;
  ementa: string;
}

/**
 * Dados extraídos via Playwright MCP
 *
 * Para extrair mais pareceres:
 * 1. Navegar para: https://siscon.agu.gov.br/consultivo/vinculantes/
 * 2. Clicar em "Avançar página" (ref=e52)
 * 3. Executar o script de extração novamente
 * 4. Adicionar os novos pareceres a este array
 */
const pareceresExtraidos: ParecerExtracted[] = [
  {
    numeroCompleto: "JM-10",
    prefixo: "JM",
    numero: "10",
    assunto: "termo inicial licenças maternidade e paternidade em caso de internação",
    ementa: "EMENTA: DIREITO ADMINISTRATIVO E CONSTITUCIONAL. LICENÇA-MATERNIDADE E LICENÇA-PATERNIDADE. TERMO INICIAL EM CASO DE INTERNAÇÃO DA MÃE E/OU DO RECÉM NASCIDO..."
  },
  {
    numeroCompleto: "JM-09",
    prefixo: "JM",
    numero: "09",
    assunto: "A mãe servidora ou trabalhadora não gestante em união homoafetiva tem direito ao gozo de licença-maternidade...",
    ementa: "DIREITO ADMINISTRATIVO E CONSTITUCIONAL. RECURSO EXTRAORDINÁRIO Nº 1.211.446 COM REPERCUSSÃO GERAL RECONHECIDA. TEMA 1.072..."
  },
  // ... adicionar mais pareceres conforme extraídos
];

/**
 * Converte parecer extraído para formato AGUDocument
 */
function convertParecerToAGUDocument(parecer: ParecerExtracted): AGUDocument {
  // Assumir ano 2024 (mais recentes são JM, antigos podem ter outros prefixos)
  const ano = 2024;

  return {
    tipo: 'parecer-vinculante',
    numero: parecer.numero,
    ano: ano,
    titulo: `Parecer Vinculante ${parecer.numeroCompleto} - ${parecer.assunto.substring(0, 100)}`,
    descricao: parecer.ementa,
    url: 'https://siscon.agu.gov.br/consultivo/vinculantes/',
    urlPDF: undefined,
    dataPublicacao: undefined,
    tags: [],
    isRelevante: true,
    relevanciaScore: 0,
    temas: [],
    cursosIds: [],
  };
}

/**
 * Importa um parecer vinculante no banco com versionamento
 */
async function importParecer(parecer: ParecerExtracted) {
  try {
    console.log(`\n📝 Processando: ${parecer.numeroCompleto}`);

    // 1. Converter para AGUDocument
    const aguDoc = convertParecerToAGUDocument(parecer);

    // 2. Analisar relevância para cursos
    const analyzed = analyzeRelevance(aguDoc);

    console.log(`   Relevância: ${analyzed.relevanciaScore}/100`);
    console.log(`   Cursos: ${analyzed.cursosIds.join(', ') || 'Nenhum'}`);

    // 3. Preparar dados para o banco
    const documentData = {
      title: analyzed.titulo,
      description: analyzed.descricao,
      type: 'link' as const,
      url: analyzed.url,
      category: 'parecer-vinculante',
      isPublic: false,

      // Tags e artigos da Lei 14.133
      tags: JSON.stringify(analyzed.cursosIds.map((id: string) => {
        const courseNames: Record<string, string> = {
          '1': 'Nova Lei de Licitações',
          '4': 'Processo Sancionador',
          '7': 'Assessoramento Jurídico'
        };
        return courseNames[id] || `Curso ${id}`;
      })),

      // Metadados
      content: `${analyzed.descricao}`,

      // Análise de IA
      aiClassification: JSON.stringify({
        category: 'parecer-vinculante',
        courses: analyzed.cursosIds,
        relevanceScore: analyzed.relevanciaScore,
        confidence: analyzed.relevanciaScore >= 70 ? 'high' : analyzed.relevanciaScore >= 40 ? 'medium' : 'low'
      })
    };

    // 4. Salvar com versionamento
    const result = await findOrCreateWithVersioning(
      { title: analyzed.titulo }, // Identificador único
      documentData,
      'scraper-pareceres-vinculantes'
    );

    // 5. Criar relacionamento com cursos
    if (result.isNew) {
      console.log(`   ✅ NOVO documento criado: ${result.document!.id}`);

      // Adicionar aos cursos relevantes
      for (const courseId of analyzed.cursosIds) {
        // Nota: como courseId pode ser null nos documentos,
        // vamos usar tags para relacionamento por enquanto
        console.log(`   📚 Relacionado ao curso: ${courseId}`);
      }
    } else if (result.hasChanges) {
      console.log(`   🔄 Documento ATUALIZADO: ${result.document!.id}`);
    } else {
      console.log(`   ⏭️  Sem mudanças: ${result.document!.id}`);
    }

    return { success: true, document: result.document };

  } catch (error) {
    console.error(`   ❌ Erro ao processar ${parecer.numeroCompleto}:`, error);
    return { success: false, error };
  }
}

/**
 * Importa todos os pareceres
 */
async function main() {
  console.log('🚀 Iniciando importação de Pareceres Vinculantes\n');
  console.log(`📊 Total de pareceres a processar: ${pareceresExtraidos.length}\n`);

  let sucessos = 0;
  let erros = 0;
  let atualizados = 0;
  let semMudancas = 0;

  for (const parecer of pareceresExtraidos) {
    const result = await importParecer(parecer);

    if (result.success && result.document) {
      sucessos++;
      // Verificar se foi atualizado ou novo via versionamento
      const versions = await prisma.documentVersion.count({
        where: { documentId: result.document.id }
      });

      if (versions > 1) {
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
  console.log(`✅ Sucessos: ${sucessos}/${pareceresExtraidos.length}`);
  console.log(`🔄 Atualizados: ${atualizados}`);
  console.log(`⏭️  Sem mudanças: ${sucessos - atualizados}`);
  console.log(`❌ Erros: ${erros}`);
  console.log('='.repeat(60));

  // Estatísticas de versionamento
  console.log('\n📊 Estatísticas de Versionamento:');
  const stats = await prisma.documentVersion.groupBy({
    by: ['changeType'],
    _count: true
  });

  for (const stat of stats) {
    console.log(`   ${stat.changeType}: ${(stat as any)._count}`);
  }

  console.log('\n✅ Importação concluída!');
}

main()
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

/**
 * PRÓXIMOS PASSOS:
 *
 * 1. Para importar todos os 215 pareceres:
 *    - Use Playwright MCP para navegar pelas 22 páginas (215/10 = 21.5)
 *    - Extrair dados de cada página
 *    - Adicionar ao array pareceresExtraidos[]
 *    - Executar este script
 *
 * 2. Automatizar via cron job:
 *    - Executar semanalmente
 *    - Sistema de versionamento detectará mudanças automaticamente
 *    - Novos pareceres serão adicionados
 *    - Pareceres atualizados terão novas versões criadas
 *
 * 3. Notificar alunos:
 *    - Query documentos com versões recentes (last 7 days)
 *    - Enviar email com lista de novos/atualizados pareceres
 *    - Filtrar por cursos em que aluno está matriculado
 */
