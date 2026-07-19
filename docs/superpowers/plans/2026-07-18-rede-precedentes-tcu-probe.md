# Rede de Precedentes do TCU — Fase 0 (Probe) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Medir, sem gravar nada, se há sinal aproveitável na rede de citações "Acórdão N/AAAA" entre os acórdãos do TCU já armazenados, produzindo um relatório de calibração que decide GO/NO-GO para persistir o grafo (Fase 1).

**Architecture:** Um extrator puro (texto → citações de acórdão), no molde de `lib/lei-14133/citation-extractor.ts`, mais um módulo de estatísticas puro, mais um script operacional que lê os `Document` (`category='acordao'`) já com `tcuTextoCompleto`, roda o extrator, atribui cada citação a uma seção (via `seccionar-acordao.ts`), tenta casar com um acórdão do acervo e agrega tudo num JSON. Nada é persistido no banco. O extrator nasce puro de propósito: será reaproveitado sem alteração no núcleo de catalogação na Fase 1.

**Tech Stack:** TypeScript, Node via `tsx`, Vitest 4, Prisma 7 (PrismaNeon), Postgres/Neon.

## Global Constraints

- **Fase 0 não grava no banco.** Só leitura + arquivo JSON em `docs/audits/`. Nenhuma migração, nenhum `prisma.*.update`.
- **Extrator é módulo puro:** `lib/tcu/acordao-citation-extractor.ts` recebe `string`, devolve `AcordaoCitation[]`, sem banco/rede — para servir probe (Fase 0) e núcleo (Fase 1) sem divergir.
- **Determinístico, custo zero:** regex, sem LLM.
- **Scripts rodam via `npx tsx <arquivo>`** — `lib/prisma.ts` auto-carrega `.env.local` fora do Next.
- **Testes:** Vitest, arquivo co-localizado `*.test.ts`. Rodar um arquivo: `npx vitest run <path>`.
- **Só "Acórdão N/AAAA" do próprio TCU** nesta fase — nada de normas, súmulas ou outros tribunais.
- Spec de referência: `docs/superpowers/specs/2026-07-18-rede-precedentes-tcu-probe-design.md`.

---

### Task 1: Extrator de citações de acórdão (módulo puro)

**Files:**
- Create: `lib/tcu/acordao-citation-extractor.ts`
- Test: `lib/tcu/acordao-citation-extractor.test.ts`

**Interfaces:**
- Consumes: nada (módulo folha).
- Produces:
  - `interface AcordaoCitation { numero: number; ano: number; colegiado: string | null; raw: string; index: number }`
  - `function extractAcordaoCitations(text: string): AcordaoCitation[]` — `index` é o offset do match no texto (para `secaoDe`). NÃO filtra auto-citação (o consumidor faz isso).

- [ ] **Step 1: Write the failing test**

Criar `lib/tcu/acordao-citation-extractor.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { extractAcordaoCitations } from './acordao-citation-extractor';

describe('extractAcordaoCitations', () => {
  it('reconhece "Acórdão 4851/2017"', () => {
    const [c] = extractAcordaoCitations('Conforme o Acórdão 4851/2017, decido.');
    expect(c).toMatchObject({ numero: 4851, ano: 2017, colegiado: null });
  });

  it('normaliza pontos de milhar e captura o Plenário', () => {
    const [c] = extractAcordaoCitations('Vide Acórdão nº 4.851/2017-Plenário.');
    expect(c).toMatchObject({ numero: 4851, ano: 2017, colegiado: 'Plenário' });
  });

  it('reconhece "AC 1234/2020-TCU-Plenário"', () => {
    const [c] = extractAcordaoCitations('AC 1234/2020-TCU-Plenário');
    expect(c).toMatchObject({ numero: 1234, ano: 2020, colegiado: 'Plenário' });
  });

  it('canoniza as câmaras', () => {
    const [a] = extractAcordaoCitations('Acórdão 10/2019-Primeira Câmara');
    expect(a.colegiado).toBe('Primeira Câmara');
    const [b] = extractAcordaoCitations('Acórdão 11/2019 - 2ª Câmara');
    expect(b.colegiado).toBe('Segunda Câmara');
  });

  it('reconhece a cauda de lista "Acórdãos 1/2020, 2/2021 e 3/2022"', () => {
    const cs = extractAcordaoCitations('Vide Acórdãos 1/2020, 2/2021 e 3/2022.');
    expect(cs.map((c) => `${c.numero}/${c.ano}`)).toEqual(['1/2020', '2/2021', '3/2022']);
  });

  it('NÃO casa "acórdão recorrido" (sem número)', () => {
    expect(extractAcordaoCitations('mantém o acórdão recorrido em seus termos')).toHaveLength(0);
  });

  it('NÃO casa "o presente acórdão"', () => {
    expect(extractAcordaoCitations('o presente acórdão não se aplica ao caso')).toHaveLength(0);
  });

  it('NÃO confunde "Lei 14.133/2021" mencionada depois de "acórdão"', () => {
    expect(extractAcordaoCitations('acórdão que trata da Lei 14.133/2021')).toHaveLength(0);
  });

  it('o index aponta para o começo da citação', () => {
    const t = 'texto texto Acórdão 500/2015 fim';
    const [c] = extractAcordaoCitations(t);
    expect(t.slice(c.index, c.index + 7)).toBe('Acórdão');
  });

  it('descarta ano implausível', () => {
    expect(extractAcordaoCitations('Acórdão 1/0007 sem sentido')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/tcu/acordao-citation-extractor.test.ts`
