# Probe de destilação de teses do TCU (Fase 2-A) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provar, com uma folha de calibração julgável pelo Daniel, que dá para destilar a *tese* (ratio decidendi) de um leading case do TCU cruzando o próprio acórdão com o uso real nos votos posteriores — com sinais qualitativos e divergências confiáveis.

**Architecture:** Três módulos puros-onde-possível em `lib/tcu/` (recorte de trechos de citação; cliente da API de busca do TCU; destilação via LLM) orquestrados por um script de probe que roda 3 casos e emite JSON; um gerador de folha de calibração (artifact) fecha o ciclo. Nada de schema novo, migração, tela ou importação em escala — isso é um probe GO/NO-GO.

**Tech Stack:** TypeScript, Prisma (Neon), Vitest 4, `lib/ai` (Claude Sonnet 5 via task `enhancement`, `jsonMode`), `tsx`/`dotenv-cli`. Reusa `lib/tcu/acordao-citation-extractor.ts` e `lib/tcu/seccionar-acordao.ts` da Fase 1.

## Global Constraints

- **Branch:** trabalhar em `feat/destilacao-teses-tcu` (já criada; o spec está commitado nela). NÃO commitar na `main` (dispara auto-deploy).
- **Prisma:** import `import { prisma } from '../prisma'` (padrão do projeto; adapter PrismaNeon já configurado). Scripts que tocam banco rodam com `dotenv -e .env.local -- tsx <script>`.
- **LLM:** `import { generate } from '../ai'`. Para Claude (Anthropic), structured output = `jsonMode: true` + prompting (o `responseSchema` é Gemini-only, ignorado pelo Anthropic). Task `'enhancement'` resolve para `claude-sonnet-5`. Parse manual com `JSON.parse(text)`.
- **Módulos puros:** funções `texto → dados` não tocam banco nem rede; o acesso a dados fica em funções separadas no mesmo arquivo. Espelha o padrão de `lib/tcu/extrair-arestas-precedentes.ts` (puro `arestasDeAcordao` vs. `persistirArestasDeAcordao`).
- **Sem persistência:** este probe NÃO grava nada no banco nem cria migração. Só lê `AcordaoCitacao`/`Document` e escreve arquivos em `docs/audits/` e no scratchpad.
- **Idioma:** código, comentários e saídas em português (pt-BR com acentuação correta).

---

## File Structure

- **Create `lib/tcu/trechos-de-citacao.ts`** — recorte de trechos de citação de um alvo. Puro: `recortarTrechos()`, `montarDossie()`. Acesso a dados: `coletarTrechosDoAlvo()`. Tipos `TrechoCitacao`, `DossieUso`.
- **Create `lib/tcu/trechos-de-citacao.test.ts`** — testa `recortarTrechos` e `montarDossie` com fixtures sintéticos.
- **Create `lib/tcu/buscar-acordao-tcu.ts`** — cliente da API de busca do TCU (text/plain). Puros: `parseEntidade()`, `escolherCandidato()`. Rede: `buscarAcordaoPorNumero()`. Tipo `CandidatoAcordao`.
- **Create `lib/tcu/buscar-acordao-tcu.test.ts`** — testa `parseEntidade`/`escolherCandidato` com fixtures.
- **Create `lib/tcu/destilar-tese.ts`** — `montarPromptTese()`, `parseRespostaTese()` (puros) e `destilarTese()` (LLM). Tipos `CasoDestilacao`, `TeseDestilada`.
- **Create `lib/tcu/destilar-tese.test.ts`** — testa `montarPromptTese` e `parseRespostaTese`.
- **Create `scripts/probe-teses-tcu.ts`** — orquestração dos 3 casos + seleção do par concorrente + emissão de `docs/audits/2026-07-19-probe-teses-tcu.json`.
- **Create `scripts/build-folha-teses.mjs`** — gera o HTML da folha de calibração a partir do JSON do probe (rodado no scratchpad; publicado via Artifact).

---

## Task 1: Recorte de trechos de citação (puro)

**Files:**
- Create: `lib/tcu/trechos-de-citacao.ts`
- Test: `lib/tcu/trechos-de-citacao.test.ts`

**Interfaces:**
- Consumes: `extractAcordaoCitations(text): { numero, ano, colegiado, raw, index }[]` de `./acordao-citation-extractor`; `seccionarAcordao(texto): Secoes | null` e `secaoDe(secoes, pos): 'relatorio'|'voto'|'acordao'|null` de `./seccionar-acordao`.
- Produces:
  - `interface TrechoCitacao { origemChave: string; secao: 'relatorio'|'voto'|'acordao'|null; noVoto: boolean; trecho: string; offset: number }`
  - `function recortarTrechos(texto: string, alvo: { numero: number; ano: number }, origemChave: string): TrechoCitacao[]`

- [ ] **Step 1: Write the failing test**

```ts
// lib/tcu/trechos-de-citacao.test.ts
import { describe, it, expect } from 'vitest';
import { recortarTrechos } from './trechos-de-citacao';

const VOTO = 'V O T O';
// Texto sintético com relatório + voto. A citação ao alvo 1441/2016 cai no voto.
const texto =
  'RELATÓRIO\n' +
  'Trata-se de tomada de contas. '.repeat(20) +
  '\n' + VOTO + '\n' +
  'A jurisprudência é firme. Conforme o Acórdão 1441/2016-Plenário, o prazo prescricional das ' +
  'sanções aplicadas pelo Tribunal subordina-se ao prazo geral de cinco anos. ' +
  'Assim, ' + 'segue a fundamentação. '.repeat(10) +
  '\nACÓRDÃO\nVISTOS, os Ministros decidem.';

describe('recortarTrechos', () => {
  it('recorta a janela ao redor da citação e marca noVoto', () => {
    const ts = recortarTrechos(texto, { numero: 1441, ano: 2016 }, '9999/2020');
    expect(ts).toHaveLength(1);
    expect(ts[0].origemChave).toBe('9999/2020');
    expect(ts[0].noVoto).toBe(true);
    expect(ts[0].secao).toBe('voto');
    expect(ts[0].trecho).toContain('prazo prescricional das sanções');
    expect(ts[0].trecho).toContain('Acórdão 1441/2016');
  });

  it('ignora citações a outros acórdãos', () => {
    const ts = recortarTrechos(texto, { numero: 9999, ano: 1999 }, '9999/2020');
    expect(ts).toHaveLength(0);
  });

  it('retorna vazio para texto vazio', () => {
    expect(recortarTrechos('', { numero: 1441, ano: 2016 }, 'x')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/tcu/trechos-de-citacao.test.ts`
