# Design — Persistência das teses do TCU (frente A, onda A-W1)

**Data:** 2026-07-21
**Status:** aprovado (brainstorming), aguarda plano de implementação
**Depende de:** motor de destilação `lib/tcu/destilar-tese.ts` — **GO do Daniel em 20/07** (4/4 teses fiéis, 2/2 divergências procedem)
**Relacionado:** `2026-07-20-ingestao-retroativa-tcu-design.md` (frente C1, campanha rodando em produção desde 21/07)

## 1. Contexto

O motor de destilação está calibrado e aprovado, mas nada do que ele produz é persistido — hoje o resultado vive num JSON de probe. Esta onda constrói a persistência.

**A base está crescendo enquanto isso.** A campanha da frente C1 ingere acórdãos a cada 10 minutos; a faixa aproveitável (leading cases com ≥5 citações no voto) saiu de umas poucas dezenas para **126 casos** e continuará subindo. Isso muda a natureza do que se persiste: **uma tese não é dado escrito uma vez, é dado derivado de um dossiê que muda.**

## 2. Decisões de produto (fixadas no brainstorming)

### 2.1 Versionar, com o julgamento colado à versão

Quando o dossiê cresce, o motor pode refinar o enunciado, mudar a confiança ou achar uma divergência que antes não via. Três caminhos foram considerados: sobrescrever, versionar, congelar após aprovação. **O Daniel escolheu versionar.**

Sobrescrever foi descartado por um motivo editorial: ele julgou quatro teses como fiéis: se o dossiê crescer e o motor reescrever, esse julgamento evapora em silêncio e a tela passa a exibir uma tese que ninguém aprovou no lugar de uma aprovada. Seria o mesmo defeito do `tcuEnriquecimentoStatus: 'success'` que o cron de acórdãos grava sem enriquecer nada — o sistema afirmando uma qualidade que ninguém verificou. Congelar foi descartado por perder refinamento real.

### 2.2 A unidade versionada é a destilação inteira, não a tese individual

Um leading case fixa mais de uma tese — o 1441/2016 rendeu três. Manter identidade de *cada tese* entre versões exigiria ou posição na lista (frágil: o motor pode reordenar, fundir ou dividir) ou pareamento por LLM (nova fonte de erro silencioso, com exatamente o efeito que deveria evitar).

**Decisão: não existe "a tese 2 do caso"; existe "este enunciado, nesta versão".** Cada rodada de destilação cria uma versão do conjunto. O problema de identidade é eliminado em vez de resolvido.

### 2.3 Carregamento de veredito por texto idêntico

Ao persistir uma versão nova, cada enunciado é procurado na versão anterior do mesmo caso **por igualdade exata de texto**. Achou: o veredito é copiado e a origem registrada. Não achou: nasce sem veredito e entra na fila de julgamento.

Comparação exata, sem normalização de pontuação ou espaços e sem modelo. Normalizar para "reduzir retrabalho" seria decidir que duas redações diferentes são a mesma tese — julgamento que só o Daniel pode fazer. O custo assumido é que uma vírgula alterada devolve o enunciado à fila; o erro inverso (carregar aprovação para um texto que ele não leu) é inaceitável.

### 2.4 Quando o motor roda

- **Nesta onda:** o mecanismo é construído, mas **a destilação em massa NÃO é disparada.** Os dossiês estão engordando por hora; destilar agora significaria redestilar em dias, devolvendo à fila do Daniel enunciados que ele acabou de aprovar — retrabalho criado por nós, não pelo conteúdo.
- **Regime permanente (implementado nesta onda):** gatilho por crescimento material, para a base nunca crescer descatalogada ([[feedback-fluxo-continuo-passivo-e-novos]]).

**Consequência aceita: a onda A-W1 termina sem teses no banco.** O disparo em massa é o primeiro ato da A-W2, quando a campanha assentar.

## 3. Schema

Três models novos, todos aditivos. `prisma db push` (o repositório não usa migrations).

```prisma
/// Uma rodada de destilação de um leading case. É a unidade versionada:
/// as teses de um acórdão NESTA data, geradas por ESTE dossiê.
model TeseDestilacao {
  id            String   @id @default(cuid())
  numeroAlvo    Int
  anoAlvo       Int
  chave         String   // "1441/2016" — derivada, para consulta e exibição
  assunto       String   @db.Text
  confianca     String   // 'alta' | 'media' | 'baixa'
  versaoMotor   Int      // permite redestilar quando o prompt/modelo mudar
  /// Retrato do dossiê que gerou esta versão. Sem ele não há como saber
  /// depois se o dossiê cresceu o bastante para justificar redestilar.
  dossieTrechos Int
  dossieNoVoto  Int
  sinais        Json?    // sinaisQualitativos: não são julgados individualmente
  atual         Boolean  @default(true)
  criadoEm      DateTime @default(now())

  enunciados   TeseEnunciado[]
  divergencias TeseDivergencia[]

  @@index([numeroAlvo, anoAlvo, atual])
  @@index([chave])
}

/// Uma tese dentro de uma destilação. O veredito do Daniel vive aqui,
/// colado ao texto exato que ele leu.
model TeseEnunciado {
  id           String   @id @default(cuid())
  destilacaoId String
  destilacao   TeseDestilacao @relation(fields: [destilacaoId], references: [id], onDelete: Cascade)
  ordem        Int
  enunciado    String   @db.Text
  inovacao     String   @db.Text
  trechosFonte Json     // índices para os trechos do dossiê
  veredito     String?  // 'fiel' | 'imprecisa' | 'errada' | null
  julgadoEm    DateTime?
  julgadoPor   String?
  /// Id do enunciado da versão anterior de onde o veredito foi carregado
  /// por texto idêntico (§2.3). Null = julgado diretamente nesta versão.
  herdadoDe    String?

  @@index([destilacaoId])
  @@index([veredito])
}

/// Uma divergência apontada nos votos: outro precedente indicado como o de
/// referência para o mesmo assunto.
model TeseDivergencia {
  id                 String   @id @default(cuid())
  destilacaoId       String
  destilacao         TeseDestilacao @relation(fields: [destilacaoId], references: [id], onDelete: Cascade)
  origemChave        String   // quem apontou
  precedenteApontado String
  trecho             String   @db.Text
  natureza           String
  veredito           String?  // 'procede' | 'nao_procede' | null
  julgadoEm          DateTime?
  julgadoPor         String?
  herdadoDe          String?

  @@index([destilacaoId])
}
```

