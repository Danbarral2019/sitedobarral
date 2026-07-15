# Integridade da Lei 14.133 Comentada — diagnóstico, auditoria e plano corretivo

**Data:** 2026-07-15
**Origem:** 6 problemas encontrados pelo Daniel ao gravar o vídeo de lançamento
**Status:** 🟡 PROPOSTA — aguarda aprovação. Nada implementado.
**Régua editorial decidida:** vínculo por **citação direta OU tema forte** (opção B)

---

## Sumário executivo

Os 6 sintomas relatados têm **4 causas raiz distintas**. Uma delas (texto truncado)
não é problema de vitrine: compromete a fundamentação do assistente de IA, que é a
promessa central do produto.

| # | Sintoma relatado | Causa raiz | Gravidade |
|---|---|---|---|
| 6 | Texto da ON 94/2024 incompleto | Scraper corta `content` em 800 chars + delimitador de bloco prematuro | 🔴 **Crítica** |
| 5 | Erro ao baixar ON 2/2012 | Rota de download lê de `public/uploads` (inexistente), ignora R2; 57 ONs com URL de fallback | 🔴 Alta |
| 2 | Link do quadro comparativo morto | `getDocHref` aponta para rota `/atos-normativos/[id]` **que não existe** | 🔴 Alta |
| 4 | Art. 5º com 1.143 docs | Prompt pede vínculo temático; `minConfidence: 40`; proteção determinística só existe p/ Art. 6º | 🟠 Média |
| 1 | Artigos da lei como "documentos" | Categoria `lei-artigo` (substrato de busca) sem filtro nesta rota | 🟢 Baixa |
| 3 | ONs com nomenclatura inconsistente | Cron grava campo errado (`numero` em vez de `titulo`) | 🟢 Baixa |

**Custo financeiro da reanálise: irrisório (~R$ 30–80).** O gargalo é engenharia, não LLM.

---

## Parte I — Diagnóstico detalhado

### 🔴 Causa A — O texto das ONs está truncado (sintoma 6)

**O achado mais grave.** Três cortes independentes mutilam o `content`:

| Local | Corte |
|---|---|
| `lib/agu-modules/orientacoes-normativas.ts:317` | `.slice(0, 3)` — só os **3 primeiros parágrafos** |
| `lib/agu-modules/orientacoes-normativas.ts:318` | `.substring(0, 800)` — **teto de 800 chars** |
| `lib/agu-modules/orientacoes-normativas.ts:213-220` | bloco termina na próxima ocorrência de `/Orientação Normativa \d+\/\d{4}/` |
| `lib/agu-modules/orientacoes-normativas.ts:438` | `content: aguDoc.descricao` — o `content` **é** a descrição truncada |

O delimitador de bloco é o que produz o "só o inciso I": quando a ON **cita outra ON**
no corpo (comum — ex.: *"Nova redação dada pela Orientação Normativa AGU nº 80/2024"*),
o bloco é cortado exatamente ali.

**Evidência empírica** — `docs/audits/2026-04-30-ons-scraped.json` (98 ONs reais):
`content` tem **max exatamente 800**, mediana 467. A ON 94/2024 termina cortada no
meio do inciso III: `"...III - Essa atuação deve ser informada pela observância dos
princípios da Administração Pública (artigo 37, caput"`.

**Impacto no RAG — confirmado.** `lib/embeddings/source-text.ts:20-26`:
```ts
const candidates = [doc.content, doc.tcuEmentaCompleta, doc.description];
```
`content` é a **primeira escolha** para embeddings. Truncado → chunk truncado →
embedding truncado → **o assistente cita como integral uma fonte que tem 800 chars**.

**Pior ainda:** o cron `app/api/cron/import-documents/route.ts:141-165` **não grava
`content`**. ONs que entram por ele nascem com `content = null` → o fallback é
`description`, que em vários registros é **resumo gerado por IA** (visível nos logs de
auditoria: *"A Orientação Normativa AGU nº 94/2024 esclarece que..."*). Ou seja:
**texto derivado de IA alimentando o RAG como se fosse texto normativo.**

**Por que ninguém detectou:** todas as auditorias usam piso de 50 chars
(`audit-ons-residuos.ts:57`, `audit-ons-agu-page.ts:98`, `backfill-ons-from-agu-page.ts:32`).
Uma ON truncada em 800 **passa como completa**. É falso negativo, não falso positivo.
O `backfill-ons-from-agu-page.ts:113` só preenche `content` vazio (<50) —
**nunca corrige truncado-mas-não-vazio**.