Expected: FAIL — "Failed to resolve import './acordao-citation-extractor'".

- [ ] **Step 3: Write minimal implementation**

Criar `lib/tcu/acordao-citation-extractor.ts`:

```ts
/**
 * Extrai citações a acórdãos do TCU ("Acórdão N/AAAA") de texto livre —
 * determinístico, sem LLM, custo zero. Módulo PURO (texto → citações), sem banco
 * nem rede: serve ao probe (Fase 0) e depois ao núcleo de catalogação (Fase 1)
 * sem divergir. Espelha o padrão de lib/lei-14133/citation-extractor.ts.
 *
 * NÃO filtra auto-citação — o extrator não sabe qual é o próprio acórdão. Isso é
 * responsabilidade do consumidor, que conhece o número do documento.
 */

export interface AcordaoCitation {
  /** Número do acórdão citado, sem pontos de milhar (4851). */
  numero: number;
  /** Ano com 4 dígitos (2017). */
  ano: number;
  /** Colegiado canônico, se explícito na citação; senão null. */
  colegiado: string | null;
  /** Trecho casado, para exibição/depuração. */
  raw: string;
  /** Offset da citação no texto — para atribuir a seção via secaoDe(). */
  index: number;
}

/** Sufixo opcional de colegiado: "-Plenário", "- 2ª Câmara", "-TCU-Plenário". */
const COLEG =
  '(?:\\s*[-–—]\\s*(?:tcu\\s*[-–—]\\s*)?(plen[áa]rio|primeira\\s+c[âa]mara|segunda\\s+c[âa]mara|1[ªa]\\.?\\s*c[âa]mara|2[ªa]\\.?\\s*c[âa]mara))?';

/**
 * "Acórdão 4851/2017", "Acórdão nº 4.851/2017-Plenário", "AC 1234/2020-TCU-Plenário".
 * Exige "/AAAA" logo após o número: "acórdão recorrido"/"o presente acórdão"
 * (sem número) não casam.
 */
const AC_RE = new RegExp(
  '\\b(?:ac[óo]rd[ãa]os?|ac\\.?)\\s+(?:n[.ºo°]*\\s*)?(\\d[\\d.]*)\\s*\\/\\s*(\\d{4})' + COLEG,
  'gi'
);

/** Cauda de lista: ", 2/2021", " e 3/2022" logo após "Acórdãos 1/2020...". */
const AC_LISTA_RE = new RegExp(
  '^(?:\\s*,|\\s*e\\b)\\s*(\\d[\\d.]*)\\s*\\/\\s*(\\d{4})' + COLEG,
  'i'
);

function canonColegiado(raw: string | undefined): string | null {
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (s.startsWith('plen')) return 'Plenário';
  if (s.startsWith('1') || s.startsWith('prim')) return 'Primeira Câmara';
  if (s.startsWith('2') || s.startsWith('seg')) return 'Segunda Câmara';
  return null;
}

function toNumero(raw: string): number {
  return parseInt(raw.replace(/\./g, ''), 10);
}

export function extractAcordaoCitations(text: string): AcordaoCitation[] {
  const out: AcordaoCitation[] = [];
  if (!text) return out;

  const re = new RegExp(AC_RE.source, AC_RE.flags);
  let m: RegExpExecArray | null;

  const push = (
    numRaw: string,
    anoRaw: string,
    coleg: string | undefined,
    index: number,
    raw: string
  ) => {
    const numero = toNumero(numRaw);
    const ano = parseInt(anoRaw, 10);
    if (!Number.isFinite(numero) || numero <= 0) return;
    if (ano < 1990 || ano > 2100) return;
    out.push({ numero, ano, colegiado: canonColegiado(coleg), raw: raw.trim(), index });
  };

  while ((m = re.exec(text)) !== null) {
    push(m[1], m[2], m[3], m.index, m[0]);

    // "Acórdãos 1/2020, 2/2021 e 3/2022": os subsequentes não têm "Acórdão"
    // antes; o regex principal não os alcança. Consome a cauda aqui.
    let pos = m.index + m[0].length;
    for (;;) {
      const lm = AC_LISTA_RE.exec(text.slice(pos));
      if (!lm) break;
      push(lm[1], lm[2], lm[3], pos, lm[0]);
      pos += lm[0].length;
    }
    re.lastIndex = pos; // não reprocessa o que a lista já consumiu
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/tcu/acordao-citation-extractor.test.ts`
Expected: PASS (10 testes). Se algum caso falhar, ajustar a regex — não os testes.

