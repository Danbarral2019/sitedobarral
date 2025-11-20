/**
 * Script para processar pareceres extraídos e filtrar apenas os relevantes
 *
 * Lê o arquivo pareceres-vinculantes-raw.json, analisa relevância
 * e salva apenas pareceres com score >= 60 para importação
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { analyzeRelevanceForLicitacoes } from './extract-pareceres-vinculantes';

interface ParecerRaw {
  numeroCompleto: string;
  assunto: string;
  ementa: string;
}

interface ParecerProcessado {
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

async function main() {
  console.log('🚀 Processando pareceres extraídos\n');

  // 1. Ler arquivo JSON com pareceres brutos
  const inputPath = join(process.cwd(), 'data', 'pareceres-vinculantes-raw.json');
  const pareceresRaw: ParecerRaw[] = JSON.parse(readFileSync(inputPath, 'utf-8'));

  console.log(`📊 Total de pareceres extraídos: ${pareceresRaw.length}\n`);

  // 2. Processar cada parecer e analisar relevância
  const pareceresProcessados: ParecerProcessado[] = pareceresRaw.map(raw => {
    // Extrair prefixo e número
    const match = raw.numeroCompleto.match(/^([A-Z]+)\s*-?\s*(\d+)$/);
    const prefixo = match ? match[1] : '';
    const numero = match ? match[2] : raw.numeroCompleto;

    // Analisar relevância
    const analysis = analyzeRelevanceForLicitacoes(raw.assunto, raw.ementa);

    return {
      numeroCompleto: raw.numeroCompleto.trim(),
      prefixo,
      numero,
      assunto: raw.assunto.trim(),
      ementa: raw.ementa.trim(),
      relevanciaScore: analysis.score,
      isRelevante: analysis.isRelevante,
      cursosRelevantes: analysis.cursosRelevantes,
      razaoRelevancia: analysis.razao
    };
  });

  // 3. Filtrar apenas relevantes (score >= 60) para importação
  const THRESHOLD_IMPORTACAO = 60;
  const pareceresRelevantes = pareceresProcessados
    .filter(p => p.relevanciaScore >= THRESHOLD_IMPORTACAO)
    .sort((a, b) => b.relevanciaScore - a.relevanciaScore);

  console.log(`✅ Pareceres relevantes (score >= ${THRESHOLD_IMPORTACAO}): ${pareceresRelevantes.length}\n`);

  // 4. Estatísticas de relevância
  const scoreDistribution = {
    'Muito Alto (80-100)': pareceresProcessados.filter(p => p.relevanciaScore >= 80).length,
    'Alto (60-79)': pareceresProcessados.filter(p => p.relevanciaScore >= 60 && p.relevanciaScore < 80).length,
    'Médio (40-59)': pareceresProcessados.filter(p => p.relevanciaScore >= 40 && p.relevanciaScore < 60).length,
    'Baixo (0-39)': pareceresProcessados.filter(p => p.relevanciaScore < 40).length
  };

  console.log('📈 Distribuição de Relevância:');
  Object.entries(scoreDistribution).forEach(([faixa, count]) => {
    console.log(`   ${faixa}: ${count}`);
  });

  // 5. Pareceres por curso
  const cursosCounts: Record<string, number> = {};
  pareceresRelevantes.forEach(p => {
    p.cursosRelevantes.forEach(curso => {
      cursosCounts[curso] = (cursosCounts[curso] || 0) + 1;
    });
  });

  console.log('\n📚 Pareceres Relevantes por Curso:');
  const cursoNomes: Record<string, string> = {
    '1': 'Nova Lei de Licitações',
    '3': 'Gestão e Fiscalização de Contratos',
    '4': 'Processo Sancionador'
  };

  Object.entries(cursosCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cursoId, count]) => {
      console.log(`   ${cursoNomes[cursoId] || cursoId}: ${count}`);
    });

  // 6. Top 10 pareceres mais relevantes
  console.log('\n🏆 Top 10 Pareceres Mais Relevantes:');
  pareceresRelevantes.slice(0, 10).forEach((p, idx) => {
    console.log(`   ${idx + 1}. ${p.numeroCompleto} - Score: ${p.relevanciaScore}`);
    console.log(`      ${p.assunto.substring(0, 80)}...`);
  });

  // 7. Salvar pareceres relevantes para importação
  const outputPath = join(process.cwd(), 'data', 'pareceres-vinculantes-relevantes.json');
  writeFileSync(outputPath, JSON.stringify(pareceresRelevantes, null, 2), 'utf-8');

  console.log(`\n💾 Dados salvos em: ${outputPath}`);
  console.log(`\n✅ Processamento concluído!`);
  console.log(`   Total bruto: ${pareceresRaw.length}`);
  console.log(`   Relevantes (score >= ${THRESHOLD_IMPORTACAO}): ${pareceresRelevantes.length}`);
  console.log(`   Taxa de relevância: ${((pareceresRelevantes.length / pareceresRaw.length) * 100).toFixed(1)}%`);

  console.log(`\n📝 Próximo passo: Importar para o banco de dados`);
  console.log(`   Comando: npx tsx scripts/import-pareceres-db.ts`);
}

main().catch(console.error);
