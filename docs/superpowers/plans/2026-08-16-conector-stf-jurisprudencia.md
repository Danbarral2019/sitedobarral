# Conector STF — Jurisprudência (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trazer a jurisprudência do STF sobre licitações e a Lei 14.133/2021 para a base do site, com amarração determinística artigo↔julgado e um fluxo contínuo que sobreviva ao firewall do portal do STF.

**Architecture:** Duas fases independentes. A **Fase 1** ingere, por script de linha de comando, o corpus de 2.467 documentos já extraído da API do STF, sem depender de rede — entrega o STF em produção com valor imediato. A **Fase 2** monta o fluxo recorrente: um job do GitHub Actions com Playwright consulta a API de dentro de um navegador real (única forma de vencer o desafio JavaScript do AWS WAF) e envia o resultado a uma rota de ingestão autenticada, que reaproveita exatamente o mesmo núcleo de normalização e persistência da Fase 1.

**Tech Stack:** TypeScript · Next.js 15 (App Router) · Prisma 7 + PrismaNeon (PostgreSQL/Neon) · Vitest · Playwright 1.60 · GitHub Actions

**Spec:** este próprio documento, seção **"Contexto e decisões de desenho"** abaixo. Não há spec separada — o desenho foi fechado na sessão de 16/08/2026 a partir de investigação empírica documentada aqui.

> **Nota (pós-execução, 16/08/2026):** os blocos de código deste documento são o *briefing original* passado aos implementadores das Tasks 1-9 — não o código final. Quatro rodadas de correção, guiadas por medição contra o corpus real, fizeram trechos divergirem do que está escrito aqui. Ver a seção **"Errata — estado final do código (pós-execução)"** ao fim deste documento e o ledger completo em `.superpowers/sdd/2026-08-16-conector-stf-jurisprudencia/progress.md` para o estado real.

---

## Global Constraints

- **Escopo:** somente STF. Não generalizar, não criar abstração multitribunal, não refatorar `lib/tribunal-scrapers/`. A camada genérica já existe e já foi provada em 8 conectores; este trabalho a consome, não a reprojeta.
- **`tribunalCode` gravado no banco é sempre `'STF'` (UPPERCASE).** Única autoridade: `normalizeTribunalCode()` de `lib/tribunal-scrapers/utils.ts`.
- **`leiArticlesArr` guarda número puro** — `"75"`, `"184-A"`. Nunca `"Art. 75"`. Gravar com prefixo quebra o cruzamento decisão↔artigo da Lei Comentada.
- **Prisma:** generator `prisma-client-js`; scripts usam `import { prisma } from '@/lib/prisma'` e são executados com `npx tsx --env-file=.env.local`.
- **Nenhuma migration.** `TribunalDecision` já comporta tudo que o STF entrega. Não alterar `prisma/schema.prisma`.
- **Nada de exclusão de documentos.** Toda escrita é `create` ou `update`.
- **Embeddings são automáticos.** Gravar com `embeddingStatus: 'pending'` e deixar o cron `process-index-jobs` processar. Não chamar `processTribunalDecision` diretamente.
- **Testes:** Vitest. Arquivos puros ganham teste unitário sem mock; código que toca banco usa o padrão `vi.hoisted` + `vi.mock('@/lib/prisma')` de `lib/tcu/persistir-tese.test.ts`.
- **Commits frequentes**, um por task, mensagem em português no padrão do repo (`feat(stf): ...`).

---

## Contexto e decisões de desenho

### A fonte

`POST https://jurisprudencia.stf.jus.br/api/search/search` — Elasticsearch Query DSL cru, público, sem autenticação, sem documentação oficial. Duas bases no campo `base`: `acordaos` e `decisoes` (monocráticas). Link público do documento: `https://jurisprudencia.stf.jus.br/pages/search/<id>/false`.

### O bloqueio (verificado em 16/08/2026)

O host inteiro está atrás de um AWS WAF com desafio JavaScript. Requisições server-side recebem:

```
HTTP 202 · Content-Length: 0 · x-amzn-waf-action: challenge · Server: awselb/2.0
```

Verificado nas rotas `/`, `/pages/search`, `/api/search/search`, `/api/search/export`, `/api/search/download` e `/api/search/abnt`. Também verificado que:

- headers completos de navegador não passam (o servidor apenas troca o corpo vazio pela página do desafio, 1.975 bytes, mantendo 202);
- nenhum cookie é emitido na primeira resposta, e a segunda requisição na mesma sessão é desafiada igual — não há token a reaproveitar sem executar JS;
- `redir.stf.jus.br` (host do inteiro teor em PDF) também está atrás do WAF;
- `portal.stf.jus.br` responde 200 sem WAF, mas é só o portal institucional: a busca legada devolve o usuário para o host bloqueado e não existe hotsite de dados abertos com jurisprudência;
- `lexml.gov.br/busca/SRU`, a alternativa aberta óbvia, está atrás de uma verificação de segurança do Senado.

**Consequência de desenho nº 1:** um `TribunalScraper` server-side comum é inviável. Pior, ele falharia mal: `fetchWithRetry` trata 202 como resposta não-retryable e a devolve; o conector leria zero itens e registraria `success`. Seria o TCE-MG morrendo em silêncio. Por isso a Fase 2 usa navegador real e **não registra scraper no registry** — segue o modelo do TCU e do TST, que escrevem em `TribunalDecision` por pipeline próprio.

**Consequência de desenho nº 2:** o inteiro teor em PDF está fora de alcance. Trabalhamos com `ementa_texto` (acórdãos) e `decisao_texto` (monocráticas), que vêm no próprio payload.

### O corpus já extraído

Arquivo: `stf_lei14133_dados_2026-08-16.json` (13 MB), com três recortes e `2.467 ids únicos` em `2.516` registros brutos.

| Recorte | Total | Cita `LEI-014133` | Ementa >200 ch | Com tese | Rep. geral |
|---|---|---|---|---|---|
| `acordaos` (expressão "Lei 14.133") | 56 | 55 | 56 | 9 | 5 |
| `monocraticas` (expressão "Lei 14.133") | 1.050 | 1.016 | 0 — usa `decisao_texto` | 0 | 0 |
| `amplo` (licitação, julgados desde 01/04/2021) | 1.410 | 48 | 1.406 | 22 | 17 |

Dois problemas medidos:

1. **O recorte amplo é majoritariamente ruído.** Apenas 424 dos 1.410 têm `licita*` na própria ementa; os outros 986 casaram por menção na legislação citada, na indexação ou na ata. Classes dominantes: `Rcl` 537, `ARE` 307, `HC` 172.
2. **As monocráticas são 847 de 1.050 reclamações**, e o `decisao_texto` vem **truncado em exatamente 6.000 caracteres em 1.023 dos 1.050 registros**. Reclamação monocrática é aplicação de precedente, não fixação de tese.

### O que o STF entrega e o TCU não entregava

`documental_legislacao_citada_texto` traz a legislação citada estruturada, um bloco por norma:

```
LEG-FED   LEI-014133 ANO-2021
    ART-00075 INC-00002 ART-00006
    LEI ORDINÁRIA
```

Isso dá **amarração artigo→julgado determinística, sem LLM e sem heurística de proximidade**. É o ganho principal deste conector para a Lei Comentada.

**Consequência de desenho nº 3:** para o STF, `leiArticlesArr` vem **exclusivamente** desse campo. Não usamos `classification.leiArticles`, que roda `detectLeiArticles()` sobre o texto e capturaria "art. 37 da Constituição" como artigo 37 da Lei 14.133 — exatamente a classe de erro registrada em `feedback-citacao-amarra-a-norma`. A fonte é autoritativa; a heurística seria um retrocesso.

`documental_tese_texto`, `documental_tese_tema_texto` e `is_repercussao_geral` trazem a **tese oficial firmada** — o análogo do que `TeseDestilacao` produz por LLM no TCU, aqui autêntico e sem necessidade de folha de calibração.

### Regra de recorte adotada

| Origem | Regra | Selecionados |
|---|---|---|
| `acordaos` | cita `LEI-014133` **ou** tem `licita*` no texto | 56 de 56 |
| `amplo` | mesma regra | 437 de 1.410 |
| `decisoes` | classe **≠ `Rcl`** **e** cita `LEI-014133` **e** tem `licita*` no texto | 154 de 1.050 |
| **Total após dedup por `id`** | | **598** |

Números medidos sobre o JSON real. O executor deve reproduzi-los exatamente na Task 5 — divergência significa bug no recorte.

### Chave de dedup

`fullIdentifier = "STF " + id`, onde `id` é o identificador nativo do índice do STF (`sjur554999`). **Desvio deliberado de `buildFullIdentifier()`**: o título (`"ADI 7764"`) não é único — o mesmo processo tem acórdão e monocráticas, e o mesmo par classe+número pode render vários documentos. O `id` nativo é a única chave garantidamente única. `sourceId` guarda o mesmo valor, e `title` preserva `"ADI 7764"` para leitura humana.

### Não-objetivos (explícitos)

- Não filtrar por classe processual (ADI/RE/Rcl/HC) na API pública. `decisionType` fica no vocabulário existente (`'acordao'` / `'decisao'`); a classe vai para `sourceRawData`. Sem mudança de `z.enum`, sem migration. Se a filtragem por classe virar necessidade real, vira trabalho próprio.
- Não criar `DocumentMetaStf`. Tese, tema, repercussão geral, UF e classe cabem em `sourceRawData` na v1.
- Não baixar inteiro teor em PDF (bloqueado pelo WAF em `redir.stf.jus.br`).
- Não implementar reaproveitamento de cookie `aws-waf-token` de sessão de navegador. Verificado que só nasce por execução de JS, e a licitude perante os termos de uso do portal não foi avaliada.

---

## File Structure

**Fase 1 — núcleo e backfill**

| Arquivo | Responsabilidade |
|---|---|
| `lib/stf/legislacao-citada.ts` | Parser do campo de legislação citada → artigos da Lei 14.133. Puro. |
| `lib/stf/types.ts` | `StfDocumentoBruto` (formato da API) e `StfDecisaoNormalizada` (formato interno). |
| `lib/stf/normalizar.ts` | Documento bruto → decisão normalizada. Puro. |
| `lib/stf/recorte.ts` | Regra de seleção do que entra na base. Puro. |
| `lib/stf/persistir.ts` | Upsert em `TribunalDecision`. Único arquivo da Fase 1 que toca o banco. |
| `scripts/import-stf-jurisprudencia.ts` | CLI de backfill a partir do JSON. |
| `lib/admin/tribunal-decisions/format.ts` | *(modificar)* cor do badge STF no admin. |

