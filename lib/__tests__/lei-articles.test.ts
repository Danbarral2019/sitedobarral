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

describe('getLeiArticles', () => {
  it('lê o campo leiArticles de um record', () => {
    expect(getLeiArticles({ leiArticles: '["75","18"]' })).toEqual(['75', '18'])
    expect(getLeiArticles({ leiArticles: null })).toEqual([])
    expect(getLeiArticles({ leiArticles: undefined })).toEqual([])
    expect(getLeiArticles({})).toEqual([])
  })

  it('funciona com records que têm outros campos', () => {
    const doc = { id: 'd1', title: 'Doc', leiArticles: '["75"]', isPublic: true }
    expect(getLeiArticles(doc)).toEqual(['75'])
  })
})

describe('setLeiArticles', () => {
  it('produz objeto Prisma data pra array não-vazio', () => {
    expect(setLeiArticles(['75', '18'])).toEqual({ leiArticles: '["75","18"]' })
  })

  it('preserva [] como JSON empty string (mantém compat com pattern dominante)', () => {
    // Pattern dominante existente: `arr ? JSON.stringify(arr) : null`
    // → `[] ? JSON.stringify([]) : null` → '[]' (porque [] é truthy)
    expect(setLeiArticles([])).toEqual({ leiArticles: '[]' })
  })

  it('retorna leiArticles: null pra null', () => {
    expect(setLeiArticles(null)).toEqual({ leiArticles: null })
  })

  it('retorna leiArticles: null pra undefined', () => {
    expect(setLeiArticles(undefined)).toEqual({ leiArticles: null })
  })

  it('uso com spread em Prisma update', () => {
    const data = {
      title: 'Doc',
      ...setLeiArticles(['75']),
    }
    expect(data).toEqual({ title: 'Doc', leiArticles: '["75"]' })
  })
})
