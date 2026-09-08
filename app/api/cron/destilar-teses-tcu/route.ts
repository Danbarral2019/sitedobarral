/**
 * Destila e persiste a tese dos leading cases que cruzaram o limiar, para a
 * base não crescer descatalogada conforme a campanha de ingestão engorda os
 * dossiês (spec 2026-07-21 §4.3).
 *
 * Lote pequeno de propósito: cada destilação é uma chamada de LLM, e o
 * comportamento em regime ainda não foi observado.
 *
 * FILTRO POR MATÉRIA (11/08/2026): o candidato só é destilado se o tema estiver
 * na base do site (lib/tcu/tema-acordao.ts). O limiar de citação no voto, usado
 * sozinho, seleciona matéria repetitiva — 95 das 177 primeiras destilações
 * saíram de pessoal, que não é a matéria da ferramenta. A classificação usa a
 * ementa que este mesmo fluxo já busca no TCU, então custa uma chamada curta e
 * economiza a destilação inteira quando a matéria não interessa.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyCronAuth } from '@/lib/cron-auth';
import { withCronTelemetry } from '@/lib/cron-telemetry';
import { selecionarElegiveis, persistirDestilacao, type IdentidadeAlvo } from '@/lib/tcu/persistir-tese';
import { coletarTrechosDoAlvo } from '@/lib/tcu/trechos-de-citacao';
import { montarPromptTese, parseRespostaTese } from '@/lib/tcu/destilar-tese';
import { buscarAcordaoPorNumero, escolherCandidato } from '@/lib/tcu/buscar-acordao-tcu';
import { classificarCandidatos, registrarIdentidadeIrresolvida } from '@/lib/tcu/resolver-identidade';
import { colegiadoPorConvergencia } from '@/lib/tcu/colegiado-por-convergencia';
import { garantirTemaDeAlvo, naBase } from '@/lib/tcu/tema-acordao';
import { generate } from '@/lib/ai';

export const maxDuration = 300;

const LOTE = 5;
/**
 * A seleção traz mais candidatos do que o lote porque a maioria será descartada
 * por matéria (pessoal domina o topo do ranking de citações). Sem essa folga o
 * cron destilaria zero caso por dia e a base pararia de crescer em silêncio.
 */
