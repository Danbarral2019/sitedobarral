# Design — Herança do estado editorial entre versões de uma tese

**Data:** 09/09/2026
**Spec anterior:** `docs/superpowers/specs/2026-09-04-publicacao-teses-tcu-design.md` — este documento altera a §5 daquele (ciclo de vida: versão de destilação ≠ estado de publicação).

---

## 1. Contexto: o julgamento editorial evapora

O cron redestila um acórdão-líder quando o dossiê dele engorda — mais decisões passaram a citá-lo. Cada redestilação cria uma versão nova, que vira a vigente. O veredito e o estado editorial migram da versão anterior para a nova **apenas quando o texto do enunciado é idêntico** (`lib/tcu/carregar-veredito.ts`).

Um modelo de linguagem não repete a mesma frase duas vezes. Medido em 09/09/2026:

| | |
|---|---|
| Vereditos no banco | 108 |
| Herdados de uma versão anterior | **1** |
| Acórdãos com mais de uma versão | 105 de 265 |

A herança funcionou **uma vez em 108**. Na prática, é inerte.

### 1.1 O que isso já custou

Em 13/08/2026 o Daniel conferiu individualmente 20 enunciados, sobre versões destiladas entre 07 e 11/08. Em 03/09 o sistema criou 49 destilações num único dia — o comportamento projetado, disparado pelo crescimento dos dossiês (o 3215/2022 foi de 11 para 22 citações; o 1440/2007, de 10 para 18).

Essa leva alcançou **12 dos 20**. Em todos os 12 o texto saiu diferente, então nenhum veredito migrou. O que aconteceu depois divide os casos em dois grupos:

- **6 acórdãos** foram recolhidos pelo script de aprovação em lote, que aprova o que tem `veredito IS NULL` e confiança alta. Voltaram ao acervo com **etiqueta de lote no lugar do nome de quem os conferiu**. A proveniência foi lavada: hoje eles passam por aprovados por confiança auto-declarada do modelo, quando na verdade um humano havia lido a versão anterior.
- **3 acórdãos** (3215/2022, 1440/2007, 934/2021) não se qualificaram nem para o lote. Ficaram sem veredito nenhum e **não estão em lugar algum** — nem no acervo restrito.

O estado editorial completo está preso à mesma condição de texto idêntico: `publicado`, `vitrinePublica`, `retiradoEm` e `retiradoMotivo`. Portanto a vitrine pública, ligada em 08/09/2026 com 3 teses, **esvaziaria sozinha** na próxima redestilação dos acórdãos 1211/2021 e 96/2008 — sem erro, sem log, sem ninguém perceber.

---

## 2. Objetivo e não-objetivos

**Objetivo.** Que o trabalho de conferência individual sobreviva à redestilação, sem que isso publique formulação que ninguém leu.

**Não-objetivos:**

- **Não** parear teses entre versões por algoritmo. Nem por posição, nem por semelhança de texto (§4.2).
- **Não** impedir a redestilação. Ela é o mecanismo que mantém a base acompanhando o crescimento dos dossiês, e funciona.
- **Não** criar tela nova de administração. A conferência acontece na folha de calibração que já existe (§6).
- **Não** alterar a regra de elegibilidade (`lib/tcu/elegibilidade-tese.ts`). Ela continua como está; o que muda é o que chega até ela.

---

## 3. As três decisões de produto

Tomadas em 09/09/2026, com o Daniel:

**3.1 Texto mudou, tese estava na vitrine → sai da vitrine e entra na fila.** A vitrine nunca exibe formulação que ninguém leu. É o motivo pelo qual ela exige conferência individual, e vale mesmo quando encolher for o resultado.

**3.2 O sistema não tenta adivinhar qual tese nova corresponde a qual antiga.** A fila é por acórdão, com os textos lado a lado, e o pareamento é feito com os olhos.

**3.3 Texto mudou, no acervo restrito → continua visível, marcada como pendente.** O acervo é para quem tem acesso ativo, e minguar a cada onda do cron é o defeito que produziu a situação atual.

---

## 4. O mecanismo

### 4.1 `carregarVeredito` em dois níveis

**Nível 1 — texto idêntico.** Comportamento atual, sem mudança: `veredito`, `julgadoEm`, `julgadoPor`, `herdadoDe`, `publicado`, `vitrinePublica`, `retiradoEm` e `retiradoMotivo` migram integralmente.