**Caminhos que NÃO truncam** (a saída existe):
- `scripts/import-ons-2026.ts:89-94` — DOU via `.texto-dou`, texto integral, com
  validação de piso (`content.length < 500` → erro) e exigência do preâmbulo
  "O ADVOGADO-GERAL DA UNIÃO". Mas cobre **só ONs 103–107/2026** (lista hard-coded).
- `scripts/scrape-ons-content.ts:75-85` — DOU via `dou-paragraph`, `matchAll` (todos).
  Mas filtra `url contains 'in.gov.br'` (`:105`) — **e a ON 94/2024 tem URL da AGU,
  então é excluída**.

### 🔴 Causa B — A rota de download nunca migrou para o R2 (sintoma 5)

`app/api/documents/[id]/download/route.ts:127`:
```ts
join(process.cwd(), 'public', 'uploads')
```
- `public/uploads/` **não existe** no repositório.
- O projeto usa **Cloudflare R2** (`lib/storage/`, campos `Document.r2Key`,
  `r2UploadedAt`, `r2MigratedFrom`).
- A rota de download **nunca consulta `r2Key`** (verificado por grep — os consumidores
  de `r2Key` são upload, vídeos, crons; download ficou de fora da Fase 8).
- Em serverless o filesystem é efêmero → qualquer `url` relativa dá
  **404 "Arquivo no servidor não encontrado"**, mascarando a causa real.

**Sobre a ON 2/2012 especificamente** — `docs/audits/2026-04-30-ons-scraped.json:1409`:
```json
"numero": "ON 2/2012",
"url": "https://www.gov.br/agu/pt-br/composicao/cgu/cgu/onsagu",
"douUrl": "https://www.in.gov.br/.../portaria-agu-n-233-de-3-de-julho-de-2024-..."
```
Ela caiu no **fallback genérico** de `orientacoes-modules/orientacoes-normativas.ts:102`:
```ts
const url = onRaw.linkFundamentacao || 'https://www.gov.br/agu/pt-br/composicao/cgu/cgu/onsagu';
```
**57 ONs** têm essa mesma URL de fallback — apontam para a página-índice, não para o
documento. E o `douUrl` dela aponta para uma **Portaria 233/2024** (metadado errado,
efeito do mesmo bug de arrasto de bloco da Causa A).

### 🔴 Causa C — `getDocHref` aponta para rota inexistente (sintoma 2)

`components/lei-14133/HighlightCard.tsx:27-30`:
```ts
function getDocHref(doc: EnrichedDoc): string {
  if (doc.url) return doc.url;
  return doc.type === 'legislativeAct' ? `/atos-normativos/${doc.id}` : `/api/documents/${doc.id}/download`;
}
```
**`app/atos-normativos/` não existe.** Todo `LegislativeAct` sem `officialUrl` → 404
garantido, em qualquer artigo da lei. Não é o quadro comparativo que está quebrado —
é a função inteira.

Existe uma página de detalhe funcionando — `app/documento/[id]/page.tsx` — para a qual
`getDocHref` **nunca aponta**.

Segundo modo de falha: `Document.url` é **NOT NULL** (`schema.prisma:37`), mas aceita
string vazia. `''` é falsy → cai no `/api/documents/[id]/download` → `join(uploadsDir, '')`
resolve para o diretório → `readFile` de diretório → 404. O tipo do frontend
(`hooks/use-lei14133-preview.ts:12` declara `url?: string`) diverge do schema.

**O quadro comparativo não está em nenhum seed** — busca completa por `quadro comparativo`,
`8.666`, `8666` em `scripts/`, `prisma/`, `data/`, `backups/` não encontrou. A única
referência é `scripts/populate-lms-test.ts:92` (`'487c1978-93a', // Quadro Comparativo...`),
um prefixo de id de registro **criado pela UI de upload do admin**. Requer query no banco.

### 🟠 Causa D — A vinculação é palpite temático sem evidência persistida (sintoma 4)

