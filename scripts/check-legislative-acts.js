require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Buscar todos os atos normativos
  const acts = await prisma.legislativeAct.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      title: true,
      fullNumber: true,
      type: true,
      issuer: true,
      officialUrl: true,
      pdfUrl: true,
      createdAt: true,
    }
  });

  console.log('=== ATOS NORMATIVOS - AUDITORIA ===');
  console.log('Total:', acts.length);
  console.log('');

  // Agrupar por tipo
  const byType = {};
  acts.forEach(act => {
    const t = act.type || 'sem-tipo';
    if (!byType[t]) byType[t] = [];
    byType[t].push(act);
  });

  for (const [tipo, items] of Object.entries(byType)) {
    console.log('\n=== ' + tipo.toUpperCase() + ' (' + items.length + ') ===');
    items.forEach(act => {
      const date = new Date(act.createdAt).toISOString().split('T')[0];
      const hasUrl = (act.officialUrl || act.pdfUrl) ? 'URL_OK' : 'SEM_URL';
      console.log(hasUrl + ' | ' + date + ' | ' + act.fullNumber);
      console.log('     Titulo: ' + act.title.substring(0, 80));
      if (act.officialUrl) {
        console.log('     URL: ' + act.officialUrl);
      }
    });
  }

  // Identificar suspeitos (sem URL)
  console.log('\n\n=== ATOS SEM URL (POSSIVEIS ALUCINACOES) ===');
  const semUrl = acts.filter(a => !a.officialUrl && !a.pdfUrl);
  if (semUrl.length === 0) {
    console.log('Nenhum ato sem URL encontrado.');
  } else {
    semUrl.forEach(act => {
      const date = new Date(act.createdAt).toISOString().split('T')[0];
      console.log('ID: ' + act.id);
      console.log('   FullNumber: ' + act.fullNumber);
      console.log('   Titulo: ' + act.title);
      console.log('   Criado: ' + date);
      console.log('');
    });
  }

  // Identificar atos criados por scripts automaticos (antes de hoje)
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  console.log('\n=== ATOS CRIADOS HOJE (VERIFICADOS PELO USUARIO) ===');
  const criadosHoje = acts.filter(a => new Date(a.createdAt) >= hoje);
  if (criadosHoje.length === 0) {
    console.log('Nenhum ato criado hoje.');
  } else {
    criadosHoje.forEach(act => {
      console.log('- ' + act.fullNumber + ' - ' + act.title.substring(0, 60));
    });
  }
  console.log('Total hoje:', criadosHoje.length);

  console.log('\n=== ATOS CRIADOS ANTES DE HOJE ===');
  const criadosAntes = acts.filter(a => new Date(a.createdAt) < hoje);
  criadosAntes.forEach(act => {
    const date = new Date(act.createdAt).toISOString().split('T')[0];
    const hasUrl = (act.officialUrl || act.pdfUrl) ? 'URL_OK' : 'SEM_URL';
    console.log(hasUrl + ' | ' + date + ' | ' + act.fullNumber);
    console.log('     ID: ' + act.id);
    console.log('     Titulo: ' + act.title.substring(0, 70));
    if (act.officialUrl) {
      console.log('     URL: ' + act.officialUrl);
    }
    console.log('');
  });
  console.log('Total antes de hoje:', criadosAntes.length);

  await prisma.$disconnect();
}

main().catch(console.error);
