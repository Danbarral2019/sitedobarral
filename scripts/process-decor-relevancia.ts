/**
 * Script para processar pareceres DECOR extraídos e filtrar apenas os relevantes
 *
 * Lê o arquivo decor-raw.json, analisa relevância
 * e salva apenas pareceres com score >= 60 para importação
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface DecorRaw {
  numeroCompleto: string;
  assunto: string;
  ementa: string;
  urlDocumento: string;
}

interface DecorProcessado {
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
 * Analisa relevância de um parecer DECOR para os cursos de licitações
 */
function analyzeRelevanceForLicitacoes(
  assunto: string,
  ementa: string
): {
  score: number;
  isRelevante: boolean;
  cursosRelevantes: string[];
  razao: string;
} {
  let score = 0;
  const cursosRelevantes: string[] = [];
  const razoes: string[] = [];

  const textoCompleto = `${assunto} ${ementa}`.toLowerCase();

  // Palavras-chave MUITO relevantes (30 pontos cada)
  const palavrasChaveMuitoRelevantes = [
    'licitação',
    'licitações',
    'lei 14.133',
    'lei nº 14.133',
    'pregão',
    'concorrência',
    'dispensa',
    'inexigibilidade',
  ];

  palavrasChaveMuitoRelevantes.forEach(palavra => {
    if (textoCompleto.includes(palavra)) {
      score += 30;
      if (!razoes.includes('Menciona diretamente licitações/contratações públicas')) {
        razoes.push('Menciona diretamente licitações/contratações públicas');
      }
    }
  });

  // Palavras-chave relevantes (20 pontos cada)
  const palavrasChaveRelevantes = [
    'contrato administrativo',
    'contratação',
    'contratações',
    'gestão de contratos',
    'fiscalização de contratos',
    'administração pública',
    'contrato público',
  ];

  palavrasChaveRelevantes.forEach(palavra => {
    if (textoCompleto.includes(palavra)) {
      score += 20;
      if (!razoes.includes('Trata de contratos e gestão administrativa')) {
        razoes.push('Trata de contratos e gestão administrativa');
      }
    }
  });

  // Palavras-chave moderadamente relevantes (10 pontos cada)
  const palavrasChaveModeradas = [
    'sanção',
    'penalidade',
    'processo administrativo',
    'aditivo contratual',
    'termo aditivo',
    'prorrogação',
    'reajuste',
    'revisão',
    'rescisão',
  ];

  palavrasChaveModeradas.forEach(palavra => {
    if (textoCompleto.includes(palavra)) {
      score += 10;
      if (!razoes.includes('Aborda temas relacionados à execução contratual')) {
        razoes.push('Aborda temas relacionados à execução contratual');
      }
    }
  });

  // Determinar cursos relevantes
  if (
    textoCompleto.includes('licitação') ||
    textoCompleto.includes('licitações') ||
    textoCompleto.includes('lei 14.133') ||
    textoCompleto.includes('pregão') ||
    textoCompleto.includes('concorrência')
  ) {
    cursosRelevantes.push('1'); // Nova Lei de Licitações
    if (!razoes.includes('Aplicável ao curso Nova Lei de Licitações')) {
      razoes.push('Aplicável ao curso Nova Lei de Licitações');
    }
  }

  if (
    textoCompleto.includes('planejamento') ||
    textoCompleto.includes('estudo técnico preliminar') ||
    textoCompleto.includes('etp')
  ) {
    cursosRelevantes.push('2'); // Planejamento das Contratações
    if (!razoes.includes('Aplicável ao curso Planejamento das Contratações')) {
      razoes.push('Aplicável ao curso Planejamento das Contratações');
    }
  }

  if (
    textoCompleto.includes('gestão') ||
    textoCompleto.includes('fiscalização') ||
    textoCompleto.includes('acompanhamento') ||
    textoCompleto.includes('execução contratual')
  ) {
    cursosRelevantes.push('3'); // Gestão e Fiscalização de Contratos
    if (!razoes.includes('Aplicável ao curso Gestão e Fiscalização')) {
      razoes.push('Aplicável ao curso Gestão e Fiscalização');
    }
  }

  if (
    textoCompleto.includes('sanção') ||
    textoCompleto.includes('penalidade') ||
    textoCompleto.includes('processo sancionador') ||
    textoCompleto.includes('infração')
  ) {
    cursosRelevantes.push('4'); // Processo Sancionador
    if (!razoes.includes('Aplicável ao curso Processo Sancionador')) {
      razoes.push('Aplicável ao curso Processo Sancionador');
    }
  }

  // Garantir score mínimo e máximo
  score = Math.min(100, score);
  score = Math.max(0, score);

  const isRelevante = score >= 40;
  const razao = razoes.length > 0 ? razoes.join('; ') : 'Relevância baixa para os cursos';

  return {
    score,
    isRelevante,
    cursosRelevantes,
    razao,
  };
}