**Não existe tabela de vinculação.** É um array de strings denormalizado em 7 modelos
(`Document.leiArticlesArr`, `prisma/schema.prisma:44`, + BlogPost, Publication,
GlossaryTerm, LegislativeAct, Lesson, TribunalDecision). `LeiArticle`
(`schema.prisma:1062`) não tem relação Prisma com documentos.

**A heurística é 100% LLM (Gemini), zero regex, zero embedding.** O prompt
(`lib/lei-indexer.ts:60-119`) **pede ativamente** vínculo sem citação:
- `:74` — *"Identifique artigos RELACIONADOS ao tema do documento (mesmo que não mencionados explicitamente)"*
- `:88` — *"Se o documento mencionar 'Lei 14.133' genérica sem artigo específico, identifique os temas e artigos relacionados"*
- `:78-82` — escala admite **30-49 = "tema possivelmente relacionado"** com `mentions: 0`

**Thresholds em produção — todos abaixo do default (50):**

| Caminho | minConfidence | Arquivo:linha |
|---|---|---|
| Cron TCU (acórdãos) | **40** | `app/api/cron/sync-tcu-acordaos/route.ts:131` |
| Wizard admin (geral) | **40** | `lib/ai/wizard-enhance.ts:281` |
| Wizard admin (pareceres) | 60 | `lib/ai/wizard-enhance.ts:281` |
| Clipping DOU | 50 (default) | `app/api/admin/clipping-dou/[id]/approve/route.ts:163` |

**A proteção determinística existe — mas só para o Art. 6º.** `lib/lei-indexer.ts:170`:
```ts
if (a.articleNumber === '6' && (!a.mentions || a.mentions === 0)) return false;
```
Não há equivalente para `'1'` ou `'5'`. O art. 5º (princípios) é o ímã temático natural
de qualquer texto sobre licitação — e nada o filtra. **Isso explica exatamente o padrão
observado**: 1.143 no art. 5º, 240 no art. 1º, art. 6º presumivelmente limpo.

Há regra para os arts. 1-5 em `scripts/reclassify-documents-articles.ts:194-198`, mas
**só no texto do prompt, sem filtro em código**.

**O vínculo é catraca só-de-adicionar** — `reclassify-documents-articles.ts:192`:
*"1. Mantenha TODOS os artigos ja vinculados (nunca remova)"*. O erro é monotônico:
acumula e nunca decai. O único script que remove (`reanalyze-lei-articles.ts:256`)
remove **apenas o Art. 6º**.

**O problema que impede a limpeza:** o indexador **calcula** `confidence` e `mentions`
(`ArticleMatch`, `lib/lei-indexer.ts:40-45`) e **joga os dois fora na escrita** —
`resultToLeiArticles()` (`:330-343`) faz `.map(a => a.articleNumber)`. O banco guarda
só strings. Consequência: **é impossível distinguir hoje**, num vínculo existente:
- documento que cita o art. 5º expressamente
- palpite temático de confiança 40
- link curado à mão pelo Daniel no admin (`.../link-document/route.ts:26-31` faz
  `[...current, numero]` no **mesmo array**)

Sem persistir a evidência, qualquer poda é às cegas.

### 🟢 Causa E — `lei-artigo` sem filtro nesta rota (sintoma 1)

`scripts/index-lei-artigos.ts:4` diz explicitamente: *"Cria 195 registros Document
(um por artigo) para busca semântica."* Categoria `lei-artigo`, criados como **substrato
de embeddings**, nunca para exibição.

Três superfícies escondem a categoria explicitamente:
- `app/api/area-restrita/content-tree/route.ts:47` — `const HIDDEN_CATEGORIES = ['lei-artigo'];`
- `lib/rag/answerContext.ts:264`
- `lib/embeddings/hybrid-search.ts:75`

`app/api/lei-14133/article-docs/[numero]/route.ts` **não tem esse filtro** — é a única
que esqueceu. Cai no bucket fallback (`:282`):
```ts
const display = CATEGORY_DISPLAY[doc.category || ''] || 'Outros Documentos';
```
`Document.category` é **String livre, sem enum** (`schema.prisma:39`), então qualquer
categoria fora de `CATEGORY_DISPLAY` (`route.ts:39-58`) vaza para "Outros Documentos":
`lei-artigo`, `artigo`, `bibliografia`, `legislacao`, `boa_pratica`, `ato-normativo`,
`manual-tcu`, `outro`, `apostila`, `edital`.

