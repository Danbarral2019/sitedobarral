/**
 * Recorta os TRECHOS onde um acórdão-alvo é citado por outros, para alimentar a
 * destilação da tese (Fase 2-A). A aresta (Fase 1) diz QUEM cita e se é no voto;
 * aqui capturamos o CONTEXTO — o que o voto diz ao invocar o precedente. Puro:
 * texto → trechos, sem banco nem rede (espelha arestasDeAcordao).
 */
import { extractAcordaoCitations } from './acordao-citation-extractor';
import { seccionarAcordao, secaoDe } from './seccionar-acordao';
import { prisma } from '../prisma';

/** Caracteres de contexto de cada lado da citação. */
const JANELA = 400;

export interface TrechoCitacao {
  /** Chave "numero/ano" do acórdão CITANTE (origem). */
  origemChave: string;
  /**
   * Id do `Document` do acórdão CITANTE — a identidade inequívoca da origem.
   *
   * `origemChave` NÃO identifica um acórdão: o schema declara a unicidade em
   * `(acordaoNumero, acordaoAno, tcuOrgaoJulgador)`, ou seja, o mesmo par
   * número+ano existe em colegiados diferentes. Resolver o citante pela chave
   * escolheria um deles arbitrariamente, e a evidência apontaria para o
   * inteiro teor de um acórdão onde o trecho não existe (spec §4 e §7.1).
   *
   * Opcional porque nem todo produtor de `TrechoCitacao` tem o `Document` em
   * mãos (`recortarTrechos` é puro); quem coleta do grafo sempre preenche.
   */
  origemDocumentId?: string;
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
  origemChave: string,
  origemDocumentId?: string
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
    out.push({ origemChave, origemDocumentId, secao, noVoto: secao === 'voto', trecho, offset: c.index });
  }
  return out;
}

export interface DossieUso {
  alvo: { numero: number; ano: number };
  contagem: { citantesDistintos: number; noVoto: number; ocorrenciasTotal: number };
  trechos: TrechoCitacao[];
}

/** Chave de dedup: trecho normalizado por inteiro (colapsa espaços, minúsculas). Dedup só de idênticos, para não colapsar trechos distintos que compartilham só o início boilerplate. */
function chaveDedup(trecho: string): string {
  return trecho.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function montarDossie(
  alvo: { numero: number; ano: number },
  trechos: TrechoCitacao[],
  limite = 40
): DossieUso {
  const vistos = new Set<string>();
  const dedup: TrechoCitacao[] = [];
  for (const t of trechos) {
    const k = chaveDedup(t.trecho);
    if (vistos.has(k)) continue;
    vistos.add(k);
    dedup.push(t);
  }
  // Voto primeiro; dentro de cada grupo, trechos mais longos (mais
  // informativos); por fim origemChave, que fecha a ordenação.
  //
  // O desempate por origemChave não é cosmético: a evidência de cada tese é
  // resolvida por ÍNDICE nesta lista (TeseTrechoFonte, spec §7). Empate
  // desfeito pela ordem de chegada — que vem de um findMany sem orderBy —
  // faria dois runs produzirem trechos diferentes para o mesmo índice.
  dedup.sort(
    (a, b) =>
      Number(b.noVoto) - Number(a.noVoto) ||
      b.trecho.length - a.trecho.length ||
      a.origemChave.localeCompare(b.origemChave),
  );

  const citantes = new Set(trechos.map((t) => t.origemChave));
  const citantesVoto = new Set(trechos.filter((t) => t.noVoto).map((t) => t.origemChave));
  return {
    alvo,
    contagem: {
      citantesDistintos: citantes.size,
      noVoto: citantesVoto.size,
      ocorrenciasTotal: trechos.length,
    },
    trechos: dedup.slice(0, limite),
  };
}

/**
 * Coleta o dossiê de uso de um alvo a partir do grafo: arestas (quem cita) +
 * inteiro teor dos citantes. A CONTAGEM vem das arestas (fonte da verdade da
 * Fase 1), não dos trechos recortados. Toca banco — não é puro.
 */
export interface OpcoesDossie {
  /**
   * Reconstrói o dossiê como ele era nesta data, ignorando arestas criadas
   * depois. Uma aresta só existe se o inteiro teor do citante já existia
   * quando ela foi extraída, então o corte por criadoEm devolve fielmente o
   * universo de candidatos daquele momento (spec §7).
   */
  ateData?: Date;
}

export async function coletarTrechosDoAlvo(
  alvo: { numero: number; ano: number },
  opcoes: OpcoesDossie = {},
): Promise<DossieUso> {
  const arestas = await prisma.acordaoCitacao.findMany({
    where: {
      numeroAlvo: alvo.numero,
      anoAlvo: alvo.ano,
      ...(opcoes.ateData ? { criadoEm: { lt: opcoes.ateData } } : {}),
    },
    select: { origemId: true, noVoto: true, ocorrencias: true },
    // Ordem estável: o desempate de montarDossie é por origemChave, mas a
    // deduplicação vê os trechos na ordem de chegada.
    orderBy: { origemId: 'asc' },
  });
  const docs = await prisma.document.findMany({
    where: { id: { in: arestas.map((a) => a.origemId) } },
    select: { id: true, acordaoNumero: true, acordaoAno: true, tcuTextoCompleto: true },
  });
  const porId = new Map(docs.map((d) => [d.id, d]));
  const trechos: TrechoCitacao[] = [];
  for (const a of arestas) {
    const d = porId.get(a.origemId);
    if (!d?.tcuTextoCompleto) continue;
    const origemChave = d.acordaoNumero && d.acordaoAno ? `${d.acordaoNumero}/${d.acordaoAno}` : d.id;
    // O id vai junto da chave: é ele, e não o par número+ano, que identifica
    // sem ambiguidade o citante cujo texto produziu estes trechos (spec §7.1).
    trechos.push(...recortarTrechos(d.tcuTextoCompleto, alvo, origemChave, d.id));
  }
  const dossie = montarDossie(alvo, trechos);
  // Contagem fidedigna = arestas do grafo (não os trechos recasados).
  dossie.contagem = {
    citantesDistintos: arestas.length,
    noVoto: arestas.filter((a) => a.noVoto).length,
    ocorrenciasTotal: arestas.reduce((s, a) => s + a.ocorrencias, 0),
  };
  return dossie;
}
