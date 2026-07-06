# Plano de Retomada — Site do Barral (Julho/2026)

> Consolidação do inventário de retomada pós-férias (06/07/2026), a partir de 3 análises
> paralelas: frentes de lançamento, saúde do código e sistema de IA de licitações.
> Princípio-guia: **medir → corrigir fundação → trocar motor → aprofundar → ousar.**
> Não adianta pôr um motor melhor (Claude) num carro com o tanque furado (Lei 14.133 vazia,
> contexto estrangulado, modelos mortos). Arrumar a base e o retrieval **antes** de trocar o sintetizador.

## Estado geral (verificado em 06/07/2026)
- `main` limpa e sincronizada com `origin/main`; o deploy de produção **é** o HEAD (`9d86cfb`).
- Nada de engenharia pendente de deploy. O que a memória dizia estar pendente (flag `revoked`, ONs AGU)
  **já foi para produção em 18/06** — refutado.
- Semáforo geral: 🟡 Amarelo — dá para lançar com ressalvas; 3 riscos merecem correção antes de cobrar.

---

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

---

## 📏 Fase 1 — Régua de qualidade da IA (medir antes de mexer) · ~2-3 dias
- **1.1** Eval de síntese (LLM-as-judge): faithfulness, completude, correção de citações, sobre as 53
  queries anotadas + queries 👎 reais do `SearchHistory`. Reaproveita ~80% da infra de `eval/`.
- **1.2** Rodar o **baseline atual** (Gemini Flash, sistema como está) e congelar os números.

**Gate:** relatório de baseline de síntese versionado.

---

## 🏗️ Fase 2 — Corrigir a fundação do RAG · ~1 semana
Maior razão valor/esforço. Melhora as respostas **hoje**, ainda no Gemini, e é pré-requisito p/ o Claude render.

| # | Item | Impacto |
|---|------|---------|
| 2.1 | **Popular `LeiArticleEmbedding` (0→195 artigos) + texto INTEGRAL do artigo** (não só a ementa) | 🔥 Fonte normativa nº 1 literalmente no prompt. Mata alucinação de dispositivo |
| 2.2 | **Expandir orçamento de contexto**: 20k→60-80k chars, top-5→12-15 fontes, cortes em fronteira de chunk | 🔥 Destrava o gargalo nº 1 (teto auto-imposto) |
| 2.3 | Sanear cascata de modelos mortos (Gemini 2.5/1.5 → 404; `enhancement` → `claude-sonnet-4` aposentado) | Elimina fallback fantasma |
| 2.4 | Normalizar 154 `tcu` minúsculos + defesa case-insensitive no vector-search | 154 decisões TCU voltam a ser vistas por filtros/boost |
| 2.5 | Corrigir semântica do banner de cobertura (comparar cosine real, não score RRF) | Aviso anti-alucinação volta a disparar pelo motivo certo |

**Gate:** re-rodar eval de retrieval + síntese; confirmar melhora vs baseline da Fase 1.

---

## 🚀 Fase 3 — Trocar o motor de síntese · ~1 semana
- **3.1** Remover hardcode `provider: 'gemini'` no route; **Claude Sonnet 5** atrás de flag/A-B, Gemini como fallback.
- **3.2** A/B contra a régua da Fase 1. Só promover se ganhar em faithfulness/completude.
- **3.3** **Citations API nativa** da Anthropic (blocos `document`, `citations: enabled`) → UI com trecho-fonte clicável.
- **3.4** Modo "análise profunda" opcional com Opus 4.8 (reaproveita `isPremiumChatQuery`).

**Gate:** A/B mostra Claude ≥ Gemini na régua; Citations renderizando na UI.

---

## 🔬 Fase 4 — Aprofundar retrieval · ~1 semana
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
- `xlsx@0.18.5` e `cheerio@^0.22.0` — dependências vulneráveis (parsing de arquivos externos).
- Arquivos gigantes: `app/api/documents/query/route.ts` (1.221 linhas) — fatiar em `lib/rag/`.
- Higiene da raiz: 6 scripts `configurar-gemini*.ps1`, `build-*.log`, cron `daily-tcu-clipping` deprecated.
