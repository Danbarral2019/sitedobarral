/**
 * Extrai termos "pesados" de uma query do golden set — números de lei,
 * artigos, nomes de INs, siglas — que servem de evidência para distinguir
 * buckets A (termo ausente do doc) vs B (parafraseamento semântico).
 */

// Stopwords em caixa-alta que não são siglas úteis
const STOPWORDS_UPPER = new Set(['DO', 'DA', 'DE', 'OU', 'NA', 'NO', 'EM', 'ART', 'LEI'])

const PATTERNS: Array<RegExp> = [
  // Lei 14.133/2021, 8.666/93 etc.
  /\b\d{1,3}\.\d{3}\/\d{2,4}\b/g,
  // art. 75, art 75, artigo 75, Art. 183
  /\bart(?:igo)?\.?\s*\d+\b/gi,
  // IN SEGES/ME 65/2021, IN CGU 1/2022 etc.
  /\bIN\s+[A-Z][A-Z/]*\s+\d+\/\d{2,4}\b/g,
  // Decreto-Lei, ON 84, Súmula 473 etc. — número isolado com rótulo
  /\b(?:ON|D[eE]creto|Súmula|Acórdão|Portaria)\s+\d+(?:\/\d{2,4})?\b/g,
]

const UPPER_SIGLA = /\b[A-Z]{2,}\b/g

/** Extrai key-terms únicos de uma query. Ordem de aparição preservada. */
export function extractKeyTerms(query: string): string[] {
  const hits: string[] = []
  const seen = new Set<string>()

  const push = (t: string) => {
    const key = t.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      hits.push(t)
    }
  }

  for (const rx of PATTERNS) {
    const matches = query.match(rx) ?? []
    for (const m of matches) push(m.trim())
  }

  const siglas = query.match(UPPER_SIGLA) ?? []
  for (const s of siglas) {
    if (!STOPWORDS_UPPER.has(s)) push(s)
  }

  return hits
}

/**
 * Para cada termo, indica se aparece no texto (substring case-insensitive).
 * Retorna um objeto bool-por-termo, na ordem dos termos passados.
 */
export function matchKeyTermsInText(
  terms: string[],
  text: string
): Record<string, boolean> {
  const lc = text.toLowerCase()
  const out: Record<string, boolean> = {}
  for (const t of terms) {
    out[t] = lc.includes(t.toLowerCase())
  }
  return out
}