⚠️ `scripts/index-lei-artigos.ts:93` está **quebrado hoje** (escreve na coluna `leiArticles`,
dropada). Os ~195 registros persistem de execuções anteriores.

### 🟢 Causa F — Cron grava o campo errado (sintoma 3)

O scraper produz **dois** campos:
- `lib/agu-modules/orientacoes-normativas.ts:118` → `titulo` = `Orientação Normativa AGU nº 105/2025` ✅ canônico
- `lib/agu-modules/orientacoes-normativas.ts:247` → `numeroDisplay` = `ON 45/2014` (abreviado)

O import admin usa `titulo` (via `convertToDocumentData`, `:393`). **O cron
`app/api/cron/import-documents/route.ts:143` usa `title: on.numero ?? ''`** — o campo
errado. Terceiro caminho: `lib/dou-module.ts:161/196` grava a **manchete do DOU verbatim**
(caixa alta, "de 11 de junho de 2025").

**Cinco formatos vivos no código:**
1. `Orientação Normativa AGU nº 105/2025` — canônico
2. `ON 45/2014` — cron
3. `ORIENTAÇÃO NORMATIVA Nº 105, DE 11 DE JUNHO DE 2025` — DOU verbatim
4. `Orientação Normativa CNU/CGU/AGU nº 01/2016` — zero-padded (`import-ons-cnu.ts:96`)
5. `ON 26/2009 (Fundamentação 1)` — legado

**Não existe função de normalização** (`formatON`/`normalizeOnTitle`) em lugar nenhum.
O padrão canônico está documentado (`docs/legacy/AGU_ORIENTACOES_NORMATIVAS.md:23`) e
`ON 1/2009` está lá marcado como **formato proibido**.

**Já houve uma padronização** — `scripts/.archived/standardize-ons.js:107` — que migrou
os dados e **foi arquivada**. Padronizou-se o dado sem consertar o ponto de escrita, o
cron continuou gravando torto, e a regressão voltou. É exatamente a lição do
`tribunalCode`: **normalizar no PONTO DE ESCRITA, não migrar dados**.

**Efeito colateral não percebido:** `app/(acervo)/base-conhecimento/[categoria]/page.tsx:291`:
```ts
if (anoFilter) where.title = { contains: `/${anoFilter}/` }
```
O filtro por ano procura `/AAAA/` **no título** — logo **não encontra** silenciosamente
as ONs fora do padrão.

### ⚠️ Achado colateral — os scripts de reanálise estão quebrados

`scripts/reanalyze-lei-articles.ts` e `scripts/reclassify-documents-articles.ts`
referenciam a coluna **`leiArticles`, dropada na Onda 4.5.6**
(`schema.prisma:44`: *"única coluna pós-4.5.6 — JSON legada dropada"*).

- `reanalyze-lei-articles.ts:140-145` — `where: { leiArticles: { not: null } }` →
  **`PrismaClientValidationError` imediato**
- `reanalyze-lei-articles.ts:289,294` — escrita em coluna inexistente
- `reclassify-documents-articles.ts:282` — `safeParseArray(doc.leiArticles)` → sempre `[]`
  ⇒ *"nunca remove artigos existentes"* silenciosamente vira **"não vê os artigos existentes"**

Ou seja: **as ferramentas de correção precisam ser consertadas antes de qualquer execução.**

### ⚠️ Achado colateral — performance da rota

`app/api/lei-14133/article-docs/[numero]/route.ts:172-176` e `:192-193` **carregam TODOS
os Documents e LegislativeActs com array não-vazio** e filtram em JS (`:214`, `:241`) —
**sem usar o índice GIN** (`schema.prisma:201`). Escala linearmente com a base inteira a
cada clique de artigo. Sem paginação: os 1.143 do art. 5º são serializados por completo.

**Contadores divergentes (3 agregações independentes):**
- `app/api/lei-14133/articles/route.ts:202` — soma `Document` + `LegislativeAct` ⇒ o "240" **não é 240 Documents**
- `app/api/lei-14133/stats/route.ts:19-24` — conta **só** `Document`
- `lib/article-utils.ts:98-112` — terceira agregação
- `article-docs/route.ts:301-302` — `total` exclui `enunciados`, `totalAll` não

---

## Parte II — Auditoria (Fase 0)

