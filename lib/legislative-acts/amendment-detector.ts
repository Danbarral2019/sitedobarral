/**
 * Detector heurístico de relações entre atos normativos.
 *
 * Lê ementa + content e identifica menções a outros atos com verbos como
 * "revoga", "altera", "dá nova redação", "regulamenta", "acresce", "complementa".
 *
 * Retorna lista de candidatos com targetFullNumber normalizado pro mesmo padrão
 * usado em LegislativeAct.fullNumber. NÃO grava no banco — quem grava é
 * `lib/legislative-acts/relations.ts` (que faz lookup por fullNumber e ignora
 * candidatos sem ato cadastrado).
 */

export type RelationType = 'revoga' | 'altera' | 'regulamenta' | 'complementa' | 'modifica';

export interface DetectedRelation {
  relationType: RelationType;
  targetFullNumber: string;   // ex: "Lei 14.133/2021", "Decreto 7.892/2013", "IN SEGES 5/2017"
  excerpt: string;            // até 200 chars, contexto da menção
  confidence: number;         // 0.7-0.9 pra heurística
}

// ── Mapeamento de verbo → relationType ─────────────────────────────────────

const VERB_PATTERNS: Array<{ regex: RegExp; type: RelationType; conf: number }> = [
  { regex: /\brevoga(?:m|do|da|dos|das)?\b/i, type: 'revoga', conf: 0.9 },
  { regex: /\bd[áa]\s+nova\s+reda[çc][ãa]o\b/i, type: 'altera', conf: 0.9 },
  { regex: /\bacresce(?:m)?\b/i, type: 'altera', conf: 0.85 },
  { regex: /\baltera(?:m|do|da|dos|das)?\b/i, type: 'altera', conf: 0.85 },
  { regex: /\bmodifica(?:m|do|da|dos|das)?\b/i, type: 'modifica', conf: 0.8 },
  { regex: /\bregulamenta(?:m|do|da|dos|das)?\b/i, type: 'regulamenta', conf: 0.85 },
  { regex: /\bcomplementa(?:m|do|da|dos|das)?\b/i, type: 'complementa', conf: 0.7 },
];

// Tipos de ato a detectar — mapeia label encontrado pro prefixo do fullNumber
const ACT_TYPE_LABELS: Array<{ regex: RegExp; prefix: string }> = [
  { regex: /\bLei\s+(?:Complementar\s+)?(?:n[ºo°.]?\s*)?/i, prefix: 'Lei' },
  { regex: /\bDecreto(?:-Lei)?\s+(?:n[ºo°.]?\s*)?/i, prefix: 'Decreto' },
  { regex: /\bMedida\s+Provis[óo]ria\s+(?:n[ºo°.]?\s*)?/i, prefix: 'MP' },
  { regex: /\bInstru[çc][ãa]o\s+Normativa\s+(?:(SEGES(?:\/[A-Z]+)?)\s+)?(?:n[ºo°.]?\s*)?/i, prefix: 'IN' },
  { regex: /\bIN\s+(?:(SEGES(?:\/[A-Z]+)?)\s+)?(?:n[ºo°.]?\s*)?/i, prefix: 'IN' },
  { regex: /\bPortaria\s+(?:([A-Z]+(?:\/[A-Z]+)?)\s+)?(?:n[ºo°.]?\s*)?/i, prefix: 'Portaria' },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function normalizeYear(yr: string): number {
  const n = parseInt(yr, 10);
  if (n < 100) return n + (n < 50 ? 2000 : 1900); // 93 → 1993, 21 → 2021
  return n;
}

function buildFullNumber(prefix: string, num: string, year: number, issuer?: string): string {
  if (prefix === 'IN' && issuer) return `IN ${issuer} ${num}/${year}`;
  if (prefix === 'Portaria' && issuer) return `Portaria ${issuer} ${num}/${year}`;
  return `${prefix} ${num}/${year}`;
}

function buildExcerpt(text: string, matchStart: number, matchEnd: number): string {
  const ctx = 80;
  const start = Math.max(0, matchStart - ctx);
  const end = Math.min(text.length, matchEnd + ctx);
  let s = text.slice(start, end).replace(/\s+/g, ' ').trim();
  if (s.length > 200) s = s.slice(0, 197) + '...';
  return s;
}

// ── Main ───────────────────────────────────────────────────────────────────

export function detectAmendments(ementa: string, content: string): DetectedRelation[] {
  const text = `${ementa}\n${content}`;
  const out: DetectedRelation[] = [];
  const seen = new Set<string>(); // dedup key: type|targetFullNumber

  for (const verb of VERB_PATTERNS) {
    let m: RegExpExecArray | null;
    const verbRegex = new RegExp(verb.regex.source, 'gi');
    while ((m = verbRegex.exec(text)) !== null) {
      const verbStart = m.index;
      const verbEnd = m.index + m[0].length;

      // Procura o ato referenciado primeiro APÓS o verbo (caso típico:
      // "revoga a Lei 8.666/93"); se não achar, olha ANTES do verbo, em
      // janela menor (caso "Considerando a Lei 14.133..., esta IN regulamenta").
      const afterWindow = { text: text.slice(verbEnd, verbEnd + 300), offset: verbEnd };
      const beforeWindow = { text: text.slice(Math.max(0, verbStart - 200), verbStart), offset: Math.max(0, verbStart - 200) };

      let matched = false;
      for (const window of [afterWindow, beforeWindow]) {
        if (matched) break;
        for (const actType of ACT_TYPE_LABELS) {
          const labelRegex = new RegExp(actType.regex.source, 'gi');
          let actMatch: RegExpExecArray | null;
          while ((actMatch = labelRegex.exec(window.text)) !== null) {
            const issuer = actMatch[1] || undefined;
            const afterLabel = window.text.slice(actMatch.index + actMatch[0].length);
            // Exige separador obrigatório entre número e ano (vide T3 fix).
            const numYearMatch = afterLabel.match(
              /^([\d.]+)(?:\s*\/\s*|\s*,\s*(?:de\s+[\d°º]+\s+(?:de\s+)?\w+\s+de\s+)?)(\d{2,4})\b/
            );
            if (!numYearMatch) continue;

            const num = numYearMatch[1].replace(/\.$/, '');
            const year = normalizeYear(numYearMatch[2]);
            const targetFullNumber = buildFullNumber(actType.prefix, num, year, issuer);

            const dedupKey = `${verb.type}|${targetFullNumber}`;
            if (seen.has(dedupKey)) { matched = true; break; }
            seen.add(dedupKey);

            const labelEndAbs = window.offset + actMatch.index + actMatch[0].length + numYearMatch[0].length;
            out.push({
              relationType: verb.type,
              targetFullNumber,
              excerpt: buildExcerpt(text, Math.min(verbStart, window.offset + actMatch.index), Math.max(verbEnd, labelEndAbs)),
              confidence: verb.conf,
            });
            matched = true;
            break;
          }
          if (matched) break;
        }
      }
    }
  }

  return out;
}
