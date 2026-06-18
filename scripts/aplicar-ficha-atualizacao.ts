/**
 * Rotina de atualização do acervo a partir de uma ficha de atualização normativa.
 *
 * Aplica diretamente no banco o que uma ficha homologada descreve:
 *   1. cria (ou atualiza) o ato normativo novo;
 *   2. registra as relações de revogação/alteração já confirmadas (reviewStatus
 *      = 'confirmed', source = 'manual'), que é a forma como o sistema deriva a
 *      situação de vigência dos atos antigos;
 *   3. opcionalmente dispara o scrape+index oficial (mesma rotina da API admin),
 *      preenchendo conteúdo e embeddings a partir do officialUrl.
 *
 * Espelha a criação canônica de app/api/admin/legislative-acts/route.ts
 * (getHierarchyLevel, setLeiArticles, normalizeScrapedText, scrapeAndIndexAct)
 * e acrescenta o passo de relações, que a criação via API não faz sozinha.
 *
 * NÃO exporta para o Obsidian. Depois de rodar, execute `npm run export:obsidian`
 * (use --full na primeira passada por ser mudança de vigência).
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/aplicar-ficha-atualizacao.ts <ficha.json> --dry-run
 *   npx dotenv -e .env.local -- npx tsx scripts/aplicar-ficha-atualizacao.ts <ficha.json>
 *   npx dotenv -e .env.local -- npx tsx scripts/aplicar-ficha-atualizacao.ts <ficha.json> --no-scrape
 *
 * Default da ficha: data/fichas-atualizacao/desfazimento-12785.json
 *
 * Formato da ficha (JSON):
 * {
 *   "homologadoPor": "danbarral@gmail.com",
 *   "act": {
 *     "type": "decreto", "number": "12.785", "year": 2025,
 *     "title": "Decreto nº 12.785, de 19 de dezembro de 2025",
 *     "ementa": "Dispõe sobre mecanismos...",
 *     "summary": "(opcional) resumo didático",
 *     "issuer": "Presidência da República",
 *     "publishDate": "2025-12-22", "effectiveDate": "2025-12-22",
 *     "leiArticles": ["76","77"],
 *     "officialUrl": "https://www.planalto.gov.br/...",
 *     "content": "(opcional) texto integral; se ausente e houver officialUrl, faz scrape",
 *     "esfera": "federal",
 *     "themes": ["sustentabilidade","contratacao-direta"]
 *   },
 *   "revoga": [ { "type": "decreto", "number": "9.373", "year": 2018 },
 *              { "type": "decreto", "number": "10.340", "year": 2020 } ],
 *   "altera": [],
 *   "relacoesExtras": [
 *     { "sourceRef": {"type":"decreto","number":"9.373","year":2018},
 *       "targetRef": {"type":"decreto","number":"99.658","year":1990},
 *       "relationType": "revoga" }
 *   ]
 * }
 */
import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { getHierarchyLevel } from '../lib/legislative-acts/hierarchy';
import { setLeiArticles } from '../lib/lei-articles';
import { normalizeScrapedText } from '../lib/legislative-scrapers/normalize';
import { scrapeAndIndexAct } from '../lib/legislative-scrapers/scrape-and-index';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const NO_SCRAPE = args.includes('--no-scrape');
const fichaPath =
  args.find((a) => !a.startsWith('--')) ??
  'data/fichas-atualizacao/desfazimento-12785.json';

type ActRef = { type: string; number: string; year: number };
type Ficha = {
  homologadoPor?: string;
  act: {
    type: string;
    number: string;
    year: number;
    title: string;
    ementa: string;
    summary?: string;
    issuer: string;
    publishDate: string;
    effectiveDate?: string;
    leiArticles?: string[];
    officialUrl?: string;
    content?: string;
    esfera?: string;
    themes?: string[];
  };
  revoga?: ActRef[];
  altera?: ActRef[];
  relacoesExtras?: { sourceRef: ActRef; targetRef: ActRef; relationType: string }[];
};

const TYPE_LABEL: Record<string, string> = {
  decreto: 'Decreto',
  portaria: 'Portaria',
  in: 'IN SEGES',
  'ordem-servico': 'Ordem de Serviço',
  lei: 'Lei',
  'medida-provisoria': 'Medida Provisória',
};

function buildFullNumber(type: string, number: string, year: number): string {
  const label = TYPE_LABEL[type] ?? type;
  return `${label} ${number}/${year}`;
}

const normNum = (n: string) => n.replace(/[.\s]/g, '');

/** Localiza ato pré-existente por (type, year) tolerando variações no número. */
async function findActByRef(ref: ActRef) {
  const candidates = await prisma.legislativeAct.findMany({
    where: { type: ref.type, year: ref.year },
    select: { id: true, number: true, fullNumber: true },
  });
  return (
    candidates.find((c) => normNum(c.number) === normNum(ref.number)) ?? null
  );
}

