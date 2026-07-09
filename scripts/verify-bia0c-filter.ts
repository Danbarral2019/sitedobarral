/**
 * BIA-0c — verificação end-to-end do pós-filtro por matrícula no card de IA.
 * Roda assembleAnswerContext 3× para a mesma query:
 *   1) sem enrolledCourseIds  → baseline (comportamento antigo, sem filtro)
 *   2) enrolledCourseIds=[]    → matriculado em NADA (deve zerar docs restritos)
 *   3) enrolledCourseIds=[C]   → matriculado no curso do doc restrito (deve voltar)
 * Restrito = doc com courseId e não isCommon. Só usa embeddings Gemini (R$~0).
 */
import { assembleAnswerContext } from '@/lib/rag/answerContext';
import { prisma } from '@/lib/prisma';

// courseIds preenchido em formattedResults só para docs NÃO-isCommon com courseId.
const restrictedDocs = (ctx: Awaited<ReturnType<typeof assembleAnswerContext>>) =>
  ctx.formattedResults.filter((r) => r.courseIds && r.courseIds.length > 0);

async function run(query: string, enrolledCourseIds?: string[]) {
  const ctx = await assembleAnswerContext({
    query,
    filters: {},
    maxResults: 8,
    useCache: false,
    ...(enrolledCourseIds !== undefined ? { enrolledCourseIds } : {}),
  });
  return ctx;
}

async function main() {
  const query = process.argv[2] || 'estudo técnico preliminar planejamento da contratação';
  console.log(`Query: "${query}"\n`);

  const base = await run(query); // sem filtro
  const restr = restrictedDocs(base);
  console.log(`1) SEM filtro (baseline): ${base.formattedResults.length} docs, ${restr.length} restritos`);
  for (const r of restr) console.log(`     restrito: [curso ${r.courseIds}] ${r.title.slice(0, 55)}`);

  if (restr.length === 0) {
    console.log('\n⚠️ Esta query não recuperou docs restritos — teste vacuous. Tente outra query como argumento.');
    return;
  }

  const targetCourse = restr[0].courseIds![0];

  const none = await run(query, []); // matriculado em nada
  const noneRestr = restrictedDocs(none);
  console.log(`\n2) enrolledCourseIds=[] (matriculado em NADA): ${none.formattedResults.length} docs, ${noneRestr.length} restritos`);

  const enrolled = await run(query, [targetCourse]); // matriculado no curso do doc
  const enrRestr = restrictedDocs(enrolled);
  console.log(`3) enrolledCourseIds=[${targetCourse}] (matriculado): ${enrolled.formattedResults.length} docs, ${enrRestr.length} restritos`);

  console.log('');
  const pass2 = noneRestr.length === 0;
  const pass3 = enrRestr.some((r) => r.courseIds?.includes(targetCourse));
  console.log(pass2 ? '✓ (2) sem matrícula NÃO expõe restritos' : `✗ (2) FALHOU: ${noneRestr.length} restritos vazaram`);
  console.log(pass3 ? `✓ (3) matriculado no curso ${targetCourse} recupera o material` : `✗ (3) FALHOU: doc do curso ${targetCourse} não voltou`);
  console.log('');
  console.log(pass2 && pass3 ? '✅ BIA-0c VERIFICADO' : '❌ verificação FALHOU');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
