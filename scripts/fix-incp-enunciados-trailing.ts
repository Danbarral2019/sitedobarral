/**
 * Conserta enunciados INCP que têm boilerplate do site no final (sidebar
 * "Baixe o PDF", lista de membros, categorias, tags da edição etc.).
 *
 * Cada enunciado INCP termina com "(Aprovado por <unanimidade|maioria
 * qualificada|maioria simples>)" seguido por lixo da página. Truncamos
 * imediatamente após o ")" final.
 *
 * Modos: dry-run | --apply
 */
import { prisma } from '../lib/prisma';

const TRUNCATE_PATTERN = /\(Aprovado\s+por\s+(?:unanimidade|maioria\s+qualificada|maioria\s+simples|maioria)\)/i;

async function main() {
  const apply = process.argv.includes('--apply');
  const docs = await prisma.document.findMany({
    where: { category: 'enunciados', title: { contains: 'INCP' } },
    select: { id: true, title: true, description: true, content: true },
  });

  console.log(`📋 ${docs.length} enunciados INCP\n`);

  let toFix = 0;
  const updates: { id: string; title: string; before: string; after: string }[] = [];

  for (const d of docs) {
    const desc = d.description ?? '';
    const m = TRUNCATE_PATTERN.exec(desc);
    if (!m) continue;
    const cutAt = m.index + m[0].length;
    const trailing = desc.slice(cutAt).trim();
    if (trailing.length === 0) continue; // já está limpo

    // Truncar e adicionar ponto final se faltar
    let newDesc = desc.slice(0, cutAt).trim();
    if (!/[.;:!?]$/.test(newDesc)) newDesc += '.';

    updates.push({ id: d.id, title: d.title, before: desc, after: newDesc });
    toFix++;
  }

  console.log(`Enunciados com trailing boilerplate: ${updates.length}\n`);
  for (const u of updates) {
    const trail = u.before.slice(u.after.length - 1).slice(0, 80);
    console.log(`   ${u.title}`);
    console.log(`     remove: ${JSON.stringify(trail)}${u.before.length - u.after.length > 80 ? `... (-${u.before.length - u.after.length} chars total)` : ''}`);
  }

  if (!apply) {
    console.log(`\n🔒 dry-run. Use --apply pra gravar.`);
    await prisma.$disconnect();
    return;
  }

  if (updates.length === 0) {
    console.log(`\n✅ Sem mudanças.`);
    await prisma.$disconnect();
    return;
  }

  console.log(`\n💾 Aplicando ${updates.length} updates...`);
  for (const u of updates) {
    await prisma.document.update({
      where: { id: u.id },
      data: { description: u.after, content: u.after },
    });
  }
  console.log(`✅ ${updates.length} updates aplicados.`);
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
