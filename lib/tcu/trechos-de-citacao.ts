/**
 * Recorta os TRECHOS onde um acórdão-alvo é citado por outros, para alimentar a
 * destilação da tese (Fase 2-A). A aresta (Fase 1) diz QUEM cita e se é no voto;
 * aqui capturamos o CONTEXTO — o que o voto diz ao invocar o precedente. Puro:
 * texto → trechos, sem banco nem rede (espelha arestasDeAcordao).
 */
import { extractAcordaoCitations } from './acordao-citation-extractor';
import { seccionarAcordao, secaoDe } from './seccionar-acordao';

/** Caracteres de contexto de cada lado da citação. */
const JANELA = 400;

export interface TrechoCitacao {
  /** Chave "numero/ano" do acórdão CITANTE (origem). */
  origemChave: string;
  secao: 'relatorio' | 'voto' | 'acordao' | null;
  noVoto: boolean;
  /** Janela de texto ao redor da citação, aparada em fronteira de palavra. */
  trecho: string;
  /** Offset da citação no texto (para depuração). */
  offset: number;
}

/** Apara bordas cortadas no meio de palavra e sinaliza corte com reticências. */
function aparar(bruto: string, cortadoInicio: boolean, cortadoFim: boolean): string {
  let s = bruto;
  if (cortadoInicio) {
    const p = s.indexOf(' ');
    if (p > 0) s = s.slice(p + 1);
    s = '…' + s;
  }
  if (cortadoFim) {
    const p = s.lastIndexOf(' ');
    if (p > 0) s = s.slice(0, p);
    s = s + '…';
  }
  return s.replace(/\s+/g, ' ').trim();
}

export function recortarTrechos(
  texto: string,
  alvo: { numero: number; ano: number },
  origemChave: string
): TrechoCitacao[] {
  if (!texto) return [];
  const secoes = seccionarAcordao(texto);
  const out: TrechoCitacao[] = [];
  for (const c of extractAcordaoCitations(texto)) {
    if (c.numero !== alvo.numero || c.ano !== alvo.ano) continue;
    const ini = Math.max(0, c.index - JANELA);
    const fim = Math.min(texto.length, c.index + c.raw.length + JANELA);
    const trecho = aparar(texto.slice(ini, fim), ini > 0, fim < texto.length);
    const secao = secaoDe(secoes, c.index);
    out.push({ origemChave, secao, noVoto: secao === 'voto', trecho, offset: c.index });
  }
  return out;
}
