# Auditoria da Lei 14.133 Comentada — RESULTADOS (Fase 0)

> ## ✅ APLICADO em 15/07/2026 (branch `fix/lei-comentada-integridade`, não commitado)
> 1. **Filtro `isPublic` corrigido** — `!isAuthenticated` → `!isAdminUser` em
>    `app/api/lei-14133/article-docs/[numero]/route.ts:171`. Teste de regressão novo:
>    `app/api/lei-14133/article-docs/[numero]/__tests__/ispublic-filter.test.ts` (3/3 ✅;
>    o caso "aluno logado" **falhava** antes do fix, provando o vazamento).
> 2. **62 registros apagados** (autorizado pelo Daniel): 57 ONs fantasma + 5 docs de teste.
>    Script: `scripts/delete-ons-fantasma-e-docs-teste.ts` · Backup:
>    `docs/audits/2026-07-15-backup-pre-delete.json` · 62 chunks saíram por cascade, 0 órfãos.
>    **Verificado depois:** ONs 162→105 · docs de teste 0 · quadro comparativo sumiu ·
>    títulos abreviados 58→1 (só a legítima ON 102/2025, poupada).
>
> 🛟 **O pre-flight evitou um estrago:** apagar por padrão de título teria destruído a
> **ON 102/2025** — título abreviado, mas legítima (content=1.035 chars, url válida do DOU).
> O critério final foi `content IS NULL AND url vazia`, não o título. **Ela precisa ser
> RENOMEADA, não apagada** — pendência aberta.
>
> ⏳ **Ainda NÃO feito:** exibir `content` (sintoma 6 persiste), filtrar `lei-artigo`
> (183 docs), consertar o cron (os fantasmas voltam no próximo run!), `getDocHref`.

**Executada:** 2026-07-15 · read-only · 3,0s · custo zero (sem LLM)
**Script:** `scripts/audit-lei-comentada-integridade.ts`
**Dados brutos:** `docs/audits/2026-07-15-lei-comentada-integridade.json`
**Plano:** `docs/superpowers/specs/2026-07-15-lei-comentada-integridade-design.md`

---

## 🔑 O achado que explica tudo: 57 ONs DUPLICADAS

Não é uma inconsistência de nomenclatura. **É um registro fantasma por ON.**

| | Registro canônico | Registro fantasma |
|---|---|---|
| Título | `Orientação Normativa AGU nº 94/2024` | `ON 94/2024` |
| `isPublic` | **true** | **false** |
| `content` | 2.969 chars (íntegro) | **NULL** |
| `url` | URL do DOU, válida | **vazia** |
| `type` | `link` | `pdf` |
| Criado em | 2025-11-03 | 2026-03-03 |
| Artigos vinculados | `[37, 5, 11]` | `[5, 7, 9]` |

**57 pares** (de 162 ONs no total: 100 canônicas + 58 abreviadas + 4 CNU).
Os fantasmas nascem do cron `app/api/cron/import-documents/route.ts:141-165`, que
grava `title: on.numero` (o campo errado — o certo é `on.titulo`, `:118`) e **não grava
`content`** nem `url` utilizável.

**Consequência:** os dois registros aparecem lado a lado na lista do artigo. O aluno
tem 50% de chance de clicar no fantasma. O Daniel clicou.

> **A "falta de padronização" que o Daniel notou não é cosmética — é o sintoma visível
> de um registro quebrado.** Todo título no formato `ON X/AAAA` é um fantasma.

---

## Sintoma a sintoma

### ✅ Sintoma 5 — "erro ao baixar a ON 2/2012" — RESOLVIDO

Ele clicou no fantasma:
```
id=487bac16… | título: "ON 2/2012" | url: (vazia) | type=pdf | isPublic=false | content=NULL
id=30c92cd0… | título: "Orientação Normativa AGU nº 2/2012" | url: https://www.gov.br/agu/… | isPublic=true | content=252
```
`url` vazia → `HighlightCard.tsx:28` (`if (doc.url)` — string vazia é falsy) → cai em
`/api/documents/[id]/download` → a rota tenta ler `public/uploads` (não existe) → **404
"Arquivo no servidor não encontrado"**. Exatamente a mensagem de erro relatada.

O registro bom estava ao lado, funcionando.

### ✅ Sintoma 6 — "ON 94/2024 só mostra o inciso I" — RESOLVIDO ⚠️ (meu diagnóstico anterior estava ERRADO)

**O `content` NÃO está truncado.** Está íntegro: 2.969 chars, preâmbulo + incisos I a
VII + Referências + Fonte. Verificado lendo o texto completo.

