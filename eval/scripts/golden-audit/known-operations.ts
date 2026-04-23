import type { KnownOperation } from './types'

/**
 * Operações pré-decididas em 2026-04-23 (ver spec:
 * docs/superpowers/specs/2026-04-23-fase6-golden-set-audit-design.md).
 *
 * Títulos em `addByTitle.titleQuery` são substrings usadas em LIKE contra
 * `Document.title` no banco. O script interativo confirma match antes de
 * aplicar.
 */
export const KNOWN_OPERATIONS: KnownOperation[] = [
  // ============ 8 queries E ============
  {
    queryId: 't-pesquisa-precos-in65-01',
    description: 'Adicionar IN 65/2021 (highly) + 2 Manuais TCU (relevant); manter ON 17/2009',
    addByTitle: [
      { titleQuery: 'IN SEGES/ME 65/2021', list: 'highly' },
      { titleQuery: 'Manual TCU - 4.3.9.1', list: 'relevant' },
      { titleQuery: 'Manual TCU - 4.3.9.3', list: 'relevant' },
    ],
    addById: [],
    removeIds: [],
  },
  {
    queryId: 't-eng-bdi-irpj-csll-01',
    description: 'Adicionar 5 Inf.s BDI/IRPJ/CSLL; Inf. 17/2010 em highly',
    addByTitle: [
      { titleQuery: 'Inf. 17/2010', list: 'highly' },
      { titleQuery: 'Inf. 12/2010', list: 'relevant' },
      { titleQuery: 'Inf. 44/2010', list: 'relevant' },
      { titleQuery: 'Inf. 279/2016', list: 'relevant' },
      { titleQuery: 'Inf. 222/2014', list: 'relevant' },
    ],
    addById: [],
    removeIds: [],
  },
  {
    queryId: 't-terceirizacao-art48-01',
    description: 'Adicionar Inf. 114/2012 (highly) + Inf. 345/2018 (relevant)',
    addByTitle: [
      { titleQuery: 'Inf. 114/2012', list: 'highly' },
      { titleQuery: 'Inf. 345/2018', list: 'relevant' },
    ],
    addById: [],
    removeIds: [],
  },
  {
    queryId: 'esp-518661-2',
    description: 'REMOVER ON AGU 2/2009 (anotação errada) + adicionar 5 docs remanescente de obra',
    addByTitle: [
      { titleQuery: 'Acórdão TCU 1498/2021', list: 'highly' },
      { titleQuery: 'Inf. 349/2018', list: 'relevant' },
      { titleQuery: 'Inf. 188/2014', list: 'relevant' },
      { titleQuery: 'Inf. 310/2016', list: 'relevant' },
      { titleQuery: 'Inf. 300/2016', list: 'relevant' },
    ],
    addById: [],
    removeIds: ['9add63a3'], // prefix; resolved to full UUID at runtime
  },
  {
    queryId: 'esp-669066-13',
    description: 'Adicionar 5 Inf.s adjudicação; 183/2014 e 237/2015 em highly',
    addByTitle: [
      { titleQuery: 'Inf. 183/2014', list: 'highly' },
      { titleQuery: 'Inf. 237/2015', list: 'highly' },
      { titleQuery: 'Inf. 173/2013', list: 'relevant' },
      { titleQuery: 'Inf. 216/2014', list: 'relevant' },
      { titleQuery: 'Inf. 250/2015', list: 'relevant' },
    ],
    addById: [],
    removeIds: [],
  },
  {
    queryId: 'esp-728449-12',
    description: 'Adicionar 2 Manuais TCU (highly) + 3 Inf.s orçamento (relevant)',
    addByTitle: [
      { titleQuery: 'Manual TCU - 4.4.3 Projeto Básico', list: 'highly' },
      { titleQuery: 'Manual TCU - 4.4.3.6 Orçamento detalhado', list: 'highly' },
      { titleQuery: 'Inf. 220/2014', list: 'relevant' },
      { titleQuery: 'Inf. 99/2012', list: 'relevant' },
      { titleQuery: 'Inf. 50/2011', list: 'relevant' },
    ],
    addById: [],
    removeIds: [],
  },
  {
    queryId: 'esp-792741-1',
    description: 'Adicionar Art. 125 + 2 Acórdãos (highly) + 2 Inf.s (relevant)',
    addByTitle: [
      { titleQuery: 'Art. 125 - Lei 14.133/2021', list: 'highly' },
      { titleQuery: 'Acórdão TCU 2391/2025', list: 'highly' },
      { titleQuery: 'Acórdão TCU 781/2021', list: 'highly' },
      { titleQuery: 'Inf. 516/2025', list: 'relevant' },
      { titleQuery: 'Inf. 476/2024', list: 'relevant' },
    ],
    addById: [],
    removeIds: [],
  },
  {
    queryId: 'esp-797806-1',
    description: 'Adicionar Art. 41 (highly) + Enunciados IBDA + Acórdão + Inf.',
    addByTitle: [
      { titleQuery: 'Art. 41 - Lei 14.133/2021', list: 'highly' },
      { titleQuery: 'Enunciado do IBDA nº 27', list: 'relevant' },
      { titleQuery: 'Enunciado do IBDA nº 5', list: 'relevant' },
      { titleQuery: 'Acórdão TCU 6875/2021', list: 'relevant' },
      { titleQuery: 'Inf. 413/2021', list: 'relevant' },
    ],
    addById: [],
    removeIds: [],
  },

  // ============ 2 IDs fantasma em q-data-a-data ============
  {
    queryId: 'q-data-a-data',
    description: 'Remover 2 IDs fantasma (docs inexistentes no DB)',
    addByTitle: [],
    addById: [],
    removeIds: [
      '96cbdacf-7387-4286-9529-f2aacc81e7d8',
      '097d3cdb-303b-40ec-b15b-e5ce70ae50ba',
    ],
  },

  // ============ dedup ON 89/2024 em esp-785767-20 ============
  // O ID duplicado é descoberto em runtime via spot-check SQL. O script
  // pergunta interativamente se aplica — este entry é placeholder.
]
