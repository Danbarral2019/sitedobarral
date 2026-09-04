# Teses do TCU — Onda 3: superfícies web

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Levar as teses ao usuário — vitrine pública, página do acórdão-líder e acervo restrito — com a evidência sempre à vista e sem afirmar colegiado que não se sabe.

**Architecture:** Três rotas sobre os dados que as ondas anteriores já persistiram, seguindo o padrão do projeto (`page.tsx` servidor com metadata e `revalidate`, mais um `Client.tsx`). A leitura passa por uma camada de consulta única (`lib/teses/consultas.ts`) que aplica o predicado canônico e o nível de procedência — nenhuma página monta `where` à mão. A página de detalhe é **uma só** e varia a profundidade conforme o acesso do leitor.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Prisma 7, Tailwind CSS 4, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-04-publicacao-teses-tcu-design.md` — seções 4.3 (níveis de procedência), 6 (elegibilidade), 8.1 (as superfícies) e 10.2 (promoção à vitrine).

## Global Constraints

- **Diretório de trabalho:** `C:\Users\User\projetos\sitedobarral`. Rodar tudo da raiz.
- **Idioma:** comentários, mensagens de commit e **todo texto de interface** em português, com acentuação correta. O público é jurídico; o tom é formal.
- **Verificação obrigatória antes de reportar qualquer tarefa:** `npx vitest run` (suíte inteira) **e** `npx tsc --noEmit -p tsconfig.json`. Linha de base desta onda: **3.009 testes passando, zero erros de tipo.** O vitest usa esbuild e não checa tipos — suíte verde não prova compilação.
- **Site em produção.** Nenhuma tarefa altera rota existente além de acrescentar um item de menu. Nenhuma toca o banco com escrita, nem executa script.
- **Predicado canônico:** `WHERE_ELEGIVEL_BASE`, `WHERE_ELEGIVEL_VITRINE` e `evidenciaIntegral` vivem em `lib/tcu/elegibilidade-tese.ts`. Nenhuma tarefa reescreve a regra; todas importam.
- **A invariante que governa o desenho (§7.1):** nenhuma tese aparece sem a evidência que a sustenta, e nenhum trecho aparece sem caminho para o inteiro teor. Se uma tela precisar exibir tese sem trecho, o defeito está na consulta, não na tela.
- **Nunca afirmar colegiado que não se sabe (§4.3).** Nível 1 exibe o colegiado; nível 2 exibe com a contagem de votos que o sustentam; nível 3 não exibe.
- **Três arquivos são do usuário e não entram em commit algum:** `docs/audits/folha-teses-tcu-licitacoes.html`, `catalogacao-fontes-tcu-licitacoes.docx`, `.claude/settings.json`.
- **Staging explícito** — nunca `git add -A`.
- **Números medidos em 04/09/2026:** 90 enunciados publicáveis em 64 acórdãos-líderes; 59 deles de nível 1 (elegíveis à vitrine); 8 julgados individualmente.

---

### Task 1: Camada de consulta das teses

Uma só porta de leitura. Sem isto, cada uma das três rotas montaria seu próprio `where` e elas divergiriam — que é exatamente o defeito que o predicado canônico existe para impedir.

**Files:**
- Create: `lib/teses/consultas.ts`
- Test: `lib/teses/consultas.test.ts`

**Interfaces:**
- Consumes: `WHERE_ELEGIVEL_BASE`, `WHERE_ELEGIVEL_VITRINE`, `evidenciaIntegral` de `lib/tcu/elegibilidade-tese.ts`.
- Produces:
  - `type NivelProcedencia = 'oficial' | 'convergencia' | 'sem-colegiado'`
  - `nivelDe(d: { acordaoKey: string | null; origemIdentidade: string | null }): NivelProcedencia`
  - `chaveUrl(d: { numeroAlvo: number; anoAlvo: number; colegiadoAlvo: string | null }): string`
  - `listarVitrine(): Promise<TeseCard[]>`
  - `listarAcervo(): Promise<TeseCard[]>`
  - `buscarPorChave(chave: string, comAcessoAtivo: boolean): Promise<DetalheAcordao | null>`
  - `interface TeseCard`, `interface DetalheAcordao`

- [ ] **Step 1: Escrever os testes das funções puras**

Criar `lib/teses/consultas.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { nivelDe, chaveUrl } from './consultas';

