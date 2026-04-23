# Roadmap — Migrar todo o código de `gemini-2.0-flash` para `gemini-2.5-flash`

**Criado em:** 2026-04-22
**Autor:** Daniel Barral + Claude (sessão de auditoria)
**Status:** Planejado, aguardando execução
**Prioridade:** **P0 — URGENTE**. Código em produção (chat, busca IA, cron de jurisprudência, text extractor, newsletter) está batendo 429 silenciosamente porque o billing pago do usuário cobre a família 2.5 e o código chama 2.0-flash.
**Roadmap irmão:** `ROADMAP_GEMINI_PAGO.md` (otimização do pipeline TCU; premissa do qual que o modelo estivesse certo — foi corrigida em `lib/tcu-enrichment.ts` e `lib/lei-indexer.ts` durante aquela execução, por isso este roadmap começa a partir dos 24 arquivos restantes).

---

## Resumo da situação

- Billing pago está na família Gemini **2.5** (`gemini-2.5-flash`, `gemini-2.5-pro`).
- Chamadas a `gemini-2.0-flash` com esse mesmo API key caem no pool **free** e retornam `429 Resource exhausted` em rajadas pequenas (3 paralelas já estouram).
- Já existe config central correta em `lib/gemini/config.ts` (`PRIMARY_GEMINI_MODEL = 'gemini-2.5-flash'`), mas boa parte do código **não consome dela** — hardcoda `'gemini-2.0-flash'` diretamente.
- O registry de `lib/ai/registry.ts` também lista `gemini-2.0-flash` como default para tasks `search`/`chat`/`extraction`.
- Gemini 2.5 tem **thinking mode ativo por default**, que consome ~95% do `maxOutputTokens` em tarefas curtas se não for explicitamente desativado via `thinkingConfig: { thinkingBudget: 0 }`. Validado experimentalmente.

**Inventário validado em 2026-04-22 (commit `02aaeff`):** 24 arquivos ainda referenciam `gemini-2.0-flash` (fora os 2 já migrados).

---

## Regras de decisão para cada ponto de migração

Para cada `'gemini-2.0-flash'` no código:

1. **Troque para `'gemini-2.5-flash'`** (sempre).
2. **Adicione `thinkingConfig: { thinkingBudget: 0 }` em `generationConfig`** se a tarefa for:
   - Resumo / reformulação / reescrita
   - Classificação / scoring
   - Extração de JSON estruturado simples
   - Geração com temperatura alta (criatividade já vem de temp, não de thinking)
3. **Mantenha thinking default (não adicione nada)** se a tarefa for:
   - OCR / extração de texto de imagem/PDF escaneado (não há raciocínio a fazer)
   - Raciocínio jurídico complexo com output JSON longo (extração de múltiplos artigos com justificativa) — a decisão aqui vale teste antes/depois
4. **Se a chamada for via `@google/genai` SDK** (e não REST direto), o shape da config é diferente: `config: { thinkingConfig: { thinkingBudget: 0 } }` dentro do `generateContent({ model, contents, config })`.

---

## Objetivo mensurável

- Zero `'gemini-2.0-flash'` em código ativo (tests, docs e arquivados tratados à parte).
- Após migração, rodar os endpoints `/api/documents/query` (chat RAG) e `/api/area-restrita/global-search` com IA ativada e **não ver 429** nos logs em uma janela de 5 min de uso normal.
- Eval `npm run eval:run` deve rodar sem erros de rate limit (hoje rola, mas porque usa embeddings + queries esparsas — não garante que os endpoints de chat não estejam falhando).

---

## Plano de execução — 7 fases

Cada fase é pequena, commitável separadamente, com rollback trivial. Ordem segue criticidade: **hot paths primeiro**, docs por último. Entre cada fase, commit.

### Fase 0 — Sanity check de produção

**Por quê:** antes de mexer, confirmar que os 429 estão mesmo acontecendo em endpoints live. Evita ficar caçando bug imaginário.

**Passos:**
1. Levantar o dev server (`npm run dev`).
2. Abrir `/area-restrita/assistente` (chat RAG) e fazer 3-4 perguntas rápidas.
3. Conferir console/server logs para 429.
4. Anotar na seção "Medições" deste roadmap.

Alternativa: checar logs de produção na Vercel (Sentry captura erros 500 mas 429 tratado como "erro Gemini" pode estar invisível). Se tiver Sentry em mãos, vale olhar também.

**Critério de aceite:** temos evidência documentada de 429 em produção **ou** confirmação de que não está batendo (o que mudaria a urgência deste roadmap).

**Sem commit nessa fase** — só captura evidência.

---

### Fase 1 — OCR / Vision (P0 — quebra extração de PDF)

**Arquivos:**
- `lib/text-extractor.ts` (linha com `'gemini-2.0-flash'` na chamada do client)
- `lib/embeddings/document-processor.ts` (linha ~406, `genAI.getGenerativeModel`)

