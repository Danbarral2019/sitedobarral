/**
 * Converte o inteiro teor de um acórdão nas ARESTAS da rede de precedentes:
 * quem ele cita (por número/ano), em que seção, quantas vezes. Reaproveita o
 * extrator puro da Fase 0 e o seccionamento. Módulo compartilhado pelo backfill
 * (passivo) e pelo cron (futuras inclusões) — a lição do fluxo contínuo.
 *
 * `arestasDeAcordao` é puro (texto → arestas). `persistirArestasDeAcordao` é o
 * ponto de escrita, idempotente por origem.
 */
import { extractAcordaoCitations } from './acordao-citation-extractor';
import { seccionarAcordao, secaoDe } from './seccionar-acordao';
import { prisma } from '../prisma';

/** Sobe quando a extração muda, para o backfill/cron reprocessarem. */
export const PRECEDENTES_VERSAO = 1;

export interface ArestaPrecedente {
  numeroAlvo: number;
  anoAlvo: number;
  colegiadoAlvo: string | null;
  /** Alguma ocorrência desta citação caiu na seção do voto (razão de decidir). */
  noVoto: boolean;
  ocorrencias: number;
}

/**
 * Extrai as arestas (origem → alvo) do texto, deduplicadas por (numeroAlvo,
 * anoAlvo). Descarta auto-citação (alvo == self). Puro: não toca banco.
 */
export function arestasDeAcordao(
  texto: string,
  self: { numero: number | null; ano: number | null }
): ArestaPrecedente[] {
  if (!texto) return [];
  const secoes = seccionarAcordao(texto);
  const porAlvo = new Map<string, ArestaPrecedente>();

  for (const c of extractAcordaoCitations(texto)) {
    // Auto-citação: o próprio acórdão no cabeçalho/dispositivo.
    if (self.numero != null && self.ano != null && c.numero === self.numero && c.ano === self.ano) {
      continue;
    }
    const chave = `${c.numero}/${c.ano}`;
    const noVoto = secaoDe(secoes, c.index) === 'voto';
    const e = porAlvo.get(chave);
    if (e) {
      e.ocorrencias += 1;
      e.noVoto = e.noVoto || noVoto;
      if (e.colegiadoAlvo === null && c.colegiado) e.colegiadoAlvo = c.colegiado;
    } else {
      porAlvo.set(chave, {
        numeroAlvo: c.numero,
        anoAlvo: c.ano,
        colegiadoAlvo: c.colegiado,
        noVoto,
        ocorrencias: 1,
      });
    }
  }
  return [...porAlvo.values()];
}

/**
 * Persiste as arestas de um acórdão, idempotente. Retorna o nº de arestas
 * gravadas.
 *
 * Operações em SEQUÊNCIA, não numa transação: um acórdão que cita muitos outros
 * gera um deleteMany + createMany grandes que, somados à latência do Neon
 * (sa-east-1, WebSocket), passam do timeout default de transação de 5s (medido:
 * 17s num doc pesado no backfill). A atomicidade estrita não é necessária aqui:
 * a ORDEM garante a consistência — `precedentesVersao` é marcada POR ÚLTIMO, só
 * depois de as arestas estarem no lugar. Se o processo morrer no meio, o doc
 * fica com `precedentesVersao` nula e o backfill/cron o reprocessa do zero
 * (deleteMany apaga o parcial, createMany reinsere) — sem duplicar.
 */
export async function persistirArestasDeAcordao(p: {
  origemId: string;
  numeroSelf: number | null;
  anoSelf: number | null;
  texto: string;
}): Promise<number> {
  const arestas = arestasDeAcordao(p.texto, { numero: p.numeroSelf, ano: p.anoSelf });
  await prisma.acordaoCitacao.deleteMany({ where: { origemId: p.origemId } });
  if (arestas.length) {
    await prisma.acordaoCitacao.createMany({ data: arestas.map((a) => ({ origemId: p.origemId, ...a })) });
  }
  await prisma.document.update({ where: { id: p.origemId }, data: { precedentesVersao: PRECEDENTES_VERSAO } });
  return arestas.length;
}
