/**
 * Rejulga, com a IA lendo também o texto da decisão (fullText), as decisões
 * rejeitadas de um tribunal. Criado para o TCDF, cuja carga inicial rodou
 * com a IA vendo só a ementa, que lá descreve apenas o objeto do processo.
 *
 * Só APROVA (rejeição confirmada fica como está) e marca cada item julgado,
 * para não repetir: o reasoning ganha "[rejulgado com texto]".
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/rejulgar-com-texto.ts --tribunal TCDF [--aplicar]
 */
import 'dotenv/config';
import { prisma } from '@/lib/prisma';
import { julgarAmbiguoComIA, generateDecisionSummary } from '@/lib/tribunal-scrapers/classifier';

const MARCA = '[rejulgado com texto]';
const CONCORRENCIA = 4;

async function main() {
  const i = process.argv.indexOf('--tribunal');
  const tribunal = i > 0 ? process.argv[i + 1] : undefined;
  if (!tribunal) throw new Error('Informe --tribunal <código>');
  const aplicar = process.argv.includes('--aplicar');

  const alvo = await prisma.tribunalDecision.findMany({
    where: {
      tribunalCode: tribunal,
      approvalStatus: 'auto_rejected',
      fullText: { not: null },
      NOT: { classificationReasoning: { contains: MARCA } },
    },
    select: { id: true, title: true, ementa: true, fullText: true, decisionType: true, classificationReasoning: true, summary: true },
  });
  console.log(`${tribunal}: ${alvo.length} rejeitadas com texto da decisão, ainda não rejulgadas`);

  const cont = { aprovar: 0, rejeitar: 0, duvida: 0, falha: 0 };
  const aprovadas: string[] = [];
  for (let k = 0; k < alvo.length; k += CONCORRENCIA) {
    await Promise.all(
      alvo.slice(k, k + CONCORRENCIA).map(async (d) => {
        const ia = await julgarAmbiguoComIA({ title: d.title, ementa: d.ementa, fullText: d.fullText, decisionType: d.decisionType, tribunalCode: tribunal });
        const v = ia?.veredito ?? 'falha';
        cont[v]++;
        if (!aplicar || !ia) return;
        const aprovado = ia.veredito === 'aprovar';
        if (aprovado) aprovadas.push(`${d.title} | ${ia.motivo.slice(0, 120)}`);
        await prisma.tribunalDecision.update({
          where: { id: d.id },
          data: {
            classificationReasoning: [d.classificationReasoning, `${MARCA} IA: ${ia.motivo}`].filter(Boolean).join('; '),
            ...(aprovado
              ? {
                  approvalStatus: 'auto_approved',
                  isRelevant: true,
                  relevanceScore: Math.max(55, ia.nota),
                  embeddingStatus: 'pending',
                  summary: d.summary || (await generateDecisionSummary({ title: d.title, ementa: d.ementa, fullText: d.fullText, tribunalCode: tribunal })),
                }
              : {}),
          },
        });
      }),
    );
  }

  console.log(aplicar ? 'APLICADO' : 'SIMULAÇÃO (use --aplicar)', cont);
  aprovadas.slice(0, 15).forEach((a) => console.log('  +', a));
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
