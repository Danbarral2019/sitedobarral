---
name: atos-normativos-import
description: Use when importing, updating, or re-scraping a legislative act (lei/decreto/IN/portaria/MP/resolução) into the LegislativeAct table. Covers manual single-act import, batch CSV import, and re-scrape after URL change. Forces formatting validation before save (mojibake, NBSP, zero-width, gov.br/DOU boilerplate, FAQ-no-lugar-do-ato, ementa fragments) so the act is never published with formatting bugs. Triggers on phrases like "importar lei", "importar decreto", "importar IN/portaria", "atualizar conteúdo do ato", "scrape do ato", "re-scrape", "novo ato normativo", "ato normativo veio errado".
user-invocable: true
---

# Atos normativos: import seguro com validação de formatação

Procedimento obrigatório para qualquer escrita em `LegislativeAct` (criação, atualização de `content`, atualização de `ementa`).

A única forma de garantir que um ato seja incorporado corretamente desde o início é executar o pipeline `normalizeScrapedText` + `validateActContent` em todos os caminhos. Esta skill garante isso e também serve como checklist quando o user pede para importar manualmente.

## Quando aplicar

- Adição de um novo `LegislativeAct` (manual, batch CSV, ou via cron).
- Atualização de `ementa` ou `content` de ato existente.
- Re-scrape de ato (mudança de URL oficial, suspeita de quebra de extração).
- Auditoria periódica do banco (rodar diagnostics em massa).

## Garantias do pipeline já em vigor

Estes pontos JÁ chamam `validateActContent` automaticamente. NÃO precisa repetir manualmente:

| Caminho | Onde | Bloqueia errors |
|---|---|---|
| Cron sync DOU | `app/api/cron/sync-dou-atos-normativos/route.ts` (via `scrapeAndIndexAct`) | sim |
| Admin POST `/api/admin/legislative-acts` | criação manual | sim |
| Admin PUT `/api/admin/legislative-acts/[id]` | edit | sim |
| Admin update-content | `[id]/update-content/route.ts` | sim |
| Admin import CSV | `import/route.ts` (ementa) | sim |
| `scrapeAndIndexAct` | `lib/legislative-scrapers/scrape-and-index.ts` | sim |

Se você for chamar `prisma.legislativeAct.create/update` direto em script novo, OBRIGATÓRIO chamar `validateActContent` antes — senão a guarda some.

## Procedimento manual (quando o user pede pra importar 1 ato específico)

### 1. Confirmar URL oficial

Atos do `gov.br/compras` têm DOIS caminhos comuns:

- **Texto oficial**: `/legislacao/instrucoes-normativas/<slug>` (ou `/legislacao/decretos/...`, `/legislacao/leis/...`)
- **FAQ associado**: `/perguntas-frequentes/<slug>` ⚠️ NÃO é o ato — é página de Q&A

**Validar** olhando os primeiros 200 chars do scrape: deve começar com `INSTRUÇÃO NORMATIVA Nº ... DE ...` ou `DECRETO Nº ...` (texto formal) e NÃO com `1 - ASPECTOS GERAIS / 1.1 - Quais...` (FAQ).

`validateActContent` já bloqueia URLs `/perguntas-frequentes/`, `/faq/`, `/duvidas-frequentes/` automaticamente.

### 2. Confirmar issuer canônico

Existem APENAS 8 issuers canônicos no banco. SEMPRE chamar `normalizeIssuer()` antes de salvar. NUNCA criar issuer novo sem perguntar — ~99% é variação de um já existente. (Ver `lib/legislative-acts/issuers.ts`.)

### 3. Aplicar `normalizeScrapedText` ANTES de salvar

Em `lib/legislative-scrapers/normalize.ts`. Pipeline:

```
stripZeroWidthChars
  → collapseWhitespace (NBSP → espaço)
  → stripDouBoilerplate (in.gov.br masthead/footer)
  → stripGovbrUiNoise (Plone breadcrumbs, "Compartilhe:", metadata inline)
  → stripFormAnnex (modelos `<NOME DO FISCAL/GESTOR/PREPOSTO>`)
  → dedupeBoilerplateFooter ("Este texto não substitui" duplicado)
  → collapseWhitespace
```

Idempotente — rodar 2× produz o mesmo resultado.

### 4. Aplicar `validateActContent` ANTES de salvar

```ts
import { validateActContent } from '@/lib/legislative-scrapers/validate-content';
import { normalizeScrapedText } from '@/lib/legislative-scrapers/normalize';

const ementa = normalizeScrapedText(rawEmenta);
const content = normalizeScrapedText(rawContent);
const v = validateActContent({ url, ementa, content });
if (!v.ok) throw new Error(`Formatação inválida: ${v.errors.join('; ')}`);
v.warnings.forEach((w) => console.warn(`⚠️ ${w}`));
```

**Errors que bloqueiam o save** (bugs reais que precisam refazer scrape):