**Princípio: medir antes de corrigir.** Nenhuma escrita. Entregável: relatório com os
números reais, que fundamenta as decisões das fases seguintes.

### A0.1 — Volume e contadores reais
```sql
-- Contagem por tabela (as 7 com leiArticlesArr)
SELECT 'Document' t, COUNT(*) FROM "Document" WHERE array_length("leiArticlesArr",1) > 0
UNION ALL SELECT 'LegislativeAct', COUNT(*) FROM "LegislativeAct" WHERE array_length("leiArticlesArr",1) > 0
UNION ALL SELECT 'TribunalDecision', COUNT(*) FROM "TribunalDecision" WHERE array_length("leiArticlesArr",1) > 0;
-- (+ BlogPost, Publication, GlossaryTerm, Lesson)

-- Distribuição de vínculos por artigo — confirma 1.143 e revela os outros ímãs
SELECT unnest("leiArticlesArr") art, COUNT(*) n FROM "Document" GROUP BY 1 ORDER BY n DESC LIMIT 30;
```

### A0.2 — Truncamento de conteúdo (o detector que falta)
Piso de 50 chars não serve. Sinais de truncamento a testar:
```sql
-- ONs suspeitas: content exatamente no teto, ou terminando sem pontuação final
SELECT id, title, LENGTH(content) len, RIGHT(content, 60) tail
FROM "Document"
WHERE category = 'orientacao-normativa'
ORDER BY len;
-- Esperado pelo JSON de auditoria: pico em 800, mediana ~467
```
Heurística proposta (3 sinais, não 1):
1. `LENGTH(content)` entre 780 e 800 → bateu no teto
2. `content` não termina em `.`/`!`/`?` nem em assinatura/boilerplate DOU conhecido
3. ON sem o preâmbulo "O ADVOGADO-GERAL DA UNIÃO" (critério já usado em `import-ons-2026.ts:116`)

⚠️ Registrar a lição existente: "conteúdo curto" é **falso positivo** quando o texto
termina em boilerplate DOU/assinatura em CAIXA ALTA. O detector deve tratar isso.

### A0.3 — `content` derivado de IA alimentando o RAG
```sql
-- ONs sem content (fallback vai para description = resumo de IA)
SELECT COUNT(*) FROM "Document" WHERE category='orientacao-normativa' AND (content IS NULL OR LENGTH(content) < 50);
-- Descriptions que "cheiram" a resumo de IA
SELECT id, title, LEFT(description, 80) FROM "Document"
WHERE category='orientacao-normativa' AND description ILIKE '%esclarece que%';
```

### A0.4 — Links quebrados
```sql
-- LegislativeActs sem officialUrl → 404 garantido via /atos-normativos/[id]
SELECT COUNT(*) FROM "LegislativeAct" WHERE ("officialUrl" IS NULL OR "officialUrl" = '')
  AND array_length("leiArticlesArr",1) > 0;

-- Documents com url vazia → 404 via /api/documents/[id]/download
SELECT COUNT(*) FROM "Document" WHERE url = '' AND array_length("leiArticlesArr",1) > 0;

-- As 57 ONs com URL de fallback genérico
SELECT COUNT(*) FROM "Document" WHERE url = 'https://www.gov.br/agu/pt-br/composicao/cgu/cgu/onsagu';

-- O quadro comparativo (id começa com 487c1978-93a)
SELECT id, title, category, type, url, "isPublic", "r2Key" FROM "Document" WHERE id LIKE '487c1978-93a%';
SELECT id, title, category, type, url FROM "Document" WHERE title ILIKE '%comparativ%';

-- ON 2/2012
SELECT id, title, url, type, "isPublic", "r2Key" FROM "Document" WHERE "onNumber"=2 AND "onYear"=2012;
```
Rodar também `npx tsx scripts/validate-urls.ts` (já existe, faz HEAD/GET e detecta
redirect-para-login).

### A0.5 — Quanto se perde com a régua nova (fundamenta a Fase 3)
Sobre uma amostra do art. 5º: quantos documentos **citam** "art. 5" no `content`?
```sql
SELECT COUNT(*) FILTER (WHERE content ~* 'art(igo)?\.?\s*5[ºo]?') citam,
       COUNT(*) total
FROM "Document" WHERE '5' = ANY("leiArticlesArr");
```
Esse número é a decisão da Fase 3 em uma linha: `total - citam` = quantos viram
"relacionado por tema" (ou somem).

