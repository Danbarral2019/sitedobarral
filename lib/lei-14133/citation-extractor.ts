/**
 * Extrai citações de artigos da Lei 14.133 de texto livre — determinístico,
 * sem LLM, custo zero.
 *
 * Por que existe: a vinculação documento↔artigo é feita por LLM
 * (`lib/lei-indexer.ts`), cujo prompt pede explicitamente artigos "RELACIONADOS
 * ao tema (mesmo que não mencionados explicitamente)", com corte de confiança 40
 * em produção. O resultado é que o art. 5º acumulou 1.140 documentos dos quais
 * apenas 39% de fato o citam (auditoria 2026-07-15). Pior: o indexador calcula
 * `confidence`/`mentions` e descarta ambos na escrita, então não há como
 * distinguir citação de palpite depois do fato.
 *
 * Este módulo recupera o sinal mais objetivo — "o documento cita este artigo?" —
 * lendo o texto. Não substitui o LLM (que enxerga tema); complementa-o com uma
 * evidência verificável.
 *
 * Não confundir com `lib/article-utils.ts:extractArticleNumbers()`, que apesar
 * do nome só faz parse do campo do banco — não lê texto.
 *
 * Ref.: docs/audits/2026-07-15-lei-comentada-RESULTADOS.md
 */
import { LEI_14133_ARTIGOS } from '../../data/lei-14133-artigos';

const VALID_ARTICLES = new Set(Object.keys(LEI_14133_ARTIGOS));

/**
 * "art. 5º", "artigo 5", "arts. 17 e 18", "art. 184-A".
 * O `(?!\d)` impede que "art. 5" case dentro de "art. 50"/"art. 55".
 */
const ART_RE = /\bart(?:igos?|s?\.)?\s*(\d{1,3})(?!\d)\s*[ºo°]?(?:\s*-\s*([A-Z])\b)?/gi;

/**
 * Continuação de lista: o "e 18" de "arts. 17 e 18", o ", 6º" de "arts. 5º, 6º e 7º".
 * Ancorada no início do resto do texto, logo após a citação anterior.
 *
 * O espaço antes do "e" é opcional porque ART_RE já pode tê-lo consumido no seu
 * `\s*[ºo°]?` final. O `\b` impede casar o "e" de "em"/"entre".
 *
 * Exige número imediatamente após o separador, então "art. 5º, caput",
 * "art. 5º, § 1º" e "art. 5º e a Lei 8.666" não disparam.
 */
const LISTA_RE = /^(?:\s*,|\s*e\b)\s*(\d{1,3})(?!\d)\s*[ºo°]?(?:\s*-\s*([A-Z])\b)?/;

/** A citação está perto de uma menção à Lei 14.133? */
const LEI_14133_RE = /14\.?133/;

/** Outra lei citada na mesma janela — sinal de que o artigo não é da 14.133. */
const OUTRA_LEI_RE = /8\.?666|10\.?520|12\.?462|13\.?303|9\.?784|14\.?600|lei complementar|constitui[çc][ãa]o|CF\/88/i;

/**
 * Ligação imediata do artigo a OUTRA norma: "art. 103, § 1º, da Resolução-TCU
 * 259", "art. 169 do Regimento Interno", "art. 30 da Lei 8.666". Ancorada logo
 * após o número (pulando §/inciso/caput/alínea), exige "d(a|o)(s) ‹norma›" e só
 * dispara quando a norma é explicitamente outra — "da Lei 14.133" NÃO casa.
 *
 * Por que existe: `nearLei14133` é por proximidade (janela de ±250). Quando um
 * artigo de outra norma aparece ao lado de uma citação legítima da 14.133, a
 * proximidade sozinha o carimba como 14.133 (medido: 72 acórdãos, 2026-07-17).
 * A amarração imediata é o sinal correto e vence a proximidade.
 */
const BIND_OUTRA_NORMA = new RegExp(
  '^[ºo°]?' +
    '(?:[\\s,]*(?:§|par[áa]grafo|inc(?:iso)?\\.?|caput|al[íi]nea|item)[^,.;\\n]{0,20})*' +
    '[\\s,]*d[ao]s?\\s+' +
    '(?:resolu[çc][ãa]o|regimento|decreto|portaria|instru[çc][ãa]o\\s+normativa|' +
    'orienta[çc][ãa]o\\s+normativa|lei\\s+complementar|constitui[çc][ãa]o|s[úu]mula|' +
    'medida\\s+provis[óo]ria|emenda\\s+constitucional|' +
    'lei\\s+n?[º°.\\s]*(?:8\\.?666|10\\.?520|12\\.?462|13\\.?303|9\\.?784|14\\.?600|4\\.?320|11\\.?079|13\\.?709))',
  'i'
);

