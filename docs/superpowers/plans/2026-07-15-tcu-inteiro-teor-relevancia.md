# Inteiro teor do TCU e hierarquia de relevância — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Baixar o inteiro teor dos acórdãos do TCU (RTF), seccioná-lo em Relatório/Voto/Acórdão e contar os 22 princípios do art. 5º por seção, para distinguir razão de decidir de citação ornamental.

**Architecture:** Pipeline determinístico sem LLM: `fetch RTF → extrair texto → seccionar → contar termos por seção → persistir contagens`. O texto vai para `Document.tcuTextoCompleto` (que **não** é lido pelo RAG); as contagens para `Document.tcuAnalise` (JSON, sem veredito); o derivado `leiArticlesDebated` (array + GIN) sai do JSON pelo limiar vigente e é recomputável.

**Tech Stack:** TypeScript · Next.js 15 · Prisma 7.4 (PrismaNeon) · `rtf-parser@1.3.3` (já instalado) · Vitest

**Spec:** `docs/superpowers/specs/2026-07-15-tcu-inteiro-teor-relevancia-design.md`

## Global Constraints

- **Nunca indexar `tcuTextoCompleto`.** `lib/embeddings/source-text.ts:21` lê `[content, tcuEmentaCompleta, description]` — esse campo não pode entrar nessa lista. Indexá-lo traria ~116k chunks e o flooding recusado no design de 07/07.
- **Sem LLM em qualquer critério.** Foi IA embutida no critério que produziu os 448 vínculos fantasma.
- **`description` nunca é fonte de evidência** — é resumo gerado por IA.
- Scripts de escrita: **dry-run por padrão**, `--execute` para aplicar (padrão do projeto).
- Prisma: `import { prisma } from '@/lib/prisma'` (já carrega `.env.local`).
- Testes: Vitest. Arquivo de teste ao lado do módulo (`x.ts` + `x.test.ts`) ou em `__tests__/`.
- Comentários e mensagens de commit em português.

---

### Task 1: Tipos e extração de RTF

**Files:**
- Create: `types/rtf-parser.d.ts`
- Create: `lib/tcu/rtf-to-text.ts`
- Create: `lib/tcu/rtf-to-text.test.ts`

**Interfaces:**
- Consumes: nada
- Produces: `rtfToText(buf: Buffer): Promise<string>`

- [ ] **Step 1: Declaração de tipos do rtf-parser**

`rtf-parser@1.3.3` não tem `@types`. Criar `types/rtf-parser.d.ts`:

```ts
declare module 'rtf-parser' {
  /** Span de texto dentro de um parágrafo. */
  interface RtfSpan {
    value?: string;
  }
  /** Parágrafo do documento. */
  interface RtfParagraph {
    content?: RtfSpan[];
  }
  interface RtfDoc {
    content: RtfParagraph[];
  }
  /** Parseia RTF a partir de string (a lib é callback-based). */
  export function string(
    rtf: string,
    cb: (err: Error | null, doc: RtfDoc) => void
  ): void;
}
```

- [ ] **Step 2: Escrever o teste que falha**

Criar `lib/tcu/rtf-to-text.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { rtfToText } from './rtf-to-text';

/** RTF mínimo no formato que o TCU emite (cp1252, \'e3 = ã). */
const RTF_SIMPLES = String.raw`{\rtf1\ansi\ansicpg1252\deff0
{\fonttbl{\f0\froman Times;}}
\pard TRIBUNAL DE CONTAS DA UNI\'c3O\par
\pard RELAT\'d3RIO\par
\pard Cuidam os autos de representa\'e7\'e3o.\par
\pard VOTO\par
\pard Acolho o parecer, por viola\'e7\'e3o ao princ\'edpio da economicidade.\par
\pard AC\'d3RD\'c3O\par
\pard Os Ministros ACORDAM em conhecer.\par
}`;

/** Parágrafo que é dump hexadecimal de imagem embutida (EMF/WMF). */
const HEX = '0100'.repeat(40); // 160 chars, 100% hex
const RTF_COM_IMAGEM = String.raw`{\rtf1\ansi\ansicpg1252\deff0
\pard ${HEX}\par
\pard Texto de verdade aqui.\par
}`;

describe('rtfToText', () => {
  it('extrai o texto com acentuação cp1252 correta', async () => {
    const t = await rtfToText(Buffer.from(RTF_SIMPLES, 'latin1'));
    expect(t).toContain('TRIBUNAL DE CONTAS DA UNIÃO');
    expect(t).toContain('representação');
    expect(t).toContain('princípio da economicidade');
  });

  it('NÃO quebra palavras no meio (bug do extrator ingênuo: UNIÃ\\nO)', async () => {
    const t = await rtfToText(Buffer.from(RTF_SIMPLES, 'latin1'));
    expect(t).toMatch(/UNIÃO/);
    expect(t).not.toMatch(/UNIÃ\s*\n\s*O/);
  });

  it('preserva as quebras de parágrafo (o seccionamento depende delas)', async () => {
    const t = await rtfToText(Buffer.from(RTF_SIMPLES, 'latin1'));
    expect(t.split('\n').length).toBeGreaterThan(3);
  });

  it('não deixa control word nem lixo de metadados', async () => {
    const t = await rtfToText(Buffer.from(RTF_SIMPLES, 'latin1'));
    expect(t).not.toMatch(/\\[a-z]{2,}\d*/);
    expect(t).not.toMatch(/shapeType|fFlipH|pictureGray|fonttbl/);
  });

  it('descarta o dump hexadecimal das imagens embutidas', async () => {
    const t = await rtfToText(Buffer.from(RTF_COM_IMAGEM, 'latin1'));
    expect(t).toContain('Texto de verdade aqui.');
    expect(t).not.toContain(HEX);
  });

  it('mantém texto legítimo que por acaso tem hex curto', async () => {
    const rtf = String.raw`{\rtf1\ansi\deff0 \pard Processo TC 024.321/2025-7 abcdef.\par}`;
    const t = await rtfToText(Buffer.from(rtf, 'latin1'));
    expect(t).toContain('Processo TC 024.321/2025-7 abcdef.');
  });

  it('rejeita RTF inválido com erro claro', async () => {
    await expect(rtfToText(Buffer.from('não é rtf', 'latin1'))).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Rodar o teste e ver falhar**

Run: `npx vitest run lib/tcu/rtf-to-text.test.ts`
Expected: FAIL — `Failed to resolve import "./rtf-to-text"`

- [ ] **Step 4: Implementar**

Criar `lib/tcu/rtf-to-text.ts`:

```ts
/**
 * RTF → texto limpo. Usado para o inteiro teor dos acórdãos do TCU, que o
 * Tribunal serve em RTF (apesar de o campo se chamar `tcuLinkPDF`).
 *
 * Biblioteca escolhida no spike de 15/07 (ver §4.4 do design):
 * `rtf-stream-parser` só lê RTF encapsulado de e-mail; `unrtf` é wrapper de
 * binário do SO e não roda na Vercel. `rtf-parser` funciona — mas devolve o
 * dump hexadecimal das imagens embutidas como se fosse texto (134.824 chars
 * com lixo vs. 72.087 limpos), daí o filtro abaixo.
 *
 * Ref.: docs/superpowers/specs/2026-07-15-tcu-inteiro-teor-relevancia-design.md
 */