describe('nivelDe', () => {
  it('com chave oficial do TCU é nível oficial', () => {
    expect(nivelDe({ acordaoKey: 'ACORDAO-COMPLETO-1', origemIdentidade: 'tcu-oficial' })).toBe('oficial');
  });

  it('sem chave mas com convergência é nível convergência', () => {
    expect(nivelDe({ acordaoKey: null, origemIdentidade: 'convergencia-citantes' })).toBe('convergencia');
  });

  it('sem chave e sem origem é sem-colegiado', () => {
    expect(nivelDe({ acordaoKey: null, origemIdentidade: null })).toBe('sem-colegiado');
  });

  it('a chave oficial manda, mesmo se a origem disser outra coisa', () => {
    // Defesa contra dado inconsistente: acordaoKey só é gravado quando o TCU
    // devolve exatamente um candidato, então ele é o sinal mais forte.
    expect(nivelDe({ acordaoKey: 'ACORDAO-COMPLETO-1', origemIdentidade: 'convergencia-citantes' })).toBe('oficial');
  });
});

describe('chaveUrl', () => {
  it('inclui o colegiado quando conhecido', () => {
    expect(chaveUrl({ numeroAlvo: 1441, anoAlvo: 2016, colegiadoAlvo: 'Plenário' })).toBe('1441-2016-plenario');
  });

  it('omite o colegiado quando não se sabe', () => {
    expect(chaveUrl({ numeroAlvo: 2298, anoAlvo: 2025, colegiadoAlvo: null })).toBe('2298-2025');
  });

  it('normaliza acento e espaço do colegiado', () => {
    expect(chaveUrl({ numeroAlvo: 56, anoAlvo: 2024, colegiadoAlvo: 'Segunda Câmara' })).toBe('56-2024-segunda-camara');
  });
});
```

- [ ] **Step 2: Rodar para confirmar que falha**

Run: `npx vitest run lib/teses/consultas.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar as funções puras e os tipos**

Criar `lib/teses/consultas.ts`:

```typescript
/**
 * A porta única de leitura das teses (spec §8.1).
 *
 * Três superfícies leem daqui — vitrine pública, página do acórdão-líder e
 * acervo restrito — e nenhuma monta `where` por conta própria. Consultas
 * espalhadas divergem, e divergência aqui significa publicar tese que não
 * deveria aparecer.
 */
import { prisma } from '@/lib/prisma';
import { WHERE_ELEGIVEL_BASE, WHERE_ELEGIVEL_VITRINE, evidenciaIntegral } from '@/lib/tcu/elegibilidade-tese';

export type NivelProcedencia = 'oficial' | 'convergencia' | 'sem-colegiado';

export interface TrechoExibido {
  ordem: number;
  trecho: string;
  origemNumero: number;
  origemAno: number;
  origemColegiado: string | null;
  origemUrl: string | null;
  origemLinkPDF: string | null;
  noVoto: boolean;
}

export interface TeseCard {
  enunciadoId: string;
  enunciado: string;
  inovacao: string;
  numeroAlvo: number;
  anoAlvo: number;
  colegiadoAlvo: string | null;
  nivel: NivelProcedencia;
  citantesConcordantes: number | null;
  citacoesNoVoto: number;
  chaveUrl: string;
  trechos: TrechoExibido[];
}

export interface DetalheAcordao {
  numeroAlvo: number;
  anoAlvo: number;
  colegiadoAlvo: string | null;
  relatorAlvo: string | null;
  urlAlvo: string | null;
  nivel: NivelProcedencia;
  citantesConcordantes: number | null;
  citacoesNoVoto: number;
  assunto: string;
  /** Teses que este leitor pode ver. */
  teses: TeseCard[];
  /** Quantas existem além dessas, para o bloco de chamada. Zero quando não há. */
  tesesReservadas: number;
}

/**
 * O nível governa o que a tela pode afirmar sobre o colegiado (§4.3).
 * `acordaoKey` manda: ele só é gravado quando o TCU devolve exatamente um
 * candidato, então é o sinal mais forte que existe.
 */
export function nivelDe(d: { acordaoKey: string | null; origemIdentidade: string | null }): NivelProcedencia {
  if (d.acordaoKey) return 'oficial';
  if (d.origemIdentidade === 'convergencia-citantes') return 'convergencia';
  return 'sem-colegiado';
}

function slug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '-');
}

/**
 * Segmento de URL do acórdão-líder. O colegiado entra apenas quando conhecido:
 * `/teses/2298-2025-plenario` afirmaria no próprio endereço o que a página não
 * afirma no corpo.
 */
export function chaveUrl(d: { numeroAlvo: number; anoAlvo: number; colegiadoAlvo: string | null }): string {
  const base = `${d.numeroAlvo}-${d.anoAlvo}`;
  return d.colegiadoAlvo ? `${base}-${slug(d.colegiadoAlvo)}` : base;
}
```

- [ ] **Step 4: Rodar os testes das funções puras**

Run: `npx vitest run lib/teses/consultas.test.ts`
Expected: PASS nos 7.

- [ ] **Step 5: Escrever o teste das consultas**