### A0.6 — Padrões de título das ONs
```sql
SELECT CASE
  WHEN title ~ '^Orientação Normativa AGU nº \d{1,3}/\d{4}$' THEN 'canônico'
  WHEN title ~ '^ON \d' THEN 'abreviado (cron)'
  WHEN title = UPPER(title) THEN 'DOU verbatim'
  ELSE 'outro' END padrao, COUNT(*)
FROM "Document" WHERE category = 'orientacao-normativa' GROUP BY 1;
```
Script existente reaproveitável: `scripts/verify-on-standardization.js:42`
(`/^Orientação Normativa AGU nº \d{1,3}\/\d{4}$/`).

---

## Parte III — Plano corretivo

> **Decomposição:** são 4 sub-projetos independentes. Cada um pode ser feito, revisado e
> deployado sozinho. Não devem virar um PR só.

### Fase 1 — Correções cirúrgicas (destravam o vídeo) — ~2h, risco baixo

| # | Correção | Arquivo | Tamanho |
|---|---|---|---|
| 1.1 | Filtrar `lei-artigo` (reusar `HIDDEN_CATEGORIES`) | `app/api/lei-14133/article-docs/[numero]/route.ts` | 1 linha |
| 1.2 | `getDocHref` → `/documento/[id]` em vez da rota inexistente; tratar `url === ''` | `components/lei-14133/HighlightCard.tsx:27-30` | ~5 linhas |
| 1.3 | Cron usar `on.titulo` em vez de `on.numero` | `app/api/cron/import-documents/route.ts:143` | 1 linha |
| 1.4 | Criar `formatOnTitle()` e aplicá-la **no ponto de escrita** dos 3 caminhos | `lib/agu-modules/`, `lib/dou-module.ts` | ~30 linhas |
| 1.5 | Alinhar tipo do frontend com o schema (`url: string`, não `url?: string`) | `hooks/use-lei14133-preview.ts:12,77` | 2 linhas |

**Teste (TDD):** cada item ganha teste antes do fix. 1.2 precisa de teste que **falhe**
hoje (asserção de que todo href resolve para rota existente).

⚠️ **1.4 é o ponto da lição:** normalizar na escrita. Migração de dados existentes vem
depois (1.6), e **só** depois que a escrita estiver protegida — senão a regressão volta,
como já voltou uma vez.

### Fase 2 — Integridade de conteúdo (o mais grave) — ~1-2 dias, risco médio

| # | Correção | Onde |
|---|---|---|
| 2.1 | Detector de truncamento (3 sinais da A0.2), não piso de 50 | novo `lib/data-health/checks.ts` |
| 2.2 | Remover `.slice(0,3)` e `.substring(0,800)` do caminho de `content` | `orientacoes-normativas.ts:317-318` |
| 2.3 | Consertar delimitador de bloco (não cortar quando a ON **cita** outra ON) | `orientacoes-normativas.ts:213-220` |
| 2.4 | Separar `content` (integral) de `descricao` (resumo) — hoje `content: aguDoc.descricao` | `orientacoes-normativas.ts:438` |
| 2.5 | Cron passar a gravar `content` | `cron/import-documents/route.ts:141-165` |
| 2.6 | Ampliar `scrape-ons-content.ts` para ONs sem URL `in.gov.br` (resolver via `douUrl`) | `scripts/scrape-ons-content.ts:105` |
| 2.7 | Re-scrape das ONs truncadas via DOU (texto integral) | execução |
| 2.8 | **Guard no RAG:** nunca usar `description` gerada por IA como fonte | `lib/embeddings/source-text.ts:20-26` |

**2.8 é inegociável.** Um resumo de IA sendo citado como texto normativo é pior que
não ter a fonte. Precisa de flag de proveniência (`descriptionSource: 'ai' | 'original'`)
ou de remover `description` do fallback de `selectSourceText`.

**Validação:** o `import-ons-2026.ts` já tem a régua certa (`content.length < 500` +
preâmbulo AGU) — promover essa validação a **guard compartilhado** de todos os caminhos
de escrita de ON.

**Corrigir também o arrasto de metadado:** o `douUrl` da ON 2/2012 aponta para a
Portaria 233/2024, e o da 94/2024 apontava para a ON 95/2025. Mesmo bug de fronteira.