- URL contém `/perguntas-frequentes/` ou `/faq/` → ato real está em outro lugar
- Conteúdo < 500 chars (provável falha de scrape)
- Início em formato de FAQ (`1 - ASPECTOS GERAIS`, `1.1 - Quais...`)
- Mojibake U+FFFD em ementa OU content (charset detection falhou — refazer fetch com `detectCharsetFromResponse`)
- Ementa vazia
- Ementa começa com `Art. X` (fragmento do body, não ementa real — visto em IN MP 10/2012)
- Ementa = só uma palavra ("Presidência", "Casa Civil", etc. — visto em Decreto 11.871/2023 antes do fix)
- Ementa começa em meio de frase tipo "8.660, de 29 de janeiro de 2016, ou..."

**Warnings** (não bloqueiam mas alertam):

- Conteúdo curto (< 1500 chars)
- Sem preâmbulo legal típico nos primeiros 4KB (`O SECRETÁRIO/MINISTRO/PRESIDENTE/Art. 1º`)
- Lista de anexos `•` vazada
- Boilerplate residual ("Compartilhe:", masthead DOU, form annex)
- NBSP / zero-width residuais (sinaliza que normalizeScrapedText não foi aplicado)
- "Este texto não substitui..." duplicado
- HTML entities ou tags HTML canônicas
- Bloco `Publicado em.../Modificado em.../Compartilhe:` inline residual
- Ementa muito curta (< 25 chars)
- Regressão de tamanho > 50% vs versão anterior

### 5. Re-encoding (se houver mojibake)

Se o ato vem com U+FFFD na ementa ou content (typical de imports antigos sem charset detection do Planalto), usar a heurística do `scripts/reextract-ementa-mojibake.ts` como referência:

```ts
import * as cheerio from 'cheerio';
import { detectCharsetFromResponse, normalizeScrapedText } from '@/lib/legislative-scrapers/normalize';

const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 ...' } });
const buffer = await res.arrayBuffer();
const charset = detectCharsetFromResponse(res.headers.get('content-type'), buffer);
const html = new TextDecoder(charset, { fatal: false }).decode(buffer);
const $ = cheerio.load(html);
$('script, style, nav, header, footer, iframe').remove();
// Heurística: primeiro <p> com verbo de ementa que NÃO seja título/anotação
```

### 6. Auditar resultado

Depois de salvar, rodar:

```sh
npx tsx scripts/inspect-ementas.ts --type=<tipo>
npx tsx scripts/inspect-content-formatting.ts
```

Esperado: o ato novo aparece SEM problemas detectados.

Se aparecer: voltar pra etapa 3-4, normalizar, re-validar, re-save.

## Procedimento de auditoria periódica

Rodar mensalmente (ou após mudança no normalize/validator):

```sh
npx tsx scripts/inspect-ementas.ts --samples
npx tsx scripts/inspect-content-formatting.ts --samples
```

Se houver regressão (atos novos com problemas):

```sh
# Re-aplicar normalize em todo o banco (idempotente, dry-run primeiro)
npx tsx scripts/backfill-legislative-acts-format.ts
npx tsx scripts/backfill-legislative-acts-format.ts --apply
```

Para mojibake especificamente (refetch do Planalto):

```sh
npx tsx scripts/reextract-ementa-mojibake.ts        # dry-run
npx tsx scripts/reextract-ementa-mojibake.ts --apply
```

## Casos críticos vistos em produção

1. **IN MP 10/2012**: ementa importada como `"Art. 14. Ao final de cada ano..."` — fragmento do body. `validateActContent` agora bloqueia ementas que começam com `Art. X`.

2. **Decreto 11.871/2023**: ementa importada como `"Presidência"` (header solitário). `validateActContent` agora bloqueia ementas que são apenas header institucional.

3. **13 atos antigos do Planalto** (pre-charset-detection): toda a ementa em U+FFFD (`"Disp�e sobre a aliena��o"`). `validateActContent` agora bloqueia U+FFFD em qualquer campo.

4. **IN SEGES/MGI 52/2025 e similares**: bloco `Publicado em.../Modificado em.../Compartilhe:` vazou inline (sem `\n` separador) entre ementa e corpo. `stripGovbrUiNoise` agora trata.

5. **IN 5/2017**: importada do `/perguntas-frequentes/` ao invés de `/legislacao/`. `validateActContent` bloqueia URLs FAQ desde o primeiro design.

## Checklist final antes de marcar import como concluído

- [ ] URL aponta pra `/legislacao/...` (NÃO `/perguntas-frequentes/`)
- [ ] `normalizeScrapedText` rodou em ementa + content
- [ ] `validateActContent` retornou `ok: true` (errors == [])
- [ ] Warnings foram lidos e aceitos (ou consertados)
- [ ] Issuer normalizado via `normalizeIssuer()`
- [ ] `contentHash` recomputado (se atualização)
- [ ] `inspect-ementas.ts` e `inspect-content-formatting.ts` rodados pós-import e o ato NÃO aparece com problemas
- [ ] Re-indexação para embeddings (`processLegislativeAct` com `forceReprocess: true`) — quando aplicável
