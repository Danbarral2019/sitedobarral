# Handoff para sessão na nuvem: atualizar o backlog (`FUTURE_TASKS.md`)

Data: 27/09/2026. Autor do pedido: Daniel. Repositório: `Danbarral2019/sitedobarral`, branch nova a partir de `main`
(sugestão: `docs/backlog-atualizado`).

## Objetivo

O `FUTURE_TASKS.md` diz "Atualizado em: 2026-05-16" e está defasado. Pelo menos dois itens constam como abertos mas já
foram resolvidos no código:

- **BIA-0c** (card de IA sem filtro por matrícula): resolvido — `filterByEnrollment` em `lib/rag/answerContext.ts`
  (~linha 248) e matrículas buscadas em `app/api/documents/query/route.ts`.
- **Webhook Resend sem validação Svix** (auditoria de falhas silenciosas, P0 nº 4): a rota
  `app/api/webhooks/resend/route.ts` já valida assinatura.

A tarefa é conferir **cada item** do backlog contra o código e o histórico do git, e devolver um backlog que reflita o
estado real, para que as próximas sessões partam de um quadro correto.

## Restrições

- Trabalho **só de leitura de código e edição de documentação**. Nada de alterar código de produção, rodar scripts
  contra o banco, chamar LLM ou APIs externas.
- Há outra sessão na nuvem rodando a carga de acórdãos do TCU (PR #229); não mexer nos arquivos dela.
- **Não apagar itens.** O que foi concluído recebe a marca `✅ CONCLUÍDO (data)` com a evidência (commit, PR ou
  arquivo:linha), no padrão que o próprio arquivo já usa. Itens obsoletos por decisão de produto: marcar como tal,
  citando a decisão; se não houver decisão registrada, listar como dúvida para o Daniel, não decidir.
- Não inventar evidência. Se não der para confirmar, o item fica como está e entra na lista de dúvidas.

## Como fazer

1. Para cada seção e item de `FUTURE_TASKS.md` (Plano de Saneamento e as 6 ondas, as duas auditorias de 2026-05-16
   com seus P0/P1, BIA-0..8, P1/P2, T1..T16, Onda 7.4 A1..A8, Q1, Glossário/FAQ), classificar:
   **concluído** (com evidência), **parcial** (o que falta, concretamente), **aberto** (ainda verdadeiro hoje),
   **obsoleto** ou **dúvida**.
2. Fontes de evidência: `git log --oneline` (títulos de PR com número), `docs/PROJECT_HISTORY.md`, relatórios em
   `docs/audits/`, `docs/ROADMAP_*.md`, handoffs `docs/HANDOFF-*.md` e o próprio código. Números citados no backlog
   (ex.: "196 de 280 rotas sem Fase 8", "467 console.error vs 7 Sentry", "8/25 crons com ScraperHealthLog") devem ser
   **re-medidos** com grep e atualizados. Referência medida em 27/09: 115 de 297 `route.ts` não usam
   `handleApiError` nem os wrappers `withAdminApi`/`withUserApi`/`withPublicApi`.
3. Conferir também os crons: comparar a lista em `vercel.json` com o que o backlog diz estar pausado ou parado.
4. Incorporar ao backlog o que surgiu depois de maio e não está lá, a partir dos handoffs e dos roadmaps
   (ex.: teses do TCU, herança editorial, jurisprudência de tribunais, alvos citados do TCU, pendências do Gemini
   com teto estourado em 26/09, PIX aguardando convite da Stripe). Só o que estiver documentado como pendente.
5. Reorganizar o topo: um quadro curto "Estado em 27/09/2026" com o que está aberto por prioridade, antes das seções
   históricas. Manter o restante do arquivo, com as marcas de concluído.

## Entregáveis

- `FUTURE_TASKS.md` atualizado ("Atualizado em: 2026-09-27").
- Na descrição do PR: tabela item → classificação → evidência, e a lista de **dúvidas para o Daniel** (itens que
  dependem de decisão dele).
- Se o `CLAUDE.md` tiver afirmação desmentida pela verificação, apontar no PR, sem editar o `CLAUDE.md`.
- PR em rascunho, descrição em português, tom formal do projeto.
