# Redesign — estado e continuação

**Branch:** `feat/design-home` · **Data:** 30/08/2026 · **Situação:** migração de design concluída, produto em aberto.

Documento de passagem. O que já está feito, o que ficou de fora e o que
qualquer pessoa (ou instância) precisa saber antes de continuar.

## 1. O que motivou

Três perguntas do Daniel: a home ficou sem graça depois que a foto saiu; o
resultado de busca de quem não está logado não mostra o que a pessoa perde
sem assinar; e o que mais dá para melhorar no site.

O diagnóstico virou um canvas com dez pranchetas e um plano de 26 itens:
https://claude.ai/code/artifact/c154ae52-d7e6-400e-995c-f188c16a8ac7

A descoberta que organizou tudo: **o site nunca tinha sido migrado para o
próprio sistema de design.** O `DESIGN.md` existia desde o começo e descrevia
"O Caderno do Tribunal" — sóbrio, sem gradiente, sem vidro fosco, sem emoji.
As páginas eram outra coisa. E `tailwind.config.ts` estava morto: no Tailwind
4 um config em JS só é lido com a diretiva `@config`, que não existia. As
escalas `primary-*` e `accent-*` viviam lá e não geravam classe nenhuma —
por isso o único botão da única página no ar (`/coming-soon`) era invisível,
com contraste de ~1,05:1.

## 2. O que está pronto nesta branch

Nove commits, 214 arquivos. A migração inteira, não uma amostra.

1. **`chore(design)`** — remove o config morto, resgata as escalas para o
   `@theme` do `globals.css` e cria a **catraca de lint**.
2. **`feat(home)`** — home reescrita: hero com busca, últimas entradas,
   índice denso do acervo, faixa do autor, amostra de consulta real (art. 75
   vindo do banco), planos sóbrios.
3. **`feat/fix(lei-14133)`** — liga o `ArticleFull.tsx`, que era código morto:
   a lei agora é lida em Source Serif, 65ch, como manda a Regra do Texto da
   Lei. E tira os marcadores de tramitação (`(Vide ...)`, `Vigência`) do corpo.
4. **`feat(jurisprudencia)` + `feat(acervo)`** — padrão de listagem densa,
   aplicado às sete páginas do acervo.
5. **`feat(site)` + `feat/fix(area-restrita)`** — o resto do site público e o
   produto pago.

### A catraca

`eslint.config.mjs` proíbe cor crua do Tailwind, gradiente e `backdrop-blur`
nos caminhos já migrados. **Ela só cresce.** Ao migrar um caminho novo,
acrescente-o à lista `files`; nunca remova um que já está lá. Hoje cobre o
site inteiro menos `/admin`, que é interno e ficou de fora de propósito.

Detalhe que custou tempo: **regex de esquery não pode conter `/`** — o
seletor termina ali. Use lookahead (`(?![0-9])`) em vez de barra.

### O que a catraca NÃO pega

Os três erros mais graves do dia passaram por ela e pelo build, e só
apareceram quando alguém abriu a página:

- **Texto claro sobre fundo claro.** Gradiente escuro virou tom claro e o
  `text-white` ficou. O pior caso foi o cartão do plano Premium, ilegível.
- **Ícone claro dentro de contentor claro.** Mesma coisa, outra forma: 53
  ocorrências, sendo a mais visível o ícone do Assistente Inteligente.
- **Acentos faltando** em texto de interface ("evolucao", "area restrita").

**Lição para quem continuar: catraca pega regra, build pega sintaxe, e nada
disso pega contraste nem português. Abra as telas.**

Os scripts de migração ficaram no scratchpad da sessão, não no repositório —
eram andaime. Se precisar refazer, o cuidado que quebrou tudo uma vez:
`\s` casa quebra de linha; para colapsar espaço use `[ \t]{2,}`, nunca `\s{2,}`.

## 3. O que já foi para produção

Três correções pequenas, separadas desta branch e já na `main`:

- contraste do botão da `/coming-soon`;
- os quatro cursos vendáveis sem aula publicada, protegidos;
- contagens do acervo unificadas em `lib/acervo-counts.ts` — fonte única, com
  as três exclusões documentadas (acórdãos-grafo, súmulas do TST, TCU contado
  uma vez só). Antes a home dizia 24.110, uma página dizia "800" e outra 53.

## 4. O que continua aberto

Em ordem de importância, na minha leitura:

**Produto, não design:**
1. **Quatro dos sete cursos vendáveis não têm aula publicada.** É o item mais
   importante da lista inteira e não se resolve com CSS. Hoje estão protegidos,
   o que evita vender o vazio, mas não substitui o conteúdo.
2. **Decisão sobre o `coming-soon`** — continua ativado.
3. **O enquadramento de preço** (`line-through`, "Economize R$") ficou
   explicitamente como decisão comercial do Daniel, não minha.

**Busca:**
4. `/api/busca-integrada` é só FTS e **não inclui `TribunalDecision`**. Antes
   de incluir, é preciso deduplicar: os acórdãos do TCU estão em duas tabelas.
5. **Amostra da resposta de IA** para quem não está logado — era a pergunta 2
   do Daniel e é o item que mais mexe com conversão. Ainda não feito.

**Dívidas:**
6. `/documento/[id]` devolve 404 para documento restrito, sem checar login.
   Deveria convidar a assinar, não fingir que não existe.
7. **26 e-mails sem nenhuma cor da marca** e com emoji no assunto.
8. **Desempenho:** Lighthouse 58, LCP 9,6s. Compressão, JS não usado, cache.
9. **Lei comentada:** 196 artigos, zero comentário, zero remissão curada,
   zero leitura sugerida. A estrutura existe e está vazia.

## 5. Antes de mexer

- É site em **produção** com auto-deploy da `main` (~4 min). Merge é deploy.
- Rode `npx eslint app components` e `npx vitest run` (2.706 testes).
- E **abra as telas**, principalmente a área restrita, que foi migrada por
  substituição em massa.