**A causa real: a Lei Comentada nunca mostra o `content`.**
- `app/api/lei-14133/article-docs/[numero]/route.ts:184` — o `select` pede
  `description: true`. **`content` não é selecionado.**
- `:229` — `summary: doc.summary || doc.description`
- `components/lei-14133/LeiDocumentDetails.tsx:142` — renderiza `{document.description}`

E a `description` da ON 94/2024 é **exatamente o inciso I e nada mais**:
> *"I - O cônjuge do Presidente da República, em sua atuação de interesse público, possui
> natureza jurídica própria…"*

→ **Não é o texto que está mutilado no banco; é a tela que exibe o campo errado.**
A correção é bem menor do que eu havia estimado: selecionar e exibir `content`,
com `description` como fallback.

**O mecanismo de truncamento (800 chars + 3 parágrafos) É REAL, mas atinge a `description`.**
Visível no fantasma da ON 94/2024, cuja `description` traz os incisos I, II e III
cortados em ~800 chars, no meio da frase — a assinatura de
`orientacoes-normativas.ts:317-318` (`.slice(0,3)` + `.substring(0,800)`).

**Distribuição real do `content` das ONs** (refuta minha estimativa anterior):

| ONs | sem content (<50) | min | mediana | p90 | max | média |
|---|---|---|---|---|---|---|
| 162 | **64** | 85 | 602 | 1.752 | 4.189 | 851 |

Só **4 ONs** batem no teto de 780-805. O JSON de auditoria de abril (max exatamente 800)
refletia o scrape, não o estado atual do banco — vários registros foram melhorados depois
pelos caminhos do DOU.

### 🟠 O impacto real no RAG — menor do que eu temi, mas não é zero

`lib/embeddings/source-text.ts:20-26` usa `[content, tcuEmentaCompleta, description]`.
Como o `content` está íntegro na maioria, **o assistente lê o texto bom na maioria dos casos.**

**Mas 64 das 162 ONs (40%) não têm `content`** → o RAG cai na `description`, que é
resumo/extrato — e em vários casos **texto gerado por IA**:

> `ON 82/2024` → *"A Orientação Normativa 82/2024 da AGU **esclarece que** editais de pré-seleção…"*
> `ON 93/2024` → *"A Orientação Normativa 93/2024 **esclarece que** os contratos de aluguel…"*
> `ON 2/2012` → *"A Orientação Normativa nº 2/2012 da AGU **instrui** as unidades de contencioso…"*

Isso é texto derivado de IA sendo citado como norma. Continua sendo um problema real —
só não é o problema de escala que eu havia anunciado.

### ✅ Sintoma 2 — "quadro comparativo com link morto" — RESOLVIDO: é DADO DE TESTE EM PRODUÇÃO

```
id=487c1978-93a5-4364-aaae-d45585d6e688
título: "Quadro Comparativo: Lei 8.666/93 x Lei 14.133/2021"
category=outro | type=pdf | isPublic=false | url="#teste-quadro-comparativo"
```

`url = "#teste-quadro-comparativo"` — uma âncora falsa. **Nunca levou a lugar nenhum.**
Origem: `scripts/populate-lms-test.ts`. **São 5 documentos de teste vivos na base:**

| Título | url |
|---|---|
| Quadro Comparativo: Lei 8.666/93 x Lei 14.133/2021 | `#teste-quadro-comparativo` |
| Fluxograma do Processo Licitatório na Lei 14.133/2021 | `#teste-fluxograma` |
| Modelo de Termo de Referência - Serviços Contínuos | `#teste-modelo-tr` |
| Checklist de Conformidade - Pregão Eletrônico | `#teste-checklist-pregao` |
| Modelo de Estudo Técnico Preliminar (ETP) | `#teste-modelo-etp` |

Todos `isPublic=false`, `category='outro'` (→ vaza para "Outros Documentos").
São títulos **atraentes** — exatamente o que um aluno clicaria.

### 🟠 Sintoma 4 — poluição dos artigos genéricos — CONFIRMADO COM NÚMERO

Extrator de citação por regex (janela de ±250 chars procurando "14.133"), custo zero:

| Artigo | Total | **Cita** | Ambíguo | **NÃO cita** | % que cita |
|---|---|---|---|---|---|
| **1º** | 230 | 41 | 15 | **174** | **18%** |
| **5º** | 1.140 | 442 | 46 | **652** | **39%** |
| 6º | 621 | 396 | 65 | 160 | **64%** ← tem o filtro |
| 75 | 484 | 166 | 27 | 291 | 34% |
| 107 | 84 | 13 | 0 | 71 | **15%** |

