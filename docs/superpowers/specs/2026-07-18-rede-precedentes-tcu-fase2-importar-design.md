# Rede de precedentes do TCU — Fase 2 (Importar leading cases) — Design

**Data:** 2026-07-18
**Status:** aprovado — o Daniel validou as 3 decisões de produto (18/07): (1) importar em 2 níveis (ementa garantida + inteiro teor quando resolver); (2) desambiguação por heurística + relatório de ambíguos; (3) seleção dos top ~30-50 por autoridade (priorizando voto), curadoria semi-automática.
**Antecede:** Fase 1 (grafo persistido) — `docs/superpowers/specs/2026-07-18-rede-precedentes-tcu-fase1-grafo-design.md`.
**Depende de:** a wishlist da Fase 1 (`docs/audits/2026-07-18-wishlist-precedentes-tcu.json`).

---

## 1. Objetivo

Importar para o acervo os **leading cases ausentes** — os acórdãos muito citados por outros que ainda não temos (a wishlist). São grandes referências do pensamento do TCU; trazê-los **melhora a busca de todo o site** (eles passam a ser recuperáveis) e **fecha elos da rede de precedentes** (as arestas que apontam para eles deixam de ser "externas"). Onde o inteiro teor for acessível, o acórdão importado também ganha a catalogação de razão de decidir (o pipeline da Fase anterior).

**Métrica de sucesso:** os top da wishlist deixam de ser nós externos (passam a existir como `Document` indexado e recuperável na busca), e a taxa de casamento da rede sobe.

## 2. Viabilidade — o que o probe da BFF (18/07) já provou

A rota BFF antiga do código (`relevar-busca-bff`) está **quebrada** (retorna a SPA). A rota real, capturada no navegador:

- **`POST https://pesquisa.apps.tcu.gov.br/api/publico/entidades/busca`** — body = termo (string, ex.: `"2622/2013"`).
- Resposta: `{ entidades: [ { titulo, subtitulo, texto, link } ] }`, onde:
  - `titulo` = identificação completa, ex.: `"ACÓRDÃO 2622/2013 ATA 37/2013 - PLENÁRIO"` (número, ata, **colegiado**)
  - `subtitulo` = relator, ex.: `"Relator: Marcos Bemquerer"`
  - `texto` = **a ementa/sumário**
  - `link` = URL do documento com um KEY interno, ex.: `.../documento/acordao-completo/*/KEY:ACORDAO-COMPLETO-1286063/...`
- O `link` abre a página do documento com **metadados completos** (número, relator, processo, data da sessão, colegiado), **ementa**, e o **inteiro teor seccionado** (Relatório/Voto/Acórdão — medido ~390k chars no 2622/2013) + botão **Download** (RTF).

**Conclusão:** dá para importar um acórdão só com o número/ano. O antigo bloqueio (o `item0` interno "só vinha do feed") está dissolvido — a API de busca resolve número → KEY → documento completo.

## 3. Fase 2.0 — Probe técnico de fechamento (antes de construir o importador)

Restam dois pontos técnicos a fechar com evidência (R$0, 2-3 casos da wishlist), no molde probe-first que já usamos:

1. **URL do inteiro teor.** Capturar como o RTF é obtido a partir do KEY/página do documento — se resolve para a mesma URL SAGAS (`SvlVisualizarRelVotoAcRtf?...`) que o nosso `catalogarAcordao` já consome (então reusamos o pipeline inteiro sem mudança), ou se é outro formato/endpoint. Se o download for o RTF SAGAS, o inteiro teor é grátis via `rtf-to-text` + `seccionar` existentes.
2. **Desambiguação.** O mesmo número retorna **várias entidades** (ex.: `2622/2013 ATA 37 - Plenário`, `ATA 15 - Segunda Câmara`, `Acórdão de Relação ...`). Validar o critério de escolha (ver §5) contra casos reais.

Só depois desse probe (GO) se constrói o importador. Se o inteiro teor não for acessível de forma confiável, cai-se para o **nível ementa** (§4, ainda melhora a busca).

## 4. Dois níveis de importação

- **Nível 1 — ementa (garantido):** cria o `Document` (`category='acordao'`) com número/ano/colegiado/relator/ementa (`tcuEmentaCompleta`). Isso basta para **entrar na busca** (o `selectSourceText` usa `tcuEmentaCompleta`; ≥50 chars) e para as arestas casarem. Sem inteiro teor, sem razão de decidir.
- **Nível 2 — inteiro teor (quando acessível):** além do acima, grava o `tcuLinkPDF` (RTF) e deixa o acórdão na fila do `catalog-tcu-inteiro-teor` + `sync-precedentes-tcu` — que o catalogam (seções, artigos debatidos) e extraem SUAS arestas. Reusa 100% do pipeline existente.

