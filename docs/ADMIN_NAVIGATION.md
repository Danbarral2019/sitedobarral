# Admin — Mapa de navegação

Atualizado em **2026-05-04** após consolidação (plano em `docs/superpowers/plans/2026-05-04-admin-consolidation.md`).

Estado: **6 seções / 16 entradas de menu** (era 5 seções / 21 entradas).

## 📊 Visão geral
- `/admin` — Dashboard (QR Codes, métricas)
- `/admin/monitoring` — Saúde do sistema (cron + scrapers)

## ⚖️ Jurisprudência
- `/admin/tcu` — **Hub TCU** com 4 abas:
  - **Acórdãos (revisão):** UI nova de revisão editorial das classificações IA pendentes (`tcuRevisadoPorAdmin = false`). Filtros por área e por "termos novos fora da taxonomia oficial". Edit inline + aprovar.
  - **Destaques editoriais:** integra `/admin/tcu-highlights`
  - **Tribunais (TCEs):** integra `tribunal-decisions` + `tribunal-highlights`
  - **Importar:** integra `/admin/importacao` (TCU/AGU)
- `/admin/lei-14133` — **Hub Lei 14.133** com 4 abas:
  - **Comentada (editorial):** integra `ComentadaAdminClient`
  - **Editor de artigos:** lista paginada dos 195 artigos com edit
  - **Vinculações em massa:** integra `bulk-linker`
  - **Analytics:** integra `lei-14133/analytics`
- `/admin/legislacao` — CRUD legislação geral
- `/admin/importacao` — Hub importação (TCU + AGU em abas, padrão pré-existente)
- `/admin/dou-filtros` — Filtros DOU com approve/reject
- `/admin/clipping-dou` — Clipping diário DOU (alunos pagantes)
- `/admin/pareceres-revisao` — Revisão CONUNI (pareceres/notas/despachos AGU)

## 📁 Documentos
- `/admin/docs` — Hub documentos (central + gerenciar em abas, padrão pré-existente)

## 🎓 LMS
- `/admin/lms` — Cursos / Lições / Quizzes / Certificados / Analytics LMS

## ✍️ Conteúdo
- `/admin/blog-social` — Blog + Social (hub pré-existente)
- `/admin/publicacoes` — CRUD publicações
- `/admin/glossario` — CRUD glossário
- `/admin/recursos` — Recursos externos (vídeos + sites em abas)

## ⚙️ Gestão
- `/admin/analytics-hub` — **Hub Analytics** (Geral / Catalogação / Busca IA em abas)
- `/admin/contatos` — Inbox de contatos
- `/admin/depoimentos` — CRUD depoimentos
- `/admin/newsletter` — Newsletter + subscribers

---

## Páginas funcionais sem entrada de menu (apenas via URL direta)

Estas páginas existem e são úteis, mas não estão no sidebar — acessíveis via URL ou via links de outras telas:

- `/admin/planejamento/matriz` — visualização read-only da matriz de decisão (modalidade/critério) usada pelas sessões de planejamento dos alunos. Útil pra debug/inspeção.
- `/admin/planejamento/trilhas` — `TrailsManager`: gerencia catálogo de trilhas ETP/TR que alimenta as sessões dos alunos.
- `/admin/legislative-relations` — fila de revisão editorial de relações entre atos normativos (consolidação).
- `/admin/lei-14133/[numero]/edit` — editor por artigo (acessado via "Editar" na aba "Editor de artigos" do Hub Lei 14.133).
- Sub-rotas de CRUD (`new`, `[id]/edit` em blog/publicacoes/glossario/depoimentos) — acessadas via os listings principais.

Decidir se merecem entrada de menu é trabalho separado.

---

## Rotas redirecionadas

Ver `next.config.ts`. URLs antigas continuam funcionando via 307 redirect:

| URL antiga | Destino atual |
|---|---|
| `/admin/tcu-manager` | `/admin/importacao?tab=tcu` |
| `/admin/agu-import`, `/admin/scraper-agu` | `/admin/importacao?tab=agu` |
| `/admin/analytics` | `/admin/analytics-hub` |
| `/admin/analytics-documentos` | `/admin/analytics-hub?tab=catalogacao` |
| `/admin/search-analytics` | `/admin/analytics-hub?tab=busca-ia` |
| `/admin/adicionar-documentos` | `/admin/docs?tab=central` |
| `/admin/documentos` | `/admin/docs?tab=gerenciar` |
| `/admin/blog` | `/admin/blog-social` |
| `/admin/assistente-social` | `/admin/blog-social?tab=social` |
| `/admin/videos`, `/admin/sites` | `/admin/recursos?tab={videos,sites}` |
| `/admin/tcu-highlights` | `/admin/tcu?tab=destaques` |
| `/admin/tribunal-highlights`, `/admin/tribunal-decisions` | `/admin/tcu?tab=tribunais` |
| `/admin/lei-14133/{comentada,analytics,bulk-linker}` | `/admin/lei-14133?tab={…}` |
| `/admin/tcu-import`, `/admin/tcu-converter` | `/admin/importacao?tab=tcu` |

## Páginas removidas (2026-05-04)

- `/admin/tcu-import`, `/admin/tcu-converter` (+ API `/api/admin/tcu-import`) — substituídas pelo wizard em `/admin/importacao` e Hub TCU.
- Doc `TCU_CONVERTER_WEB.md` — descrevia páginas removidas.

## Padrão de hubs

Todos os hubs (TCU, Lei 14.133, Analytics-hub, Importação, Docs, Blog-social, Recursos) usam:
- `Tabs`, `TabList`, `Tab`, `TabPanel` de `@/components/ui/Tabs`
- Hook `useTabFromUrl(defaultTab)` de `@/hooks/use-tab-from-url`
- `dynamic` import lazy dos sub-painéis
- Sub-rotas antigas preservadas + redirects pro hub