### Fase 3 — Régua de vinculação: citação direta OU tema forte — ~2-3 dias, risco médio

**Decidido pelo Daniel.** Implica 4 peças:

**3.1 — Persistir a evidência (migration).** Sem isso nada é auditável. Opções:

| Opção | Prós | Contras |
|---|---|---|
| **(a) Tabela `ArticleLink`** (docId, artNumber, confidence, mentions, source) | Auditável, indexável, permite `WHERE mentions > 0`; resolve a divergência dos 3 contadores | Migration grande, toca 7 modelos e a leitura |
| **(b) Coluna JSON paralela** (`leiArticlesMeta`) | Migration pequena, `leiArticlesArr` segue funcionando | Não indexável, duplica estado (risco de divergir) |
| **(c) Só relatório JSON** (o `reanalyze` já gera) | Zero migration | Não serve à UI nem à auditoria contínua |

**Recomendação: (a)**, mas **só para `Document` + `LegislativeAct`** nesta fase (são os
que a Lei Comentada lê). Os outros 5 modelos ficam para depois — YAGNI.

**3.2 — Extrator de citação por regex (custo zero, ganho alto).**
Não existe hoje — verificado. `lib/article-utils.ts:20` (`extractArticleNumbers`) é
**nome enganoso**: só faz `JSON.parse` do campo, não lê texto.
Base reaproveitável: `lib/dou-change-detector.ts:45-123` (5 regexes de artigo da 14.133),
mas exigem verbo antes (`altera|regulamenta|revoga`) — não casam citação comum de acórdão.
`data/lei-14133-artigos.ts` já expõe as **195 chaves válidas** para validar o número extraído.
→ ~30-60 linhas dão `mentions` **de graça, sem LLM**, para toda a base.

**3.3 — Consertar os scripts quebrados** (`leiArticles` → `leiArticlesArr`, usar
`setLeiArticles()` de `lib/lei-articles.ts:91-98`). Pré-requisito de qualquer execução.

**3.4 — Reanálise + UI.** Régua:
- `mentions > 0` (regex confirma citação) → **"Cita este artigo"**
- `confidence >= 75` e `mentions = 0` → **"Relacionado por tema"** (seção separada, visualmente distinta)
- resto → não exibe (mas **não apaga** — fica no banco com a evidência, reversível)
- **Proteger o link manual:** `source: 'manual'` nunca é podado (hoje é indistinguível — `link-document/route.ts:26-31`)
- Generalizar o filtro do Art. 6º (`lei-indexer.ts:170`) para **todos** os artigos genéricos (1º-6º), lendo de constante, não hard-coded

**Estimativa de custo da reanálise:**

| Item | Valor | Fonte |
|---|---|---|
| Modelo | `gemini-3-flash-preview` | `lib/gemini/config.ts:15-16` |
| `thinkingBudget` | **0** (thinking desligado) | `lib/lei-indexer.ts:266` |
| Truncagem de input | 32.000 chars | `lib/lei-indexer.ts:215-216` |
| Prompt fixo | ~2.913 chars (~800-900 tokens) | `lib/lei-indexer.ts:60-119` |
| Output | ~300-600 tokens (teto 4096) | `lib/lei-indexer.ts:265` |
| Throughput | ~2.400 docs/h (CONCURRENCY=3, delay 1500ms) | `scripts/reanalyze-lei-articles.ts:48-49` |
| **Âncora real** | **~R$ 7 para 1.570 docs** (Flash 2.5) | `docs/ROADMAP_GEMINI_PAGO.md:30` |

→ **~7.400 docs ≈ R$ 30–80 e ~3h de wall clock.**
Incertezas: (i) preço vigente do `gemini-3-flash-preview` vs. 2.5 usado na âncora;
(ii) distribuição real de `LENGTH(content)` — driver #1 do custo, medir na A0.1.

**O custo financeiro é irrelevante. O custo real é engenharia + risco.** E o `confidence`
**já vem do modelo** (`lib/lei-indexer.ts:40-45`) — o prompt **não precisa mudar**, só a
escrita.

⚠️ **Escopo real:** o `LeiIndexer` só entende o shape `Document` (`:136`).
`reanalyze-lei-articles.ts` cobre `Document` + `LegislativeAct` (adaptando, `:186-197`).
**TribunalDecision, BlogPost, Publication, GlossaryTerm e Lesson não têm caminho de
reanálise** — precisariam de código novo. Ficam fora desta fase.

