# Rede de Precedentes do TCU — Fase 2 (Importar leading cases) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. **Task 1 é um probe de investigação com um GATE** — o resultado dele decide detalhes das Tasks 3-4; leia-o antes de seguir.

**Goal:** Importar os leading cases ausentes da wishlist para o acervo (Nível 1 = ementa, garantido → busca; Nível 2 = inteiro teor quando o RTF resolver → razão de decidir), com curadoria semi-automática.

**Architecture:** Um cliente isolado da API de busca do TCU (`buscar-acordao-tcu.ts`) resolve número→candidatos; uma função de importação (`importar-acordao.ts`) cria o `Document` idempotente; um script varre a wishlist. A indexação e a catalogação do inteiro teor reusam o pipeline existente (embeddings + `catalog-tcu-inteiro-teor` + `sync-precedentes-tcu`). Nada em produção é tocado.

**Tech Stack:** TypeScript, `tsx`, Vitest 4, Prisma 7 (Neon), fetch (API pública do TCU).

## Global Constraints

- **Aditivo:** cria `Document`s novos (`category='acordao'`). NÃO altera `sync-tcu-acordaos`, `catalogar-acordao`, nem o schema. Idempotente pela unique existente `(acordaoNumero, acordaoAno, tcuOrgaoJulgador)` — reimportar nunca duplica.
- **Cliente da API isolado** num único módulo (`lib/tcu/buscar-acordao-tcu.ts`) — a rota BFF já mudou uma vez; um conserto futuro deve ser local.
- **Rate-limit 1 req/s** ao TCU (padrão do projeto). Importação é lote pontual + manutenção leve, não scraping massivo.
- **Curadoria semi-automática:** o script gera a lista candidata (da wishlist rankeada); o Daniel marca as aprovadas; o importador roda sobre elas. Decisões de produto fixadas no spec §4-6.
- **Nível 1 sempre; Nível 2 quando o RTF resolver.** Sem inteiro teor, o acórdão ainda entra na busca via `tcuEmentaCompleta` (≥50 chars).
- **Seguir o `document-inclusion-workflow`** (regra do projeto — [[document-inclusion-workflow]]): (1) validar existência antes de inserir — aqui a busca BFF encontrar o candidato JÁ é a validação (se não encontra, não importa); (2) campos obrigatórios do Document: `title`, `category`, `isPublic:true`, `reviewed:true`, `isCommon:true`; (3) **indexar embeddings** após inserir (`migrate-to-embeddings`), senão o doc não aparece na busca IA; (4) verificação pós-inserção (recuperável na busca). *Nota: a lista de categorias da memória (71 dias) está desatualizada — `acordao` é a categoria correta para acórdãos do TCU, confirmada pelo `sync-tcu-acordaos` atual.*
- **Regra dura do projeto:** NUNCA excluir documentos sem pedido explícito. A importação é aditiva; qualquer remoção é decisão à parte do Daniel.
- Comentários e commits em português. Testes Vitest co-localizados.
- Spec: `docs/superpowers/specs/2026-07-18-rede-precedentes-tcu-fase2-importar-design.md`.

---

### Task 1: Fase 2.0 — probe técnico (URL do RTF + desambiguação) — GATE

**Files:** nenhum de código; produz `docs/audits/2026-07-18-probe-tecnico-fase2.md` (achados).

**Objetivo:** fechar as duas incógnitas antes de construir o importador. Investigação R$0.

- [ ] **Step 1: Mapear KEY → URL do RTF (3 abordagens, em ordem de custo)**

**(a) Comparar com um acórdão que já temos (offline, tenta primeiro).** Pegar um `Document` do acervo que já tenha `tcuLinkPDF` e extrair o `item0` da URL SAGAS. Buscar esse mesmo acórdão na BFF e comparar o KEY (`ACORDAO-COMPLETO-NNNN`) com o `item0`. Se forem iguais (ou houver relação óbvia), a URL do RTF se constrói do KEY sem mais nada.
```bash
npx tsx -e "import {prisma} from './lib/prisma'; (async()=>{const d=await prisma.document.findFirst({where:{category:'acordao',tcuLinkPDF:{contains:'item0'}},select:{tcuNumeroAcordao:true,tcuOrgaoJulgador:true,tcuLinkPDF:true}}); console.log(d); await prisma.\$disconnect();})()"
```
Depois buscar esse número na BFF (via o cliente da Task 2, ou um fetch manual) e comparar KEY vs item0. Registrar o resultado.

