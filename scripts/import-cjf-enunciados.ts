/**
 * import-cjf-enunciados.ts
 *
 * Importa/atualiza no DB os 54 enunciados do CJF:
 *  - Os 25 do 1º Simpósio (1-25/2022) — atualiza description com texto oficial
 *  - Os 29 do 2º Simpósio (26-54/2023) — cria novos Documents
 *
 * Read-only por padrão. --apply pra escrever.
 */

import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '../lib/prisma';

interface CjfEnunciado {
  numero: number;
  simposio: 1 | 2;
  ano: number;
  texto: string;
  fonte: string;
}

const SOURCE_PORTAL_OFICIAL_2 =
  'https://www.cjf.jus.br/cjf/corregedoria-da-justica-federal/centro-de-estudos-judiciarios-1/publicacoes-1/outras_publicacoes/2o-simposio-de-licitacoes-e-contratos-da-justica-federal';
const SOURCE_PORTAL_OFICIAL_1 =
  'https://www.cjf.jus.br/cjf/corregedoria-da-justica-federal/centro-de-estudos-judiciarios-1/publicacoes-1/outras_publicacoes/i-simposio-de-licitacoes-e-contratos-da-justica-federal';

function buildTitle(e: CjfEnunciado): string {
  return `Enunciado do CJF nº ${e.numero}`;
}

function buildTags(e: CjfEnunciado): string {
  const simposioLabel =
    e.simposio === 1
      ? '1º Simpósio de Licitações e Contratos da Justiça Federal'
      : '2º Simpósio de Licitações e Contratos da Justiça Federal';
  // Detecta tema básico via keywords no texto
  const text = e.texto.toLowerCase();
  const tema: string[] = [];
  if (/dispensa|inexigibilidade|contratação direta/i.test(text)) tema.push('Contratação Direta');
  if (/pregão|pregao/i.test(text)) tema.push('Pregão');
  if (/registro de preços|ata de registro/i.test(text)) tema.push('Registro de Preços');
  if (/prorrogação|prorroga/i.test(text)) tema.push('Prorrogação');
  if (/risco|gestão de risco/i.test(text)) tema.push('Gestão de Riscos');
  if (/etp|estudo técnico preliminar/i.test(text)) tema.push('ETP');
  if (/termo de referência|tr\b/i.test(text)) tema.push('Termo de Referência');
  if (/sustentab/i.test(text)) tema.push('Sustentabilidade');
  if (/auditoria/i.test(text)) tema.push('Auditoria');
  if (/fiscal/i.test(text)) tema.push('Fiscalização');

  const tags = ['CJF', 'Enunciado', simposioLabel, ...tema];
  return JSON.stringify(tags);
}