- [ ] **Step 5: Commit**

```bash
git add lib/tcu/acordao-citation-extractor.ts lib/tcu/acordao-citation-extractor.test.ts
git commit -m "feat(tcu): extrator puro de citações Acórdão N/AAAA (probe fase 0)"
```

---

### Task 2: Estatísticas do probe (módulo puro)

**Files:**
- Create: `lib/tcu/precedentes-probe-stats.ts`
- Test: `lib/tcu/precedentes-probe-stats.test.ts`

**Interfaces:**
- Consumes: nada (recebe registros já processados).
- Produces:
  - `interface CitacaoProcessada { origemId: string; numero: number; ano: number; secao: 'relatorio' | 'voto' | 'acordao' | null; matched: boolean; alvoId: string | null }`
  - `function densidade(cits: CitacaoProcessada[], totalAcordaos: number): { acordaosComCitacao: number; totalCitacoes: number; media: number; mediana: number }`
  - `function porSecao(cits: CitacaoProcessada[]): { relatorio: number; voto: number; acordao: number; semSecao: number }`
  - `function taxaMatching(cits: CitacaoProcessada[]): { internas: number; externas: number; taxa: number }`
  - `interface LeadingCase { chave: string; alvoId: string | null; citadoPor: number; noVoto: number }`
  - `function rankingLeadingCases(cits: CitacaoProcessada[], limite?: number): LeadingCase[]`

- [ ] **Step 1: Write the failing test**

Criar `lib/tcu/precedentes-probe-stats.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  densidade,
  porSecao,
  taxaMatching,
  rankingLeadingCases,
  type CitacaoProcessada,
} from './precedentes-probe-stats';

const C = (
  origemId: string,
  numero: number,
  ano: number,
  secao: CitacaoProcessada['secao'],
  matched: boolean
): CitacaoProcessada => ({ origemId, numero, ano, secao, matched, alvoId: matched ? 'alvo' : null });

describe('densidade', () => {
  it('conta média e mediana preenchendo zeros para acórdãos sem citação', () => {
    // 3 citações vindas de 2 acórdãos distintos; universo de 4 acórdãos.
    const cits = [C('a', 1, 2020, 'voto', true), C('a', 2, 2020, 'voto', true), C('b', 3, 2020, 'relatorio', false)];
    const d = densidade(cits, 4);
    expect(d.totalCitacoes).toBe(3);
    expect(d.acordaosComCitacao).toBe(2);
    expect(d.media).toBeCloseTo(0.75); // 3 / 4
    expect(d.mediana).toBe(0.5); // contagens [0,0,1,2] → (0+1)/2
  });
});

describe('porSecao', () => {
  it('agrupa por seção e conta os sem seção', () => {
    const cits = [
      C('a', 1, 2020, 'voto', true),
      C('a', 2, 2020, 'voto', true),
      C('b', 3, 2020, 'relatorio', true),
      C('c', 4, 2020, null, false),
    ];
    expect(porSecao(cits)).toEqual({ relatorio: 1, voto: 2, acordao: 0, semSecao: 1 });
  });
});

describe('taxaMatching', () => {
  it('separa internas de externas', () => {
    const cits = [C('a', 1, 2020, 'voto', true), C('a', 2, 2020, 'voto', false), C('b', 3, 2020, 'voto', false)];
    expect(taxaMatching(cits)).toEqual({ internas: 1, externas: 2, taxa: 1 / 3 });
  });
});

describe('rankingLeadingCases', () => {
  it('conta acórdãos DISTINTOS que citam cada alvo e ordena por autoridade', () => {
    const cits = [
      C('a', 100, 2013, 'voto', true),
      C('b', 100, 2013, 'voto', true), // mesmo alvo, outro citante
      C('b', 100, 2013, 'relatorio', true), // duplicata do mesmo citante 'b' → não conta 2x
      C('c', 200, 2015, 'relatorio', true),
    ];
    const r = rankingLeadingCases(cits, 10);
    expect(r[0]).toEqual({ chave: '100/2013', alvoId: 'alvo', citadoPor: 2, noVoto: 2 });
    expect(r[1]).toMatchObject({ chave: '200/2015', citadoPor: 1, noVoto: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/tcu/precedentes-probe-stats.test.ts`