**(b) Interceptar o clique de Download (navegador).** Se (a) não resolver: abrir a página do documento pela busca (navegação client-side para preservar o interceptor de fetch/XHR), instrumentar, clicar em "Download" e capturar a URL do arquivo. (Não baixar em disco — só ler a URL da network request.)

**(c) Fallback documentado.** Se nem (a) nem (b) derem a URL do RTF de forma confiável: registrar que o Nível 2 usará a extração do `innerText` da página do documento renderizada (headless), e tratar isso como um follow-up — o Nível 1 (ementa) segue sem depender disso.

- [ ] **Step 2: Validar a desambiguação**

Buscar 2-3 números da wishlist (ex.: 2622/2013, 1441/2016) e confirmar o critério do spec §5: preferir "acórdão-completo" sobre "acórdão de relação"; casar colegiado quando a citação o trouxe; senão 1º por relevância. Anotar quantos casos são ambíguos de verdade.

- [ ] **Step 3: Registrar o GATE**

Escrever `docs/audits/2026-07-18-probe-tecnico-fase2.md` com: a URL do RTF resolve? (sim via KEY / sim via download / não → fallback); a desambiguação é confiável? Decidir se o importador nasce com Nível 2 automático (RTF via KEY) ou só Nível 1 + Nível 2 como follow-up. **Commitar o relatório.** As Tasks 3-4 leem esta decisão.

---

### Task 2: Cliente da API de busca do TCU

**Files:**
- Create: `lib/tcu/buscar-acordao-tcu.ts`
- Test: `lib/tcu/buscar-acordao-tcu.test.ts`

**Interfaces:**
- Produces:
  - `interface CandidatoAcordao { numero: number; ano: number; ata: string | null; colegiado: string; relator: string | null; ementa: string; key: string; link: string }`
  - `function parseEntidade(e: { titulo: string; subtitulo?: string; texto?: string; link: string }): CandidatoAcordao | null` (puro — testável com fixtures)
  - `function escolherCandidato(cands: CandidatoAcordao[], colegiadoPreferido?: string): CandidatoAcordao | null` (puro — desambiguação do spec §5)
  - `async function buscarAcordaoPorNumero(numero: number, ano: number): Promise<CandidatoAcordao[]>` (I/O — POST à BFF, parseia)

- [ ] **Step 1: Escrever os testes do parse e da desambiguação (puros, com fixtures reais)**

Criar `lib/tcu/buscar-acordao-tcu.test.ts`. Fixtures das entidades reais capturadas no probe:

```ts
import { describe, it, expect } from 'vitest';
import { parseEntidade, escolherCandidato } from './buscar-acordao-tcu';

const ent = (titulo: string, link: string, subtitulo = 'Relator: Marcos Bemquerer', texto = 'Administrativo. Ementa...') =>
  ({ titulo, subtitulo, texto, link });

describe('parseEntidade', () => {
  it('extrai número, ano, ata, colegiado, relator e KEY', () => {
    const c = parseEntidade(ent(
      'ACÓRDÃO 2622/2013 ATA 37/2013 - PLENÁRIO',
      'https://pesquisa.apps.tcu.gov.br/documento/acordao-completo/*/KEY:ACORDAO-COMPLETO-1286063/NUMACORDAOINT asc/0'
    ));
    expect(c).toMatchObject({ numero: 2622, ano: 2013, ata: '37/2013', colegiado: 'Plenário', relator: 'Marcos Bemquerer', key: 'ACORDAO-COMPLETO-1286063' });
  });

  it('reconhece Segunda Câmara', () => {
    const c = parseEntidade(ent('ACÓRDÃO 2622/2013 ATA 15/2013 - SEGUNDA CÂMARA', 'x/KEY:ACORDAO-COMPLETO-1270628/y'));
    expect(c?.colegiado).toBe('Segunda Câmara');
  });

  it('descarta entidade sem KEY ou sem número', () => {
    expect(parseEntidade(ent('Informativo de Jurisprudência', 'https://x/sem-key'))).toBeNull();
  });
});

describe('escolherCandidato', () => {
  const plenario = parseEntidade(ent('ACÓRDÃO 2622/2013 ATA 37/2013 - PLENÁRIO', 'x/KEY:ACORDAO-COMPLETO-1286063/y'))!;
  const camara = parseEntidade(ent('ACÓRDÃO 2622/2013 ATA 15/2013 - SEGUNDA CÂMARA', 'x/KEY:ACORDAO-COMPLETO-1270628/y'))!;
  const relacao = parseEntidade(ent('ACÓRDÃO DE RELAÇÃO 2622/2013 ATA 14/2013 - PRIMEIRA CÂMARA', 'x/KEY:ACORDAO-COMPLETO-9/y'))!;

  it('casa pelo colegiado preferido quando informado', () => {
    expect(escolherCandidato([plenario, camara], 'Segunda Câmara')?.key).toBe('ACORDAO-COMPLETO-1270628');
  });
  it('sem preferência, prefere acórdão-completo sobre acórdão de relação e mantém a ordem (relevância)', () => {
    expect(escolherCandidato([relacao, plenario])?.key).toBe('ACORDAO-COMPLETO-1286063');
  });
  it('devolve null para lista vazia', () => {
    expect(escolherCandidato([])).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/tcu/buscar-acordao-tcu.test.ts`
Expected: FAIL — import não resolve.

- [ ] **Step 3: Implementar o módulo**

Criar `lib/tcu/buscar-acordao-tcu.ts`:

```ts
/**
 * Cliente da API de busca do TCU — resolve "número de acórdão" em candidatos
 * (metadados + ementa + KEY do inteiro teor). Isolado num módulo só de propósito:
 * a rota do TCU já mudou uma vez (a antiga `relevar-busca-bff` quebrou), então um
 * conserto futuro fica local. Rota atual descoberta no probe de 18/07.
 */
const BUSCA_URL = 'https://pesquisa.apps.tcu.gov.br/api/publico/entidades/busca';
const UA = 'Mozilla/5.0 (compatible; SiteBarral/1.0; +https://profdanielbarral.com)';
const TIMEOUT_MS = 20_000;

export interface CandidatoAcordao {
  numero: number;
  ano: number;
  ata: string | null;
  colegiado: string;
  relator: string | null;
  ementa: string;
  key: string;
  link: string;
}

/** "ACÓRDÃO 2622/2013 ATA 37/2013 - PLENÁRIO" → nº, ano, ata, colegiado. */
const TITULO_RE = /(\d[\d.]*)\s*\/\s*(\d{4})(?:\s+ATA\s+(\d+\/\d{4}))?\s*-\s*(.+)$/i;

function canonColegiado(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes('plen')) return 'Plenário';
  if (s.includes('primeira') || /\b1[ªa]/.test(s)) return 'Primeira Câmara';
  if (s.includes('segunda') || /\b2[ªa]/.test(s)) return 'Segunda Câmara';
  return raw.trim();
}

export function parseEntidade(e: { titulo: string; subtitulo?: string; texto?: string; link: string }): CandidatoAcordao | null {
  const keyMatch = /KEY:(ACORDAO-COMPLETO-\d+)/.exec(e.link || '');
  const tm = TITULO_RE.exec(e.titulo || '');
  if (!keyMatch || !tm) return null;
  const numero = parseInt(tm[1].replace(/\./g, ''), 10);
  const ano = parseInt(tm[2], 10);
  if (!Number.isFinite(numero) || numero <= 0 || ano < 1990 || ano > 2100) return null;
  const relator = /relator:\s*(.+)$/i.exec(e.subtitulo || '')?.[1]?.trim() || null;
  return {
    numero,
    ano,
    ata: tm[3] || null,
    colegiado: canonColegiado(tm[4]),
    relator,
    ementa: (e.texto || '').trim(),
    key: keyMatch[1],
    link: e.link,
  };
}

/** É "acórdão de relação" (decisão simplificada)? Preferimos o completo. */
const ehRelacao = (titulo: string) => /ac[óo]rd[ãa]o\s+de\s+rela[çc][ãa]o/i.test(titulo);

export function escolherCandidato(cands: CandidatoAcordao[], colegiadoPreferido?: string): CandidatoAcordao | null {
  if (!cands.length) return null;
  if (colegiadoPreferido) {
    const c = cands.find((x) => x.colegiado === colegiadoPreferido);
    if (c) return c;
  }
  // Sem preferência (ou não achou): preferir não-relação, mantendo a ordem de relevância.
  const completos = cands.filter((c) => !ehRelacao(c.link) && !ehRelacao(c.colegiado));
  return (completos[0] ?? cands[0]) || null;
}

export async function buscarAcordaoPorNumero(numero: number, ano: number): Promise<CandidatoAcordao[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(BUSCA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': UA },
      body: JSON.stringify(`${numero}/${ano}`),
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error(`BFF ${r.status} ${r.statusText}`);
    const data = await r.json();
    const ents: unknown[] = Array.isArray(data?.entidades) ? data.entidades : [];
    return ents
      .map((e) => parseEntidade(e as { titulo: string; subtitulo?: string; texto?: string; link: string }))
      .filter((c): c is CandidatoAcordao => c !== null)
      .filter((c) => c.numero === numero && c.ano === ano); // só o número pedido
  } finally {
    clearTimeout(t);
  }
}
```

