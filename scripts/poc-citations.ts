/**
 * POC/smoke da Citations API integrada (Fase 3): exercita
 * generateAnswerWithCitations ponta-a-ponta e prova que o Claude cita as fontes
 * — inclusive ARTIGOS DA LEI — com cited_text ancorado literalmente. Usa uma
 * pergunta de sanções (o caso onde o modelo antes INVENTAVA o teor dos artigos).
 * Read-only no banco.
 *
 * Uso: npx tsx scripts/poc-citations.ts
 */
import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });

import { generateAnswerWithCitations } from '../lib/rag/answerService';

const QUERY = 'Quais as sanções de impedimento de licitar e contratar na Lei 14.133 e seus prazos?';

async function main() {
  const { answer, citations, context } = await generateAnswerWithCitations(
    { query: QUERY, filters: {}, maxResults: 8, useCache: false },
  );

  console.log(`Documentos citáveis montados: ${context.citationDocuments.length}`);
  console.log(`  (chunks + artigos da Lei + atos)`);
  const artigos = context.citationDocuments.filter((d) => d.title.startsWith('Lei 14.133/2021 — Art.'));
  console.log(`  artigos da Lei como documentos: ${artigos.length} → ${artigos.map((a) => a.title.replace('Lei 14.133/2021 — ', '')).join(', ')}`);

  console.log(`\n===== RESPOSTA (${answer.length} chars) =====`);
  console.log(answer.slice(0, 1000) + (answer.length > 1000 ? '…' : ''));

  console.log(`\n===== CITAÇÕES VERIFICADAS: ${citations.length} =====`);
  let ancoradas = 0;
  let artigosLeicitados = 0;
  for (const c of citations) {
    const src = context.citationDocuments[c.documentIndex];
    const ok = src ? src.text.includes(c.citedText) : false;
    if (ok) ancoradas++;
    if (src?.title.startsWith('Lei 14.133/2021 — Art.')) artigosLeicitados++;
  }
  console.log(`  ancoradas literalmente na fonte: ${ancoradas}/${citations.length}`);
  console.log(`  citações de ARTIGOS DA LEI: ${artigosLeicitados}`);
  for (const c of citations.slice(0, 8)) {
    const src = context.citationDocuments[c.documentIndex];
    console.log(`  • [${c.documentTitle ?? src?.title}] "${c.citedText.slice(0, 90)}…"`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error('POC FALHOU:', e); process.exit(1); });