const CANDIDATOS_POR_RODADA = LOTE * 8;
const TIME_BUDGET_MS = 240_000;
const dorme = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  let corpo: Record<string, unknown> = {};

  await withCronTelemetry('destilar-teses-tcu', async () => {
    const inicio = Date.now();
    const candidatos = await selecionarElegiveis(CANDIDATOS_POR_RODADA);

    let ok = 0, semTese = 0, erros = 0, herdadosTotal = 0;
    let foraDaBase = 0, semTema = 0, nivel1 = 0, nivel2 = 0, semColegiado = 0;
    const processados: string[] = [];

    for (const c of candidatos) {
      if (Date.now() - inicio > TIME_BUDGET_MS) break;
      if (ok + semTese >= LOTE) break;
      try {
        const cands = await buscarAcordaoPorNumero(c.numero, c.ano);
        await dorme(1000); // rate limit de 1 req/s contra o TCU

        // Identidade oficial ANTES de gastar a destilação (spec §4.3):
        // `classificarCandidatos` aplica a mesma cardinalidade estrita de
        // `resolverIdentidade` (lib/tcu/resolver-identidade.ts), sem
        // requisição de rede a mais — os candidatos já estão em mãos.
        const classificacao = classificarCandidatos(cands);

        let ementaEscolhida: string | undefined;
        let colegiadoEscolhido: string | null = null;
        let relatorEscolhido: string | null = null;
        let identidade: IdentidadeAlvo | undefined;

        if (classificacao.tipo === 'resolvido') {
          // Nível 1: identidade oficial.
          const proprio = cands.find((cd) => cd.key === classificacao.identidade.acordaoKey);
          ementaEscolhida = proprio?.ementa;
          colegiadoEscolhido = classificacao.identidade.colegiadoAlvo;
          relatorEscolhido = classificacao.identidade.relatorAlvo;
          identidade = classificacao.identidade;
          nivel1++;
        } else {
          // Ambíguo ou não encontrado na identidade oficial: tenta
          // convergência dos citantes (nível 2, spec §4.3) antes de desistir.
          // Convergência exige UNANIMIDADE — um só citante discordante já
          // derruba para "sem colegiado" (nível 3).
          const conv = await colegiadoPorConvergencia(c.numero, c.ano);
          // `escolherCandidato` (mesmo helper da identidade oficial) exige
          // exatamente UM candidato completo do colegiado convergido — se
          // houver dois, não sabemos qual é o certo, e cai para nível 3 em
          // vez de escolher no chute.
          const match = conv ? escolherCandidato(cands, conv.colegiado) : null;
          if (conv && match) {
            ementaEscolhida = match.ementa;
            colegiadoEscolhido = conv.colegiado;
            relatorEscolhido = match.relator;
            identidade = {
              acordaoKey: null,
              colegiadoAlvo: conv.colegiado,
              relatorAlvo: match.relator,
              urlAlvo: match.link || null,
              origemIdentidade: 'convergencia-citantes',
              citantesConcordantes: conv.citantes,
            };
            nivel2++;
          }
        }

        if (!identidade || ementaEscolhida === undefined) {
          // Nível 3: nem a identidade oficial nem a convergência resolvem o
          // colegiado — sem ementa confiável para classificar a matéria, não
          // há como destilar. Registra o sumidouro (spec 2026-09-04) para o
          // alvo não voltar ao topo da seleção todo dia. Erro de rede não
          // passa por aqui: `cands` só chega vazio/ambíguo por candidatura
          // real, não por falha — a falha já teria lançado em
          // `buscarAcordaoPorNumero` e caído no catch do laço, sem gravar nada.
          if (classificacao.tipo === 'naoEncontrado') {
            await registrarIdentidadeIrresolvida(c.numero, c.ano, 'naoEncontrado');
          } else if (classificacao.tipo === 'ambiguo') {
            await registrarIdentidadeIrresolvida(c.numero, c.ano, 'ambiguo', classificacao.candidatos);
          }
          semColegiado++;
          continue;
        }

        // Antes de gastar a destilação: a matéria interessa à base?
        const tema = await garantirTemaDeAlvo(c, ementaEscolhida);
        if (tema === null) {
          // Sem ementa não há como decidir a matéria. Não destila — deixar
          // passar seria voltar a encher a base do que o Daniel tirou dela.
          semTema++;
          continue;
        }
        if (!naBase(tema)) {
          foraDaBase++;
          continue;
        }

        const dossie = await coletarTrechosDoAlvo({ numero: c.numero, ano: c.ano });

        const { systemPrompt, userContent } = montarPromptTese({
          chave: c.chave,
          ementaPropria: ementaEscolhida,
          colegiado: colegiadoEscolhido,
          relator: relatorEscolhido,
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
        const r = await persistirDestilacao({ numero: c.numero, ano: c.ano }, tese, dossie, identidade);
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
    corpo = {
      candidatos: candidatos.length,
      ok, semTese, erros, herdadosTotal, foraDaBase, semTema, nivel1, nivel2, semColegiado, processados,
      totalComTeseAtual: restam,
    };

    return {
      itemsFound: candidatos.length,
      itemsNew: ok,
      itemsError: erros,
      // `foraDaBase`/`semTema`/`nivel1`/`nivel2`/`semColegiado` na telemetria:
      // se um dia o cron parar de produzir, é aqui que se vê se acabou o
      // material, se o filtro de matéria está barrando tudo, ou se a
      // identidade (oficial ou por convergência) parou de resolver.
      metadata: { semTese, herdadosTotal, foraDaBase, semTema, nivel1, nivel2, semColegiado, totalComTeseAtual: restam },
    };
  });

  return NextResponse.json(corpo);
}
