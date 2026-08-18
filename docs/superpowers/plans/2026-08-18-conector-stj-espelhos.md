# Conector do STJ pelos Espelhos de Acórdãos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a fonte do STJ — do DataJud (capa processual, 0 de 254 decisões aprovadas) para os Espelhos de Acórdãos dos dados abertos do STJ (ementa real, ~2.000 julgados de licitação projetados).

**Architecture:** Módulo `lib/stj/` espelhando a divisão de `lib/stf/` (constantes / types / catalogo / consulta / recorte / normalizar / persistir), alimentado por `scripts/stj-runner.ts` e por um cron mensal. O parser de legislação citada, hoje exclusivo do STF, é extraído para `lib/jurisprudencia/` e passa a servir os dois tribunais.

**Tech Stack:** TypeScript, Next.js App Router, Prisma 7 (PrismaNeon), Vitest, API CKAN do Portal de Dados Abertos do STJ.

**Spec:** `docs/superpowers/specs/2026-08-18-conector-stj-espelhos-design.md`

## Global Constraints

- **Node/TS:** o projeto roda `tsx` com `--env-file=.env.local` para scripts. Comando padrão: `npx tsx --env-file=.env.local scripts/<arquivo>.ts`.
- **Testes:** Vitest. Todo arquivo de teste começa com `// @vitest-environment node`. Mocks de Prisma via `vi.hoisted` + `vi.mock('@/lib/prisma', …)`, seguindo `lib/stf/__tests__/persistir.test.ts`.
- **`npm run build` é obrigatório antes de abrir PR que toque `app/api/`** — `tsc --noEmit` e a suíte não pegam `export const` inválido em `route.ts`. Vale para a Task 7.
- **Nunca excluir registros do banco.** Os 254 registros do DataJud são marcados, não apagados.
- **Amarração à norma vem só do campo estruturado**, nunca de `classification.leiArticles` — a heurística de texto captaria "art. 37 da Constituição" como artigo da 14.133.
- **`classifyDecision(input)` não chama LLM** (o parâmetro `useAI` é `false` por default). `generateDecisionSummary` **chama Gemini** e custa — ver Task 6.
- **Tribunal code canônico:** `normalizeTribunalCode('stj')` → `'STJ'` maiúsculo. Normalizar no ponto de escrita, nunca só migrar dados depois.
- **Cabeçalhos obrigatórios** em toda requisição ao domínio `dadosabertos.web.stj.jus.br` (sem eles o WAF devolve 1.193 bytes de página de erro com HTTP 200):
  `User-Agent`, `Accept`, `Accept-Language`, `Referer`, `Sec-Fetch-Dest`, `Sec-Fetch-Mode`, `Sec-Fetch-Site`, `Upgrade-Insecure-Requests`.

## File Structure

| arquivo | responsabilidade |
|---|---|
| `lib/jurisprudencia/legislacao-citada.ts` | **novo** — parser compartilhado STF+STJ, separador `[-:]` |
| `lib/stf/legislacao-citada.ts` | passa a reexportar do compartilhado |
| `lib/stj/constantes.ts` | slugs dos 4 datasets, vocabulário do recorte, URL base |
| `lib/stj/types.ts` | `EspelhoBruto` (como o STJ publica) e `StjDecisaoNormalizada` |
| `lib/stj/consulta.ts` | `baixar(url)` com os cabeçalhos que vencem o WAF |
| `lib/stj/catalogo.ts` | `listarDumps(slug)` via CKAN `package_search` |
| `lib/stj/recorte.ts` | `ehRelevanteParaBase(espelho)` |
| `lib/stj/normalizar.ts` | `normalizarEspelho(bruto)` → `StjDecisaoNormalizada` |
| `lib/stj/persistir.ts` | upsert idempotente + amarração autoritativa |
| `lib/stj/coletar.ts` | orquestra: catálogo → download → recorte → persistência |
| `scripts/stj-runner.ts` | wrapper de linha de comando sobre `coletar` |
| `app/api/cron/sync-stj/route.ts` | cron mensal |

> **Por que a orquestração vive em `lib/` e não em `scripts/`:** `tsconfig.json`
> tem `"exclude": ["node_modules", "scripts/**/*"]`. Uma rota em `app/api/` que
> importasse de `@/scripts/…` quebraria o `next build`. O script é só a casca de
> CLI; a lógica fica em `lib/stj/coletar.ts`, importável pelos dois lados.
| `scripts/aposentar-datajud-stj.ts` | marca os 254 registros legados |

---

### Task 1: Parser de legislação citada compartilhado

Extrai o parser do STF para uso comum, generalizando o separador. O STF está em produção há dois dias — os testes de caracterização vêm **antes** do movimento do código.

**Files:**
- Create: `lib/jurisprudencia/legislacao-citada.ts`
- Create: `lib/jurisprudencia/__tests__/legislacao-citada.test.ts`
- Modify: `lib/stf/legislacao-citada.ts` (vira reexportação)
- Test: `lib/stf/__tests__/legislacao-citada.test.ts` (permanece, deve seguir passando intacto)

**Interfaces:**
- Consumes: nada
- Produces: `extrairArtigos14133(campo: string[] | string | null | undefined): string[]` e `citaLei14133(campo: string[] | string | null | undefined): boolean`

- [ ] **Step 1: Rodar a suíte atual do parser do STF e guardar o resultado como caracterização**

Run: `npx vitest run lib/stf/__tests__/legislacao-citada.test.ts`
Expected: PASS. Anote o número de testes — ele não pode diminuir ao fim da task.

- [ ] **Step 2: Escrever o teste do parser compartilhado, com os dois separadores**

Criar `lib/jurisprudencia/__tests__/legislacao-citada.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { extrairArtigos14133, citaLei14133 } from '../legislacao-citada';

// Formato do STF: separador "-"
const STF_14133 = `LEG-FED   LEI-014133 ANO-2021
    ART-00006 ART-00075 INC-00002
    LEI ORDINÁRIA`;

// Formato do STJ: separador ":"
const STJ_14133 = `LEG:FED LEI:014133 ANO:2021
 *****  NLL-21    NOVA LEI DE LICITAÇÕES
        ART:00075`;

const STJ_CPC = `LEG:FED LEI:013105 ANO:2015
 *****  CPC-15    CÓDIGO DE PROCESSO CIVIL DE 2015
        ART:00967`;

describe('extrairArtigos14133 — separador do STF', () => {
  it('extrai artigos do bloco com hífen', () => {
    expect(extrairArtigos14133([STF_14133])).toEqual(['6', '75']);
  });
});

describe('extrairArtigos14133 — separador do STJ', () => {
  it('extrai artigos do bloco com dois-pontos', () => {
    expect(extrairArtigos14133([STJ_14133])).toEqual(['75']);
  });

  it('ignora bloco de outra lei no formato do STJ', () => {
    expect(extrairArtigos14133([STJ_CPC])).toEqual([]);
  });

  it('separa por bloco: só os artigos do bloco da 14.133 entram', () => {
    expect(extrairArtigos14133([STJ_CPC, STJ_14133])).toEqual(['75']);
  });
});

describe('citaLei14133', () => {
  it('reconhece a lei nos dois formatos', () => {
    expect(citaLei14133([STF_14133])).toBe(true);
    expect(citaLei14133([STJ_14133])).toBe(true);
  });

  it('é falso quando só há outra lei', () => {
    expect(citaLei14133([STJ_CPC])).toBe(false);
  });
});
```

- [ ] **Step 3: Rodar o teste novo e verificar que falha**

Run: `npx vitest run lib/jurisprudencia/__tests__/legislacao-citada.test.ts`
Expected: FAIL — o módulo `lib/jurisprudencia/legislacao-citada.ts` ainda não existe.

- [ ] **Step 4: Criar o parser compartilhado**

Criar `lib/jurisprudencia/legislacao-citada.ts`:

```ts
/**
 * Extração dos dispositivos da Lei 14.133/2021 citados num julgado.
 *
 * Dois tribunais publicam legislação citada em campo estruturado, no mesmo
 * desenho e com separadores diferentes:
 *
 *   STF (documental_legislacao_citada_texto)   LEG-FED LEI-014133 ANO-2021
 *                                                  ART-00075 INC-00002
 *   STJ (referenciasLegislativas)              LEG:FED LEI:014133 ANO:2021
 *                                                  ART:00075
 *
 * Como cada norma vive em seu próprio bloco, filtrar o bloco pelo token da lei
 * e só então extrair os artigos dá amarração artigo↔julgado DETERMINÍSTICA —
 * sem heurística de proximidade e sem LLM. É a razão principal destes conectores.
 */

/** Aceita `LEI-014133` e `LEI:014133`, com ou sem zeros à esquerda. */
const RE_TOKEN_LEI_14133 = /LEI[-:]0*14133\b/i;

/** `ART-00075` / `ART:00075` → `75`; `ART-00184-A` → `184-A`. Incisos não casam. */
const RE_ARTIGO = /ART[-:](\d{1,5})(?:-([A-Z]))?/g;

function blocos(campo: string[] | string | null | undefined): string[] {
  if (campo === null || campo === undefined) return [];
  return (Array.isArray(campo) ? campo : [campo]).map(String);
}

export function citaLei14133(campo: string[] | string | null | undefined): boolean {
  return blocos(campo).some((b) => RE_TOKEN_LEI_14133.test(b));
}

export function extrairArtigos14133(campo: string[] | string | null | undefined): string[] {
  const artigos = new Set<string>();

  for (const bloco of blocos(campo)) {
    if (!RE_TOKEN_LEI_14133.test(bloco)) continue;

    RE_ARTIGO.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = RE_ARTIGO.exec(bloco)) !== null) {
      const numero = m[1].replace(/^0+/, '') || '0';
      artigos.add(m[2] ? `${numero}-${m[2]}` : numero);
    }
  }

  return Array.from(artigos).sort((a, b) => {
    const na = parseInt(a, 10);
    const nb = parseInt(b, 10);
    return na !== nb ? na - nb : a.localeCompare(b);
  });
}
```

- [ ] **Step 5: Rodar o teste novo e verificar que passa**

Run: `npx vitest run lib/jurisprudencia/__tests__/legislacao-citada.test.ts`
Expected: PASS (6 testes)

- [ ] **Step 6: Transformar o módulo do STF em reexportação**

Substituir todo o conteúdo de `lib/stf/legislacao-citada.ts` por:

```ts
/**
 * Legislação citada do STF.
 *
 * O parser é compartilhado com o STJ desde 18/08/2026 — os dois tribunais
 * publicam o mesmo desenho de bloco, mudando só o separador. Ver
 * `lib/jurisprudencia/legislacao-citada.ts`.
 */
export { citaLei14133, extrairArtigos14133 } from '@/lib/jurisprudencia/legislacao-citada';
```

- [ ] **Step 7: Rodar a caracterização do STF — o comportamento não pode ter mudado**

Run: `npx vitest run lib/stf/__tests__/legislacao-citada.test.ts`
Expected: PASS, com o mesmo número de testes do Step 1.

- [ ] **Step 8: Rodar a suíte inteira do STF**

Run: `npx vitest run lib/stf/`
Expected: PASS em todos os arquivos.

- [ ] **Step 9: Commit**

```bash
git add lib/jurisprudencia lib/stf/legislacao-citada.ts
git commit -m "refactor(jurisprudencia): parser de legislacao citada compartilhado entre STF e STJ"
```

---

### Task 2: Constantes, tipos e recorte temático

Lógica pura, sem rede e sem banco. Define o que é um espelho e o que entra na base.

**Files:**
- Create: `lib/stj/constantes.ts`, `lib/stj/types.ts`, `lib/stj/recorte.ts`
- Test: `lib/stj/__tests__/recorte.test.ts`

**Interfaces:**
- Consumes: `citaLei14133` de `lib/jurisprudencia/legislacao-citada` (Task 1)
- Produces: `EspelhoBruto`, `StjDecisaoNormalizada`, `DATASETS_STJ`, `ehRelevanteParaBase(e: EspelhoBruto): boolean`

- [ ] **Step 1: Criar constantes e tipos**

Criar `lib/stj/constantes.ts`:

```ts
/** Portal de Dados Abertos do STJ (CKAN). */
export const BASE_DADOS_ABERTOS_STJ = 'https://dadosabertos.web.stj.jus.br';

/**
 * Órgãos coletados: onde o STJ julga direito público.
 *
 * Ficam de fora Segunda Seção e Terceira/Quarta Turma (direito privado) e
 * Terceira Seção e Quinta/Sexta Turma (penal). Rendimento medido em 12 dumps
 * amostrados: 117 relevantes em 2.497 acórdãos (4,7%).
 */
export const DATASETS_STJ = [
  { slug: 'espelhos-de-acordaos-corte-especial', orgao: 'Corte Especial' },
  { slug: 'espelhos-de-acordaos-primeira-secao', orgao: 'Primeira Seção' },
  { slug: 'espelhos-de-acordaos-primeira-turma', orgao: 'Primeira Turma' },
  { slug: 'espelhos-de-acordaos-segunda-turma', orgao: 'Segunda Turma' },
] as const;

export const TRIBUNAL_NAME_STJ = 'Superior Tribunal de Justiça';
export const SOURCE_API_STJ = 'stj-espelhos-dados-abertos';
export const SCRAPER_CODE_STJ = 'stj-espelhos';

/** Vocabulário do recorte — condição 2 do critério do spec. */
export const RE_VOCABULARIO_LICITACAO =
  /licita|contrato administrativo|preg[aã]o|dispensa de licita|inexigibilidade|concorr[eê]ncia p[uú]blica|tomada de pre[cç]o|contrata[cç][aã]o p[uú]blica/i;

/** Condição 1 — normas cuja citação basta para o espelho entrar. */
export const RE_NORMAS_LICITACAO = /LEI[-:]0*(14133|8666|10520)\b/i;
```

Criar `lib/stj/types.ts`:

```ts
/** Espelho de acórdão como o STJ publica no dump JSON mensal. */
export interface EspelhoBruto {
  id?: string;
  numeroDocumento?: string | null;
  numeroProcesso?: string | null;
  numeroRegistro?: string | null;
  siglaClasse?: string | null;
  descricaoClasse?: string | null;
  classePadronizada?: string | null;
  nomeOrgaoJulgador?: string | null;
  ministroRelator?: string | null;
  /** Vem como "DJEN       DATA:22/05/2026". */
  dataPublicacao?: string | null;
  ementa?: string | null;
  tipoDeDecisao?: string | null;
  /** Formato AAAAMMDD, ex.: "20260519". */
  dataDecisao?: string | null;
  decisao?: string | null;
  jurisprudenciaCitada?: string | null;
  notas?: string | null;
  informacoesComplementares?: string | null;
  termosAuxiliares?: string | null;
  teseJuridica?: string | null;
  tema?: string | null;
  referenciasLegislativas?: string[] | null;
  acordaosSimilares?: string[] | null;
}

/** Forma interna, saneada, pronta para a persistência. */
export interface StjDecisaoNormalizada {
  sourceId: string;
  fullIdentifier: string;
  decisionType: 'acordao';
  classe: string;
  decisionNumber: string;
  processNumber: string | null;
  year: number;
  title: string;
  ementa: string;
  relator: string | null;
  orgaoJulgador: string | null;
  dataJulgamento: Date | null;
  dataPublicacao: Date | null;
  url: string;
  tema: string | null;
  tese: string | null;
  artigos14133: string[];
  citaLei14133: boolean;
}
```

- [ ] **Step 2: Escrever o teste do recorte**