/** Janela de contexto, em caracteres, para cada lado da citação. */
const WINDOW = 250;

export interface Citation {
  /** Número do artigo, normalizado ("5", "184-A"). */
  article: string;
  /** Há menção à Lei 14.133 na janela ao redor? */
  nearLei14133: boolean;
  /** Há menção a OUTRA lei na janela ao redor? */
  nearOutraLei: boolean;
  /**
   * O artigo está amarrado logo depois a OUTRA norma ("art. 103 da Resolução")?
   * Se sim, não é citação da 14.133, por mais que a lei apareça na janela.
   */
  boundToOtherNorm: boolean;
  /** Posição da citação no texto — útil para destacar o trecho na UI. */
  index: number;
}

/**
 * Extrai todas as citações de artigo do texto. Artigos que não existem na Lei
 * 14.133 são descartados (protege contra "art. 999" e contra números que sejam
 * de outra norma).
 */
export function extractCitations(text: string): Citation[] {
  const out: Citation[] = [];
  if (!text) return out;

  // `lastIndex` local: ART_RE é global e compartilhado entre chamadas.
  const re = new RegExp(ART_RE.source, ART_RE.flags);
  let m: RegExpExecArray | null;

  /** Avalia o contexto ao redor de uma posição e registra a citação. */
  const push = (article: string, index: number, matchLen: number) => {
    if (!VALID_ARTICLES.has(article)) return;
    const from = Math.max(0, index - WINDOW);
    const win = text.slice(from, index + matchLen + WINDOW);
    // Amarração imediata: o que vem logo após o número decide a norma.
    const after = text.slice(index + matchLen, index + matchLen + 60);
    out.push({
      article,
      nearLei14133: LEI_14133_RE.test(win),
      nearOutraLei: OUTRA_LEI_RE.test(win),
      boundToOtherNorm: BIND_OUTRA_NORMA.test(after),
      index,
    });
  };

  while ((m = re.exec(text)) !== null) {
    push(m[2] ? `${m[1]}-${m[2].toUpperCase()}` : m[1], m.index, m[0].length);

    // "arts. 17 e 18": o "18" não vem precedido de "art", então o regex
    // principal não o alcança. Consome a cauda da lista aqui.
    let pos = m.index + m[0].length;
    for (;;) {
      const lm = LISTA_RE.exec(text.slice(pos));
      if (!lm) break;
      push(lm[2] ? `${lm[1]}-${lm[2].toUpperCase()}` : lm[1], pos, lm[0].length);
      pos += lm[0].length;
    }
    re.lastIndex = pos; // não reprocessa o que a lista já consumiu
  }
  return out;
}

export interface CitesResult {
  /** O texto cita este artigo DA LEI 14.133 (evidência forte). */
  cites: boolean;
  /** Quantas citações confirmadas — o `mentions` que o indexador descartava. */
  mentions: number;
  /** Cita o número, mas sem lei identificável por perto. Não conta como citação. */
  ambiguous: boolean;
}

/**
 * O texto cita este artigo da Lei 14.133?
 *
 * Conservador de propósito: exige menção à 14.133 na janela. Um acórdão que diga
 * "violação ao art. 5º" sem repetir a lei sai como `ambiguous`, não como citação
 * — preferimos subestimar a citar errado.
 */
export function citesArticle(text: string | null | undefined, article: string): CitesResult {
  if (!text) return { cites: false, mentions: 0, ambiguous: false };

  const cits = extractCitations(text).filter((c) => c.article === article);
  // Uma ocorrência amarrada a outra norma nunca conta — nem como citação forte,
  // nem como suporte à ambiguidade.
  const fortes = cits.filter((c) => c.nearLei14133 && !c.boundToOtherNorm);
  const ambiguous =
    fortes.length === 0 && cits.some((c) => !c.nearOutraLei && !c.boundToOtherNorm);

  return { cites: fortes.length > 0, mentions: fortes.length, ambiguous };
}