**O art. 6º é o mais limpo (64%) — é o único com filtro determinístico**
(`lib/lei-indexer.ts:170`). Prova de que o filtro funciona e de que estendê-lo resolve.

**O contador "240" do art. 1º está explicado:** 230 Documents + 10 LegislativeActs = **240**. ✓

#### 🎯 A prova viva: a ON 94/2024

A ON que o Daniel abriu **é sobre o cônjuge do Presidente da República** — representação
simbólica da primeira-dama, prestação de contas de agenda e viagens. **Não tem uma linha
sobre licitações.**

Está vinculada a: **art. 5º, art. 7º, art. 9º, art. 11 e art. 37 da Lei 14.133.**

É o exemplo perfeito do vínculo temático de confiança 40: o Gemini viu "princípios da
Administração Pública" no inciso III e vinculou ao artigo dos princípios da Lei de Licitações.

### ✅ Sintoma 1 — `lei-artigo` vazando — CONFIRMADO: 183 documents

Categorias vazando para "Outros Documentos" (fora de `CATEGORY_DISPLAY`):

| Categoria | Docs |
|---|---|
| `lei-artigo` | **183** |
| `enunciados` | 169 (filtrado à parte em `:281`) |
| `manual-tcu` | 154 |
| `orientacao_procedimento` | 56 |
| `ato-normativo` | 53 |
| `boa_pratica` | 9 |
| `outro` | 6 ← **aqui estão os 5 docs de teste** |
| `bibliografia` | 1 |

### ✅ Sintoma 3 — nomenclatura — CONFIRMADO, mas reclassificado

| Padrão | ONs |
|---|---|
| 1. canônico (`Orientação Normativa AGU nº 105/2025`) | 100 |
| 2. abreviado (`ON 45/2014`) — **os fantasmas** | 58 |
| 4. CNU/CGU zero-padded | 4 |
| 3. DOU verbatim (CAIXA ALTA) | **0** |

O formato "DOU verbatim" que eu previa **não existe no banco** — refutado.

---

## ❌ Três alarmes meus que a auditoria REFUTOU

Registro por honestidade — eu havia anunciado estes como problemas e eles não são:

1. **"Todo LegislativeAct sem officialUrl dá 404"** → **0 atos** nessa condição. O bug do
   `/atos-normativos/[id]` (rota inexistente) é real **no código**, mas hoje não atinge
   ninguém. Continua valendo corrigir (é uma bomba-relógio), mas não é urgente.
2. **"190 documents com url relativa quebrada"** → são os **183 `lei-artigo`** apontando
   para `/area-restrita/artigo/N`, **rota que existe**. Links válidos. Não são downloads.
3. **"ONs invisíveis ao filtro por ano"** → **0 ONs**. Todos os títulos contêm `/AAAA`.

---

## Volume real (corrige a estimativa do plano)

| Modelo | Registros com vínculo |
|---|---|
| **Document** | **5.516** (de 6.486 no total) |
| TribunalDecision | 832 |
| Lesson | 101 |
| LegislativeAct | 81 |
| GlossaryTerm | 64 |
| BlogPost / Publication | 0 |

**Escopo da reanálise: ~5.600 docs** (Document + LegislativeAct), não 7.400.
→ **Custo revisado: ~R$ 25–60 · ~2h20 de wall clock.** Continua irrelevante.

---

## O que isso muda no plano

### Nova Fase 1 (a ordem mudou — estes são os de maior impacto e menor risco)

| # | Ação | Impacto | Risco |
|---|---|---|---|
| **1.0** ⭐ | **`!isAuthenticated` → `!isAdmin`** em `article-docs/[numero]/route.ts:174` | **Resolve os sintomas 2, 3, 5 e metade do 6.** Sem apagar nada | 1 linha, reversível |
| **1.1** | **API selecionar e exibir `content`** (fallback `description`) | Mata o resto do sintoma 6 | 1 linha no `select` + UI |
| **1.2** | Filtrar `lei-artigo` (reusar `HIDDEN_CATEGORIES`) | Sintoma 1 (183 docs) | 1 linha |
| **1.3** | Consertar o cron (`on.titulo`, gravar `content`) | **Impede que os fantasmas voltem — ponto de escrita** | baixo |
| **1.4** | `getDocHref`: tratar `url === ''`, apontar para `/documento/[id]` | Bomba-relógio do `/atos-normativos/` | baixo |
| **1.5** | Deduplicar/remover os 57 fantasmas e os 5 docs de teste | Limpeza definitiva | ⚠️ **destrutivo** |