> **Nota (Task 1 GATE):** o `body` exato (JSON string vs form) e o `Content-Type` foram inferidos do probe (o XHR postou o termo como string). Se a Task 1 observar outro formato ao interceptar a chamada real, ajustar `buscarAcordaoPorNumero` aqui — os testes de `parseEntidade`/`escolherCandidato` (puros) não mudam.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run lib/tcu/buscar-acordao-tcu.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 5: Smoke real (1 chamada à API)**

Run: `npx tsx -e "import {buscarAcordaoPorNumero} from './lib/tcu/buscar-acordao-tcu'; (async()=>{const cs=await buscarAcordaoPorNumero(2622,2013); console.log(cs.length, cs[0]);})()"`
Expected: retorna ≥1 candidato para 2622/2013 com `key`, `colegiado`, `ementa` preenchidos. Se vier 0 (formato do body errado), ajustar conforme a Task 1 e repetir.

- [ ] **Step 6: Commit**

```bash
git add lib/tcu/buscar-acordao-tcu.ts lib/tcu/buscar-acordao-tcu.test.ts
git commit -m "feat(tcu): cliente da API de busca do TCU (resolve número→candidatos)"
```

---

### Task 3: Importar um acórdão (criar o Document, idempotente)

**Files:**
- Create: `lib/tcu/importar-acordao.ts`
- Test: `lib/tcu/importar-acordao.test.ts` (só a montagem dos dados; a escrita é validada pelo script)

**Interfaces:**
- Consumes: `CandidatoAcordao` (Task 2); `prisma`.
- Produces:
  - `function montarDadosDocumento(c: CandidatoAcordao, rtfUrl: string | null): DadosDocAcordao` (puro — os campos do `Document`)
  - `async function importarAcordao(c: CandidatoAcordao, rtfUrl: string | null): Promise<{ id: string; criado: boolean }>` (I/O — upsert idempotente)

- [ ] **Step 1: Escrever o teste do montador (puro)**

