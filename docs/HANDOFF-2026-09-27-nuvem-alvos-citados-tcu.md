# Handoff para sessão na nuvem: inteiro teor dos acórdãos do TCU que só existem como citação

Data: 27/09/2026. Autor do pedido: Daniel. Repositório: `Danbarral2019/sitedobarral`, branch `feat/ingerir-alvos-citados-tcu`.

## Objetivo

Baixar e catalogar o inteiro teor dos **~3.595 acórdãos do TCU** que são citados no voto de 2 ou mais acórdãos
do acervo, mas que **não existem como `Document`** no banco e **não têm destilação de tese**. Hoje eles existem só
como destino de aresta em `AcordaoCitacao`, e por isso não podem ser classificados por matéria nem virar tese.

Contexto: o Daniel julgou 37 de 37 casos fracos (2 a 4 citações no voto) como fiéis em 26/09, o que autoriza baixar o
limiar de destilação de 5 para 2. A medição (`classificar-temas-acordaos-tcu.ts --min-no-voto=2 --dry-run`) mostrou
que o gargalo não é o limiar: é que esses 3.595 nunca foram baixados. Muitos leading cases antigos de licitação devem
estar entre eles (a campanha de ingestão de julho varreu só 2023–2026).

## Escopo desta sessão: SÓ download e catalogação, sem IA

- 🔴 **Não chamar Gemini, Claude nem qualquer LLM.** O teto mensal do Gemini (chave de PRODUÇÃO) estourou em 26/09 e
  derrubou a busca, os resumos e o DOU. Nada de classificação temática, resumo, embedding ou destilação.
  Classificar e destilar é a etapa seguinte, depois que o Daniel elevar o teto.
- 🔴 **Nunca excluir documentos do banco.**
- Os acórdãos ingeridos entram **invisíveis**, com as mesmas marcas da campanha de julho:
  `category: 'acordao-grafo'` (`CATEGORIA_GRAFO`), `isPublic: false` e `reviewedBy` próprio. Ver
  `lib/tcu/backfill-retroativo.ts` (`montarDadosDocument`) e o teste `lib/tcu/invisibilidade-combustivel.test.ts`.
  Nunca usar `CATEGORIAS_ACORDAO` numa superfície do site; ela é só para filas de processamento.
- `tcuTextoCompleto` **nunca** é indexado.

## Seleção dos alvos

Reusar a definição de `scripts/classificar-temas-acordaos-tcu.ts`:

```sql
SELECT "numeroAlvo" AS numero, "anoAlvo" AS ano,
       count(DISTINCT "origemId") FILTER (WHERE "noVoto")::int AS no_voto
FROM "AcordaoCitacao"
GROUP BY 1, 2
HAVING count(DISTINCT "origemId") FILTER (WHERE "noVoto") >= 2
ORDER BY no_voto DESC
```

Menos os que já existem como `Document` (qualquer categoria de acórdão) e os que já têm `TeseDestilacao` atual.
Processar em ordem decrescente de `no_voto`: os mais citados primeiro, para que uma interrupção deixe pronto o
que mais importa. Antes de começar, confirmar a contagem (esperado: ~3.595).

## Peças que já existem (reusar, não reescrever)

| Peça | Arquivo | Para quê |
|---|---|---|
| Busca por número | `lib/tcu/buscar-acordao-tcu.ts` (`buscarAcordaoPorNumero`) | Número/ano → candidatos com KEY do inteiro teor. ⚠️ body `text/plain` com o termo cru, não JSON (JSON dá 415). |
| Identidade | `lib/tcu/resolver-identidade.ts` (`resolverIdentidade`, `registrarIdentidadeIrresolvida`) | Distingue resolvido / não encontrado / ambíguo / erro transitório. |
| Colegiado | `lib/tcu/colegiado-por-convergencia.ts` | Desempata quando o mesmo número existe em mais de um colegiado no ano. Exige unanimidade. |
| Catalogação | `lib/tcu/catalogar-acordao.ts` (`catalogarAcordao`) | Baixa o RTF, extrai, secciona e grava `tcuTextoCompleto`/`tcuAnalise`. Falha de conteúdo vira tentativa (limite 3); falha de infraestrutura propaga. |
| Arestas | `scripts/backfill-precedentes-tcu.ts --execute` | Depois de catalogar, extrai as citações dos novos acórdãos (sem rede, sem IA). Amplia o grafo para trás no tempo. |

