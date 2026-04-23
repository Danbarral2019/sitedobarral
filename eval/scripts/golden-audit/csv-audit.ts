import type { AuditCandidate, AuditRow, DecisionValue } from './types'

const COLUMNS = [
  'query_id',
  'query_text',
  'candidate_id',
  'candidate_title',
  'candidate_position',
  'candidate_snippet',
  'existing_relevants_count',
  'suggest_auto',
  'decision',
  'decision_note',
] as const

function csvEscape(value: unknown): string {
  const s = String(value ?? '')
  if (/["\r\n,]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function formatAuditCSV(rows: AuditCandidate[]): string {
  const lines: string[] = [COLUMNS.join(',')]
  for (const r of rows) {
    const values = [
      r.queryId,
      r.queryText,
      r.candidateId,
      r.candidateTitle,
      r.candidatePosition,
      r.candidateSnippet,
      r.existingRelevantsCount,
      r.suggestAuto,
      '', // decision — preenchido manualmente
      '', // decision_note
    ]
    lines.push(values.map(csvEscape).join(','))
  }
  return lines.join('\n') + '\n'
}

/** Parser tolerante de CSV com quoting RFC 4180. */
function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let i = 0
  let current = ''
  let inQuotes = false
  while (i < line.length) {
    const c = line[i]
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      current += c
      i++
    } else {
      if (c === ',') {
        fields.push(current)
        current = ''
        i++
        continue
      }
      if (c === '"' && current === '') {
        inQuotes = true
        i++
        continue
      }
      current += c
      i++
    }
  }
  fields.push(current)
  return fields
}

const VALID_DECISIONS: DecisionValue[] = ['', 'accept', 'accept-highly', 'reject', 'comment']

export function parseAuditCSV(content: string): AuditRow[] {
  const lines = content.split(/\r?\n/).filter((l) => l.length > 0)
  if (lines.length === 0) return []
  const header = parseCSVLine(lines[0])
  if (header.join(',') !== COLUMNS.join(',')) {
    throw new Error(`Header do CSV não bate com o esperado.\nEsperado: ${COLUMNS.join(',')}\nRecebido: ${header.join(',')}`)
  }
  const rows: AuditRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i])
    if (fields.length !== COLUMNS.length) {
      throw new Error(`Linha ${i + 1} tem ${fields.length} colunas, esperado ${COLUMNS.length}`)
    }
    const decision = fields[8] as DecisionValue
    if (!VALID_DECISIONS.includes(decision)) {
      throw new Error(`Linha ${i + 1}: decision inválida "${decision}". Valores aceitos: ${VALID_DECISIONS.join(', ')}`)
    }
    rows.push({
      queryId: fields[0],
      queryText: fields[1],
      candidateId: fields[2],
      candidateTitle: fields[3],
      candidatePosition: parseInt(fields[4], 10),
      candidateSnippet: fields[5],
      existingRelevantsCount: parseInt(fields[6], 10),
      suggestAuto: fields[7] as 'accept' | 'maybe' | 'reject',
      decision,
      decisionNote: fields[9],
    })
  }
  return rows
}