Acrescentar em `lib/teses/consultas.test.ts`, no topo do arquivo, o mock do Prisma (substitua a primeira linha de import, não acrescente uma segunda):

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockEnunciados, mockDestilacao } = vi.hoisted(() => ({
  mockEnunciados: vi.fn(),
  mockDestilacao: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    teseEnunciado: { findMany: (...a: unknown[]) => mockEnunciados(...a) },
    teseDestilacao: { findFirst: (...a: unknown[]) => mockDestilacao(...a) },
  },
}));
```

E os testes, ao final:

```typescript
const enunciadoDb = (over: Record<string, unknown> = {}) => ({
  id: 'e1',
  enunciado: 'A pretensão punitiva subordina-se ao prazo de dez anos.',
  inovacao: 'Fixou o prazo geral.',
  trechosFonte: [0],
  trechos: [
    {
      ordem: 0, trecho: 'Conforme o Acórdão 1441/2016...', origemNumero: 100, origemAno: 2020,
      origemColegiado: 'Plenário', origemUrl: 'https://u/100', origemLinkPDF: null,
      origemDocumentId: 'doc-100', noVoto: true,
    },
  ],
  destilacao: {
    numeroAlvo: 1441, anoAlvo: 2016, colegiadoAlvo: 'Plenário', acordaoKey: 'ACORDAO-COMPLETO-1',
    origemIdentidade: 'tcu-oficial', citantesConcordantes: null, dossieNoVoto: 262, assunto: 'Prescrição',
    relatorAlvo: 'Min. Fulano', urlAlvo: 'https://tcu/1',
  },
  ...over,
});

describe('listarVitrine', () => {
  beforeEach(() => vi.clearAllMocks());

  it('consulta com o predicado da vitrine, não o da base', async () => {
    const { listarVitrine } = await import('./consultas');
    mockEnunciados.mockResolvedValue([]);
    await listarVitrine();
    const where = mockEnunciados.mock.calls[0][0].where;
    expect(where.veredito).toBe('fiel');
    expect(where.publicado).toBe(true);
    expect(where.vitrinePublica).toBe(true);
    expect(where.destilacao.acordaoKey).toEqual({ not: null });
  });

  it('descarta enunciado com evidência incompleta', async () => {
    const { listarVitrine } = await import('./consultas');
    // declara dois índices, só um persistido
    mockEnunciados.mockResolvedValue([enunciadoDb({ trechosFonte: [0, 1] })]);
    expect(await listarVitrine()).toEqual([]);
  });

  it('monta o cartão com nível e chave de URL', async () => {
    const { listarVitrine } = await import('./consultas');
    mockEnunciados.mockResolvedValue([enunciadoDb()]);
    const [card] = await listarVitrine();
    expect(card.nivel).toBe('oficial');
    expect(card.chaveUrl).toBe('1441-2016-plenario');
    expect(card.citacoesNoVoto).toBe(262);
    expect(card.trechos).toHaveLength(1);
  });
});

describe('listarAcervo', () => {
  beforeEach(() => vi.clearAllMocks());

  it('usa o predicado da base e exige publicado, sem exigir vitrine', async () => {
    const { listarAcervo } = await import('./consultas');
    mockEnunciados.mockResolvedValue([]);
    await listarAcervo();
    const where = mockEnunciados.mock.calls[0][0].where;
    expect(where.publicado).toBe(true);
    expect(where.vitrinePublica).toBeUndefined();
    expect(where.destilacao.acordaoKey).toBeUndefined();
  });
});

