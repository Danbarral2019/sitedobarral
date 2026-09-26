/**
 * Julga com IA as decisões de tribunais presas em "pending" (score 20-54 do
 * scoring por palavra-chave). NÃO grava no banco: produz um JSON com o
 * veredito da IA para calibração humana antes de qualquer aplicação.
 *
 * Fica de fora o que a IA não tem como julgar: ementa com menos de
 * EMENTA_MINIMA caracteres (no TCE-RS a "ementa" é só metadado da consulta).
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/julgar-pendentes-tribunais.ts --saida <arquivo.json> [--limite N]
 *
 * Com --rejeitados-por-palavra-chave, julga em vez disso as decisões rejeitadas
 * só pelo scoring (sem passagem pela IA) cuja ementa menciona licitação.
 *
 * Custo: 1 chamada Gemini Flash por decisão.
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { prisma } from '@/lib/prisma';
import { julgarAmbiguoComIA, IA_AMBIGUOS_VERSAO } from '@/lib/tribunal-scrapers/classifier';

const EMENTA_MINIMA = 150;
const CONCORRENCIA = 4;

function arg(nome: string): string | undefined {
  const i = process.argv.indexOf(nome);
  return i > 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const saida = arg('--saida');
  if (!saida) throw new Error('Informe --saida <arquivo.json>');
  const limite = Number(arg('--limite')) || undefined;

  const rejeitadosKw = process.argv.includes('--rejeitados-por-palavra-chave');
  const pendentes = await prisma.tribunalDecision.findMany({
    where: rejeitadosKw
      ? {
          approvalStatus: 'auto_rejected',
          ementa: { contains: 'licita', mode: 'insensitive' },
          NOT: { classificationReasoning: { contains: 'IA' } },
        }
      : { approvalStatus: 'pending' },
    select: {
      id: true, tribunalCode: true, decisionType: true, decisionNumber: true, title: true,
      ementa: true, relevanceScore: true, url: true, dataJulgamento: true,
    },
    orderBy: { createdAt: 'desc' },
    take: limite,
  });
  const julgaveis = pendentes.filter((d) => (d.ementa || '').trim().length >= EMENTA_MINIMA);
  console.log(`pendentes: ${pendentes.length} | julgáveis: ${julgaveis.length} | sem texto suficiente: ${pendentes.length - julgaveis.length}`);

  const resultado: Array<Record<string, unknown>> = [];
  let feitos = 0;
  for (let i = 0; i < julgaveis.length; i += CONCORRENCIA) {
    const lote = julgaveis.slice(i, i + CONCORRENCIA);
    const julgamentos = await Promise.all(
      lote.map((d) =>
        julgarAmbiguoComIA({ title: d.title, ementa: d.ementa, decisionType: d.decisionType, tribunalCode: d.tribunalCode }),
      ),
    );
    lote.forEach((d, k) => resultado.push({ ...d, ia: julgamentos[k] }));
    feitos += lote.length;
    if (feitos % 40 === 0) console.log(`  ${feitos}/${julgaveis.length}`);
  }

  const cont: Record<string, number> = {};
  for (const r of resultado) {
    const v = (r.ia as { veredito?: string } | null)?.veredito ?? 'falha';
    const k = `${r.tribunalCode}:${v}`;
    cont[k] = (cont[k] || 0) + 1;
  }
  console.table(cont);
  writeFileSync(saida, JSON.stringify({ versao: IA_AMBIGUOS_VERSAO, geradoEm: new Date().toISOString(), itens: resultado }, null, 1));
  console.log(`gravado em ${saida}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
