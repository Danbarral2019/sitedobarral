/**
 * Etapa 1: le banco.json + fichas ELIC, seleciona teses, parseia fundamentos.
 * Exporta funcoes puras (sem I/O de banco) para facilitar teste.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

export interface ParsedReference {
  raw: string
  type: 'acordao_tcu' | 'sumula_tcu' | 'on_agu' | 'parecer' | 'decreto' | 'in' | 'lei' | 'outro'
  numero?: number
  ano?: number
}

export interface ExtractedThesis {
  id: string
  query: string
  enunciado: string
  description: string
  source: 'transversal' | 'especifica'
  code: string | null
  templateId: string | null
  category: string
  difficulty: 'easy' | 'medium' | 'hard'
  fundamentos_raw: string[]
  fundamentos_parsed: ParsedReference[]
}

/**
 * Parseia o campo fundamento de uma tese em referencias individuais.
 * Separadores: ";" no nivel principal.
 */
export function parseFundamentos(fundamento: string): ParsedReference[] {
  const refs: ParsedReference[] = []
  const parts = fundamento.split(';').map(s => s.trim()).filter(Boolean)

  for (const part of parts) {
    const ref: ParsedReference = { raw: part, type: 'outro' }

    // Acordao TCU: "Acordao 597/2023-Plenario" ou "TCU, Acordao 1351/2025-Plenario"
    const acordaoMatch = part.match(/Ac[oó]rd[aã]o\s+(\d+)\/(\d{4})/i)
    if (acordaoMatch) {
      ref.type = 'acordao_tcu'
      ref.numero = parseInt(acordaoMatch[1])
      ref.ano = parseInt(acordaoMatch[2])
      refs.push(ref)
      continue
    }

    // Sumula TCU: "Sumula TCU no 254"
    const sumulaMatch = part.match(/S[uú]mula\s+TCU\s+n[ºo°]\s*(\d+)/i)
    if (sumulaMatch) {
      ref.type = 'sumula_tcu'
      ref.numero = parseInt(sumulaMatch[1])
      refs.push(ref)
      continue
    }

    // ON AGU: "Orientacao Normativa AGU no 52/2014"
    const onMatch = part.match(/Orienta[cç][aã]o\s+Normativa\s+AGU\s+n[ºo°]\s*(\d+)\/(\d{4})/i)
    if (onMatch) {
      ref.type = 'on_agu'
      ref.numero = parseInt(onMatch[1])
      ref.ano = parseInt(onMatch[2])
      refs.push(ref)
      continue
    }

    // Parecer: "Parecer 63/2024/DECOR" ou "Parecer no 4/2022/CNMLC"
    const parecerMatch = part.match(/Parecer\s+(?:n[ºo°]\s*)?(\d+)\/(\d{4})/i)
    if (parecerMatch) {
      ref.type = 'parecer'
      ref.numero = parseInt(parecerMatch[1])
      ref.ano = parseInt(parecerMatch[2])
      refs.push(ref)
      continue
    }

    // Decreto: "Decreto 11.462/2023"
    const decretoMatch = part.match(/Decreto\s+(?:n[ºo°]\s*)?[\d.]+\/(\d{4})/i)
    if (decretoMatch) {
      ref.type = 'decreto'
      refs.push(ref)
      continue
    }

    // IN: "IN SEGES/ME no 65/2021"
    const inMatch = part.match(/(?:IN|Instru[cç][aã]o\s+Normativa)\s+/i)
    if (inMatch) {
      ref.type = 'in'
      refs.push(ref)
      continue
    }

    // Lei: "Lei 14.133/2021" or "Lei Complementar no 101/2000"
    const leiMatch = part.match(/Lei\s+(?:Complementar\s+)?(?:n[ºo°]\s*)?[\d.]+\/\d{4}/i)
    if (leiMatch) {
      ref.type = 'lei'
      refs.push(ref)
      continue
    }

    refs.push(ref)
  }

  return refs
}

/**
 * Gera query de busca a partir do enunciado de uma tese.
 * Extrai termos-chave, remove conectivos longos, limita a ~15 palavras.
 */