async function main() {
  console.log('🚀 Processando pareceres DECOR extraídos\n');

  // 1. Ler arquivo JSON com pareceres brutos
  const inputPath = join(process.cwd(), 'data', 'decor-raw.json');
  const decorRaw: DecorRaw[] = JSON.parse(readFileSync(inputPath, 'utf-8'));

  console.log(`📊 Total de pareceres DECOR extraídos: ${decorRaw.length}\n`);

  // 2. Processar cada parecer e analisar relevância
  const decorProcessados: DecorProcessado[] = decorRaw.map(raw => {
    // Analisar relevância
    const analysis = analyzeRelevanceForLicitacoes(raw.assunto, raw.ementa);

    return {
      numeroCompleto: raw.numeroCompleto.trim(),
      assunto: raw.assunto.trim(),
      ementa: raw.ementa.trim(),
      urlDocumento: raw.urlDocumento,
      relevanciaScore: analysis.score,
      isRelevante: analysis.isRelevante,
      cursosRelevantes: analysis.cursosRelevantes,
      razaoRelevancia: analysis.razao,
    };
  });

  // 3. Filtrar apenas relevantes (score >= 60) para importação
  const THRESHOLD_IMPORTACAO = 60;
  const decorRelevantes = decorProcessados
    .filter(p => p.relevanciaScore >= THRESHOLD_IMPORTACAO)
    .sort((a, b) => b.relevanciaScore - a.relevanciaScore);

  console.log(`✅ Pareceres DECOR relevantes (score >= ${THRESHOLD_IMPORTACAO}): ${decorRelevantes.length}\n`);

  // 4. Estatísticas de relevância
  const scoreDistribution = {
    'Muito Alto (80-100)': decorProcessados.filter(p => p.relevanciaScore >= 80).length,
    'Alto (60-79)': decorProcessados.filter(p => p.relevanciaScore >= 60 && p.relevanciaScore < 80).length,
    'Médio (40-59)': decorProcessados.filter(p => p.relevanciaScore >= 40 && p.relevanciaScore < 60).length,
    'Baixo (0-39)': decorProcessados.filter(p => p.relevanciaScore < 40).length,
  };

  console.log('📈 Distribuição de Relevância:');
  Object.entries(scoreDistribution).forEach(([faixa, count]) => {
    console.log(`   ${faixa}: ${count}`);
  });

  // 5. Pareceres por curso
  const cursosCounts: Record<string, number> = {};
  decorRelevantes.forEach(p => {
    p.cursosRelevantes.forEach(curso => {
      cursosCounts[curso] = (cursosCounts[curso] || 0) + 1;
    });
  });

  console.log('\n📚 Pareceres DECOR Relevantes por Curso:');
  const cursoNomes: Record<string, string> = {
    '1': 'Nova Lei de Licitações',
    '2': 'Planejamento das Contratações',
    '3': 'Gestão e Fiscalização de Contratos',
    '4': 'Processo Sancionador',
  };

  Object.entries(cursosCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cursoId, count]) => {
      console.log(`   ${cursoNomes[cursoId] || cursoId}: ${count}`);
    });

  // 6. Top 10 pareceres mais relevantes
  console.log('\n🏆 Top 10 Pareceres DECOR Mais Relevantes:');
  decorRelevantes.slice(0, 10).forEach((p, idx) => {
    console.log(`   ${idx + 1}. ${p.numeroCompleto} - Score: ${p.relevanciaScore}`);
    console.log(`      ${p.assunto.substring(0, 80)}...`);
  });

  // 7. Salvar pareceres relevantes para importação
  const outputPath = join(process.cwd(), 'data', 'decor-relevantes.json');
  writeFileSync(outputPath, JSON.stringify(decorRelevantes, null, 2), 'utf-8');

  console.log(`\n💾 Dados salvos em: ${outputPath}`);
  console.log(`\n✅ Processamento concluído!`);
  console.log(`   Total bruto: ${decorRaw.length}`);
  console.log(`   Relevantes (score >= ${THRESHOLD_IMPORTACAO}): ${decorRelevantes.length}`);
  console.log(`   Taxa de relevância: ${((decorRelevantes.length / decorRaw.length) * 100).toFixed(1)}%`);

  console.log(`\n📝 Próximo passo: Importar para o banco de dados`);
  console.log(`   Comando: npx tsx scripts/import-decor-db.ts`);
}

main().catch(console.error);