⭐ **1.0 é a correção de maior alavanca do projeto inteiro.** Uma linha, reversível,
resolve 4 dos 6 sintomas relatados, sem tocar em nenhum registro.

⚠️ **1.5 envolve exclusão de documentos.** Regra do projeto: *nunca excluir documentos sem
solicitação explícita.* **Aguardar autorização.** E, com 1.0 aplicado, **deixa de ser
urgente** — o lixo fica invisível ao aluno e continua disponível ao admin para curadoria.

**Ordem recomendada:** 1.0 → 1.1 → 1.2 (destravam o vídeo hoje) · 1.3 → 1.4 (impedem
regressão) · 1.5 só depois de autorização e conferência.

### 🎯 O ACHADO DE MAIOR ALAVANCA — uma linha resolve quase tudo

`app/api/lei-14133/article-docs/[numero]/route.ts:174`:
```ts
where: {
  leiArticlesArr: { isEmpty: false },
  ...(!isAuthenticated && { isPublic: true }),   // ⚠️ só filtra quem NÃO está logado
},
```

O filtro `isPublic` **só é aplicado a visitantes anônimos**. **Qualquer usuário logado —
não só admin — vê todos os documentos privados.**

**Quantificação:**

| | |
|---|---|
| Documents vinculados a artigos | 5.516 |
| Destes, `isPublic=false` (exibidos a **qualquer aluno logado**) | **60** |

E quem são os 60?

| Categoria | Docs |
|---|---|
| `orientacao-normativa` | **55** ← os fantasmas |
| `outro` | **5** ← os documentos de teste |

> **Os 60 documentos privados que vazam para alunos logados são EXATAMENTE os 55 fantasmas
> + os 5 documentos de teste. 100% do conteúdo privado exibido na Lei Comentada é lixo.**

Não há vazamento de conteúdo valioso — o que vaza é precisamente o que está quebrado.
E o inverso também vale: **todo o lixo está marcado como privado**. O banco já sabe o que
não devia aparecer; a rota é que não pergunta.

**Correção: trocar `!isAuthenticated` por `!isAdmin`** (uma linha).
- Resolve o sintoma 5 (ON 2/2012 — o fantasma some)
- Resolve o sintoma 2 (quadro comparativo — é doc de teste, some)
- Resolve o sintoma 3 (os títulos `ON X/AAAA` são os fantasmas — somem)
- Resolve metade do 6 (o fantasma da ON 94 some; sobra corrigir o campo exibido)
- **Sem apagar nada.** Totalmente reversível. Não fere a regra de não excluir documentos.
- O Daniel, como admin, continua vendo tudo — correto para curadoria.

No art. 5º são apenas 6 registros privados — ou seja, o efeito visual no contador é
pequeno (1.140 → 1.134). **A correção não é sobre volume; é sobre não servir link
quebrado e dado de teste ao aluno.**

### Fase 3 (régua) — decisão do Daniel com os números na mão

Régua escolhida: **citação direta OU tema forte**.
- Art. 5º: **1.140 → 442** (cita) **+ 46** (ambíguo) ≈ **488**. Sai ~57%.
- Art. 1º: **230 → 41 + 15 ≈ 56**. Sai ~76%.
- Art. 107: **84 → 13**. Sai ~85%.

**O extrator de regex funciona e já está escrito** (`scripts/audit-lei-comentada-integridade.ts`,
função `extractCitations`). Ele dá `mentions` de graça, sem LLM — o que significa que a
poda por citação **não precisa de reanálise**. Só o "tema forte" (≥75) precisa, e só para
os que não citam.

→ **Caminho mais barato:** aplicar o regex primeiro (custo zero, resolve ~40% dos vínculos
como "cita"), e reanalisar com LLM **apenas os que não citam** — de 5.600 para talvez
~3.000 docs. **Custo cai para ~R$ 15–30.**

---

## Pendências para o Daniel

1. **Autoriza remover os 5 documentos de teste?** (regra: nunca excluir sem pedido)
2. **Os 57 fantasmas: apagar ou só esconder?** Recomendo esconder primeiro (reversível),
   apagar depois de confirmar que os canônicos cobrem todos.
3. **Confirmar:** `article-docs` filtra `isPublic` para não-admin? (define a gravidade real)
4. Corte do "tema forte" — proponho ≥75, calibrável agora que temos os números.
