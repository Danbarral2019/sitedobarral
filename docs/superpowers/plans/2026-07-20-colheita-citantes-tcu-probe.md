# Probe de gate da colheita de citantes do TCU — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Medir se colher os citantes de um leading case magro engorda o dossiê a ponto do motor de destilação produzir uma tese que o Daniel julgue fiel — decidindo GO/NO-GO para a opção C (ampliar a base antes de lançar o sistema de teses).

**Architecture:** Um script de probe orquestra módulos de `lib/tcu/` que já existem, mais dois módulos novos (colheita de citantes e obtenção de inteiro teor por chave). Três portões baratos rodam antes de qualquer LLM e abortam o probe se reprovarem. Nada é escrito no banco: as saídas são JSON em `docs/audits/` e uma folha de calibração HTML publicada como artifact.

**Tech Stack:** TypeScript, tsx, Vitest, Prisma/Neon (somente leitura), API pública do TCU, `lib/ai` (`generate`) com Claude Sonnet 5.

**Spec:** `docs/superpowers/specs/2026-07-20-colheita-citantes-tcu-probe-design.md`

## Global Constraints

- **Nada é persistido no banco.** O probe só lê (`prisma.acordaoCitacao`, `prisma.document`). Toda saída vai para arquivo. Nenhuma migration, nenhum campo novo no schema.
- **Rate limit de 1 requisição por segundo** contra qualquer host do TCU (`pesquisa.apps.tcu.gov.br`, `contas.tcu.gov.br`, `dados-abertos.apps.tcu.gov.br`).
- **Os 3 casos são fixos e não podem ser trocados por escolha:** `2219/2023`, `1009/2018`, `3648/2013`. Reserva, nesta ordem, apenas se houver inviabilidade técnica: `1019/2008`, `11762/2018`, `2012/2022`.
- **Parâmetros de LLM idênticos entre "antes" e "depois":** task `enhancement`, `maxTokens: 4096`, `jsonMode`, **sem passar `temperature`** (o modelo a depreciou; passá-la retorna HTTP 400). Só o conteúdo do dossiê pode variar.
- **`montarDossie` mantém `limite = 40` nos dois lados.** Se a colheita produzir mais de 40 trechos, o teto passa a ser a restrição e isso precisa aparecer no relatório.
- **Scripts rodam com** `npx dotenv-cli -e .env.local -- npx tsx <script>`.
- **Testes** com `npx vitest run <arquivo>`. Nenhum teste pode bater na rede: I/O sempre injetado ou mockado, com fixture gravada.
- **Commits** frequentes, mensagem em português sem acentos no assunto, seguindo o padrão do repo (`feat(tcu):`, `test(tcu):`, `docs(tcu):`).

---

### Task 1: Portão 3 — reconhecimento da rota até o inteiro teor

Spike deliberado, sem TDD: o objetivo é **descobrir** um fato externo, não implementar comportamento. Produz um relatório e a fixture que as tarefas seguintes consomem. É o portão mais provável de reprovar (spec §3.3) e por isso vem primeiro.

**Files:**
- Create: `scripts/spike-rota-inteiro-teor.ts` (descartável, removido na Task 3)
- Create: `docs/audits/2026-07-20-portoes-colheita.json`

- [ ] **Step 1: Escrever o spike**