Criar `lib/tcu/importar-acordao.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { montarDadosDocumento } from './importar-acordao';

const cand = {
  numero: 2622, ano: 2013, ata: '37/2013', colegiado: 'Plenário',
  relator: 'Marcos Bemquerer', ementa: 'Administrativo. Estudo de BDI. '.repeat(4),
  key: 'ACORDAO-COMPLETO-1286063', link: 'https://x/KEY:ACORDAO-COMPLETO-1286063/y',
};

describe('montarDadosDocumento', () => {
  it('monta os campos essenciais do Document de acórdão', () => {
    const d = montarDadosDocumento(cand, null);
    expect(d).toMatchObject({
      title: 'Acórdão TCU 2622/2013 - Plenário',
      category: 'acordao',
      isPublic: true,
      reviewed: true,
      isCommon: true,
      acordaoNumero: 2622,
      acordaoAno: 2013,
      tcuNumeroAcordao: '2622/2013',
      tcuOrgaoJulgador: 'Plenário',
      tcuRelator: 'Marcos Bemquerer',
      embeddingStatus: 'pending',
    });
    expect(d.tcuEmentaCompleta && d.tcuEmentaCompleta.length).toBeGreaterThan(50);
    expect(d.tcuLinkPDF).toBeNull(); // Nível 1
  });

  it('Nível 2: grava o tcuLinkPDF quando a URL do RTF é dada', () => {
    const d = montarDadosDocumento(cand, 'https://contas.tcu.gov.br/sagas/SvlVisualizarRelVotoAcRtf?item0=1286063');
    expect(d.tcuLinkPDF).toContain('SvlVisualizarRelVotoAcRtf');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run lib/tcu/importar-acordao.test.ts` → FAIL (import).

- [ ] **Step 3: Implementar**

Criar `lib/tcu/importar-acordao.ts` (campos espelhados de `sync-tcu-acordaos/route.ts:326-365`, sem o dual-write de TribunalDecision — follow-up):

```ts
/**
 * Importa um acórdão do TCU para o acervo a partir de um candidato resolvido pela
 * busca (Fase 2). Cria o Document (category='acordao') idempotente pela unique
 * (acordaoNumero, acordaoAno, tcuOrgaoJulgador). Nível 1 = ementa (entra na busca
 * via embeddingStatus 'pending'); Nível 2 = grava tcuLinkPDF (RTF) → o cron
 * catalog-tcu-inteiro-teor cataloga o inteiro teor e o sync-precedentes-tcu extrai
 * as arestas. NÃO faz o dual-write em TribunalDecision (follow-up, superfície
 * /jurisprudencia).
 */
import { prisma } from '../prisma';
import type { CandidatoAcordao } from './buscar-acordao-tcu';

export interface DadosDocAcordao {
  title: string;
  description: string;
  url: string;
  type: 'link';
  category: 'acordao';
  isPublic: true;
  reviewed: true;
  isCommon: true;
  tags: string;
  acordaoNumero: number;
  acordaoAno: number;
  tcuNumeroAcordao: string;
  tcuEmentaCompleta: string | null;
  tcuRelator: string | null;
  tcuOrgaoJulgador: string;
  tcuLinkPDF: string | null;
  tcuEnriquecimentoStatus: string;
  embeddingStatus: 'pending';
}

export function montarDadosDocumento(c: CandidatoAcordao, rtfUrl: string | null): DadosDocAcordao {
  const ementa = c.ementa && c.ementa.length >= 1 ? c.ementa : '';
  return {
    title: `Acórdão TCU ${c.numero}/${c.ano} - ${c.colegiado}`,
    description: ementa || `Acórdão TCU ${c.numero}/${c.ano}`,
    url: `https://pesquisa.apps.tcu.gov.br/doc/acordao-completo/${c.numero}/${c.ano}/${encodeURIComponent(c.colegiado)}`,
    type: 'link',
    category: 'acordao',
    isPublic: true,
    reviewed: true,
    isCommon: true,
    tags: JSON.stringify(['TCU', 'Acórdão', c.colegiado, `${c.ano}`, 'leading-case']),
    acordaoNumero: c.numero,
    acordaoAno: c.ano,
    tcuNumeroAcordao: `${c.numero}/${c.ano}`,
    tcuEmentaCompleta: ementa || null,
    tcuRelator: c.relator,
    tcuOrgaoJulgador: c.colegiado,
    tcuLinkPDF: rtfUrl,
    tcuEnriquecimentoStatus: rtfUrl ? 'pending' : 'success',
    embeddingStatus: 'pending',
  };
}