Criar `lib/stj/__tests__/recorte.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { ehRelevanteParaBase } from '../recorte';
import type { EspelhoBruto } from '../types';

function espelho(over: Partial<EspelhoBruto> = {}): EspelhoBruto {
  return {
    id: '959632',
    numeroRegistro: '202402187409',
    siglaClasse: 'REsp',
    nomeOrgaoJulgador: 'PRIMEIRA SEÇÃO',
    ementa: 'PROCESSUAL CIVIL E TRIBUTÁRIO. ICMS. CREDITAMENTO.',
    referenciasLegislativas: [],
    ...over,
  };
}

describe('ehRelevanteParaBase', () => {
  it('entra pela referência legislativa à Lei 14.133, mesmo sem vocabulário na ementa', () => {
    const e = espelho({
      referenciasLegislativas: ['LEG:FED LEI:014133 ANO:2021\n        ART:00075'],
    });
    expect(ehRelevanteParaBase(e)).toBe(true);
  });

  it('entra pela referência à Lei 8.666', () => {
    const e = espelho({ referenciasLegislativas: ['LEG:FED LEI:008666 ANO:1993\n ART:00024'] });
    expect(ehRelevanteParaBase(e)).toBe(true);
  });

  it('entra pelo vocabulário na ementa, mesmo sem referência estruturada', () => {
    const e = espelho({ ementa: 'ADMINISTRATIVO. LICITAÇÃO. PREGÃO ELETRÔNICO. HABILITAÇÃO.' });
    expect(ehRelevanteParaBase(e)).toBe(true);
  });

  it('entra pelo vocabulário na tese jurídica', () => {
    const e = espelho({ teseJuridica: 'É vedada a inexigibilidade fora das hipóteses legais.' });
    expect(ehRelevanteParaBase(e)).toBe(true);
  });

  it('fica de fora o acórdão tributário sem licitação', () => {
    expect(ehRelevanteParaBase(espelho())).toBe(false);
  });

  it('fica de fora quando só há referência a outra lei', () => {
    const e = espelho({ referenciasLegislativas: ['LEG:FED LEI:013105 ANO:2015\n ART:00967'] });
    expect(ehRelevanteParaBase(e)).toBe(false);
  });

  it('não quebra com campos nulos', () => {
    const e = espelho({ ementa: null, teseJuridica: null, referenciasLegislativas: null });
    expect(ehRelevanteParaBase(e)).toBe(false);
  });
});
```

- [ ] **Step 3: Rodar o teste e verificar que falha**

Run: `npx vitest run lib/stj/__tests__/recorte.test.ts`
Expected: FAIL — `lib/stj/recorte.ts` não existe.

- [ ] **Step 4: Implementar o recorte**

Criar `lib/stj/recorte.ts`:

```ts
/**
 * Regra de seleção: o que dos Espelhos de Acórdãos do STJ entra na base.
 *
 * O espelho entra se satisfizer QUALQUER das duas condições:
 *   1. cita 14.133, 8.666 ou 10.520 no campo estruturado de referências
 *      legislativas — determinístico, não passa por texto livre;
 *   2. casa o vocabulário de licitações na ementa ou na tese jurídica —
 *      rede de segurança para o julgado que discute o tema sem citar a
 *      norma no campo estruturado.
 *
 * Rendimento medido sobre 12 dumps (2.497 acórdãos): 117 entram, 4,7%.
 * Desvio grande desse patamar é sinal de regex frouxa.
 */

import { RE_NORMAS_LICITACAO, RE_VOCABULARIO_LICITACAO } from './constantes';
import type { EspelhoBruto } from './types';

export function ehRelevanteParaBase(e: EspelhoBruto): boolean {
  const refs = (e.referenciasLegislativas ?? []).join('\n');
  if (RE_NORMAS_LICITACAO.test(refs)) return true;

  const texto = `${e.ementa ?? ''}\n${e.teseJuridica ?? ''}`;
  return RE_VOCABULARIO_LICITACAO.test(texto);
}
```

- [ ] **Step 5: Rodar o teste e verificar que passa**

Run: `npx vitest run lib/stj/__tests__/recorte.test.ts`
Expected: PASS (7 testes)

- [ ] **Step 6: Commit**

```bash
git add lib/stj/constantes.ts lib/stj/types.ts lib/stj/recorte.ts lib/stj/__tests__/recorte.test.ts
git commit -m "feat(stj): constantes, tipos e recorte tematico dos espelhos de acordaos"
```

---

### Task 3: Acesso à fonte — consulta e catálogo

Isola tudo que fala com a rede. Os cabeçalhos ficam em um lugar só: sem eles o WAF devolve HTTP 200 com uma página de erro de 1.193 bytes, que parseia como JSON inválido.

**Files:**
- Create: `lib/stj/consulta.ts`, `lib/stj/catalogo.ts`
- Test: `lib/stj/__tests__/catalogo.test.ts`

**Interfaces:**
- Consumes: `BASE_DADOS_ABERTOS_STJ`, `DATASETS_STJ` (Task 2)
- Produces: `baixar(url: string, referer?: string): Promise<string>`, `listarDumps(slug: string): Promise<DumpMensal[]>` com `interface DumpMensal { nome: string; url: string }`

- [ ] **Step 1: Criar o módulo de consulta**

Criar `lib/stj/consulta.ts`:

```ts
/**
 * Acesso HTTP ao Portal de Dados Abertos do STJ.
 *
 * O host está atrás de um WAF F5 que rejeita cliente sem cara de navegador —
 * e rejeita devolvendo HTTP **200** com uma página de erro de ~1.2 KB, não um
 * status de erro. Por isso a checagem abaixo olha o corpo, não só o status.
 *
 * Diferente do STF, não há detecção de headless nem desafio JavaScript:
 * estes cabeçalhos bastam, e o conector roda desatendido em cron.
 */

import { BASE_DADOS_ABERTOS_STJ } from './constantes';

const CABECALHOS_NAVEGADOR: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'same-origin',
  'Upgrade-Insecure-Requests': '1',
};

/** Assinatura da página de rejeição do WAF, servida com HTTP 200. */
const MARCA_WAF = 'The requested URL was rejected';

export class RespostaBloqueadaError extends Error {
  constructor(url: string) {
    super(`WAF do STJ rejeitou a requisição para ${url}`);
    this.name = 'RespostaBloqueadaError';
  }
}

export async function baixar(
  url: string,
  referer: string = `${BASE_DADOS_ABERTOS_STJ}/`
): Promise<string> {
  const resposta = await fetch(url, {
    headers: { ...CABECALHOS_NAVEGADOR, Referer: referer },
    signal: AbortSignal.timeout(90_000),
  });

  if (!resposta.ok) {
    throw new Error(`HTTP ${resposta.status} em ${url}`);
  }

  const corpo = await resposta.text();
  if (corpo.includes(MARCA_WAF)) {
    throw new RespostaBloqueadaError(url);
  }

  return corpo;
}
```

- [ ] **Step 2: Escrever o teste do catálogo**

Criar `lib/stj/__tests__/catalogo.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockBaixar } = vi.hoisted(() => ({ mockBaixar: vi.fn() }));

vi.mock('../consulta', () => ({
  baixar: (...a: unknown[]) => mockBaixar(...a),
  RespostaBloqueadaError: class extends Error {},
}));

import { listarDumps } from '../catalogo';

const RESPOSTA_CKAN = JSON.stringify({
  result: {
    results: [
      {
        name: 'espelhos-de-acordaos-primeira-secao',
        resources: [
          { name: '20260630.json', format: 'JSON', url: 'https://x/20260630.json' },
          { name: '20260531.json', format: 'JSON', url: 'https://x/20260531.json' },
          { name: 'tudo.zip', format: 'ZIP', url: 'https://x/tudo.zip' },
          { name: '20260430.csv', format: 'CSV', url: 'https://x/20260430.csv' },
        ],
      },
    ],
  },
});

beforeEach(() => mockBaixar.mockReset());

describe('listarDumps', () => {
  it('devolve só os recursos JSON', async () => {
    mockBaixar.mockResolvedValue(RESPOSTA_CKAN);
    const dumps = await listarDumps('espelhos-de-acordaos-primeira-secao');
    expect(dumps.map((d) => d.nome)).toEqual(['20260630.json', '20260531.json']);
  });

  it('ordena do mais recente para o mais antigo', async () => {
    mockBaixar.mockResolvedValue(RESPOSTA_CKAN);
    const dumps = await listarDumps('espelhos-de-acordaos-primeira-secao');
    expect(dumps[0].nome).toBe('20260630.json');
  });

  it('usa package_search, não package_show — package_show é rejeitada pelo WAF', async () => {
    mockBaixar.mockResolvedValue(RESPOSTA_CKAN);
    await listarDumps('espelhos-de-acordaos-primeira-secao');
    const urlChamada = String(mockBaixar.mock.calls[0][0]);
    expect(urlChamada).toContain('package_search');
    expect(urlChamada).not.toContain('package_show');
  });

  it('devolve lista vazia quando o dataset não existe', async () => {
    mockBaixar.mockResolvedValue(JSON.stringify({ result: { results: [] } }));
    expect(await listarDumps('inexistente')).toEqual([]);
  });
});
```

