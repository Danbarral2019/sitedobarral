// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { formatCSV, formatMarkdown } from '@/eval/scripts/failure-analysis/report-format'
import type { BucketedRow, FailureAnalysisReport } from '@/eval/scripts/failure-analysis/types'

function row(overrides: Partial<BucketedRow> = {}): BucketedRow {
  return {
    id: 'q-test',
    query: 'teste',
    difficulty: 'medium',
    recallAt5: 0,
    reciprocalRank: 0.1,
    predictedTop20: ['x1', 'x2'],
    relevantIds: ['d1'],
    highlyRelevantIds: [],
    relevantDocs: [{ id: 'd1', exists: true, title: 'Doc 1', contentLen: 500, chunkCount: 3 }],
    docPositionInTop100: null,
    keyTerms: ['BDI'],
    keyTermsInExpectedDoc: { BDI: true },
    keyTermsInTop5Docs: { BDI: false },
    top5Titles: ['t1', 't2', 't3', 't4', 't5'],
    bucketAuto: 'D',
    bucketReason: 'pos 10',
    bucketManual: '',
    ...overrides,
  }
}

describe('formatCSV', () => {
  it('tem header com colunas esperadas', () => {
    const csv = formatCSV([row()])
    const firstLine = csv.split('\n')[0]
    expect(firstLine).toContain('id')
    expect(firstLine).toContain('bucket_auto')
    expect(firstLine).toContain('bucket_manual')
  })

  it('escapa vírgulas e aspas em campos', () => {
    const csv = formatCSV([row({ query: 'um, dois "três"' })])
    expect(csv).toContain('"um, dois ""três"""')
  })

  it('linha por row', () => {
    const csv = formatCSV([row({ id: 'a' }), row({ id: 'b' })])
    expect(csv.split('\n').filter(Boolean)).toHaveLength(3) // header + 2
  })
})

describe('formatMarkdown', () => {
  const report: FailureAnalysisReport = {
    sourceRunPath: 'eval/reports/x.json',
    scopeDescription: '29 queries com recall@5 ≤ 20%',
    generatedAt: '2026-04-23',
    rows: [
      row({ bucketAuto: 'D', id: 'q-a' }),
      row({ bucketAuto: 'A', id: 'q-b' }),
      row({ bucketAuto: 'D', id: 'q-c' }),
    ],
  }

  it('tem título e cabeçalho com run fonte', () => {
    const md = formatMarkdown(report)
    expect(md).toContain('# Failure Analysis')
    expect(md).toContain('eval/reports/x.json')
  })

  it('tabela de distribuição por bucket com contagens corretas', () => {
    const md = formatMarkdown(report)
    expect(md).toMatch(/\|\s*D\b[^|]*\|\s*2/) // D aparece 2 vezes
    expect(md).toMatch(/\|\s*A\b[^|]*\|\s*1/) // A aparece 1 vez
  })

  it('tem seção drill-down por query', () => {
    const md = formatMarkdown(report)
    expect(md).toContain('### q-a')
    expect(md).toContain('### q-b')
    expect(md).toContain('### q-c')
  })

  it('tem seção "Como reproduzir"', () => {
    const md = formatMarkdown(report)
    expect(md).toContain('Como reproduzir')
    expect(md).toContain('analyze-failures.ts')
  })
})