export function enunciadoToQuery(enunciado: string): string {
  return enunciado
    .replace(/\.$/, '')
    // Remove clausulas subordinadas longas entre virgulas
    .replace(/,\s*(?:nos termos|conforme|observad[ao]s|de acordo com|na forma d[ao]|salvo)[^,;.]*/gi, '')
    .replace(/,\s*(?:bem como|inclusive|especialmente)[^,;.]*/gi, '')
    // Remove artigos e preposicoes iniciais
    .replace(/^(?:A |O |As |Os |É |São )/i, '')
    // Trunca a ~100 chars e pega ate a ultima palavra completa
    .slice(0, 120)
    .replace(/\s+\S*$/, '')
    .trim()
}

/**
 * Estima dificuldade da query com base no tipo de fundamentos.
 */
export function estimateDifficulty(parsed: ParsedReference[]): 'easy' | 'medium' | 'hard' {
  const hasLei = parsed.some(r => r.type === 'lei')
  const hasJurisp = parsed.some(r => ['acordao_tcu', 'sumula_tcu', 'on_agu', 'parecer'].includes(r.type))

  if (hasLei && !hasJurisp) return 'easy'
  if (hasJurisp) return 'medium'
  return 'hard'
}

/**
 * Conta tipos distintos de fundamentos (para selecao de teses especificas).
 */
function fundamenoDiversity(parsed: ParsedReference[]): number {
  return new Set(parsed.map(r => r.type)).size
}

interface BancoTese {
  enunciado: string
  fundamento: string
  consequencia: string
  aplicavel_a: string[]
}

interface FichaTese {
  enunciado: string
  fundamento: string
  consequencia: string
}

interface Ficha {
  id: string
  nome_resumido: string
  teses_especificas: FichaTese[]
}

/**
 * Le o acervo ELIC e retorna as teses selecionadas (33 transversais + ~2 por template).
 */
export function extractTheses(acervoDir: string): ExtractedThesis[] {
  const result: ExtractedThesis[] = []

  // 1. Transversais (todas)
  const bancoPath = join(acervoDir, 'teses', 'banco.json')
  const banco = JSON.parse(readFileSync(bancoPath, 'utf8'))
  const teses: Record<string, BancoTese> = banco.teses

  for (const [code, tese] of Object.entries(teses)) {
    const parsed = parseFundamentos(tese.fundamento)
    result.push({
      id: code.toLowerCase(),
      query: enunciadoToQuery(tese.enunciado),
      enunciado: tese.enunciado,
      description: `Tese transversal ${code}: ${tese.enunciado.slice(0, 100)}...`,
      source: 'transversal',
      code,
      templateId: null,
      category: 'tese-transversal',
      difficulty: estimateDifficulty(parsed),
      fundamentos_raw: tese.fundamento.split(';').map(s => s.trim()).filter(Boolean),
      fundamentos_parsed: parsed,
    })
  }

  // 2. Especificas (top 2 por template por diversidade de fundamentos)
  const templatesDir = join(acervoDir, 'templates')
  const dirs = readdirSync(templatesDir).filter(d =>
    statSync(join(templatesDir, d)).isDirectory()
  )

  for (const dir of dirs) {
    const id = dir.split(' - ')[0]
    const fichaPath = join(templatesDir, dir, `${id}.json`)
    let ficha: Ficha
    try {
      ficha = JSON.parse(readFileSync(fichaPath, 'utf8'))
    } catch {
      continue
    }

    if (!ficha.teses_especificas || ficha.teses_especificas.length === 0) continue

    // Rank by fundamento diversity, then by enunciado length (shorter = more focused query)
    const ranked = ficha.teses_especificas
      .map((t, idx) => {
        const parsed = parseFundamentos(t.fundamento)
        return { t, idx, parsed, diversity: fundamenoDiversity(parsed), len: t.enunciado.length }
      })
      .sort((a, b) => b.diversity - a.diversity || a.len - b.len)
      .slice(0, 2)

    for (const { t, idx, parsed } of ranked) {
      const teseId = `esp-${id}-${idx}`
      result.push({
        id: teseId,
        query: enunciadoToQuery(t.enunciado),
        enunciado: t.enunciado,
        description: `Tese especifica do template ${id} (${ficha.nome_resumido}): ${t.enunciado.slice(0, 80)}...`,
        source: 'especifica',
        code: null,
        templateId: id,
        category: 'tese-especifica',
        difficulty: estimateDifficulty(parsed),
        fundamentos_raw: t.fundamento.split(';').map(s => s.trim()).filter(Boolean),
        fundamentos_parsed: parsed,
      })
    }
  }

  return result
}
