import { prisma } from '../lib/prisma';
import { formatLegalContent } from '../lib/format-legal-content';

async function main() {
  const acts = await prisma.legislativeAct.findMany({
    where: { content: { not: null } },
    select: { id: true, fullNumber: true, content: true },
  });

  console.log(`Smoke test em ${acts.length} atos…`);

  let pass = 0;
  const failures: Array<{ id: string; full: string; reason: string }> = [];

  for (const act of acts) {
    if (!act.content) continue;
    try {
      const out = formatLegalContent(act.content);

      // Asserções
      if (!out || out.length === 0) {
        failures.push({ id: act.id, full: act.fullNumber, reason: 'output vazio' });
        continue;
      }
      if (/\[\s*\.{3,}\s*\]/.test(out)) {
        failures.push({ id: act.id, full: act.fullNumber, reason: '[...] remanescente' });
        continue;
      }
      // Aberturas :::alteracao devem ter fechamentos correspondentes
      const opens = (out.match(/:::alteracao/g) || []).length;
      const closes = (out.match(/^:::$/gm) || []).length;
      // Conta apenas fechamentos de alteracao (signature também usa :::)
      // Validação: ao menos as aberturas + signature aberturas == fechamentos
      const sigOpens = (out.match(/:::signature/g) || []).length;
      if (opens + sigOpens > closes) {
        failures.push({ id: act.id, full: act.fullNumber, reason: `desbalanço: abre=${opens + sigOpens} fecha=${closes}` });
        continue;
      }
      // Aspas curvas remanescentes fora de blocos (se :::alteracao foi corretamente detectado, deveriam ter sumido)
      // Tolera: se opens === 0, pode haver aspas decorativas no texto. Se opens > 0, não pode sobrar “.
      if (opens > 0 && /“/.test(out)) {
        failures.push({ id: act.id, full: act.fullNumber, reason: 'aspa “ remanescente apesar de bloco detectado' });
        continue;
      }

      pass++;
    } catch (e: any) {
      failures.push({ id: act.id, full: act.fullNumber, reason: `exceção: ${e.message}` });
    }
  }

  console.log(`✅ Passaram: ${pass}/${acts.length}`);
  if (failures.length) {
    console.log(`❌ Falharam: ${failures.length}`);
    for (const f of failures) {
      console.log(`  - ${f.full} (${f.id}): ${f.reason}`);
    }
    process.exit(1);
  }
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
