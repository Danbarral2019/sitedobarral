# Rede de precedentes do TCU — Fase 1 (Grafo persistido) — Design

**Data:** 2026-07-18
**Status:** aprovado (brainstorming — ordem, entregável e modelo de dados confirmados pelo Daniel; demais seções decididas em modo autônomo a pedido dele)
**Escopo:** persistir a rede de citações entre acórdãos + expor a wishlist de importação. **Sem UI no site** (telas e retrieval ficam para fases próprias). A importação de leading cases é a **Fase 2** (depende de um probe da API BFF do TCU — ver §7).
**Antecede:** [[handoff-2026-07-18-precedentes]] · Fase 0 (probe) em `docs/superpowers/specs/2026-07-18-rede-precedentes-tcu-probe-design.md` (GO, 18/07).

---

## 1. Contexto e decisões já tomadas

O probe da Fase 0 mediu, sobre 1.685 acórdãos com inteiro teor: **40.107 citações** "Acórdão N/AAAA" (mediana 15/acórdão), **23% no voto**, e **89,9% apontam para acórdãos externos** (fora do acervo de 1.863). Os leading cases sobem sozinhos e são juridicamente plausíveis (1441/2016 citado por 185, sendo 80 no voto; 2622/2013 do BDI). Extração confiável (zero falso positivo na amostra). **GO confirmado pelo Daniel.**

Decisões do brainstorming da Fase 1:
- **Ordem:** grafo primeiro (esta fase); importação de leading cases é a Fase 2 (tem risco técnico próprio — a BFF).
- **Entregável da Fase 1:** infra (grafo persistido) + **wishlist** (relatório dos leading cases ausentes priorizados). Sem UI no site.
- **Modelo de dados:** tabela relacional de **arestas** identificadas por número/ano; nós externos convivem naturalmente (alvo sem documento) e passam a casar sozinhos quando importados. Confirmado pelo Daniel.
- **Fluxo contínuo** (requisito de [[feedback-fluxo-continuo-passivo-e-novos]]): a extração cobre o passivo E as futuras inclusões.

## 2. Modelo de dados

Novo model `AcordaoCitacao` (uma aresta por par **origem → alvo**, deduplicada):

```prisma
model AcordaoCitacao {
  id            String   @id @default(cuid())
  origemId      String                                   // Document (category='acordao') que CITA
  origem        Document @relation("CitacoesDeAcordao", fields: [origemId], references: [id], onDelete: Cascade)
  numeroAlvo    Int                                      // acórdão citado — identidade estável
  anoAlvo       Int
  colegiadoAlvo String?                                  // colegiado da citação, se explícito (desambiguação futura)
  noVoto        Boolean  @default(false)                 // citado no VOTO ao menos uma vez (razão de decidir)
  ocorrencias   Int      @default(1)                     // nº de vezes que a origem cita esse alvo
  criadoEm      DateTime @default(now())

  @@unique([origemId, numeroAlvo, anoAlvo])              // uma aresta por par origem→alvo
  @@index([numeroAlvo, anoAlvo])                         // autoridade / wishlist / "quem cita X"
  @@index([origemId])                                    // "o que X cita" / delete idempotente
}
```

No `Document`, a relação inversa: `citacoesDeAcordao AcordaoCitacao[] @relation("CitacoesDeAcordao")`.

**Por que relacional e não Json em `tcuAnalise`:** os três usos futuros (autoridade, retrieval, navegação) e a wishlist precisam de consultas de agregação — "quem cita o acórdão X?" (`GROUP BY numeroAlvo,anoAlvo`) e "o que X cita?" (`WHERE origemId`). Um Json por acórdão guardaria, mas não responde a isso com eficiência. A migração é leve e aditiva (tabela nova, via `db push` — padrão do projeto; não altera nenhum model existente).

**Nós externos:** o alvo é só um par (número, ano); não precisa existir como `Document`. Um leading case ausente é um alvo sem documento. Quando a Fase 2 importar esse acórdão, as arestas passam a casar **sozinhas** (a identidade é número/ano) — sem religação.

**Dedup e peso:** uma aresta por par origem→alvo (não por ocorrência), com `noVoto=true` se **ao menos uma** citação daquela origem para aquele alvo caiu no voto, e `ocorrencias` = total. Assim "citado por N" conta **acórdãos distintos** (autoridade real), não repetições. O peso "voto pesa mais" é aplicado **na consulta/ranking** (ex.: ordenar por citações, desempatando por citações-no-voto; ou um score `citadoPor + k·noVotoCount`), calibrável depois — **não** fixado no schema.

## 3. Extração → arestas (módulo puro)

Novo módulo `lib/tcu/extrair-arestas-precedentes.ts`, reaproveitando a Fase 0:
- `arestasDeAcordao(texto, self): ArestaPrecedente[]` — roda `extractAcordaoCitations` (Fase 0), atribui a seção via `seccionarAcordao`/`secaoDe`, **descarta auto-citação** (alvo == `self`), e **agrega por (numeroAlvo, anoAlvo)**: `noVoto = alguma ocorrência na seção 'voto'`, `ocorrencias = contagem`, `colegiadoAlvo = o primeiro não-nulo`.
- `ArestaPrecedente = { numeroAlvo: number; anoAlvo: number; colegiadoAlvo: string | null; noVoto: boolean; ocorrencias: number }`.
- Puro (texto → arestas, sem banco). Reusado pelo núcleo e pelo backfill — mesma lição da Fase 0 (o que se prova é o que roda).