✅ **Decidido (Daniel, 18/07):** importar **sempre em Nível 1** e **promover a Nível 2** quando o RTF resolver — nada se perde.

## 5. Desambiguação de colegiado

A citação nem sempre traz colegiado; a wishlist agrega por (número, ano). Mas o acórdão real tem um colegiado. Critério proposto (determinístico, ordenado):
1. Preferir **"acórdão-completo"** sobre "acórdão de relação" (o de relação é decisão simplificada).
2. Se a aresta que mais aponta para esse alvo trouxe colegiado explícito, casar por ele.
3. Senão, pegar o **1º resultado por relevância** da BFF e **registrar o colegiado escolhido** para auditoria.

✅ **Decidido (Daniel, 18/07):** heurística automática **+ um relatório de "ambíguos"** para o Daniel revisar os poucos casos duvidosos (não confirmação caso a caso).

## 6. Seleção — quantos e quais importar

✅ **Decidido (Daniel, 18/07):**
- **Quantidade:** lote inicial dos **top ~30-50 por autoridade**, priorizando os com `citadoNoVoto` alto (leading cases de fundamentação, não de passagem) — ex.: 1441/2016 (185, voto 80), 2622/2013 (45, voto 21), 459/2022 (26, voto 16).
- **Curadoria semi-automática:** o script gera a lista candidata a partir da wishlist já rankeada; o Daniel marca as que quer; o importador roda sobre as aprovadas. O Daniel é o curador editorial.

## 7. Arquitetura da importação

- **`lib/tcu/buscar-acordao-tcu.ts`** (novo) — cliente da API de busca: `buscarAcordaoPorNumero(numero, ano): CandidatoAcordao[]` (POST /entidades/busca, parseia as entidades, extrai KEY + colegiado + relator + ementa). Rate-limit 1 req/s (padrão do projeto). Puro-ish (I/O de rede isolado).
- **`lib/tcu/importar-acordao.ts`** (novo) — dado um candidato escolhido: cria/atualiza o `Document` (`category='acordao'`, `isPublic=true`, `embeddingStatus='pending'`, metadados + `tcuEmentaCompleta`, e `tcuLinkPDF` se o RTF resolver). Idempotente pela unique `(acordaoNumero, acordaoAno, tcuOrgaoJulgador)`. **Não** duplica um acórdão já existente.
- **`scripts/importar-leading-cases.ts`** — lê a wishlist (ou uma lista curada), busca cada um, desambigua, importa. Dry-run por padrão; `--execute`. Relatório de importados / ambíguos / falhas.
- **Indexação:** os `Document` novos entram na fila de embeddings existente (`embeddingStatus='pending'`) → `migrate-to-embeddings` / processo existente indexa → recuperáveis na busca.
- **Rede:** ao importar, as arestas que apontavam para aquele (número, ano) passam a casar sozinhas (a Fase 1 casa por número/ano, sem religação). E o acórdão importado, ao ser catalogado (Nível 2), gera suas próprias arestas pelo cron `sync-precedentes-tcu`.

## 8. Fora de escopo (YAGNI para a Fase 2)

- Mudar o ranking/retrieval da busca (usar autoridade para reordenar) — é fase própria, exige eval (a trilha de retrieval está "fechada com evidência").
- UI de navegação da rede.
- Importar acórdãos que não estão na wishlist (a demanda é os leading cases citados).

## 9. Riscos

- **Termos de uso / rate-limit do TCU** — respeitar 1 req/s; a importação é um lote pontual + manutenção leve. Não é scraping massivo.
- **Desambiguação errada** — mitigada pela heurística + relatório de ambíguos (§5).
- **Qualidade da ementa** — a `texto` da BFF pode vir truncada; no Nível 2 o inteiro teor supre. Medir na Fase 2.0.
- **Idempotência** — a unique de acórdão evita duplicar; reimportar é seguro.
- **Fonte pode mudar de novo** — a rota BFF já mudou uma vez (a antiga quebrou). Isolar o cliente (`buscar-acordao-tcu.ts`) num módulo só, para um eventual conserto futuro ser local.
