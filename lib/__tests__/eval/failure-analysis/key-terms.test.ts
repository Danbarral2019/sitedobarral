// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { extractKeyTerms, matchKeyTermsInText } from '@/eval/scripts/failure-analysis/key-terms'

describe('extractKeyTerms', () => {
  it('extrai número de lei com ponto e ano', () => {
    expect(extractKeyTerms('art. 75 da Lei 14.133/2021')).toEqual(
      expect.arrayContaining(['14.133/2021', 'art. 75'])
    )
  })

  it('extrai número de IN com órgão', () => {
    expect(extractKeyTerms('IN SEGES/ME 65/2021 pesquisa de preços')).toEqual(
      expect.arrayContaining(['IN SEGES/ME 65/2021'])
    )
  })

  it('extrai siglas maiúsculas com mais de 2 letras', () => {
    expect(extractKeyTerms('o BDI em contratos de TIC')).toEqual(
      expect.arrayContaining(['BDI', 'TIC'])
    )
  })

  it('ignora stopwords maiúsculas comuns', () => {
    const terms = extractKeyTerms('DO ou DE OU a')
    expect(terms).not.toEqual(expect.arrayContaining(['OU', 'DE', 'DO']))
  })

  it('retorna array vazio para query sem termos pesados', () => {
    expect(extractKeyTerms('pregão bens e serviços comuns')).toEqual([])
  })

  it('deduplica termos repetidos', () => {
    const terms = extractKeyTerms('art. 75 e art. 75 novamente')
    const artCount = terms.filter((t) => t === 'art. 75').length
    expect(artCount).toBe(1)
  })
})

describe('matchKeyTermsInText', () => {
  it('retorna mapa bool por termo, case-insensitive', () => {
    const hit = matchKeyTermsInText(['14.133/2021', 'BDI'], 'Lei 14.133/2021 diz que o bdi deve...')
    expect(hit).toEqual({ '14.133/2021': true, BDI: true })
  })

  it('detecta ausência', () => {
    const hit = matchKeyTermsInText(['IN SEGES/ME 65/2021'], 'pesquisa de preços conforme art. 23')
    expect(hit).toEqual({ 'IN SEGES/ME 65/2021': false })
  })

  it('funciona com texto vazio', () => {
    const hit = matchKeyTermsInText(['BDI'], '')
    expect(hit).toEqual({ BDI: false })
  })
})