function buildUrl(e: CjfEnunciado): string {
  return e.simposio === 2 ? SOURCE_PORTAL_OFICIAL_2 : SOURCE_PORTAL_OFICIAL_1;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const today = new Date().toISOString().slice(0, 10);

  const inputPath = path.join(
    process.cwd(),
    'docs',
    'audits',
    `${today}-cjf-enunciados-scraped.json`
  );
  if (!fs.existsSync(inputPath)) {
    console.error(`Input não encontrado: ${inputPath}`);
    console.error('Rode primeiro: npx tsx scripts/scrape-cjf-enunciados.ts');
    process.exit(1);
  }

  const { enunciados } = JSON.parse(fs.readFileSync(inputPath, 'utf-8')) as {
    enunciados: CjfEnunciado[];
  };

  console.log('='.repeat(60));
  console.log(`IMPORT-CJF-ENUNCIADOS — ${apply ? 'APPLY' : 'DRY-RUN'}`);
  console.log('='.repeat(60));
  console.log(`Scraped: ${enunciados.length} enunciados\n`);

  // Pega todos os enunciados CJF existentes
  const existing = await prisma.document.findMany({
    where: {
      category: 'enunciados',
      isPublic: true,
      tags: { contains: '"CJF"' },
    },
    select: { id: true, title: true, description: true, tags: true, url: true },
  });
  console.log(`DB: ${existing.length} enunciados CJF públicos\n`);

  // Match por número (extrair do título "Enunciado do CJF nº N")
  const dbByNum = new Map<number, (typeof existing)[number]>();
  for (const e of existing) {
    const m = e.title.match(/n[º°]?\s*(\d+)/i);
    if (m) dbByNum.set(parseInt(m[1], 10), e);
  }

  type Plan = {
    numero: number;
    simposio: 1 | 2;
    ano: number;
    action: 'update' | 'create' | 'skip';
    motivo?: string;
    dbId?: string;
    diffDesc?: { antes: string; depois: string };
  };

  const plans: Plan[] = [];

  for (const e of enunciados) {
    const dbDoc = dbByNum.get(e.numero);
    if (dbDoc) {
      // Atualiza se description diferente
      const descAntiga = (dbDoc.description || '').trim();
      if (descAntiga === e.texto) {
        plans.push({ numero: e.numero, simposio: e.simposio, ano: e.ano, action: 'skip', motivo: 'já igual', dbId: dbDoc.id });
      } else {
        plans.push({
          numero: e.numero,
          simposio: e.simposio,
          ano: e.ano,
          action: 'update',
          dbId: dbDoc.id,
          diffDesc: { antes: descAntiga, depois: e.texto },
        });
      }
    } else {
      plans.push({ numero: e.numero, simposio: e.simposio, ano: e.ano, action: 'create' });
    }
  }

  const toUpdate = plans.filter((p) => p.action === 'update');
  const toCreate = plans.filter((p) => p.action === 'create');
  const toSkip = plans.filter((p) => p.action === 'skip');

  console.log('Plano:');
  console.log(`  ✅ Criar (novos): ${toCreate.length}`);
  console.log(`  🔄 Atualizar (description diferente): ${toUpdate.length}`);
  console.log(`  ⏭️  Já iguais: ${toSkip.length}`);

  console.log('\nAmostra de criações (top 5):');
  for (const p of toCreate.slice(0, 5)) {
    const e = enunciados.find((x) => x.numero === p.numero)!;
    console.log(`  Enunciado ${p.numero} (Simp ${p.simposio}/${p.ano}): ${e.texto.slice(0, 100)}...`);
  }

  console.log('\nAmostra de atualizações (top 3):');
  for (const p of toUpdate.slice(0, 3)) {
    console.log(`  Enunciado ${p.numero}:`);
    console.log(`    antes: ${p.diffDesc!.antes.slice(0, 100)}...`);
    console.log(`    novo:  ${p.diffDesc!.depois.slice(0, 100)}...`);
  }

  if (!apply) {
    console.log('\nPara aplicar:');
    console.log('  npx dotenv -e .env.local -- npx tsx scripts/import-cjf-enunciados.ts --apply');
    await prisma.$disconnect();
    return;
  }

  // APPLY
  console.log('\nAplicando...');
  let success = 0;
  let errors = 0;

  for (const p of plans) {
    if (p.action === 'skip') continue;
    const e = enunciados.find((x) => x.numero === p.numero)!;

    try {
      if (p.action === 'update') {
        await prisma.document.update({
          where: { id: p.dbId },
          data: {
            description: e.texto,
            content: e.texto, // texto integral — enunciado é curto, cabe em ambos
            url: buildUrl(e),
            tags: buildTags(e),
            reviewed: false,
            reviewedAt: null,
          },
        });
      } else {
        await prisma.document.create({
          data: {
            title: buildTitle(e),
            description: e.texto,
            content: e.texto,
            type: 'link',
            url: buildUrl(e),
            category: 'enunciados',
            isPublic: true,
            isCommon: true,
            tags: buildTags(e),
            reviewed: false,
          },
        });
      }
      success++;
    } catch (err) {
      errors++;
      console.log(`  ❌ Enunciado ${p.numero}: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log(`\n✅ Sucesso: ${success} | ❌ Falhas: ${errors}`);

  const logPath = path.join(
    process.cwd(),
    'docs',
    'audits',
    `${today}-cjf-import-log.json`
  );
  fs.writeFileSync(
    logPath,
    JSON.stringify({ runAt: new Date().toISOString(), apply, stats: { success, errors }, plans }, null, 2)
  );
  console.log(`📄 Log: ${logPath}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
