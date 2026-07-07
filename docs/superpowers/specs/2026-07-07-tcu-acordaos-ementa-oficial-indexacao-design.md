# Indexação de acórdãos TCU pela ementa oficial (`tcuEmentaCompleta`)

**Data:** 2026-07-07
**Autor:** Daniel Barral + Claude
**Status:** Aprovado (design) — aguardando plano de implementação

## Problema

171 acórdãos do TCU de 2026 (categoria `acordao`), captados pelo clipping, estão
`embeddingStatus='pending'` com `content` vazio e **0 chunks** — invisíveis na busca
semântica. São o grosso dos 174 documentos metadata-only que sobraram após a sessão de
saneamento de 2026-07-07 (os outros 3 são orientações normativas).

Diagnóstico (verificado no banco em 2026-07-07):

- **171/171 já têm a ementa oficial do TCU** no campo `Document.tcuEmentaCompleta`
  (≥50 chars), e também em `DocumentMetaTcu.ementaCompleta`. Exemplo (Acórdão 1362/2026):
  *"REPRESENTAÇÃO. INFRAERO. LICITAÇÃO ELETRÔNICA. ESPAÇOS PUBLICITÁRIOS... OFENSA AOS
  PRINCÍPIOS DA PUBLICIDADE, DA ISONOMIA E DA VINCULAÇÃO AO INSTRUMENTO CONVOCATÓRIO...
  MEDIDA CAUTELAR. REFERENDO."* — headnote oficial, denso em termos jurídicos.
- O campo `description` (167/171 preenchidos) é o **resumo executivo gerado pelo Gemini**
  no cron `sync-tcu-acordaos` (`app/api/cron/sync-tcu-acordaos/route.ts:166` →
  `description: summary`). É texto derivado por IA, **não** a ementa oficial.
