/**
 * Script para extrair TODOS os 61 Pareceres Vinculantes filtrados por "licitação"
 * Usa o resultado da navegação manual via Playwright MCP
 *
 * Execute este script APÓS ter navegado manualmente pelas 7 páginas
 * e colado os dados extraídos abaixo
 */

import { writeFileSync } from 'fs';
import { join } from 'path';
import { processExtractedPareceres, filterRelevantPareceres, analyzeRelevanceForLicitacoes } from './extract-pareceres-vinculantes';

/**
 * Dados extraídos via Playwright MCP (páginas 1-7)
 * IMPORTANTE: Preencher com os dados reais após extração completa
 */
const pareceresRaw: Array<{
  numeroCompleto: string;
  assunto: string;
  ementa: string;
}> = [
  // PÁGINA 1 (1-10)
  {
    numeroCompleto: "JM - 04",
    assunto: "Inidoneidade de pessoas naturais e jurídicas que pratiquem infrações administrativas ambientais especialmente graves, conforme define.",
    ementa: "ADMINISTRATIVO. LICITAÇÕES E CONTRATOS PÚBLICOS..." // (ementa completa omitida por brevidade)
  },
  {
    numeroCompleto: "BBL - 02",
    assunto: "COMPROMISSO DE AJUSTAMENTO DE CONDUTA. FUNDO DE DEFESA AOS DIREITOS DIFUSOS...",
    ementa: "DESPACHO DO PRESIDENTE DA REPÚBLICA..." // (ementa completa omitida)
  },
  // ... adicionar os 59 pareceres restantes após extração completa
];

async function main() {
  console.log('🚀 Processando pareceres extraídos via Playwright MCP\n');
  console.log(`📊 Total bruto: ${pareceresRaw.length} pareceres\n`);

  // Processar e analisar relevância
  const pareceresProcessados = processExtractedPareceres(pareceresRaw);

  // Filtrar apenas relevantes (score >= 40)
  const pareceresRelevantes = filterRelevantPareceres(pareceresProcessados, 40);

  console.log(`✅ Pareceres relevantes (score >= 40): ${pareceresRelevantes.length}\n`);

  // Estatísticas
  const scoreDistribution = {
    'Muito Alto (80-100)': pareceresRelevantes.filter(p => p.relevanciaScore >= 80).length,
    'Alto (60-79)': pareceresRelevantes.filter(p => p.relevanciaScore >= 60 && p.relevanciaScore < 80).length,
    'Médio (40-59)': pareceresRelevantes.filter(p => p.relevanciaScore >= 40 && p.relevanciaScore < 60).length,
  };

  console.log('📈 Distribuição de Relevância:');
  Object.entries(scoreDistribution).forEach(([faixa, count]) => {
    console.log(`   ${faixa}: ${count}`);
  });

  // Cursos mais relevantes
  const cursosCounts: Record<string, number> = {};
  pareceresRelevantes.forEach(p => {
    p.cursosRelevantes.forEach(curso => {
      cursosCounts[curso] = (cursosCounts[curso] || 0) + 1;
    });
  });

  console.log('\n📚 Pareceres por Curso:');
  Object.entries(cursosCounts).forEach(([cursoId, count]) => {
    const cursoNomes: Record<string, string> = {
      '1': 'Nova Lei de Licitações',
      '3': 'Gestão e Fiscalização de Contratos',
      '4': 'Processo Sancionador'
    };
    console.log(`   ${cursoNomes[cursoId] || cursoId}: ${count}`);
  });

  // Salvar resultados
  const outputPath = join(process.cwd(), 'data', 'pareceres-vinculantes-relevantes.json');
  writeFileSync(outputPath, JSON.stringify(pareceresRelevantes, null, 2), 'utf-8');

  console.log(`\n💾 Dados salvos em: ${outputPath}`);
  console.log(`\n✅ Processamento concluído!`);
  console.log(`   Total bruto: ${pareceresRaw.length}`);
  console.log(`   Relevantes: ${pareceresRelevantes.length}`);
  console.log(`   Taxa de relevância: ${((pareceresRelevantes.length / pareceresRaw.length) * 100).toFixed(1)}%`);
}

main().catch(console.error);
