# Guia de Importação de Atos Normativos

Como importar/atualizar `LegislativeAct` (Decretos, Leis, Instruções
Normativas, Portarias, etc.) **sem precisar de várias iterações de ajuste
manual**. Histórico de problemas resolvidos: IN 412/2025, INs 147/148/129,
Decreto 12.516, IN 5/2017 (FAQ no lugar do texto). Este guia consolida o
aprendizado.

## TL;DR — Regras de Ouro

1. **Antes de importar, valide a URL.** Atos do gov.br/compras têm dois
   caminhos com nomes parecidos:
   - ✅ Texto oficial: `/legislacao/instrucoes-normativas/<slug>` (ou
     `/legislacao/decretos/...`, `/legislacao/leis/...`, `/legislacao/portarias/...`)
   - ❌ FAQ associado: `/perguntas-frequentes/<slug>` — **NÃO é o ato**
2. **Sempre rode `normalizeScrapedText` antes de gravar `content`/`ementa`**
   — limpa cabeçalho institucional, "Compartilhe:", anexos vazados, form
   annexes, etc.
3. **Sempre rode `normalizeIssuer` antes de gravar `issuer`** — valida
   contra a lista canônica em `lib/legislative-acts/issuers.ts`. Lança erro
   se receber valor não-canônico, forçando confirmação antes de criar
   issuer novo (em ~99% dos casos é variação de um já existente).