describe('buscarPorChave', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sem acesso ativo, devolve só as teses da vitrine e conta as reservadas', async () => {
    const { buscarPorChave } = await import('./consultas');
    mockDestilacao.mockResolvedValue({
      numeroAlvo: 1441, anoAlvo: 2016, colegiadoAlvo: 'Plenário', relatorAlvo: 'Min. Fulano',
      urlAlvo: 'https://tcu/1', acordaoKey: 'ACORDAO-COMPLETO-1', origemIdentidade: 'tcu-oficial',
      citantesConcordantes: null, dossieNoVoto: 262, assunto: 'Prescrição',
      enunciados: [
        { ...enunciadoDb(), id: 'e1', vitrinePublica: true },
        { ...enunciadoDb(), id: 'e2', vitrinePublica: false },
      ],
    });
    const d = await buscarPorChave('1441-2016-plenario', false);
    expect(d?.teses.map(t => t.enunciadoId)).toEqual(['e1']);
    expect(d?.tesesReservadas).toBe(1);
  });

  it('com acesso ativo, devolve todas e não reserva nenhuma', async () => {
    const { buscarPorChave } = await import('./consultas');
    mockDestilacao.mockResolvedValue({
      numeroAlvo: 1441, anoAlvo: 2016, colegiadoAlvo: 'Plenário', relatorAlvo: null,
      urlAlvo: null, acordaoKey: 'ACORDAO-COMPLETO-1', origemIdentidade: 'tcu-oficial',
      citantesConcordantes: null, dossieNoVoto: 262, assunto: 'Prescrição',
      enunciados: [
        { ...enunciadoDb(), id: 'e1', vitrinePublica: true },
        { ...enunciadoDb(), id: 'e2', vitrinePublica: false },
      ],
    });
    const d = await buscarPorChave('1441-2016-plenario', true);
    expect(d?.teses.map(t => t.enunciadoId)).toEqual(['e1', 'e2']);
    expect(d?.tesesReservadas).toBe(0);
  });

  it('chave inexistente devolve null', async () => {
    const { buscarPorChave } = await import('./consultas');
    mockDestilacao.mockResolvedValue(null);
    expect(await buscarPorChave('9999-1999', false)).toBeNull();
  });
});
```

- [ ] **Step 6: Rodar para confirmar que falha**

Run: `npx vitest run lib/teses/consultas.test.ts`
Expected: FAIL — as três funções de consulta não existem.

- [ ] **Step 7: Implementar as consultas**

Acrescentar a `lib/teses/consultas.ts`:

```typescript
const SELECT_ENUNCIADO = {
  id: true,
  enunciado: true,
  inovacao: true,
  trechosFonte: true,
  trechos: {
    orderBy: { ordem: 'asc' as const },
    select: {
      ordem: true, trecho: true, origemNumero: true, origemAno: true,
      origemColegiado: true, origemUrl: true, origemLinkPDF: true,
      origemDocumentId: true, noVoto: true,
    },
  },
} as const;

const SELECT_DESTILACAO = {
  numeroAlvo: true, anoAlvo: true, colegiadoAlvo: true, relatorAlvo: true,
  urlAlvo: true, acordaoKey: true, origemIdentidade: true,
  citantesConcordantes: true, dossieNoVoto: true, assunto: true,
} as const;

type LinhaEnunciado = {
  id: string; enunciado: string; inovacao: string; trechosFonte: unknown;
  trechos: Array<TrechoExibido & { origemDocumentId: string | null }>;
};

function montarCard(e: LinhaEnunciado, d: {
  numeroAlvo: number; anoAlvo: number; colegiadoAlvo: string | null;
  acordaoKey: string | null; origemIdentidade: string | null;
  citantesConcordantes: number | null; dossieNoVoto: number;
}): TeseCard {
  return {
    enunciadoId: e.id,
    enunciado: e.enunciado,
    inovacao: e.inovacao,
    numeroAlvo: d.numeroAlvo,
    anoAlvo: d.anoAlvo,
    colegiadoAlvo: d.colegiadoAlvo,
    nivel: nivelDe(d),
    citantesConcordantes: d.citantesConcordantes,
    citacoesNoVoto: d.dossieNoVoto,
    chaveUrl: chaveUrl(d),
    trechos: e.trechos,
  };
}

async function listar(where: object): Promise<TeseCard[]> {
  const linhas = await prisma.teseEnunciado.findMany({
    where,
    select: { ...SELECT_ENUNCIADO, destilacao: { select: SELECT_DESTILACAO } },
    orderBy: [{ destilacao: { dossieNoVoto: 'desc' } }, { ordem: 'asc' }],
  });
  // A integralidade da evidência não cabe no filtro SQL (compara contagem
  // contra um campo Json), então é conferida aqui. Sem isto, uma tese com
  // fundamentação pela metade chegaria à tela.
  return linhas
    .filter(l => evidenciaIntegral(l as never))
    .map(l => montarCard(l as never, (l as never as { destilacao: never }).destilacao));
}

export function listarVitrine(): Promise<TeseCard[]> {
  return listar({ ...WHERE_ELEGIVEL_VITRINE, publicado: true, vitrinePublica: true });
}

export function listarAcervo(): Promise<TeseCard[]> {
  return listar({ ...WHERE_ELEGIVEL_BASE, publicado: true });
}

