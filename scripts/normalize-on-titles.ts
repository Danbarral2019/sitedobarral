/**
 * Normaliza títulos de Orientação Normativa para o padrão canônico
 * `Orientação Normativa AGU nº N/AAAA` (docs/legacy/AGU_ORIENTACOES_NORMATIVAS.md:23).
 *
 * ⚠️ ORDEM IMPORTA: só rode isto DEPOIS de o ponto de escrita estar corrigido.
 * Em 2026 já houve uma padronização (`scripts/.archived/standardize-ons.js`) que
 * migrou os dados sem consertar o cron — o cron continuou gravando o título
 * abreviado e a bagunça voltou. O cron foi corrigido em 15/07/2026
 * (`app/api/cron/import-documents/route.ts` agora delega ao helper com
 * versionamento), então esta normalização não regride.
 *
 * NÃO toca nos títulos `Orientação Normativa CNU/CGU/AGU nº NN/AAAA` — esse é o
 * nome oficial das ONs da CNU, não um desvio de padrão.
 *
 * Uso: npx tsx scripts/normalize-on-titles.ts            # dry-run
 *      npx tsx scripts/normalize-on-titles.ts --execute
 */
import { prisma } from '../lib/prisma';

const EXECUTE = process.argv.includes('--execute');
const CANONICO = /^Orientação Normativa AGU nº \d{1,3}\/\d{4}$/;
const ABREVIADO = /^ON (\d{1,3})\/(\d{4})$/;

async function main() {
  console.log(EXECUTE ? '🔴 EXECUÇÃO\n' : '🔵 DRY-RUN (use --execute)\n');

  const ons = await prisma.document.findMany({
    where: { category: 'orientacao-normativa' },
    select: { id: true, title: true, onNumber: true, onYear: true, content: true },
  });

  const alvos: { id: string; de: string; para: string }[] = [];
  const semRegra: string[] = [];

  for (const on of ons) {
    if (CANONICO.test(on.title)) continue;
    if (/CNU|CGU/.test(on.title)) continue; // nome oficial da CNU — não mexer

    const m = on.title.match(ABREVIADO);
    // Prefere onNumber/onYear (fonte estruturada); cai para o título só se preciso.
    const numero = on.onNumber ?? (m ? parseInt(m[1], 10) : null);
    const ano = on.onYear ?? (m ? parseInt(m[2], 10) : null);

    if (!numero || !ano) { semRegra.push(`"${on.title}" (id=${on.id})`); continue; }
    alvos.push({ id: on.id, de: on.title, para: `Orientação Normativa AGU nº ${numero}/${ano}` });
  }

  console.log(`ONs totais: ${ons.length}`);
  console.log(`Já canônicas: ${ons.filter((o) => CANONICO.test(o.title)).length}`);
  console.log(`CNU (preservadas): ${ons.filter((o) => /CNU|CGU/.test(o.title)).length}`);
  console.log(`A renomear: ${alvos.length}\n`);
  for (const a of alvos) console.log(`   "${a.de}"  →  "${a.para}"`);
  if (semRegra.length) {
    console.log(`\n⚠️ Sem onNumber/onYear e fora do padrão — revisar à mão: ${semRegra.length}`);
    for (const s of semRegra) console.log(`   · ${s}`);
  }

  // Guarda: renomear não pode criar título duplicado.
  for (const a of alvos) {
    const colide = ons.find((o) => o.title === a.para && o.id !== a.id);
    if (colide) {
      console.error(`\n🚨 ABORTADO: renomear ${a.id} para "${a.para}" colidiria com ${colide.id}.`);
      console.error('   Isso indica duplicata remanescente. Investigue antes de prosseguir.');
      await prisma.$disconnect();
      process.exit(1);
    }
  }

  if (!EXECUTE) { console.log('\n🔵 Nada alterado.'); await prisma.$disconnect(); return; }

  for (const a of alvos) {
    await prisma.document.update({ where: { id: a.id }, data: { title: a.para } });
    console.log(`✅ ${a.para}`);
  }
  console.log(`\n${alvos.length} título(s) normalizado(s).`);

  const restam = await prisma.document.count({
    where: { category: 'orientacao-normativa', title: { startsWith: 'ON ' } },
  });
  console.log(`Títulos abreviados restantes: ${restam} (esperado 0)`);

  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
