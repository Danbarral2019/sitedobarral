/**
 * Conserta títulos com mojibake U+FFFD nos atos onde a re-extração de
 * ementa em 2026-05-01 já trouxe a ementa limpa, mas o título ficou com
 * o `�` original (importado antes do charset detection).
 *
 * Estratégia: extrair título oficial do `content` (que já está decodificado
 * corretamente) usando regex que casa com a primeira linha de título do ato
 * (LEI Nº X, DE Y DE MÊS DE YYYY).
 *
 * Bonus: verifica se publishDate bate com o ano extraído. Se não bater,
 * loga warning pra revisão manual.
 *
 * Modos: dry-run | --apply
 */
import { prisma } from '../lib/prisma';
import { CacheInvalidation } from '../lib/cache/redis-client';

const MESES: Record<string, number> = {
  janeiro: 0, fevereiro: 1, 'março': 2, abril: 3, maio: 4, junho: 5,
  julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11,
};

const TITLE_PATTERN = /^(LEI(?:\s+COMPLEMENTAR)?|DECRETO(?:[\s-]LEI)?|MEDIDA PROVISÓRIA|PORTARIA|INSTRUÇÃO NORMATIVA|RESOLUÇÃO)\s+N[ºo°]\s*([\d.]+)\s*,?\s+DE\s+(\d+)[ºo°]?\s+DE\s+(\w+)\s+DE\s+(\d{4})\.?$/im;

async function main() {
  const apply = process.argv.includes('--apply');

  // Pega tanto atos com mojibake no title quanto atos com publishDate.year
  // ≠ year declarado — ambos precisam de correção via título oficial.
  const allActs = await prisma.legislativeAct.findMany({
    select: { id: true, fullNumber: true, title: true, content: true, publishDate: true, year: true },
  });
  const acts = allActs.filter(
    (a) => a.title.includes('�') || a.publishDate.getUTCFullYear() !== a.year,
  );

  console.log(`📋 ${acts.length} atos pra revisar (mojibake no title OU publishDate.year ≠ year)\n   modo: ${apply ? '✅ APPLY' : '🔒 dry-run'}\n`);

  let fixed = 0;
  let dateMismatch = 0;
  for (const a of acts) {
    // Quando o title já está limpo, parse direto dele. Caso contrário,
    // recorre ao content (que está em UTF-8 atual após backfill).
    const titleNoMojibake = !a.title.includes('�');
    const sourceForExtract = titleNoMojibake ? a.title : a.content;
    if (!sourceForExtract) {
      console.log(`❌ ${a.fullNumber}: sem fonte pra extrair title (mojibake + content vazio)`);
      continue;
    }
    const match = TITLE_PATTERN.exec(sourceForExtract);
    if (!match) {
      console.log(`❌ ${a.fullNumber}: regex não casou em ${titleNoMojibake ? 'title' : 'content'}`);
      continue;
    }
    const [, kind, num, day, mes, year] = match;
    // Preserva "1º" quando dia=1 (convenção do Planalto)
    const dayInt = parseInt(day, 10);
    const dayStr = dayInt === 1 ? '1º' : String(dayInt);
    const newTitle = `${kind.toUpperCase()} Nº ${num}, DE ${dayStr} DE ${mes.toUpperCase()} DE ${year}`;

    console.log(`── ${a.fullNumber}`);
    console.log(`   ANTES: ${JSON.stringify(a.title)}`);
    console.log(`   DEPOIS: ${JSON.stringify(newTitle)}`);

    // Verificar publishDate
    const mesIdx = MESES[mes.toLowerCase()];
    const extractedYear = parseInt(year, 10);
    const extractedDay = parseInt(day, 10);
    const extractedDate = mesIdx !== undefined ? new Date(Date.UTC(extractedYear, mesIdx, extractedDay)) : null;

    let dateUpdate: Date | undefined;
    if (extractedDate) {
      const dbY = a.publishDate.getUTCFullYear();
      const dbM = a.publishDate.getUTCMonth();
      const dbD = a.publishDate.getUTCDate();
      const exY = extractedDate.getUTCFullYear();
      const exM = extractedDate.getUTCMonth();
      const exD = extractedDate.getUTCDate();
      const same = dbY === exY && dbM === exM && dbD === exD;
      if (!same) {
        dateMismatch++;
        console.log(`   ⚠️  publishDate diverge: DB=${a.publishDate.toISOString().slice(0, 10)} extracted=${extractedDate.toISOString().slice(0, 10)} year=${a.year}`);
        if (extractedYear === a.year) {
          console.log(`   → vai consertar publishDate (year extraído bate com ato)`);
          dateUpdate = extractedDate;
        } else {
          console.log(`   → year extraído (${extractedYear}) ≠ year do ato (${a.year}) — não consertar automaticamente`);
        }
      }
    }

    if (apply) {
      await prisma.legislativeAct.update({
        where: { id: a.id },
        data: { title: newTitle, ...(dateUpdate ? { publishDate: dateUpdate } : {}) },
      });
      fixed++;
      console.log(`   💾 gravado`);
    }
  }

  // Audit extra: outros atos com publishDate ≠ year
  const all = await prisma.legislativeAct.findMany({
    select: { id: true, fullNumber: true, year: true, publishDate: true, title: true },
  });
  const dateOnly: typeof all = [];
  for (const a of all) {
    const dbY = a.publishDate.getUTCFullYear();
    if (dbY !== a.year && !acts.find((x) => x.id === a.id)) {
      dateOnly.push(a);
    }
  }
  if (dateOnly.length > 0) {
    console.log(`\n📊 Outros atos com publishDate ≠ year (não tinham mojibake — precisam revisão manual):`);
    for (const a of dateOnly) {
      console.log(`   - ${a.fullNumber}: year=${a.year} publishDate=${a.publishDate.toISOString().slice(0, 10)} title=${JSON.stringify(a.title)}`);
    }
  }

  console.log(`\n════════════════════════════════════════`);
  console.log(`   ✅ ${fixed} títulos corrigidos${apply ? '' : ' (dry-run)'}`);
  console.log(`   ⚠️  ${dateMismatch} datas inconsistentes detectadas`);

  if (apply && fixed > 0) {
    console.log(`\n🔄 Invalidando cache...`);
    await CacheInvalidation.legislativeActs();
    console.log(`✅ Cache invalidado.`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