- [ ] **Step 3: Rodar o teste e verificar que falha**

Run: `npx vitest run lib/stj/__tests__/catalogo.test.ts`
Expected: FAIL — `lib/stj/catalogo.ts` não existe.

- [ ] **Step 4: Implementar o catálogo**

Criar `lib/stj/catalogo.ts`:

```ts
/**
 * Descoberta dos dumps mensais de um dataset de espelhos.
 *
 * A API CKAN do STJ é irregular: `package_show` é rejeitada pelo WAF,
 * `package_search?q=name:<slug>` passa. Há teste travando essa escolha.
 */

import { BASE_DADOS_ABERTOS_STJ } from './constantes';
import { baixar } from './consulta';

export interface DumpMensal {
  /** Ex.: "20260630.json" — o nome carrega a competência do dump. */
  nome: string;
  url: string;
}

export async function listarDumps(slug: string): Promise<DumpMensal[]> {
  const url = `${BASE_DADOS_ABERTOS_STJ}/api/3/action/package_search?q=name:${slug}&rows=1`;
  const corpo = await baixar(url);
  const dados = JSON.parse(corpo) as {
    result?: { results?: Array<{ resources?: Array<Record<string, unknown>> }> };
  };

  const pacote = dados.result?.results?.[0];
  if (!pacote) return [];

  return (pacote.resources ?? [])
    .filter((r) => String(r.format).toUpperCase() === 'JSON')
    .map((r) => ({ nome: String(r.name), url: String(r.url) }))
    .sort((a, b) => b.nome.localeCompare(a.nome));
}
```

- [ ] **Step 5: Rodar o teste e verificar que passa**

Run: `npx vitest run lib/stj/__tests__/catalogo.test.ts`
Expected: PASS (4 testes)

- [ ] **Step 6: Verificar contra a fonte real, não só contra o mock**

Run:
```bash
npx tsx --env-file=.env.local -e "import {listarDumps} from '@/lib/stj/catalogo'; const d = await listarDumps('espelhos-de-acordaos-primeira-secao'); console.log(d.length, d[0]);"
```
Expected: um número em torno de 52 e um objeto com `nome` terminando em `.json`. Se vier `RespostaBloqueadaError`, os cabeçalhos de `consulta.ts` precisam de revisão — não prossiga.

- [ ] **Step 7: Commit**

```bash
git add lib/stj/consulta.ts lib/stj/catalogo.ts lib/stj/__tests__/catalogo.test.ts
git commit -m "feat(stj): acesso ao portal de dados abertos e catalogo de dumps mensais"
```

---

### Task 4: Normalização

Converte o espelho publicado para a forma interna. É onde moram os dois defeitos que o conector antigo tinha: data inválida e mojibake.

**Files:**
- Create: `lib/stj/normalizar.ts`
- Test: `lib/stj/__tests__/normalizar.test.ts`

**Interfaces:**
- Consumes: `EspelhoBruto`, `StjDecisaoNormalizada` (Task 2); `extrairArtigos14133`, `citaLei14133` (Task 1)
- Produces: `normalizarEspelho(e: EspelhoBruto, orgaoPadrao: string): StjDecisaoNormalizada | null` — devolve `null` quando falta `numeroRegistro` ou `ementa`

- [ ] **Step 1: Escrever o teste da normalização**

Criar `lib/stj/__tests__/normalizar.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { normalizarEspelho } from '../normalizar';
import type { EspelhoBruto } from '../types';

function espelho(over: Partial<EspelhoBruto> = {}): EspelhoBruto {
  return {
    id: '959632',
    numeroRegistro: '202402187409',
    numeroProcesso: '2669939',
    siglaClasse: 'REsp',
    descricaoClasse: 'RECURSO ESPECIAL',
    nomeOrgaoJulgador: 'PRIMEIRA SEÇÃO',
    ministroRelator: 'FRANCISCO FALCÃO',
    dataPublicacao: 'DJEN       DATA:22/05/2026',
    dataDecisao: '20260519',
    ementa: 'ADMINISTRATIVO. LICITAÇÃO. PREGÃO.',
    tipoDeDecisao: 'ACÓRDÃO',
    referenciasLegislativas: [],
    ...over,
  };
}

describe('normalizarEspelho — datas', () => {
  it('converte dataDecisao AAAAMMDD em Date correta', () => {
    const d = normalizarEspelho(espelho(), 'Primeira Seção')!;
    expect(d.dataJulgamento?.toISOString().slice(0, 10)).toBe('2026-05-19');
  });

  it('extrai a data de publicação de dentro do rótulo do diário', () => {
    const d = normalizarEspelho(espelho(), 'Primeira Seção')!;
    expect(d.dataPublicacao?.toISOString().slice(0, 10)).toBe('2026-05-22');
  });

  it('devolve null em vez de Invalid Date quando a data é lixo', () => {
    const d = normalizarEspelho(espelho({ dataDecisao: 'xx', dataPublicacao: null }), 'Primeira Seção')!;
    expect(d.dataJulgamento).toBeNull();
    expect(d.dataPublicacao).toBeNull();
  });

  it('deriva o ano da data de decisão', () => {
    const d = normalizarEspelho(espelho(), 'Primeira Seção')!;
    expect(d.year).toBe(2026);
  });
});

describe('normalizarEspelho — identidade', () => {
  it('usa numeroRegistro como sourceId e monta fullIdentifier estável', () => {
    const d = normalizarEspelho(espelho(), 'Primeira Seção')!;
    expect(d.sourceId).toBe('202402187409');
    expect(d.fullIdentifier).toBe('stj-acordao-202402187409');
  });

  it('descarta espelho sem numeroRegistro', () => {
    expect(normalizarEspelho(espelho({ numeroRegistro: null }), 'Primeira Seção')).toBeNull();
  });

  it('descarta espelho sem ementa', () => {
    expect(normalizarEspelho(espelho({ ementa: '   ' }), 'Primeira Seção')).toBeNull();
  });
});

describe('normalizarEspelho — amarração à norma', () => {
  it('extrai artigos da 14.133 do campo estruturado', () => {
    const d = normalizarEspelho(
      espelho({ referenciasLegislativas: ['LEG:FED LEI:014133 ANO:2021\n        ART:00075'] }),
      'Primeira Seção'
    )!;
    expect(d.artigos14133).toEqual(['75']);
    expect(d.citaLei14133).toBe(true);
  });

  it('não inventa artigo a partir de menção solta na ementa', () => {
    const d = normalizarEspelho(
      espelho({ ementa: 'Ofensa ao art. 37 da Constituição Federal.' }),
      'Primeira Seção'
    )!;
    expect(d.artigos14133).toEqual([]);
  });
});

describe('normalizarEspelho — mojibake', () => {
  it('nenhum campo textual sai com mojibake', () => {
    const d = normalizarEspelho(espelho(), 'Primeira Seção')!;
    const textos = [d.title, d.ementa, d.relator ?? '', d.orgaoJulgador ?? ''].join(' ');
    // "Ã" seguido de maiúscula é a assinatura de UTF-8 lido como Latin-1
    // (foi assim que o conector do DataJud gravou "VILLAS BÃAS" e "PRESIDÃNCIA")
    expect(textos).not.toMatch(/Ã[A-Z]/);
  });

  it('preserva acentuação legítima', () => {
    const d = normalizarEspelho(espelho(), 'Primeira Seção')!;
    expect(d.relator).toBe('FRANCISCO FALCÃO');
  });
});
```

- [ ] **Step 2: Rodar o teste e verificar que falha**

Run: `npx vitest run lib/stj/__tests__/normalizar.test.ts`
Expected: FAIL — `lib/stj/normalizar.ts` não existe.

- [ ] **Step 3: Implementar a normalização**