⚠️ **Ambiguidade de colegiado:** a aresta guarda só número e ano, e o mesmo número pode existir no Plenário e nas
duas Câmaras. Ordem: identidade oficial → convergência dos citantes → se ainda ambíguo, **não ingerir**; registrar
como ambíguo e relatar. Ingerir o acórdão errado contamina o grafo e as teses. Acórdão de relação é preterido
(`isRelacao`).

## Como construir

1. Trabalhar na branch `feat/ingerir-alvos-citados-tcu`, que já existe no GitHub e contém este handoff.
2. Script novo `scripts/ingerir-alvos-citados-tcu.ts` com `--dry-run` (padrão), `--execute` e `--limite=N`, e núcleo
   puro testado (TDD, Vitest) para a seleção e para a decisão por item.
3. **Idempotente e retomável:** rodar de novo pula o que já foi resolvido. Estado por item gravado no banco, não em
   memória: ingerido / não encontrado / ambíguo / falha (com tentativas). Um alvo não encontrado ou ambíguo não
   deve ser consultado de novo a cada execução.
4. **Estado terminal só por sinal determinístico.** O script termina dizendo explicitamente quantos foram
   ingeridos, quantos falharam e quantos faltam. Nunca declarar "concluído" por ausência de erro.
5. Pausa entre downloads (a campanha de julho mediu ~12 s por acórdão e ~18% de timeout no RTF, recuperável).
   Retry de conexão com o banco (`comRetryDB`, como em `scripts/backfill-tcu-inteiro-teor.ts`).
6. Scripts rodam com `npx dotenv-cli -e .env.local -- npx tsx ...` localmente. Na nuvem, as variáveis vêm do
   ambiente; não commitar segredo.

## Ordem de execução

1. **Teste de rede:** uma chamada a `pesquisa.apps.tcu.gov.br` e um download de RTF a partir do IP da nuvem. Se o
   TCU bloquear (403/WAF, como acontece com o STF), **parar e relatar**. Não tentar contornar.
2. **Piloto de 20 alvos** com `--execute --limite=20`. Relatar: tempo médio por item, taxa de falha, quantos
   ambíguos e não encontrados, e o tamanho médio do texto.
3. Se o piloto estiver saudável, rodar o resto em lotes, retomando depois de cada interrupção.
4. Depois, `backfill-precedentes-tcu.ts --execute` para os novos acórdãos.
5. PR com o script, os testes e um relatório em `docs/audits/2026-09-XX-alvos-citados-tcu.md`. **Não mergear:** o
   Daniel mergeia. `npm run build` só é necessário se a PR tocar `app/api/`.

## Relatório final esperado

- Alvos selecionados e ingeridos; não encontrados; ambíguos (com lista); falhas (por motivo).
- Distribuição por ano dos ingeridos (espera-se muito 2005–2022).
- Arestas novas no grafo depois do passo 4.
- Rodar `classificar-temas-acordaos-tcu.ts --min-no-voto=2 --dry-run` (só leitura, sem IA no dry-run; conferir no
  código antes) e informar quantos passaram a ter insumo para classificação.
- Próximo passo, que NÃO é desta sessão: classificar e destilar, com o teto do Gemini elevado e com orçamento
  por carga (ver a lição de 26/09: estimar chamadas e checar o teto antes; parar no primeiro 429 de spending cap).

## Requisitos do ambiente na nuvem

- Variável `DATABASE_URL` (Neon de produção) configurada como segredo do ambiente.
- Acesso de rede a: `pesquisa.apps.tcu.gov.br`, `dados-abertos.apps.tcu.gov.br`, o host do Neon e o registro do npm.
- Nenhuma chave de IA é necessária, e é melhor que ela nem esteja no ambiente.