Expected: FAIL — "Failed to resolve import './precedentes-probe-stats'".

- [ ] **Step 3: Write minimal implementation**

Criar `lib/tcu/precedentes-probe-stats.ts`:

```ts
/**
 * Agregações puras para o probe da rede de precedentes (Fase 0). Recebe as
 * citações já processadas (origem, alvo, seção, casamento) e devolve os números
 * que decidem GO/NO-GO. Sem banco, sem I/O — testável isoladamente.
 */

export interface CitacaoProcessada {
  /** id do Document que CITA. */
  origemId: string;
  numero: number;
  ano: number;
  /** Seção onde a citação caiu, ou null (cabeçalho / fora de seção). */
  secao: 'relatorio' | 'voto' | 'acordao' | null;
  /** A citação aponta para um acórdão que já temos na base? */
  matched: boolean;
  /** id do Document alvo, se matched. */
  alvoId: string | null;
}

function mediana(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function densidade(
  cits: CitacaoProcessada[],
  totalAcordaos: number
): { acordaosComCitacao: number; totalCitacoes: number; media: number; mediana: number } {
  const porOrigem = new Map<string, number>();
  for (const c of cits) porOrigem.set(c.origemId, (porOrigem.get(c.origemId) ?? 0) + 1);

  const contagens = [...porOrigem.values()];
  // Preenche 0 para os acórdãos analisados que não citaram ninguém.
  while (contagens.length < totalAcordaos) contagens.push(0);
  contagens.sort((a, b) => a - b);

  return {
    acordaosComCitacao: porOrigem.size,
    totalCitacoes: cits.length,
    media: totalAcordaos ? cits.length / totalAcordaos : 0,
    mediana: mediana(contagens),
  };
}

export function porSecao(
  cits: CitacaoProcessada[]
): { relatorio: number; voto: number; acordao: number; semSecao: number } {
  const r = { relatorio: 0, voto: 0, acordao: 0, semSecao: 0 };
  for (const c of cits) {
    if (c.secao === null) r.semSecao++;
    else r[c.secao]++;
  }
  return r;
}

export function taxaMatching(
  cits: CitacaoProcessada[]
): { internas: number; externas: number; taxa: number } {
  const internas = cits.filter((c) => c.matched).length;
  return { internas, externas: cits.length - internas, taxa: cits.length ? internas / cits.length : 0 };
}

export interface LeadingCase {
  /** "numero/ano" do acórdão citado. */
  chave: string;
  alvoId: string | null;
  /** Nº de acórdãos DISTINTOS que o citam (autoridade). */
  citadoPor: number;
  /** Quantos desses o citam no VOTO (razão de decidir). */
  noVoto: number;
}

export function rankingLeadingCases(cits: CitacaoProcessada[], limite = 30): LeadingCase[] {
  const porAlvo = new Map<string, { alvoId: string | null; origens: Set<string>; voto: Set<string> }>();
  for (const c of cits) {
    const chave = `${c.numero}/${c.ano}`;
    let e = porAlvo.get(chave);
    if (!e) {
      e = { alvoId: c.alvoId, origens: new Set(), voto: new Set() };
      porAlvo.set(chave, e);
    }
    e.origens.add(c.origemId);
    if (c.secao === 'voto') e.voto.add(c.origemId);
  }
  return [...porAlvo.entries()]
    .map(([chave, e]) => ({ chave, alvoId: e.alvoId, citadoPor: e.origens.size, noVoto: e.voto.size }))
    .sort((a, b) => b.citadoPor - a.citadoPor || b.noVoto - a.noVoto)
    .slice(0, limite);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/tcu/precedentes-probe-stats.test.ts`
Expected: PASS (4 blocos).

- [ ] **Step 5: Commit**

