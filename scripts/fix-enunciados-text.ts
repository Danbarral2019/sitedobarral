/**
 * Sincroniza description, content, tags, leiArticles e themes de
 * Document(category='enunciados') a partir do static file `data/enunciados.ts`
 * (já validado contra PDF oficial INCP e Excel-fonte IBDA/CJF).
 *
 * Motivo: textos estavam trocados/truncados no DB e tags eram alucinações
 * do classifier IA (ex.: IBDA-29 com "Custo do Ciclo de Vida" — não tem
 * relação com o tema real, que é credenciamento).
 *
 * Tags sintetizadas a partir do static file:
 *   [orgao, "Enunciado", tema, jornada (curta)]
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/fix-enunciados-text.ts            # dry-run
 *   npx dotenv -e .env.local -- npx tsx scripts/fix-enunciados-text.ts --apply
 */

import { prisma } from '../lib/prisma';
import { ENUNCIADOS, type Enunciado } from '../data/enunciados';

const norm = (s: string) =>
  s.replace(/\(Aprovado por[^)]*\)\s*$/i, '').replace(/\s+/g, ' ').trim();

function buildTags(e: Enunciado): string[] {
  const tags = new Set<string>();
  tags.add(e.orgao);
  tags.add('Enunciado');
  if (e.tema && e.tema.trim()) tags.add(e.tema.trim());
  if (e.jornada) {
    const j = e.jornada.trim().slice(0, 80);
    if (j) tags.add(j);
  }
  return Array.from(tags);
}

async function main() {
  const apply = process.argv.includes('--apply');
  console.log('=== Sync: enunciados (description+content+tags+leiArticles) ===');
  console.log(`Modo: ${apply ? 'APPLY (escreve no banco)' : 'DRY-RUN (somente conta)'}\n`);

  const docs = await prisma.document.findMany({
    where: { category: 'enunciados' },
    select: {
      id: true,
      title: true,
      entityType: true,
      enunciadoNumber: true,
      description: true,
      content: true,
      tags: true,
      leiArticles: true,
    },
  });

  console.log(`Documentos no DB: ${docs.length}`);
  console.log(`Static reference: ${ENUNCIADOS.length}\n`);

  let willUpdate = 0;
  const updates: {
    id: string;
    title: string;
    entity: string;
    numero: number;
    description: string;
    content: string;
    tags: string;
    leiArticles: string;
  }[] = [];

  for (const e of ENUNCIADOS) {
    const doc = docs.find(
      (d) => d.entityType === e.orgao && Number(d.enunciadoNumber) === e.numero
    );
    if (!doc) {
      console.log(`  ⚠️  ${e.orgao}-${e.numero}: sem doc no DB`);
      continue;
    }
    const newText = norm(e.texto);
    const newTags = buildTags(e);
    const newLeiArticles = e.artigosVinculados;

    const dbContentClean = norm((doc.content ?? '').split('\n\nFase:')[0]);
    const dbDesc = norm(doc.description ?? '');
    const dbTagsArr = (() => {
      try {
        return JSON.parse(doc.tags ?? '[]') as string[];
      } catch {
        return [];
      }
    })();
    const dbLeiArr = (() => {
      try {
        return JSON.parse(doc.leiArticles ?? '[]') as string[];
      } catch {
        return [];
      }
    })();

    const same =
      dbContentClean === newText &&
      dbDesc === newText &&
      JSON.stringify(dbTagsArr) === JSON.stringify(newTags) &&
      JSON.stringify(dbLeiArr) === JSON.stringify(newLeiArticles);

    if (same) continue;

    willUpdate++;
    updates.push({
      id: doc.id,
      title: doc.title,
      entity: e.orgao,
      numero: e.numero,
      description: newText,
      content: newText,
      tags: JSON.stringify(newTags),
      leiArticles: JSON.stringify(newLeiArticles),
    });
  }

  console.log(`A atualizar: ${willUpdate} de ${docs.length}\n`);

  console.log('Amostra (3 primeiros):');
  for (const u of updates.slice(0, 3)) {
    console.log(`  ${u.entity}-${u.numero} [${u.id.slice(0, 8)}]`);
    console.log(`    tags: ${u.tags}`);
    console.log(`    leiArticles: ${u.leiArticles}`);
  }

  if (!apply) {
    console.log('\n(dry-run — re-execute com --apply para gravar.)');
    return;
  }

  let success = 0;
  let failed = 0;
  for (const u of updates) {
    try {
      await prisma.document.update({
        where: { id: u.id },
        data: {
          description: u.description,
          content: u.content,
          tags: u.tags,
          leiArticles: u.leiArticles,
        },
      });
      success++;
    } catch (err) {
      failed++;
      console.error(`  ❌ ${u.entity}-${u.numero}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`\n✅ Atualizados: ${success} | ❌ Falhas: ${failed}`);
}

main()
  .catch((e) => { console.error('Erro fatal:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