export async function buscarPorChave(chave: string, comAcessoAtivo: boolean): Promise<DetalheAcordao | null> {
  const partes = chave.split('-');
  const numeroAlvo = parseInt(partes[0], 10);
  const anoAlvo = parseInt(partes[1], 10);
  if (!Number.isFinite(numeroAlvo) || !Number.isFinite(anoAlvo)) return null;

  const d = await prisma.teseDestilacao.findFirst({
    where: { numeroAlvo, anoAlvo, atual: true },
    select: {
      ...SELECT_DESTILACAO,
      enunciados: {
        where: { ...WHERE_ELEGIVEL_BASE, publicado: true },
        orderBy: { ordem: 'asc' },
        select: { ...SELECT_ENUNCIADO, vitrinePublica: true },
      },
    },
  });
  if (!d) return null;

  const integros = d.enunciados.filter(e => evidenciaIntegral(e as never));
  const visiveis = comAcessoAtivo ? integros : integros.filter(e => e.vitrinePublica);

  return {
    numeroAlvo: d.numeroAlvo,
    anoAlvo: d.anoAlvo,
    colegiadoAlvo: d.colegiadoAlvo,
    relatorAlvo: d.relatorAlvo,
    urlAlvo: d.urlAlvo,
    nivel: nivelDe(d),
    citantesConcordantes: d.citantesConcordantes,
    citacoesNoVoto: d.dossieNoVoto,
    assunto: d.assunto,
    teses: visiveis.map(e => montarCard(e as never, d)),
    tesesReservadas: integros.length - visiveis.length,
  };
}
```

- [ ] **Step 8: Rodar os testes**

Run: `npx vitest run lib/teses/consultas.test.ts`
Expected: PASS nos 14.

- [ ] **Step 9: Verificar tipos e suíte**

Run: `npx tsc --noEmit -p tsconfig.json` e `npx vitest run`
Expected: zero erros; suíte verde.

- [ ] **Step 10: Commit**

```bash
git add lib/teses/consultas.ts lib/teses/consultas.test.ts
git commit -m "feat: camada de consulta das teses

Uma porta única de leitura para as três superfícies. Sem ela, cada rota
montaria seu próprio where e elas divergiriam — que é o defeito que o
predicado canônico existe para impedir.

O nível de procedência é derivado aqui, não na tela: acordaoKey manda,
porque só é gravado quando o TCU devolve exatamente um candidato.

A integralidade da evidência é conferida em memória porque compara
contagem contra um campo Json, que o Prisma não expressa em where."
```

---

### Task 2: O cartão da tese

O componente que aparece nas três telas. Separado porque é onde mora a regra de exibição do nível de procedência, e porque é testável sem rota.

**Files:**
- Create: `components/teses/CartaoTese.tsx`
- Test: `components/teses/__tests__/CartaoTese.test.tsx`

**Interfaces:**
- Consumes: `TeseCard`, `NivelProcedencia` de `lib/teses/consultas.ts`.
- Produces: `<CartaoTese tese={...} />`.

- [ ] **Step 1: Escrever os testes**

Criar `components/teses/__tests__/CartaoTese.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CartaoTese from '../CartaoTese';
import type { TeseCard } from '@/lib/teses/consultas';

const base: TeseCard = {
  enunciadoId: 'e1',
  enunciado: 'A pretensão punitiva subordina-se ao prazo de dez anos.',
  inovacao: 'Fixou o prazo geral.',
  numeroAlvo: 1441,
  anoAlvo: 2016,
  colegiadoAlvo: 'Plenário',
  nivel: 'oficial',
  citantesConcordantes: null,
  citacoesNoVoto: 262,
  chaveUrl: '1441-2016-plenario',
  trechos: [
    {
      ordem: 0, trecho: 'Conforme o Acórdão 1441/2016, o prazo é decenal.',
      origemNumero: 100, origemAno: 2020, origemColegiado: 'Plenário',
      origemUrl: 'https://u/100', origemLinkPDF: null, noVoto: true,
    },
  ],
};