Expected: FAIL — "Failed to resolve import" / `recortarTrechos is not a function`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/tcu/trechos-de-citacao.ts
/**
 * Recorta os TRECHOS onde um acórdão-alvo é citado por outros, para alimentar a
 * destilação da tese (Fase 2-A). A aresta (Fase 1) diz QUEM cita e se é no voto;
 * aqui capturamos o CONTEXTO — o que o voto diz ao invocar o precedente. Puro:
 * texto → trechos, sem banco nem rede (espelha arestasDeAcordao).
 */
import { extractAcordaoCitations } from './acordao-citation-extractor';
import { seccionarAcordao, secaoDe } from './seccionar-acordao';

/** Caracteres de contexto de cada lado da citação. */
const JANELA = 400;

export interface TrechoCitacao {
  /** Chave "numero/ano" do acórdão CITANTE (origem). */
  origemChave: string;
  secao: 'relatorio' | 'voto' | 'acordao' | null;
  noVoto: boolean;
  /** Janela de texto ao redor da citação, aparada em fronteira de palavra. */
  trecho: string;
  /** Offset da citação no texto de origem (para depuração). */
  offset: number;
}

/** Apara bordas cortadas no meio de palavra e sinaliza corte com reticências. */
function aparar(bruto: string, cortadoInicio: boolean, cortadoFim: boolean): string {
  let s = bruto;
  if (cortadoInicio) {
    const p = s.indexOf(' ');
    if (p > 0) s = s.slice(p + 1);
    s = '…' + s;
  }
  if (cortadoFim) {
    const p = s.lastIndexOf(' ');
    if (p > 0) s = s.slice(0, p);
    s = s + '…';
  }
  return s.replace(/\s+/g, ' ').trim();
}