**Mudanças:**
- Trocar modelo → `gemini-2.5-flash`.
- **NÃO adicionar `thinkingConfig`** — OCR não se beneficia de thinking; o modelo só precisa transcrever.
- Considerar: em vez de hardcode, importar de `lib/gemini/config.ts` (que já é `'gemini-2.5-flash'`). Refactor pequeno, custo mínimo, elimina futuros desalinhamentos.

**Teste manual:**
1. Rodar `scripts/migrate-to-embeddings.ts --dry-run --limit 1` em um documento com `r2Key` (PDF escaneado) para ver se OCR roda sem 429.
2. Se algum doc pendente na fila de index-jobs for PDF escaneado, processar e ver output.

**Critério de aceite:** extração de texto em PDF escaneado não dispara 429; texto sai não-vazio.

**Commit:** `fix(extractor): gemini 2.0 → 2.5-flash em OCR/vision (P0)`

---

### Fase 2 — Highlight analyzers + newsletter (P1 — crons silenciosos)

**Arquivos:**
- `lib/tcu-highlight-analyzer.ts`
- `lib/tribunal-highlight-analyzer.ts`
- `lib/newsletter/relevance-filter.ts`
- `lib/newsletter/intro-generator.ts`

Todos são **cron-críticos** (rodam em background após import ou antes de enviar newsletter). Falha silenciosa = destaque não aparece no dashboard e newsletter sai sem intro ou com decisões irrelevantes.

**Mudanças (para todos):**
- Modelo → `gemini-2.5-flash`.
- `generationConfig`: adicionar `thinkingConfig: { thinkingBudget: 0 }` (tarefas curtas de classificação + resumo).
- **Exceção:** `intro-generator.ts` usa `temperature: 0.8` (criativo). Mesmo assim, adicionar `thinkingBudget: 0` — criatividade vem de temp, não de thinking.

**Teste manual:**
1. Para os highlight analyzers: rodar o cron `/api/cron/sync-tcu-acordaos` (ou o equivalente TCE) e ver se `highlights` > 0 no response.
2. Para o newsletter: rodar em dry-run do cron `monthly-newsletter` se existir tal flag, ou ver logs da última execução.

**Critério de aceite:** outputs JSON esperados saem completos (sem truncagem) e sem 429.

**Commit:** `fix(crons): migrar highlight analyzers + newsletter para 2.5-flash`

---

### Fase 3 — Registry central `lib/ai/registry.ts`

**Arquivo:** `lib/ai/registry.ts`

**Contexto:** o registry mapeia `AiTask` → `{provider, model}`. Hoje defaults de `search`, `chat`, `extraction` são `gemini-2.0-flash`. Qualquer código que use `import { generate } from '@/lib/ai'` está invocando 2.0-flash via essa tabela.

**Mudanças:**
- Trocar defaults de `search`, `chat`, `extraction` para `gemini-2.5-flash`.
- Avaliar: o wrapper `generate()` (provavelmente em `lib/ai/index.ts`) passa `thinkingConfig` para o provider? Se não passa, adicionar suporte — senão todas as chamadas via `generate()` continuarão truncando. Se o suporte já existir, documentar no registry: um campo opcional `thinkingBudget` per-task default.
- Update dos testes `lib/__tests__/ai/registry.test.ts` — troca de assertions que afirmam `'gemini-2.0-flash'` para `'gemini-2.5-flash'`.

**Critério de aceite:** `npm run test -- lib/__tests__/ai/registry.test.ts` passa; chamadas a `generate('search', ...)` retornam resultados não truncados em um teste manual rápido.

**Commit:** `feat(ai-registry): default task models = 2.5-flash + thinking-aware`

---

### Fase 4 — Helpers diretos e MCP server

**Arquivos:**
- `lib/gemini/gemini-helper.js` (5 referências nas linhas 17, 26, 31, 85)
- `mcp-server-gemini/src/index.ts` (linha 31, mapeamento de modelos)

**Mudanças:**
- `gemini-helper.js`: trocar strings; sem thinkingConfig (é fallback genérico, não sabe a tarefa — deixa o caller decidir).
- `mcp-server-gemini/src/index.ts`: atualizar a key do mapa (`'gemini-2.0-flash': 'gemini-2.5-flash'` OU deprecar a entrada). Também revisar o enum que aceita modelos do cliente — manter 2.0 como opção "legacy" ou remover? Decisão: **manter** (se alguma integração externa pedir 2.0, ela ainda funciona, só cai no free tier).

**Critério de aceite:** `scripts/` que usam o helper rodam sem erro.

**Commit:** `chore(gemini-helper,mcp): atualizar modelos default para 2.5-flash`

---

### Fase 5 — Scripts manuais (9 arquivos)

**Arquivos:**
- `scripts/reclassify-documents-articles.ts`
- `scripts/reclassify-enunciados-articles.ts`
- `scripts/reclassify-pareceres.ts`
- `scripts/reanalyze-lei-articles.ts`
- `scripts/populate-recommended-sites.ts`
- `scripts/populate-glossary.ts`
- `scripts/index-tcu-lei-articles.ts`
- `scripts/index-all-documents.js`
- `scripts/.archived/update-act-titles.ts` — **PULAR** (arquivado).