import * as rtfParser from 'rtf-parser';

/** Parágrafo que é dump hexadecimal de imagem (EMF/WMF), não texto. */
function ehDumpBinario(s: string): boolean {
  const t = s.trim();
  if (t.length < 80) return false; // texto curto com hex é legítimo (ex.: nº de processo)
  const hex = (t.match(/[0-9a-f]/gi) ?? []).length;
  return hex / t.length > 0.92;
}

export async function rtfToText(buf: Buffer): Promise<string> {
  // O RTF do TCU é cp1252; latin1 preserva os bytes para a lib decodificar \'hh.
  const rtf = buf.toString('latin1');

  const doc = await new Promise<{ content: Array<{ content?: Array<{ value?: string }> }> }>(
    (resolve, reject) => {
      rtfParser.string(rtf, (err, d) => (err ? reject(err) : resolve(d)));
    }
  );

  return doc.content
    .map((p) => (p.content ?? []).map((s) => s.value ?? '').join(''))
    .filter((p) => !ehDumpBinario(p))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
```

- [ ] **Step 5: Rodar o teste e ver passar**

Run: `npx vitest run lib/tcu/rtf-to-text.test.ts`
Expected: PASS (7 testes)

- [ ] **Step 6: Verificar contra o RTF real do TCU**

Este é o teste que importa — o sintético não prova nada sobre o RTF de verdade.

```bash
curl -s -A "Mozilla/5.0 (compatible; SiteDoBarral/1.0)" \
  "https://contas.tcu.gov.br/sagas/SvlVisualizarRelVotoAcRtf?codFiltro=SAGAS-SESSAO-ENCERRADA&seOcultaPagina=S&item0=907383" \
  -o /tmp/ac.rtf --max-time 60
```

Criar `scripts/_check-rtf.ts` (temporário, apagar depois):

```ts
import { readFileSync } from 'fs';
import { rtfToText } from '../lib/tcu/rtf-to-text';
const t = await rtfToText(readFileSync('/tmp/ac.rtf'));
console.log(`chars: ${t.length}`);
for (const [nome, ok] of [
  ['TRIBUNAL DE CONTAS DA UNIÃO', /TRIBUNAL DE CONTAS DA UNIÃO/.test(t)],
  ['RELATÓRIO', /\bRELAT[ÓO]RIO\b/.test(t)],
  ['VOTO', /\bVOTO\b/.test(t)],
  ['ACÓRDÃO', /\bAC[ÓO]RD[ÃA]O\b/.test(t)],
  ['sem hex longo', !/[0-9a-f]{200,}/i.test(t)],
  ['sem shapeType', !/shapeType/.test(t)],
] as const) console.log(`${ok ? '✅' : '❌'} ${nome}`);
```

Run: `npx tsx scripts/_check-rtf.ts`
Expected: `chars:` ~72000 e ✅ em todos. Apagar o script depois: `rm scripts/_check-rtf.ts`

- [ ] **Step 7: Commit**

```bash
git add types/rtf-parser.d.ts lib/tcu/rtf-to-text.ts lib/tcu/rtf-to-text.test.ts package.json package-lock.json
git commit -m "feat(tcu): extrair texto de RTF com rtf-parser

O TCU serve o inteiro teor em RTF, não PDF — apesar de o campo se chamar
tcuLinkPDF. rtf-parser é a única das três bibliotecas avaliadas que serve:
rtf-stream-parser só lê RTF encapsulado de e-mail e unrtf é wrapper de
binário do SO, que não roda na Vercel.

rtf-parser devolve o dump hexadecimal das imagens embutidas como se fosse
texto (134.824 chars com lixo contra 72.087 limpos), daí o filtro de
parágrafo com mais de 92% de dígitos hex.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Seccionar o acórdão

**Files:**
- Create: `lib/tcu/seccionar-acordao.ts`
- Create: `lib/tcu/seccionar-acordao.test.ts`

**Interfaces:**
- Consumes: texto de `rtfToText()`
- Produces:
```ts
interface Secoes { relatorio: [number, number] | null; voto: [number, number] | null; acordao: [number, number] | null }
function seccionarAcordao(texto: string): Secoes | null
function secaoDe(secoes: Secoes | null, pos: number): 'relatorio' | 'voto' | 'acordao' | null
```

- [ ] **Step 1: Escrever o teste que falha**

Criar `lib/tcu/seccionar-acordao.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { seccionarAcordao, secaoDe } from './seccionar-acordao';

const ACORDAO = [
  'TRIBUNAL DE CONTAS DA UNIÃO',        // cabeçalho
  'ACÓRDÃO Nº 1135/2026 - TCU - Plenário', // ⚠️ "ACÓRDÃO" aparece AQUI também
  'Natureza: Representação.',
  'RELATÓRIO',
  'A representante alega violação ao julgamento objetivo.',
  'VOTO',
  'Acolho. O julgamento objetivo foi desrespeitado.',
  'ACÓRDÃO',
  'Os Ministros ACORDAM em conhecer.',
].join('\n');

describe('seccionarAcordao', () => {
  it('acha as três seções', () => {
    const s = seccionarAcordao(ACORDAO)!;
    expect(s.relatorio).not.toBeNull();
    expect(s.voto).not.toBeNull();
    expect(s.acordao).not.toBeNull();
  });

  it('usa a ÚLTIMA ocorrência de ACÓRDÃO (a 1ª é o cabeçalho)', () => {
    const s = seccionarAcordao(ACORDAO)!;
    // O dispositivo vem depois do voto, não no início do documento.
    expect(s.acordao![0]).toBeGreaterThan(s.voto![0]);
  });

  it('as seções são contíguas e em ordem', () => {
    const s = seccionarAcordao(ACORDAO)!;
    expect(s.relatorio![1]).toBe(s.voto![0]);
    expect(s.voto![1]).toBe(s.acordao![0]);
  });

  it('acórdão curto sem seções devolve null (caso legítimo, não erro)', () => {
    // O de 2.247 chars do spike: só dispositivo, sem relatório nem voto.
    expect(seccionarAcordao('ACÓRDÃO Nº 3796/2024\nOs Ministros ACORDAM em aplicar multa.')).toBeNull();
  });

  it('texto vazio devolve null', () => {
    expect(seccionarAcordao('')).toBeNull();
  });
});

describe('secaoDe', () => {
  const s = seccionarAcordao(ACORDAO)!;

  it('localiza uma posição no relatório', () => {
    expect(secaoDe(s, ACORDAO.indexOf('A representante alega'))).toBe('relatorio');
  });

  it('localiza uma posição no voto', () => {
    expect(secaoDe(s, ACORDAO.indexOf('Acolho.'))).toBe('voto');
  });

  it('localiza uma posição no dispositivo', () => {
    expect(secaoDe(s, ACORDAO.indexOf('Os Ministros ACORDAM'))).toBe('acordao');
  });

  it('posição no cabeçalho (antes do relatório) não é de seção nenhuma', () => {
    expect(secaoDe(s, 0)).toBeNull();
  });

  it('secoes null → null', () => {
    expect(secaoDe(null, 10)).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/tcu/seccionar-acordao.test.ts`
Expected: FAIL — `Failed to resolve import "./seccionar-acordao"`

- [ ] **Step 3: Implementar**

Criar `lib/tcu/seccionar-acordao.ts`:

```ts
/**
 * Divide o inteiro teor do acórdão em Relatório / Voto / Acórdão (dispositivo).
 *
 * A seção é o sinal que interessa: um princípio debatido no VOTO é razão de
 * decidir; o mesmo princípio só no RELATÓRIO é alegação da parte — que o
 * tribunal pode até ter rejeitado.
 *
 * O endpoint do TCU se chama SvlVisualizarRelVotoAcRtf: Relatório, Voto,
 * Acórdão. O documento já vem nessa ordem.
 */

export interface Secoes {
  /** [início, fim) no texto. */
  relatorio: [number, number] | null;
  voto: [number, number] | null;
  acordao: [number, number] | null;
}

/** Marcador de seção: em linha própria, em caixa alta. */
const RE_RELATORIO = /^\s*RELAT[ÓO]RIO\s*$/m;
const RE_VOTO = /^\s*VOTO\s*$/m;
const RE_ACORDAO = /^\s*AC[ÓO]RD[ÃA]O\s*$/gm;

export function seccionarAcordao(texto: string): Secoes | null {
  if (!texto) return null;

  const iRel = texto.search(RE_RELATORIO);
  const iVoto = texto.search(RE_VOTO);

  // Acórdãos curtos (multa, citação) só têm dispositivo — não é erro.
  if (iRel < 0 || iVoto < 0 || iVoto <= iRel) return null;

  // "ACÓRDÃO" também aparece no cabeçalho ("ACÓRDÃO Nº 1135/2026"). O
  // dispositivo é a última ocorrência isolada, e vem depois do voto.
  let iAc = -1;
  RE_ACORDAO.lastIndex = 0;
  for (const m of texto.matchAll(RE_ACORDAO)) {
    if (m.index !== undefined && m.index > iVoto) { iAc = m.index; break; }
  }

  const fim = texto.length;
  return {
    relatorio: [iRel, iVoto],
    voto: [iVoto, iAc > 0 ? iAc : fim],
    acordao: iAc > 0 ? [iAc, fim] : null,
  };
}

export function secaoDe(
  secoes: Secoes | null,
  pos: number
): 'relatorio' | 'voto' | 'acordao' | null {
  if (!secoes) return null;
  for (const nome of ['relatorio', 'voto', 'acordao'] as const) {
    const r = secoes[nome];
    if (r && pos >= r[0] && pos < r[1]) return nome;
  }
  return null; // cabeçalho, antes do relatório
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run lib/tcu/seccionar-acordao.test.ts`
Expected: PASS (10 testes)

- [ ] **Step 5: Commit**

```bash
git add lib/tcu/seccionar-acordao.ts lib/tcu/seccionar-acordao.test.ts
git commit -m "feat(tcu): seccionar acórdão em Relatório/Voto/Acórdão

A seção é o sinal que distingue razão de decidir de citação ornamental: um
princípio debatido no voto fundamentou a decisão; o mesmo princípio só no
relatório é alegação da parte, que o tribunal pode ter rejeitado.

O marcador ACÓRDÃO aparece também no cabeçalho (ACÓRDÃO Nº 1135/2026), então
o dispositivo é a primeira ocorrência isolada APÓS o voto, não a primeira do
documento. Acórdão curto sem seções devolve null — é caso legítimo (multa,
citação), não erro.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Termos por artigo (os 22 princípios)

**Files:**
- Create: `data/lei-14133-termos.ts`
- Create: `data/lei-14133-termos.test.ts`

**Interfaces:**
- Consumes: nada
- Produces: `TERMOS_POR_ARTIGO: Record<string, string[]>`

- [ ] **Step 1: Escrever o teste que falha**

Criar `data/lei-14133-termos.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { TERMOS_POR_ARTIGO } from './lei-14133-termos';
import { LEI_14133_ARTIGOS } from './lei-14133-artigos';

describe('TERMOS_POR_ARTIGO', () => {
  it('o art. 5º tem os 22 princípios', () => {
    expect(TERMOS_POR_ARTIGO['5']).toHaveLength(22);
  });

  it('inclui os princípios que o caput nomeia', () => {
    const t = TERMOS_POR_ARTIGO['5'];
    for (const p of ['legalidade', 'economicidade', 'julgamento objetivo', 'desenvolvimento nacional sustentável']) {
      expect(t).toContain(p);
    }
  });

  it('todo artigo mapeado existe na Lei', () => {
    for (const num of Object.keys(TERMOS_POR_ARTIGO)) {
      expect(LEI_14133_ARTIGOS).toHaveProperty(num);
    }
  });

  it('termos são minúsculos e sem duplicata (a busca é case-insensitive)', () => {
    for (const termos of Object.values(TERMOS_POR_ARTIGO)) {
      for (const t of termos) expect(t).toBe(t.toLowerCase());
      expect(new Set(termos).size).toBe(termos.length);
    }
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run data/lei-14133-termos.test.ts`
Expected: FAIL — `Failed to resolve import "./lei-14133-termos"`

- [ ] **Step 3: Implementar**

Criar `data/lei-14133-termos.ts`. Os 22 princípios são o texto literal do caput do art. 5º:

```ts
/**
 * Termos-chave por artigo da Lei 14.133 — o que procurar no inteiro teor.
 *
 * Existe porque os acórdãos **citam o princípio, não o artigo**. Um voto
 * discute economicidade por páginas escrevendo "princípio da economicidade" e
 * jamais "art. 5º da Lei 14.133". Medido no spike de 15/07: 0 de 6 acórdãos
 * vinculados ao art. 5º citam o artigo, nem no inteiro teor.
 *
 * Para artigos que não são listas de termos nomeados, a citação direta do
 * artigo (lib/lei-14133/citation-extractor.ts) já resolve — não precisam
 * entrar aqui.
 *
 * Ref.: docs/superpowers/specs/2026-07-15-tcu-inteiro-teor-relevancia-design.md
 */

/** Os 22 princípios nomeados no caput do art. 5º, na ordem da lei. */
const PRINCIPIOS_ART_5 = [
  'legalidade',
  'impessoalidade',
  'moralidade',
  'publicidade',
  'eficiência',
  'interesse público',
  'probidade administrativa',
  'igualdade',
  'planejamento',
  'transparência',
  'eficácia',
  'segregação de funções',
  'motivação',
  'vinculação ao edital',
  'julgamento objetivo',
  'segurança jurídica',
  'razoabilidade',
  'competitividade',
  'proporcionalidade',
  'celeridade',
  'economicidade',
  'desenvolvimento nacional sustentável',
];

export const TERMOS_POR_ARTIGO: Record<string, string[]> = {
  '5': PRINCIPIOS_ART_5,
};
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run data/lei-14133-termos.test.ts`
Expected: PASS (4 testes)

- [ ] **Step 5: Commit**

```bash
git add data/lei-14133-termos.ts data/lei-14133-termos.test.ts
git commit -m "feat(lei-14133): termos-chave por artigo (os 22 princípios do art. 5º)

Os acórdãos citam o princípio, não o artigo: um voto discute economicidade
por páginas escrevendo 'princípio da economicidade', e jamais 'art. 5º da
Lei 14.133'. Medido no spike: 0 de 6 acórdãos vinculados ao art. 5º citam o
artigo, nem no inteiro teor.

Começa só pelo art. 5º. Artigos que não são listas de termos nomeados não
precisam entrar aqui — para eles a citação direta do artigo já resolve.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Análise de relevância

**Files:**
- Create: `lib/tcu/analise-relevancia.ts`
- Create: `lib/tcu/analise-relevancia.test.ts`

**Interfaces:**
- Consumes: `seccionarAcordao`, `secaoDe` (Task 2), `TERMOS_POR_ARTIGO` (Task 3), `extractCitations` (`lib/lei-14133/citation-extractor.ts`, já existe)
- Produces:
```ts
interface ContagemSecao { relatorio?: number; voto?: number; acordao?: number }
interface TermoContagem { forte: ContagemSecao; fraco: ContagemSecao }
interface TcuAnalise {
  v: number; extraidoEm: string; chars: number; truncado?: boolean;
  secoes: { relatorio: [number, number] | null; voto: [number, number] | null; acordao: [number, number] | null } | null;
  artigosCitados: Record<string, ContagemSecao>;
  termos: Record<string, Record<string, TermoContagem>>;
}
function analisarAcordao(texto: string, artigosVinculados: string[], opts?: { truncado?: boolean }): TcuAnalise
function artigosDebatidos(a: TcuAnalise): string[]
const ANALISE_VERSAO = 1
```

- [ ] **Step 1: Escrever o teste que falha**

Criar `lib/tcu/analise-relevancia.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { analisarAcordao, artigosDebatidos, ANALISE_VERSAO } from './analise-relevancia';

const TEXTO = [
  'TRIBUNAL DE CONTAS DA UNIÃO',
  'ACÓRDÃO Nº 1135/2026 - TCU - Plenário',
  'RELATÓRIO',
  'A representante alega ofensa à economicidade do certame.',
  'VOTO',
  'O princípio da economicidade foi desrespeitado.',
  'A economicidade exige a proposta mais vantajosa.',
  'Reitero: economicidade não se presume.',
  'Cito ainda o art. 15 da Lei 14.133.',
  'ACÓRDÃO',
  'Os Ministros ACORDAM em conhecer.',
].join('\n');

describe('analisarAcordao', () => {
  const a = analisarAcordao(TEXTO, ['5', '15']);

  it('carimba versão, tamanho e data', () => {
    expect(a.v).toBe(ANALISE_VERSAO);
    expect(a.chars).toBe(TEXTO.length);
    expect(a.extraidoEm).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('conta "princípio da X" como FORTE, no voto', () => {
    expect(a.termos['5']['economicidade'].forte.voto).toBe(1);
  });

  it('conta o termo nu como FRACO — inclusive dentro da forma forte', () => {
    // "princípio da economicidade" + 2 nus = 3 no voto
    expect(a.termos['5']['economicidade'].fraco.voto).toBe(3);
  });

  it('separa por seção: o relatório é alegação da parte, não fundamento', () => {
    expect(a.termos['5']['economicidade'].fraco.relatorio).toBe(1);
    expect(a.termos['5']['economicidade'].forte.relatorio).toBeUndefined();
  });

  it('não inventa termo que não aparece', () => {
    expect(a.termos['5']['celeridade']).toBeUndefined();
  });

  it('registra citação de artigo por seção', () => {
    expect(a.artigosCitados['15'].voto).toBe(1);
  });

  it('só analisa termos dos artigos vinculados', () => {
    expect(Object.keys(a.termos)).toEqual(['5']);
  });

  it('texto sem seções: analisa sem quebrar', () => {
    const x = analisarAcordao('ACÓRDÃO Nº 1/2024\nMulta aplicada.', ['5']);
    expect(x.secoes).toBeNull();
    expect(x.termos).toEqual({});
  });

  it('propaga a marca de truncagem', () => {
    expect(analisarAcordao(TEXTO, ['5'], { truncado: true }).truncado).toBe(true);
  });
});

describe('artigosDebatidos', () => {
  it('entra quando o princípio é NOMEADO no voto (forte >= 1)', () => {
    const a = analisarAcordao(TEXTO, ['5']);
    expect(artigosDebatidos(a)).toContain('5');
  });

  it('entra quando o termo se repete no voto (fraco >= 3), mesmo sem forma forte', () => {
    const t = ['RELATÓRIO', 'nada', 'VOTO',
      'A celeridade importa. Sem celeridade não há certame. Reitero a celeridade.',
      'ACÓRDÃO', 'ACORDAM.'].join('\n');
    const a = analisarAcordao(t, ['5']);
    expect(a.termos['5']['celeridade'].forte.voto).toBeUndefined();
    expect(a.termos['5']['celeridade'].fraco.voto).toBe(3);
    expect(artigosDebatidos(a)).toContain('5');
  });

  it('NÃO entra com menção ornamental (1 fraco no voto)', () => {
    const t = ['RELATÓRIO', 'nada', 'VOTO', 'Observada a celeridade, decido.', 'ACÓRDÃO', 'ACORDAM.'].join('\n');
    expect(artigosDebatidos(analisarAcordao(t, ['5']))).toEqual([]);
  });

  it('NÃO entra se o princípio só aparece no relatório (alegação da parte)', () => {
    const t = ['RELATÓRIO',
      'A parte alega celeridade, celeridade e mais celeridade.',
      'VOTO', 'Rejeito por outros motivos.', 'ACÓRDÃO', 'ACORDAM.'].join('\n');
    expect(artigosDebatidos(analisarAcordao(t, ['5']))).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/tcu/analise-relevancia.test.ts`
Expected: FAIL — `Failed to resolve import "./analise-relevancia"`

- [ ] **Step 3: Implementar**

Criar `lib/tcu/analise-relevancia.ts`:

```ts
/**
 * Conta, por seção do acórdão, os termos-chave de cada artigo vinculado.
 *
 * Guarda CONTAGENS, não veredito: o limiar de "quantas menções no voto = razão
 * de decidir" mora em LIMIAR_DEBATIDO, fora do dado, e é recomputável sem
 * re-baixar nada. Foi IA embutida no critério que produziu os 448 vínculos
 * fantasma do art. 5º — aqui não entra LLM.
 *
 * Ref.: docs/superpowers/specs/2026-07-15-tcu-inteiro-teor-relevancia-design.md
 */
import { seccionarAcordao, secaoDe, type Secoes } from './seccionar-acordao';
import { TERMOS_POR_ARTIGO } from '../../data/lei-14133-termos';
import { extractCitations } from '../lei-14133/citation-extractor';

/** Suba ao mudar a semântica da análise: o backfill reprocessa quem estiver defasado. */
export const ANALISE_VERSAO = 1;

/**
 * Limiar provisório. Calibrado em UM acórdão (1135/2026) no spike de 15/07:
 * "julgamento objetivo" aparecia forte=1 / fraco=11 no voto e era a razão de
 * decidir; a proposta original (forte >= 2) não teria pego nenhum acórdão,
 * porque o julgador nomeia o princípio uma vez e depois usa o nome nu.
 * VALIDAR com o golden set de 10 acórdãos antes de confiar.
 */
export const LIMIAR_DEBATIDO = { forteVoto: 1, fracoVoto: 3 };

export interface ContagemSecao { relatorio?: number; voto?: number; acordao?: number }
export interface TermoContagem { forte: ContagemSecao; fraco: ContagemSecao }

export interface TcuAnalise {
  v: number;
  extraidoEm: string;
  chars: number;
  truncado?: boolean;
  secoes: Secoes | null;
  artigosCitados: Record<string, ContagemSecao>;
  termos: Record<string, Record<string, TermoContagem>>;
}

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** "princípio da economicidade" — o princípio sendo nomeado como tal. */
const reForte = (termo: string) =>
  new RegExp(`princ[íi]pios?\\s+(?:d[aeo]s?\\s+)?${escapar(termo)}`, 'gi');

/** O termo isolado. Sinal secundário: sozinho não decide nada. */
const reFraco = (termo: string) => new RegExp(escapar(termo), 'gi');

function contarPorSecao(texto: string, re: RegExp, secoes: Secoes | null): ContagemSecao {
  const out: ContagemSecao = {};
  for (const m of texto.matchAll(re)) {
    if (m.index === undefined) continue;
    const s = secaoDe(secoes, m.index);
    if (!s) continue; // cabeçalho não conta
    out[s] = (out[s] ?? 0) + 1;
  }
  return out;
}

export function analisarAcordao(
  texto: string,
  artigosVinculados: string[],
  opts?: { truncado?: boolean }
): TcuAnalise {
  const secoes = seccionarAcordao(texto);

  const artigosCitados: Record<string, ContagemSecao> = {};
  for (const c of extractCitations(texto)) {
    if (!c.nearLei14133) continue;
    const s = secaoDe(secoes, c.index);
    if (!s) continue;
    artigosCitados[c.article] ??= {};
    artigosCitados[c.article][s] = (artigosCitados[c.article][s] ?? 0) + 1;
  }

  const termos: Record<string, Record<string, TermoContagem>> = {};
  for (const art of artigosVinculados) {
    const lista = TERMOS_POR_ARTIGO[art];
    if (!lista) continue; // artigo sem termos: a citação direta já resolve
    for (const termo of lista) {
      const forte = contarPorSecao(texto, reForte(termo), secoes);
      const fraco = contarPorSecao(texto, reFraco(termo), secoes);
      if (!Object.keys(forte).length && !Object.keys(fraco).length) continue;
      termos[art] ??= {};
      termos[art][termo] = { forte, fraco };
    }
  }

  return {
    v: ANALISE_VERSAO,
    extraidoEm: new Date().toISOString(),
    chars: texto.length,
    ...(opts?.truncado ? { truncado: true } : {}),
    secoes,
    artigosCitados,
    termos,
  };
}

/** Aplica o limiar. Derivado — recomputável a partir do JSON, sem rede. */
export function artigosDebatidos(a: TcuAnalise): string[] {
  const out: string[] = [];
  for (const [art, termos] of Object.entries(a.termos)) {
    const debatido = Object.values(termos).some(
      (t) =>
        (t.forte.voto ?? 0) >= LIMIAR_DEBATIDO.forteVoto ||
        (t.fraco.voto ?? 0) >= LIMIAR_DEBATIDO.fracoVoto
    );
    if (debatido) out.push(art);
  }
  return out.sort();
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run lib/tcu/analise-relevancia.test.ts`
Expected: PASS (13 testes)

- [ ] **Step 5: Commit**

```bash
git add lib/tcu/analise-relevancia.ts lib/tcu/analise-relevancia.test.ts
git commit -m "feat(tcu): contar termos por seção do acórdão

Guarda contagens, não veredito: o limiar de 'quantas menções no voto = razão
de decidir' fica em LIMIAR_DEBATIDO, fora do dado, recomputável sem
re-baixar. Sem LLM — foi IA embutida no critério que produziu os 448
vínculos fantasma do art. 5º.

O limiar (forte>=1 ou fraco>=3 no voto) está calibrado em UM acórdão e
precisa do golden set de 10 casos. A proposta original (forte>=2) não pegaria
nenhum: o julgador nomeia o princípio uma vez e depois usa o nome nu — no
Acórdão 1135/2026, 'julgamento objetivo' era forte=1 / fraco=11 no voto, e
era a razão de decidir.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Baixar o RTF

**Files:**
- Create: `lib/tcu/inteiro-teor-fetch.ts`
- Create: `lib/tcu/inteiro-teor-fetch.test.ts`

**Interfaces:**
- Consumes: nada
- Produces:
```ts
interface FetchResult { ok: true; buf: Buffer } | { ok: false; erro: string }
function fetchInteiroTeor(url: string, opts?: { tetoBytes?: number; timeoutMs?: number }): Promise<FetchResult>
const TETO_BYTES: number
```

- [ ] **Step 1: Escrever o teste que falha**

Criar `lib/tcu/inteiro-teor-fetch.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchInteiroTeor, TETO_BYTES } from './inteiro-teor-fetch';

const RTF = Buffer.from('{\\rtf1 ok}', 'latin1');

function mockFetch(body: Buffer, init?: { status?: number; headers?: Record<string, string> }) {
  return vi.fn().mockResolvedValue({
    ok: (init?.status ?? 200) < 400,
    status: init?.status ?? 200,
    headers: { get: (h: string) => (init?.headers ?? {})[h.toLowerCase()] ?? null },
    arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
  });
}

describe('fetchInteiroTeor', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('baixa e devolve o buffer', async () => {
    vi.stubGlobal('fetch', mockFetch(RTF));
    const r = await fetchInteiroTeor('https://x/y');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.buf.toString()).toContain('rtf1');
  });

  it('identifica-se com User-Agent do projeto', async () => {
    const f = mockFetch(RTF);
    vi.stubGlobal('fetch', f);
    await fetchInteiroTeor('https://x/y');
    expect(f.mock.calls[0][1].headers['User-Agent']).toContain('SiteDoBarral');
  });

  it('recusa HTTP de erro sem lançar', async () => {
    vi.stubGlobal('fetch', mockFetch(RTF, { status: 404 }));
    const r = await fetchInteiroTeor('https://x/y');
    expect(r).toEqual({ ok: false, erro: 'HTTP 404' });
  });

  it('recusa quem passa do teto ANTES de baixar (content-length)', async () => {
    vi.stubGlobal('fetch', mockFetch(RTF, { headers: { 'content-length': String(TETO_BYTES + 1) } }));
    const r = await fetchInteiroTeor('https://x/y');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain('excede o teto');
  });

  it('recusa quem passa do teto sem declarar content-length', async () => {
    const grande = Buffer.alloc(1024);
    vi.stubGlobal('fetch', mockFetch(grande));
    const r = await fetchInteiroTeor('https://x/y', { tetoBytes: 512 });
    expect(r.ok).toBe(false);
  });

  it('recusa o que não é RTF (magic bytes)', async () => {
    vi.stubGlobal('fetch', mockFetch(Buffer.from('<html>erro</html>')));
    const r = await fetchInteiroTeor('https://x/y');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain('não é RTF');
  });

  it('devolve erro em vez de estourar quando a rede falha', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNRESET')));
    const r = await fetchInteiroTeor('https://x/y');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain('ECONNRESET');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/tcu/inteiro-teor-fetch.test.ts`
Expected: FAIL — `Failed to resolve import "./inteiro-teor-fetch"`

- [ ] **Step 3: Implementar**

Criar `lib/tcu/inteiro-teor-fetch.ts`:

```ts
/**
 * Baixa o inteiro teor do acórdão do TCU.
 *
 * O campo se chama `tcuLinkPDF` mas serve **RTF** — o endpoint é
 * SvlVisualizarRelVotoAcRtf (Relatório, Voto, Acórdão). Medido em 15/07:
 * HTTP 200 em 7 de 8, arquivos de 227 KB a 14,5 MB.
 *
 * Nunca lança: devolve `{ ok: false, erro }`. Um acórdão que falha não pode
 * derrubar o backfill dos outros 1.834 nem quebrar o cron diário.
 */

/** O maior visto no spike tem 14,5 MB. Acima de 20 MB é anomalia. */
export const TETO_BYTES = 20 * 1024 * 1024;
const TIMEOUT_MS = 60_000;

export type FetchResult = { ok: true; buf: Buffer } | { ok: false; erro: string };

export async function fetchInteiroTeor(
  url: string,
  opts?: { tetoBytes?: number; timeoutMs?: number }
): Promise<FetchResult> {
  const teto = opts?.tetoBytes ?? TETO_BYTES;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SiteDoBarral/1.0)' },
      signal: AbortSignal.timeout(opts?.timeoutMs ?? TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false, erro: `HTTP ${res.status}` };

    // Barra o gigante antes de puxar o corpo, quando o servidor declara.
    const len = Number(res.headers.get('content-length') ?? 0);
    if (len > teto) return { ok: false, erro: `excede o teto: ${len} bytes` };

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > teto) return { ok: false, erro: `excede o teto: ${buf.length} bytes` };
    if (!buf.subarray(0, 5).toString('latin1').startsWith('{\\rtf')) {
      return { ok: false, erro: 'não é RTF' };
    }
    return { ok: true, buf };
  } catch (e) {
    return { ok: false, erro: (e as Error).message };
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run lib/tcu/inteiro-teor-fetch.test.ts`
Expected: PASS (7 testes)

- [ ] **Step 5: Commit**

```bash
git add lib/tcu/inteiro-teor-fetch.ts lib/tcu/inteiro-teor-fetch.test.ts
git commit -m "feat(tcu): baixar o inteiro teor (RTF) com teto e sem lançar

O campo se chama tcuLinkPDF mas serve RTF: o endpoint é
SvlVisualizarRelVotoAcRtf. Nunca lança — devolve {ok:false, erro}, para que
um acórdão problemático não derrube o backfill dos outros 1.834 nem quebre o
cron diário.

Teto de 20 MB (o maior do spike tem 14,5 MB), verificado por content-length
antes de puxar o corpo e de novo depois, para quem não declara. Valida magic
bytes: se o TCU devolver HTML de erro com status 200, isso é pego aqui.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Migration

**Files:**
- Modify: `prisma/schema.prisma` (model `Document`, ~linha 44 e ~linha 201)

**Interfaces:**
- Consumes: nada
- Produces: `Document.tcuAnalise Json?`, `Document.leiArticlesDebated String[]`

- [ ] **Step 1: Acrescentar os campos**

Em `prisma/schema.prisma`, no model `Document`, logo abaixo de `leiArticlesCited`:

```prisma
  /// Artigos cujo TEMA é debatido no Voto do acórdão — razão de decidir, não
  /// citação de passagem. Derivado de `tcuAnalise` pelo limiar de
  /// lib/tcu/analise-relevancia.ts (LIMIAR_DEBATIDO); recomputável sem rede.
  /// Hierarquia: leiArticlesDebated > leiArticlesCited > leiArticlesArr.
  leiArticlesDebated String[] @default([])

  /// Contagens da análise do inteiro teor (seções, citações e termos por
  /// seção). Fonte da verdade, SEM veredito — o limiar mora no código.
  /// Formato: TcuAnalise em lib/tcu/analise-relevancia.ts.
  tcuAnalise Json?
```

E no campo `tcuTextoCompleto` (~linha 113), trocar o comentário existente por:

```prisma
  /// ⚠️ NÃO INDEXAR. Este campo NÃO é lido por lib/embeddings/source-text.ts
  /// (que usa [content, tcuEmentaCompleta, description]) e NÃO PODE passar a
  /// ser: indexá-lo somaria ~116k chunks e traria o flooding do top-5 recusado
  /// no design de 2026-07-07. O inteiro teor está aqui para ANÁLISE
  /// (lib/tcu/analise-relevancia.ts), não para retrieval.
  tcuTextoCompleto String? @db.Text
```

- [ ] **Step 2: Acrescentar o índice**

Junto aos outros `@@index` do model `Document` (~linha 201):

```prisma
  @@index([leiArticlesDebated], type: Gin) // idem leiArticlesArr: filtro por artigo
```

- [ ] **Step 3: Aplicar e gerar**

```bash
npx dotenv -e .env.local -- npx prisma db push --schema=prisma/schema.prisma
npx prisma generate
```

Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 4: Verificar que o RAG não enxerga o campo novo**

Esta é a trava do Global Constraint — vale mais que o typecheck.

Run: `grep -n "tcuTextoCompleto\|tcuAnalise\|leiArticlesDebated" lib/embeddings/source-text.ts lib/embeddings/document-processor.ts`
Expected: **nenhuma saída**. Se aparecer algo, PARE — o inteiro teor está prestes a entrar nos embeddings.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): tcuAnalise e leiArticlesDebated

tcuAnalise guarda as contagens cruas da análise do inteiro teor — fonte da
verdade, sem veredito: o limiar mora no código e é recomputável.
leiArticlesDebated é o derivado, com índice GIN para a query, no mesmo padrão
de leiArticlesArr e leiArticlesCited.

Documenta em tcuTextoCompleto que ele NÃO pode ser indexado: source-text.ts
lê [content, tcuEmentaCompleta, description], e incluí-lo somaria ~116k
chunks, trazendo o flooding do top-5 recusado no design de 07/07.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Backfill

**Files:**
- Create: `scripts/backfill-tcu-inteiro-teor.ts`

**Interfaces:**
- Consumes: `fetchInteiroTeor` (T5), `rtfToText` (T1), `analisarAcordao`/`artigosDebatidos`/`ANALISE_VERSAO` (T4)
- Produces: script executável

- [ ] **Step 1: Implementar**

Criar `scripts/backfill-tcu-inteiro-teor.ts`:

```ts
/**
 * Baixa o inteiro teor dos acórdãos do TCU, analisa e persiste.
 *
 * Idempotente e retomável: pula quem já tem `tcuAnalise.v` na versão atual.
 * Um acórdão que falha não interrompe os demais — registra o erro em
 * tcuEnriquecimentoErro e segue.
 *
 * Uso: npx tsx scripts/backfill-tcu-inteiro-teor.ts                # dry-run
 *      npx tsx scripts/backfill-tcu-inteiro-teor.ts --execute
 *      npx tsx scripts/backfill-tcu-inteiro-teor.ts --execute --limit=20
 *      npx tsx scripts/backfill-tcu-inteiro-teor.ts --execute --force
 *
 * Estimativa: ~1.835 acórdãos, ~50 min, ~640 MB de tráfego.
 * Ref.: docs/superpowers/specs/2026-07-15-tcu-inteiro-teor-relevancia-design.md
 */
import { prisma } from '../lib/prisma';
import { fetchInteiroTeor } from '../lib/tcu/inteiro-teor-fetch';
import { rtfToText } from '../lib/tcu/rtf-to-text';
import { analisarAcordao, artigosDebatidos, ANALISE_VERSAO } from '../lib/tcu/analise-relevancia';

const EXECUTE = process.argv.includes('--execute');
const FORCE = process.argv.includes('--force');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;

const CONCORRENCIA = 3;   // mesmo padrão de lib/tcu-scraper.ts:524-527
const DELAY_MS = 1000;    // 1 req/s — o TCU não documenta rate limit
const TETO_CHARS = 500_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Alvo { id: string; title: string; tcuLinkPDF: string | null; leiArticlesArr: string[]; tcuAnalise: unknown }

async function processar(d: Alvo): Promise<'ok' | 'falha' | 'pulado'> {
  const jaFeito = (d.tcuAnalise as { v?: number } | null)?.v === ANALISE_VERSAO;
  if (jaFeito && !FORCE) return 'pulado';

  const r = await fetchInteiroTeor(d.tcuLinkPDF!);
  if (!r.ok) {
    console.log(`   ❌ ${d.title.slice(0, 40)} — ${r.erro}`);
    if (EXECUTE) {
      await prisma.document.update({
        where: { id: d.id },
        data: { tcuEnriquecimentoStatus: 'failed', tcuEnriquecimentoErro: r.erro },
      });
    }
    return 'falha';
  }

  let texto: string;
  try {
    texto = await rtfToText(r.buf);
  } catch (e) {
    const erro = `extração RTF: ${(e as Error).message.slice(0, 80)}`;
    console.log(`   ❌ ${d.title.slice(0, 40)} — ${erro}`);
    if (EXECUTE) {
      await prisma.document.update({
        where: { id: d.id },
        data: { tcuEnriquecimentoStatus: 'failed', tcuEnriquecimentoErro: erro },
      });
    }
    return 'falha';
  }

  const truncado = texto.length > TETO_CHARS;
  const final = truncado ? texto.slice(0, TETO_CHARS) : texto;
  const analise = analisarAcordao(final, d.leiArticlesArr, { truncado });
  const debatidos = artigosDebatidos(analise);

  console.log(
    `   ✅ ${d.title.slice(0, 40)} — ${final.length} chars` +
    `${analise.secoes ? '' : ' (sem seções)'}${truncado ? ' [truncado]' : ''}` +
    `${debatidos.length ? ` → debate: ${debatidos.join(',')}` : ''}`
  );

  if (EXECUTE) {
    await prisma.document.update({
      where: { id: d.id },
      data: {
        tcuTextoCompleto: final,
        tcuAnalise: analise as never,
        leiArticlesDebated: debatidos,
        tcuEnriquecimentoStatus: 'success',
        tcuEnriquecimentoErro: null,
        tcuEnriquecidoEm: new Date(),
      },
    });
  }
  return 'ok';
}

async function main() {
  console.log(EXECUTE ? '🔴 EXECUÇÃO\n' : '🔵 DRY-RUN — nada será gravado (use --execute)\n');

  const alvos = await prisma.document.findMany({
    where: { category: 'acordao', tcuLinkPDF: { not: null } },
    select: { id: true, title: true, tcuLinkPDF: true, leiArticlesArr: true, tcuAnalise: true },
    orderBy: { id: 'asc' },
    ...(LIMIT ? { take: LIMIT } : {}),
  });
  console.log(`Acórdãos com link: ${alvos.length}\n`);

  const t0 = Date.now();
  let ok = 0, falha = 0, pulado = 0;

  for (let i = 0; i < alvos.length; i += CONCORRENCIA) {
    const lote = alvos.slice(i, i + CONCORRENCIA);
    const rs = await Promise.all(lote.map((d) => processar(d as Alvo)));
    for (const r of rs) r === 'ok' ? ok++ : r === 'falha' ? falha++ : pulado++;

    const feitos = i + lote.length;
    const eta = Math.round(((Date.now() - t0) / feitos) * (alvos.length - feitos) / 1000 / 60);
    console.log(`   [${feitos}/${alvos.length}] ok=${ok} falha=${falha} pulado=${pulado} · ETA ~${eta}min`);
    await sleep(DELAY_MS);
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`ok: ${ok} · falha: ${falha} · pulado: ${pulado}`);
  console.log(`tempo: ${Math.round((Date.now() - t0) / 1000 / 60)} min`);
  if (!EXECUTE) console.log('\n🔵 DRY-RUN — nada gravado.');
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
```

- [ ] **Step 2: Dry-run pequeno**

Run: `npx tsx scripts/backfill-tcu-inteiro-teor.ts --limit=5`
Expected: 5 linhas `✅`, `🔵 DRY-RUN — nada gravado.`

- [ ] **Step 3: Confirmar que o dry-run não escreveu**

Run:
```bash
npx tsx -e "import {prisma} from './lib/prisma'; \
prisma.document.count({where:{tcuAnalise:{not:null}}}).then(n=>{console.log('com análise:',n);return prisma.\$disconnect()})"
```
Expected: `com análise: 0`

- [ ] **Step 4: Execução de verdade, em 20, e conferir**

```bash
npx tsx scripts/backfill-tcu-inteiro-teor.ts --execute --limit=20
```
Expected: `ok` ≥ 18 (o spike teve 1 timeout em 8; falha isolada é esperada e não interrompe).

- [ ] **Step 5: Verificar a retomada**

Rodar o mesmo comando de novo.
Expected: `pulado: 20` — não rebaixa nada.

- [ ] **Step 6: Commit**

```bash
git add scripts/backfill-tcu-inteiro-teor.ts
git commit -m "feat(tcu): backfill do inteiro teor

Idempotente e retomável: pula quem já tem tcuAnalise na versão atual, para
não perder 50 minutos por um timeout. Um acórdão que falha registra o erro e
não interrompe os outros 1.834.

tcuEnriquecimentoStatus passa a ser real (success/failed) e
tcuEnriquecimentoErro ganha o primeiro writer: hoje o status é hardcoded
'success' em sync-tcu-acordaos, o que é pior que não ter status.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Backfill completo e golden set

**Files:**
- Create: `docs/audits/2026-07-15-tcu-inteiro-teor-resultados.md`

**Interfaces:**
- Consumes: tudo acima
- Produces: dados em produção + calibração do limiar

- [ ] **Step 1: Rodar o backfill completo**

```bash
npx tsx scripts/backfill-tcu-inteiro-teor.ts --execute 2>&1 | tee /tmp/backfill.log
```
Expected: ~50 min, `ok` ≥ 1.700 de 1.835.

- [ ] **Step 2: Medir o resultado**

```bash
npx tsx -e "import {prisma} from './lib/prisma'; (async()=>{ \
const t=await prisma.document.count({where:{category:'acordao'}}); \
const a=await prisma.document.count({where:{tcuAnalise:{not:null}}}); \
const d=await prisma.document.count({where:{leiArticlesDebated:{has:'5'}}}); \
const c=await prisma.document.count({where:{leiArticlesCited:{has:'5'}}}); \
const v=await prisma.document.count({where:{leiArticlesArr:{has:'5'}}}); \
console.log({acordaos:t,analisados:a,art5_debatido:d,art5_citado:c,art5_vinculado:v}); \
await prisma.\$disconnect()})()"
```

Anotar os números. **Expectativa:** `art5_debatido` bem abaixo de 448 — se vier ≥ 400, o limiar está frouxo e não separa nada; se vier 0, está apertado demais. Qualquer um dos dois extremos significa recalibrar antes de seguir.

- [ ] **Step 3: Golden set — ler 10 acórdãos à mão**

Este passo é do Daniel; sem ele o número é opinião.

```bash
npx tsx -e "import {prisma} from './lib/prisma'; (async()=>{ \
const ds=await prisma.document.findMany({where:{leiArticlesDebated:{has:'5'},category:'acordao'}, \
select:{title:true,url:true,tcuAnalise:true},take:10}); \
for(const d of ds){const a=d.tcuAnalise as any; \
console.log('\n'+d.title+'\n  '+d.url+'\n  termos:',JSON.stringify(a.termos?.['5']));} \
await prisma.\$disconnect()})()"
```

Para cada um: abrir o acórdão, ler o voto, responder **o princípio é razão de decidir?** Comparar com o veredito automático. Anotar acertos e erros.

- [ ] **Step 4: Registrar os resultados**

Criar `docs/audits/2026-07-15-tcu-inteiro-teor-resultados.md` com: números do Step 2, tabela do golden set (acórdão · veredito automático · julgamento do Daniel · acerto?), e a decisão sobre `LIMIAR_DEBATIDO` — manter ou ajustar.

- [ ] **Step 5: Se o limiar mudar, recomputar sem rede**

Só o derivado muda; as contagens no JSON continuam válidas — este é o motivo de guardá-las.

Ajustar `LIMIAR_DEBATIDO` em `lib/tcu/analise-relevancia.ts` e rodar:

```bash
npx tsx -e "import {prisma} from './lib/prisma'; \
import {artigosDebatidos} from './lib/tcu/analise-relevancia'; (async()=>{ \
const ds=await prisma.document.findMany({where:{tcuAnalise:{not:null}},select:{id:true,tcuAnalise:true}}); \
let n=0; for(const d of ds){const a=artigosDebatidos(d.tcuAnalise as any); \
await prisma.document.update({where:{id:d.id},data:{leiArticlesDebated:a}}); if(a.length)n++;} \
console.log('recomputados:',ds.length,'com debate:',n); await prisma.\$disconnect()})()"
```

- [ ] **Step 6: Commit**

```bash
git add docs/audits/2026-07-15-tcu-inteiro-teor-resultados.md lib/tcu/analise-relevancia.ts
git commit -m "docs(tcu): resultados do backfill e calibração do limiar

Golden set de 10 acórdãos lidos à mão contra o veredito automático. Sem esta
comparação o número seria mais uma contagem em que ninguém deveria confiar —
que é o problema que este trabalho existe para resolver.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Fora deste plano

- **UI da hierarquia** (debatido > citado > sugerido por IA) — depende do limiar calibrado na Task 8; entra junto com a **Frente A** (corrigir o backfill de citações para ler só fonte oficial e renomear os rótulos), que tem spec própria.
- **Cron dos acórdãos novos** — depois de o backfill provar a taxa de sucesso.
- **Termos de outros artigos** — a estrutura aceita; popular sob demanda.
- **Outros tribunais** (`TribunalDecision`) — só TCU nesta fase.

## Self-review

**Cobertura do spec:** §4.1 → T1-T5 · §4.2 → T6 · §4.3 → T4 · §4.4 → T1 · §4.5 → T2 · §4.6 → T7 · §5 golden set → T8 · §4.7 cron → fora do plano (declarado).

**Consistência de tipos:** `Secoes` definido em T2 e consumido em T4 · `TcuAnalise` em T4 e usado em T7 · `FetchResult` em T5 e usado em T7 · `ANALISE_VERSAO` em T4, usado em T7 para a retomada.

**Ponto frágil declarado:** `LIMIAR_DEBATIDO` está calibrado em **um** acórdão. A Task 8 existe para corrigir isso, e o Step 5 dela torna a correção barata — recomputa do JSON, sem rede.