export async function importarAcordao(c: CandidatoAcordao, rtfUrl: string | null): Promise<{ id: string; criado: boolean }> {
  const existente = await prisma.document.findFirst({
    where: { category: 'acordao', acordaoNumero: c.numero, acordaoAno: c.ano, tcuOrgaoJulgador: c.colegiado },
    select: { id: true },
  });
  const dados = montarDadosDocumento(c, rtfUrl);
  if (existente) {
    // Já temos: completa metadados/ementa se faltavam; não sobrescreve inteiro teor.
    await prisma.document.update({
      where: { id: existente.id },
      data: { tcuEmentaCompleta: dados.tcuEmentaCompleta, tcuRelator: dados.tcuRelator, ...(rtfUrl ? { tcuLinkPDF: rtfUrl } : {}) },
    });
    return { id: existente.id, criado: false };
  }
  const criado = await prisma.document.create({ data: dados });
  return { id: criado.id, criado: true };
}
```

- [ ] **Step 4: Rodar e ver passar** — `npx vitest run lib/tcu/importar-acordao.test.ts` → PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add lib/tcu/importar-acordao.ts lib/tcu/importar-acordao.test.ts
git commit -m "feat(tcu): importar acórdão (Document idempotente, nível ementa/inteiro teor)"
```

---

### Task 4: Script de importação da wishlist (curadoria)

**Files:**
- Create: `scripts/importar-leading-cases.ts`

**Interfaces:**
- Consumes: a wishlist JSON (Fase 1); `buscarAcordaoPorNumero`, `escolherCandidato` (Task 2); `importarAcordao` (Task 3); `prisma`.
- Produces: importa os leading cases aprovados; relatório de importados / ambíguos / falhas.

> Script de I/O; a lógica pura já foi testada. Verificação = dry-run + execução com `--limit` pequeno.

- [ ] **Step 1: Escrever o script**

Criar `scripts/importar-leading-cases.ts`:

```ts
/**
 * Importa os leading cases ausentes da wishlist (Fase 1) para o acervo. Curadoria
 * semi-automática: por padrão processa os top --limit por autoridade; o Daniel
 * pode restringir com --so=1441/2016,2622/2013. Dry-run por padrão. Rate-limit 1 req/s.
 *
 * Uso: npx tsx scripts/importar-leading-cases.ts --limit=10            # dry-run
 *      npx tsx scripts/importar-leading-cases.ts --limit=10 --execute
 *      npx tsx scripts/importar-leading-cases.ts --so=1441/2016 --execute
 *
 * O rtfUrl (Nível 2) vem da decisão da Task 1 (Fase 2.0): se resolveu por KEY,
 * preencher RESOLVER_RTF; senão importa em Nível 1 (ementa) e o inteiro teor fica
 * como follow-up.
 */
import { readFileSync } from 'fs';
import { prisma } from '../lib/prisma';
import { buscarAcordaoPorNumero, escolherCandidato } from '../lib/tcu/buscar-acordao-tcu';
import { importarAcordao } from '../lib/tcu/importar-acordao';

const WISHLIST = 'docs/audits/2026-07-18-wishlist-precedentes-tcu.json';
const EXECUTE = process.argv.includes('--execute');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : 10;
const soArg = process.argv.find((a) => a.startsWith('--so='));
const SO = soArg ? soArg.split('=')[1].split(',') : null;

// Task 1 GATE: se a Fase 2.0 resolveu a URL do RTF a partir do KEY, implementar aqui.
// Enquanto não resolvida, retorna null → importa em Nível 1 (ementa).
function resolverRtf(_key: string): string | null { return null; }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log(EXECUTE ? '🔴 EXECUÇÃO\n' : '🔵 DRY-RUN — nada será gravado (use --execute)\n');
  const wl = JSON.parse(readFileSync(WISHLIST, 'utf8')).wishlist as Array<{ chave: string; numero: number; ano: number; citadoPor: number; citadoNoVoto: number }>;
  const alvos = (SO ? wl.filter((w) => SO.includes(w.chave)) : wl).slice(0, LIMIT);
  console.log(`Alvos: ${alvos.length}\n`);

  let importados = 0, jaTinha = 0, ambiguos = 0, falhas = 0;
  for (let i = 0; i < alvos.length; i++) {
    const w = alvos[i];
    try {
      const cands = await buscarAcordaoPorNumero(w.numero, w.ano);
      if (!cands.length) { console.log(`  ✗ ${w.chave} — não encontrado na busca`); falhas++; }
      else {
        const escolhido = escolherCandidato(cands);
        if (cands.length > 1) { ambiguos++; console.log(`  ⚠️ ${w.chave} — ${cands.length} candidatos, escolhido: ${escolhido?.colegiado} (${escolhido?.key})`); }
        if (escolhido) {
          if (EXECUTE) {
            const { criado } = await importarAcordao(escolhido, resolverRtf(escolhido.key));
            criado ? importados++ : jaTinha++;
            console.log(`  ${criado ? '✅ importado' : '↺ já existia'} ${w.chave} — ${escolhido.colegiado} (citado por ${w.citadoPor}, voto ${w.citadoNoVoto})`);
          } else {
            console.log(`  ✅ (dry) ${w.chave} — ${escolhido.colegiado}, ementa ${escolhido.ementa.length} chars`);
          }
        }
      }
    } catch (e) { falhas++; console.log(`  ✗ ${w.chave} — ${(e as Error).message}`); }
    if (i < alvos.length - 1) await sleep(1000); // 1 req/s
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Importados: ${importados} · já tinha: ${jaTinha} · ambíguos: ${ambiguos} · falhas: ${falhas}`);
  if (!EXECUTE) console.log('\n🔵 DRY-RUN — nada gravado.');
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
```

- [ ] **Step 2: Dry-run**

Run: `npx tsx scripts/importar-leading-cases.ts --limit=5`
Expected: para os top-5 da wishlist, mostra candidato escolhido + tamanho da ementa; marca ambíguos; "DRY-RUN". Nenhuma escrita.

- [ ] **Step 3: Commit** (a execução real é a Task 5, após a curadoria do Daniel)

```bash
git add scripts/importar-leading-cases.ts
git commit -m "feat(tcu): script de importação dos leading cases da wishlist (curadoria)"
```

---

### Task 5: Curadoria + importação do 1º lote (operacional, com o Daniel)

**Files:** nenhum de código.

- [ ] **Step 1: Apresentar a lista candidata** — rodar o dry-run (`--limit=30`), gerar um resumo (artifact/folha) dos top leading cases com quem escolher, para o Daniel marcar quais entram no 1º lote.
- [ ] **Step 2: Importar os aprovados** — `--execute --so=<lista do Daniel>` (ou `--limit=N`). Verificar no banco: os `Document` criados (`category='acordao'`, `precedentesVersao` nulo → o cron sync-precedentes extrai as arestas deles; `embeddingStatus='pending'` → indexação).
- [ ] **Step 3: Indexar** — rodar o pipeline de embeddings existente (`npx tsx scripts/migrate-to-embeddings.ts`) para os novos entrarem na busca. Confirmar recuperabilidade com uma query.
- [ ] **Step 4: Medir o efeito** — reconferir a taxa de casamento da rede (as arestas que apontavam para os importados agora casam) e registrar. Atualizar memória/painel.

---

## Notas de execução

- **Ordem:** 1 (GATE) → 2 → 3 → 4 → 5. Tasks 2-3 têm partes puras testáveis; 4-5 são operacionais.
- **Dependências externas:** a Task 5 depende da curadoria do Daniel e (para Nível 2) da decisão da Task 1. O merge da Fase 1 não bloqueia a Fase 2 (são tabelas/documentos distintos), mas a rede casar os importados pressupõe as arestas da Fase 1 no banco (já estão).
- **Reversível:** os `Document` importados são identificáveis pela tag `leading-case`; remover = `DELETE` desses (respeitando a regra do projeto de nunca excluir docs sem pedido explícito — aqui a importação é aditiva e a remoção seria uma decisão à parte).
- **Regressão:** `npx vitest run lib/tcu/` verde ao final.