describe('CartaoTese', () => {
  it('mostra o enunciado, o precedente e as citações', () => {
    render(<CartaoTese tese={base} />);
    expect(screen.getByText(/prazo de dez anos/)).toBeDefined();
    expect(screen.getByText(/1441\/2016/)).toBeDefined();
    expect(screen.getByText(/262/)).toBeDefined();
  });

  it('nível oficial exibe o colegiado sem ressalva', () => {
    render(<CartaoTese tese={base} />);
    expect(screen.getByText(/Plenário/)).toBeDefined();
    expect(screen.queryByText(/segundo os votos/i)).toBeNull();
  });

  it('nível convergência exibe o colegiado com a contagem que o sustenta', () => {
    render(<CartaoTese tese={{ ...base, nivel: 'convergencia', acordaoKeyAusente: true, citantesConcordantes: 23, colegiadoAlvo: 'Segunda Câmara' } as TeseCard} />);
    expect(screen.getByText(/Segunda Câmara/)).toBeDefined();
    expect(screen.getByText(/23/)).toBeDefined();
    expect(screen.getByText(/segundo os votos/i)).toBeDefined();
  });

  it('nível sem-colegiado não afirma colegiado algum', () => {
    render(<CartaoTese tese={{ ...base, nivel: 'sem-colegiado', colegiadoAlvo: null }} />);
    expect(screen.queryByText(/Plenário/)).toBeNull();
    expect(screen.getByText(/não identificado/i)).toBeDefined();
  });

  it('exibe o primeiro trecho-fonte, com link para o inteiro teor do citante', () => {
    render(<CartaoTese tese={base} />);
    expect(screen.getByText(/o prazo é decenal/)).toBeDefined();
    const link = screen.getByRole('link', { name: /100\/2020/ });
    expect(link.getAttribute('href')).toBe('https://u/100');
  });

  it('usa o PDF quando não há URL', () => {
    const semUrl = { ...base, trechos: [{ ...base.trechos[0], origemUrl: null, origemLinkPDF: 'https://p/100' }] };
    render(<CartaoTese tese={semUrl} />);
    expect(screen.getByRole('link', { name: /100\/2020/ }).getAttribute('href')).toBe('https://p/100');
  });
});
```

- [ ] **Step 2: Rodar para confirmar que falha**

Run: `npx vitest run components/teses`
Expected: FAIL — componente não existe.

- [ ] **Step 3: Implementar o componente**

Leia antes um componente de cartão já existente no projeto (por exemplo em `components/busca/` ou `components/area-restrita/search-results/`) e siga o mesmo vocabulário de Tailwind e a mesma densidade visual. Crie `components/teses/CartaoTese.tsx` com:

- o enunciado como texto principal;
- a identificação do precedente (`Acórdão 1441/2016`), com o colegiado **apenas** conforme o nível;
- no nível `convergencia`, a ressalva "colegiado segundo os N votos citantes que o informam";
- no nível `sem-colegiado`, a nota "colegiado não identificado";
- a contagem de citações no voto;
- o primeiro trecho-fonte visível, em bloco de citação, com o acórdão citante como link para `origemUrl ?? origemLinkPDF`;
- os demais trechos em `<details>`, fechado por padrão, rotulado com quantos são;
- link para `/teses/${tese.chaveUrl}`.

- [ ] **Step 4: Rodar os testes**

Run: `npx vitest run components/teses`
Expected: PASS nos 6.

- [ ] **Step 5: Verificar tipos e suíte**

Run: `npx tsc --noEmit -p tsconfig.json` e `npx vitest run`
Expected: zero erros; suíte verde.

- [ ] **Step 6: Commit**

```bash
git add components/teses/CartaoTese.tsx components/teses/__tests__/CartaoTese.test.tsx
git commit -m "feat: cartão da tese, com a procedência à vista

O nível de procedência governa o que o cartão pode afirmar: nível oficial
mostra o colegiado; convergência mostra com a contagem de votos que o
sustentam; sem-colegiado não afirma nada.

