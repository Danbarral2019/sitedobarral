import { describe, it, expect } from 'vitest'
import {
  parseLeiArticles,
  stringifyLeiArticles,
  getLeiArticles,
  setLeiArticles,
} from '../lei-articles'

describe('parseLeiArticles', () => {
  it('retorna [] para null, undefined, string vazia', () => {
    expect(parseLeiArticles(null)).toEqual([])
    expect(parseLeiArticles(undefined)).toEqual([])
    expect(parseLeiArticles('')).toEqual([])
    expect(parseLeiArticles('   ')).toEqual([])
  })

  it('parseia JSON array de strings', () => {
    expect(parseLeiArticles('["75","18"]')).toEqual(['75', '18'])
    expect(parseLeiArticles('["75"]')).toEqual(['75'])
    expect(parseLeiArticles('[]')).toEqual([])
  })

  it('coerce números JSON para string', () => {
    expect(parseLeiArticles('[75, 18]')).toEqual(['75', '18'])
  })

  it('fallback CSV quando JSON falha', () => {
    expect(parseLeiArticles('75,18')).toEqual(['75', '18'])
    expect(parseLeiArticles('75, 18, 92')).toEqual(['75', '18', '92'])
  })

  it('aceita array já parseado', () => {
    expect(parseLeiArticles(['75', '18'])).toEqual(['75', '18'])
    expect(parseLeiArticles([75, 18])).toEqual(['75', '18'])
  })

  it('filtra entradas vazias', () => {
    expect(parseLeiArticles('["", "75", ""]')).toEqual(['75'])
    expect(parseLeiArticles('75,,18')).toEqual(['75', '18'])
  })

  it('retorna [] para tipos não-string/array', () => {
    expect(parseLeiArticles(42)).toEqual([])
    expect(parseLeiArticles({ leiArticles: '75' })).toEqual([])
    expect(parseLeiArticles(true)).toEqual([])
  })

  it('retorna [] quando JSON parsea mas não é array', () => {
    expect(parseLeiArticles('"75"')).toEqual([])
    expect(parseLeiArticles('null')).toEqual([])
    expect(parseLeiArticles('{}')).toEqual([])
  })
})

describe('stringifyLeiArticles', () => {
  it('retorna JSON array', () => {
    expect(stringifyLeiArticles(['75', '18'])).toBe('["75","18"]')
    expect(stringifyLeiArticles([])).toBe('[]')
    expect(stringifyLeiArticles(['75'])).toBe('["75"]')
  })

  it('coerce qualquer input para string', () => {
    // Caller passa number ou outro tipo — helper normaliza
    expect(stringifyLeiArticles([75 as unknown as string, 18 as unknown as string])).toBe('["75","18"]')
  })
})

describe('round-trip parse + stringify', () => {
  it('preserva valores válidos', () => {
    const input = ['75', '18', '6']
    expect(parseLeiArticles(stringifyLeiArticles(input))).toEqual(input)
  })

  it('reduz duplicados se caller não filtrar', () => {
    // Helper NÃO dedupa — responsabilidade do caller
    const input = ['75', '75', '18']
    expect(parseLeiArticles(stringifyLeiArticles(input))).toEqual(['75', '75', '18'])
  })
})

describe('getLeiArticles (dual-read — Onda 4.5.4)', () => {
  it('prefere leiArticlesArr quando disponível e não-vazio', () => {
    // Pós-dual-write (#76), todo record consistente tem ambos preenchidos.
    // leiArticlesArr é o caminho rápido (sem parse JSON).
    expect(
      getLeiArticles({ leiArticles: '["75","18"]', leiArticlesArr: ['75', '18'] }),
    ).toEqual(['75', '18'])
  })

  it('usa leiArticlesArr mesmo quando leiArticles é null/legado-vazio', () => {
    // Cenário: row criada após cutover quando leiArticles deixou de ser populado
    expect(getLeiArticles({ leiArticles: null, leiArticlesArr: ['75'] })).toEqual(['75'])
  })

  it('fallback pra leiArticles quando leiArticlesArr ausente do select', () => {
    // Cenário: caller fez findMany({ select: { leiArticlesArr: true } }) sem o novo campo
    expect(getLeiArticles({ leiArticles: '["75","18"]' })).toEqual(['75', '18'])
  })

  it('fallback pra leiArticles quando leiArticlesArr é array vazio', () => {
    // Cenário pré-backfill ou row legada não-tocada: leiArticlesArr=[], leiArticles populado
    // Defensivo: prefere o que tem dados
    expect(
      getLeiArticles({ leiArticles: '["75"]', leiArticlesArr: [] }),
    ).toEqual(['75'])
  })

  it('retorna [] quando ambos vazios/ausentes', () => {
    expect(getLeiArticles({ leiArticles: null, leiArticlesArr: [] })).toEqual([])
    expect(getLeiArticles({ leiArticles: null })).toEqual([])
    expect(getLeiArticles({ leiArticles: undefined })).toEqual([])
    expect(getLeiArticles({})).toEqual([])
  })

  it('retorna [] quando ambos são [] / "[]"', () => {
    expect(getLeiArticles({ leiArticles: '[]', leiArticlesArr: [] })).toEqual([])
  })

  it('coerce qualquer item de leiArticlesArr pra string (defesa contra schema drift)', () => {
    expect(
      getLeiArticles({
        leiArticlesArr: [75 as unknown as string, 18 as unknown as string],
      } as unknown as { leiArticlesArr: string[] }),
    ).toEqual(['75', '18'])
  })

  it('funciona com records que têm outros campos', () => {
    const doc = {
      id: 'd1',
      title: 'Doc',
      leiArticles: '["75"]',
      leiArticlesArr: ['75'],
      isPublic: true,
    }
    expect(getLeiArticles(doc)).toEqual(['75'])
  })
})

describe('setLeiArticles (pós-Onda 4.5.6 — só leiArticlesArr)', () => {
  it('produz só leiArticlesArr para array não-vazio', () => {
    expect(setLeiArticles(['75', '18'])).toEqual({ leiArticlesArr: ['75', '18'] })
  })

  it('preserva [] como array nativo vazio', () => {
    expect(setLeiArticles([])).toEqual({ leiArticlesArr: [] })
  })

  it('null → leiArticlesArr vazio (clear semantics)', () => {
    // leiArticlesArr SEMPRE escrito (mesmo no clear) pra evitar staleness pós-update parcial
    expect(setLeiArticles(null)).toEqual({ leiArticlesArr: [] })
  })

  it('undefined → leiArticlesArr vazio', () => {
    expect(setLeiArticles(undefined)).toEqual({ leiArticlesArr: [] })
  })

  it('uso com spread em Prisma update — popula só leiArticlesArr', () => {
    const data = {
      title: 'Doc',
      ...setLeiArticles(['75']),
    }
    expect(data).toEqual({
      title: 'Doc',
      leiArticlesArr: ['75'],
    })
  })

  it('coerce números pra string', () => {
    // Defesa contra callers legados que passam number[] (ex: scripts/sync-tcu-manual)
    const result = setLeiArticles([75 as unknown as string, 18 as unknown as string])
    expect(result).toEqual({ leiArticlesArr: ['75', '18'] })
  })

  it('preserva ordem dos elementos', () => {
    const result = setLeiArticles(['18', '75', '6'])
    expect(result.leiArticlesArr).toEqual(['18', '75', '6'])
  })
})