Criar `lib/stj/normalizar.ts`:

```ts
/**
 * Espelho publicado pelo STJ → forma interna.
 *
 * Dois cuidados vêm de defeitos reais do conector DataJud que este substitui:
 * data que virava `Invalid Date` e mojibake nos nomes dos ministros.
 */

import { citaLei14133, extrairArtigos14133 } from '@/lib/jurisprudencia/legislacao-citada';
import type { EspelhoBruto, StjDecisaoNormalizada } from './types';

/** "20260519" → Date. Qualquer outra coisa vira null, nunca Invalid Date. */
function dataDeAaaammdd(valor: string | null | undefined): Date | null {
  if (!valor || !/^\d{8}$/.test(valor)) return null;
  const ano = Number(valor.slice(0, 4));
  const mes = Number(valor.slice(4, 6));
  const dia = Number(valor.slice(6, 8));
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return isNaN(d.getTime()) ? null : d;
}

/** "DJEN       DATA:22/05/2026" → Date. */
function dataDeRotuloDiario(valor: string | null | undefined): Date | null {
  if (!valor) return null;
  const m = valor.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
  return isNaN(d.getTime()) ? null : d;
}

function limpar(valor: string | null | undefined): string {
  return (valor ?? '').replace(/\s+/g, ' ').trim();
}

export function normalizarEspelho(
  e: EspelhoBruto,
  orgaoPadrao: string
): StjDecisaoNormalizada | null {
  const registro = limpar(e.numeroRegistro);
  const ementa = limpar(e.ementa);
  if (!registro || !ementa) return null;

  const dataJulgamento = dataDeAaaammdd(e.dataDecisao);
  const dataPublicacao = dataDeRotuloDiario(e.dataPublicacao);
  const classe = limpar(e.siglaClasse) || 'Acórdão';
  const artigos14133 = extrairArtigos14133(e.referenciasLegislativas);

  return {
    sourceId: registro,
    fullIdentifier: `stj-acordao-${registro}`,
    decisionType: 'acordao',
    classe,
    decisionNumber: registro,
    processNumber: limpar(e.numeroProcesso) || null,
    year:
      dataJulgamento?.getUTCFullYear() ??
      dataPublicacao?.getUTCFullYear() ??
      Number(registro.slice(0, 4)),
    title: `${classe} ${registro} - STJ`,
    ementa,
    relator: limpar(e.ministroRelator) || null,
    orgaoJulgador: limpar(e.nomeOrgaoJulgador) || orgaoPadrao,
    dataJulgamento,
    dataPublicacao,
    url: `https://processo.stj.jus.br/processo/pesquisa/?num_registro=${encodeURIComponent(registro)}`,
    tema: limpar(e.tema) || null,
    tese: limpar(e.teseJuridica) || null,
    artigos14133,
    citaLei14133: citaLei14133(e.referenciasLegislativas),
  };
}
```

- [ ] **Step 4: Rodar o teste e verificar que passa**

Run: `npx vitest run lib/stj/__tests__/normalizar.test.ts`
Expected: PASS (11 testes)

- [ ] **Step 5: Commit**

```bash
git add lib/stj/normalizar.ts lib/stj/__tests__/normalizar.test.ts
git commit -m "feat(stj): normalizacao do espelho com guarda de data invalida e mojibake"
```

---

### Task 5: Persistência

Espelha `lib/stf/persistir.ts`, incluindo a preservação do veredito humano e a amarração autoritativa.

**Files:**
- Create: `lib/stj/persistir.ts`
- Test: `lib/stj/__tests__/persistir.test.ts`

**Interfaces:**
- Consumes: `StjDecisaoNormalizada` (Task 2)
- Produces: `persistirDecisoesStj(decisoes: StjDecisaoNormalizada[], opcoes: { dryRun?: boolean; forcar?: boolean; gerarResumo?: boolean }): Promise<ResultadoPersistenciaStj>` com `{ criados, atualizados, ignorados, erros, mensagensErro }`; e `aplicarAmarracaoAutoritativa(d, classification)`

- [ ] **Step 1: Escrever o teste da persistência**

Criar `lib/stj/__tests__/persistir.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StjDecisaoNormalizada } from '../types';

const { mockFindUnique, mockCreate, mockUpdate, mockClassify, mockSummary } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockClassify: vi.fn(),
  mockSummary: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    tribunalDecision: {
      findUnique: (...a: unknown[]) => mockFindUnique(...a),
      create: (...a: unknown[]) => mockCreate(...a),
      update: (...a: unknown[]) => mockUpdate(...a),
    },
  },
}));

vi.mock('@/lib/tribunal-scrapers/classifier', () => ({
  classifyDecision: (...a: unknown[]) => mockClassify(...a),
  generateDecisionSummary: (...a: unknown[]) => mockSummary(...a),
}));

import { persistirDecisoesStj, aplicarAmarracaoAutoritativa } from '../persistir';

function decisao(over: Partial<StjDecisaoNormalizada> = {}): StjDecisaoNormalizada {
  return {
    sourceId: '202402187409',
    fullIdentifier: 'stj-acordao-202402187409',
    decisionType: 'acordao',
    classe: 'REsp',
    decisionNumber: '202402187409',
    processNumber: '2669939',
    year: 2026,
    title: 'REsp 202402187409 - STJ',
    ementa: 'ADMINISTRATIVO. LICITAÇÃO.',
    relator: 'FRANCISCO FALCÃO',
    orgaoJulgador: 'PRIMEIRA SEÇÃO',
    dataJulgamento: new Date('2026-05-19T00:00:00Z'),
    dataPublicacao: new Date('2026-05-22T00:00:00Z'),
    url: 'https://processo.stj.jus.br/processo/pesquisa/?num_registro=202402187409',
    tema: null,
    tese: null,
    artigos14133: [],
    citaLei14133: false,
    ...over,
  };
}

const CLASSIFICACAO_FRACA = {
  relevanceScore: 20,
  approvalStatus: 'pending' as const,
  themes: [],
  leiArticles: [],
  reasoning: 'escore baixo',
  suggestedCourses: '',
  confidence: 0.4,
};

beforeEach(() => {
  mockFindUnique.mockReset();
  mockCreate.mockReset();
  mockUpdate.mockReset();
  mockClassify.mockReset().mockResolvedValue(CLASSIFICACAO_FRACA);
  mockSummary.mockReset().mockResolvedValue(null);
});

describe('aplicarAmarracaoAutoritativa', () => {
  it('aprova quando há artigo da 14.133, mesmo com escore baixo', () => {
    const r = aplicarAmarracaoAutoritativa(decisao({ artigos14133: ['75'] }), CLASSIFICACAO_FRACA);
    expect(r.approvalStatus).toBe('auto_approved');
  });

  it('não mexe no veredito quando não há amarração', () => {
    const r = aplicarAmarracaoAutoritativa(decisao(), CLASSIFICACAO_FRACA);
    expect(r.approvalStatus).toBe('pending');
  });

  it('preserva o escore medido pelo classificador', () => {
    const r = aplicarAmarracaoAutoritativa(decisao({ artigos14133: ['75'] }), CLASSIFICACAO_FRACA);
    expect(r.relevanceScore).toBe(20);
  });
});