```bash
git add lib/tcu/precedentes-probe-stats.ts lib/tcu/precedentes-probe-stats.test.ts
git commit -m "feat(tcu): agregações puras do probe de precedentes (fase 0)"
```

---

### Task 3: Script do probe (I/O — lê, mede, escreve JSON)

**Files:**
- Create: `scripts/probe-precedentes-tcu.ts`

**Interfaces:**
- Consumes: `extractAcordaoCitations` (Task 1); `densidade`, `porSecao`, `taxaMatching`, `rankingLeadingCases`, `CitacaoProcessada` (Task 2); `seccionarAcordao`, `secaoDe` de `lib/tcu/seccionar-acordao.ts` (existente); `prisma` de `lib/prisma.ts` (existente).
- Produces: arquivo `docs/audits/2026-07-18-probe-precedentes-tcu.json` + resumo no console. Não persiste no banco.

> **Nota sobre TDD:** este é um script operacional de I/O (padrão de `scripts/reanalyze-tcu.ts`, que também não tem teste unitário). Toda a lógica pura já foi coberta pelos testes das Tasks 1-2. A verificação aqui é executar em modo leitura (o script não grava no banco) e inspecionar a saída.

- [ ] **Step 1: Write the script**

Criar `scripts/probe-precedentes-tcu.ts`:

```ts
/**
 * PROBE (Fase 0) da rede de precedentes do TCU — MEDE, não grava.
 *
 * Lê os acórdãos com inteiro teor já guardado, extrai as citações
 * "Acórdão N/AAAA", atribui cada uma a uma seção (voto/relatório/dispositivo),
 * casa com o acervo e agrega. Produz um JSON de calibração para decidir GO/NO-GO
 * antes de construir a infra de grafo (lição do BIA-8). Não escreve no banco.
 *
 * Uso: npx tsx scripts/probe-precedentes-tcu.ts
 *
 * Ref.: docs/superpowers/specs/2026-07-18-rede-precedentes-tcu-probe-design.md
 */
import { writeFileSync } from 'fs';
import { prisma } from '../lib/prisma';
import { extractAcordaoCitations } from '../lib/tcu/acordao-citation-extractor';
import { seccionarAcordao, secaoDe } from '../lib/tcu/seccionar-acordao';
import {
  densidade,
  porSecao,
  taxaMatching,
  rankingLeadingCases,
  type CitacaoProcessada,
} from '../lib/tcu/precedentes-probe-stats';

const SAIDA = 'docs/audits/2026-07-18-probe-precedentes-tcu.json';
const AMOSTRA_N = 40;

async function main() {
  const docs = await prisma.document.findMany({
    where: { category: 'acordao', tcuTextoCompleto: { not: null } },
    select: { id: true, title: true, acordaoNumero: true, acordaoAno: true, tcuTextoCompleto: true },
    orderBy: { id: 'asc' },
  });
  console.log(`Acórdãos com texto guardado: ${docs.length}\n`);

  // Índice de casamento: "numero/ano" -> id do primeiro Document com esse par.
  const indice = new Map<string, string>();
  for (const d of docs) {
    if (d.acordaoNumero != null && d.acordaoAno != null) {
      const chave = `${d.acordaoNumero}/${d.acordaoAno}`;
      if (!indice.has(chave)) indice.set(chave, d.id);
    }
  }

  const cits: CitacaoProcessada[] = [];
  const amostra: Array<{ origem: string; raw: string; secao: string | null; matched: boolean; trecho: string }> = [];

  for (const d of docs) {
    const texto = d.tcuTextoCompleto ?? '';
    const secoes = seccionarAcordao(texto);
    for (const c of extractAcordaoCitations(texto)) {
      // Descarta auto-citação (o próprio acórdão no cabeçalho/dispositivo).
      if (d.acordaoNumero === c.numero && d.acordaoAno === c.ano) continue;
      const alvoId = indice.get(`${c.numero}/${c.ano}`) ?? null;
      const secao = secaoDe(secoes, c.index);
      cits.push({ origemId: d.id, numero: c.numero, ano: c.ano, secao, matched: alvoId !== null, alvoId });
      if (amostra.length < AMOSTRA_N) {
        amostra.push({
          origem: d.title.slice(0, 44),
          raw: c.raw,
          secao,
          matched: alvoId !== null,
          trecho: texto.slice(Math.max(0, c.index - 90), c.index + 90).replace(/\s+/g, ' ').trim(),
        });
      }
    }
  }

  const resumo = {
    geradoEm: '2026-07-18',
    totalAcordaosAnalisados: docs.length,
    densidade: densidade(cits, docs.length),
    porSecao: porSecao(cits),
    matching: taxaMatching(cits),
    topLeadingCases: rankingLeadingCases(cits, 30),
    amostra,
  };

  writeFileSync(SAIDA, JSON.stringify(resumo, null, 2), 'utf8');

  console.log('Densidade:', resumo.densidade);
  console.log('Por seção:', resumo.porSecao);
  console.log('Matching:', resumo.matching);
  console.log('\nTop 10 leading cases:');
  for (const lc of resumo.topLeadingCases.slice(0, 10)) {
    console.log(
      `  ${lc.chave.padEnd(12)} citado por ${String(lc.citadoPor).padStart(3)} (voto: ${lc.noVoto})  ${lc.alvoId ? '✓ na base' : '✗ externo'}`
    );
  }
  console.log(`\n📄 JSON completo em ${SAIDA}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