- O pipeline de indexação (`lib/embeddings/document-processor.ts:156`) escolhe o
  texto-fonte como `content || description`. **Nunca lê `tcuEmentaCompleta`.** Por isso os
  acórdãos ficaram de fora: `content` está vazio, e indexá-los pela `description`-IA
  contrariaria a regra [[feedback-clipping-fonte-precisa-ementa]] ("fonte com ementa;
  nunca baixar o threshold para compensar metadata-only").

**A fonte oficial com ementa já está no banco.** Não é necessário paginar a API de dados
abertos do TCU (que, verificado empiricamente, tem `sumario` vazio na maioria dos
acórdãos de 2026 — mediana 0 chars) nem baixar/extrair PDFs de inteiro teor.

## Fonte oficial vs. API/PDF (contexto da decisão)

Escopo escolhido pelo usuário: **só a ementa oficial** (`tcuEmentaCompleta`), já presente
no banco. PDF/inteiro teor e paginação da API ficam **fora de escopo** (YAGNI): a ementa
oficial já satisfaz a regra de "fonte com ementa" e tem ótimo sinal/ruído para busca de
licitações; o PDF adicionaria ~20k chunks, infra de download/extração e disponibilidade
incerta em 2026, sem ganho garantido.

## Objetivo

Solução **duradoura**: fazer o indexador usar a ementa oficial como texto-fonte dos
acórdãos, resolvendo os 171 pendentes **e** todos os acórdãos futuros do clipping (que
hoje nascem com `content` vazio e continuariam metadata-only). Corrigir no ponto de
processamento, não só migrar dados — conforme [[feedback-tribunalcode-normalizacao-origem]].

## Design (Abordagem A — correção sistêmica no indexador)

### 1. Mudança no indexador — `lib/embeddings/document-processor.ts`

- **Seleção**: incluir `tcuEmentaCompleta` no `select` da query que carrega o documento
  (junto de `content`/`description`, ~linha 66).
- **Cadeia de fallback do texto-fonte** (linha ~156):

  ```ts
  // antes
  const fallbackText = document.content || document.description || '';
  // depois
  const fallbackText =
    document.content || document.tcuEmentaCompleta || document.description || '';
  ```

  A ementa oficial **substitui** o resumo-IA como fonte (não concatena). `content` (texto
  integral real, quando existe) continua tendo prioridade máxima.
- **Filtro de "pending"**: incluir `tcuEmentaCompleta` no `OR` das queries que selecionam
  documentos elegíveis (`document-processor.ts` ~linhas 310-311 e ~529, hoje
  `content != null OR description != null`) para capturar os 4/171 sem `description`.
- **Prefixo de proveniência**: manter o `titlePrefix` já existente; a ementa entra como
  texto oficial, sem mistura com o resumo-IA.

Raio de impacto: só muda o comportamento de documentos com `content` vazio **E**
`tcuEmentaCompleta` presente — na prática, acórdãos/decisões do TCU. Documentos com
`content` real: inalterados. Documentos sem `tcuEmentaCompleta`: inalterados (seguem
usando `description`).

### 2. Indexar os 171 pendentes

Rodar `processDocuments` sobre exatamente o conjunto alvo — filtro
`category='acordao' AND embeddingStatus='pending' AND (content vazio) AND 0 chunks` —
**sem** `--force` global (não reprocessar o corpus de 6.372 docs). Script dedicado ou
reuso de `scripts/migrate-to-embeddings.ts` com `--limit`/filtro; decidir no plano.

### 3. Validação (eval)

`npm run eval:run` gerando novo baseline e comparando com o atual
(**recall@5 63,8% / MRR 0,839 / nDCG@10 0,654**). Critérios:

- **Não regredir** por flooding (os 171 acórdãos não devem inundar o top-5 de queries
  existentes, como ocorreu no bug do boost de hierarquia).
- Medir eventual ganho de recall se houver queries do golden cujos relevantes incluam
  esses acórdãos.

Registrar o baseline em `eval/reports/` e commitar.

### 4. Testes (TDD)

- Teste unitário: documento com `content=null` + `tcuEmentaCompleta` preenchido →
  texto-fonte usa a **ementa oficial**, não a `description`-IA.
- Teste: documento com `content` real → continua usando `content` (prioridade máxima
  preservada).
- Teste: documento sem `tcuEmentaCompleta` mas com `description` → segue usando
  `description` (sem regressão).
- Rodar a suíte existente de `document-processor` (não quebrar nada).

## Fora de escopo (YAGNI)

- PDF/inteiro teor dos acórdãos e sua extração via `pdfjs`.
- Paginação/enriquecimento pela API de dados abertos do TCU.
- Alterar o cron de clipping (`sync-tcu-acordaos` / `daily-tcu-clipping`): a mudança no
  indexador já cobre os acórdãos futuros; o cron continua gerando o resumo-IA em
  `description` (útil para exibição), enquanto a indexação passa a usar a ementa oficial.

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Flooding do top-5 por adicionar 171 acórdãos | Medir no eval antes/depois; o fix do boost (`71c7c31b`) já neutralizou a causa sistêmica de flooding cross-source. |
| Ementa em CAIXA ALTA / estilo headnote piorar retrieval vs. prosa | Ementa é densa em termos-chave (bom para semântica); medir no eval e revisitar só se cair. |
| Mudar `document-processor` (código core) afetar outros fluxos | Blast radius restrito a docs com content vazio + tcuEmentaCompleta; cobertura por testes TDD. |

## Critérios de aceitação

1. Indexador usa `tcuEmentaCompleta` como fonte quando `content` está vazio (com testes).
2. Os 171 acórdãos ficam `embeddingStatus='completed'` com chunks/embeddings válidos.
3. Baseline eval pós-indexação sem regressão de recall@5 por flooding (registrado em `eval/reports/`).
4. Acórdãos futuros do clipping passam a ser indexáveis pela ementa oficial sem intervenção manual.