### Fase 4 — Auditoria permanente (ratchet) — ~1 dia

O problema não é só consertar; é **não regredir**. Precedente: as ONs já foram
padronizadas uma vez e a bagunça voltou.

| # | Item | Onde |
|---|---|---|
| 4.1 | `audit-linkage-integrity.ts` passar a cobrir **`Document`** (hoje só `LegislativeAct` + `TribunalDecision`) | `scripts/audit-linkage-integrity.ts:33-81` |
| 4.2 | Detector de **super-vinculação** (artigo com N acima do p95 → alerta) | novo |
| 4.3 | Detector de **truncamento** no cron `data-health` (Fase 2.1) | `lib/data-health/checks.ts` |
| 4.4 | **Link-check** no cron: href que não resolve para rota existente | novo + `scripts/validate-urls.ts` |
| 4.5 | Guard de **título de ON** no ponto de escrita (regex canônica) | `scripts/verify-on-standardization.js:42` |
| 4.6 | Unificar as **3 agregações** de contador divergentes | `articles/route.ts:202`, `stats/route.ts:19`, `article-utils.ts:98` |

⚠️ **Lição a aplicar** (`feedback-auditores-cegos`): auditores viram sentinelas cegos —
detectam **falta**, não **excesso**. A super-vinculação (4.2) é exatamente o sentido que
falta hoje. Cobrir os **dois** sentidos.

### Fase 5 (oportunista) — Performance

`article-docs/[numero]/route.ts:172-193` carrega a base inteira e filtra em JS, ignorando
o índice GIN (`schema.prisma:201`). Trocar por `leiArticlesArr: { has: numero }` no
Prisma. Sem paginação nos accordions. **Não bloqueia nada** — fazer quando tocar o arquivo.

---

## Ordem recomendada

```
Fase 0 (auditoria)  ──→ decide o escopo das demais
   │
   ├─→ Fase 1 (cirúrgicas)     ← destrava o vídeo, deploy imediato
   │
   ├─→ Fase 2 (conteúdo) 🔴    ← a mais grave; independente da Fase 3
   │
   └─→ Fase 3 (régua)          ← depende da A0.5 (quanto se perde)
          │
          └─→ Fase 4 (ratchet) ← trava tudo que foi corrigido
```

**Fase 2 antes da Fase 3.** Reanalisar vínculos sobre texto truncado seria pagar duas
vezes: o LLM leria 800 chars e chutaria o resto. **Consertar o texto primeiro torna a
reanálise mais precisa e mais barata.**

---

## Impacto no vídeo (curto prazo)

- ❌ **Não gravar** a Lei Comentada com contador de documentos até a Fase 1 + 3.
- ✅ **Pode gravar:** assistente de IA, Base de Conhecimento (números), Cursos, home.
- ⚠️ Ao gravar o assistente, **evitar pergunta cuja resposta dependa de ON** — o texto
  pode estar truncado (Causa A). As perguntas sugeridas no roteiro sobre **art. 75**
  (dispensa) e **art. 107** (prorrogação) puxam **lei**, não ON — seguem seguras.
  A alternativa B do roteiro (ON 107/2026 sobre pregão) **entrou pelo caminho limpo**
  (`import-ons-2026.ts`, ONs 103-107) — mas **confirmar o `content` na A0.2 antes de usar**.

---

## Decisões pendentes (aguardam o Daniel)

1. **Fase 0 primeiro?** Recomendo sim — os números mudam o escopo de tudo. ~1h.
2. **Formato da evidência (3.1):** tabela `ArticleLink` (a) ou coluna JSON (b)? Recomendo (a).
3. **Corte do "tema forte":** proponho `confidence >= 75`. Calibrar com a amostra da A0.5.
4. **Vínculos podados:** esconder da UI mas manter no banco (recomendo, reversível) ou apagar?
5. **Escopo da Fase 3:** só `Document` + `LegislativeAct`, ou incluir `TribunalDecision`
   (precisa de código novo)?
6. **A0.5 antes de decidir?** Posso rodar a amostra do art. 5º e te mostrar os títulos
   reais que sairiam — ~30min, e você julga com os dados na frente.