```

- [ ] **Step 2: Run the probe and verify output**

Run: `npx tsx scripts/probe-precedentes-tcu.ts`
Expected:
- Imprime "Acórdãos com texto guardado: N" com N na casa dos milhares (~1.685).
- Imprime blocos `Densidade`, `Por seção`, `Matching` com números coerentes (`totalCitacoes` > 0; `internas + externas === totalCitacoes`).
- Lista "Top 10 leading cases".
- Cria `docs/audits/2026-07-18-probe-precedentes-tcu.json`.
- Confirma que **nada** foi escrito no banco (o script não chama nenhum `update`/`create`).

Se `totalCitacoes` vier 0 ou absurdamente baixo, parar e revisar a regex do extrator (Task 1) contra amostras reais de `tcuTextoCompleto` — NÃO seguir para o gate com número furado.

- [ ] **Step 3: Commit**

```bash
git add scripts/probe-precedentes-tcu.ts docs/audits/2026-07-18-probe-precedentes-tcu.json
git commit -m "feat(tcu): script do probe de precedentes + resultado da 1ª rodada"
```

---

### Task 4: Relatório de calibração + decisão de gate

**Files:**
- Input: `docs/audits/2026-07-18-probe-precedentes-tcu.json` (Task 3)
- Output: um Artifact (folha de calibração) apresentado ao Daniel — não é código do repo.

**Interfaces:**
- Consumes: o JSON do probe.
- Produces: decisão registrada GO / NO-GO / adiado (como no BIA-8), e a atualização das memórias.

- [ ] **Step 1: Montar a folha de calibração**

A partir do JSON, montar um Artifact HTML no formato de [[feedback-formato-golden-julgamento]] (card por item, trecho real, veredito), com os 5 blocos do spec §4.2: densidade, distribuição por seção, taxa de casamento, amostra de ~40 citações com trecho real (para o Daniel julgar a regex), e ranking de leading cases. Salvar o HTML no scratchpad e publicar via a ferramenta Artifact.

- [ ] **Step 2: Apresentar ao Daniel e decidir o gate**

Apresentar o relatório e conduzir a decisão com número na mão, respondendo às três perguntas do spec §4.3:
1. A extração é confiável? (amostra sem inventar/perder)
2. Há sinal de autoridade? (ranking plausível, densidade não-nula)
3. Vale persistir o grafo (Fase 1)?

Registrar GO / NO-GO / adiado.

- [ ] **Step 3: Atualizar memória e painel**

- Atualizar `rede-precedentes-tcu-ideia.md` e o handoff com o resultado do probe e a decisão.
- Atualizar o painel Torre de Controle ([[painel-frentes-control-tower]]).
- Se GO: a Fase 1 abre com seu próprio spec (modelo de dados, nós externos, integração no núcleo `catalogar-acordao.ts` + backfill via `reanalyze-tcu.ts`, conforme spec §5).

---

## Notas de execução

- **Ordem:** Task 1 → 2 → 3 → 4. As Tasks 1 e 2 são independentes entre si (ambas módulos folha) e poderiam ir em paralelo; a Task 3 depende das duas; a Task 4 depende da 3.
- **Reaproveitamento na Fase 1:** `lib/tcu/acordao-citation-extractor.ts` (Task 1) é o módulo que o núcleo `catalogar-acordao.ts` chamará em produção — não reescrever na Fase 1, só consumir.
- **Sem regressão:** rodar `npx vitest run lib/tcu/` ao final para garantir que os testes novos convivem com os existentes de `lib/tcu/`.