async function upsertRelation(
  sourceId: string,
  targetId: string,
  relationType: string,
  confirmedBy: string,
  label: string,
) {
  if (DRY_RUN) {
    console.log(`  [dry-run] relação ${relationType}: ${label}`);
    return;
  }
  await prisma.legislativeActRelation.upsert({
    where: {
      sourceActId_targetActId_relationType: {
        sourceActId: sourceId,
        targetActId: targetId,
        relationType,
      },
    },
    update: {
      source: 'manual',
      confidence: 1.0,
      reviewStatus: 'confirmed',
      confirmedBy,
      confirmedAt: new Date(),
    },
    create: {
      sourceActId: sourceId,
      targetActId: targetId,
      relationType,
      source: 'manual',
      confidence: 1.0,
      reviewStatus: 'confirmed',
      confirmedBy,
      confirmedAt: new Date(),
      excerpt: `Relação registrada por ficha de atualização homologada (${confirmedBy}).`,
    },
  });
  console.log(`  ✓ relação ${relationType}: ${label}`);
}

async function main() {
  const ficha: Ficha = JSON.parse(
    readFileSync(resolve(process.cwd(), fichaPath), 'utf-8'),
  );
  const confirmedBy = ficha.homologadoPor ?? 'admin';
  const a = ficha.act;
  const fullNumber = buildFullNumber(a.type, a.number, a.year);

  console.log(`\n=== Aplicar ficha ${DRY_RUN ? '[DRY-RUN]' : '[EXEC]'} ===`);
  console.log(`Ficha: ${fichaPath}`);
  console.log(`Ato: ${fullNumber} — homologado por ${confirmedBy}\n`);

  const ementa = normalizeScrapedText(a.ementa);
  const content = a.content ? normalizeScrapedText(a.content) : null;
  const hierarchyLevel = getHierarchyLevel(a.type);

  const data = {
    type: a.type,
    number: a.number,
    year: a.year,
    fullNumber,
    title: a.title,
    ementa,
    summary: a.summary ?? null,
    issuer: a.issuer,
    publishDate: new Date(a.publishDate),
    effectiveDate: a.effectiveDate ? new Date(a.effectiveDate) : null,
    hierarchyLevel,
    ...setLeiArticles(a.leiArticles ?? null),
    officialUrl: a.officialUrl ?? null,
    content,
    esfera: a.esfera ?? 'federal',
    themes: a.themes && a.themes.length > 0 ? JSON.stringify(a.themes) : null,
    embeddingStatus: 'pending',
    scrapeStatus: 'manual',
  };

  let actId: string | null = null;
  if (DRY_RUN) {
    const existing = await prisma.legislativeAct.findUnique({
      where: { fullNumber },
      select: { id: true },
    });
    console.log(`Ato ${existing ? 'JÁ EXISTE (seria atualizado)' : 'NOVO (seria criado)'}: ${fullNumber}`);
    console.log(`  hierarchyLevel=${hierarchyLevel} leiArticles=${(a.leiArticles ?? []).join(',')} themes=${(a.themes ?? []).join(',')}`);
  } else {
    const act = await prisma.legislativeAct.upsert({
      where: { fullNumber },
      update: { ...data, createdBy: undefined },
      create: { ...data, createdBy: confirmedBy },
    });
    actId = act.id;
    console.log(`✓ Ato gravado: ${fullNumber} (id=${act.id})`);
  }

  // Relações de revogação/alteração com origem no ato novo
  const rels: { refs: ActRef[]; relationType: string }[] = [
    { refs: ficha.revoga ?? [], relationType: 'revoga' },
    { refs: ficha.altera ?? [], relationType: 'altera' },
  ];
  for (const { refs, relationType } of rels) {
    for (const ref of refs) {
      const target = await findActByRef(ref);
      const targetLabel = buildFullNumber(ref.type, ref.number, ref.year);
      if (!target) {
        console.warn(`  ! alvo não encontrado no banco: ${targetLabel} — pular (cadastre-o antes ou confira o número)`);
        continue;
      }
      if (actId) {
        await upsertRelation(actId, target.id, relationType, confirmedBy, `${fullNumber} → ${target.fullNumber}`);
      } else {
        console.log(`  [dry-run] ${relationType}: ${fullNumber} → ${target.fullNumber}`);
      }
    }
  }

  // Relações extras entre atos pré-existentes (ex.: correção 9.373 revoga 99.658)
  for (const extra of ficha.relacoesExtras ?? []) {
    const src = await findActByRef(extra.sourceRef);
    const tgt = await findActByRef(extra.targetRef);
    const srcLabel = buildFullNumber(extra.sourceRef.type, extra.sourceRef.number, extra.sourceRef.year);
    const tgtLabel = buildFullNumber(extra.targetRef.type, extra.targetRef.number, extra.targetRef.year);
    if (!src || !tgt) {
      console.warn(`  ! relação extra ignorada (ato ausente): ${srcLabel} → ${tgtLabel}`);
      continue;
    }
    await upsertRelation(src.id, tgt.id, extra.relationType, confirmedBy, `${src.fullNumber} → ${tgt.fullNumber}`);
  }

  // Scrape + index oficial (mesma rotina da API), quando há URL e não veio content
  if (!DRY_RUN && actId && a.officialUrl && !a.content && !NO_SCRAPE) {
    console.log('\nDisparando scrape+index oficial a partir do officialUrl...');
    try {
      await scrapeAndIndexAct(actId);
      console.log('✓ scrape+index concluído');
    } catch (err) {
      console.warn('! scrape+index falhou (siga com embeddings manuais):', (err as Error).message);
    }
  }

  console.log(`\n${DRY_RUN ? 'DRY-RUN concluído. Nada gravado.' : 'Concluído.'}`);
  if (!DRY_RUN) {
    console.log('Próximo passo: npm run export:obsidian -- --full   (e conferir o cofre).');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
