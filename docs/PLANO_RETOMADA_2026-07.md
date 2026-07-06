# Plano de Retomada — Site do Barral (Julho/2026)

> Consolidação do inventário de retomada pós-férias (06/07/2026), a partir de 3 análises
> paralelas: frentes de lançamento, saúde do código e sistema de IA de licitações.
> Princípio-guia: **medir → corrigir fundação → trocar motor → aprofundar → ousar.**
> Não adianta pôr um motor melhor (Claude) num carro com o tanque furado (Lei 14.133 vazia,
> contexto estrangulado, modelos mortos). Arrumar a base e o retrieval **antes** de trocar o sintetizador.

## Estado geral (atualizado em 06/07/2026, fim do dia)
- ✅ **Fases 0-3 CONCLUÍDAS, mergeadas em `main` e DEPLOYADAS em produção** no mesmo dia
  (merges `84372975`→`570ab517`→`1bfe97ff`→`8feff01f`; PR #129; deploy `dpl_9Duh…` READY em `profdanielbarral.com`).
- O assistente de licitações agora responde com **Claude Sonnet 5 + Citations API** por default (decisão do Daniel):
  cada afirmação ancorada em trecho-fonte verificável e clicável.
- A régua de síntese (LLM-as-judge) levou o **overall de 45% → 80%** — o trabalho pesado foi a fundação
  (Fase 2: contexto + Lei 14.133 no prompt), não a troca de modelo.
- **Próximo foco:** observar produção (latência/custo — ver Pendências pós-deploy) e, quando quiser, Fases 4-5.
- Semáforo da IA: 🟢 Verde para o objetivo "surpreender os alunos". Semáforo de lançamento comercial: 🟡 Amarelo
  (Trilha A / Stripe LIVE ainda pendente).

---

## ⭐ Pendências pós-deploy (vigiar nos primeiros dias) — NOVO
Surgiram durante a execução das Fases 0-3; nenhuma bloqueia o uso, mas merecem olho:
- **Latência do thinking** do Sonnet 5: pausa de ~20-30s antes do 1º token em perguntas complexas. O indicador
  "Analisando as fontes…" ameniza a percepção. Se incomodar, reduzir `effort`/thinking via env — **sem novo deploy**.
- **Custo:** Claude roda em TODA pergunta agora (antes era Gemini). Acompanhar consumo. Rollback instantâneo:
  setar `AI_SYNTHESIS_MODEL` para um modelo Gemini na Vercel (sem deploy).
- **Citações no card da busca global** (`/api/documents/query` non-streaming, usado pelo `AIAnswerCard`): a Fase 3
  entregou citações no **streaming** (página do assistente). O card da busca global ainda não mostra citações.
- **`CLAUDE.md` › Development Status desatualizado:** ainda descreve o Chat RAG como Gemini e a Fase 0 como
  "PR #129 não-mergeado". Atualizar quando conveniente (edita repo → dispara deploy, mas não afeta o site).
- **Achado honesto a lembrar:** juiz Sonnet 5 inflou a vitória do Claude por auto-preferência (+7,6pp);
  juiz neutro Opus 4.8 mostrou só +1,8pp. Ambos já ~90%. Não superestimar o ganho da troca de modelo isolada.
- Branches `fase-0/1/2/3-*` já mergeadas seguem em `origin` — podem ser deletadas.

---

## ✅ Fase 0 — Fundação segura · CONCLUÍDA (deployada)
Blindagem feita: `db push` fail-closed (removido `--accept-data-loss`), 56 erros tsc zerados + gate religado,
debug do jurisprudencia/query só p/ admin, 2 crons corrigidos (cleanup-orphaned-files pula sem R2; import-dou
re-tenta 404), CLAUDE.md enxugado 45.8→23.6KB. (0.5 auth do chat de artigos: verificar se coberto — ver backlog.)

<details><summary>Detalhe original da Fase 0 (histórico)</summary>

## 🔧 Fase 0 — Fundação segura (pré-requisito de tudo) · ~1 dia
Antes de mexer no código complexo da IA, blindar o terreno.

| # | Item | Trilha | Por que primeiro |
|---|------|--------|------------------|
| 0.1 | Sanidade pós-férias: `/admin/monitoring`, `ScraperHealthLog` (18 dias), newsletter de julho | A | Saber se algo quebrou antes de construir em cima |
| 0.2 | Remover `--accept-data-loss` do `vercel-build`; adotar `prisma migrate deploy` | B | **Bloqueante p/ Fases 3-4** (reindexam/mexem em dados). Sem isso, deploy pode apagar dados |
| 0.3 | Corrigir os 56 erros de `tsc` (fixtures sem `leiArticlesArr`) + religar o gate | B | Restaura rede de proteção de tipos antes de editar o route de 1.221 linhas |
| 0.4 | Fechar debug/stack trace vazando em `jurisprudencia/query/route.ts:420` | A | Exposição de internals a usuário logado |
| 0.5 | Amarrar auth/rate-limit no chat de artigos (`artigos/[numero]/chat/route.ts:196`) | A | Custo de IA aberto a abuso |

**Gate:** `tsc --noEmit` limpo, deploy sem `--accept-data-loss`, crons saudáveis, TODOs de exposição fechados.

</details>

---

## ✅ Fase 1 — Régua de qualidade da IA · CONCLUÍDA (deployada)
Geração extraída da rota (1220→373 linhas) para `lib/rag/` (util, domain-detection, answerContext, answerService,
types). Criada a **régua de síntese LLM-as-judge** (`eval/judge.ts`, `synthesis-runner.ts`, script `eval:synthesis`):
faithfulness / citationAccuracy / completeness. **Baseline honesto congelado: overall 45,4%** — o modelo INVENTAVA
teor de artigos/acórdãos porque só os NÚMEROS entravam no contexto (não o texto). Diagnóstico confirmado por medição.

---

## ✅ Fase 2 — Corrigir a fundação do RAG · CONCLUÍDA (deployada) · **overall 45→80%**
Maior razão valor/esforço, como previsto. Executado:
- **2.1** `LeiArticleEmbedding` populada (0→196 artigos, texto integral, em prod via `scripts/index-lei-articles.ts`).
- **2.2** Orçamento de contexto expandido. **Achado-chave:** `buildLeiContext(1500)` truncava ANTES do 1º artigo
  longo (Art. 156 ~2k chars) → 0 artigos injetados, anulando a 2.1. Caps: 1500→10000; layered 20000→60000.
- **2.3** Modelos mortos saneados (fallback gemini-1.5-flash 404 removido; enhancement → `claude-sonnet-5`).
- **2.4** 154 `tcu` minúsculos normalizados em prod + `UPPER()` case-insensitive no vector-search.
- **2.5** Banner de cobertura usa cosine bruto (`topVectorSimilarity`), não score RRF.

---

## ✅ Fase 3 — Trocar o motor de síntese · CONCLUÍDA (deployada)
Decisão do Daniel: **Citations como DEFAULT para todo aluno** (não atrás de A/B). Executado:
- **3.1/3.2** Sintetizador padrão trocado de Gemini → **Claude Sonnet 5**; fallback robusto p/ Gemini se Claude
  falhar antes de emitir tokens. Env `AI_SYNTHESIS_MODEL` p/ override/rollback sem deploy.
- **3.3** **Citations API nativa** (blocos `document`, `citations: enabled`) integrada no provider anthropic,
  no answerContext (chunks + artigos da Lei + atos como fontes discretas) e no streaming SSE (`citations_delta`).
  `ChatInterface` renderiza "N citações verificadas" clicáveis + indicador "Analisando as fontes…". Cada afirmação
  ancorada LITERALMENTE na fonte — alucinação de citação impossível por construção.
- **3.4** Modo "análise profunda" com Opus 4.8: **NÃO feito** — fica para as Fases 4-5 se desejado.

**Lições técnicas registradas:** Sonnet 5/Opus 4.x deprecaram `temperature` (400 se enviado); Citations API é
incompatível com `output_config.format`; mock runtime de módulo não é pego por tsc → sempre gate `test:run` verde.

---

## 🔬 Fase 4 — Aprofundar retrieval · ~1 semana (PRÓXIMA, opcional)
- **4.1** Fase 3 de embeddings: A/B em tabela shadow (voyage-law-2 ou gemini full-dim) → recall@5 66%→~78%.
- **4.2** Chunking estrutural para normas: 1 artigo = 1 chunk com header contextual; reindexar só esses ramos.

**Gate:** recall@5 medido acima do baseline; reindexação reversível confirmada.

---

## 🧠 Fase 5 — RAG agêntico (salto ambicioso) · ~2 semanas
- **5.1** Claude com **tools** (`buscar_base`, `buscar_lei_artigo`, `buscar_jurisprudencia`, `ler_documento_completo`), loop 2-5 calls.
- **5.2** UI de progresso ("Consultando súmulas do TST…").
- **5.3** Respostas em dois níveis (síntese direta + "análise completa" expansível).

---

## 🟢 Raia paralela — Trilha A (lançamento) · quando decidir a data
Ops + decisões do Daniel, independente das fases acima:
- **Stripe LIVE** (P4-P8 de `docs/ROADMAP_STRIPE_FASE3.md`): 3 envs live na Vercel, `stripe-bootstrap.ts`, webhook+portal live, redeploy, smoke com cartão real.
- Criar email **`dpo@profdanielbarral.com`** (alias → Gmail) — LGPD.
- Cadastrar `/termos` e `/privacidade` no Customer Portal do Stripe.
- Decidir **coming-soon** (`COMING_SOON_ENABLED`).
- Setar `CLIPPING_TRIBUNAIS_ENABLED=TCU,TCE-PE` (pendente desde maio).
- PIX: pedir capability `pix_payments` ao suporte Stripe (assíncrono, invite-only).
- Verificação manual P2 do `FUTURE_TASKS.md` (registro/checkout/emails/newsletter).

## Correções de backlog identificadas
- `FUTURE_TASKS.md` T15 desatualizado: FAQ e Glossário públicos **já existem**.
- Formatação Planalto em `/legislacao/[id]`: código pronto mas desligado (falta passar `variant="planalto"`).

## Riscos de fundo (Frente Saúde do Código)
- `xlsx@0.18.5` e `cheerio@^0.22.0` — dependências vulneráveis (parsing de arquivos externos). **Ainda pendente.**
- ✅ ~~`app/api/documents/query/route.ts` (1.221 linhas)~~ — **resolvido na Fase 1** (route → 373 linhas; lógica em `lib/rag/`).
- Higiene da raiz: 6 scripts `configurar-gemini*.ps1`, `build-*.log`, cron `daily-tcu-clipping` deprecated.