describe('persistirDecisoesStj', () => {
  it('cria quando o julgado ainda não existe', async () => {
    mockFindUnique.mockResolvedValue(null);
    const r = await persistirDecisoesStj([decisao()], {});
    expect(r.criados).toBe(1);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('é idempotente: rodar de novo não cria segundo registro', async () => {
    mockFindUnique.mockResolvedValue({ id: 'x', reviewedBy: null, summary: null });
    const r = await persistirDecisoesStj([decisao()], {});
    expect(r.criados).toBe(0);
    expect(r.ignorados).toBe(1);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('atualiza quando forcar está ligado', async () => {
    mockFindUnique.mockResolvedValue({ id: 'x', reviewedBy: null, summary: null });
    const r = await persistirDecisoesStj([decisao()], { forcar: true });
    expect(r.atualizados).toBe(1);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it('não recalcula o veredito de quem um humano já revisou', async () => {
    mockFindUnique.mockResolvedValue({ id: 'x', reviewedBy: 'daniel', summary: null });
    await persistirDecisoesStj([decisao()], { forcar: true });
    const dados = mockUpdate.mock.calls[0][0].data;
    expect(dados).not.toHaveProperty('approvalStatus');
    expect(dados).not.toHaveProperty('isRelevant');
  });

  it('grava leiArticlesArr a partir do campo estruturado, não do classificador', async () => {
    mockFindUnique.mockResolvedValue(null);
    mockClassify.mockResolvedValue({ ...CLASSIFICACAO_FRACA, leiArticles: ['37'] });
    await persistirDecisoesStj([decisao({ artigos14133: ['75'] })], {});
    const dados = mockCreate.mock.calls[0][0].data;
    expect(dados.leiArticlesArr).toEqual(['75']);
  });

  it('não chama o Gemini quando gerarResumo está desligado', async () => {
    mockFindUnique.mockResolvedValue(null);
    await persistirDecisoesStj([decisao({ artigos14133: ['75'] })], { gerarResumo: false });
    expect(mockSummary).not.toHaveBeenCalled();
  });

  it('em dry-run não escreve nem classifica', async () => {
    mockFindUnique.mockResolvedValue(null);
    const r = await persistirDecisoesStj([decisao()], { dryRun: true });
    expect(r.criados).toBe(1);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockClassify).not.toHaveBeenCalled();
  });

  it('um erro em uma decisão não aborta as demais', async () => {
    mockFindUnique.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('rede caiu')).mockResolvedValueOnce(null);
    const r = await persistirDecisoesStj(
      [decisao({ fullIdentifier: 'a' }), decisao({ fullIdentifier: 'b' }), decisao({ fullIdentifier: 'c' })],
      {}
    );
    expect(r.erros).toBe(1);
    expect(r.criados).toBe(2);
  });
});
```

- [ ] **Step 2: Rodar o teste e verificar que falha**

Run: `npx vitest run lib/stj/__tests__/persistir.test.ts`
Expected: FAIL — `lib/stj/persistir.ts` não existe.

- [ ] **Step 3: Implementar a persistência**

Criar `lib/stj/persistir.ts`:

```ts
/**
 * Persistência dos espelhos do STJ em `TribunalDecision`.
 *
 * Mesmo núcleo para o backfill do acervo e para o cron mensal, de modo que a
 * base não cresça descatalogada.
 */

import { prisma } from '@/lib/prisma';
import {
  classifyDecision,
  generateDecisionSummary,
  type ClassificationResult,
} from '@/lib/tribunal-scrapers/classifier';
import { setLeiArticles } from '@/lib/lei-articles';
import { normalizeTribunalCode } from '@/lib/tribunal-scrapers/utils';
import { SOURCE_API_STJ, TRIBUNAL_NAME_STJ } from './constantes';
import type { StjDecisaoNormalizada } from './types';

export interface OpcoesPersistenciaStj {
  dryRun?: boolean;
  forcar?: boolean;
  /** Resumo IA custa Gemini por julgado. Default true; o backfill desliga. */
  gerarResumo?: boolean;
}

export interface ResultadoPersistenciaStj {
  criados: number;
  atualizados: number;
  ignorados: number;
  erros: number;
  mensagensErro: string[];
}

/**
 * Se o STJ diz, no campo estruturado de referências legislativas, que o
 * acórdão cita artigo da Lei 14.133, ele é relevante para um site sobre a Lei
 * 14.133 — independentemente do escore de palavra-chave. A referência é fato;
 * o escore é aproximação. Mesma regra já adotada no conector do STF.
 *
 * `relevanceScore`, `themes`, `confidence` e `suggestedCourses` continuam
 * sendo medidas do classificador e não são alteradas.
 */
export function aplicarAmarracaoAutoritativa(
  d: StjDecisaoNormalizada,
  classification: ClassificationResult
): ClassificationResult {
  if (d.artigos14133.length === 0) return classification;

  return {
    ...classification,
    approvalStatus: 'auto_approved',
    reasoning: `${classification.reasoning}; auto-aprovado: amarração autoritativa à Lei 14.133 (art. ${d.artigos14133.join(', ')}) via referências legislativas do STJ`,
  };
}

export function montarDadosStj(
  d: StjDecisaoNormalizada,
  classification: ClassificationResult,
  summary: string | null
) {
  return {
    tribunalCode: normalizeTribunalCode('stj'),
    tribunalName: TRIBUNAL_NAME_STJ,
    decisionType: d.decisionType,
    decisionNumber: d.decisionNumber,
    processNumber: d.processNumber,
    year: d.year,
    fullIdentifier: d.fullIdentifier,
    title: d.title,
    ementa: d.ementa,
    summary,
    relator: d.relator,
    orgaoJulgador: d.orgaoJulgador,
    dataJulgamento: d.dataJulgamento,
    dataPublicacao: d.dataPublicacao,
    url: d.url,
    isRelevant: classification.approvalStatus !== 'auto_rejected',
    relevanceScore: classification.relevanceScore,
    themes: JSON.stringify(classification.themes),

    // Amarração vem SÓ do campo estruturado do STJ. A heurística de texto do
    // classificador captaria "art. 37 da Constituição" como artigo da 14.133.
    ...setLeiArticles(d.artigos14133),

    suggestedCourses: classification.suggestedCourses,
    sourceApi: SOURCE_API_STJ,
    sourceId: d.sourceId,
    sourceRawData: JSON.stringify({ classe: d.classe, tema: d.tema, tese: d.tese }),
    approvalStatus: classification.approvalStatus,
    confidence: classification.confidence,
    classificationReasoning: classification.reasoning,
  };
}

/**
 * Preserva o que é editorial: veredito de humano (`reviewedBy` não nulo) não é
 * recalculado, e resumo IA existente não é apagado por rodada que não gerou um.
 */
function montarDadosUpdateStj(
  data: ReturnType<typeof montarDadosStj>,
  existente: { reviewedBy: string | null }
): Partial<ReturnType<typeof montarDadosStj>> {
  const { approvalStatus, isRelevant, summary, ...resto } = data;
  const dadosUpdate: Partial<ReturnType<typeof montarDadosStj>> = { ...resto };

  if (!existente.reviewedBy) {
    dadosUpdate.approvalStatus = approvalStatus;
    dadosUpdate.isRelevant = isRelevant;
  }
  if (summary !== null) {
    dadosUpdate.summary = summary;
  }

  return dadosUpdate;
}

export async function persistirDecisoesStj(
  decisoes: StjDecisaoNormalizada[],
  opcoes: OpcoesPersistenciaStj
): Promise<ResultadoPersistenciaStj> {
  const gerarResumo = opcoes.gerarResumo !== false;
  const r: ResultadoPersistenciaStj = {
    criados: 0,
    atualizados: 0,
    ignorados: 0,
    erros: 0,
    mensagensErro: [],
  };

  for (const d of decisoes) {
    try {
      const existente = await prisma.tribunalDecision.findUnique({
        where: { fullIdentifier: d.fullIdentifier },
        select: { id: true, reviewedBy: true, summary: true },
      });

      if (existente && !opcoes.forcar) {
        r.ignorados++;
        continue;
      }

      if (opcoes.dryRun) {
        if (existente) r.atualizados++;
        else r.criados++;
        continue;
      }

      const classification = aplicarAmarracaoAutoritativa(
        d,
        await classifyDecision({
          title: d.title,
          ementa: d.ementa,
          decisionType: d.decisionType,
          tribunalCode: 'STJ',
        })
      );

      const summary =
        gerarResumo && classification.approvalStatus === 'auto_approved'
          ? await generateDecisionSummary({
              title: d.title,
              ementa: d.ementa,
              decisionType: d.decisionType,
              tribunalCode: 'STJ',
            })
          : null;

      const data = montarDadosStj(d, classification, summary);

      if (existente) {
        await prisma.tribunalDecision.update({
          where: { fullIdentifier: d.fullIdentifier },
          data: montarDadosUpdateStj(data, existente),
        });
        r.atualizados++;
      } else {
        await prisma.tribunalDecision.create({ data });
        r.criados++;
      }
    } catch (error) {
      r.erros++;
      r.mensagensErro.push(
        `${d.fullIdentifier}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return r;
}
```

- [ ] **Step 4: Rodar o teste e verificar que passa**

Run: `npx vitest run lib/stj/__tests__/persistir.test.ts`
Expected: PASS (11 testes)

- [ ] **Step 5: Commit**

```bash
git add lib/stj/persistir.ts lib/stj/__tests__/persistir.test.ts
git commit -m "feat(stj): persistencia idempotente com amarracao autoritativa a Lei 14.133"
```

---

### Task 6: Runner e backfill do acervo

Junta as peças e executa a carga histórica. Aqui é onde o plano encontra o dado real — e onde defeitos que os testes unitários não pegam costumam aparecer.

**Files:**
- Create: `lib/stj/coletar.ts`, `scripts/stj-runner.ts`
- Modify: `package.json` (script `stj:coletar`)

**Interfaces:**
- Consumes: `listarDumps` (Task 3), `baixar` (Task 3), `normalizarEspelho` (Task 4), `ehRelevanteParaBase` (Task 2), `persistirDecisoesStj` (Task 5)
- Produces: `coletarStj(opcoes: { meses?: number; dryRun?: boolean; gerarResumo?: boolean; forcar?: boolean }): Promise<ResultadoColeta>` com `{ dumpsLidos, espelhosVistos, relevantes, criados, atualizados, ignorados, erros, mensagensErro }`

- [ ] **Step 1: Escrever o orquestrador em `lib/`**

Criar `lib/stj/coletar.ts`:

```ts
/**
 * Orquestração da coleta dos Espelhos de Acórdãos do STJ.
 *
 * Vive em `lib/` e não em `scripts/` porque o `tsconfig.json` exclui
 * `scripts/` do build — a rota de cron precisa importar daqui.
 */
import { DATASETS_STJ } from './constantes';
import { listarDumps } from './catalogo';
import { baixar } from './consulta';
import { normalizarEspelho } from './normalizar';
import { ehRelevanteParaBase } from './recorte';
import { persistirDecisoesStj } from './persistir';
import type { EspelhoBruto } from './types';

export interface ResultadoColeta {
  dumpsLidos: number;
  espelhosVistos: number;
  relevantes: number;
  criados: number;
  atualizados: number;
  ignorados: number;
  erros: number;
  mensagensErro: string[];
}

export async function coletarStj(opcoes: {
  meses?: number;
  dryRun?: boolean;
  gerarResumo?: boolean;
  forcar?: boolean;
}): Promise<ResultadoColeta> {
  const meses = opcoes.meses ?? 2;
  const r: ResultadoColeta = {
    dumpsLidos: 0,
    espelhosVistos: 0,
    relevantes: 0,
    criados: 0,
    atualizados: 0,
    ignorados: 0,
    erros: 0,
    mensagensErro: [],
  };

  for (const { slug, orgao } of DATASETS_STJ) {
    let dumps;
    try {
      dumps = await listarDumps(slug);
    } catch (error) {
      r.erros++;
      r.mensagensErro.push(`catalogo ${slug}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }

    for (const dump of dumps.slice(0, meses)) {
      try {
        const corpo = await baixar(dump.url, `https://dadosabertos.web.stj.jus.br/dataset/${slug}`);
        const espelhos = JSON.parse(corpo.replace(/^﻿/, '')) as EspelhoBruto[];
        r.dumpsLidos++;
        r.espelhosVistos += espelhos.length;

        const normalizadas = espelhos
          .filter(ehRelevanteParaBase)
          .map((e) => normalizarEspelho(e, orgao))
          .filter((d): d is NonNullable<typeof d> => d !== null);

        r.relevantes += normalizadas.length;

        const p = await persistirDecisoesStj(normalizadas, {
          dryRun: opcoes.dryRun,
          forcar: opcoes.forcar,
          gerarResumo: opcoes.gerarResumo,
        });
        r.criados += p.criados;
        r.atualizados += p.atualizados;
        r.ignorados += p.ignorados;
        r.erros += p.erros;
        r.mensagensErro.push(...p.mensagensErro);

        console.log(
          `[stj] ${slug} ${dump.nome}: ${espelhos.length} espelhos → ${normalizadas.length} relevantes → +${p.criados} novos`
        );
      } catch (error) {
        r.erros++;
        r.mensagensErro.push(`${slug}/${dump.nome}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  return r;
}
```

- [ ] **Step 2: Escrever o wrapper de linha de comando**

Criar `scripts/stj-runner.ts`:

```ts
/**
 * Coleta dos Espelhos de Acórdãos do STJ — casca de CLI.
 *
 *   npm run stj:coletar                          # 2 meses, como o cron
 *   npm run stj:coletar -- --tudo                # acervo inteiro
 *   npm run stj:coletar -- --dry-run
 *   npm run stj:coletar -- --tudo --sem-resumo
 *
 * `--sem-resumo` desliga a geração de resumo IA, que chama Gemini por julgado
 * aprovado. No backfill do acervo isso seriam milhares de chamadas.
 */
import { coletarStj } from '../lib/stj/coletar';
import { SCRAPER_CODE_STJ } from '../lib/stj/constantes';
import { logScraperHealth } from '../lib/tribunal-scrapers/utils';

async function main() {
  const args = process.argv.slice(2);
  const inicio = Date.now();

  const r = await coletarStj({
    meses: args.includes('--tudo') ? Number.MAX_SAFE_INTEGER : 2,
    dryRun: args.includes('--dry-run'),
    gerarResumo: !args.includes('--sem-resumo'),
    forcar: args.includes('--forcar'),
  });

  console.log('\n=== resultado ===');
  console.log(r);

  if (!args.includes('--dry-run')) {
    await logScraperHealth(SCRAPER_CODE_STJ, r.erros > 0 ? 'partial_failure' : 'success', {
      itemsFound: r.relevantes,
      itemsNew: r.criados,
      itemsError: r.erros,
      duration: Date.now() - inicio,
      errorMessage: r.mensagensErro.length > 0 ? r.mensagensErro.slice(0, 5).join('; ') : undefined,
    });
  }

  if (r.dumpsLidos === 0) {
    console.error('Nenhum dump lido — verifique os cabeçalhos em lib/stj/consulta.ts');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 3: Registrar o comando no package.json**

Em `package.json`, na seção `scripts`, logo após a linha de `stf:coletar`, acrescentar:

```json
"stj:coletar": "tsx --env-file=.env.local scripts/stj-runner.ts",
```

- [ ] **Step 4: Rodar um dry-run curto e conferir o rendimento contra o medido**

Run: `npm run stj:coletar -- --dry-run`
Expected: 8 dumps lidos (2 por órgão), e a razão `relevantes / espelhosVistos` em torno de **4,7%**. Um número muito acima disso indica regex do recorte frouxa; muito abaixo, restritiva demais. **Não prossiga sem conferir.**

- [ ] **Step 5: Rodar o backfill do acervo, sem resumo IA**

Run: `npm run stj:coletar -- --tudo --sem-resumo`
Expected: ~208 dumps, ~43 mil espelhos vistos, ~2.000 relevantes persistidos. Leva dezenas de minutos. `--sem-resumo` evita milhares de chamadas ao Gemini nesta etapa.

- [ ] **Step 6: Conferir o resultado no banco**

Run:
```bash
npx tsx --env-file=.env.local -e "import {prisma} from '@/lib/prisma'; \
  const t = await prisma.tribunalDecision.count({where:{tribunalCode:'STJ', sourceApi:'stj-espelhos-dados-abertos'}}); \
  const a = await prisma.tribunalDecision.count({where:{tribunalCode:'STJ', sourceApi:'stj-espelhos-dados-abertos', approvalStatus:'auto_approved'}}); \
  const sd = await prisma.tribunalDecision.count({where:{tribunalCode:'STJ', sourceApi:'stj-espelhos-dados-abertos', dataJulgamento:null}}); \
  console.log({total:t, aprovados:a, semDataJulgamento:sd}); await prisma.\$disconnect();"
```
Expected: `total` na casa dos milhares, `aprovados` bem acima de zero (contraste com os 0 de 254 do DataJud) e `semDataJulgamento` igual a **0**.

- [ ] **Step 7: Conferir ausência de mojibake no dado real gravado**

Run:
```bash
npx tsx --env-file=.env.local -e "import {prisma} from '@/lib/prisma'; \
  const r = await prisma.\$queryRaw\`SELECT COUNT(*)::int AS n FROM \"TribunalDecision\" \
    WHERE \"sourceApi\" = 'stj-espelhos-dados-abertos' AND (relator ~ 'Ã[A-Z]' OR ementa ~ 'Ã[A-Z]')\`; \
  console.log('registros com mojibake:', r); await prisma.\$disconnect();"
```
Expected: `0`. Este é o defeito exato que corrompeu os nomes dos ministros no conector antigo, e o teste unitário sozinho não o pega — só a medição contra o dado real.

- [ ] **Step 8: Rodar a suíte inteira**

Run: `npx vitest run`
Expected: PASS, com os ~33 testes novos somados ao total anterior.

- [ ] **Step 9: Commit**

```bash
git add lib/stj/coletar.ts scripts/stj-runner.ts package.json
git commit -m "feat(stj): orquestrador de coleta, runner de CLI e backfill do acervo"
```

---

### Task 7: Cron mensal e aposentadoria do DataJud

**Files:**
- Create: `app/api/cron/sync-stj/route.ts`
- Modify: `vercel.json` (adiciona `sync-stj`, remove `sync-datajud`)
- Modify: `lib/tribunal-scrapers/index.ts` (remove o registro do scraper DataJud)
- Modify: `lib/tribunal-scrapers/datajud.ts` (cabeçalho de aposentadoria)

**Interfaces:**
- Consumes: `coletarStj` (Task 6)
- Produces: rota `GET /api/cron/sync-stj`

- [ ] **Step 1: Criar a rota do cron**

Criar `app/api/cron/sync-stj/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';
import { withCronTelemetry } from '@/lib/cron-telemetry';
import { coletarStj } from '@/lib/stj/coletar';

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  let responseBody: Record<string, unknown> = {};

  await withCronTelemetry('sync-stj', async () => {
    // Dois meses por rodada: os dumps são mensais e podem ser republicados
    // depois da primeira publicação. O upsert é idempotente, então reprocessar
    // dispensa cursor de estado.
    const r = await coletarStj({ meses: 2 });
    responseBody = { ok: true, ...r };

    return {
      itemsFound: r.relevantes,
      itemsNew: r.criados,
      itemsError: r.erros,
      metadata: { dumpsLidos: r.dumpsLidos, espelhosVistos: r.espelhosVistos },
    };
  });

  return NextResponse.json(responseBody);
}
```

`withCronTelemetry<T extends CronStats | void>(scraperCode, handler)` devolve o
que o handler devolver, **não** uma `NextResponse` — o padrão de escrever o
corpo numa variável e só então retornar é o mesmo de
`app/api/cron/daily-clipping/route.ts:177-183`. `verifyCronAuth(request)`
devolve `NextResponse | null`: nulo significa autorizado.

- [ ] **Step 2: Registrar o cron no vercel.json e remover o do DataJud**

Em `vercel.json`, remover o bloco de `/api/cron/sync-datajud` (linha ~69) e acrescentar:

```json
{
  "path": "/api/cron/sync-stj",
  "schedule": "0 8 5 * *"
}
```

Dia 5 de cada mês, às 8h UTC — os dumps do mês anterior já estão publicados.

- [ ] **Step 3: Aposentar o scraper do DataJud**

Em `lib/tribunal-scrapers/index.ts`, remover a linha `registerScraper(dataJudSTJScraper);` e o import correspondente.

No topo de `lib/tribunal-scrapers/datajud.ts`, acrescentar antes do bloco de comentário existente:

```ts
/**
 * APOSENTADO em 18/08/2026 — substituído por `lib/stj/`.
 *
 * A API pública do DataJud entrega capa processual, não jurisprudência: o
 * campo `ementa` deste conector é concatenação de classe + assuntos + órgão
 * julgador + movimentos. Resultado medido em produção: 0 de 254 decisões
 * aprovadas, 254 sem dataJulgamento, ementa mediana de 214 caracteres.
 *
 * Mantido no repositório como registro. Fora do registry e sem cron.
 * A env DATAJUD_API_KEY segue válida — a API cobre outros tribunais.
 */
```

- [ ] **Step 4: Rodar o build — obrigatório, a task toca app/api/**

Run: `npm run build`
Expected: build limpo. `tsc --noEmit` e a suíte não pegam `export const` inválido em `route.ts`; só o `next build` pega.

- [ ] **Step 5: Rodar a suíte inteira**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/api/cron/sync-stj vercel.json lib/tribunal-scrapers/index.ts lib/tribunal-scrapers/datajud.ts
git commit -m "feat(stj): cron mensal de coleta e aposentadoria do conector DataJud"
```

---

### Task 8: Marcar o legado do DataJud

Os 254 registros antigos saem de circulação **sem serem apagados** — regra permanente do projeto.

**Files:**
- Create: `scripts/aposentar-datajud-stj.ts`

**Interfaces:**
- Consumes: nada
- Produces: script executável de uso único

- [ ] **Step 1: Escrever o script**

Criar `scripts/aposentar-datajud-stj.ts`:

```ts
/**
 * Retira de circulação os registros do STJ vindos do DataJud.
 *
 * NÃO apaga nada — regra permanente do projeto. Marca como auto_rejected,
 * o que os remove da listagem pública e da busca, preservando o histórico.
 *
 *   npx tsx --env-file=.env.local scripts/aposentar-datajud-stj.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/aposentar-datajud-stj.ts
 */
import { prisma } from '@/lib/prisma';

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const alvo = {
    tribunalCode: 'STJ',
    sourceApi: { startsWith: 'datajud-' },
    approvalStatus: { not: 'auto_rejected' },
  } as const;

  const total = await prisma.tribunalDecision.count({ where: alvo });
  console.log(`registros do DataJud a marcar: ${total}`);

  if (dryRun) {
    console.log('(dry-run — nada foi escrito)');
    await prisma.$disconnect();
    return;
  }

  const r = await prisma.tribunalDecision.updateMany({
    where: alvo,
    data: {
      approvalStatus: 'auto_rejected',
      isRelevant: false,
      classificationReasoning:
        'Aposentado em 18/08/2026: fonte DataJud entrega capa processual, sem ementa. Substituído pelos Espelhos de Acórdãos do STJ.',
    },
  });

  console.log(`marcados: ${r.count}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
```

- [ ] **Step 2: Rodar em dry-run**

Run: `npx tsx --env-file=.env.local scripts/aposentar-datajud-stj.ts --dry-run`
Expected: `registros do DataJud a marcar: 15` — os `pending`; os 239 já são `auto_rejected`.

- [ ] **Step 3: Executar**

Run: `npx tsx --env-file=.env.local scripts/aposentar-datajud-stj.ts`
Expected: `marcados: 15`

- [ ] **Step 4: Conferir que nada foi apagado**

Run:
```bash
npx tsx --env-file=.env.local -e "import {prisma} from '@/lib/prisma'; \
  const t = await prisma.tribunalDecision.count({where:{tribunalCode:'STJ', sourceApi:{startsWith:'datajud-'}}}); \
  console.log('registros do DataJud ainda no banco:', t); await prisma.\$disconnect();"
```
Expected: `254` — todos preservados, apenas invisíveis.

- [ ] **Step 5: Commit**

```bash
git add scripts/aposentar-datajud-stj.ts
git commit -m "chore(stj): retira de circulacao os registros legados do DataJud sem apagar"
```

---

## Ao terminar

Antes de abrir a PR:

- [ ] `npx vitest run` — suíte inteira verde
- [ ] `npm run build` — limpo (obrigatório: a Task 7 toca `app/api/`)
- [ ] Conferir no admin que os julgados novos do STJ aparecem na fila de revisão
- [ ] Registrar no handoff: o STJ **não** entra em `CLIPPING_TRIBUNAIS_ENABLED` nesta leva — o backfill deixa `createdAt` recente em ~2.000 registros antigos, que inundariam o clipping diário como se fossem novidade. Mesma armadilha já vista no STF.