**Nível 2 — texto diferente, com antecessor julgado.** "Julgado" aqui é qualquer veredito, individual **ou de lote** — o que sustenta o acervo é a existência do veredito, e a vitrine fica protegida de todo modo, porque `julgadoPor` nasce nulo. Um veredito de lote que atravessa versões chega ao outro lado marcado como pendente, o que é exatamente verdadeiro: ninguém leu aquele texto. Migram:

| Campo | Migra? | Por quê |
|---|---|---|
| `veredito` | **sim** | Sustenta o acervo (§3.3) |
| `publicado` | **sim** | Idem |
| `herdadoDe` | **sim** | O rastro até quem julgou o antecessor |
| `retiradoEm` / `retiradoMotivo` | **sim** | Retirada é ato de quem tirou do ar; ressuscitar tese retirada é o que a §5 da spec anterior declara impossível |
| `vitrinePublica` | **não** | §3.1 |
| `julgadoEm` / `julgadoPor` | **não — ficam nulos** | §4.3 |

E um campo novo, `reconferenciaPendente`, é marcado.

### 4.2 Por que não há pareamento algorítmico

Parear por posição atribui silenciosamente o julgamento à tese errada quando o modelo produz um número diferente de teses, ou as reordena. Parear por semelhança exige inventar um limiar — e limiar sem procedência é exatamente o que este projeto acabou de tirar do plano da Onda 4. Um humano pareia dois textos curtos em segundos e não erra em silêncio; o algoritmo erra em silêncio, que é o modo de falha caro.

### 4.3 Por que `julgadoPor` fica nulo

Preencher `julgadoPor: 'daniel'` num texto que ele nunca leu é a mesma mentira que a etiqueta de lote conta hoje — e foi essa mentira que tornou impossível distinguir, no acervo atual, o que foi conferido do que foi carimbado. O veredito herdado é provisório e diz isso: tem valor (`fiel`), tem rastro (`herdadoDe`), e não tem autor, porque não houve autor.

### 4.4 O que cai por gravidade

Três comportamentos exigidos pelas decisões da §3 resultam de regras que já existem, sem código novo:

- **A vitrine solta a tese.** `scripts/promover-vitrine-teses.ts` exige `julgadoPor` preenchido e sem etiqueta de lote. Nulo não passa.
- **O acervo segura.** `WHERE_ELEGIVEL_BASE` exige `veredito = 'fiel'`, que foi herdado.
- **O lote não carimba por cima.** `scripts/aprovar-teses-confianca-alta.ts` só alcança `te.veredito IS NULL`. Com o veredito herdado no lugar, o enunciado sai do alcance dele — e a lavagem de proveniência descrita na §1.1 não pode se repetir.

Esta última é a correção mais importante do documento, e ela é consequência, não código.

### 4.5 Schema

`TeseEnunciado` ganha:

```prisma
/// Veredito herdado de uma versão anterior cujo TEXTO ERA DIFERENTE (§4.1,
/// nível 2). Vale para o acervo restrito, nunca para a vitrine, e some quando
/// o enunciado é conferido de novo. `julgadoPor` nulo com `herdadoDe`
/// preenchido é a assinatura desse estado.
reconferenciaPendente Boolean @default(false)
```

---

## 5. Ciclo de vida resultante

```
destilação nova
      │
      ├─ texto idêntico ao anterior ──────────► estado editorial inteiro migra
      │                                          (inclusive vitrine)
      │
      ├─ texto diferente, antecessor julgado ─► veredito + publicado migram
      │                                          vitrine NÃO migra
      │                                          reconferenciaPendente = true
      │                                          julgadoPor = null
      │                                                    │
      │                                          folha de calibração
      │                                                    │
      │                                          conferência do Daniel
      │                                                    │
      │                                          veredito próprio, julgadoPor
      │                                          preenchido, pendência limpa
      │                                                    │
      │                                          elegível à vitrine de novo
      │
      └─ sem antecessor julgado ──────────────► como hoje: entra na fila comum
```

---

## 6. A fila de reconferência

Não há tabela nova. As versões anteriores continuam no banco, marcadas como não vigentes, com o veredito e o nome de quem julgou. A fila é uma consulta sobre o que já existe: enunciados vigentes com `reconferenciaPendente = true`, mais o texto do antecessor apontado por `herdadoDe`.

