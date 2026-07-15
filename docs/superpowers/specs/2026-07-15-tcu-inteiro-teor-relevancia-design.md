# Inteiro teor do TCU e hierarquia de relevância dos precedentes

**Data:** 2026-07-15
**Autor:** Daniel Barral + Claude
**Status:** 🟡 PROPOSTA — aguarda revisão
**Origem:** ao revisar as fontes do art. 5º, o Daniel perguntou: *"desses acórdãos que citam o art. 5º, quantos usam os princípios como razão de decidir? na práxis é muito comum citar princípios, mas não desdobrá-los em considerações relevantes para a causa."*

**Reabre parcialmente:** `docs/superpowers/specs/2026-07-07-tcu-acordaos-ementa-oficial-indexacao-design.md`, que deixou o inteiro teor fora de escopo (YAGNI). Ver §7.

---

## 1. O problema

A Lei 14.133 Comentada exibia 1.132 documentos no art. 5º. Após separar citação de tema (PR #161), caiu para 448 — mas **448 continua alto**, e a investigação mostrou que o número é **ficção**:

| Dos 446 marcados como "citam o art. 5º" | |
|---|---|
| Citam no **texto oficial** | **19** |
| Só o **resumo de IA** mencionava | **404** |
| Sem texto oficial algum | 23 |

**Causa:** o backfill de citações (`scripts/backfill-article-citations.ts`) analisa `content + description`. A `description` é **resumo gerado por IA**, e esses resumos correlacionam explicitamente com a Lei 14.133. O extrator leu a correlação da IA como citação do tribunal.

**Prova irrefutável:** 159 dos documentos são **anteriores a 2021** e apareciam "citando a Lei 14.133/2021". O Informativo 97/2012 fala do *"art. 30 da Lei n. 8.666/1993"*; o resumo de IA diz *"relacionado ao (...) art. 5º da Lei 14.133/2021"*.

### O achado que reenquadra a pergunta

Spike com 6 acórdãos reais (inteiro teor baixado): **0 de 6 citam o art. 5º** — nem no relatório, nem no voto. Os artigos que aparecem são outros (15, 23, 67, 170).

Não é que a IA distorça a citação: **não há citação alguma**. Os acórdãos **citam o princípio, não o artigo**. Um voto discute economicidade por páginas escrevendo *"princípio da economicidade"* — jamais *"art. 5º da Lei 14.133"*.

⇒ **Para artigos que são listas de princípios, procurar citação do artigo é o caminho errado.** A correlação da IA não é invenção — é temática e legítima. O erro está no **rótulo**.

⇒ A pergunta respondível não é *"quantos citam o art. 5º"*, e sim: **"em quantos o princípio é debatido no Voto, e não apenas mencionado no Relatório?"**

---

## 2. O que o spike provou

**Executado em 15/07, 6+3 acórdãos reais, read-only.**

| Achado | Resultado |
|---|---|
| `tcuLinkPDF` responde? | ✅ HTTP 200 em 7/8 (1 timeout) |
| É PDF? | ❌ **É RTF.** `content-type: application/x-download`, magic bytes `{\rtf1` |
| Extrai texto? | ✅ 6/6 |
| Tem as seções? | ✅ **5/6** com Relatório + Voto + Acórdão |
| Tamanho do texto | mediana **63.003** chars · min 2.247 · **max 2.685.449** ⚠️ |
| Tamanho do arquivo | 227 KB – **14,5 MB** ⚠️ |
| Citam o art. 5º? | **0/6** |

**O endpoint se chama `SvlVisualizarRelVotoAcRtf`** — *Relatório, Voto, Acórdão, RTF*. O TCU entrega o julgado já seccionado.

**Por que ninguém sabia:** o campo se chama `tcuLinkPDF` (não é PDF); `tryEnrichFromAPI` retorna `textoCompleto: undefined` com o comentário *"API não tem texto completo"* (`lib/tcu-scraper.ts:445`); `tryEnrichFromWebsite` é stub nunca chamado (`:471-511`); e `tcuEnriquecimentoStatus` é hardcoded `'success'` (`sync-tcu-acordaos/route.ts:350`). **Ninguém nunca baixou um arquivo para ver.**

O precedente de falha registrado (`FUTURE_TASKS.md:257` — 187 chars extraídos, SPA JS-rendered) é sobre o **portal HTML**. O RTF é outra porta.

### Risco da ata — REFUTADO por medição

1.664 dos 1.842 links servem um arquivo chamado **`arquivosAta.rtf`**, o que sugeria ata de sessão inteira (vários acórdãos). Testados 3: **cada arquivo contém exatamente 1 acórdão — o correto**.

| Padrão de link | Acórdãos |
|---|---|
| `sagas/SvlVisualizarRelVotoAcRtf` (`arquivosAta.rtf`) | 1.664 |
| `sisdoc/ObterDocumentoSisdoc` | 160 |
| outro | 11 |
| sem link | 7 |

**1.835 de 1.842 (99,6%) têm link.**

---

## 3. Decisões tomadas

| Decisão | Escolha | Por quê |
|---|---|---|
| Papel dos resumos de IA | **Apoio; a fonte é o julgado** | Nunca podem gerar vínculo/citação nem se passar por texto da fonte |
| Como medir razão de decidir | **Só sinais determinísticos** | Foi IA no critério que causou o problema. Sem LLM |
| Guardar o texto extraído | **Sim, em `tcuTextoCompleto`** | Reanálise sem re-baixar; `unified-query` já lê o campo |
| Indexar no RAG | **NÃO** | Evita ~116k chunks e o flooding recusado em 07/07 |

---

## 4. Arquitetura

### 4.1 Módulos (`lib/tcu/`)

Cada um com uma responsabilidade, testável isolado:

| Módulo | O que faz | Depende de |
|---|---|---|
| `inteiro-teor-fetch.ts` | Baixa o RTF: timeout, retry, **teto de tamanho**, delay | — |
| `rtf-to-text.ts` | RTF → texto limpo | biblioteca de RTF (§4.4) |
| `seccionar-acordao.ts` | Acha os offsets de Relatório / Voto / Acórdão | — |
| `analise-relevancia.ts` | Conta termos por seção → objeto de sinais | `citation-extractor`, `lei-14133-termos` |
| `data/lei-14133-termos.ts` | Artigo → termos-chave (art. 5º = 22 princípios) | — |

**Fluxo:** `fetch → rtf-to-text → seccionar → analise → persistir`.

### 4.2 Dados

**`Document.tcuTextoCompleto`** — já existe no schema (`prisma/schema.prisma:113`). Passa a ser preenchido.

⚠️ **Documentar no schema, em letras garrafais:** este campo **NÃO É LIDO** por `lib/embeddings/source-text.ts` (que usa `[content, tcuEmentaCompleta, description]`) e **NÃO PODE** passar a ser. Indexá-lo adicionaria ~116k chunks e traria o flooding do top-5 recusado no design de 07/07. O texto está aqui para **análise**, não para retrieval.

**`Document.tcuAnalise Json?`** (novo) — as contagens cruas:

```jsonc
{
  "v": 1,                                  // versão do analisador
  "extraidoEm": "2026-07-15T…",
  "chars": 63003,
  "secoes": { "relatorio": [1200, 40100], "voto": [40100, 60200], "acordao": [60200, 63003] },
  "artigosCitados": { "15": { "relatorio": 0, "voto": 2, "acordao": 1 } },
  "termos": {                              // por artigo → termo → contagem por seção
    "5": {
      "economicidade":  { "forte": { "voto": 3 }, "fraco": { "voto": 5, "relatorio": 2 } },
      "competitividade":{ "forte": { "voto": 1 }, "fraco": { "voto": 1 } }
    }
  }
}
```

**É a fonte da verdade e não contém veredito** — o limiar fica fora do dado, calibrável a qualquer momento sem re-baixar.

**`Document.leiArticlesDebated String[]`** (novo, índice GIN) — derivado do JSON pelo limiar vigente, só para query rápida. **Recomputável** a partir do JSON. Simétrico a `leiArticlesArr` / `leiArticlesCited`.

**Hierarquia resultante:**

| Nível | Campo | Significado |
|---|---|---|
| 1 | `leiArticlesDebated` | tema debatido no **Voto** — razão de decidir |
| 2 | `leiArticlesCited` | **cita** o artigo no texto oficial |
| 3 | `leiArticlesArr` | sugerido por **IA** (tema) |

### 4.3 Contagem: forte vs. fraco

O termo nu gera falso positivo (*"eficiência"* aparece em qualquer texto administrativo). Duas contagens por termo:

- **forte** — `/princ[íi]pios?\s+(?:d[aeo]s?\s+)?<termo>/i`. É o princípio sendo nomeado como tal.
- **fraco** — o termo isolado. Serve de sinal secundário, nunca sozinho.

**Limiar inicial** (calibrável, mora em constante, não no dado): `forte.voto >= 2` → o artigo entra em `leiArticlesDebated`.

Justificativa do 2: uma menção é a citação ornamental que o Daniel descreveu; repetição no Voto indica desdobramento. **Este número precisa de calibração com os dados reais** — a ser feita quando o backfill rodar, comparando amostra manual.

### 4.4 Extração de RTF — precisa de spike próprio

O extrator do spike foi **rudimentar** e não serve para produção: quebrou palavras (`TRIBUNAL DE CONTAS DA UNIÃ\nO`) e deixou lixo (`shapeType202fFlipH0…`).

**Requisitos:** não quebrar palavras; remover metadados/imagens; preservar quebras de parágrafo (o seccionamento depende delas); lidar com `\'hh` (cp1252) e `\uN`.

**Ação:** avaliar `rtf-parser` e `@iarna/rtf-to-html` contra 5 RTFs reais antes de escolher. Se nenhuma servir, extrator próprio com testes sobre RTFs reais fixados. **Não prosseguir para o backfill sem isso** — texto sujo corrompe o seccionamento e, por consequência, toda a análise.

### 4.5 Seccionamento

Marcadores em caixa alta. Cuidado: `ACÓRDÃO Nº 3796/2024` também aparece no **cabeçalho** — a última ocorrência é o dispositivo, não a primeira.

Acórdãos curtos (o de 2.247 chars, de multa) **não têm seções** — só dispositivo. Tratar como caso legítimo: `secoes: null`, e a análise cai para "sem voto", não para erro.

### 4.6 Backfill

`scripts/backfill-tcu-inteiro-teor.ts`, dry-run por padrão (padrão dos demais scripts do projeto).

| Parâmetro | Valor | Motivo |
|---|---|---|
| Escopo | 1.835 acórdãos com `tcuLinkPDF` | 7 sem link ficam de fora |
| Concorrência | 3 · delay 1s | mesmo padrão de `lib/tcu-scraper.ts:524-527` |
| **Teto por arquivo** | **20 MB** | o outlier de 14,5 MB passa; algo maior é anomalia |
| **Teto de texto** | **500k chars** | trunca e **marca no JSON** (`truncado: true`) |
| Timeout | 60s | o de 14,5 MB levou 12s |
| **Retomável** | sim — pula quem já tem `tcuAnalise.v` atual | não perder 50 min por um timeout |
| Estimativa | **~50 min**, ~640 MB de tráfego, ~116 MB no banco | do spike |

**`tcuEnriquecimentoStatus` passa a ser real** (`success`/`failed`/`skipped`) e **`tcuEnriquecimentoErro` ganha o primeiro writer** — hoje o status é hardcoded `'success'`, o que é pior que não ter status.

### 4.7 Manutenção

O cron `sync-tcu-acordaos` (diário, 6h) passa a buscar o inteiro teor dos acórdãos novos. Isso o torna dependente de rede externa — se o TCU falhar, o cron **não pode quebrar**: registra `failed` e segue. O backfill recolhe os pendentes depois.

⚠️ `maxDuration = 300s` (`route.ts:35`): não cabe backfill dentro do cron. Só os novos do dia (poucos).

---

## 5. Testes

| Alvo | Como |
|---|---|
| `rtf-to-text` | RTFs reais fixados em `__fixtures__` (pequenos), asserção de que não quebra palavra e não deixa control word |
| `seccionar-acordao` | Texto sintético + 2 reais; caso sem seções (acórdão curto) |
| `analise-relevancia` | Voto sintético com "princípio da economicidade" ×3 → `forte.voto = 3`; termo nu → só `fraco` |
| Limiar | Teste de que 1 menção não entra em `debated` e 2 entram |
| Backfill | Dry-run não escreve; retomada pula quem tem `v` atual |

**Golden set manual:** antes de confiar no limiar, ler **10 acórdãos à mão** e comparar com o veredito automático. Sem isso, o número é opinião.

---

## 6. Riscos

| Risco | Mitigação |
|---|---|
| Extração de RTF ruim corrompe tudo | §4.4 — spike de biblioteca antes do backfill; sem isso, não prosseguir |
| Alguém indexa `tcuTextoCompleto` depois | Comentário no schema + este doc; `source-text.ts` não lê o campo |
| TCU muda/derruba o endpoint | Backfill é one-shot; cron degrada para `failed` sem quebrar |
| Rate limit do TCU (não documentado) | 1 req/s, concorrência 3, User-Agent identificado. Se 429: parar e reavaliar |
| Limiar arbitrário | Contagens no JSON; limiar recomputável; golden set manual |
| Outlier de 14,5 MB | Teto de 20 MB + truncagem de texto marcada |
| Acórdão sem seções | Caso legítimo, não erro |

---

## 7. Relação com o design de 07/07

`2026-07-07-tcu-acordaos-ementa-oficial-indexacao-design.md` deixou o inteiro teor fora de escopo, citando: *"o PDF adicionaria ~20k chunks, infra de download/extração e disponibilidade incerta em 2026, sem ganho garantido"*.

**Aquela decisão continua válida para o que ela decidia — indexação.** Este design **não a reverte**:

| Motivo de 07/07 | Situação agora |
|---|---|
| "~20k chunks" | **Não se aplica** — não indexamos. Zero chunks novos |
| "infra de download/extração" | Confirmada viável pelo spike: RTF, 6/6 extraídos |
| "disponibilidade incerta" | **Medida**: HTTP 200 em 7/8, 1.835/1.842 com link |
| "sem ganho garantido" | O ganho agora é outro: **razão de decidir**, que a ementa não permite |

O requisito é novo. A ementa oficial segue sendo a fonte do **retrieval**; o inteiro teor entra só para **análise**.

---

## 8. Fora de escopo (YAGNI)

- **Indexar o inteiro teor** no RAG — explicitamente recusado
- **LLM classificando o voto** — decidido: só determinístico. Reavaliar se a contagem não separar bem
- **Termos de outros artigos** além do 5º — a estrutura aceita; popular sob demanda
- **Outros tribunais** (`TribunalDecision`) — só TCU nesta fase
- **Corrigir o backfill de citações** (ler só fonte oficial) e os rótulos da UI — é a **Frente A**, spec própria

---

## 9. Sequência

```
1. Spike de biblioteca RTF (§4.4)          ← trava tudo; sem texto limpo, nada funciona
2. lib/tcu/* + testes
3. Migration: tcuAnalise, leiArticlesDebated
4. Backfill (dry-run → execute)            ← ~50 min
5. Golden set manual (10 acórdãos)         ← calibra o limiar
6. UI: hierarquia debatido > citado > IA   ← junta com a Frente A
7. Cron: novos acórdãos
```

O passo 5 é o que transforma o número em conhecimento. Sem ele, entregamos outra contagem em que ninguém deveria confiar — que é exatamente o problema que este documento existe para resolver.