export function recortarTrechos(
  texto: string,
  alvo: { numero: number; ano: number },
  origemChave: string
): TrechoCitacao[] {
  if (!texto) return [];
  const secoes = seccionarAcordao(texto);
  const out: TrechoCitacao[] = [];
  for (const c of extractAcordaoCitations(texto)) {
    if (c.numero !== alvo.numero || c.ano !== alvo.ano) continue;
    const ini = Math.max(0, c.index - JANELA);
    const fim = Math.min(texto.length, c.index + c.raw.length + JANELA);
    const trecho = aparar(texto.slice(ini, fim), ini > 0, fim < texto.length);
    const secao = secaoDe(secoes, c.index);
    out.push({ origemChave, secao, noVoto: secao === 'voto', trecho, offset: c.index });
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/tcu/trechos-de-citacao.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/tcu/trechos-de-citacao.ts lib/tcu/trechos-de-citacao.test.ts
git commit -m "feat(tcu): recorte de trechos de citacao (puro) p/ destilacao de teses"
```

---

## Task 2: Dossiê de uso — dedup e priorização (puro)

**Files:**
- Modify: `lib/tcu/trechos-de-citacao.ts`
- Test: `lib/tcu/trechos-de-citacao.test.ts`

**Interfaces:**
- Consumes: `TrechoCitacao` (Task 1).
- Produces:
  - `interface DossieUso { alvo: { numero: number; ano: number }; contagem: { citantesDistintos: number; noVoto: number; ocorrenciasTotal: number }; trechos: TrechoCitacao[] }`
  - `function montarDossie(alvo: { numero: number; ano: number }, trechos: TrechoCitacao[], limite?: number): DossieUso`

**Nota:** `montarDossie` NÃO calcula a contagem fidedigna a partir dos trechos — a contagem vem das arestas do grafo (fonte da verdade da Fase 1) e é injetada por `coletarTrechosDoAlvo` (Task 3-do-banco, na verdade Task 5). Aqui `montarDossie` recebe os trechos já recortados e devolve o dossiê priorizado + a contagem derivada dos próprios trechos como *fallback*; o orquestrador sobrescreve `contagem` com os números do grafo.

- [ ] **Step 1: Write the failing test**

```ts
// adicionar em lib/tcu/trechos-de-citacao.test.ts
import { montarDossie } from './trechos-de-citacao';

describe('montarDossie', () => {
  const t = (origemChave: string, noVoto: boolean, trecho: string): import('./trechos-de-citacao').TrechoCitacao =>
    ({ origemChave, secao: noVoto ? 'voto' : 'relatorio', noVoto, trecho, offset: 0 });

  it('prioriza trechos no voto e conta citantes distintos', () => {
    const d = montarDossie({ numero: 1441, ano: 2016 }, [
      t('1/2020', false, 'menção de rotina no relatório sobre o tema aqui'),
      t('2/2021', true, 'no voto: o prazo prescricional é de cinco anos conforme o precedente'),
      t('2/2021', true, 'no voto: segunda ocorrência no mesmo acórdão citante distinta'),
    ]);
    expect(d.trechos[0].noVoto).toBe(true); // voto vem primeiro
    expect(d.contagem.citantesDistintos).toBe(2); // 1/2020 e 2/2021
    expect(d.contagem.noVoto).toBe(1); // só 2/2021 tem trecho no voto
    expect(d.contagem.ocorrenciasTotal).toBe(3);
  });

  it('deduplica trechos boilerplate quase idênticos', () => {
    const boiler = 'No mesmo sentido, os Acórdãos 1441/2016 e 534/2023, ambos do Plenário.';
    const d = montarDossie({ numero: 1441, ano: 2016 }, [
      t('1/2020', true, boiler),
      t('2/2020', true, boiler + ' '), // idêntico após normalizar
    ]);
    expect(d.trechos).toHaveLength(1);
  });

  it('respeita o limite de trechos', () => {
    const muitos = Array.from({ length: 60 }, (_, i) => t(`${i}/2020`, true, `trecho único número ${i} com conteúdo`));
    const d = montarDossie({ numero: 1441, ano: 2016 }, muitos, 40);
    expect(d.trechos).toHaveLength(40);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/tcu/trechos-de-citacao.test.ts`
Expected: FAIL — `montarDossie is not a function`.

- [ ] **Step 3: Write minimal implementation**

```ts
// adicionar em lib/tcu/trechos-de-citacao.ts
export interface DossieUso {
  alvo: { numero: number; ano: number };
  contagem: { citantesDistintos: number; noVoto: number; ocorrenciasTotal: number };
  trechos: TrechoCitacao[];
}

/** Chave de dedup: miolo normalizado (colapsa espaços, minúsculas, 160 chars). */
function chaveDedup(trecho: string): string {
  return trecho.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 160);
}

export function montarDossie(
  alvo: { numero: number; ano: number },
  trechos: TrechoCitacao[],
  limite = 40
): DossieUso {
  const vistos = new Set<string>();
  const dedup: TrechoCitacao[] = [];
  for (const t of trechos) {
    const k = chaveDedup(t.trecho);
    if (vistos.has(k)) continue;
    vistos.add(k);
    dedup.push(t);
  }
  // Voto primeiro; dentro de cada grupo, trechos mais longos (mais informativos).
  dedup.sort((a, b) => Number(b.noVoto) - Number(a.noVoto) || b.trecho.length - a.trecho.length);

  const citantes = new Set(trechos.map((t) => t.origemChave));
  const citantesVoto = new Set(trechos.filter((t) => t.noVoto).map((t) => t.origemChave));
  return {
    alvo,
    contagem: {
      citantesDistintos: citantes.size,
      noVoto: citantesVoto.size,
      ocorrenciasTotal: trechos.length,
    },
    trechos: dedup.slice(0, limite),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/tcu/trechos-de-citacao.test.ts`
Expected: PASS (6 tests no total).

- [ ] **Step 5: Commit**

```bash
git add lib/tcu/trechos-de-citacao.ts lib/tcu/trechos-de-citacao.test.ts
git commit -m "feat(tcu): montarDossie — dedup, priorizacao por voto e contagem"
```

---

## Task 3: Cliente da API de busca do TCU (text/plain)

**Files:**
- Create: `lib/tcu/buscar-acordao-tcu.ts`
- Test: `lib/tcu/buscar-acordao-tcu.test.ts`

**Interfaces:**
- Produces:
  - `interface CandidatoAcordao { numero: number; ano: number; colegiado: string; relator: string | null; ementa: string; key: string; link: string }`
  - `function parseEntidade(e: { titulo: string; subtitulo?: string; texto?: string; link: string }): CandidatoAcordao | null`
  - `function escolherCandidato(cands: CandidatoAcordao[], colegiadoPreferido?: string): CandidatoAcordao | null`
  - `async function buscarAcordaoPorNumero(numero: number, ano: number): Promise<CandidatoAcordao[]>`

**Correção herdada:** o spec da Fase 2 assumiu `application/json` + `JSON.stringify` no body — isso retorna **HTTP 415**. O formato correto, validado em 2026-07-19, é **`Content-Type: text/plain` com o termo cru `"numero/ano"`**. Link do doc = `https://pesquisa.apps.tcu.gov.br/documento/${key.toLowerCase()}` (ex.: `.../documento/acordao-completo-1286063`, resolve 200).

- [ ] **Step 1: Write the failing test**

```ts
// lib/tcu/buscar-acordao-tcu.test.ts
import { describe, it, expect } from 'vitest';
import { parseEntidade, escolherCandidato } from './buscar-acordao-tcu';

const ent = (titulo: string, subtitulo: string, texto: string, key: string) => ({
  titulo,
  subtitulo,
  texto,
  link: `https://pesquisa.apps.tcu.gov.br/documento/acordao-completo/*/KEY:${key}/NUMACORDAOINT asc/0`,
});

describe('parseEntidade', () => {
  it('extrai numero, ano, colegiado, relator, ementa e key', () => {
    const c = parseEntidade(
      ent('ACÓRDÃO 2622/2013 ATA 37/2013 - PLENÁRIO', 'Relator: Marcos Bemquerer', 'Administrativo. BDI.', 'ACORDAO-COMPLETO-1286063')
    );
    expect(c).not.toBeNull();
    expect(c!.numero).toBe(2622);
    expect(c!.ano).toBe(2013);
    expect(c!.colegiado).toBe('Plenário');
    expect(c!.relator).toBe('Marcos Bemquerer');
    expect(c!.ementa).toBe('Administrativo. BDI.');
    expect(c!.key).toBe('ACORDAO-COMPLETO-1286063');
    expect(c!.link).toBe('https://pesquisa.apps.tcu.gov.br/documento/acordao-completo-1286063');
  });

  it('retorna null quando falta a KEY', () => {
    expect(parseEntidade({ titulo: 'ACÓRDÃO 1/2020 - PLENÁRIO', link: 'https://x/sem-key' })).toBeNull();
  });

  it('normaliza número com ponto de milhar', () => {
    const c = parseEntidade(ent('ACÓRDÃO 11.762/2018 ATA 1/2018 - SEGUNDA CÂMARA', 'Relator: X', 'e', 'ACORDAO-COMPLETO-1'));
    expect(c!.numero).toBe(11762);
    expect(c!.colegiado).toBe('Segunda Câmara');
  });
});

describe('escolherCandidato', () => {
  const mk = (colegiado: string, key: string, titulo = `ACÓRDÃO 2622/2013 - ${colegiado.toUpperCase()}`) =>
    parseEntidade(ent(titulo, 'Relator: X', 'ementa', key))!;

  it('prefere o colegiado indicado quando existe', () => {
    const cands = [mk('Segunda Câmara', 'ACORDAO-COMPLETO-2'), mk('Plenário', 'ACORDAO-COMPLETO-1')];
    expect(escolherCandidato(cands, 'Plenário')!.key).toBe('ACORDAO-COMPLETO-1');
  });

  it('descarta "acórdão de relação" quando há alternativa completa', () => {
    const relacao = parseEntidade(ent('ACÓRDÃO DE RELAÇÃO 2622/2013 - PRIMEIRA CÂMARA', 'Relator: Y', '', 'ACORDAO-COMPLETO-3'))!;
    const completo = mk('Plenário', 'ACORDAO-COMPLETO-1');
    expect(escolherCandidato([relacao, completo])!.key).toBe('ACORDAO-COMPLETO-1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/tcu/buscar-acordao-tcu.test.ts`
Expected: FAIL — import não resolve.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/tcu/buscar-acordao-tcu.ts
/**
 * Cliente da API de busca do TCU — resolve "número de acórdão" em candidatos
 * (metadados + ementa + KEY do inteiro teor). Isolado num módulo só de propósito:
 * a rota do TCU já mudou uma vez, então um conserto futuro fica local.
 *
 * ⚠️ O body é `text/plain` com o termo CRU ("2622/2013"), NÃO application/json —
 * este último retorna HTTP 415 (descoberto em 2026-07-19).
 */
const BUSCA_URL = 'https://pesquisa.apps.tcu.gov.br/api/publico/entidades/busca';
const UA = 'Mozilla/5.0 (compatible; SiteBarral/1.0; +https://profdanielbarral.com)';
const TIMEOUT_MS = 20_000;

export interface CandidatoAcordao {
  numero: number;
  ano: number;
  colegiado: string;
  relator: string | null;
  ementa: string;
  key: string;
  link: string;
}

const TITULO_RE = /(\d[\d.]*)\s*\/\s*(\d{4})(?:\s+ATA\s+\d+\/\d{4})?\s*-\s*(.+)$/i;
const ehRelacao = (s: string) => /ac[óo]rd[ãa]o\s+de\s+rela[çc][ãa]o/i.test(s || '');

function canonColegiado(raw: string): string {
  const s = (raw || '').toLowerCase();
  if (s.includes('plen')) return 'Plenário';
  if (s.includes('primeira') || /\b1[ªa]/.test(s)) return 'Primeira Câmara';
  if (s.includes('segunda') || /\b2[ªa]/.test(s)) return 'Segunda Câmara';
  return (raw || '').trim();
}

export function parseEntidade(e: { titulo: string; subtitulo?: string; texto?: string; link: string }): CandidatoAcordao | null {
  const key = /KEY:(ACORDAO-COMPLETO-\d+)/.exec(e.link || '')?.[1];
  const tm = TITULO_RE.exec(e.titulo || '');
  if (!key || !tm) return null;
  const numero = parseInt(tm[1].replace(/\./g, ''), 10);
  const ano = parseInt(tm[2], 10);
  if (!Number.isFinite(numero) || numero <= 0 || ano < 1990 || ano > 2100) return null;
  return {
    numero,
    ano,
    colegiado: canonColegiado(tm[3]),
    relator: /relator:\s*(.+)$/i.exec(e.subtitulo || '')?.[1]?.trim() || null,
    ementa: (e.texto || '').trim(),
    key,
    link: `https://pesquisa.apps.tcu.gov.br/documento/${key.toLowerCase()}`,
  };
}

export function escolherCandidato(cands: CandidatoAcordao[], colegiadoPreferido?: string): CandidatoAcordao | null {
  if (!cands.length) return null;
  if (colegiadoPreferido) {
    const c = cands.find((x) => x.colegiado === colegiadoPreferido);
    if (c) return c;
  }
  const completos = cands.filter((c) => !ehRelacao(c.colegiado) && !ehRelacao(c.key));
  return (completos[0] ?? cands[0]) || null;
}

export async function buscarAcordaoPorNumero(numero: number, ano: number): Promise<CandidatoAcordao[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(BUSCA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain', Accept: 'application/json', 'User-Agent': UA },
      body: `${numero}/${ano}`,
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error(`Busca TCU ${r.status} ${r.statusText}`);
    const data = (await r.json()) as { entidades?: unknown[] };
    const ents: unknown[] = Array.isArray(data?.entidades) ? data.entidades : [];
    return ents
      .map((e) => parseEntidade(e as { titulo: string; subtitulo?: string; texto?: string; link: string }))
      .filter((c): c is CandidatoAcordao => c !== null)
      .filter((c) => c.numero === numero && c.ano === ano);
  } finally {
    clearTimeout(t);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/tcu/buscar-acordao-tcu.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Smoke real (1 chamada à API)**

Run: `dotenv -e .env.local -- tsx -e "import {buscarAcordaoPorNumero} from './lib/tcu/buscar-acordao-tcu'; (async()=>{const cs=await buscarAcordaoPorNumero(2622,2013); console.log(cs.length, cs[0]?.colegiado, cs[0]?.ementa?.slice(0,60));})()"`
Expected: imprime `≥1`, um colegiado e o início da ementa (ex.: "Administrativo. Conclusão dos Estudos..."). Se vier `0`, revisar o formato do body.

- [ ] **Step 6: Commit**

```bash
git add lib/tcu/buscar-acordao-tcu.ts lib/tcu/buscar-acordao-tcu.test.ts
git commit -m "feat(tcu): cliente da API de busca do TCU (text/plain, resolve numero->candidatos)"
```

---

## Task 4: Destilação da tese via LLM

**Files:**
- Create: `lib/tcu/destilar-tese.ts`
- Test: `lib/tcu/destilar-tese.test.ts`

**Interfaces:**
- Consumes: `DossieUso` de `./trechos-de-citacao`; `generate` de `../ai`.
- Produces:
  - `interface CasoDestilacao { chave: string; ementaPropria: string | null; colegiado: string | null; relator: string | null; dossie: DossieUso }`
  - `interface TeseEnunciado { enunciado: string; inovacao: string; trechosFonte: number[] }`
  - `interface SinalQualitativo { origemChave: string; trecho: string; tipo: string }`
  - `interface Divergencia { origemChave: string; precedenteApontado: string; trecho: string; natureza: string }`
  - `interface TeseDestilada { chave: string; assunto: string; teses: TeseEnunciado[]; sinaisQualitativos: SinalQualitativo[]; divergencias: Divergencia[]; confianca: 'alta' | 'media' | 'baixa' }`
  - `function montarPromptTese(caso: CasoDestilacao): { systemPrompt: string; userContent: string }`
  - `function parseRespostaTese(chave: string, text: string): TeseDestilada`
  - `async function destilarTese(caso: CasoDestilacao): Promise<TeseDestilada>`

- [ ] **Step 1: Write the failing test**

```ts
// lib/tcu/destilar-tese.test.ts
import { describe, it, expect } from 'vitest';
import { montarPromptTese, parseRespostaTese } from './destilar-tese';
import type { CasoDestilacao } from './destilar-tese';

const caso: CasoDestilacao = {
  chave: '1441/2016',
  ementaPropria: 'Incidente de Uniformização de Jurisprudência. Prazo prescricional.',
  colegiado: 'Plenário',
  relator: 'Benjamin Zymler',
  dossie: {
    alvo: { numero: 1441, ano: 2016 },
    contagem: { citantesDistintos: 80, noVoto: 80, ocorrenciasTotal: 120 },
    trechos: [
      { origemChave: '2/2021', secao: 'voto', noVoto: true, trecho: 'Conforme o Acórdão 1441/2016, o prazo é de cinco anos.', offset: 0 },
    ],
  },
};

describe('montarPromptTese', () => {
  it('inclui a ementa própria, os trechos e a instrução conservadora', () => {
    const { systemPrompt, userContent } = montarPromptTese(caso);
    expect(systemPrompt).toMatch(/tese|ratio|precedente/i);
    expect(systemPrompt).toMatch(/n[ãa]o inven|sem apoio|conservador/i); // anti-alucinação
    expect(userContent).toContain('1441/2016');
    expect(userContent).toContain('Prazo prescricional'); // ementa própria
    expect(userContent).toContain('o prazo é de cinco anos'); // trecho de uso
    expect(userContent).toContain('[0]'); // trechos numerados p/ trechosFonte
  });
});

describe('parseRespostaTese', () => {
  it('parseia JSON válido e preenche defaults', () => {
    const text = JSON.stringify({
      assunto: 'Prescrição',
      teses: [{ enunciado: 'Prazo de 5 anos.', inovacao: 'Uniformizou o prazo.', trechosFonte: [0] }],
      sinaisQualitativos: [],
      divergencias: [],
      confianca: 'alta',
    });
    const t = parseRespostaTese('1441/2016', text);
    expect(t.chave).toBe('1441/2016');
    expect(t.assunto).toBe('Prescrição');
    expect(t.teses[0].enunciado).toBe('Prazo de 5 anos.');
    expect(t.confianca).toBe('alta');
  });

  it('tolera cerca de código ```json e campos ausentes', () => {
    const text = '```json\n{"assunto":"X","teses":[]}\n```';
    const t = parseRespostaTese('9/2020', text);
    expect(t.assunto).toBe('X');
    expect(t.teses).toEqual([]);
    expect(t.sinaisQualitativos).toEqual([]);
    expect(t.divergencias).toEqual([]);
    expect(t.confianca).toBe('baixa'); // default quando ausente
  });

  it('lança em JSON irrecuperável', () => {
    expect(() => parseRespostaTese('9/2020', 'desculpe, não consigo')).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/tcu/destilar-tese.test.ts`
Expected: FAIL — imports não resolvem.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/tcu/destilar-tese.ts
/**
 * Destila a TESE (ratio decidendi) de um leading case do TCU cruzando (a) a
 * ementa do próprio acórdão com (b) o dossiê de uso — os trechos onde os votos
 * posteriores o invocam. Também extrai sinais qualitativos (reconhecimento como
 * leading case) e divergências (votos que apontam outro precedente). Motor da
 * Fase 2-A. O prompt é conservador: NÃO inventar tese sem apoio nos trechos.
 */
import { generate } from '../ai';
import type { DossieUso } from './trechos-de-citacao';

export interface CasoDestilacao {
  chave: string;
  ementaPropria: string | null;
  colegiado: string | null;
  relator: string | null;
  dossie: DossieUso;
}
export interface TeseEnunciado { enunciado: string; inovacao: string; trechosFonte: number[] }
export interface SinalQualitativo { origemChave: string; trecho: string; tipo: string }
export interface Divergencia { origemChave: string; precedenteApontado: string; trecho: string; natureza: string }
export interface TeseDestilada {
  chave: string;
  assunto: string;
  teses: TeseEnunciado[];
  sinaisQualitativos: SinalQualitativo[];
  divergencias: Divergencia[];
  confianca: 'alta' | 'media' | 'baixa';
}

const SYSTEM = `Você é um analista de jurisprudência do TCU. Sua tarefa é identificar a TESE
(ratio decidendi) que um acórdão fixou e que passou a orientar votos posteriores — NÃO resumir o caso.

Regras:
- Enuncie a tese em linguagem de súmula: abstrata, aplicável a casos futuros.
- Baseie-se SOBRETUDO em como os votos posteriores invocam o precedente (os trechos numerados).
- Seja CONSERVADOR: se os trechos não sustentam uma tese clara, retorne "teses": [] e explique em "assunto".
  NÃO invente tese, NÃO extrapole além dos trechos. Prefira omitir a alucinar.
- "sinaisQualitativos": só quando um trecho LITERAL trata o precedente como seminal/paradigmático
  ("primeira vez que o Tribunal", "leading case", "precedente paradigmático").
- "divergencias": só quando um trecho aponta OUTRO acórdão como o precedente de referência para o mesmo assunto.
- Cada tese lista em "trechosFonte" os índices [n] dos trechos que a sustentam.

Responda APENAS com JSON, sem texto ao redor, no formato:
{"assunto": string, "teses": [{"enunciado": string, "inovacao": string, "trechosFonte": number[]}],
 "sinaisQualitativos": [{"origemChave": string, "trecho": string, "tipo": string}],
 "divergencias": [{"origemChave": string, "precedenteApontado": string, "trecho": string, "natureza": string}],
 "confianca": "alta"|"media"|"baixa"}`;

export function montarPromptTese(caso: CasoDestilacao): { systemPrompt: string; userContent: string } {
  const trechos = caso.dossie.trechos
    .map((t, i) => `[${i}] (${t.noVoto ? 'VOTO' : t.secao ?? 'outro'}, cita ${caso.chave} em ${t.origemChave}) ${t.trecho}`)
    .join('\n');
  const userContent = [
    `LEADING CASE: Acórdão ${caso.chave}${caso.colegiado ? ' - ' + caso.colegiado : ''}${caso.relator ? ' (Rel. ' + caso.relator + ')' : ''}`,
    `Citado no voto por ${caso.dossie.contagem.noVoto} de ${caso.dossie.contagem.citantesDistintos} acórdãos citantes.`,
    '',
    caso.ementaPropria ? `EMENTA DO PRÓPRIO ACÓRDÃO:\n${caso.ementaPropria}` : 'EMENTA DO PRÓPRIO ACÓRDÃO: (indisponível)',
    '',
    `TRECHOS DE USO NOS VOTOS POSTERIORES (numerados para "trechosFonte"):`,
    trechos || '(nenhum trecho capturado)',
  ].join('\n');
  return { systemPrompt: SYSTEM, userContent };
}

/** Extrai o primeiro objeto JSON de um texto (tolera cercas ```json e prosa). */
function extrairJson(text: string): string {
  const semCerca = text.replace(/```(?:json)?/gi, '').trim();
  const ini = semCerca.indexOf('{');
  const fim = semCerca.lastIndexOf('}');
  if (ini < 0 || fim <= ini) throw new Error('resposta sem JSON reconhecível');
  return semCerca.slice(ini, fim + 1);
}

export function parseRespostaTese(chave: string, text: string): TeseDestilada {
  const raw = JSON.parse(extrairJson(text)) as Partial<TeseDestilada>;
  return {
    chave,
    assunto: typeof raw.assunto === 'string' ? raw.assunto : '',
    teses: Array.isArray(raw.teses) ? raw.teses : [],
    sinaisQualitativos: Array.isArray(raw.sinaisQualitativos) ? raw.sinaisQualitativos : [],
    divergencias: Array.isArray(raw.divergencias) ? raw.divergencias : [],
    confianca: raw.confianca === 'alta' || raw.confianca === 'media' ? raw.confianca : 'baixa',
  };
}

export async function destilarTese(caso: CasoDestilacao): Promise<TeseDestilada> {
  const { systemPrompt, userContent } = montarPromptTese(caso);
  const { text } = await generate('enhancement', {
    systemPrompt,
    messages: [{ role: 'user', content: userContent }],
    jsonMode: true,
    temperature: 0.2,
    maxTokens: 2048,
  });
  if (!text) throw new Error(`destilarTese: resposta vazia para ${caso.chave}`);
  return parseRespostaTese(caso.chave, text);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/tcu/destilar-tese.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/tcu/destilar-tese.ts lib/tcu/destilar-tese.test.ts
git commit -m "feat(tcu): destilacao de tese via LLM (prompt conservador + parse tolerante)"
```

---

## Task 5: Script de orquestração do probe

**Files:**
- Create: `scripts/probe-teses-tcu.ts`
- Modify: `lib/tcu/trechos-de-citacao.ts` (adicionar o acesso a dados `coletarTrechosDoAlvo`)

**Interfaces:**
- Consumes: `recortarTrechos`, `montarDossie`, `DossieUso`, `buscarAcordaoPorNumero`, `escolherCandidato`, `destilarTese`, `prisma`.
- Produces (em `lib/tcu/trechos-de-citacao.ts`):
  - `async function coletarTrechosDoAlvo(alvo: { numero: number; ano: number }): Promise<DossieUso>` — lê `AcordaoCitacao` (arestas do alvo) + `Document.tcuTextoCompleto` dos citantes, aplica `recortarTrechos`, monta o dossiê e **sobrescreve `contagem` com os números do grafo** (fonte da verdade da Fase 1).
- Produces (script): `docs/audits/2026-07-19-probe-teses-tcu.json` com `{ geradoEm, casos: TeseDestilada[], dossies: DossieUso[] }`.

- [ ] **Step 1: Implementar `coletarTrechosDoAlvo` (acesso a dados)**

```ts
// adicionar em lib/tcu/trechos-de-citacao.ts
import { prisma } from '../prisma';

/**
 * Coleta o dossiê de uso de um alvo a partir do grafo: arestas (quem cita) +
 * inteiro teor dos citantes. A CONTAGEM vem das arestas (fonte da verdade da
 * Fase 1), não dos trechos recortados. Toca banco — não é puro.
 */
export async function coletarTrechosDoAlvo(alvo: { numero: number; ano: number }): Promise<DossieUso> {
  const arestas = await prisma.acordaoCitacao.findMany({
    where: { numeroAlvo: alvo.numero, anoAlvo: alvo.ano },
    select: { origemId: true, noVoto: true, ocorrencias: true },
  });
  const docs = await prisma.document.findMany({
    where: { id: { in: arestas.map((a) => a.origemId) } },
    select: { id: true, acordaoNumero: true, acordaoAno: true, tcuTextoCompleto: true },
  });
  const porId = new Map(docs.map((d) => [d.id, d]));
  const trechos: TrechoCitacao[] = [];
  for (const a of arestas) {
    const d = porId.get(a.origemId);
    if (!d?.tcuTextoCompleto) continue;
    const origemChave = d.acordaoNumero && d.acordaoAno ? `${d.acordaoNumero}/${d.acordaoAno}` : d.id;
    trechos.push(...recortarTrechos(d.tcuTextoCompleto, alvo, origemChave));
  }
  const dossie = montarDossie(alvo, trechos);
  // Contagem fidedigna = arestas do grafo (não os trechos recasados).
  dossie.contagem = {
    citantesDistintos: arestas.length,
    noVoto: arestas.filter((a) => a.noVoto).length,
    ocorrenciasTotal: arestas.reduce((s, a) => s + a.ocorrencias, 0),
  };
  return dossie;
}
```

- [ ] **Step 2: Escrever o script de orquestração**

```ts
// scripts/probe-teses-tcu.ts
/**
 * Probe da Fase 2-A: destila a tese de 3 leading cases (2 fixos + 1 par
 * concorrente descoberto no grafo) e emite JSON p/ a folha de calibração.
 * Uso: dotenv -e .env.local -- tsx scripts/probe-teses-tcu.ts
 */
import { writeFileSync } from 'fs';
import { prisma } from '../lib/prisma';
import { coletarTrechosDoAlvo } from '../lib/tcu/trechos-de-citacao';
import { buscarAcordaoPorNumero, escolherCandidato } from '../lib/tcu/buscar-acordao-tcu';
import { destilarTese, type CasoDestilacao, type TeseDestilada } from '../lib/tcu/destilar-tese';
import type { DossieUso } from '../lib/tcu/trechos-de-citacao';

const FIXOS = [{ numero: 1441, ano: 2016 }, { numero: 2622, ano: 2013 }];
const SAIDA = 'docs/audits/2026-07-19-probe-teses-tcu.json';

/** Acha um par de alvos fortes com muitos citantes em comum (candidato a divergência). */
async function descobrirParConcorrente(): Promise<Array<{ numero: number; ano: number }>> {
  // Dois alvos citados no voto por muitos acórdãos, com sobreposição de citantes.
  const topAlvos = await prisma.$queryRaw<Array<{ numeroAlvo: number; anoAlvo: number; n: bigint }>>`
    SELECT "numeroAlvo", "anoAlvo", COUNT(*) AS n
    FROM "AcordaoCitacao" WHERE "noVoto" = true
    GROUP BY "numeroAlvo", "anoAlvo" ORDER BY n DESC LIMIT 15;`;
  // Heurística simples: pega o 3º e 4º mais citados no voto como par (fora dos FIXOS).
  const cands = topAlvos.filter((a) => !FIXOS.some((f) => f.numero === a.numeroAlvo && f.ano === a.anoAlvo));
  return cands.slice(2, 4).map((a) => ({ numero: a.numeroAlvo, ano: a.anoAlvo }));
}

async function montarCaso(alvo: { numero: number; ano: number }): Promise<{ caso: CasoDestilacao; dossie: DossieUso }> {
  const dossie = await coletarTrechosDoAlvo(alvo);
  const cands = await buscarAcordaoPorNumero(alvo.numero, alvo.ano).catch(() => []);
  const escolhido = escolherCandidato(cands); // sem colegiado preferido: usa não-relação / 1º relevante
  const caso: CasoDestilacao = {
    chave: `${alvo.numero}/${alvo.ano}`,
    ementaPropria: escolhido?.ementa ?? null,
    colegiado: escolhido?.colegiado ?? null,
    relator: escolhido?.relator ?? null,
    dossie,
  };
  return { caso, dossie };
}

async function main() {
  const par = await descobrirParConcorrente();
  const alvos = [...FIXOS, ...par];
  console.log('Alvos do probe:', alvos.map((a) => `${a.numero}/${a.ano}`).join(', '));

  const casos: TeseDestilada[] = [];
  const dossies: DossieUso[] = [];
  for (const alvo of alvos) {
    const { caso, dossie } = await montarCaso(alvo);
    console.log(`  ${caso.chave}: ${dossie.contagem.noVoto} no voto, ${dossie.trechos.length} trechos, ementa ${caso.ementaPropria ? 'ok' : 'ausente'}`);
    const t = await destilarTese(caso);
    console.log(`    → ${t.teses.length} tese(s), ${t.sinaisQualitativos.length} sinal(is), ${t.divergencias.length} divergência(s), confiança ${t.confianca}`);
    casos.push(t);
    dossies.push(dossie);
  }

  writeFileSync(SAIDA, JSON.stringify({ geradoEm: '2026-07-19', casos, dossies }, null, 2) + '\n', 'utf8');
  console.log(`\n📄 ${SAIDA}`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
```

- [ ] **Step 3: Rodar o probe**

Run: `dotenv -e .env.local -- tsx scripts/probe-teses-tcu.ts`
Expected: imprime os 4 alvos (2 fixos + par), para cada um a contagem/trechos/ementa e a destilação, e grava `docs/audits/2026-07-19-probe-teses-tcu.json`. Inspecionar o JSON: `1441/2016` deve trazer ≥1 tese sobre prescrição de 5 anos.

- [ ] **Step 4: Commit**

```bash
git add lib/tcu/trechos-de-citacao.ts scripts/probe-teses-tcu.ts docs/audits/2026-07-19-probe-teses-tcu.json
git commit -m "feat(tcu): script do probe de destilacao de teses (3 casos) + saida JSON"
```

---

## Task 6: Folha de calibração (artifact)

**Files:**
- Create: `scripts/build-folha-teses.mjs` (gerador do HTML; rodar no scratchpad)

**Interfaces:**
- Consumes: `docs/audits/2026-07-19-probe-teses-tcu.json` (`{ geradoEm, casos, dossies }`).
- Produces: um HTML de folha de calibração publicado via a ferramenta Artifact.

- [ ] **Step 1: Escrever o gerador da folha**

O gerador lê o JSON do probe e emite um HTML no formato de calibração (card por leading case). Cada card mostra, do mais destacado ao menos: **a(s) tese(s)** (enunciado grande + o que inovou), o **assunto**, o **contador fidedigno** (no voto / citantes), os **trechos-fonte reais** que sustentam cada tese (buscados por índice em `dossies[i].trechos`), os **sinais qualitativos** e as **divergências** (com trecho literal), e um **veredito 3-vias** por card (`tese fiel` / `imprecisa` / `errada`) + por divergência (`procede` / `não procede`), com placar no topo e export do resultado. Reusar o esqueleto da folha de curadoria já feita (`scratchpad/build-sheet.mjs`): mesma paleta petróleo/institucional, temas claro/escuro por token, `localStorage`, dialog de export. Trocar o conteúdo do card de "métricas + ementa" para "tese em destaque + trechos-fonte + sinais + divergências".

Estrutura de dados no cliente (embutida como no build-sheet):
```js
// para cada caso i: { ...casos[i], contagem: dossies[i].contagem,
//   trechosFonte: (idx) => dossies[i].trechos[idx]?.trecho }
```

Regras de conteúdo:
- Tese em destaque com a face serifada (gravidade jurídica), como a `.chave` na folha anterior.
- Se `teses` estiver vazio, o card mostra em destaque "Tese não destilada — apoio insuficiente nos trechos" + o `assunto`, para o Daniel julgar se foi conservadorismo correto ou falha.
- Cada tese lista seus `trechosFonte` como citações reais (não parafraseadas), com a chave do acórdão citante.
- Divergências em bloco próprio, visualmente distinto (borda âmbar), com o precedente apontado e o trecho.

- [ ] **Step 2: Gerar e validar o HTML**

Run: `node scripts/build-folha-teses.mjs` (após copiar o JSON do probe para o scratchpad, ou lendo direto de `docs/audits/`)
Expected: gera `folha-teses-tcu.html`; validar que o JSON embutido parseia e que há um card por caso.

- [ ] **Step 3: Publicar como Artifact**

Publicar `folha-teses-tcu.html` via a ferramenta Artifact (favicon ⚖️, título "Calibração — Teses do TCU (Fase 2-A)"). Entregar a URL ao Daniel para julgamento.

- [ ] **Step 4: Commit do gerador**

```bash
git add scripts/build-folha-teses.mjs
git commit -m "feat(tcu): gerador da folha de calibracao de teses (Fase 2-A)"
```

---

## Definition of Done (probe)

- Os 6 arquivos criados, testes verdes (`npx vitest run lib/tcu/`), smoke da API TCU e uma destilação real OK.
- `docs/audits/2026-07-19-probe-teses-tcu.json` gerado com os 3 casos (2 fixos + par).
- Folha de calibração publicada e entregue ao Daniel.
- **Decisão do Daniel (GO/NO-GO)** registrada: as teses saem fiéis? As divergências procedem? Isso determina se seguimos para o sistema completo (persistência + tela de dois níveis + importação em escala).

## Self-review (feito)

- **Cobertura do spec:** §3 casos → Task 5 (FIXOS + par); §4.1 trechos → Tasks 1-2; §4.3 API TCU → Task 3; §4.4 destilação → Task 4; §4.5 folha → Task 6; §5 critério GO/NO-GO → Definition of Done. Coberto.
- **Placeholders:** nenhum "TBD"; todo passo de código traz o código. Task 6 descreve o gerador por reuso explícito do `build-sheet.mjs` existente (não repete o CSS inteiro, mas aponta o arquivo-fonte e as trocas exatas) — aceitável por ser artifact de scratchpad, não código de produção.
- **Consistência de tipos:** `DossieUso`/`TrechoCitacao`/`TeseDestilada`/`CasoDestilacao` usados igual entre Tasks 1-2-4-5. `montarDossie` (não `montarDossiê`), `coletarTrechosDoAlvo`, `destilarTese`, `parseRespostaTese`, `montarPromptTese` — nomes estáveis.
- **Ambiguidade:** a contagem fidedigna é explicitamente a das arestas do grafo (Task 5), não a dos trechos recasados (`montarDossie` calcula fallback, o orquestrador sobrescreve).
