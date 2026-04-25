import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter });

async function main() {
  const fiveDaysAgo = new Date();
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

  console.log('='.repeat(80));
  console.log('CHECK MISSING CONTENT - Documentos e Atos Legislativos sem conteudo textual');
  console.log(`Periodo: ultimos 5 dias (desde ${fiveDaysAgo.toISOString().split('T')[0]})`);
  console.log('='.repeat(80));

  // ── Documents ──────────────────────────────────────────────────────────────
  const documents = await prisma.document.findMany({
    where: {
      uploadedAt: { gte: fiveDaysAgo },
    },
    orderBy: { uploadedAt: 'desc' },
  });

  const docsNoContent = documents.filter(
    (d) => !d.content || d.content.trim() === ''
  );

  const docsWithUrl = docsNoContent.filter((d) => d.url && d.url.trim() !== '');
  const docsWithoutUrl = docsNoContent.filter((d) => !d.url || d.url.trim() === '');

  console.log('\n');
  console.log('='.repeat(80));
  console.log(`DOCUMENT - Total inseridos nos ultimos 5 dias: ${documents.length}`);
  console.log(`DOCUMENT - Sem content: ${docsNoContent.length}`);
  console.log(`DOCUMENT - Com content: ${documents.length - docsNoContent.length}`);
  console.log('='.repeat(80));

  if (docsWithUrl.length > 0) {
    console.log(`\n--- DOCUMENT: Sem content, COM URL (${docsWithUrl.length}) ---\n`);
    for (const d of docsWithUrl) {
      console.log(`  ID:          ${d.id}`);
      console.log(`  Titulo:      ${d.title}`);
      console.log(`  Categoria:   ${d.category}`);
      console.log(`  URL:         ${d.url}`);
      console.log(`  content:     ${d.content ? `SIM (${d.content.length} chars)` : 'NAO'}`);
      console.log(`  description: ${d.description ? `SIM (${d.description.length} chars)` : 'NAO'}`);
      console.log(`  Inserido em: ${d.uploadedAt.toISOString()}`);
      console.log('');
    }
  }

  if (docsWithoutUrl.length > 0) {
    console.log(`\n--- DOCUMENT: Sem content, SEM URL (${docsWithoutUrl.length}) ---\n`);
    for (const d of docsWithoutUrl) {
      console.log(`  ID:          ${d.id}`);
      console.log(`  Titulo:      ${d.title}`);
      console.log(`  Categoria:   ${d.category}`);
      console.log(`  URL:         ${d.url || '(vazio)'}`);
      console.log(`  content:     ${d.content ? `SIM (${d.content.length} chars)` : 'NAO'}`);
      console.log(`  description: ${d.description ? `SIM (${d.description.length} chars)` : 'NAO'}`);
      console.log(`  Inserido em: ${d.uploadedAt.toISOString()}`);
      console.log('');
    }
  }

  if (docsNoContent.length === 0) {
    console.log('\n  (Nenhum documento sem content nos ultimos 5 dias)\n');
  }

  // ── LegislativeAct ────────────────────────────────────────────────────────
  const acts = await prisma.legislativeAct.findMany({
    where: {
      createdAt: { gte: fiveDaysAgo },
    },
    orderBy: { createdAt: 'desc' },
  });

  const actsNoContent = acts.filter(
    (a) => !a.content || a.content.trim() === ''
  );

  const actsWithUrl = actsNoContent.filter(
    (a) => (a.officialUrl && a.officialUrl.trim() !== '') || (a.pdfUrl && a.pdfUrl.trim() !== '')
  );
  const actsWithoutUrl = actsNoContent.filter(
    (a) => (!a.officialUrl || a.officialUrl.trim() === '') && (!a.pdfUrl || a.pdfUrl.trim() === '')
  );

  console.log('\n');
  console.log('='.repeat(80));
  console.log(`LEGISLATIVEACT - Total inseridos nos ultimos 5 dias: ${acts.length}`);
  console.log(`LEGISLATIVEACT - Sem content: ${actsNoContent.length}`);
  console.log(`LEGISLATIVEACT - Com content: ${acts.length - actsNoContent.length}`);
  console.log('='.repeat(80));

  if (actsWithUrl.length > 0) {
    console.log(`\n--- LEGISLATIVEACT: Sem content, COM URL (${actsWithUrl.length}) ---\n`);
    for (const a of actsWithUrl) {
      console.log(`  ID:          ${a.id}`);
      console.log(`  fullNumber:  ${a.fullNumber}`);
      console.log(`  Titulo:      ${a.title}`);
      console.log(`  officialUrl: ${a.officialUrl || '(vazio)'}`);
      console.log(`  pdfUrl:      ${a.pdfUrl || '(vazio)'}`);
      console.log(`  content:     ${a.content ? `SIM (${a.content.length} chars)` : 'NAO'}`);
      console.log(`  ementa:      ${a.ementa ? `SIM (${a.ementa.length} chars)` : 'NAO'}`);
      console.log(`  Inserido em: ${a.createdAt.toISOString()}`);
      console.log('');
    }
  }

  if (actsWithoutUrl.length > 0) {
    console.log(`\n--- LEGISLATIVEACT: Sem content, SEM URL (${actsWithoutUrl.length}) ---\n`);
    for (const a of actsWithoutUrl) {
      console.log(`  ID:          ${a.id}`);
      console.log(`  fullNumber:  ${a.fullNumber}`);
      console.log(`  Titulo:      ${a.title}`);
      console.log(`  officialUrl: ${a.officialUrl || '(vazio)'}`);
      console.log(`  pdfUrl:      ${a.pdfUrl || '(vazio)'}`);
      console.log(`  content:     ${a.content ? `SIM (${a.content.length} chars)` : 'NAO'}`);
      console.log(`  ementa:      ${a.ementa ? `SIM (${a.ementa.length} chars)` : 'NAO'}`);
      console.log(`  Inserido em: ${a.createdAt.toISOString()}`);
      console.log('');
    }
  }

  if (actsNoContent.length === 0) {
    console.log('\n  (Nenhum ato legislativo sem content nos ultimos 5 dias)\n');
  }

  // ── Resumo final ──────────────────────────────────────────────────────────
  console.log('\n');
  console.log('='.repeat(80));
  console.log('RESUMO FINAL');
  console.log('='.repeat(80));
  console.log(`Document     - Total: ${documents.length} | Sem content: ${docsNoContent.length} (com URL: ${docsWithUrl.length}, sem URL: ${docsWithoutUrl.length})`);
  console.log(`LegislativeAct - Total: ${acts.length} | Sem content: ${actsNoContent.length} (com URL: ${actsWithUrl.length}, sem URL: ${actsWithoutUrl.length})`);
  console.log('='.repeat(80));
}

main()
  .catch((err) => {
    console.error('Erro:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
