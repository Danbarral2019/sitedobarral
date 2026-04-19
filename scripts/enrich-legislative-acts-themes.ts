/**
 * Script para enriquecer LegislativeActs existentes com temas e esfera
 *
 * Para cada ato com themes === null:
 * 1. Parseia leiArticles JSON
 * 2. Mapeia artigos → temas usando TEMAS_LICITACOES
 * 3. Fallback: keyword matching na ementa/title
 * 4. Seta esfera = 'federal' (todos os 53 são federais)
 * 5. Seta themes = JSON.stringify([...])
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/enrich-legislative-acts-themes.ts
 *   npx dotenv -e .env.local -- npx tsx scripts/enrich-legislative-acts-themes.ts --dry-run
 *   npx dotenv -e .env.local -- npx tsx scripts/enrich-legislative-acts-themes.ts --force
 */

import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Reproduzir taxonomia inline para evitar problemas de path resolution
const TEMAS_LICITACOES = [
  { value: 'principios-gerais',        articles: ['1','2','3','4','5'] },
  { value: 'agentes-governanca',       articles: ['7','8','9','10','11','12','13'] },
  { value: 'planejamento',             articles: ['18','19','20','21','22','23','24','25','26','27','28'] },
  { value: 'pesquisa-precos',          articles: ['23'] },
  { value: 'modalidades',              articles: ['28','29','30','31','32','33'] },
  { value: 'pregao-eletronico',        articles: ['17','28','29'] },
  { value: 'contratacao-direta',       articles: ['72','73','74','75','76'] },
  { value: 'registro-precos',          articles: ['82','83','84','85','86'] },
  { value: 'contratos',                articles: ['89','90','91','92','93','94','95','96','97','98','99','100','101','102','103','104','105','106','107','108','109','110'] },
  { value: 'gestao-fiscalizacao',      articles: ['115','116','117','118','119','120','121'] },
  { value: 'sancoes',                  articles: ['155','156','157','158','159','160','161','162'] },
  { value: 'sustentabilidade',         articles: ['11','144','145','146'] },
  { value: 'tecnologia-informacao',    articles: ['6'] },
  { value: 'obras-engenharia',         articles: ['46','47','48','49'] },
  { value: 'controle-transparencia',   articles: ['169','170','171','172','173'] },
] as const;

const THEME_KEYWORDS: Record<string, string[]> = {
  'principios-gerais': ['principio', 'disposicao', 'regra geral'],
  'agentes-governanca': ['agente', 'governanca', 'pregoeiro', 'comissao'],
  'planejamento': ['planejamento', 'estudo preliminar', 'ETP', 'termo de referencia'],
  'pesquisa-precos': ['pesquisa de preco', 'preco estimado', 'orcamento estimado'],
  'modalidades': ['modalidade', 'concorrencia', 'dialogo competitivo'],
  'pregao-eletronico': ['pregao', 'eletronico', 'lance'],
  'contratacao-direta': ['dispensa', 'inexigibilidade', 'contratacao direta'],
  'registro-precos': ['registro de preco', 'SRP', 'ata de registro'],
  'contratos': ['contrato administrativo', 'clausula', 'garantia contratual'],
  'gestao-fiscalizacao': ['fiscal', 'fiscalizacao', 'gestao contratual', 'medicao'],
  'sancoes': ['sancao', 'penalidade', 'multa', 'impedimento', 'inidoneidade'],
  'sustentabilidade': ['sustentabilidade', 'desenvolvimento nacional', 'ambiental'],
  'tecnologia-informacao': ['tecnologia da informacao', 'TIC', 'software', 'solucao de TI'],
  'obras-engenharia': ['obra', 'engenharia', 'servico de engenharia', 'BDI'],
  'controle-transparencia': ['controle', 'transparencia', 'portal', 'PNCP'],
};

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function getThemesFromArticles(articles: string[]): string[] {
  const themes = new Set<string>();
  for (const art of articles) {
    for (const tema of TEMAS_LICITACOES) {
      if ((tema.articles as readonly string[]).includes(art)) {
        themes.add(tema.value);
      }
    }
  }
  return [...themes];
}

function getThemesFromKeywords(text: string): string[] {
  const normalized = normalizeText(text);
  const themes = new Set<string>();

  for (const [theme, keywords] of Object.entries(THEME_KEYWORDS)) {
    for (const kw of keywords) {
      if (normalized.includes(normalizeText(kw))) {
        themes.add(theme);
        break;
      }
    }
  }
  return [...themes];
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');

  console.log('=== Enriquecimento de Atos Normativos com Temas ===');
  console.log(`Modo: ${dryRun ? 'DRY RUN (sem alterações)' : 'PRODUÇÃO'}`);
  console.log(`Force: ${force ? 'Sim (reprocessar todos)' : 'Não (apenas sem temas)'}`);
  console.log('');

  const whereClause = force ? {} : { themes: null };
  const acts = await prisma.legislativeAct.findMany({
    where: whereClause,
    select: {
      id: true,
      fullNumber: true,
      title: true,
      ementa: true,
      leiArticles: true,
      esfera: true,
      themes: true,
    },
  });

  console.log(`Encontrados: ${acts.length} atos para processar`);
  console.log('');

  let updated = 0;
  let skipped = 0;

  for (const act of acts) {
    // Parse leiArticles
    let articles: string[] = [];
    if (act.leiArticles) {
      try {
        articles = JSON.parse(act.leiArticles);
      } catch {
        articles = [];
      }
    }

    // Detectar temas por artigos
    const themesFromArticles = getThemesFromArticles(articles);

    // Fallback: keyword matching
    const textToSearch = `${act.title} ${act.ementa}`;
    const themesFromKeywords = getThemesFromKeywords(textToSearch);

    // Combinar (artigos têm prioridade, keywords complementam)
    const allThemes = [...new Set([...themesFromArticles, ...themesFromKeywords])];

    if (allThemes.length === 0) {
      console.log(`  SKIP: ${act.fullNumber} — nenhum tema detectado`);
      skipped++;
      continue;
    }

    console.log(`  ${act.fullNumber}:`);
    console.log(`    Artigos: [${articles.join(', ')}]`);
    console.log(`    Temas (artigos): [${themesFromArticles.join(', ')}]`);
    console.log(`    Temas (keywords): [${themesFromKeywords.join(', ')}]`);
    console.log(`    Temas finais: [${allThemes.join(', ')}]`);

    if (!dryRun) {
      await prisma.legislativeAct.update({
        where: { id: act.id },
        data: {
          themes: JSON.stringify(allThemes),
          esfera: act.esfera || 'federal',
        },
      });
    }

    updated++;
  }

  console.log('');
  console.log('=== Resultado ===');
  console.log(`Processados: ${updated}`);
  console.log(`Sem temas detectados: ${skipped}`);
  console.log(`Total: ${acts.length}`);

  if (dryRun) {
    console.log('\n(Nenhuma alteração feita — modo dry-run)');
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  prisma.$disconnect();
  process.exit(1);
});