O primeiro trecho-fonte fica visível, não atrás de um clique — a
evidência é o que sustenta a tese, e esconder o que a sustenta é publicar
uma afirmação sem prova."
```

---

### Task 3: As três rotas, o menu e o sitemap

**Files:**
- Create: `app/(acervo)/teses/page.tsx`, `app/(acervo)/teses/TesesClient.tsx`
- Create: `app/(acervo)/teses/[chave]/page.tsx`
- Create: `app/area-restrita/teses/page.tsx`, `app/area-restrita/teses/AcervoTesesClient.tsx`
- Modify: `components/layout/Header.tsx`, `components/layout/Footer.tsx`, `app/sitemap.ts`
- Test: `app/(acervo)/teses/__tests__/acesso.test.ts`

**Interfaces:**
- Consumes: `listarVitrine`, `listarAcervo`, `buscarPorChave`, `TeseCard`, `DetalheAcordao` de `lib/teses/consultas.ts`; `CartaoTese` de `components/teses/CartaoTese.tsx`.
- Produces: as rotas `/teses`, `/teses/[chave]` e `/area-restrita/teses`.

- [ ] **Step 1: Escrever o teste da regra de acesso**

O que importa testar aqui é a decisão de acesso, não o HTML. Criar `app/(acervo)/teses/__tests__/acesso.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockUser, mockAcesso, mockBuscar } = vi.hoisted(() => ({
  mockUser: vi.fn(), mockAcesso: vi.fn(), mockBuscar: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({
  getCurrentUser: (...a: unknown[]) => mockUser(...a),
  hasAnyActiveAccess: (...a: unknown[]) => mockAcesso(...a),
}));
vi.mock('@/lib/teses/consultas', () => ({ buscarPorChave: (...a: unknown[]) => mockBuscar(...a) }));

import { resolverAcessoDoDetalhe } from '../[chave]/acesso';

describe('resolverAcessoDoDetalhe', () => {
  beforeEach(() => vi.clearAllMocks());

  it('visitante sem sessão não tem acesso ativo', async () => {
    mockUser.mockResolvedValue(null);
    expect(await resolverAcessoDoDetalhe()).toBe(false);
    expect(mockAcesso).not.toHaveBeenCalled();
  });

  it('admin tem acesso ativo sem consultar matrícula', async () => {
    mockUser.mockResolvedValue({ userId: 'u1', role: 'admin' });
    expect(await resolverAcessoDoDetalhe()).toBe(true);
    expect(mockAcesso).not.toHaveBeenCalled();
  });

  it('estudante delega para hasAnyActiveAccess', async () => {
    mockUser.mockResolvedValue({ userId: 'u1', role: 'student' });
    mockAcesso.mockResolvedValue(true);
    expect(await resolverAcessoDoDetalhe()).toBe(true);
    expect(mockAcesso).toHaveBeenCalledWith('u1');
  });

  it('estudante sem acesso ativo vê só a vitrine', async () => {
    mockUser.mockResolvedValue({ userId: 'u1', role: 'student' });
    mockAcesso.mockResolvedValue(false);
    expect(await resolverAcessoDoDetalhe()).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar para confirmar que falha**

Run: `npx vitest run app/(acervo)/teses`
Expected: FAIL — `resolverAcessoDoDetalhe` não existe.

- [ ] **Step 3: Implementar a resolução de acesso**

Criar `app/(acervo)/teses/[chave]/acesso.ts`:

```typescript
/**
 * Decide a profundidade da página de detalhe (spec §8.1).
 *
 * "Acesso ativo" é a regra canônica do site: matrícula válida OU assinatura
 * ativa (`hasAnyActiveAccess`), mais o admin. NÃO é "assinante" — um aluno
 * presencial com matrícula por QR code tem acesso sem nunca ter assinado, e
 * tratá-lo como visitante seria negar acesso a quem pagou pelo curso.
 */
import { getCurrentUser, hasAnyActiveAccess } from '@/lib/auth';

export async function resolverAcessoDoDetalhe(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  if (user.role === 'admin') return true;
  return hasAnyActiveAccess(user.userId);
}
```

- [ ] **Step 4: Rodar os testes de acesso**

Run: `npx vitest run app/(acervo)/teses`
Expected: PASS nos 4.

- [ ] **Step 5: Criar a vitrine pública**

`app/(acervo)/teses/page.tsx` — siga o padrão de `app/(acervo)/jurisprudencia/page.tsx` (leia-o antes): `metadata` com `title`, `description`, `openGraph` e `alternates.canonical`; `export const revalidate = 1800`; o componente busca com `listarVitrine()` e passa para o `TesesClient`.

O texto da página deve dizer o que as teses são, porque o leitor não tem como saber: enunciados em linguagem de súmula extraídos de como votos posteriores do próprio TCU invocam cada precedente, com os trechos que os sustentam à vista. Não use "geradas por IA" como rótulo de aviso nem esconda a origem — descreva o método.

`TesesClient.tsx` renderiza a lista de `CartaoTese`. Sem filtro nem busca nesta onda (YAGNI — a vitrine tem 20 itens).

- [ ] **Step 6: Criar a página do acórdão-líder**

`app/(acervo)/teses/[chave]/page.tsx`:

- `generateMetadata` a partir do `assunto` e do número do acórdão;
- chama `resolverAcessoDoDetalhe()` e passa o resultado a `buscarPorChave(chave, comAcessoAtivo)`;
- se devolver `null`, `notFound()`;
- renderiza o cabeçalho do acórdão (número, ano, colegiado conforme o nível, relator, citações no voto, link para `urlAlvo` quando houver) e a lista de `CartaoTese`;
- quando `tesesReservadas > 0`, renderiza um bloco de chamada dizendo quantas teses deste precedente estão no acervo restrito, com link para `/planos`;
- **`noindex` quando não houver tese visível.** Use `robots: { index: false }` no `generateMetadata` nesse caso. É a regra do spec §5: uma URL que perdeu elegibilidade não pode dar 404 nem continuar indexada.

- [ ] **Step 7: Criar o acervo restrito**

`app/area-restrita/teses/page.tsx` — siga o padrão de `app/area-restrita/jurisprudencia/page.tsx` (leia-o antes): `cookies()`, `verifyToken`, `redirect('/login')` se não houver sessão. **Acrescente o gate de acesso ativo**, que aquela página não tem: se `resolverAcessoDoDetalhe()` for falso, redirecione para `/planos`. Busca com `listarAcervo()`.

`AcervoTesesClient.tsx` renderiza a lista com um campo de filtro por texto sobre o enunciado e o assunto — aqui são 90 itens e crescendo, então filtrar se justifica.

- [ ] **Step 8: Acrescentar ao menu**

Em `components/layout/Header.tsx`, acrescente um item "Teses" entre Jurisprudência e Blog, copiando exatamente a estrutura dos vizinhos (mesmo `className`, mesmo padrão de `aria-current`, um ícone do `lucide-react` coerente — `Quote` ou `ScrollText`). Faça o mesmo no `components/layout/Footer.tsx`, na seção onde estão Jurisprudência e Glossário.

**Se o oitavo item quebrar o layout do menu no desktop**, pare e reporte em vez de reorganizar o Header — o agrupamento do menu é decisão de produto, não desta tarefa.

- [ ] **Step 9: Acrescentar ao sitemap**

Em `app/sitemap.ts`, acrescente `/teses` às páginas estáticas (`changeFrequency: 'weekly'`, `priority: 0.8`) e, no padrão do bloco do blog (com `try/catch`), as páginas de detalhe dos acórdãos-líderes que tenham ao menos uma tese na vitrine:

```typescript
  // Páginas de acórdãos-líderes com tese na vitrine
  let tesesPages: MetadataRoute.Sitemap = [];
  try {
    const { listarVitrine } = await import('@/lib/teses/consultas');
    const vitrine = await listarVitrine();
    const chaves = [...new Set(vitrine.map(t => t.chaveUrl))];
    tesesPages = chaves.map((chave) => ({
      url: absoluteUrl(`/teses/${chave}`),
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    }));
  } catch (error) {
    console.error('Erro ao gerar sitemap das teses:', error);
  }
```

Não esqueça de incluir `tesesPages` no array retornado, junto de `blogPages`.

- [ ] **Step 10: Verificar tipos, suíte e build**

Run: `npx tsc --noEmit -p tsconfig.json`, `npx vitest run` e `npm run build`
Expected: zero erros; suíte verde; build completo. O `build` importa aqui porque é o único passo que exercita a compilação das rotas novas e a geração estática.

- [ ] **Step 11: Commit**

```bash
git add "app/(acervo)/teses" app/area-restrita/teses components/layout/Header.tsx components/layout/Footer.tsx app/sitemap.ts
git commit -m "feat: superfícies web das teses do TCU

Três rotas sobre a camada de consulta única: vitrine pública, página do
acórdão-líder e acervo restrito.

A página de detalhe é uma só e varia a profundidade conforme o acesso —
o visitante vê as teses da vitrine e uma chamada para as demais, quem tem
acesso ativo vê todas. Duplicar a página separaria por audiência algo que
é o mesmo conteúdo.

Acesso ativo é a regra canônica (matrícula válida OU assinatura), não
'assinante': um aluno presencial com matrícula por QR code tem acesso sem
nunca ter assinado.

Página sem tese visível responde noindex, nunca 404 — uma URL que perdeu
elegibilidade foi indexada e não pode virar erro."
```

---

## Autorrevisão do plano

**Cobertura do spec (Onda 3 — passos 10 e 11 da §14):**

| Item | Task |
|---|---|
| Rota `/teses` (vitrine) | Task 3 |
| Rota `/teses/[chave]`, uma só, profundidade variável | Task 3 |
| Rota `/area-restrita/teses` (acervo) | Task 3 |
| Menu e sitemap | Task 3 |
| Predicado canônico, sem `where` à mão nas telas | Task 1 |
| Três níveis de procedência na exibição (§4.3) | Tasks 1 e 2 |
| Evidência à vista, com caminho para o inteiro teor (§7.1) | Task 2 |
| "Acesso ativo", não "assinante" (§8.1) | Task 3 |
| `noindex` em vez de 404 (§5) | Task 3 |

**Fora do escopo, por desenho:** a promoção à vitrine (§10.2) exige conferência individual e é trabalho manual do usuário, não código — hoje só 8 das 59 teses de nível 1 estão habilitadas. A busca por IA é a Onda 4.

**Uma inconsistência que corrigi ao revisar:** o teste do nível `convergencia` na Task 2 tinha um campo `acordaoKeyAusente` que não existe em `TeseCard` — resquício de uma versão anterior do tipo. O executor deve montar o objeto apenas com os campos de `TeseCard`, mudando `nivel`, `colegiadoAlvo` e `citantesConcordantes`. O `as TeseCard` naquele teste deve sair junto.

**Consistência de tipos:** `TeseCard` (Task 1) é consumido pela Task 2 e pela Task 3; `TrechoExibido` inclui `origemUrl` e `origemLinkPDF`, que o cartão usa com `??`. `DetalheAcordao.tesesReservadas` é o número que a Task 3 usa no bloco de chamada. `resolverAcessoDoDetalhe` (Task 3) é usada tanto pela página de detalhe quanto pelo gate do acervo restrito.

**Um risco que o executor deve conhecer:** o `select` de `buscarPorChave` filtra `enunciados` por `WHERE_ELEGIVEL_BASE`, mas a página existe mesmo quando o resultado é vazio — é o caso do `noindex`. Não transforme "sem tese visível" em `notFound()`; só a chave inexistente dá 404.