```typescript
/**
 * Spike do portão 3 (spec §3.3): existe rota para obter o RTF de um acórdão
 * histórico arbitrário? Testa duas rotas candidatas e grava o achado.
 * Descartável — some na Task 3.
 */
import { writeFileSync, mkdirSync } from 'node:fs';

const BUSCA_URL = 'https://pesquisa.apps.tcu.gov.br/api/publico/entidades/busca';
const UA = 'Mozilla/5.0 (compatible; SiteDoBarral/1.0)';
const dorme = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function buscaCrua(termo: string): Promise<Record<string, unknown>> {
  const r = await fetch(BUSCA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain', Accept: 'application/json', 'User-Agent': UA },
    body: termo,
  });
  if (!r.ok) throw new Error(`busca ${r.status} ${r.statusText}`);
  return (await r.json()) as Record<string, unknown>;
}

async function main() {
  const achados: Record<string, unknown> = {};

  // ROTA 1 — o payload da busca traz campo de arquivo/RTF?
  const bruto = await buscaCrua('2219/2023');
  const ents = (bruto.entidades ?? []) as Record<string, unknown>[];
  achados.chavesDoEnvelope = Object.keys(bruto);
  achados.totalEntidades = ents.length;
  achados.chavesDaEntidade = ents[0] ? Object.keys(ents[0]) : [];
  achados.primeiraEntidade = ents[0] ?? null;
  achados.rota1_temCampoArquivo = ents[0]
    ? Object.keys(ents[0]).some((k) => /arquivo|rtf|pdf|download|url/i.test(k))
    : false;
  await dorme(1000);

  // ROTA 2 — a página do documento expõe a URL do RTF?
  const link = (ents[0]?.link as string) ?? '';
  const pagina = link.startsWith('http') ? link : `https://pesquisa.apps.tcu.gov.br${link}`;
  const html = await fetch(pagina, { headers: { 'User-Agent': UA } }).then((r) => r.text());
  const urls = [...html.matchAll(/https?:\/\/[^"'\s<>]*(?:Rtf|Sisdoc)[^"'\s<>]*/gi)].map((m) => m[0]);
  achados.rota2_paginaTestada = pagina;
  achados.rota2_urlsCandidatas = [...new Set(urls)].slice(0, 5);
  achados.rota2_htmlEhSpa = html.length < 5000 || /<div id="root"|__NEXT_DATA__/.test(html);
  await dorme(1000);

  // PORTÃO 1 — paginação: os parâmetros óbvios mudam o resultado?
  const p2 = await fetch(`${BUSCA_URL}?inicio=10&quantidade=10`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain', Accept: 'application/json', 'User-Agent': UA },
    body: '2219/2023',
  }).then((r) => (r.ok ? r.json() : null));
  achados.portao1_paginacaoTestada = 'inicio/quantidade na querystring';
  achados.portao1_totalComOffset = p2 ? ((p2.entidades ?? []) as unknown[]).length : null;
  achados.portao1_primeiroTituloBase = (ents[0]?.titulo as string) ?? null;
  achados.portao1_primeiroTituloOffset = p2 ? (((p2.entidades ?? []) as Record<string, unknown>[])[0]?.titulo ?? null) : null;

  mkdirSync('docs/audits', { recursive: true });
  writeFileSync('docs/audits/2026-07-20-portoes-colheita.json', JSON.stringify(achados, null, 2));
  console.log(JSON.stringify(achados, null, 2));
}

main().catch((e) => {
  console.error('spike falhou:', e);
  process.exit(1);
});
```

- [ ] **Step 2: Rodar o spike**

Run: `npx tsx scripts/spike-rota-inteiro-teor.ts`

Expected: imprime o JSON e grava `docs/audits/2026-07-20-portoes-colheita.json`.

- [ ] **Step 3: Julgar os portões e PARAR se reprovarem**

Ler o JSON e decidir, **sem reinterpretar os limiares da spec**:

- **Portão 3 aprovado** se `rota1_temCampoArquivo === true` **ou** `rota2_urlsCandidatas` tiver ao menos uma URL. Anotar qual rota vence — a Task 3 implementa **essa**.
- **Portão 3 reprovado** se as duas falharem (e `rota2_htmlEhSpa === true` explica o porquê: a página é SPA e o link só aparece via JavaScript). Nesse caso **o probe para aqui**. Reportar ao Daniel: a opção C não tem meio de execução conhecido; a decisão volta a ser A, ou investigar uma terceira rota (ex.: descobrir se `recupera-acordaos` aceita filtro por número/ano) como trabalho separado.
- **Portão 1** (spec §3.1): se `totalEntidades > 20`, aprovado direto. Se `totalEntidades <= 20` e a paginação não mudar o primeiro título (`portao1_primeiroTituloOffset === portao1_primeiroTituloBase`), a busca não pagina — **reprovado**, o probe para.

Se qualquer portão reprovar, criar `docs/audits/2026-07-20-probe-colheita-INTERROMPIDO.md` com o motivo e o JSON, commitar, e encerrar o plano relatando ao Daniel.

- [ ] **Step 4: Commit**

```bash
git add scripts/spike-rota-inteiro-teor.ts docs/audits/2026-07-20-portoes-colheita.json
git commit -m "spike(tcu): reconhecimento da rota ate o inteiro teor e da paginacao da busca"
```

---

### Task 2: `colher-citantes.ts` — dada uma chave, quem cita

**Files:**
- Create: `lib/tcu/colher-citantes.ts`
- Test: `lib/tcu/colher-citantes.test.ts`

**Interfaces:**
- Consumes: o formato de entidade confirmado na Task 1 (`docs/audits/2026-07-20-portoes-colheita.json`, campo `primeiraEntidade`).
- Produces:
  - `export interface Citante { numero: number; ano: number; chave: string; link: string; titulo: string }`
  - `export function parseCitantes(entidades: unknown[], alvo: { numero: number; ano: number }): Citante[]`
  - `export async function colherCitantes(alvo: { numero: number; ano: number }, opts?: { maxPaginas?: number }): Promise<Citante[]>`

**Por que não reusar `buscarAcordaoPorNumero`:** aquela função termina com `.filter((c) => c.numero === numero && c.ano === ano)` — ela devolve o **próprio** acórdão e descarta todas as outras entidades, que são exatamente os citantes que queremos. `parseCitantes` faz o filtro **inverso**.

- [ ] **Step 1: Escrever os testes que falham**

```typescript
import { describe, it, expect } from 'vitest';
import { parseCitantes } from './colher-citantes';

const ent = (titulo: string, link = '/documento/acordao-completo-1') => ({
  titulo, subtitulo: 'Relator: FULANO', texto: 'ementa qualquer', link,
});

describe('parseCitantes', () => {
  it('descarta o proprio alvo e mantem os demais', () => {
    const r = parseCitantes(
      [ent('2219/2023 - Plenário'), ent('4410/2024 - Primeira Câmara'), ent('55/2025 - Plenário')],
      { numero: 2219, ano: 2023 }
    );
    expect(r.map((c) => c.chave)).toEqual(['4410/2024', '55/2025']);
  });

  it('normaliza numero com ponto de milhar', () => {
    const r = parseCitantes([ent('11.762/2018 - Plenário')], { numero: 2219, ano: 2023 });
    expect(r[0]).toMatchObject({ numero: 11762, ano: 2018, chave: '11762/2018' });
  });

  it('ignora entidade com titulo fora do padrao', () => {
    const r = parseCitantes([ent('Relatório de auditoria sem numero')], { numero: 2219, ano: 2023 });
    expect(r).toEqual([]);
  });

  it('deduplica citantes repetidos preservando a ordem', () => {
    const r = parseCitantes(
      [ent('4410/2024 - Plenário'), ent('4410/2024 - Plenário'), ent('7/2020 - Plenário')],
      { numero: 2219, ano: 2023 }
    );
    expect(r.map((c) => c.chave)).toEqual(['4410/2024', '7/2020']);
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx vitest run lib/tcu/colher-citantes.test.ts`
Expected: FAIL — `Failed to resolve import "./colher-citantes"`.

- [ ] **Step 3: Implementar**

```typescript
/**
 * Colhe os CITANTES de um acórdão-alvo pela busca full-text do TCU (spec
 * §1.3). Espelha buscar-acordao-tcu.ts, mas com o filtro INVERTIDO: lá se quer
 * o próprio acórdão, aqui se querem todos os OUTROS — que são quem o cita.
 * Rate limit de 1 req/s é responsabilidade do chamador entre páginas.
 */
const BUSCA_URL = 'https://pesquisa.apps.tcu.gov.br/api/publico/entidades/busca';
const UA = 'Mozilla/5.0 (compatible; SiteDoBarral/1.0)';
const TIMEOUT_MS = 30_000;
const TITULO_RE = /(\d[\d.]*)\s*\/\s*(\d{4})/;

export interface Citante {
  numero: number;
  ano: number;
  chave: string;
  link: string;
  titulo: string;
}

export function parseCitantes(
  entidades: unknown[],
  alvo: { numero: number; ano: number }
): Citante[] {
  const vistos = new Set<string>();
  const out: Citante[] = [];
  for (const bruto of entidades) {
    const e = bruto as { titulo?: string; link?: string };
    const m = TITULO_RE.exec(e?.titulo ?? '');
    if (!m) continue;
    const numero = Number(m[1].replace(/\./g, ''));
    const ano = Number(m[2]);
    if (!Number.isFinite(numero) || !Number.isFinite(ano)) continue;
    if (numero === alvo.numero && ano === alvo.ano) continue; // é o próprio alvo
    const chave = `${numero}/${ano}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    out.push({ numero, ano, chave, link: e?.link ?? '', titulo: e?.titulo ?? '' });
  }
  return out;
}

export async function colherCitantes(
  alvo: { numero: number; ano: number },
  opts?: { maxPaginas?: number }
): Promise<Citante[]> {
  const maxPaginas = opts?.maxPaginas ?? 5;
  const termo = `${alvo.numero}/${alvo.ano}`;
  const acumulado: Citante[] = [];
  const vistos = new Set<string>();

  for (let pagina = 0; pagina < maxPaginas; pagina++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let entidades: unknown[] = [];
    try {
      const url = pagina === 0 ? BUSCA_URL : `${BUSCA_URL}?inicio=${pagina * 10}&quantidade=10`;
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain', Accept: 'application/json', 'User-Agent': UA },
        body: termo,
        signal: ctrl.signal,
      });
      if (!r.ok) break;
      const data = (await r.json()) as { entidades?: unknown[] };
      entidades = Array.isArray(data?.entidades) ? data.entidades : [];
    } finally {
      clearTimeout(t);
    }
    if (entidades.length === 0) break;

    const novos = parseCitantes(entidades, alvo).filter((c) => !vistos.has(c.chave));
    if (novos.length === 0) break; // página repetida: a busca não pagina
    for (const c of novos) {
      vistos.add(c.chave);
      acumulado.push(c);
    }
    await new Promise((r) => setTimeout(r, 1000)); // rate limit 1 req/s
  }
  return acumulado;
}
```

⚠️ Se a Task 1 tiver descoberto que a paginação usa **outros** parâmetros que não `inicio`/`quantidade`, ajustar a linha da `url` para o formato confirmado antes de rodar.

- [ ] **Step 4: Rodar para ver passar**

Run: `npx vitest run lib/tcu/colher-citantes.test.ts`
Expected: PASS — 4 testes.

- [ ] **Step 5: Commit**

```bash
git add lib/tcu/colher-citantes.ts lib/tcu/colher-citantes.test.ts
git commit -m "feat(tcu): colheita de citantes pela busca do TCU (filtro invertido)"
```

---

### Task 3: `inteiro-teor-por-chave.ts` — do citante ao texto

Implementa **a rota aprovada na Task 1**. O código abaixo assume a rota 2 (extrair a URL do RTF da página do documento), que é a mais provável; se a Task 1 aprovou a rota 1 (campo no payload da busca), substituir `extrairUrlRtf` por leitura direta do campo confirmado, mantendo a mesma assinatura pública.

**Files:**
- Create: `lib/tcu/inteiro-teor-por-chave.ts`
- Test: `lib/tcu/inteiro-teor-por-chave.test.ts`
- Delete: `scripts/spike-rota-inteiro-teor.ts`

**Interfaces:**
- Consumes: `Citante` (Task 2); `fetchInteiroTeor(url) => Promise<{ok:true;buf:Buffer}|{ok:false;erro:string}>` e `rtfToText(buf) => Promise<string>`, ambos já existentes.
- Produces:
  - `export function extrairUrlRtf(html: string): string | null`
  - `export async function obterTextoPorLink(link: string): Promise<{ ok: true; texto: string } | { ok: false; erro: string }>`

- [ ] **Step 1: Escrever os testes que falham**

```typescript
import { describe, it, expect } from 'vitest';
import { extrairUrlRtf } from './inteiro-teor-por-chave';

describe('extrairUrlRtf', () => {
  it('acha a URL do endpoint SAGAS', () => {
    const html = `<a href="https://contas.tcu.gov.br/sagas/SvlVisualizarRelVotoAcRtf?codFiltro=SAGAS-SESSAO-ENCERRADA&amp;item0=910941">RTF</a>`;
    expect(extrairUrlRtf(html)).toBe(
      'https://contas.tcu.gov.br/sagas/SvlVisualizarRelVotoAcRtf?codFiltro=SAGAS-SESSAO-ENCERRADA&item0=910941'
    );
  });

  it('acha a URL do endpoint Sisdoc', () => {
    const html = `<a href="https://contas.tcu.gov.br/sisdoc/ObterDocumentoSisdoc?codVersao=editavel&codArqCatalogado=29738595">baixar</a>`;
    expect(extrairUrlRtf(html)).toContain('codArqCatalogado=29738595');
  });

  it('devolve null quando nao ha link de inteiro teor', () => {
    expect(extrairUrlRtf('<html><body><div id="root"></div></body></html>')).toBeNull();
  });

  it('prefere a primeira ocorrencia quando ha varias', () => {
    const html = `<a href="https://contas.tcu.gov.br/sagas/SvlVisualizarRelVotoAcRtf?item0=1">a</a>
                  <a href="https://contas.tcu.gov.br/sagas/SvlVisualizarRelVotoAcRtf?item0=2">b</a>`;
    expect(extrairUrlRtf(html)).toContain('item0=1');
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx vitest run lib/tcu/inteiro-teor-por-chave.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar**

```typescript
/**
 * Resolve o inteiro teor de um acórdão a partir do link do documento na busca
 * do TCU. Necessário porque a URL do RTF depende de um id interno opaco
 * (item0 / codArqCatalogado) que não é derivável de número/ano — ver spec §3.3.
 * Nunca lança: devolve { ok:false, erro }.
 */
import { fetchInteiroTeor } from './inteiro-teor-fetch';
import { rtfToText } from './rtf-to-text';

const UA = 'Mozilla/5.0 (compatible; SiteDoBarral/1.0)';
const RTF_RE = /https?:\/\/[^"'\s<>]*(?:SvlVisualizarRelVotoAcRtf|ObterDocumentoSisdoc)[^"'\s<>]*/i;

export function extrairUrlRtf(html: string): string | null {
  const m = RTF_RE.exec(html ?? '');
  if (!m) return null;
  return m[0].replace(/&amp;/g, '&');
}

export async function obterTextoPorLink(
  link: string
): Promise<{ ok: true; texto: string } | { ok: false; erro: string }> {
  try {
    const pagina = link.startsWith('http') ? link : `https://pesquisa.apps.tcu.gov.br${link}`;
    const res = await fetch(pagina, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return { ok: false, erro: `pagina HTTP ${res.status}` };
    const url = extrairUrlRtf(await res.text());
    if (!url) return { ok: false, erro: 'URL do RTF nao encontrada na pagina' };

    const r = await fetchInteiroTeor(url);
    if (!r.ok) return { ok: false, erro: `download: ${r.erro}` };
    const texto = await rtfToText(r.buf);
    if (!texto || texto.length < 500) return { ok: false, erro: 'texto vazio ou curto demais' };
    return { ok: true, texto };
  } catch (e) {
    return { ok: false, erro: (e as Error).message };
  }
}
```

- [ ] **Step 4: Rodar para ver passar**

Run: `npx vitest run lib/tcu/inteiro-teor-por-chave.test.ts`
Expected: PASS — 4 testes.

- [ ] **Step 5: Provar contra a realidade (uma vez, manual)**

Run:
```bash
npx tsx -e "import('./lib/tcu/colher-citantes').then(async (m) => { const cs = await m.colherCitantes({numero:2219,ano:2023}); console.log('citantes:', cs.length, cs.slice(0,3).map(c=>c.chave)); const t = await import('./lib/tcu/inteiro-teor-por-chave'); const r = await t.obterTextoPorLink(cs[0].link); console.log('texto:', r.ok ? r.texto.length + ' chars' : r.erro); })"
```
Expected: imprime uma contagem de citantes maior que zero e um tamanho de texto na casa das dezenas de milhares de caracteres. Se imprimir erro, **parar** — o portão 3 na verdade não passou, e vale o Step 3 da Task 1.

- [ ] **Step 6: Remover o spike e commitar**

```bash
git rm scripts/spike-rota-inteiro-teor.ts
git add lib/tcu/inteiro-teor-por-chave.ts lib/tcu/inteiro-teor-por-chave.test.ts
git commit -m "feat(tcu): obter inteiro teor pelo link do documento (resolve id opaco do RTF)"
```

---

### Task 4: Portão 2 — taxa de novidade dos citantes

Mede, antes de qualquer LLM, quantos dos citantes colhidos são novos. É o número mais informativo do probe (spec §3.2) e pode encerrá-lo.

**Files:**
- Create: `scripts/probe-colheita-citantes.ts`
- Modify: `docs/audits/2026-07-20-portoes-colheita.json` (acrescenta a seção do portão 2)

**Interfaces:**
- Consumes: `colherCitantes` (Task 2).
- Produces: `export const CASOS: Array<{ numero: number; ano: number }>` e `export async function medirNovidade(): Promise<NovidadePorCaso[]>`, com
  `export interface NovidadePorCaso { chave: string; colhidos: number; novos: number; jaNoAcervo: number }`.

- [ ] **Step 1: Escrever a primeira metade do script**

```typescript
/**
 * Probe de gate da colheita de citantes (spec 2026-07-20). Só lê o banco;
 * escreve em docs/audits/. Rate limit de 1 req/s contra o TCU.
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { prisma } from '../lib/prisma';
import { colherCitantes, type Citante } from '../lib/tcu/colher-citantes';

/** Fixos pela spec §4 — NÃO trocar por escolha. */
export const CASOS = [
  { numero: 2219, ano: 2023 },
  { numero: 1009, ano: 2018 },
  { numero: 3648, ano: 2013 },
];

const AUDIT = 'docs/audits/2026-07-20-portoes-colheita.json';

export interface NovidadePorCaso {
  chave: string;
  colhidos: number;
  novos: number;
  jaNoAcervo: number;
  citantes: Citante[];
}

async function jaNoAcervo(cs: Citante[]): Promise<Set<string>> {
  if (cs.length === 0) return new Set();
  const docs = await prisma.document.findMany({
    where: { OR: cs.map((c) => ({ acordaoNumero: c.numero, acordaoAno: c.ano })) },
    select: { acordaoNumero: true, acordaoAno: true },
  });
  return new Set(docs.map((d) => `${d.acordaoNumero}/${d.acordaoAno}`));
}

export async function medirNovidade(): Promise<NovidadePorCaso[]> {
  const out: NovidadePorCaso[] = [];
  for (const alvo of CASOS) {
    const cs = await colherCitantes(alvo);
    const conhecidos = await jaNoAcervo(cs);
    out.push({
      chave: `${alvo.numero}/${alvo.ano}`,
      colhidos: cs.length,
      novos: cs.filter((c) => !conhecidos.has(c.chave)).length,
      jaNoAcervo: cs.filter((c) => conhecidos.has(c.chave)).length,
      citantes: cs,
    });
  }
  return out;
}

async function main() {
  const novidade = await medirNovidade();
  const colhidos = novidade.reduce((s, n) => s + n.colhidos, 0);
  const novos = novidade.reduce((s, n) => s + n.novos, 0);
  const taxa = colhidos === 0 ? 0 : novos / colhidos;

  mkdirSync('docs/audits', { recursive: true });
  const anterior = existsSync(AUDIT) ? JSON.parse(readFileSync(AUDIT, 'utf8')) : {};
  writeFileSync(
    AUDIT,
    JSON.stringify(
      { ...anterior, portao2: { porCaso: novidade.map(({ citantes, ...r }) => r), colhidos, novos, taxaNovidade: taxa } },
      null,
      2
    )
  );

  console.log(`Portão 2 — colhidos ${colhidos}, novos ${novos}, taxa ${(taxa * 100).toFixed(1)}%`);
  console.log(taxa >= 0.3 ? 'APROVADO (>= 30%)' : 'REPROVADO (< 30%) — o probe para aqui');
  await prisma.$disconnect();
}

if (process.argv[1]?.includes('probe-colheita-citantes')) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
```

- [ ] **Step 2: Rodar**

Run: `npx dotenv-cli -e .env.local -- npx tsx scripts/probe-colheita-citantes.ts`
Expected: uma linha por métrica e o veredito APROVADO/REPROVADO.

- [ ] **Step 3: Julgar o portão 2**

Limiar da spec §3.2: **≥30% de novidade nos 3 casos somados**. Se reprovar, criar `docs/audits/2026-07-20-probe-colheita-INTERROMPIDO.md` com os números, commitar e **encerrar o plano**, relatando ao Daniel que o grafo já está próximo do completo para esses casos e a opção C não tem de onde extrair ganho.

- [ ] **Step 4: Commit**

```bash
git add scripts/probe-colheita-citantes.ts docs/audits/2026-07-20-portoes-colheita.json
git commit -m "feat(tcu): portao 2 do probe — taxa de novidade dos citantes colhidos"
```

---

### Task 5: Baseline "antes" e dossiê engordado "depois"

**Files:**
- Modify: `scripts/probe-colheita-citantes.ts`

**Interfaces:**
- Consumes: `coletarTrechosDoAlvo(alvo) => Promise<DossieUso>`, `recortarTrechos(texto, alvo, origemChave) => TrechoCitacao[]`, `montarDossie(alvo, trechos, limite?) => DossieUso` (todos existentes); `obterTextoPorLink` (Task 3); `medirNovidade` (Task 4).
- Produces: `export async function dossieDepois(alvo, citantes): Promise<{ dossie: DossieUso; falhas: string[] }>`.

**Ponto crítico de método (spec §5.4):** entre "antes" e "depois" só pode mudar o conteúdo do dossiê. Mesmo `limite = 40` nos dois. A contagem do "depois" vem dos trechos recortados, não do grafo — porque os citantes colhidos ainda não estão no grafo.

- [ ] **Step 1: Acrescentar a função ao script**

```typescript
import { coletarTrechosDoAlvo, recortarTrechos, montarDossie, type DossieUso, type TrechoCitacao } from '../lib/tcu/trechos-de-citacao';
import { obterTextoPorLink } from '../lib/tcu/inteiro-teor-por-chave';

const dorme = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Dossiê "depois": trechos do grafo (o que já tínhamos) MAIS os trechos
 * recortados do inteiro teor de cada citante colhido. Mesmo limite do "antes".
 */
export async function dossieDepois(
  alvo: { numero: number; ano: number },
  citantes: Citante[]
): Promise<{ dossie: DossieUso; falhas: string[] }> {
  const base = await coletarTrechosDoAlvo(alvo);
  const trechos: TrechoCitacao[] = [...base.trechos];
  const falhas: string[] = [];

  for (const c of citantes) {
    const r = await obterTextoPorLink(c.link);
    await dorme(1000); // rate limit 1 req/s
    if (!r.ok) {
      falhas.push(`${c.chave}: ${r.erro}`);
      continue;
    }
    trechos.push(...recortarTrechos(r.texto, alvo, c.chave));
  }
  return { dossie: montarDossie(alvo, trechos, 40), falhas };
}
```

- [ ] **Step 2: Escrever o teste da composição**

Create `scripts/probe-colheita-citantes.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { recortarTrechos, montarDossie } from '../lib/tcu/trechos-de-citacao';

describe('composicao do dossie depois', () => {
  it('trechos do citante colhido entram no dossie e contam como voto', () => {
    const texto = [
      'RELATÓRIO',
      'Trata-se de tomada de contas.',
      'VOTO',
      'Adoto como razão de decidir o Acórdão 2219/2023 do Plenário, que fixou a tese aplicável.',
      'ACÓRDÃO',
      'Os Ministros decidem.',
    ].join('\n');
    const trechos = recortarTrechos(texto, { numero: 2219, ano: 2023 }, '4410/2024');
    expect(trechos.length).toBeGreaterThan(0);
    expect(trechos.some((t) => t.noVoto)).toBe(true);

    const d = montarDossie({ numero: 2219, ano: 2023 }, trechos, 40);
    expect(d.contagem.noVoto).toBe(1);
    expect(d.trechos[0].origemChave).toBe('4410/2024');
  });

  it('respeita o teto de 40 trechos', () => {
    const muitos = Array.from({ length: 60 }, (_, i) => ({
      origemChave: `${i}/2024`, secao: 'voto' as const, noVoto: true,
      trecho: `trecho distinto numero ${i} sobre o precedente`, offset: i,
    }));
    expect(montarDossie({ numero: 2219, ano: 2023 }, muitos, 40).trechos).toHaveLength(40);
  });
});
```

- [ ] **Step 3: Rodar o teste**

Run: `npx vitest run scripts/probe-colheita-citantes.test.ts`
Expected: PASS — 2 testes.

- [ ] **Step 4: Commit**

```bash
git add scripts/probe-colheita-citantes.ts scripts/probe-colheita-citantes.test.ts
git commit -m "feat(tcu): dossie antes/depois com controle de variavel (mesmo limite)"
```

---

### Task 6: Destilação dos dois lados e métricas duras

**Files:**
- Modify: `scripts/probe-colheita-citantes.ts`
- Create: `docs/audits/2026-07-20-probe-colheita-citantes.json`

**Interfaces:**
- Consumes: `montarPromptTese(caso) => { systemPrompt, userContent }` e `parseRespostaTese(chave, text) => TeseDestilada` de `lib/tcu/destilar-tese`; `buscarAcordaoPorNumero(numero, ano) => Promise<CandidatoAcordao[]>` e `escolherCandidato(cands) => CandidatoAcordao | null` de `lib/tcu/buscar-acordao-tcu`; `generate` de `lib/ai`.
- Produces: o JSON de resultados consumido pela Task 7.

- [ ] **Step 1: Acrescentar a destilação ao script**

```typescript
import { generate } from '../lib/ai';
import { montarPromptTese, parseRespostaTese, type TeseDestilada } from '../lib/tcu/destilar-tese';
import { buscarAcordaoPorNumero, escolherCandidato } from '../lib/tcu/buscar-acordao-tcu';

/** Idêntico ao da Fase 2-A: sem temperature (depreciada), maxTokens 4096. */
async function destilar(
  alvo: { numero: number; ano: number },
  dossie: DossieUso
): Promise<TeseDestilada> {
  const chave = `${alvo.numero}/${alvo.ano}`;
  const cands = await buscarAcordaoPorNumero(alvo.numero, alvo.ano);
  await dorme(1000);
  const proprio = escolherCandidato(cands);
  const { systemPrompt, userContent } = montarPromptTese({
    chave,
    ementaPropria: proprio?.ementa ?? null,
    colegiado: proprio?.colegiado ?? null,
    relator: proprio?.relator ?? null,
    dossie,
  });
  const { text } = await generate('enhancement', {
    systemPrompt,
    messages: [{ role: 'user', content: userContent }],
    maxTokens: 4096,
    jsonMode: true,
  });
  return parseRespostaTese(chave, text);
}
```

- [ ] **Step 2: Substituir o `main` pelo fluxo completo**

```typescript
async function main() {
  const novidade = await medirNovidade();
  const colhidos = novidade.reduce((s, n) => s + n.colhidos, 0);
  const novos = novidade.reduce((s, n) => s + n.novos, 0);
  const taxa = colhidos === 0 ? 0 : novos / colhidos;
  console.log(`Portão 2 — colhidos ${colhidos}, novos ${novos}, taxa ${(taxa * 100).toFixed(1)}%`);
  if (taxa < 0.3) {
    console.log('REPROVADO (< 30%) — encerrando sem destilar.');
    await prisma.$disconnect();
    return;
  }

  const resultados = [];
  for (const alvo of CASOS) {
    const chave = `${alvo.numero}/${alvo.ano}`;
    console.log(`\n== ${chave} ==`);

    const antesDossie = await coletarTrechosDoAlvo(alvo);
    const antesTese = await destilar(alvo, antesDossie);
    console.log(`antes: ${antesDossie.trechos.length} trechos, ${antesTese.teses.length} teses (${antesTese.confianca})`);

    const cs = novidade.find((n) => n.chave === chave)!.citantes;
    const { dossie: depoisDossie, falhas } = await dossieDepois(alvo, cs);
    const depoisTese = await destilar(alvo, depoisDossie);
    console.log(`depois: ${depoisDossie.trechos.length} trechos, ${depoisTese.teses.length} teses (${depoisTese.confianca})`);

    // Separa ornamental de subamostrado (spec §8.1).
    const votoColhidos = depoisDossie.trechos.filter((t) => t.noVoto && !antesDossie.trechos.some((a) => a.trecho === t.trecho)).length;
    const trechosColhidos = depoisDossie.trechos.length - antesDossie.trechos.length;

    resultados.push({
      chave,
      // trechosDossie é obrigatório: os "trechosFonte" da tese são ÍNDICES para
      // esta lista, e a folha (Task 7) precisa deles para mostrar o trecho-fonte.
      antes: {
        trechos: antesDossie.trechos.length,
        contagem: antesDossie.contagem,
        trechosDossie: antesDossie.trechos.map((t) => t.trecho),
        tese: antesTese,
      },
      depois: {
        trechos: depoisDossie.trechos.length,
        contagem: depoisDossie.contagem,
        trechosDossie: depoisDossie.trechos.map((t) => t.trecho),
        tese: depoisTese,
        falhas,
      },
      diagnostico: {
        citantesColhidos: cs.length,
        trechosAcrescentados: trechosColhidos,
        trechosNoVotoAcrescentados: votoColhidos,
        taxaVotoEntreColhidos: trechosColhidos > 0 ? votoColhidos / trechosColhidos : 0,
        tetoDeQuarentaAtingido: depoisDossie.trechos.length >= 40,
      },
    });
  }

  mkdirSync('docs/audits', { recursive: true });
  writeFileSync(
    'docs/audits/2026-07-20-probe-colheita-citantes.json',
    JSON.stringify({ geradoEm: new Date().toISOString(), portao2: { colhidos, novos, taxaNovidade: taxa }, resultados }, null, 2)
  );
  console.log('\nGravado docs/audits/2026-07-20-probe-colheita-citantes.json');
  await prisma.$disconnect();
}
```

- [ ] **Step 3: Rodar o probe de verdade**

Run: `npx dotenv-cli -e .env.local -- npx tsx scripts/probe-colheita-citantes.ts`
Expected: para cada um dos 3 casos, duas linhas (antes/depois) com contagem de trechos, teses e confiança; ao final, o JSON gravado. Custa 6 chamadas de LLM.

- [ ] **Step 4: Conferir o diagnóstico ornamental vs. subamostrado**

Ler `diagnostico.taxaVotoEntreColhidos` de cada caso. Se a colheita trouxe trechos mas quase nenhum no voto, o caso é **ornamental** e não subamostrado (spec §8.1) — isso precisa constar do relatório final, porque leva a conclusão oposta sobre a opção C. Anotar também `tetoDeQuarentaAtingido`: se verdadeiro, o teto virou a restrição.

- [ ] **Step 5: Commit**

```bash
git add scripts/probe-colheita-citantes.ts docs/audits/2026-07-20-probe-colheita-citantes.json
git commit -m "feat(tcu): destilacao antes/depois e metricas de diagnostico do probe"
```

---

### Task 7: Folha de calibração cega

**Files:**
- Create: `scripts/build-folha-colheita.mjs`
- Create: `docs/audits/2026-07-20-folha-colheita-gabarito.json`

**Interfaces:**
- Consumes: `docs/audits/2026-07-20-probe-colheita-citantes.json` (Task 6).
- Produces: um HTML no scratchpad para publicar via Artifact, e o gabarito card→origem.

**Requisito central (spec §6):** os cards de "antes" e "depois" saem **embaralhados e sem rótulo de origem**, com semente fixa registrada. O Daniel julga fiel/imprecisa/errada em termos absolutos; a revelação só ocorre depois do export.

- [ ] **Step 1: Escrever o gerador**

```javascript
/**
 * Gera a folha de calibração CEGA do probe de colheita (spec §6): cards de
 * "antes" e "depois" embaralhados, sem rótulo de origem. Semente fixa para
 * que o gabarito card→origem seja reconstituível.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const SEMENTE = 20260720; // fixa e registrada — nao trocar
const IN = 'docs/audits/2026-07-20-probe-colheita-citantes.json';
const OUT_HTML = process.argv[2] || 'folha-colheita.html';
const OUT_GABARITO = 'docs/audits/2026-07-20-folha-colheita-gabarito.json';

/** PRNG determinístico (mulberry32) — Math.random nao serve, precisa ser reproduzivel. */
function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function embaralhar(arr, seed) {
  const r = rng(seed), a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
/** Evita que "</script>" dentro do JSON feche a tag (residuo herdado da Fase 2-A). */
const jsonSeguro = (o) => JSON.stringify(o).replace(/</g, '\\u003c');

const dados = JSON.parse(readFileSync(IN, 'utf8'));

const cards = [];
for (const r of dados.resultados) {
  for (const origem of ['antes', 'depois']) {
    for (const [i, t] of (r[origem].tese.teses || []).entries()) {
      // trechosFonte sao INDICES para r[origem].trechosDossie (gravado na Task 6).
      const trechos = (t.trechosFonte || []).map((n) => r[origem].trechosDossie?.[n] ?? '').filter(Boolean);
      cards.push({
        id: `${r.chave}-${origem}-${i}`,
        caso: r.chave,
        origem, // NAO vai para o HTML
        enunciado: t.enunciado,
        inovacao: t.inovacao,
        trechos,
      });
    }
  }
}

const ordem = embaralhar(cards, SEMENTE);
writeFileSync(OUT_GABARITO, JSON.stringify({ semente: SEMENTE, gabarito: ordem.map((c, i) => ({ posicao: i + 1, id: c.id, caso: c.caso, origem: c.origem })) }, null, 2));

const publico = ordem.map((c, i) => ({ n: i + 1, id: c.id, caso: c.caso, enunciado: c.enunciado, inovacao: c.inovacao, trechos: c.trechos }));

const html = `<title>Calibração cega — Colheita de citantes (probe do gate C)</title>
<style>
:root{--bg:#fff;--fg:#1a1a1a;--mut:#666;--line:#e3e3e3;--card:#fafafa}
@media (prefers-color-scheme:dark){:root{--bg:#151515;--fg:#ededed;--mut:#a0a0a0;--line:#2e2e2e;--card:#1e1e1e}}
:root[data-theme=dark]{--bg:#151515;--fg:#ededed;--mut:#a0a0a0;--line:#2e2e2e;--card:#1e1e1e}
:root[data-theme=light]{--bg:#fff;--fg:#1a1a1a;--mut:#666;--line:#e3e3e3;--card:#fafafa}
body{background:var(--bg);color:var(--fg);font:16px/1.6 Georgia,serif;max-width:52rem;margin:0 auto;padding:2rem 1.25rem}
h1{font-size:1.5rem;line-height:1.3}.aviso{border-left:3px solid #b8860b;padding:.6rem 1rem;background:var(--card);font-size:.94rem}
.card{border:1px solid var(--line);border-radius:8px;padding:1.1rem 1.25rem;margin:1.5rem 0;background:var(--card)}
.n{color:var(--mut);font-size:.8rem;letter-spacing:.06em;text-transform:uppercase}
.tese{font-size:1.12rem;font-weight:600;margin:.5rem 0 .75rem}
.tr{border-left:2px solid var(--line);padding-left:.9rem;color:var(--mut);font-size:.9rem;margin:.5rem 0}
.vs{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.9rem}
.vs label{border:1px solid var(--line);border-radius:999px;padding:.3rem .85rem;cursor:pointer;font-family:system-ui;font-size:.87rem}
.vs input{margin-right:.35rem}
button{font:inherit;padding:.6rem 1.2rem;border-radius:6px;border:1px solid var(--line);background:var(--card);color:var(--fg);cursor:pointer}
pre{white-space:pre-wrap;background:var(--card);padding:1rem;border-radius:6px;font-size:.85rem;overflow-x:auto}
</style>
<h1>Calibração cega — teses do probe de colheita</h1>
<p class="aviso"><strong>Julgamento cego.</strong> Os cards abaixo vêm de dois dossiês diferentes — o atual e o engordado pela colheita de citantes — <strong>embaralhados e sem identificação</strong>. Julgue cada tese em termos absolutos: ela é fiel ao que o acórdão fixou? A origem de cada card só é revelada depois que você exportar.</p>
<div id="cards"></div>
<button onclick="exportar()">Exportar vereditos</button>
<pre id="saida"></pre>
<script>
const CARDS = ${jsonSeguro(publico)};
document.getElementById('cards').innerHTML = CARDS.map(c => \`
<div class="card">
  <div class="n">Card \${c.n} · Acórdão \${c.caso}</div>
  <div class="tese">\${c.enunciado}</div>
  <div style="font-size:.92rem;color:var(--mut)"><em>Inovação:</em> \${c.inovacao}</div>
  \${c.trechos.map(t => '<div class="tr">' + t + '</div>').join('')}
  <div class="vs">
    <label><input type="radio" name="v\${c.n}" value="fiel">fiel</label>
    <label><input type="radio" name="v\${c.n}" value="imprecisa">imprecisa</label>
    <label><input type="radio" name="v\${c.n}" value="errada">errada</label>
  </div>
</div>\`).join('');
function exportar(){
  const linhas = CARDS.map(c => {
    const s = document.querySelector('input[name="v'+c.n+'"]:checked');
    return 'Card ' + c.n + ' (' + c.id + '): ' + (s ? s.value : 'SEM VEREDITO');
  });
  document.getElementById('saida').textContent =
    'CALIBRACAO CEGA — COLHEITA DE CITANTES\\n\\n' + linhas.join('\\n');
}
</script>`;

writeFileSync(OUT_HTML, html);
console.log(`Folha: ${OUT_HTML} (${publico.length} cards) · Gabarito: ${OUT_GABARITO}`);
```

- [ ] **Step 2: Gerar a folha**

Run:
```bash
node scripts/build-folha-colheita.mjs "C:/Users/User/AppData/Local/Temp/claude/C--Users-User/df3dbf05-21b6-444d-9765-e3cf69a4b878/scratchpad/folha-colheita.html"
```
Expected: imprime a contagem de cards e o caminho do gabarito.

- [ ] **Step 3: Conferir que o HTML não vaza a origem**

Run: `grep -c "antes\|depois" "C:/Users/User/AppData/Local/Temp/claude/C--Users-User/df3dbf05-21b6-444d-9765-e3cf69a4b878/scratchpad/folha-colheita.html"`
Expected: as únicas ocorrências devem estar no texto do aviso. Se um `id` de card vazar a palavra, trocar o `id` público por um hash antes de publicar — **o cegamento é o requisito central da tarefa**.

- [ ] **Step 4: Publicar como artifact**

Publicar o HTML via a ferramenta Artifact, com favicon `⚖️` e descrição "Julgamento cego das teses do probe de colheita de citantes do TCU". Guardar a URL.

- [ ] **Step 5: Commit**

```bash
git add scripts/build-folha-colheita.mjs docs/audits/2026-07-20-folha-colheita-gabarito.json
git commit -m "feat(tcu): folha de calibracao cega do probe de colheita"
```

---

### Task 8: Revelação e veredito

**Files:**
- Create: `docs/audits/2026-07-20-probe-colheita-RESULTADOS.md`

- [ ] **Step 1: Cruzar vereditos com o gabarito**

Com o texto exportado pelo Daniel, casar cada card com sua origem em `docs/audits/2026-07-20-folha-colheita-gabarito.json` e montar a tabela: por caso, quantas teses fiéis no "antes" e quantas no "depois".

- [ ] **Step 2: Aplicar o critério de GO literalmente**

Critério da spec §9, sem reinterpretação:
- **GO para a opção C:** em **≥2 dos 3 casos**, o "depois" produz ao menos uma tese julgada **fiel** onde o "antes" não produzia nenhuma tese fiel.
- **NO-GO:** não melhora; **ou** melhora produzindo teses julgadas imprecisa/errada.
- **1 de 3 não é GO.** Reportar como intermediário, com o diagnóstico de §8.1, e devolver a decisão ao Daniel.

- [ ] **Step 3: Escrever o relatório**

`docs/audits/2026-07-20-probe-colheita-RESULTADOS.md` contendo: resultado dos 3 portões com os números; tabela antes/depois por caso; vereditos do Daniel casados com a origem; **o diagnóstico ornamental vs. subamostrado por caso** (spec §8.1); o veredito GO/NO-GO; e o que o probe explicitamente **não** responde (spec §10 — a cauda profunda, o custo de escalar, a decisão de indexar como `Document`).

- [ ] **Step 4: Commit e abrir PR**

```bash
git add docs/audits/2026-07-20-probe-colheita-RESULTADOS.md
git commit -m "docs(tcu): resultados do probe de colheita de citantes e veredito GO/NO-GO"
git push -u origin feat/probe-colheita-citantes-tcu
```

Abrir PR com título "Probe de gate da colheita de citantes do TCU (Fase 2-B, opção C)" e corpo resumindo portões, resultado e veredito.

---

## Notas de execução

- **Os portões são de parada real.** Reprovou, o probe encerra e reporta — não se "ajusta o limiar para ver se passa". Reinterpretar limiar depois de ver o resultado destrói o valor do experimento e é exatamente o que a spec trava.
- **O motor não muda.** Nenhuma tarefa altera `destilar-tese.ts` — nem prompt, nem parâmetros. Se o "depois" for pior, isso é o achado (spec §8.2), não um bug a corrigir.
- **O ruído da busca full-text se resolve sozinho** (spec §8.3): um documento que contenha "2219/2023" por outro motivo simplesmente rende zero trechos, porque `recortarTrechos` roda `extractAcordaoCitations` e filtra por `numero`/`ano` do alvo — a mesma extração do grafo, com 0 falso positivo medido na Fase 0. Não é preciso filtro extra.
- **Os follow-ups técnicos da Fase 2-A não entram aqui** (validação de elementos de array em `parseRespostaTese`, teste de limite de `montarDossie`). São trabalho separado; o `</script>` já vai tratado na Task 7 por ser código novo.
