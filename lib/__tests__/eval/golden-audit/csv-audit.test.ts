// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { formatAuditCSV, parseAuditCSV } from '@/eval/scripts/golden-audit/csv-audit'
import type { AuditCandidate } from '@/eval/scripts/golden-audit/types'

function cand(overrides: Partial<AuditCandidate> = {}): AuditCandidate {
  return {
    queryId: 'q-1',
    queryText: 'teste',
    candidateId: 'doc-1',
    candidateTitle: 'Titulo',
    candidatePosition: 2,
    candidateSnippet: 'trecho',
    existingRelevantsCount: 3,
    suggestAuto: 'accept',
    ...overrides,
  }
}

describe('formatAuditCSV', () => {
  it('header + linhas com campo decision vazio', () => {
    const csv = formatAuditCSV([cand(), cand({ queryId: 'q-2' })])
    const lines = csv.split('\n').filter(Boolean)
    expect(lines).toHaveLength(3) // header + 2
    expect(lines[0]).toContain('decision')
    expect(lines[1]).toMatch(/,\s*$|,""$|accept,,$|accept,,\s*$/) // decision + decision_note vazios
  })

  it('escapa aspas/vírgulas em campos', () => {
    const csv = formatAuditCSV([cand({ queryText: 'a, "b" c' })])
    expect(csv).toContain('"a, ""b"" c"')
  })
})

describe('parseAuditCSV', () => {
  it('parseia CSV com decisões preenchidas', () => {
    const csv = `query_id,query_text,candidate_id,candidate_title,candidate_position,candidate_snippet,existing_relevants_count,suggest_auto,decision,decision_note
q-1,teste,doc-1,Titulo,2,trecho,3,accept,accept-highly,porque sim
q-2,outro,doc-2,Outro,5,snippet,1,reject,,
`
    const rows = parseAuditCSV(csv)
    expect(rows).toHaveLength(2)
    expect(rows[0].queryId).toBe('q-1')
    expect(rows[0].decision).toBe('accept-highly')
    expect(rows[0].decisionNote).toBe('porque sim')
    expect(rows[1].decision).toBe('')
  })

  it('lida com aspas escapadas', () => {
    const csv = `query_id,query_text,candidate_id,candidate_title,candidate_position,candidate_snippet,existing_relevants_count,suggest_auto,decision,decision_note
q-1,"a, ""b"" c",doc,Titulo,1,snip,0,accept,accept,
`
    const rows = parseAuditCSV(csv)
    expect(rows[0].queryText).toBe('a, "b" c')
  })

  it('lança erro em decision inválida', () => {
    const csv = `query_id,query_text,candidate_id,candidate_title,candidate_position,candidate_snippet,existing_relevants_count,suggest_auto,decision,decision_note
q-1,teste,doc-1,Titulo,2,trecho,3,accept,foo,
`
    expect(() => parseAuditCSV(csv)).toThrow(/decision inválida/i)
  })
})
