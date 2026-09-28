import { describe, it, expect } from 'vitest'
import { medirPar, histograma, piores, type ResultadoMedido } from './medida'

const doc = (id: string): ResultadoMedido => ({ documentId: id, sourceType: 'document' })
const tese = (id: string): ResultadoMedido => ({ documentId: id, sourceType: 'tese' })

describe('medirPar', () => {
  it('sem tese no resultado, nada é deslocado', () => {
    const lista = [doc('a'), doc('b'), doc('c'), doc('d'), doc('e')]
    const m = medirPar('q', lista, lista)
    expect(m.deslocados).toEqual([])
    expect(m.tesesNoTopN).toBe(0)
    expect(m.posicaoMediaDepois).toBe(m.posicaoMediaAntes)
  })

  it('aponta quem saiu do top-5 quando as teses entraram', () => {
    const sem = [doc('a'), doc('b'), doc('c'), doc('d'), doc('e'), doc('f')]
    const com = [tese('t1'), doc('a'), tese('t2'), doc('b'), doc('c'), doc('d'), doc('e')]
    const m = medirPar('q', sem, com)
    expect(m.deslocados).toEqual(['d', 'e'])
    expect(m.tesesNoTopN).toBe(2)
    expect(m.tesesNoTopo).toBe(2)
  })

  it('separa, entre os deslocados, os que o golden set anota como relevantes', () => {
    const sem = [doc('a'), doc('b'), doc('c'), doc('d'), doc('e')]
    const com = [tese('t1'), doc('a'), doc('b'), doc('c'), doc('d')]
    expect(medirPar('q', sem, com, ['e']).relevantesDeslocados).toEqual(['e'])
    expect(medirPar('q', sem, com, ['a']).relevantesDeslocados).toEqual([])
  })

  it('a posição média ignora as próprias teses', () => {
    const sem = [doc('a'), doc('b')]
    const com = [tese('t1'), doc('a'), doc('b')]
    const m = medirPar('q', sem, com)
    expect(m.posicaoMediaAntes).toBe(1.5)
    expect(m.posicaoMediaDepois).toBe(2.5)
  })
})

describe('histograma e piores', () => {
  const medidas = [
    medirPar('nenhum', [doc('a')], [doc('a')]),
    medirPar('um', [doc('a'), doc('b'), doc('c'), doc('d'), doc('e')], [tese('t'), doc('a'), doc('b'), doc('c'), doc('d')]),
    medirPar('dois', [doc('a'), doc('b'), doc('c'), doc('d'), doc('e')], [tese('t'), tese('u'), doc('a'), doc('b'), doc('c')]),
  ]

  it('conta queries por número de deslocados', () => {
    expect(histograma(medidas)).toEqual({ 0: 1, 1: 1, 2: 1 })
  })

  it('ordena as piores pelo número de deslocados', () => {
    expect(piores(medidas, 2).map((m) => m.query)).toEqual(['dois', 'um'])
  })
})