**Melhoria do extrator (follow-up do review da Fase 0):** ampliar `acordao-citation-extractor.ts` para reconhecer também **"Acórdão TCU N/AAAA"** (TCU *antes* do número), hoje não capturado. E o guard de auto-citação passa a valer também quando `acordaoNumero` é nulo (não filtra por número inexistente, mas o backfill/núcleo já conhece o self).

## 4. Persistência e fluxo contínuo

Função `persistirArestasPrecedentes(prisma, origemId, arestas)` — **idempotente**: `deleteMany({ where: { origemId } })` seguido de `createMany(arestas com origemId)`. Reprocessar um acórdão é seguro (recomeça do zero para aquela origem).

Cobre os três caminhos (a mesma estrutura da catalogação contínua do inteiro teor):
- **Passivo já catalogado** (1.685 com `tcuTextoCompleto`): `scripts/backfill-precedentes-tcu.ts` varre e (re)popula as arestas a partir do texto guardado — **sem rede** (molde de `reanalyze-tcu.ts`), dry-run por padrão, `--execute`.
- **Futuras inclusões:** a extração+persistência entram **no núcleo `lib/tcu/catalogar-acordao.ts`**, que já é o caminho do cron `catalog-tcu-inteiro-teor`. Todo acórdão novo catalogado popula suas arestas no mesmo passo.
- **Passivo ainda não catalogado** (`tcuAnalise IS NULL`): já é a fila do cron; ao catalogar pela primeira vez, sai com as arestas.

⚠️ O backfill do passivo é **passo obrigatório** do rollout (o cron só toca quem entra novo; os 1.685 já catalogados só o backfill popula).

## 5. Consultas: autoridade e wishlist

- **Autoridade de um acórdão-alvo** `(numero, ano)`: `COUNT(*)` das arestas com esse `numeroAlvo/anoAlvo` = `citadoPor`; `COUNT WHERE noVoto` = `citadoNoVoto`.
- **Wishlist (o entregável)** — alvos que **não existem** como `Document`, agregados e ordenados por autoridade:
  ```sql
  SELECT "numeroAlvo", "anoAlvo",
         COUNT(*) AS "citadoPor",
         COUNT(*) FILTER (WHERE "noVoto") AS "citadoNoVoto"
  FROM "AcordaoCitacao" ac
  WHERE NOT EXISTS (
    SELECT 1 FROM "Document" d
    WHERE d.category = 'acordao' AND d."acordaoNumero" = ac."numeroAlvo" AND d."acordaoAno" = ac."anoAlvo"
  )
  GROUP BY "numeroAlvo", "anoAlvo"
  ORDER BY "citadoPor" DESC
  LIMIT 100;
  ```
- `scripts/wishlist-precedentes-tcu.ts` roda essa consulta e escreve um JSON em `docs/audits/` + resumo no console. A folha de wishlist (artifact) é montada a partir desse JSON — os leading cases ausentes que a Fase 2 deve importar primeiro.

## 6. Fora de escopo (YAGNI para a Fase 1)

- Qualquer UI no site (página do acórdão, Lei Comentada, navegação da rede).
- Qualquer mudança no retrieval/busca (a trilha está "fechada com evidência" — exige eval própria).
- A importação de leading cases (Fase 2).
- Desambiguação por colegiado na autoridade (a citação nem sempre traz colegiado; agrega-se por número/ano, guardando `colegiadoAlvo` para uso futuro).

## 7. Fase 2 (esboço — spec próprio depois)

Importar os leading cases da wishlist. **Bloqueio técnico conhecido** (mapeado na viabilidade, 18/07): o inteiro teor do TCU exige a URL RTF com um `item0` interno que **não** se deriva de número/ano — só vem do feed de dados abertos, que não busca por número. **Pista:** a API BFF (`pesquisa.apps.tcu.gov.br/.../relevar-busca-bff`) aceita `termo` e retorna `urlArquivo` (com `item0`) + ementa. **A Fase 2 começa por um probe R$0** que valida se a BFF resolve (número, ano) → {ementa, urlArquivo}. Se sim: importar com ementa (entra na busca) e, com o `item0`, o inteiro teor (catalogação completa). Se não: escalar alternativas (paginação do feed até o ano; entrada manual da URL). **Não construir o importador antes do probe.**

## 8. Riscos

- **Ambiguidade de colegiado** — par (nº, ano) pode existir em colegiados diferentes; a citação nem sempre traz colegiado. Agrega-se por (nº, ano); `colegiadoAlvo` guardado para refino. A wishlist pode, raramente, fundir dois acórdãos homônimos de câmaras distintas — aceitável para priorizar importação.
- **Volume de escrita do backfill** — ~arestas na casa das dezenas de milhares (o probe achou 40.107 ocorrências; dedupadas por par, menos). `createMany` em lote por acórdão; backfill idempotente. Aditivo e reversível (`DELETE FROM "AcordaoCitacao"`).
- **Falsos positivos da regex** — mitigados na Fase 0 (zero na amostra); a ampliação "Acórdão TCU N/AAAA" ganha testes negativos próprios.
- **Auditores cegos** ([[feedback-auditores-cegos]]) — cobrir extração e persistência nos dois sentidos (falta e excesso de arestas); rodar após o `db push`.