Os sinais qualitativos ficam como JSON na destilação: não são julgados individualmente e não têm vida própria.

## 4. Núcleo e fluxo

### 4.1 `lib/tcu/persistir-tese.ts` — núcleo único

Compartilhado entre o disparo em massa (A-W2) e o cron diário, para as duas rotas não divergirem. Três responsabilidades:

- **`selecionarElegiveis(opts)`** — devolve os casos que precisam de destilação, pelas regras de §4.2.
- **`persistirDestilacao(alvo, tese, dossieStats)`** — cria a versão nova, marca a anterior como `atual: false`, e executa o carregamento de veredito de §2.3.
- **`carregarVeredito(novos, anteriores)`** — puro, testável sem banco: dado os enunciados novos e os da versão anterior, devolve quais herdam veredito.

O motor (`destilar-tese.ts`) **não é alterado** nesta onda — prompt, modelo e parâmetros permanecem os que o Daniel calibrou.

### 4.2 Elegibilidade

| Situação | Regra |
|---|---|
| Nunca destilado | `citantesNoVoto >= 5` → destila |
| Já destilado | `citantesNoVoto >= 1,5 × dossieNoVoto da versão atual` **e** `criadoEm da versão atual` há mais de 7 dias → redestila |

O limiar de 5 é a fronteira medida em que o motor produz tese em vez de se calar. O fator de 1,5 evita redestilar por ruído; os 7 dias evitam que a campanha, que engorda dossiês de hora em hora, dispare redestilação em cascata.

### 4.3 Cron `destilar-teses-tcu`

Diário, lote pequeno, com orçamento de tempo — o padrão dos crons daqui (`verifyCronAuth` + `withCronTelemetry`, `maxDuration = 300`, teto de tempo abaixo disso). Consome o núcleo. Fila auto-drenante pelo próprio estado das tabelas, sem cursor externo.

**Lote inicial: 5 casos por execução.** Cada destilação é uma chamada de LLM de alguns segundos; 5 cabem com folga no orçamento e limitam o custo diário a trocados enquanto o comportamento em regime não é observado.

## 5. Custo

Preço do Claude Sonnet 5 (task `enhancement`): **US$ 3,00 por milhão de tokens de entrada e US$ 15,00 de saída**, com preço introdutório de **US$ 2,00 / US$ 10,00 até 31/08/2026**.

Um dossiê no teto (40 trechos) mais a ementa própria dá cerca de 10 mil tokens de entrada; a resposta, ~1,5 mil de saída.

| Cenário | Custo (introdutório) | Custo (cheio) |
|---|---|---|
| Os 126 casos de hoje (A-W2) | **~US$ 4,50** | ~US$ 6,60 |
| Cron em regime, 5/dia | ~US$ 0,18/dia | ~US$ 0,26/dia |

Custo não é restrição desta frente. ⚠️ O `CLAUDE.md` ainda lista `enhancement = claude-sonnet-4-20250514`, desatualizado — o registry usa Sonnet 5, e é ele que o probe calibrado usou.

## 6. Não-objetivos desta onda

- **Disparar a destilação em massa** (é a A-W2, §2.4).
- **Classificar assuntos em escala** — `assunto` fica como texto livre do motor (A-W2).
- **Qualquer tela** — nem a navegável de dois níveis, nem interface de julgamento (A-W3).
- **Alterar o motor de destilação** — prompt, modelo e parâmetros são os calibrados.
- **Expor as teses em qualquer superfície pública.**

## 7. Riscos

**7.1 Redestilação em cascata durante a campanha.** É o risco principal e o motivo de §2.4. Mitigado pelo fator de 1,5, pelos 7 dias e por não disparar em massa nesta onda. Se ainda assim o cron encontrar volume grande, o lote de 5/dia limita o dano.

**7.2 Retrabalho de julgamento por mudança cosmética.** Aceito conscientemente (§2.3). Se na prática se mostrar excessivo, o dado para decidir existirá: a proporção de enunciados que herdaram veredito por versão.

**7.3 `atual` fora de sincronia.** Duas versões marcadas `atual: true` para o mesmo caso quebrariam a exibição. Persistir versão e desmarcar a anterior devem ocorrer na mesma transação, e um teste deve cobrir o invariante de no máximo uma versão atual por caso.

**7.4 O motor pode piorar com dossiê maior.** Já registrado na frente C1 e não medido. Como as versões antigas são preservadas, uma piora é detectável e reversível — o que é justamente a vantagem de ter escolhido versionar.