**Mudanças (padrão para todos os 8 ativos):**
- Modelo → `gemini-2.5-flash`.
- Adicionar `thinkingConfig: { thinkingBudget: 0 }` em todos (extração JSON + reclassificação são tarefas curtas).
- **Exceção a validar:** scripts que geram JSON com justificativa longa (reclassify-*) podem perder qualidade sem thinking. Se possível, rodar cada script em `--limit 5` após migração e comparar qualidade com backup recente. Se houver regressão, trocar `thinkingBudget: 0` por `thinkingBudget: 512` só nesse script.

**Critério de aceite:** um teste `--limit 3 --dry-run` em cada script corre sem erro e produz output plausível.

**Commits:** um por lote (reclassify, populate, index) para rollback mais fácil:
1. `chore(scripts): reclassify + reanalyze → 2.5-flash`
2. `chore(scripts): populate-* → 2.5-flash`
3. `chore(scripts): index-* → 2.5-flash`

---

### Fase 6 — Documentação e schema

**Arquivos:**
- `CLAUDE.md` — trocar quaisquer referências "usar gemini-2.0-flash" por "gemini-2.5-flash"; atualizar a tabela `lib/ai/registry.ts` no CLAUDE.md com os novos defaults da Fase 3.
- `prisma/schema.prisma` — só comentários referenciam 2.0-flash; atualizar para evitar confusão.
- `docs/superpowers/plans/2026-04-06-portar-camada-lib-ai.md` — marcar o plano original com nota histórica: "Defaults reais migrados para 2.5-flash em 2026-04-22 via `ROADMAP_GEMINI_MODELO_25.md`".

**Critério de aceite:** grep por `gemini-2.0-flash` no repo retorna apenas em arquivos arquivados, testes de compatibilidade, ou menções históricas explicitamente datadas.

**Commit:** `docs: atualizar referências gemini 2.0 → 2.5-flash`

---

### Fase 7 — Validação final + checks de qualidade

**Passos:**
1. Re-rodar os mesmos testes da Fase 0 (chat no `/area-restrita/assistente`).
2. Rodar `npm run eval:run` — comparar métricas com o baseline gravado em `ROADMAP_GEMINI_PAGO.md` (recall@5 = 34,2%). Esperado: sem regressão. Bônus: com 2.5-flash na síntese/retrieval, talvez pequeno ganho.
3. Rodar `lib/gemini/__tests__/cached-client.test.ts` — verificar assertions.
4. Logs de produção (Vercel/Sentry) por 24h após deploy — 429s devem cair para ~0.

**Critério de aceite:** sem 429 na janela de observação; eval sem regressão; testes passam.

**Commit final:** `chore: validar migração completa gemini 2.5-flash`

---

## Roadmaps/dependências externas

- **`ROADMAP_GEMINI_PAGO.md`** (Fase 5 — reprocess full 1555 acórdãos) — faz mais sentido executar **depois** deste roadmap, senão o reprocessamento pode engarrafar nos mesmos 429s que estamos caçando. Pelo menos a Fase 1 (OCR) e Fase 2 (highlight analyzers) deste roadmap devem estar feitas antes.
- **Backlog do cron de index-jobs (727 pendentes)** — independente deste roadmap, mas é o gargalo que impede que as mudanças cheguem rápido na busca.

---

## Rollback

Todos os commits são revertíveis com `git revert <sha>`. Não há mudança de schema, nem de dados. O único risco real é se thinking desativado degradar qualidade em scripts P3 — nesse caso, rodar o script com `--dry-run` pré-migração salvo em arquivo e comparar com pós-migração.

---

## Checklist de retomada após queda de energia

Se a energia cair no meio:
1. `git log --oneline -20` para ver qual fase foi a última commitada.
2. Continuar pela fase seguinte não commitada.
3. Scripts de migração em arquivos são idempotentes (o grep por `gemini-2.0-flash` no arquivo já alterado retorna vazio — não há como "re-migrar" sem desfazer).
4. Fase 7 só faz sentido rodar depois das 6 anteriores.

---

## Medições (preencher durante execução)

### Fase 0 — Sanity check
- Data: __________
- 429s observados no chat: __________ (sim/não + logs)
- 429s observados na busca IA: __________

### Fase 7 — Validação final
- Data: __________
- 429s nas 24h pós-deploy: __________
- Eval recall@5: __________ (vs baseline 34,2%)
- Testes unitários: __________ (passing / failing)

---

## Histórico de mudanças neste roadmap

- **2026-04-22:** documento criado após descoberta, durante execução do `ROADMAP_GEMINI_PAGO.md`, de que o billing pago do usuário está na família 2.5 e 28 arquivos do projeto usam 2.0-flash hardcoded. Auditoria completa feita no mesmo dia via subagent; classificação por criticidade aplicada.
