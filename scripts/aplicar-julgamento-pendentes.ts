/**
 * Aplica às decisões de tribunais pendentes os vereditos consolidados na
 * calibração (voto do editor na amostra; IA no restante). Sem --aplicar, só
 * conta o que faria.
 *
 * Entrada: JSON com [{ id, decisao: 'aprovar'|'rejeitar', origem, motivo, nota }].
 * - origem 'editor' → manually_approved / manually_rejected, reviewedBy = editor
 * - origem 'ia-*'   → auto_approved / auto_rejected
 * Aprovados ganham resumo (se não tiverem) e entram na fila de indexação.
 * Só mexe em quem AINDA está pendente (idempotente).
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/aplicar-julgamento-pendentes.ts --decisoes <arquivo.json> [--aplicar]
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { prisma } from '@/lib/prisma';
import { generateDecisionSummary } from '@/lib/tribunal-scrapers/classifier';

const EDITOR = 'danbarral@gmail.com';

interface Decisao {
  id: string;
  decisao: 'aprovar' | 'rejeitar';
  origem: string;
  motivo: string;
  nota: number;
}

async function main() {
  const i = process.argv.indexOf('--decisoes');
  if (i < 0) throw new Error('Informe --decisoes <arquivo.json>');
  const aplicar = process.argv.includes('--aplicar');
  const decisoes: Decisao[] = JSON.parse(readFileSync(process.argv[i + 1], 'utf8'));

  const atuais = await prisma.tribunalDecision.findMany({
    where: { id: { in: decisoes.map((d) => d.id) } },
    select: { id: true, approvalStatus: true, title: true, ementa: true, fullText: true, decisionType: true, tribunalCode: true, summary: true, classificationReasoning: true, embeddingStatus: true },
  });
  const porId = new Map(atuais.map((a) => [a.id, a]));
  const cont: Record<string, number> = {};
  let resumos = 0;

  for (const d of decisoes) {
    const atual = porId.get(d.id);
    if (!atual || atual.approvalStatus !== 'pending') {
      cont['ignorado (não está mais pendente)'] = (cont['ignorado (não está mais pendente)'] || 0) + 1;
      continue;
    }
    const aprovado = d.decisao === 'aprovar';
    const editor = d.origem === 'editor';
    const status = editor ? (aprovado ? 'manually_approved' : 'manually_rejected') : aprovado ? 'auto_approved' : 'auto_rejected';
    cont[status] = (cont[status] || 0) + 1;
    if (!aplicar) continue;

    let summary = atual.summary;
    if (aprovado && !summary) {
      summary = await generateDecisionSummary({ title: atual.title, ementa: atual.ementa, fullText: atual.fullText, decisionType: atual.decisionType, tribunalCode: atual.tribunalCode });
      if (summary) resumos++;
    }
    await prisma.tribunalDecision.update({
      where: { id: d.id },
      data: {
        approvalStatus: status,
        isRelevant: aprovado,
        relevanceScore: aprovado ? Math.max(55, d.nota) : Math.min(19, d.nota),
        classificationReasoning: [atual.classificationReasoning, `${editor ? 'Editor' : `IA (${d.origem})`}: ${d.motivo}`].filter(Boolean).join('; '),
        summary,
        ...(editor ? { reviewedBy: EDITOR, reviewedAt: new Date() } : {}),
        ...(aprovado && atual.embeddingStatus !== 'completed' ? { embeddingStatus: 'pending' } : {}),
      },
    });
  }

  console.log(aplicar ? 'APLICADO' : 'SIMULAÇÃO (use --aplicar para gravar)');
  console.table(cont);
  if (aplicar) console.log(`resumos gerados: ${resumos}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