A superfície é a **folha de calibração** (`scripts/build-folha-teses-tcu.ts`), que já é onde a conferência acontece — e que já julga **por cartão de acórdão**, mostrando todas as teses daquele precedente sob um botão. A folha ganha uma seção **Reconferência** no topo, com o texto novo e, ao lado, o texto aprovado e a data.

`scripts/importar-veredito-teses.ts` limpa `reconferenciaPendente` ao gravar o veredito novo, junto de `julgadoPor` e `julgadoEm`.

---

## 7. Backfill do que já se perdeu

Um script de uma execução, dry-run por padrão, que aplica a regra da §4.1 retroativamente, em dois movimentos distintos:

- **Enunciado vigente sem veredito, cujo antecessor tinha um:** herda `veredito` e `publicado`, grava `herdadoDe` e marca a pendência.
- **Enunciado vigente que já tem veredito, mas cujo antecessor foi julgado individualmente:** não toca no veredito — apenas marca a pendência e grava `herdadoDe`. É o caso dos 6 carimbados pelo lote, e o efeito é tornar visível o que hoje está escondido.

Efeito esperado sobre os casos da §1.1:

- os **3 acórdãos sem veredito nenhum** voltam ao acervo restrito, marcados como pendentes (primeiro movimento);
- os **6 carimbados pelo lote** permanecem no acervo — nada sai do ar — e ganham a marca de pendência (segundo movimento);
- todos entram na fila da §6.

O backfill **não** promove nada à vitrine e **não** apaga veredito de lote: ele acrescenta a informação que faltava.

---

## 8. O custo aceito, declarado

**A vitrine encolhe sozinha.** Sempre que um acórdão dela for redestilado com texto diferente, a tese sai do ar e só volta depois da reconferência. Com 3 teses na vitrine hoje e dossiês de 14 e 10 citações nos dois acórdãos, isso vai acontecer.

É o preço direto da decisão §3.1, e está registrado aqui para que não seja descoberto como surpresa. A mitigação não é técnica: é a fila da §6 tornar a reconferência barata o bastante para acompanhar o ritmo do cron.

---

## 9. Riscos

**A pendência vira ruído se nunca for tratada.** Se a fila crescer sem ser trabalhada, `reconferenciaPendente` deixa de significar "reconfira" e passa a significar "a maior parte do acervo". A métrica a acompanhar é o tamanho da fila ao longo do tempo, não o número absoluto.

**A redestilação pode mudar a tese de sentido, não só de redação.** O veredito herdado do nível 2 sustenta a tese no acervo enquanto ninguém a lê. Se o modelo distorcer a proposição, um assinante vê a distorção antes do Daniel. O acervo é restrito e a distorção é reversível, mas o risco é real e foi aceito na decisão §3.3 — o alternativo era o acervo oscilar a cada onda do cron.

**Nada aqui melhora a taxa de acerto do motor.** A spec anterior registra na §13 que ela é desconhecida: 87 dos 95 aprovados vieram de lote. Este documento preserva melhor o julgamento humano; não substitui a necessidade de julgar.

---

## 10. Testes

- `carregarVeredito`, nível 2: texto diferente com antecessor julgado devolve veredito, `herdadoDe`, `publicado`, pendência marcada, e `julgadoPor`/`julgadoEm` nulos.
- `carregarVeredito`, nível 1 intacto: texto idêntico continua migrando o estado inteiro, inclusive `vitrinePublica`.
- Retirada sobrevive aos dois níveis — a garantia que a spec anterior instalou na §5 não pode regredir.
- Um antecessor **não julgado** não produz herança nem pendência.
- Integração, contra banco de verdade: uma tese na vitrine cujo texto muda sai da vitrine e permanece no acervo. Roda no job de navegador, que tem banco descartável da Neon desde 08/09/2026.

---

## 11. Sequência de execução

1. Campo `reconferenciaPendente` e migração versionada.
2. `carregarVeredito` em dois níveis, com os testes da §10.
3. `importar-veredito-teses` limpa a pendência ao gravar veredito.
4. Seção de reconferência na folha de calibração.
5. Backfill da §7 — dry-run, revisão, e execução pelo usuário.