**Fase 2 — fluxo contínuo**

| Arquivo | Responsabilidade |
|---|---|
| `lib/stf/consulta.ts` | Montagem do corpo Elasticsearch. Compartilhado entre Node e o navegador. Puro. |
| `app/api/ingest/stf/route.ts` | Rota autenticada que recebe o payload do runner, persiste e registra saúde. |
| `scripts/stf-runner.ts` | Runner Playwright: colhe no navegador e faz POST na rota. |
| `.github/workflows/stf-jurisprudencia.yml` | Agendamento semanal do runner. |

---

## FASE 1 — Backfill

### Task 1: Parser da legislação citada

**Files:**
- Create: `lib/stf/legislacao-citada.ts`
- Test: `lib/stf/__tests__/legislacao-citada.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `extrairArtigos14133(campo: string[] | string | null | undefined): string[]` e `citaLei14133(campo: string[] | string | null | undefined): boolean`.

- [ ] **Step 1: Write the failing test**

Criar `lib/stf/__tests__/legislacao-citada.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { extrairArtigos14133, citaLei14133 } from '../legislacao-citada';

// Blocos reais do campo documental_legislacao_citada_texto do STF.
const BLOCO_CF = `LEG-FED   CF ANO-1988
    ART-00001 ART-00022 INC-00001 INC-00027
    ART-00037 INC-00021
    CF-1988 CONSTITUIÇÃO FEDERAL`;

const BLOCO_14133 = `LEG-FED   LEI-014133 ANO-2021
    ART-00006 ART-00075 INC-00002
    LEI ORDINÁRIA`;

const BLOCO_14133_COM_LETRA = `LEG-FED   LEI-014133 ANO-2021
    ART-00184-A
    LEI ORDINÁRIA`;

describe('extrairArtigos14133', () => {
  it('extrai só os artigos do bloco da Lei 14.133, ignorando os da CF', () => {
    expect(extrairArtigos14133([BLOCO_CF, BLOCO_14133])).toEqual(['6', '75']);
  });

  it('remove os zeros à esquerda do formato ART-00075', () => {
    expect(extrairArtigos14133([BLOCO_14133])).toEqual(['6', '75']);
  });

  it('preserva o sufixo de letra (Art. 184-A)', () => {
    expect(extrairArtigos14133([BLOCO_14133_COM_LETRA])).toEqual(['184-A']);
  });

  it('NÃO captura incisos como se fossem artigos', () => {
    expect(extrairArtigos14133([BLOCO_14133])).not.toContain('2');
  });

  it('devolve vazio quando a 14.133 não é citada', () => {
    expect(extrairArtigos14133([BLOCO_CF])).toEqual([]);
  });

  it('aceita string única em vez de array', () => {
    expect(extrairArtigos14133(BLOCO_14133)).toEqual(['6', '75']);
  });

  it('aceita null e undefined', () => {
    expect(extrairArtigos14133(null)).toEqual([]);
    expect(extrairArtigos14133(undefined)).toEqual([]);
  });

  it('deduplica artigos repetidos', () => {
    expect(extrairArtigos14133([BLOCO_14133, BLOCO_14133])).toEqual(['6', '75']);
  });

  it('ordena numericamente, não alfabeticamente', () => {
    const bloco = 'LEG-FED   LEI-014133 ANO-2021\n ART-00100 ART-00020 ART-00003';
    expect(extrairArtigos14133([bloco])).toEqual(['3', '20', '100']);
  });
});

