# Handoff — 09/09/2026 — herança editorial das teses, e o que subiu junto

**Este arquivo está versionado de propósito.** O ledger da execução por subagentes (`.superpowers/sdd/...`) foi apagado ao fim da sessão, como o processo manda — o histórico do git é o registro agora. Este documento é a fonte da verdade para retomar em outro computador.

---

## 0. LEIA ISTO PRIMEIRO — o que fazer ao retomar

```bash
git pull
git rev-list --left-right --count origin/main...main   # DEVE devolver "0  0"
```

Se a contagem da direita for maior que zero, há trabalho preso na `main` local sem push — foi o que travou este projeto por oito dias e consumiu a manhã de 08/09. Resolva isso antes de qualquer outra coisa.

Depois, o estado das teses:

```bash
npx tsx scripts/publicar-acervo-teses.ts        # dry-run, só lê
npx tsx scripts/promover-vitrine-teses.ts       # dry-run, só lê
```

**Pré-requisito na máquina nova:** o `.env.local` não está no git. Precisa existir com pelo menos `DATABASE_URL`, `JWT_SECRET`, `CRON_SECRET`, `ANTHROPIC_API_KEY` e `GEMINI_API_KEY`. Ver `.env.example` e `SETUP.md`.

**Cuidado permanente:** a `DATABASE_URL` local aponta para **produção**. Nenhum script de dado deve ser executado sem dry-run antes, e o teste `e2e/heranca-editorial.spec.ts` tem guarda própria que aborta se `DATABASE_URL` e `TEST_DATABASE_URL` não apontarem para o mesmo banco.

---

## 1. O que entrou em produção em 08 e 09/09

| Trabalho | PR | Situação |
|---|---|---|
| Remediação de integridade do site | #208 | ✅ estava presa na `main` local desde 01/09 |
| Teses do TCU — ondas 1 a 3 | #209 | ✅ rotas `/teses`, `/teses/[chave]`, `/area-restrita/teses` |
| Banco descartável da Neon no CI | #211 | ✅ o job de navegador funciona pela **primeira vez** |
| Inteiro teor do TCU na busca semântica | #206 | ✅ |
| Aprovação em lote (script, procedência) | #207 | ✅ |
| Script de promoção à vitrine | #214 | ✅ com a guarda contra veredito provisório |
| **Herança editorial entre versões** | merge direto | ✅ 16 commits, o assunto principal deste handoff |

Fechados sem merge: **#204** (design-home, superado por migração equivalente já na `main`; a branch **não** foi apagada e guarda três arquivos exclusivos, entre eles `docs/REDESIGN_HANDOFF.md`), **#215** e **#216** (a spec e o plano da herança, cujo conteúdo entrou no merge).

**Aberto:** **#213** — o plano da Onda 4 das teses (busca por IA). Escrito, revisado, não executado.

---

## 2. O problema que a herança editorial resolve

O cron redestila um acórdão quando o dossiê dele engorda. O modelo reescreve o texto, e o julgamento editorial só atravessava para a versão nova se o texto fosse **idêntico** — o que quase nunca acontece.

Medido em 09/09/2026: de **108 vereditos no banco, exatamente 1** havia sido herdado. O trabalho de conferência evaporava, e a vitrine pública se esvaziaria sozinha.

**Como ficou.** Com texto diferente e antecessor julgado:

- `veredito` e `publicado` migram — a tese continua no acervo restrito;
- `vitrinePublica` **não** migra;
- `julgadoPor` e `julgadoEm` nascem **nulos**, porque ninguém leu aquele texto;
- `herdadoDe` guarda o rastro até o julgamento humano de verdade;
- `reconferenciaPendente` marca, e a folha de calibração mostra a tese numa fila.

A regra vive em `lib/tcu/carregar-veredito.ts`, atrás da opção `herdarComTextoDiferente`, e é chamada de dois lugares: a redestilação ao vivo (`lib/tcu/persistir-tese.ts`) e o backfill (`lib/tcu/backfill-heranca.ts`). **Nunca reimplemente essa regra** — foi o risco arquitetural central do plano, e ele foi evitado de propósito.

---

## 3. Estado medido no banco em 09/09/2026, após o backfill

| | |
|---|---|
| Enunciados publicados no acervo | **91** |
| Na vitrine pública | **3** (acórdãos 1211/2021 e 96/2008, ambos do Plenário) |
| **Pendentes de reconferência** | **20** |
| Delas, alcançáveis pela fila da folha | **20** — nenhuma órfã |
| Destilações vigentes | 265 |
| Acórdãos com mais de uma versão | 105 de 265 |

O backfill de recuperação **já foi executado**: 11 enunciados voltaram ao acervo (entre eles 3215/2022, 1440/2007 e 934/2021, que não estavam em lugar nenhum) e 9 ganharam a marca que revela estarem carimbados por lote sobre uma conferência do Daniel.

---

## 4. A próxima ação, e ela é do Daniel

```bash
npx tsx scripts/build-folha-teses-tcu.ts
```

A folha ganha, no topo, a seção **Reconferência pendente**: cada acórdão com o texto novo de um lado e, do outro, o texto aprovado antes e a data. Julga-se por cartão de acórdão, como sempre. O export volta por:

```bash
npx tsx scripts/importar-veredito-teses.ts --arquivo=<export> --dry-run
```

que limpa `reconferenciaPendente` e devolve a tese à elegibilidade da vitrine.

**São 20 cartões.** É a primeira vez que esse julgamento tem garantia de não se perder na redestilação seguinte.

Depois disso, a segunda frente editorial: promover à vitrine as candidatas de nível 1 que sobraram (`npx tsx scripts/promover-vitrine-teses.ts` mostra quem passa).

---

## 5. Decisões de desenho que NÃO devem ser desfeitas sem falar com o Daniel

1. **`julgadoPor` nulo no veredito provisório.** Dizer que ele julgou um texto que não leu é a mesma mentira que a etiqueta de lote conta. O rastro fica em `herdadoDe`, não na autoria.
2. **A vitrine encolhe sozinha, e isso é o desenho funcionando.** Quando um acórdão dela for redestilado com texto diferente, a tese sai do ar até a reconferência. Foi decisão explícita: a vitrine nunca exibe formulação que ninguém leu.
3. **Nada pareia teses entre versões por algoritmo.** Nem por posição, nem por semelhança. A fila é por acórdão, com os textos lado a lado, e quem pareia é o humano.
4. **Lógica testável nunca é exportada de um script.** Vários scripts deste projeto chamam `main()` no escopo do módulo; um teste que os importe **executa o script**, com o Prisma de produção. Isso custou duas rodadas de correção nesta sessão. Por isso existem `lib/tcu/dados-do-veredito.ts` e `lib/teses/reconferencia.ts`.
5. **Nomes de `it(...)` sem acento.** É a convenção deste repositório, e testes novos devem segui-la mesmo que pareça inconsistente com o resto do código, que usa acentuação correta.

---

## 6. Pendências conhecidas, em ordem de importância

**Issue #212 — seis áreas do admin mandam o Prisma para o navegador.** Blog, Contatos, Glossário, Newsletter, Publicações e Sites: os botões "Deletar" não têm como funcionar, e as páginas carregam 316 KB de JavaScript inútil. A issue tem as provas (o trecho do bundle, a mensagem de erro do Prisma empacotado). Falta confirmar clicando se a página inteira quebra ou só o botão.

**PR #213 — Onda 4 das teses (busca por IA).** Plano escrito e revisado. Ele fixa duas coisas que valem lembrar: a visibilidade das teses precisa entrar na **chave de cache** (senão a consulta de um assinante vaza o acervo para o próximo anônimo), e o critério para ligar no assistente **não** está fixado de propósito — mede-se primeiro, decide-se depois, com o histograma na mão.

**`vitest.config.ts` não exclui `.claude/**`.** Um worktree aberto dentro do repositório faz a suíte varrer o `node_modules` dele: em 09/09 isso devolveu 8.103 testes com 246 arquivos falhando, quando a suíte real é de 3.075 em 238. Contorno: `npx vitest run --exclude '**/.claude/**'`.

**Prisma 7.8 mudou as flags do `migrate diff`.** As `--from-schema-datamodel`/`--to-schema-datamodel` foram removidas; use `--from-schema`/`--to-schema`. O plano da Onda 4 (#213) ainda repete o comando antigo.

**Aritmética do log `herdados`.** O contador de `lib/tcu/persistir-tese.ts` vai saltar de quase zero para quase tudo na primeira redestilação após o deploy, porque agora quase todo enunciado com antecessor julgado herda. **Não é incidente** — é a mudança funcionando. Não há teste cobrindo a aritmética sob o nível 2; foi decisão consciente, por alimentar só o log.

**Endereço de dois módulos.** `lib/teses/reconferencia.ts` seria mais coerente em `lib/tcu/`, junto dos irmãos do domínio, e `lib/tcu/dados-do-veredito.ts` (8 linhas) tem vizinho natural em `lib/tcu/aplicar-veredito.ts`. Arrumação, não defeito; adiada de propósito.

**`retiradoEm` no backfill.** O primeiro movimento não restaura a retirada editorial. Em 09/09 isso não tinha consequência — as 3 teses retiradas estavam todas na versão vigente, nenhum acórdão retirado foi redestilado depois — e a herança de nível 2 fecha a lacuna daqui para frente. A justificativa está em comentário datado dentro de `lib/tcu/backfill-heranca.ts`; **o argumento envelhece**, então reconfira o fato antes de confiar nele.

---

## 7. Documentos de referência

- `docs/superpowers/specs/2026-09-09-heranca-editorial-teses-design.md` — a spec desta sessão
- `docs/superpowers/plans/2026-09-09-heranca-editorial-teses.md` — o plano executado
- `docs/superpowers/specs/2026-09-04-publicacao-teses-tcu-design.md` — a spec das ondas 1 a 3, cuja §5 esta sessão alterou
- `docs/superpowers/plans/2026-09-08-teses-onda4-busca-por-ia.md` — o plano da busca, não executado
- `docs/HANDOFF-2026-07-21-teses-tcu.md` — o handoff anterior, das frentes A e C1
