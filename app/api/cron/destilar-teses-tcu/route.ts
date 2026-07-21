/**
 * Destila e persiste a tese dos leading cases que cruzaram o limiar, para a
 * base não crescer descatalogada conforme a campanha de ingestão engorda os
 * dossiês (spec 2026-07-21 §4.3).
 *
 * Lote pequeno de propósito: cada destilação é uma chamada de LLM, e o
 * comportamento em regime ainda não foi observado.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyCronAuth } from '@/lib/cron-auth';
import { withCronTelemetry } from '@/lib/cron-telemetry';
import { selecionarElegiveis, persistirDestilacao } from '@/lib/tcu/persistir-tese';
import { coletarTrechosDoAlvo } from '@/lib/tcu/trechos-de-citacao';
import { montarPromptTese, parseRespostaTese } from '@/lib/tcu/destilar-tese';
import { buscarAcordaoPorNumero, escolherCandidato } from '@/lib/tcu/buscar-acordao-tcu';
import { generate } from '@/lib/ai';

export const maxDuration = 300;

const LOTE = 5;
const TIME_BUDGET_MS = 240_000;
const dorme = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  let corpo: Record<string, unknown> = {};

  await withCronTelemetry('destilar-teses-tcu', async () => {
    const inicio = Date.now();
    const candidatos = await selecionarElegiveis(LOTE);

    let ok = 0, semTese = 0, erros = 0, herdadosTotal = 0;
    const processados: string[] = [];

    for (const c of candidatos) {
      if (Date.now() - inicio > TIME_BUDGET_MS) break;
      try {
        const dossie = await coletarTrechosDoAlvo({ numero: c.numero, ano: c.ano });

        const cands = await buscarAcordaoPorNumero(c.numero, c.ano);
        await dorme(1000); // rate limit de 1 req/s contra o TCU
        const proprio = escolherCandidato(cands);

        const { systemPrompt, userContent } = montarPromptTese({
          chave: c.chave,
          ementaPropria: proprio?.ementa ?? null,
          colegiado: proprio?.colegiado ?? null,
          relator: proprio?.relator ?? null,
          dossie,
        });

        // Sem `temperature`: o modelo de `enhancement` a depreciou (HTTP 400).
        const { text } = await generate('enhancement', {
          systemPrompt,
          messages: [{ role: 'user', content: userContent }],
          maxTokens: 4096,
          jsonMode: true,
        });

        const tese = parseRespostaTese(c.chave, text);
        const r = await persistirDestilacao({ numero: c.numero, ano: c.ano }, tese, dossie);
        herdadosTotal += r.herdados;
        processados.push(c.chave);
        if ((tese.teses ?? []).length === 0) semTese++;
        else ok++;
      } catch (e) {
        // Um caso que falha não pode derrubar o lote.
        erros++;
        console.error(`[destilar-teses-tcu] ${c.chave}:`, (e as Error).message);
      }
    }

    const restam = await prisma.teseDestilacao.count({ where: { atual: true } });
    corpo = { candidatos: candidatos.length, ok, semTese, erros, herdadosTotal, processados, totalComTeseAtual: restam };

    return {
      itemsFound: candidatos.length,
      itemsNew: ok,
      itemsError: erros,
      metadata: { semTese, herdadosTotal, totalComTeseAtual: restam },
    };
  });

  return NextResponse.json(corpo);
}
