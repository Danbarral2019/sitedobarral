/**
 * Sobrescreve `description` e `content` de Document(category='enunciados') no DB
 * com o texto literal validado em `data/enunciados.ts` (já comparado com o PDF
 * oficial INCP de 2024 e Excel-fonte IBDA/CJF).
 *
 * Motivo: auditoria detectou 117/129 enunciados com texto errado (IBDA/INCP
 * 100% trocados, CJF parcial truncado). Bug pré-existente, não causado pelos
 * commits recentes do summary IA.
 *
 * Identificação do enunciado: (entityType + enunciadoNumber) → orgao + numero
 * no static file.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/fix-enunciados-text.ts            # dry-run
 *   npx dotenv -e .env.local -- npx tsx scripts/fix-enunciados-text.ts --apply
 */

import { prisma } from '../lib/prisma';
import { ENUNCIADOS } from '../data/enunciados';

const norm = (s: string) =>
  s.replace(/\(Aprovado por[^)]*\)\s*$/i, '').replace(/\s+/g, ' ').trim();

async function main() {
  const apply = process.argv.includes('--apply');
  console.log('=== Fix: enunciados.description/content a partir de data/enunciados.ts ===');
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
    },
  });

  console.log(`Documentos no DB: ${docs.length}`);
  console.log(`Static reference: ${ENUNCIADOS.length} (CJF + IBDA + INCP)\n`);

  let willUpdate = 0;
  let alreadyOk = 0;
  let noMatch = 0;
  const updates: { id: string; title: string; entity: string; numero: number; newText: string }[] = [];

  for (const e of ENUNCIADOS) {
    const doc = docs.find(
      (d) => d.entityType === e.orgao && Number(d.enunciadoNumber) === e.numero
    );
    if (!doc) {
      noMatch++;
      console.log(`  ⚠️  ${e.orgao}-${e.numero}: sem doc correspondente no DB`);
      continue;
    }
    const expectedText = norm(e.texto);
    const dbContentClean = norm((doc.content ?? '').split('\n\nFase:')[0]);
    if (dbContentClean === expectedText && norm(doc.description ?? '') === expectedText) {
      alreadyOk++;
      continue;
    }
    willUpdate++;
    updates.push({
      id: doc.id,
      title: doc.title,
      entity: e.orgao,
      numero: e.numero,
      newText: expectedText,
    });
  }

  console.log(`\nA atualizar: ${willUpdate}`);
  console.log(`Já corretos: ${alreadyOk}`);
  console.log(`Sem correspondência: ${noMatch}`);

  console.log('\nAmostra (3 primeiros a atualizar):');
  for (const u of updates.slice(0, 3)) {
    console.log(`  ${u.entity}-${u.numero} [${u.id.slice(0, 8)}] ${u.title}`);
    console.log(`    novo: "${u.newText.slice(0, 160)}…"`);
  }

  if (!apply) {
    console.log('\n(dry-run — nada foi alterado. Re-executar com --apply para gravar.)');
    return;
  }

  let success = 0;
  let failed = 0;
  for (const u of updates) {
    try {
      await prisma.document.update({
        where: { id: u.id },
        data: {
          description: u.newText,
          content: u.newText,
        },
      });
      success++;
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ❌ ${u.entity}-${u.numero}: ${msg}`);
    }
  }

  console.log(`\n✅ Atualizados: ${success} | ❌ Falhas: ${failed}`);
}

main()
  .catch((e) => { console.error('Erro fatal:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
