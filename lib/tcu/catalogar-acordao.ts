/**
 * Cataloga UM acórdão do TCU: baixa o inteiro teor (RTF), extrai, secciona,
 * conta os princípios por seção e persiste (`tcuTextoCompleto`, `tcuAnalise`,
 * `leiArticlesDebated`). Núcleo compartilhado pelo backfill
 * (scripts/backfill-tcu-inteiro-teor.ts) e pelo cron catalog-tcu-inteiro-teor.
 *
 * Falha de CONTEÚDO (download com { ok: false }, tcuLinkPDF ausente, ou
 * rtfToText que lança) NUNCA propaga: vira { status: 'falha', erro } +
 * incremento de tcuAnaliseTentativas — é determinística e conta para o
 * limite de 3 tentativas, para um acórdão problemático não derrubar o lote.
 *
 * Falha de INFRAESTRUTURA (o prisma.document.update lança, ex.: WebSocket do
 * Neon caiu) PROPAGA de propósito, sem incrementar tentativa: um soluço de
 * rede é transitório e não deve gastar uma tentativa nem empurrar um
 * acórdão bom rumo ao limite de 3. O chamador trata (o backfill envolve em
 * comRetryDB; o cron deixa o run terminar e retoma no próximo).
 *
 * A política do chamador (retry de conexão, delay entre downloads, log) fica
 * FORA daqui — o backfill roda em loop shell, o cron tem lote e maxDuration.
 *
 * Ref.: docs/superpowers/specs/2026-07-16-tcu-catalogacao-continua-design.md
 */
import { fetchInteiroTeor } from './inteiro-teor-fetch';
import { rtfToText } from './rtf-to-text';
import { analisarAcordao, artigosDebatidos } from './analise-relevancia';
import { prisma } from '../prisma';

/** Acima disto trunca e marca `truncado: true` no JSON (o de 14,5 MB do spike). */
export const TETO_CHARS_CATALOGO = 500_000;

export interface AcordaoParaCatalogar {
  id: string;
  title: string;
  tcuLinkPDF: string | null;
  leiArticlesArr: string[];
}

export interface ResultadoCatalogacao {
  status: 'ok' | 'ok-sem-secoes' | 'falha';
  erro?: string;
  debatidos?: string[];
  chars?: number;
}

async function marcarFalha(id: string, erro: string): Promise<void> {
  await prisma.document.update({
    where: { id },
    data: {
      tcuEnriquecimentoStatus: 'failed',
      tcuEnriquecimentoErro: erro,
      tcuAnaliseTentativas: { increment: 1 },
    },
  });
}

export async function catalogarAcordao(doc: AcordaoParaCatalogar): Promise<ResultadoCatalogacao> {
  if (!doc.tcuLinkPDF) {
    await marcarFalha(doc.id, 'tcuLinkPDF ausente');
    return { status: 'falha', erro: 'tcuLinkPDF ausente' };
  }

  const r = await fetchInteiroTeor(doc.tcuLinkPDF);
  if (!r.ok) {
    await marcarFalha(doc.id, r.erro);
    return { status: 'falha', erro: r.erro };
  }

  let texto: string;
  try {
    texto = await rtfToText(r.buf);
  } catch (e) {
    const erro = `extração RTF: ${(e as Error).message.slice(0, 80)}`;
    await marcarFalha(doc.id, erro);
    return { status: 'falha', erro };
  }

  const truncado = texto.length > TETO_CHARS_CATALOGO;
  const final = truncado ? texto.slice(0, TETO_CHARS_CATALOGO) : texto;
  const analise = analisarAcordao(final, doc.leiArticlesArr, { truncado });
  const debatidos = artigosDebatidos(analise);

  await prisma.document.update({
    where: { id: doc.id },
    data: {
      tcuTextoCompleto: final,
      tcuAnalise: analise as never,
      leiArticlesDebated: debatidos,
      tcuEnriquecimentoStatus: 'success',
      tcuEnriquecimentoErro: null,
      tcuEnriquecidoEm: new Date(),
    },
  });

  return {
    status: analise.secoes === null ? 'ok-sem-secoes' : 'ok',
    debatidos,
    chars: final.length,
  };
}