describe('citaLei14133', () => {
  it('reconhece o token da norma', () => {
    expect(citaLei14133([BLOCO_CF, BLOCO_14133])).toBe(true);
  });

  it('é falso quando só há outras normas', () => {
    expect(citaLei14133([BLOCO_CF])).toBe(false);
  });

  it('é falso para vazio', () => {
    expect(citaLei14133(null)).toBe(false);
    expect(citaLei14133([])).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/stf/__tests__/legislacao-citada.test.ts`
Expected: FAIL — `Failed to resolve import "../legislacao-citada"`.

- [ ] **Step 3: Write minimal implementation**

Criar `lib/stf/legislacao-citada.ts`:

```typescript
/**
 * Extração dos dispositivos da Lei 14.133/2021 citados num julgado do STF.
 *
 * O campo `documental_legislacao_citada_texto` da API do STF traz um bloco de
 * texto por norma citada, no formato:
 *
 *     LEG-FED   LEI-014133 ANO-2021
 *         ART-00075 INC-00002
 *         LEI ORDINÁRIA
 *
 * Como cada norma vive em seu próprio bloco, filtrar o bloco pelo token da lei
 * e só então extrair os `ART-` dá amarração artigo↔julgado DETERMINÍSTICA —
 * sem heurística de proximidade e sem LLM. É a razão principal deste conector.
 */

const TOKEN_LEI_14133 = 'LEI-014133';

/** `ART-00075` → `75`; `ART-00184-A` → `184-A`. Incisos (`INC-`) não casam. */
const RE_ARTIGO = /ART-(\d{1,5})(?:-([A-Z]))?/g;

function blocos(campo: string[] | string | null | undefined): string[] {
  if (campo === null || campo === undefined) return [];
  return (Array.isArray(campo) ? campo : [campo]).map(String);
}

export function citaLei14133(campo: string[] | string | null | undefined): boolean {
  return blocos(campo).some(b => b.includes(TOKEN_LEI_14133));
}

export function extrairArtigos14133(campo: string[] | string | null | undefined): string[] {
  const artigos = new Set<string>();

  for (const bloco of blocos(campo)) {
    if (!bloco.includes(TOKEN_LEI_14133)) continue;

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

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/stf/__tests__/legislacao-citada.test.ts`
Expected: PASS — 12 testes.

- [ ] **Step 5: Commit**

```bash
git add lib/stf/legislacao-citada.ts lib/stf/__tests__/legislacao-citada.test.ts
git commit -m "feat(stf): parser determinístico dos dispositivos da Lei 14.133 citados"
```

---

### Task 2: Tipos e normalização do documento

**Files:**
- Create: `lib/stf/types.ts`
- Create: `lib/stf/normalizar.ts`
- Test: `lib/stf/__tests__/normalizar.test.ts`

**Interfaces:**
- Consumes: `extrairArtigos14133`, `citaLei14133` da Task 1.
- Produces: os tipos `StfDocumentoBruto` e `StfDecisaoNormalizada`; `normalizarDocumentoStf(doc: StfDocumentoBruto): StfDecisaoNormalizada | null`; as constantes `LIMITE_TRUNCAMENTO_STF` e `linkStf(id: string): string`.

- [ ] **Step 1: Write the failing test**

Criar `lib/stf/__tests__/normalizar.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { normalizarDocumentoStf, LIMITE_TRUNCAMENTO_STF, linkStf } from '../normalizar';
import type { StfDocumentoBruto } from '../types';

const ACORDAO: StfDocumentoBruto = {
  base: 'acordaos',
  id: 'sjur554999',
  titulo: 'ADI 7764',
  processo_numero: '7764',
  processo_classe_processual_unificada_classe_sigla: 'ADI',
  procedencia_geografica_uf_sigla: 'RR',
  relator_processo_nome: 'MINISTRA CÁRMEN LÚCIA',
  orgao_julgador: 'Tribunal Pleno',
  julgamento_data: '2026-02-25',
  publicacao_data: '2026-03-05',
  is_repercussao_geral: false,
  ementa_texto: 'Ementa: DIREITO ADMINISTRATIVO. LICITAÇÃO. Dispensa indevida.',
  documental_legislacao_citada_texto: [
    'LEG-FED   LEI-014133 ANO-2021\n ART-00075\n LEI ORDINÁRIA',
  ],
  documental_tese_texto: 'É inconstitucional a dispensa genérica.',
  documental_tese_tema_texto: 'Tema 1234',
};

const MONOCRATICA: StfDocumentoBruto = {
  base: 'decisoes',
  id: 'sjur999111',
  titulo: 'Rcl 97875',
  processo_classe_processual_unificada_classe_sigla: 'Rcl',
  relator_decisao_nome: 'MINISTRO ALEXANDRE DE MORAES',
  julgamento_data: '2026-08-06',
  decisao_texto: 'x'.repeat(LIMITE_TRUNCAMENTO_STF),
};

describe('normalizarDocumentoStf — acórdão', () => {
  const n = normalizarDocumentoStf(ACORDAO)!;

  it('usa o id nativo como chave de dedup', () => {
    expect(n.sourceId).toBe('sjur554999');
    expect(n.fullIdentifier).toBe('STF sjur554999');
  });

  it('mapeia base=acordaos para decisionType acordao', () => {
    expect(n.decisionType).toBe('acordao');
  });

  it('separa classe e número a partir do título', () => {
    expect(n.classe).toBe('ADI');
    expect(n.decisionNumber).toBe('7764');
    expect(n.title).toBe('ADI 7764');
  });

  it('deriva o ano da data de julgamento', () => {
    expect(n.year).toBe(2026);
    expect(n.dataJulgamento?.toISOString().slice(0, 10)).toBe('2026-02-25');
    expect(n.dataPublicacao?.toISOString().slice(0, 10)).toBe('2026-03-05');
  });

  it('monta o link público do documento', () => {
    expect(n.url).toBe('https://jurisprudencia.stf.jus.br/pages/search/sjur554999/false');
  });

  it('traz os artigos da 14.133 do campo estruturado', () => {
    expect(n.artigos14133).toEqual(['75']);
    expect(n.citaLei14133).toBe(true);
  });

  it('preserva tese e tema oficiais', () => {
    expect(n.tese).toBe('É inconstitucional a dispensa genérica.');
    expect(n.tema).toBe('Tema 1234');
  });

  it('não marca ementa de acórdão como truncada', () => {
    expect(n.ementaTruncada).toBe(false);
  });
});

describe('normalizarDocumentoStf — monocrática', () => {
  const n = normalizarDocumentoStf(MONOCRATICA)!;

  it('mapeia base=decisoes para decisionType decisao', () => {
    expect(n.decisionType).toBe('decisao');
  });

  it('usa decisao_texto como ementa quando não há ementa_texto', () => {
    expect(n.ementa.length).toBe(LIMITE_TRUNCAMENTO_STF);
  });

  it('marca como truncada quando o texto bate no limite de 6000 do índice do STF', () => {
    expect(n.ementaTruncada).toBe(true);
  });

  it('cai para relator_decisao_nome quando não há relator_processo_nome', () => {
    expect(n.relator).toBe('MINISTRO ALEXANDRE DE MORAES');
  });
});

describe('normalizarDocumentoStf — rejeições', () => {
  it('rejeita documento sem id', () => {
    expect(normalizarDocumentoStf({ ...ACORDAO, id: '' })).toBeNull();
  });

  it('rejeita documento sem texto aproveitável', () => {
    expect(
      normalizarDocumentoStf({ ...ACORDAO, ementa_texto: 'curto', decisao_texto: undefined })
    ).toBeNull();
  });
});

describe('normalização de texto', () => {
  it('junta arrays e colapsa espaços em branco', () => {
    const n = normalizarDocumentoStf({
      ...ACORDAO,
      ementa_texto: ['Ementa:   LICITAÇÃO.', '\n\n  Segundo   trecho relevante do julgado.'],
    })!;
    expect(n.ementa).toBe('Ementa: LICITAÇÃO. Segundo trecho relevante do julgado.');
  });
});

describe('linkStf', () => {
  it('monta a URL pública', () => {
    expect(linkStf('sjur1')).toBe('https://jurisprudencia.stf.jus.br/pages/search/sjur1/false');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/stf/__tests__/normalizar.test.ts`
Expected: FAIL — `Failed to resolve import "../normalizar"`.

- [ ] **Step 3: Write minimal implementation**

Criar `lib/stf/types.ts`:

```typescript
/** Documento como vem do índice Elasticsearch do STF (`_source`). */
export interface StfDocumentoBruto {
  base?: string;
  id?: string;
  titulo?: string;
  processo_numero?: string;
  processo_classe_processual_unificada_classe_sigla?: string;
  processo_classe_processual_unificada_extenso?: string;
  procedencia_geografica_uf_sigla?: string;
  relator_processo_nome?: string | string[];
  relator_acordao_nome?: string | string[];
  relator_decisao_nome?: string | string[];
  orgao_julgador?: string;
  julgamento_data?: string;
  publicacao_data?: string;
  is_repercussao_geral?: boolean;
  ementa_texto?: string | string[];
  decisao_texto?: string | string[];
  documental_tese_texto?: string | string[];
  documental_tese_tema_texto?: string | string[];
  documental_legislacao_citada_texto?: string | string[];
  documental_indexacao_texto?: string | string[];
}

/** Forma interna, já saneada, pronta para o recorte e para a persistência. */
export interface StfDecisaoNormalizada {
  sourceId: string;
  fullIdentifier: string;
  decisionType: 'acordao' | 'decisao';
  classe: string;
  decisionNumber: string;
  processNumber: string | null;
  year: number;
  title: string;
  ementa: string;
  /** `decisao_texto` vem cortado em 6.000 chars no índice do STF. */
  ementaTruncada: boolean;
  relator: string | null;
  orgaoJulgador: string | null;
  dataJulgamento: Date | null;
  dataPublicacao: Date | null;
  url: string;
  uf: string | null;
  repercussaoGeral: boolean;
  tema: string | null;
  tese: string | null;
  indexacao: string | null;
  artigos14133: string[];
  citaLei14133: boolean;
}
```

Criar `lib/stf/normalizar.ts`:

```typescript
/**
 * Documento bruto do índice do STF → forma interna normalizada.
 *
 * Função pura: não toca rede nem banco.
 */

import { extrairArtigos14133, citaLei14133 } from './legislacao-citada';
import type { StfDocumentoBruto, StfDecisaoNormalizada } from './types';

/**
 * O índice do STF corta `decisao_texto` em 6.000 caracteres — medido em 1.023
 * dos 1.050 registros do corpus de 16/08/2026. Marcamos o corte para que nada
 * a jusante trate o texto de monocrática como inteiro teor.
 */
export const LIMITE_TRUNCAMENTO_STF = 6000;

/** Tamanho mínimo de texto para o documento valer ingestão. */
const MIN_TEXTO = 50;

export function linkStf(id: string): string {
  return `https://jurisprudencia.stf.jus.br/pages/search/${id}/false`;
}

export function texto(v: string | string[] | null | undefined): string {
  if (v === null || v === undefined) return '';
  const bruto = Array.isArray(v) ? v.join(' ') : String(v);
  return bruto.replace(/\s+/g, ' ').trim();
}

function dataISO(v: string | undefined): Date | null {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function normalizarDocumentoStf(
  doc: StfDocumentoBruto
): StfDecisaoNormalizada | null {
  const sourceId = (doc.id || '').trim();
  if (!sourceId) return null;

  const ementaTexto = texto(doc.ementa_texto);
  const decisaoTexto = texto(doc.decisao_texto);
  const corpo = ementaTexto || decisaoTexto;
  if (corpo.length < MIN_TEXTO) return null;

  const titulo = texto(doc.titulo) || sourceId;
  const numero = /(\d[\d.]*)\s*$/.exec(titulo);
  const dataJulgamento = dataISO(doc.julgamento_data);
  const legislacao = doc.documental_legislacao_citada_texto;

  return {
    sourceId,
    fullIdentifier: `STF ${sourceId}`,
    decisionType: doc.base === 'decisoes' ? 'decisao' : 'acordao',
    classe: (doc.processo_classe_processual_unificada_classe_sigla || '').trim(),
    decisionNumber: numero ? numero[1].replace(/\./g, '') : titulo,
    processNumber: texto(doc.processo_numero) || null,
    year: dataJulgamento ? dataJulgamento.getUTCFullYear() : new Date().getUTCFullYear(),
    title: titulo,
    ementa: corpo,
    ementaTruncada: !ementaTexto && decisaoTexto.length >= LIMITE_TRUNCAMENTO_STF,
    relator:
      texto(doc.relator_processo_nome) ||
      texto(doc.relator_acordao_nome) ||
      texto(doc.relator_decisao_nome) ||
      null,
    orgaoJulgador: texto(doc.orgao_julgador) || null,
    dataJulgamento,
    dataPublicacao: dataISO(doc.publicacao_data),
    url: linkStf(sourceId),
    uf: (doc.procedencia_geografica_uf_sigla || '').trim() || null,
    repercussaoGeral: doc.is_repercussao_geral === true,
    tema: texto(doc.documental_tese_tema_texto) || null,
    tese: texto(doc.documental_tese_texto) || null,
    indexacao: texto(doc.documental_indexacao_texto) || null,
    artigos14133: extrairArtigos14133(legislacao),
    citaLei14133: citaLei14133(legislacao),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/stf/__tests__/normalizar.test.ts`
Expected: PASS — 17 testes.

- [ ] **Step 5: Commit**

```bash
git add lib/stf/types.ts lib/stf/normalizar.ts lib/stf/__tests__/normalizar.test.ts
git commit -m "feat(stf): normalização do documento bruto do índice do STF"
```

---

### Task 3: Regra de recorte

**Files:**
- Create: `lib/stf/recorte.ts`
- Test: `lib/stf/__tests__/recorte.test.ts`

**Interfaces:**
- Consumes: `StfDecisaoNormalizada` da Task 2.
- Produces: `ehRelevanteParaBase(d: StfDecisaoNormalizada): boolean` e `selecionarRecorte(docs: StfDecisaoNormalizada[]): StfDecisaoNormalizada[]`.

- [ ] **Step 1: Write the failing test**

Criar `lib/stf/__tests__/recorte.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { ehRelevanteParaBase, selecionarRecorte } from '../recorte';
import type { StfDecisaoNormalizada } from '../types';

function decisao(over: Partial<StfDecisaoNormalizada> = {}): StfDecisaoNormalizada {
  return {
    sourceId: 'sjur1',
    fullIdentifier: 'STF sjur1',
    decisionType: 'acordao',
    classe: 'ADI',
    decisionNumber: '1',
    processNumber: null,
    year: 2026,
    title: 'ADI 1',
    ementa: 'Ementa sobre matéria tributária sem relação com o tema.',
    ementaTruncada: false,
    relator: null,
    orgaoJulgador: null,
    dataJulgamento: null,
    dataPublicacao: null,
    url: 'https://jurisprudencia.stf.jus.br/pages/search/sjur1/false',
    uf: null,
    repercussaoGeral: false,
    tema: null,
    tese: null,
    indexacao: null,
    artigos14133: [],
    citaLei14133: false,
    ...over,
  };
}

describe('ehRelevanteParaBase — acórdãos', () => {
  it('aceita acórdão que cita a Lei 14.133', () => {
    expect(ehRelevanteParaBase(decisao({ citaLei14133: true }))).toBe(true);
  });

  it('aceita acórdão com licitação na ementa, mesmo sem citar a 14.133', () => {
    expect(
      ehRelevanteParaBase(decisao({ ementa: 'Ementa: certame licitatório anulado.' }))
    ).toBe(true);
  });

  it('rejeita acórdão que não cita a norma nem fala de licitação', () => {
    expect(ehRelevanteParaBase(decisao())).toBe(false);
  });
});

describe('ehRelevanteParaBase — monocráticas', () => {
  const mono = (over: Partial<StfDecisaoNormalizada> = {}) =>
    decisao({ decisionType: 'decisao', classe: 'ADI', ...over });

  it('aceita monocrática não-Rcl que cita a norma E fala de licitação', () => {
    expect(
      ehRelevanteParaBase(
        mono({ citaLei14133: true, ementa: 'Decisão sobre licitação municipal.' })
      )
    ).toBe(true);
  });

  it('rejeita reclamação, ainda que cite a norma e fale de licitação', () => {
    expect(
      ehRelevanteParaBase(
        mono({ classe: 'Rcl', citaLei14133: true, ementa: 'Decisão sobre licitação.' })
      )
    ).toBe(false);
  });

  it('rejeita monocrática que cita a norma mas não fala de licitação', () => {
    expect(ehRelevanteParaBase(mono({ citaLei14133: true }))).toBe(false);
  });

  it('rejeita monocrática que fala de licitação mas não cita a norma', () => {
    expect(ehRelevanteParaBase(mono({ ementa: 'Decisão sobre licitação.' }))).toBe(false);
  });
});

describe('selecionarRecorte', () => {
  it('filtra e deduplica por sourceId, preservando a ordem de entrada', () => {
    const a = decisao({ sourceId: 'a', citaLei14133: true });
    const b = decisao({ sourceId: 'b' });
    const a2 = decisao({ sourceId: 'a', citaLei14133: true });
    const c = decisao({ sourceId: 'c', ementa: 'Trata de licitação.' });

    expect(selecionarRecorte([a, b, a2, c]).map(d => d.sourceId)).toEqual(['a', 'c']);
  });

  it('devolve vazio para entrada vazia', () => {
    expect(selecionarRecorte([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/stf/__tests__/recorte.test.ts`
Expected: FAIL — `Failed to resolve import "../recorte"`.

- [ ] **Step 3: Write minimal implementation**

Criar `lib/stf/recorte.ts`:

```typescript
/**
 * Regra de seleção: o que da extração do STF entra na base do site.
 *
 * Medido sobre o corpus de 16/08/2026 (2.467 ids únicos): a busca por expressão
 * alcança ementa, tese, legislação citada, indexação e ata, de modo que 986 dos
 * 1.410 julgados do recorte amplo mencionam licitação SÓ na legislação citada —
 * são de tema alheio. E 847 das 1.050 monocráticas são reclamações, que aplicam
 * precedente em vez de fixar tese, com texto ainda por cima truncado em 6.000
 * caracteres pelo índice.
 *
 * Números esperados com esta regra: 56 acórdãos + 437 do recorte amplo + 154
 * monocráticas = 598 documentos após dedup por id.
 */

import type { StfDecisaoNormalizada } from './types';

const RE_LICITACAO = /licita/i;

/** Reclamação monocrática: alto volume, baixo valor jurisprudencial. */
const CLASSES_MONOCRATICAS_EXCLUIDAS = new Set(['Rcl']);

export function ehRelevanteParaBase(d: StfDecisaoNormalizada): boolean {
  if (d.decisionType === 'acordao') {
    return d.citaLei14133 || RE_LICITACAO.test(d.ementa);
  }

  if (CLASSES_MONOCRATICAS_EXCLUIDAS.has(d.classe)) return false;
  return d.citaLei14133 && RE_LICITACAO.test(d.ementa);
}

export function selecionarRecorte(
  docs: StfDecisaoNormalizada[]
): StfDecisaoNormalizada[] {
  const vistos = new Set<string>();
  const saida: StfDecisaoNormalizada[] = [];

  for (const d of docs) {
    if (!ehRelevanteParaBase(d)) continue;
    if (vistos.has(d.sourceId)) continue;
    vistos.add(d.sourceId);
    saida.push(d);
  }

  return saida;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/stf/__tests__/recorte.test.ts`
Expected: PASS — 9 testes.

- [ ] **Step 5: Commit**

```bash
git add lib/stf/recorte.ts lib/stf/__tests__/recorte.test.ts
git commit -m "feat(stf): regra de recorte do que entra na base"
```

---

### Task 4: Persistência em TribunalDecision

**Files:**
- Create: `lib/stf/persistir.ts`
- Test: `lib/stf/__tests__/persistir.test.ts`

**Interfaces:**
- Consumes: `StfDecisaoNormalizada` (Task 2); `classifyDecision` e `generateDecisionSummary` de `@/lib/tribunal-scrapers/classifier`; `setLeiArticles` de `@/lib/lei-articles`; `normalizeTribunalCode` de `@/lib/tribunal-scrapers/utils`.
- Produces: `SOURCE_API_STF`, `TRIBUNAL_NAME_STF`, `montarDadosStf(d, classification, summary)`, `persistirDecisoesStf(decisoes, opcoes): Promise<ResultadoPersistenciaStf>` e o tipo `ResultadoPersistenciaStf { criados, atualizados, ignorados, erros, mensagensErro }`.

- [ ] **Step 1: Write the failing test**

Criar `lib/stf/__tests__/persistir.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StfDecisaoNormalizada } from '../types';

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

import { persistirDecisoesStf, montarDadosStf, SOURCE_API_STF } from '../persistir';

function decisao(over: Partial<StfDecisaoNormalizada> = {}): StfDecisaoNormalizada {
  return {
    sourceId: 'sjur554999',
    fullIdentifier: 'STF sjur554999',
    decisionType: 'acordao',
    classe: 'ADI',
    decisionNumber: '7764',
    processNumber: '7764',
    year: 2026,
    title: 'ADI 7764',
    ementa: 'Ementa: LICITAÇÃO. Dispensa indevida.',
    ementaTruncada: false,
    relator: 'MINISTRA CÁRMEN LÚCIA',
    orgaoJulgador: 'Tribunal Pleno',
    dataJulgamento: new Date('2026-02-25T00:00:00Z'),
    dataPublicacao: new Date('2026-03-05T00:00:00Z'),
    url: 'https://jurisprudencia.stf.jus.br/pages/search/sjur554999/false',
    uf: 'RR',
    repercussaoGeral: true,
    tema: 'Tema 1234',
    tese: 'É inconstitucional a dispensa genérica.',
    indexacao: null,
    artigos14133: ['75'],
    citaLei14133: true,
    ...over,
  };
}

const CLASSIFICACAO = {
  relevanceScore: 80,
  approvalStatus: 'auto_approved' as const,
  themes: ['licitação'],
  leiArticles: ['37', '75'],
  reasoning: 'menciona dispensa',
  suggestedCourses: '1',
  confidence: 90,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockClassify.mockResolvedValue(CLASSIFICACAO);
  mockSummary.mockResolvedValue('Resumo IA.');
  mockFindUnique.mockResolvedValue(null);
  mockCreate.mockResolvedValue({ id: 'novo' });
  mockUpdate.mockResolvedValue({ id: 'novo' });
});

describe('montarDadosStf', () => {
  it('grava tribunalCode em UPPERCASE', () => {
    expect(montarDadosStf(decisao(), CLASSIFICACAO, null).tribunalCode).toBe('STF');
  });

  it('usa SOMENTE os artigos do campo estruturado do STF, ignorando a heurística do classificador', () => {
    // O classificador devolveu ['37','75'] lendo o texto — o 37 é da Constituição.
    // A fonte autoritativa é o campo de legislação citada, que trouxe só o 75.
    expect(montarDadosStf(decisao(), CLASSIFICACAO, null).leiArticlesArr).toEqual(['75']);
  });

  it('deixa leiArticlesArr vazio quando o julgado não cita a 14.133', () => {
    const d = decisao({ artigos14133: [], citaLei14133: false });
    expect(montarDadosStf(d, CLASSIFICACAO, null).leiArticlesArr).toEqual([]);
  });

  it('guarda classe, UF, tese, tema e truncamento em sourceRawData', () => {
    const raw = JSON.parse(montarDadosStf(decisao(), CLASSIFICACAO, null).sourceRawData!);
    expect(raw).toMatchObject({
      classe: 'ADI',
      uf: 'RR',
      repercussaoGeral: true,
      tema: 'Tema 1234',
      tese: 'É inconstitucional a dispensa genérica.',
      ementaTruncada: false,
    });
  });

  it('identifica a fonte', () => {
    expect(montarDadosStf(decisao(), CLASSIFICACAO, null).sourceApi).toBe(SOURCE_API_STF);
    expect(montarDadosStf(decisao(), CLASSIFICACAO, null).sourceId).toBe('sjur554999');
  });

  it('não define embeddingStatus — deixa o default pending do schema', () => {
    expect('embeddingStatus' in montarDadosStf(decisao(), CLASSIFICACAO, null)).toBe(false);
  });
});

describe('persistirDecisoesStf', () => {
  it('cria decisão inédita', async () => {
    const r = await persistirDecisoesStf([decisao()], {});
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ criados: 1, atualizados: 0, ignorados: 0, erros: 0 });
  });

  it('ignora decisão já existente quando forcar=false', async () => {
    mockFindUnique.mockResolvedValue({ id: 'existente' });
    const r = await persistirDecisoesStf([decisao()], {});
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(r).toMatchObject({ criados: 0, ignorados: 1 });
  });

  it('atualiza decisão existente quando forcar=true', async () => {
    mockFindUnique.mockResolvedValue({ id: 'existente' });
    const r = await persistirDecisoesStf([decisao()], { forcar: true });
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ atualizados: 1, ignorados: 0 });
  });

  it('não escreve nada em dryRun, mas conta o que criaria', async () => {
    const r = await persistirDecisoesStf([decisao()], { dryRun: true });
    expect(mockCreate).not.toHaveBeenCalled();
    expect(r).toMatchObject({ criados: 1 });
  });

  it('só gera resumo IA para decisão auto_approved', async () => {
    mockClassify.mockResolvedValue({ ...CLASSIFICACAO, approvalStatus: 'pending' });
    await persistirDecisoesStf([decisao()], {});
    expect(mockSummary).not.toHaveBeenCalled();
  });

  it('um erro num documento não aborta o lote', async () => {
    mockCreate.mockRejectedValueOnce(new Error('falha de rede'));
    const r = await persistirDecisoesStf([decisao({ sourceId: 'a' }), decisao({ sourceId: 'b' })], {});
    expect(r.erros).toBe(1);
    expect(r.criados).toBe(1);
    expect(r.mensagensErro[0]).toContain('falha de rede');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/stf/__tests__/persistir.test.ts`
Expected: FAIL — `Failed to resolve import "../persistir"`.

- [ ] **Step 3: Write minimal implementation**

Criar `lib/stf/persistir.ts`:

```typescript
/**
 * Persistência das decisões do STF em `TribunalDecision`.
 *
 * Compartilhado entre o backfill por script (Fase 1) e a rota de ingestão
 * alimentada pelo runner (Fase 2) — um único núcleo para o passivo e para o
 * fluxo novo, de modo que a base não cresça descatalogada.
 */

import { prisma } from '@/lib/prisma';
import {
  classifyDecision,
  generateDecisionSummary,
  type ClassificationResult,
} from '@/lib/tribunal-scrapers/classifier';
import { setLeiArticles } from '@/lib/lei-articles';
import { normalizeTribunalCode } from '@/lib/tribunal-scrapers/utils';
import type { StfDecisaoNormalizada } from './types';

export const SOURCE_API_STF = 'stf-jurisprudencia-api';
export const TRIBUNAL_NAME_STF = 'Supremo Tribunal Federal';

export interface OpcoesPersistencia {
  dryRun?: boolean;
  forcar?: boolean;
}

export interface ResultadoPersistenciaStf {
  criados: number;
  atualizados: number;
  ignorados: number;
  erros: number;
  mensagensErro: string[];
}

export function montarDadosStf(
  d: StfDecisaoNormalizada,
  classification: ClassificationResult,
  summary: string | null
) {
  return {
    tribunalCode: normalizeTribunalCode('stf'),
    tribunalName: TRIBUNAL_NAME_STF,
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

    // Amarração à norma vem SÓ do campo estruturado do STF
    // (documental_legislacao_citada_texto). A heurística de texto do
    // classificador captaria "art. 37 da Constituição" como artigo da 14.133 —
    // é a classe de erro que já custou caro no motor do TCU.
    ...setLeiArticles(d.artigos14133),

    suggestedCourses: classification.suggestedCourses,
    sourceApi: SOURCE_API_STF,
    sourceId: d.sourceId,
    sourceRawData: JSON.stringify({
      classe: d.classe,
      uf: d.uf,
      repercussaoGeral: d.repercussaoGeral,
      tema: d.tema,
      tese: d.tese,
      indexacao: d.indexacao,
      ementaTruncada: d.ementaTruncada,
    }),
    approvalStatus: classification.approvalStatus,
    confidence: classification.confidence,
    classificationReasoning: classification.reasoning,
  };
}

export async function persistirDecisoesStf(
  decisoes: StfDecisaoNormalizada[],
  opcoes: OpcoesPersistencia
): Promise<ResultadoPersistenciaStf> {
  const r: ResultadoPersistenciaStf = {
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
        select: { id: true },
      });

      if (existente && !opcoes.forcar) {
        r.ignorados++;
        continue;
      }

      const classification = await classifyDecision({
        title: d.title,
        ementa: d.ementa,
        decisionType: d.decisionType,
        tribunalCode: 'STF',
      });

      const summary =
        classification.approvalStatus === 'auto_approved'
          ? await generateDecisionSummary({
              title: d.title,
              ementa: d.ementa,
              decisionType: d.decisionType,
              tribunalCode: 'STF',
            })
          : null;

      const data = montarDadosStf(d, classification, summary);

      if (opcoes.dryRun) {
        if (existente) r.atualizados++;
        else r.criados++;
        continue;
      }

      if (existente) {
        await prisma.tribunalDecision.update({
          where: { fullIdentifier: d.fullIdentifier },
          data,
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

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/stf/__tests__/persistir.test.ts`
Expected: PASS — 12 testes.

- [ ] **Step 5: Commit**

```bash
git add lib/stf/persistir.ts lib/stf/__tests__/persistir.test.ts
git commit -m "feat(stf): persistência em TribunalDecision com amarração determinística à norma"
```

---

### Task 5: Script de backfill e execução real

**Files:**
- Create: `scripts/import-stf-jurisprudencia.ts`
- Modify: `package.json` (adicionar script `import:stf`)

**Interfaces:**
- Consumes: `normalizarDocumentoStf` (Task 2), `selecionarRecorte` (Task 3), `persistirDecisoesStf` (Task 4).
- Produces: comando `npm run import:stf -- [--dry-run] [--limit N] [--force]`.

Este task não tem teste unitário próprio: o núcleo já está coberto pelas Tasks 1–4 e o script é fiação. A verificação é a execução real contra o corpus, com números esperados exatos.

- [ ] **Step 1: Escrever o script**

Criar `scripts/import-stf-jurisprudencia.ts`:

```typescript
/**
 * Backfill da jurisprudência do STF a partir do JSON extraído da API.
 *
 * O host jurisprudencia.stf.jus.br está atrás de um AWS WAF com desafio
 * JavaScript, de modo que a extração não pode ser feita server-side. Este
 * script consome um JSON já colhido de dentro do navegador — ver a seção
 * "O bloqueio" em docs/superpowers/plans/2026-08-16-conector-stf-jurisprudencia.md.
 *
 * Formato esperado do JSON: { gerado_em, acordaos[], monocraticas[], amplo[] }
 *
 * Uso:
 *   npm run import:stf -- --dry-run
 *   npm run import:stf -- --limit 20
 *   npm run import:stf
 *   STF_DADOS_JSON=/caminho/arquivo.json npm run import:stf
 */

import { readFileSync } from 'node:fs';
import { normalizarDocumentoStf } from '@/lib/stf/normalizar';
import { selecionarRecorte } from '@/lib/stf/recorte';
import { persistirDecisoesStf } from '@/lib/stf/persistir';
import type { StfDocumentoBruto, StfDecisaoNormalizada } from '@/lib/stf/types';

const CAMINHO_PADRAO =
  'D:/OneDrive/XX - Arquivos/Documentos/STF_licitacoes/stf_lei14133_dados_2026-08-16.json';

interface CorpusStf {
  gerado_em?: string;
  acordaos?: StfDocumentoBruto[];
  monocraticas?: StfDocumentoBruto[];
  amplo?: StfDocumentoBruto[];
}

function arg(nome: string): string | null {
  const i = process.argv.indexOf(nome);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const forcar = process.argv.includes('--force');
  const limiteRaw = arg('--limit');
  const limite = limiteRaw ? Number(limiteRaw) : null;
  const caminho = process.env.STF_DADOS_JSON || CAMINHO_PADRAO;

  console.log('=== Backfill STF — jurisprudência de licitações ===');
  console.log(`Fonte: ${caminho}`);
  if (dryRun) console.log('(DRY RUN — nada será gravado)');

  const corpus: CorpusStf = JSON.parse(readFileSync(caminho, 'utf-8'));
  const brutos = [
    ...(corpus.acordaos || []),
    ...(corpus.monocraticas || []),
    ...(corpus.amplo || []),
  ];
  console.log(`Documentos brutos: ${brutos.length}`);

  const normalizados = brutos
    .map(normalizarDocumentoStf)
    .filter((d): d is StfDecisaoNormalizada => d !== null);
  console.log(`Normalizados: ${normalizados.length}`);

  let selecionados = selecionarRecorte(normalizados);
  console.log(`Selecionados pelo recorte: ${selecionados.length}`);

  const comArtigos = selecionados.filter(d => d.artigos14133.length > 0).length;
  const comTese = selecionados.filter(d => d.tese).length;
  const truncados = selecionados.filter(d => d.ementaTruncada).length;
  console.log(`  com dispositivos da 14.133: ${comArtigos}`);
  console.log(`  com tese oficial firmada:   ${comTese}`);
  console.log(`  com texto truncado em 6000: ${truncados}`);

  if (limite && limite > 0) {
    selecionados = selecionados.slice(0, limite);
    console.log(`Limitado a ${selecionados.length} documentos.`);
  }

  const r = await persistirDecisoesStf(selecionados, { dryRun, forcar });

  console.log('\n=== Resultado ===');
  console.log(`criados=${r.criados} atualizados=${r.atualizados} ignorados=${r.ignorados} erros=${r.erros}`);
  for (const m of r.mensagensErro.slice(0, 10)) console.log(`  ERRO ${m}`);

  if (r.erros > 0) process.exitCode = 1;
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Adicionar o script ao package.json**

Em `package.json`, dentro de `"scripts"`, acrescentar:

```json
"import:stf": "tsx --env-file=.env.local scripts/import-stf-jurisprudencia.ts"
```

- [ ] **Step 3: Rodar em dry-run e conferir os números medidos**

Run: `npm run import:stf -- --dry-run`

Expected — exatamente estes valores; qualquer divergência é bug no recorte ou na normalização:

```
Documentos brutos: 2516
Normalizados: 2516
Selecionados pelo recorte: 598
```

Se `Selecionados` vier diferente de 598, parar e depurar antes de gravar. Para localizar em qual recorte está a divergência, rodar a decomposição:

```bash
npx tsx --env-file=.env.local -e "
import { readFileSync } from 'node:fs';
import { normalizarDocumentoStf } from '@/lib/stf/normalizar';
import { selecionarRecorte } from '@/lib/stf/recorte';
const c = JSON.parse(readFileSync(process.env.STF_DADOS_JSON || 'D:/OneDrive/XX - Arquivos/Documentos/STF_licitacoes/stf_lei14133_dados_2026-08-16.json', 'utf-8'));
for (const k of ['acordaos','monocraticas','amplo']) {
  const n = (c[k]||[]).map(normalizarDocumentoStf).filter(Boolean);
  console.log(k, selecionarRecorte(n).length);
}"
```

Expected: `acordaos 56` · `monocraticas 154` · `amplo 437`. A soma é 647; os 49 restantes até 598 são as duplicatas entre `acordaos` e `amplo`, removidas pelo dedup por `sourceId` quando os três recortes passam juntos.

- [ ] **Step 4: Rodar um lote pequeno de verdade**

Run: `npm run import:stf -- --limit 20`
Expected: `criados=20 atualizados=0 ignorados=0 erros=0`

Conferir no banco:

```bash
npx tsx --env-file=.env.local -e "import {prisma} from '@/lib/prisma'; const d = await prisma.tribunalDecision.findMany({where:{tribunalCode:'STF'},select:{fullIdentifier:true,title:true,leiArticlesArr:true,embeddingStatus:true},take:5}); console.log(d); await prisma.\$disconnect();"
```

Expected: `fullIdentifier` no formato `STF sjur…`, `embeddingStatus: 'pending'`, e `leiArticlesArr` com números puros (`['75']`, nunca `['Art. 75']`).

- [ ] **Step 5: Rodar o backfill completo**

Run: `npm run import:stf`
Expected: `criados=578 atualizados=0 ignorados=20 erros=0` (os 20 do lote anterior são ignorados).

- [ ] **Step 6: Commit**

```bash
git add scripts/import-stf-jurisprudencia.ts package.json
git commit -m "feat(stf): script de backfill da jurisprudência do STF"
```

---

### Task 6: Read path — badge do STF no admin

**Files:**
- Modify: `lib/admin/tribunal-decisions/format.ts:22-33`
- Test: `lib/admin/tribunal-decisions/__tests__/format.test.ts` (criar se não existir)

**Interfaces:**
- Consumes: nada.
- Produces: `tribunalColor('STF')` deixa de cair no cinza genérico.

`TRIBUNAL_CODES` em `app/api/jurisprudencia/route.ts:20` **já contém `'STF'`** e `lib/clipping/tribunal-branding.ts:24` **já tem o branding** (`Supremo Tribunal Federal`, `#7c2d12`). Confirmar antes de mexer; não duplicar.

- [ ] **Step 1: Write the failing test**

Criar (ou acrescentar a) `lib/admin/tribunal-decisions/__tests__/format.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { tribunalColor } from '../format';

describe('tribunalColor', () => {
  it('dá cor própria ao STF', () => {
    expect(tribunalColor('STF')).toBe('bg-amber-100 text-amber-900');
  });

  it('mantém as cores já existentes', () => {
    expect(tribunalColor('TCU')).toBe('bg-red-100 text-red-800');
    expect(tribunalColor('TCE-PE')).toBe('bg-teal-100 text-teal-800');
  });

  it('cai no cinza para tribunal desconhecido', () => {
    expect(tribunalColor('XYZ')).toBe('bg-gray-100 text-gray-800');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/admin/tribunal-decisions/__tests__/format.test.ts`
Expected: FAIL — `expected 'bg-gray-100 text-gray-800' to be 'bg-amber-100 text-amber-900'`.

- [ ] **Step 3: Write minimal implementation**

Em `lib/admin/tribunal-decisions/format.ts`, no objeto `TRIBUNAL_COLORS`, acrescentar após a linha do `TST`:

```typescript
  STF: 'bg-amber-100 text-amber-900',
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/admin/tribunal-decisions/__tests__/format.test.ts`
Expected: PASS — 3 testes.

- [ ] **Step 5: Rodar a suíte inteira e commitar**

Run: `npm run test:run`
Expected: PASS, sem regressão.

```bash
git add lib/admin/tribunal-decisions/format.ts lib/admin/tribunal-decisions/__tests__/format.test.ts
git commit -m "feat(stf): badge do STF no admin de decisões"
```

**Marco:** ao fim da Task 6 o STF está em produção com 598 julgados, filtráveis por `?tribunal=STF`, com embeddings sendo gerados pelo cron `process-index-jobs` e com amarração artigo↔julgado alimentando a Lei Comentada. A Fase 2 pode ser adiada sem que nada disso regrida.

---

## FASE 2 — Fluxo contínuo

### Task 7: Montador da consulta Elasticsearch

**Files:**
- Create: `lib/stf/consulta.ts`
- Test: `lib/stf/__tests__/consulta.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `CAMPOS_BUSCA_STF`, `CAMPOS_FONTE_STF`, `URL_API_STF`, `montarCorpoConsulta(opcoes: OpcoesConsultaStf): object` e o tipo `OpcoesConsultaStf { termo, base, dataInicio?, dataFim?, tamanho?, desloc? }`.

Este módulo é puro de propósito: o mesmo corpo de consulta é usado pelo runner Node e injetado dentro da página do navegador na Task 9.

- [ ] **Step 1: Write the failing test**

Criar `lib/stf/__tests__/consulta.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { montarCorpoConsulta, CAMPOS_BUSCA_STF, URL_API_STF } from '../consulta';

describe('montarCorpoConsulta', () => {
  it('filtra pela base pedida', () => {
    const c = montarCorpoConsulta({ termo: '"Lei 14.133"', base: 'acordaos' }) as any;
    expect(c.query.bool.filter[0]).toEqual({ term: { base: 'acordaos' } });
  });

  it('usa AND como operador padrão sobre os campos de busca', () => {
    const c = montarCorpoConsulta({ termo: '"Lei 14.133"', base: 'acordaos' }) as any;
    expect(c.query.bool.filter[1].query_string).toMatchObject({
      query: '"Lei 14.133"',
      default_operator: 'AND',
      fields: CAMPOS_BUSCA_STF,
    });
  });

  it('acrescenta faixa de datas só quando pedida', () => {
    const sem = montarCorpoConsulta({ termo: 'licitação', base: 'acordaos' }) as any;
    expect(sem.query.bool.filter).toHaveLength(2);

    const com = montarCorpoConsulta({
      termo: 'licitação',
      base: 'acordaos',
      dataInicio: '2021-04-01',
    }) as any;
    expect(com.query.bool.filter[2]).toEqual({
      range: { julgamento_data: { gte: '2021-04-01' } },
    });
  });

  it('ordena por julgamento decrescente e pede o total real', () => {
    const c = montarCorpoConsulta({ termo: 'x', base: 'decisoes' }) as any;
    expect(c.sort).toEqual([{ julgamento_data: 'desc' }]);
    expect(c.track_total_hits).toBe(true);
  });

  it('pagina com size e from', () => {
    const c = montarCorpoConsulta({ termo: 'x', base: 'acordaos', tamanho: 50, desloc: 100 }) as any;
    expect(c.size).toBe(50);
    expect(c.from).toBe(100);
  });

  it('aponta para o endpoint público do STF', () => {
    expect(URL_API_STF).toBe('https://jurisprudencia.stf.jus.br/api/search/search');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/stf/__tests__/consulta.test.ts`
Expected: FAIL — `Failed to resolve import "../consulta"`.

- [ ] **Step 3: Write minimal implementation**

Criar `lib/stf/consulta.ts`:

```typescript
/**
 * Montagem do corpo da consulta ao índice de jurisprudência do STF.
 *
 * Puro de propósito: o mesmo objeto é serializado pelo runner (Node) e
 * injetado dentro da página do navegador, que é quem de fato executa o fetch —
 * o host está atrás de um AWS WAF com desafio JavaScript.
 */

export const URL_API_STF = 'https://jurisprudencia.stf.jus.br/api/search/search';

export const CAMPOS_BUSCA_STF = [
  'ementa_texto',
  'decisao_texto',
  'acordao_ata',
  'documental_tese_texto',
  'documental_tese_tema_texto',
  'documental_legislacao_citada_texto',
  'documental_indexacao_texto',
] as const;

export const CAMPOS_FONTE_STF = [
  'base',
  'id',
  'titulo',
  'processo_classe_processual_unificada_classe_sigla',
  'processo_classe_processual_unificada_extenso',
  'processo_numero',
  'relator_processo_nome',
  'relator_acordao_nome',
  'relator_decisao_nome',
  'orgao_julgador',
  'julgamento_data',
  'publicacao_data',
  'is_repercussao_geral',
  'procedencia_geografica_uf_sigla',
  'ementa_texto',
  'decisao_texto',
  'documental_tese_texto',
  'documental_tese_tema_texto',
  'documental_legislacao_citada_texto',
  'documental_indexacao_texto',
] as const;

export interface OpcoesConsultaStf {
  termo: string;
  base: 'acordaos' | 'decisoes';
  dataInicio?: string;
  dataFim?: string;
  tamanho?: number;
  desloc?: number;
}

export function montarCorpoConsulta(o: OpcoesConsultaStf): object {
  const filter: object[] = [
    { term: { base: o.base } },
    {
      query_string: {
        query: o.termo,
        default_operator: 'AND',
        fields: [...CAMPOS_BUSCA_STF],
      },
    },
  ];

  const faixa: Record<string, string> = {};
  if (o.dataInicio) faixa.gte = o.dataInicio;
  if (o.dataFim) faixa.lte = o.dataFim;
  if (Object.keys(faixa).length > 0) {
    filter.push({ range: { julgamento_data: faixa } });
  }

  return {
    query: { bool: { filter } },
    _source: [...CAMPOS_FONTE_STF],
    size: o.tamanho ?? 200,
    from: o.desloc ?? 0,
    sort: [{ julgamento_data: 'desc' }],
    track_total_hits: true,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/stf/__tests__/consulta.test.ts`
Expected: PASS — 6 testes.

- [ ] **Step 5: Commit**

```bash
git add lib/stf/consulta.ts lib/stf/__tests__/consulta.test.ts
git commit -m "feat(stf): montador da consulta ao índice do STF"
```

---

### Task 8: Rota de ingestão autenticada

**Files:**
- Create: `app/api/ingest/stf/route.ts`
- Test: `app/api/ingest/stf/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `verifyCronAuth` de `@/lib/cron-auth`; `normalizarDocumentoStf` (Task 2); `selecionarRecorte` (Task 3); `persistirDecisoesStf` (Task 4); `logScraperHealth` de `@/lib/tribunal-scrapers/utils`.
- Produces: `POST /api/ingest/stf` recebendo `{ documentos: StfDocumentoBruto[] }` e devolvendo `{ success, recebidos, selecionados, criados, atualizados, ignorados, erros }`.

O `scraperCode` registrado é `'stf-runner'` — nome distinto de propósito. O cron `tribunal-scraper-health` já lê `ScraperHealthLog` agregado e marca como unhealthy após 3 falhas consecutivas, então o STF entra no monitoramento existente sem nenhuma linha nova de infraestrutura. Um lote vazio conta como **falha**, não como sucesso: ausência de dado é ambígua, e falha visível é preferível a falha terminal silenciosa.

- [ ] **Step 1: Write the failing test**

Criar `app/api/ingest/stf/__tests__/route.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const { mockVerify, mockPersistir, mockHealth } = vi.hoisted(() => ({
  mockVerify: vi.fn(),
  mockPersistir: vi.fn(),
  mockHealth: vi.fn(),
}));

vi.mock('@/lib/cron-auth', () => ({ verifyCronAuth: (...a: unknown[]) => mockVerify(...a) }));

// Mock TOTAL, sem importOriginal: carregar o módulo real puxaria
// `@/lib/prisma`, que tentaria abrir conexão no ambiente de teste.
vi.mock('@/lib/stf/persistir', () => ({
  persistirDecisoesStf: (...a: unknown[]) => mockPersistir(...a),
}));

vi.mock('@/lib/tribunal-scrapers/utils', () => ({
  logScraperHealth: (...a: unknown[]) => mockHealth(...a),
  normalizeTribunalCode: (c: string) => c.trim().toUpperCase(),
}));

import { POST, SCRAPER_CODE_STF } from '../route';

const ACORDAO = {
  base: 'acordaos',
  id: 'sjur1',
  titulo: 'ADI 7764',
  processo_classe_processual_unificada_classe_sigla: 'ADI',
  julgamento_data: '2026-02-25',
  ementa_texto: 'Ementa: LICITAÇÃO. Dispensa indevida de certame licitatório público.',
  documental_legislacao_citada_texto: ['LEG-FED   LEI-014133 ANO-2021\n ART-00075'],
};

function req(body: unknown): NextRequest {
  return new NextRequest('https://exemplo.test/api/ingest/stf', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerify.mockReturnValue(null);
  mockPersistir.mockResolvedValue({
    criados: 1, atualizados: 0, ignorados: 0, erros: 0, mensagensErro: [],
  });
});

describe('POST /api/ingest/stf', () => {
  it('rejeita requisição sem CRON_SECRET válido', async () => {
    mockVerify.mockReturnValue(NextResponse.json({ error: 'nao autorizado' }, { status: 401 }));
    const res = await POST(req({ documentos: [ACORDAO] }));
    expect(res.status).toBe(401);
    expect(mockPersistir).not.toHaveBeenCalled();
  });

  it('normaliza, aplica o recorte e persiste', async () => {
    const res = await POST(req({ documentos: [ACORDAO] }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toMatchObject({ success: true, recebidos: 1, selecionados: 1, criados: 1 });
    expect(mockPersistir).toHaveBeenCalledTimes(1);
  });

  it('registra sucesso no health log', async () => {
    await POST(req({ documentos: [ACORDAO] }));
    expect(mockHealth).toHaveBeenCalledWith(
      SCRAPER_CODE_STF, 'success', expect.objectContaining({ itemsNew: 1 })
    );
  });

  it('trata lote vazio como FALHA, não como sucesso', async () => {
    const res = await POST(req({ documentos: [] }));
    expect(res.status).toBe(422);
    expect(mockHealth).toHaveBeenCalledWith(
      SCRAPER_CODE_STF, 'failure', expect.objectContaining({
        errorMessage: expect.stringContaining('lote vazio'),
      })
    );
    expect(mockPersistir).not.toHaveBeenCalled();
  });

  it('rejeita corpo malformado', async () => {
    const res = await POST(req({ nada: true }));
    expect(res.status).toBe(400);
  });

  it('registra partial_failure quando há erros de persistência', async () => {
    mockPersistir.mockResolvedValue({
      criados: 0, atualizados: 0, ignorados: 0, erros: 1, mensagensErro: ['sjur1: boom'],
    });
    await POST(req({ documentos: [ACORDAO] }));
    expect(mockHealth).toHaveBeenCalledWith(
      SCRAPER_CODE_STF, 'partial_failure', expect.objectContaining({ itemsError: 1 })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/ingest/stf/__tests__/route.test.ts`
Expected: FAIL — `Failed to resolve import "../route"`.

- [ ] **Step 3: Write minimal implementation**

Criar `app/api/ingest/stf/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { verifyCronAuth } from '@/lib/cron-auth';
import { apiLogger } from '@/lib/logger';
import { normalizarDocumentoStf } from '@/lib/stf/normalizar';
import { selecionarRecorte } from '@/lib/stf/recorte';
import { persistirDecisoesStf } from '@/lib/stf/persistir';
import { logScraperHealth } from '@/lib/tribunal-scrapers/utils';
import type { StfDocumentoBruto, StfDecisaoNormalizada } from '@/lib/stf/types';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Código de saúde do fluxo do STF. Distinto dos scrapers do registry porque a
 * coleta acontece FORA da Vercel — num job do GitHub Actions com navegador
 * real, única via que vence o desafio JavaScript do AWS WAF do portal. O cron
 * `tribunal-scraper-health` lê este log como lê o dos demais.
 */
export const SCRAPER_CODE_STF = 'stf-runner';

/**
 * POST /api/ingest/stf
 * Recebe do runner o lote bruto do índice do STF, aplica normalização e
 * recorte e persiste. Autenticado por CRON_SECRET.
 */
export async function POST(request: NextRequest) {
  const inicio = Date.now();

  try {
    const authError = verifyCronAuth(request);
    if (authError) return authError;

    const body = (await request.json().catch(() => null)) as
      | { documentos?: StfDocumentoBruto[] }
      | null;

    if (!body || !Array.isArray(body.documentos)) {
      return NextResponse.json(
        { error: 'corpo inválido: esperado { documentos: [] }' },
        { status: 400 }
      );
    }

    const recebidos = body.documentos.length;

    // Lote vazio NUNCA é sucesso. Ausência de resposta é ambígua: pode ser
    // "nada novo" ou o WAF tendo barrado o runner silenciosamente. Falha
    // visível é preferível a falha terminal muda.
    if (recebidos === 0) {
      await logScraperHealth(SCRAPER_CODE_STF, 'failure', {
        duration: Date.now() - inicio,
        errorMessage: 'lote vazio — coleta no STF não produziu documentos',
      });
      return NextResponse.json(
        { error: 'lote vazio', recebidos: 0 },
        { status: 422 }
      );
    }

    const normalizados = body.documentos
      .map(normalizarDocumentoStf)
      .filter((d): d is StfDecisaoNormalizada => d !== null);
    const selecionados = selecionarRecorte(normalizados);

    const r = await persistirDecisoesStf(selecionados, {});
    const duration = Date.now() - inicio;

    await logScraperHealth(
      SCRAPER_CODE_STF,
      r.erros > 0 ? 'partial_failure' : 'success',
      {
        itemsFound: recebidos,
        itemsNew: r.criados,
        itemsError: r.erros,
        duration,
        errorMessage: r.mensagensErro[0],
        metadata: { selecionados: selecionados.length, atualizados: r.atualizados },
      }
    );

    apiLogger.info(
      { recebidos, selecionados: selecionados.length, ...r },
      '[Ingest STF] lote processado'
    );

    return NextResponse.json({
      success: true,
      recebidos,
      selecionados: selecionados.length,
      criados: r.criados,
      atualizados: r.atualizados,
      ignorados: r.ignorados,
      erros: r.erros,
    });
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : 'Erro desconhecido';
    Sentry.captureException(error, { tags: { ingest: 'stf' } });
    apiLogger.error({ err: error }, '[Ingest STF] erro fatal');

    await logScraperHealth(SCRAPER_CODE_STF, 'failure', {
      duration: Date.now() - inicio,
      errorMessage: mensagem,
    });

    return NextResponse.json({ error: mensagem }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/ingest/stf/__tests__/route.test.ts`
Expected: PASS — 6 testes.

- [ ] **Step 5: Commit**

```bash
git add app/api/ingest/stf/route.ts app/api/ingest/stf/__tests__/route.test.ts
git commit -m "feat(stf): rota de ingestão autenticada com saúde do runner"
```

---

### Task 9: Runner Playwright e agendamento

**Files:**
- Create: `scripts/stf-runner.ts`
- Create: `.github/workflows/stf-jurisprudencia.yml`
- Modify: `.env.example` (documentar `STF_INGEST_URL`)

**Interfaces:**
- Consumes: `montarCorpoConsulta`, `URL_API_STF` (Task 7); `POST /api/ingest/stf` (Task 8).
- Produces: job semanal que alimenta a base sem intervenção humana.

`playwright@^1.60.0` já está em `devDependencies` — não instalar de novo.

- [ ] **Step 1: Escrever o runner**

Criar `scripts/stf-runner.ts`:

```typescript
/**
 * Coleta semanal da jurisprudência do STF.
 *
 * O host jurisprudencia.stf.jus.br fica atrás de um AWS WAF que responde
 * HTTP 202 + `x-amzn-waf-action: challenge` a qualquer cliente que não execute
 * o desafio JavaScript. Verificado em 16/08/2026: nem headers completos de
 * navegador nem reuso de sessão passam. Por isso a consulta é feita DENTRO de
 * um Chromium real, via page.evaluate, e só o resultado viaja para a rota de
 * ingestão do site.
 *
 * Uso local:
 *   STF_INGEST_URL=http://localhost:3000/api/ingest/stf \
 *   CRON_SECRET=... npx tsx scripts/stf-runner.ts
 */

import { chromium } from 'playwright';
import { montarCorpoConsulta } from '@/lib/stf/consulta';

const PAGINA_BUSCA = 'https://jurisprudencia.stf.jus.br/pages/search';
const CAMINHO_API = '/api/search/search';
const DIAS_JANELA = 30;

function dataLimite(dias: number): string {
  const d = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const ingestUrl = process.env.STF_INGEST_URL;
  const cronSecret = process.env.CRON_SECRET;

  if (!ingestUrl || !cronSecret) {
    console.error('STF_INGEST_URL e CRON_SECRET são obrigatórios.');
    process.exit(1);
  }

  const desde = dataLimite(DIAS_JANELA);
  const consultas = [
    montarCorpoConsulta({ termo: '"Lei 14.133"', base: 'acordaos', dataInicio: desde }),
    montarCorpoConsulta({ termo: '"Lei 14.133"', base: 'decisoes', dataInicio: desde }),
    montarCorpoConsulta({
      termo: 'licitação OR licitações OR licitatório OR licitatória',
      base: 'acordaos',
      dataInicio: desde,
    }),
  ];

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const documentos: unknown[] = [];

  try {
    await page.goto(PAGINA_BUSCA, { waitUntil: 'networkidle', timeout: 120_000 });

    for (const corpo of consultas) {
      const lote = await page.evaluate(
        async ([caminho, body]) => {
          const r = await fetch(caminho as string, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          if (r.status !== 200) {
            throw new Error(`STF respondeu ${r.status} (waf=${r.headers.get('x-amzn-waf-action')})`);
          }
          const json = await r.json();
          return (json?.result?.hits?.hits || []).map((h: { _source: unknown }) => h._source);
        },
        [CAMINHO_API, corpo] as const
      );

      console.log(`consulta devolveu ${lote.length} documentos`);
      documentos.push(...lote);
    }
  } finally {
    await browser.close();
  }

  console.log(`total coletado: ${documentos.length}`);

  const res = await fetch(ingestUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cronSecret}`,
    },
    body: JSON.stringify({ documentos }),
  });

  const json = await res.json();
  console.log(`ingestão respondeu ${res.status}:`, JSON.stringify(json));

  // A rota devolve 422 para lote vazio de propósito — o job precisa ficar
  // vermelho nesse caso, não verde e mudo.
  if (!res.ok) process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Escrever o workflow**

Criar `.github/workflows/stf-jurisprudencia.yml`:

```yaml
name: STF — coleta de jurisprudência

on:
  schedule:
    # Segunda-feira, 8h UTC (5h BR) — depois do cron semanal de tribunais.
    - cron: '0 8 * * 1'
  workflow_dispatch:

jobs:
  coletar:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: npm

      - run: npm ci

      - run: npx playwright install --with-deps chromium

      - name: Coletar no STF e enviar para ingestão
        run: npx tsx scripts/stf-runner.ts
        env:
          STF_INGEST_URL: ${{ secrets.STF_INGEST_URL }}
          CRON_SECRET: ${{ secrets.CRON_SECRET }}
```

- [ ] **Step 3: Documentar a variável nova**

Em `.env.example`, na seção de crons (junto de `CRON_SECRET`), acrescentar:

```bash
# Runner do STF (GitHub Actions) — URL da rota de ingestão em produção.
# Usada só pelo workflow .github/workflows/stf-jurisprudencia.yml.
# Configurar também como secret no repositório do GitHub, junto de CRON_SECRET.
STF_INGEST_URL=https://sitedobarral.com.br/api/ingest/stf
```

- [ ] **Step 4: Testar o runner localmente contra o dev server**

Em um terminal: `npm run dev`

Em outro:

```bash
STF_INGEST_URL=http://localhost:3000/api/ingest/stf CRON_SECRET=<valor do .env.local> npx tsx scripts/stf-runner.ts
```

Expected: cada consulta imprime uma contagem > 0 e a ingestão responde 200 com `success: true`. Se aparecer `STF respondeu 202 (waf=challenge)`, o desafio não foi vencido — aumentar o `waitUntil` para `'load'` seguido de `page.waitForTimeout(5000)` antes do primeiro `evaluate`, e só então reexecutar.

- [ ] **Step 5: Configurar os secrets e disparar o workflow à mão**

```bash
gh secret set STF_INGEST_URL --body "https://sitedobarral.com.br/api/ingest/stf"
gh secret set CRON_SECRET --body "<mesmo valor da Vercel>"
gh workflow run stf-jurisprudencia.yml
gh run watch
```

Expected: job verde; log da ingestão com `success: true`.

- [ ] **Step 6: Conferir o health log**

```bash
npx tsx --env-file=.env.local -e "import {prisma} from '@/lib/prisma'; const l = await prisma.scraperHealthLog.findMany({where:{scraperCode:'stf-runner'},orderBy:{createdAt:'desc'},take:3}); console.log(l); await prisma.\$disconnect();"
```

Expected: registro `status: 'success'` com `itemsFound` > 0.

- [ ] **Step 7: Commit**

```bash
git add scripts/stf-runner.ts .github/workflows/stf-jurisprudencia.yml .env.example
git commit -m "feat(stf): runner Playwright no GitHub Actions para o fluxo contínuo"
```

---

## Riscos conhecidos

| Risco | Sinal | Mitigação |
|---|---|---|
| O `id` do índice do STF (`sjur…`) não ser estável entre extrações | duplicatas do mesmo julgado com `fullIdentifier` diferente | auditar após o 2º ciclo do runner contando `title` repetidos com `sourceId` distinto |
| O STF endurecer o WAF a ponto de bloquear também o Chromium do Actions | job vermelho, `stf-runner` unhealthy | o backfill da Fase 1 permanece íntegro; reavaliar a via de export manual |
| Reclamações voltarem pela porta dos acórdãos | volume súbito de `Rcl` na base | `sourceRawData.classe` permite medir sem reprocessar |
| Texto de monocrática truncado em 6.000 chars ser tratado como inteiro teor | citação incompleta na busca | `sourceRawData.ementaTruncada` marca cada caso; `fullText` fica nulo de propósito |
| Custo de LLM no backfill (598 chamadas de classificação + resumo) | fatura | rodar `--limit` em lotes; `classifyDecision` é keyword-first e só cai em Gemini nos casos pendentes |

## O que fica fora e por quê

- **Registro no `lib/tribunal-scrapers/index.ts`:** um scraper server-side registrado falharia sempre contra o WAF e poluiria o monitoramento. O STF segue o modelo do TCU e do TST — pipeline próprio escrevendo em `TribunalDecision`.
- **Filtro por classe processual na API pública:** exigiria alterar `z.enum` sem demanda concreta.
- **`DocumentMetaStf`:** `sourceRawData` resolve a v1 sem migration.
- **Inteiro teor em PDF:** `redir.stf.jus.br` está atrás do mesmo WAF.

---

## Errata — estado final do código (pós-execução)

Esta seção foi acrescentada após a revisão final da branch `feat/conector-stf` (16/08/2026). Os blocos de código acima registram o que foi **briefado** aos implementadores nas Tasks 1-9; eles não são reescritos aqui porque são o registro histórico do que foi passado adiante — inclusive dos pontos em que o plano errou. O código final diverge do texto do plano nos dez pontos abaixo. Ledger completo: `.superpowers/sdd/2026-08-16-conector-stf-jurisprudencia/progress.md`.

| # | O plano diz | O código faz |
|---|---|---|
| 1 | `decisionNumber` por `/(\d[\d.]*)\s*$/` (linha 558) | `/(\d[\d.]*)/` — primeira corrida de dígitos |
| 2 | `year` cai direto no ano corrente (linha 569) | julgamento → publicação → corrente |
| 3 | `ementaTruncada` mede comprimento colapsado (linha 572) | mede o bruto via `textoBruto()` |
| 4 | `new Set(['Rcl'])`, case-sensitive (linha 745) | `new Set(['RCL'])` + `.trim().toUpperCase()` |
| 5 | `persistir.ts` sem preservação de julgamento humano | tem `montarDadosUpdateStf` |
| 6 | "PASS — 17 testes" na T2 (e outras contagens) | 16 casos escritos; hoje 23 no arquivo |
| 7 | T6: "criar se não existir" o arquivo de teste | o arquivo já existia; o caso foi acrescentado |
| 8 | T9 consome `URL_API_STF` | não consome (e não deve — o fetch é same-origin) |
| 9 | Riscos: "598 chamadas de classificação + resumo", "`classifyDecision` só cai em Gemini nos casos pendentes" | `useAI` default é `false` → **a classificação nunca chama LLM**; o gasto real é só ~208 resumos |
| 10 | Marco da Task 6: "ao fim da Task 6 o STF está em produção com 598 julgados, filtráveis por `?tribunal=STF`" | **252** ficam visíveis, após a regra de auto-aprovação por amarração (eram 208 antes dela) — ver abaixo |
| 11 | (não previsto no plano) | Julgado com amarração à norma é **auto-aprovado**, por decisão do dono — ver abaixo |

Os itens 9 e 10 merecem destaque à parte: não são deriva de implementação, e sim **afirmações factualmente erradas** — e são exatamente as duas que alguém vai consultar antes de decidir rodar o backfill.

**Item 9 — o custo em LLM foi superestimado em uma ordem de grandeza.** A assinatura real é `classifyDecision(decision, useAI = false)`, e o conector chama sem o segundo argumento. Ou seja, **a classificação nunca chama LLM** — é só keyword matching, offline e de graça. O gasto real do backfill inteiro é só os resumos gerados via Gemini para os documentos `auto_approved` (~208 chamadas de ~300 tokens de saída cada), centavos de dólar, não os "598 chamadas de classificação + resumo" que a tabela de riscos do plano projetava.

**Item 10 — o marco de produção está errado por um fator de ~3.** Dos 598 julgados que o recorte seleciona, o gate de aprovação de leitura (`isRelevant = true AND approvalStatus IN ('auto_approved','manually_approved')`, usado por `/api/jurisprudencia?tribunal=STF` e pelo cron de indexação) só deixa **208** visíveis — e só esses 208 ganham embeddings. Medido sobre os 598 reais: 208 `auto_approved`, 246 `pending` (ficam na fila de revisão manual — carga operacional nova, não mencionada em nenhum outro ponto do plano), 144 `auto_rejected`. O efeito é mais severo justamente onde o conector mais importa: dos **112 documentos com dispositivos da Lei 14.133 amarrados** — a amarração determinística artigo↔julgado que é a razão de existir deste trabalho — só **68** ficam visíveis; os outros 44 nascem gravados e invisíveis. Isso não é um bug do código do STF — o gate é pré-existente e funciona como projetado — mas é uma discrepância material entre o prometido e o entregue, e precisa ser decidida conscientemente antes do backfill, não descoberta depois.

**Item 11 — a decisão que resolveu o item 10: auto-aprovação por amarração autoritativa.** Diante dos números acima, o dono do projeto decidiu que julgado com `artigos14133.length > 0` passa a ser aprovado automaticamente, independentemente do escore de palavra-chave do classificador. O fundamento é que `artigos14133` vem do campo estruturado `documental_legislacao_citada_texto` da própria API do STF: se o STF diz que aquele acórdão cita o art. 75 da Lei 14.133, ele é relevante para um site sobre a Lei 14.133 — fonte **autoritativa**, não heurística. Implementado em `aplicarAmarracaoAutoritativa()` (`lib/stf/persistir.ts`), aplicada logo após `classifyDecision` para que a geração de resumo enxergue o veredito sobreposto; o `reasoning` gravado registra que a aprovação veio da legislação citada, e não do escore, para quem abrir o admin. `relevanceScore`, `themes` e `confidence` continuam refletindo o que o classificador mediu. A preservação de julgamento humano vence a regra: registro com `reviewedBy` preenchido mantém o `approvalStatus` do admin.

Efeito medido sobre os 598 reais, rodando o código final: visíveis **208 → 252**; fila de revisão manual **246 → 210**; e, o que motivou a decisão, amarrações à norma visíveis **68 de 112 → 112 de 112**. Custo adicional no backfill: 44 resumos Gemini.