4. **Não invente formatação do conteúdo.** Salve texto cru limpo. O
   `formatLegalContent` em runtime aplica markdown corretamente
   (## CAPÍTULO, **Art. Nº**, etc.).
5. **Use `validateActContent` antes de salvar.** Já está plugado no scraper
   e no batch import, mas se você está escrevendo um script novo: chame
   diretamente.

## Órgãos emissores canônicos

A coluna `LegislativeAct.issuer` aceita APENAS estes valores:

| Canônico | Aliases tratados | Notas |
|---|---|---|
| `Presidência da República` | Presidência, Presidencia, PR | Decretos, Leis, MPs |
| `SEGES` | SEGES/MGI, SEGES/ME, SEGES/MP, AUTOR/ME, ME, SESGES | Atual MGI; antes era ME (2018-22), antes MPOG. Histórico do mesmo órgão sempre vira SEGES |
| `MPOG` | MP, Ministério do Planejamento | INs históricas pre-2018 (preserva distinção das atuais SEGES) |
| `MF` | Ministério da Fazenda | Portarias fiscais (suprimento de fundos, CPGF) |
| `SGD/MGI` | SGD | Secretaria de Governo Digital — distinta de SEGES |
| `TCU` | — | Tribunal de Contas da União |
| `MPU` | — | Ministério Público da União |
| `CICS/MGI` | — | Comissão Inter-secretarial |
| `CIIA-PAC/CC` | — | Comissão Interministerial PAC/Casa Civil |

**Não adicione issuer novo sem confirmação explícita** — abrir issuer novo
em `ISSUER_ALIASES` deve ser passado pelo mantenedor, porque em geral é
variação de um já existente.

## Sinais de Erro

A página renderizada tem **um destes sintomas**? Volte aqui e cheque a
checklist abaixo:

| Sintoma na página | Causa provável | Onde corrigir |
| --- | --- | --- |
| Texto começa com `1 - ASPECTOS GERAIS` | URL é página FAQ | trocar `officialUrl` |
| Lista de bullets `• X • Y • Z` no início | Sidebar do gov.br vazada | rodar `normalizeScrapedText` |
| Caput e Parágrafo único colados num parágrafo só | Parser não detectou structural break | `formatLegalContent` corrigido em 2026-05-01 |
| Incisos `II - ... III - ...` na mesma linha | Mesmo bug acima | já corrigido |
| `Brasão do Brasil / Diário Oficial` no topo | Masthead DOU não removido | `stripDouBoilerplate` |
| `Compartilhe: Facebook Twitter ...` no fim | Footer gov.br não removido | `stripGovbrUiNoise` |
| `<NOME DO FISCAL>` colado no fim | Form annex não removido | `stripFormAnnex` |
| `Art. 21º` (ordinal em artigo ≥ 10) | Bug do componente render | corrigido pra Lei 14.133 (`ArticleFull.tsx`) |
| Texto cortado no meio | Limite de payload do scraper | já é 5MB (era 500KB pré-2026-04-25) |

## URLs Corretas vs Erradas (gov.br/compras)

```
✅ https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao/
   instrucoes-normativas/instrucao-normativa-no-5-de-26-de-maio-de-2017-atualizada

❌ https://www.gov.br/compras/pt-br/acesso-a-informacao/perguntas-frequentes/
   instrucao-normativa-de-servicos-in-no-5-de-2017
```

**Heurística:** se a URL contém `perguntas-frequentes`, `faq` ou
`duvidas-frequentes`, é página de Q&A, não o ato.

## Pipeline Recomendado

### 1) Importar via JSON em batch

`scripts/import-legislative-acts-batch.ts` aceita JSON e roda o pipeline
completo:

```bash
npx dotenv -e .env.local -- npx tsx scripts/import-legislative-acts-batch.ts \
  --file=path/to/atos.json --dry-run
```

O batch já chama:
- `normalizeScrapedText` em `ementa`, `summary`, `content`
- `validateActContent` em `content` + `officialUrl` (bloqueia erros)
- `detectAndSaveRelationsHybrid` (cria relações entre atos)

**Flags úteis:**
- `--dry-run`: simula sem escrever no DB
- `--allow-clearing`: aceita zerar campos populados (default: bloqueia)
- `--allow-invalid-content`: aceita conteúdo que falhou validação (default:
  bloqueia)

### 2) Re-scraping de UM ato específico

Quando descobrir que um ato tem URL errada ou conteúdo poluído, use
`scripts/fix-in-5-2017-content.ts` como template. Pipeline:

```typescript
// 1. Scrape da URL correta
const result = await scraper.scrape(NEW_URL);

// 2. Validar antes de gravar
const validation = validateActContent({ url: NEW_URL, content: result.content });
if (validation.errors.length) throw new Error(`Inválido: ${validation.errors.join('; ')}`);

// 3. UPDATE no DB
await prisma.legislativeAct.update({
  where: { id: actId },
  data: {
    officialUrl: NEW_URL,
    content: result.content,
    contentHash: result.contentHash,
    embeddingStatus: 'pending',
  },
});

// 4. Limpar chunks antigos (campo é `legislativeActId`, NÃO `actId`)
await prisma.legislativeActChunk.deleteMany({
  where: { legislativeActId: actId },
});

// 5. Reindexar embeddings
await processLegislativeAct(actId, { forceReprocess: true });
```

### 3) Cron `check-legislative-updates`

Roda segundas 3h UTC. Já chama `scrapeUrl()` que aplica
`normalizeScrapedText` + `validateActContent`. Se um ato passa a falhar
validação após o scrape, o `result.validation.errors` vai aparecer no log.

## Padrão de Formatação Esperado

Salve o `content` como **texto cru limpo**. O renderer (`formatLegalContent`
+ `MarkdownContent`) cuida do resto:

```
INSTRUÇÃO NORMATIVA Nº 5, DE 26 DE MAIO DE 2017 (Atualizada)

Dispõe sobre as regras e diretrizes do procedimento de contratação de serviços...

O SECRETÁRIO DE GESTÃO DO MINISTÉRIO DO PLANEJAMENTO, no uso das atribuições..., resolve:

CAPÍTULO I
DISPOSIÇÕES GERAIS

Art. 1º As contratações de serviços observarão...
I - as fases de Planejamento, Seleção e Gestão;
II - os critérios e práticas de sustentabilidade.

Seção I
Das Definições

Art. 2º Para os efeitos desta Instrução Normativa...
```

O `formatLegalContent` reconhece e formata automaticamente:

| Padrão no texto cru | Render markdown |
| --- | --- |
| `CAPÍTULO I` / `TÍTULO I` / `ANEXO I` | `## CAPÍTULO I` (h2) |
| `SEÇÃO I` / `DAS DISPOSIÇÕES GERAIS` | `### Seção I` / `### Das Disposições Gerais` (h3) |
| `SUBSEÇÃO I` ou subtítulo curto | `#### ...` (h4) |
| `Art. Nº` / `§ Nº` / `Parágrafo único.` | **negrito** inline |
| `DECRETA` / `RESOLVE` / `Brasília, ...` | `---` separador / *itálico* |
| `Este texto não substitui...` | `> *blockquote em itálico*` |

**Não pré-formate o texto com markdown** — o renderer faria dupla aplicação
e quebraria o layout. Salve cru, deixe o render decidir.

## Validações Automáticas

`lib/legislative-scrapers/validate-content.ts` — função pura `validateActContent({ url, content, previousContent? })`.

**Errors (bloqueiam import):**
- URL contém `perguntas-frequentes`, `faq` ou `duvidas-frequentes`
- Conteúdo vazio ou < 500 chars
- Início parece FAQ (`1 - ASPECTOS GERAIS`, `1.1 - Quais...`)

**Warnings (alertam mas permitem):**
- Conteúdo entre 500 e 1500 chars (suspeito de incompleto)
- Sem preâmbulo legal nos primeiros 4KB (`O SECRETÁRIO`, `O MINISTRO`,
  `O PRESIDENTE`, `Resolve:`, `Decreta:`, `Art. 1º`)
- Linha com 3+ bullets `•` (sidebar vazada)
- "Compartilhe:" residual
- "Brasão do Brasil ... Diário Oficial" residual
- `<NOME DO FISCAL/GESTOR/PREPOSTO>` residual
- Conteúdo novo é < 50% do anterior (regressão suspeita)

## Limites Conhecidos

- **Scraper payload:** 5 MB (subido em 2026-04-25 de 500KB).
- **Embeddings batch:** 100 chunks por chamada Gemini
  (`BatchEmbedContents` rejeita > 100 com `INVALID_ARGUMENT 400`).
- **Re-scraping de leis grandes** (Lei 14.133 = 273KB, IN 5/2017 = 222KB):
  cabem no payload, mas verificar `embeddingStatus` após import.

## Testes

```bash
# Validador
npx vitest run test/legislative-scrapers/validate-content.test.ts

# Pipeline normalize
npx vitest run test/legislative-scrapers/normalize.test.ts

# Tudo
npx vitest run lib/legislative-scrapers/ test/legislative-scrapers/
```

## Histórico de Problemas Resolvidos

| Data | Ato | Problema | Fix |
| --- | --- | --- | --- |
| 2026-04-25 | IN SEGES 412/2025 | Anexos lixo + "Compartilhe:" no fim | `stripGovbrUiNoise` v1 |
| 2026-04-25 | Decreto 12.516/2025 | Pontilhados feios `..........` | `cleanText` em planalto.ts converte 6+ pontos em `[...]` |
| 2026-04-25 | Vários | Cabeçalhos "Compartilhe por X" no header | `stripGovbrUiNoise` lida com header E footer |
| 2026-04-25 | Lei 14.133, Lei 8.666 | Texto cortado em 500KB | limite 5MB |
| 2026-05-01 | IN 5/2017 | FAQ no lugar do texto | URL `/perguntas-frequentes/` → `/legislacao/`, regra `validateActContent` adicionada |
| 2026-05-01 | IN 5/2017 | Sidebar de anexos vazada (3+ `•`) | regra em `stripGovbrUiNoise` |
| 2026-05-01 | IN 5/2017 | Incisos `II - ... e III - ...` mergeados | `formatLegalContent` reconhece structural starts de incisos/alíneas |
| 2026-05-01 | Lei 14.133 | Tipografia jurídica | redesign `/lei-14133` (commits `55bdb1a`/`253dfd4`) |
