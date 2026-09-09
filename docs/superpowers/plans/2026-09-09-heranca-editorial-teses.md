# Herança Editorial das Teses — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que a conferência individual de uma tese sobreviva à redestilação, sem que isso publique formulação que ninguém leu.

**Architecture:** `carregarVeredito` ganha um segundo nível, ligado por opção explícita: quando o texto do enunciado mudou mas a versão anterior tinha veredito, o veredito e o estado do acervo migram, a vitrine não migra, e `julgadoPor` nasce nulo. Um campo novo (`reconferenciaPendente`) marca o enunciado, e a folha de calibração — onde a conferência já acontece — ganha a seção que os traz de volta ao julgamento. Três comportamentos exigidos pela spec caem por gravidade de regras que já existem e não precisam de código.

**Tech Stack:** TypeScript, Prisma 7 (PrismaNeon), PostgreSQL/Neon, Vitest, Playwright (para o teste contra banco de verdade), tsx para scripts.

**Spec:** `docs/superpowers/specs/2026-09-09-heranca-editorial-teses-design.md` (PR #215, aprovada em 09/09/2026). Ela altera a §5 de `docs/superpowers/specs/2026-09-04-publicacao-teses-tcu-design.md`.

## Global Constraints

- **Diretório de trabalho:** este worktree, `C:\Users\User\projetos\sitedobarral\.claude\worktrees\heranca-editorial`. Rodar tudo da raiz dele; **não** navegar para o checkout principal.
- **Testes de script vivem em `test/<área>/`**, não em `scripts/__tests__/`. É a convenção do projeto: `test/legislative-scrapers/normalize-theme-tic.test.ts` cobre `scripts/normalize-theme-tic.ts`.
- **Idioma:** comentários, mensagens de commit, saída de script e todo texto de interface em português, **com acentuação correta** — nunca "nao" por "não", "acordao" por "acórdão".
- **Verificação obrigatória antes de reportar qualquer tarefa:** `npx vitest run` (suíte inteira) **e** `npx tsc --noEmit -p tsconfig.json`. Linha de base: **3.037 testes passando, zero erros de tipo** (09/09/2026). O vitest usa esbuild e não checa tipos — suíte verde não prova compilação.
- **Migrações:** o deploy roda `prisma migrate deploy`. Gerar a migração **offline** com `prisma migrate diff` e **não aplicar** contra produção — a execução fica com o usuário.
- **Nenhuma tarefa escreve no banco de produção.** O backfill da Task 5 nasce em dry-run; a execução é do usuário, depois da revisão.
- **Vocabulário de veredito:** `fiel | imprecisa | errada`. Só `fiel` é aprovação.
- **Predicado canônico** em `lib/tcu/elegibilidade-tese.ts`. Nenhuma tarefa o altera — a spec é explícita: o que muda é o que chega até ele.
- **Números medidos em 09/09/2026:** 108 vereditos, 1 herdado; 265 destilações vigentes; 105 acórdãos com mais de uma versão; 88 teses publicadas, 3 na vitrine.
- **Três arquivos são do usuário e não entram em commit algum:** `docs/audits/folha-teses-tcu-licitacoes.html`, `catalogacao-fontes-tcu-licitacoes.docx`, `.claude/settings.json`.
- **Staging explícito** — nunca `git add -A`.

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `lib/tcu/carregar-veredito.ts` | A regra dos dois níveis. Função pura, sem Prisma. |
| `lib/tcu/carregar-veredito.test.ts` | Os dois níveis, e a garantia de que o nível 1 não regrediu. |
| `prisma/schema.prisma` | Campo `reconferenciaPendente` em `TeseEnunciado`. |
| `lib/tcu/persistir-tese.ts` | Liga o nível 2 para enunciados — e só para eles. |
| `scripts/importar-veredito-teses.ts` | Limpa a pendência quando o veredito próprio chega. |
| `scripts/build-folha-teses-tcu.ts` | A seção de reconferência, com o texto anterior ao lado. |
| `scripts/backfill-heranca-editorial.ts` | Recupera o que já se perdeu, em dois movimentos. |
| `e2e/heranca-editorial.spec.ts` | Integração: a tese sai da vitrine e fica no acervo. |

A regra vive numa função pura porque é ela que carrega a decisão de produto — e porque assim os sete casos da §10 da spec são testáveis sem instanciar Prisma.

---

### Task 1: A regra dos dois níveis

Função pura, sem banco. É o coração do documento: tudo o mais é encanamento.

**Files:**
- Modify: `lib/tcu/carregar-veredito.ts` (interface `VeredictoHerdado` na linha 19; `SEM_VEREDITO` na 30; a função na 41)
- Test: `lib/tcu/carregar-veredito.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `interface OpcoesHeranca { herdarComTextoDiferente?: boolean }`
  - `VeredictoHerdado` ganha `reconferenciaPendente: boolean`
  - `carregarVeredito(enunciadoNovo: string, anteriores: Array<...>, opcoes?: OpcoesHeranca): VeredictoHerdado`

> **Atenção ao teste existente.** O primeiro teste do arquivo (linha 15) compara o **shape completo** com `toEqual`, de propósito. Acrescentar `reconferenciaPendente` ao retorno o quebra. Isso é esperado, e o Step 1 já o corrige — não é regressão.

- [ ] **Step 1: Escrever os testes dos dois níveis**

Substituir o primeiro teste de `lib/tcu/carregar-veredito.test.ts` (linhas 10-19) por esta versão, que acrescenta o campo novo ao shape, e acrescentar o bloco `describe` inteiro ao final do arquivo:

```typescript
  it('herda o veredito quando o texto e IDENTICO', () => {
    const r = carregarVeredito('A prescricao e de dez anos.', [anterior('A prescricao e de dez anos.', 'fiel')]);
    // Shape completo de propósito: o fixture `anterior` não traz estado editorial,
    // então herdar o veredito também herda os defaults (publicado/vitrinePublica
    // false, sem retirada) — não só o veredito em si.
    expect(r).toEqual({
      veredito: 'fiel', herdadoDe: 'a1', julgadoEm: em, julgadoPor: 'daniel',
      publicado: false, vitrinePublica: false, retiradoEm: null, retiradoMotivo: null,
      reconferenciaPendente: false,
    });
  });
```

```typescript
describe('carregarVeredito — nivel 2, texto diferente (spec §4.1)', () => {
  const julgado = {
    id: 'a9',
    enunciado: 'A prescricao e de dez anos.',
    veredito: 'fiel',
    julgadoEm: em,
    julgadoPor: 'daniel',
    publicado: true,
    vitrinePublica: true,
    retiradoEm: null,
    retiradoMotivo: null,
  };

  it('sem a opcao ligada, texto diferente continua NAO herdando nada', () => {
    const r = carregarVeredito('Redacao completamente outra.', [julgado]);
    expect(r.veredito).toBeNull();
    expect(r.reconferenciaPendente).toBe(false);
  });

  // O nivel 1 nao pode regredir: com texto identico, a vitrine CONTINUA
  // migrando. E a diferenca entre os dois niveis, e o fixture principal do
  // arquivo nao cobre isso porque nao traz estado editorial.
  it('com texto IDENTICO a vitrine continua migrando', () => {
    const r = carregarVeredito(julgado.enunciado, [julgado], { herdarComTextoDiferente: true });
    expect(r.vitrinePublica).toBe(true);
    expect(r.julgadoPor).toBe('daniel');
    expect(r.reconferenciaPendente).toBe(false);
  });

  it('com a opcao ligada, herda veredito e acervo mas NAO a vitrine', () => {
    const r = carregarVeredito('Redacao completamente outra.', [julgado], {
      herdarComTextoDiferente: true,
    });
    expect(r.veredito).toBe('fiel');
    expect(r.publicado).toBe(true);
    expect(r.vitrinePublica).toBe(false);
    expect(r.reconferenciaPendente).toBe(true);
  });

  // §4.3: dizer que o Daniel julgou um texto que ele nunca leu e a mesma
  // mentira que a etiqueta de lote conta hoje. O rastro fica em `herdadoDe`.
  it('nao atribui autoria a quem nao leu o texto novo', () => {
    const r = carregarVeredito('Redacao completamente outra.', [julgado], {
      herdarComTextoDiferente: true,
    });
    expect(r.julgadoPor).toBeNull();
    expect(r.julgadoEm).toBeNull();
    expect(r.herdadoDe).toBe('a9');
  });

  it('sem antecessor julgado, nao ha heranca nem pendencia', () => {
    const naoJulgado = { ...julgado, veredito: null, julgadoEm: null, julgadoPor: null };
    const r = carregarVeredito('Redacao completamente outra.', [naoJulgado], {
      herdarComTextoDiferente: true,
    });
    expect(r.veredito).toBeNull();
    expect(r.reconferenciaPendente).toBe(false);
  });

  // Sem pareamento por texto, a versao anterior fala com uma voz so. Se ela
  // tem vereditos divergentes, nao ha o que herdar sem adivinhar (spec §4.2).
  it('nao adivinha quando a versao anterior tem vereditos divergentes', () => {
    const outro = { ...julgado, id: 'a10', veredito: 'errada' };
    const r = carregarVeredito('Redacao completamente outra.', [julgado, outro], {
      herdarComTextoDiferente: true,
    });
    expect(r.veredito).toBeNull();
    expect(r.reconferenciaPendente).toBe(false);
  });

  // A §5 da spec anterior declara impossivel ressuscitar tese retirada. Sem
  // isto, mudar o texto a traria de volta — o mesmo buraco que a versao
  // anterior fechou para texto identico, aberto para texto diferente.
  it('a retirada sobrevive ao texto novo', () => {
    const retirado = {
      ...julgado,
      veredito: null,
      julgadoEm: null,
      julgadoPor: null,
      retiradoEm: em,
      retiradoMotivo: 'materia estranha',
    };
    const r = carregarVeredito('Redacao completamente outra.', [retirado], {
      herdarComTextoDiferente: true,
    });
    expect(r.retiradoEm).toEqual(em);
    expect(r.retiradoMotivo).toBe('materia estranha');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/tcu/carregar-veredito.test.ts`
Expected: FAIL. O primeiro teste falha porque `reconferenciaPendente` ainda não existe no retorno; os do bloco novo falham porque o terceiro parâmetro não existe.

- [ ] **Step 3: Implementar os dois níveis**

Em `lib/tcu/carregar-veredito.ts`, acrescentar o campo à interface, a opção, e reescrever a função. O bloco de comentário existente (linhas 52-75) explica o nível 1 e **permanece**, dentro do ramo do nível 1.

```typescript
export interface VeredictoHerdado {
  veredito: string | null;
  herdadoDe: string | null;
  julgadoEm: Date | null;
  julgadoPor: string | null;
  publicado: boolean;
  vitrinePublica: boolean;
  retiradoEm: Date | null;
  retiradoMotivo: string | null;
  /**
   * Veredito herdado de uma versão cujo TEXTO ERA DIFERENTE (spec §4.1, nível
   * 2). Vale para o acervo restrito, nunca para a vitrine, e some quando o
   * enunciado é conferido de novo.
   */
  reconferenciaPendente: boolean;
}

export interface OpcoesHeranca {
  /**
   * Liga o nível 2. Default `false`: nenhum chamador muda de comportamento sem
   * pedir — e as divergências, que não têm onde guardar a pendência, ficam de
   * fora por isso (ver persistir-tese.ts).
   */
  herdarComTextoDiferente?: boolean;
}

const SEM_VEREDITO: VeredictoHerdado = {
  veredito: null,
  herdadoDe: null,
  julgadoEm: null,
  julgadoPor: null,
  publicado: false,
  vitrinePublica: false,
  retiradoEm: null,
  retiradoMotivo: null,
  reconferenciaPendente: false,
};

export function carregarVeredito(
  enunciadoNovo: string,
  anteriores: Array<EnunciadoJulgavel & {
    julgadoEm: Date | null;
    julgadoPor: string | null;
    publicado?: boolean;
    vitrinePublica?: boolean;
    retiradoEm?: Date | null;
    retiradoMotivo?: string | null;
  }>,
  opcoes: OpcoesHeranca = {}
): VeredictoHerdado {
  const parEditorial = anteriores.find((a) => a.enunciado === enunciadoNovo);

  // ---- Nível 1: texto idêntico. Comportamento inalterado. ----
  if (parEditorial) {
    // (o bloco de comentário das linhas 52-75 do arquivo original vem para cá,
    // sem alteração: ele explica por que os dois `find` são separados)
    const par = anteriores.find((a) => a.veredito !== null && a.enunciado === enunciadoNovo);
    return {
      veredito: par?.veredito ?? null,
      herdadoDe: par?.id ?? null,
      julgadoEm: par?.julgadoEm ?? null,
      julgadoPor: par?.julgadoPor ?? null,
      publicado: parEditorial.publicado ?? false,
      vitrinePublica: parEditorial.vitrinePublica ?? false,
      retiradoEm: parEditorial.retiradoEm ?? null,
      retiradoMotivo: parEditorial.retiradoMotivo ?? null,
      reconferenciaPendente: false,
    };
  }

  // ---- Nível 2: texto diferente (spec §4.1). ----
  //
  // Só entra quando o chamador pede. Sem isto, o default seria uma mudança de
  // comportamento para todo mundo que chama a função — inclusive as
  // divergências, que não têm coluna onde marcar a pendência e ficariam com
  // veredito provisório invisível.
  if (!opcoes.herdarComTextoDiferente) return { ...SEM_VEREDITO };

  // A retirada é ato de quem tirou a tese do ar, e vale para o acórdão, não
  // para a redação. Sem esta linha, mudar o texto ressuscita tese retirada.
  const retirado = anteriores.find((a) => a.retiradoEm != null);
  const retirada = {
    retiradoEm: retirado?.retiradoEm ?? null,
    retiradoMotivo: retirado?.retiradoMotivo ?? null,
  };

  const julgados = anteriores.filter((a) => a.veredito !== null);
  if (julgados.length === 0) return { ...SEM_VEREDITO, ...retirada };

  // Sem pareamento por texto (spec §4.2), a versão anterior precisa falar com
  // uma voz só. Vereditos divergentes não dão o que herdar sem adivinhar.
  const distintos = new Set(julgados.map((j) => j.veredito));
  if (distintos.size > 1) return { ...SEM_VEREDITO, ...retirada };

  const origem = julgados[0];
  return {
    veredito: origem.veredito,
    herdadoDe: origem.id,
    julgadoEm: null,
    julgadoPor: null,
    publicado: origem.publicado ?? false,
    vitrinePublica: false,
    ...retirada,
    reconferenciaPendente: true,
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run lib/tcu/carregar-veredito.test.ts`
Expected: PASS — os testes antigos (que provam que pontuação, espaçamento e caixa diferentes não herdam com o default) continuam verdes, mais os 6 novos.

- [ ] **Step 5: Verificação e commit**

```bash
npx vitest run
npx tsc --noEmit -p tsconfig.json
git add lib/tcu/carregar-veredito.ts lib/tcu/carregar-veredito.test.ts
git commit -m "feat(teses): herança de veredito com texto diferente, atrás de opção"
```

---

### Task 2: Persistir a pendência

O campo no banco e o chamador que liga o nível 2 — para enunciados, e só para eles.

**Files:**
- Modify: `prisma/schema.prisma` (model `TeseEnunciado`, junto de `embeddingStatus`)
- Create: `prisma/migrations/<timestamp>_add_reconferencia_pendente/migration.sql`
- Modify: `lib/tcu/persistir-tese.ts:226` (a chamada dentro do `map` dos enunciados)
- Test: `lib/tcu/persistir-tese.test.ts` (acrescentar ao arquivo existente)

**Interfaces:**
- Consumes: `carregarVeredito(..., { herdarComTextoDiferente: true })` da Task 1.
- Produces: coluna `TeseEnunciado.reconferenciaPendente`, gravada pela redestilação.

- [ ] **Step 1: Acrescentar o campo ao schema**

Em `prisma/schema.prisma`, no model `TeseEnunciado`, logo depois de `embeddingStatus`:

```prisma
  /// Veredito herdado de uma versão anterior cujo TEXTO ERA DIFERENTE (spec
  /// §4.1, nível 2). Vale para o acervo restrito, nunca para a vitrine, e some
  /// quando o enunciado é conferido de novo. A assinatura desse estado é
  /// `julgadoPor` nulo com `herdadoDe` preenchido.
  reconferenciaPendente Boolean @default(false)
```

E o índice, junto dos que já existem no fim do model — a fila da Task 4 consulta por ele:

```prisma
  @@index([reconferenciaPendente])
```

- [ ] **Step 2: Gerar a migração offline e o client**

```bash
git show HEAD:prisma/schema.prisma > /tmp/schema-head.prisma
npx prisma migrate diff --from-schema-datamodel /tmp/schema-head.prisma --to-schema-datamodel prisma/schema.prisma --script > /tmp/migration.sql
```

Criar `prisma/migrations/<AAAAMMDDHHMMSS>_add_reconferencia_pendente/migration.sql` com esse conteúdo. Conferir que o SQL contém `ADD COLUMN "reconferenciaPendente"` com `DEFAULT false` e **nenhum** `DROP`. Depois: `npx prisma generate`.

Expected: `Generated Prisma Client`.

- [ ] **Step 3: Atualizar o teste existente que muda de comportamento**

> **Este passo é o coração da Task, e não é regressão.** O teste `(b) enunciado
> identico herda o veredito; enunciado alterado NAO herda`, em
> `lib/tcu/persistir-tese.test.ts:140`, afirma hoje que texto alterado **não**
> herda. Ligar o nível 2 muda exatamente isso. O teste deve ser atualizado para
> asserir o comportamento novo — **não** "consertado" o código para preservar o
> antigo, que desfaria a tarefa inteira.

Renomear o teste e substituir as duas últimas asserções (linhas 165-166):

```typescript
  it('(b) enunciado identico herda com autoria; enunciado alterado herda provisoriamente', async () => {
```

```typescript
    expect(enunciados[0].veredito).toBe('aprovada');
    expect(enunciados[0].herdadoDe).toBe('e1');
    expect(enunciados[0].reconferenciaPendente).toBe(false);
    // Nível 2 (spec §4.1): o texto mudou, então o veredito atravessa como
    // provisório — com rastro, sem autoria, e fora da vitrine.
    expect(enunciados[1].veredito).toBe('aprovada');
    expect(enunciados[1].herdadoDe).toBe('e1');
    expect(enunciados[1].julgadoPor).toBeNull();
    expect(enunciados[1].vitrinePublica).toBe(false);
    expect(enunciados[1].reconferenciaPendente).toBe(true);
```

E acrescentar, ao final do arquivo, o caso que prova que o acervo é preservado:

```typescript
describe('persistirDestilacao — heranca com texto diferente (spec §4.1)', () => {
  it('mantem o acervo e larga a vitrine quando o texto muda', async () => {
    mockAnterior.mockResolvedValue({
      id: 'anterior-id',
      enunciados: [{
        id: 'e1', enunciado: 'Redacao antiga.', veredito: 'fiel',
        julgadoEm: new Date('2026-08-13T00:00:00Z'), julgadoPor: 'daniel',
        publicado: true, vitrinePublica: true, retiradoEm: null, retiradoMotivo: null,
      }],
      divergencias: [],
    });

    const tese: TeseDestilada = {
      chave: '1/2026',
      assunto: 'Assunto',
      teses: [{ enunciado: 'Redacao nova, outra.', inovacao: '', trechosFonte: [] }],
      sinaisQualitativos: [],
      divergencias: [],
      confianca: 'alta',
    };

    await persistirDestilacao({ numero: 1, ano: 2026 }, tese, fazerDossie([]));

    const enunciados = ultimoTx.teseDestilacao.create.mock.calls[0][0].data.enunciados.create;
    expect(enunciados[0].veredito).toBe('fiel');
    expect(enunciados[0].publicado).toBe(true);
    expect(enunciados[0].vitrinePublica).toBe(false);
    expect(enunciados[0].julgadoPor).toBeNull();
    expect(enunciados[0].reconferenciaPendente).toBe(true);
  });
});
```

> **Idioma do arquivo, para reusar em vez de inventar:** os mocks são
> `mockAnterior.mockResolvedValue({ id, enunciados, divergencias })`; o dossiê vem
> de `fazerDossie([...])`; a assinatura é
> `persistirDestilacao({ numero, ano }, tese, dossie)` — três argumentos —; e o
> que foi gravado se lê em
> `ultimoTx.teseDestilacao.create.mock.calls[0][0].data.enunciados.create`.

- [ ] **Step 4: Rodar e ver falhar**

Run: `npx vitest run lib/tcu/persistir-tese.test.ts`
Expected: FAIL — `vitrinePublica` vem `true` e `reconferenciaPendente` vem `undefined`, porque o nível 2 ainda não está ligado.

- [ ] **Step 5: Ligar o nível 2 para os enunciados**

Em `lib/tcu/persistir-tese.ts`, linha 226, dentro do `map` dos **enunciados** (não o das divergências):

```typescript
    // Nível 2 ligado só aqui: TeseDivergencia não tem `reconferenciaPendente`,
    // então um veredito provisório numa divergência ficaria invisível. O `map`
    // das divergências, logo abaixo, segue chamando sem a opção.
    const h = carregarVeredito(t.enunciado, anterioresEnunciados, { herdarComTextoDiferente: true });
```

O `...h` da linha 233 já espalha o campo novo para o `create` — nada mais a mudar ali.

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run lib/tcu/persistir-tese.test.ts`
Expected: PASS.

- [ ] **Step 7: Verificação e commit**

```bash
npx vitest run
npx tsc --noEmit -p tsconfig.json
git add prisma/schema.prisma prisma/migrations lib/tcu/persistir-tese.ts lib/tcu/persistir-tese.test.ts
git commit -m "feat(teses): grava a pendência de reconferência na redestilação"
```

---

### Task 3: A conferência limpa a pendência

Sem isto a marca nunca sai, e a fila da Task 4 devolve para sempre o que já foi reconferido.

**Files:**
- Modify: `scripts/importar-veredito-teses.ts:87` (o `data` do `updateMany`)
- Test: `test/teses/importar-veredito.test.ts`

**Interfaces:**
- Consumes: a coluna da Task 2.
- Produces: nada para tarefas seguintes; fecha o ciclo da §5 da spec.

- [ ] **Step 1: Escrever o teste**

Criar `test/teses/importar-veredito.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { dadosDoVeredito } from '../importar-veredito-teses';

describe('dadosDoVeredito', () => {
  const agora = new Date('2026-09-09T12:00:00Z');

  it('grava o veredito com autoria e limpa o rastro de heranca', () => {
    expect(dadosDoVeredito('fiel', agora, 'daniel')).toEqual({
      veredito: 'fiel',
      julgadoEm: agora,
      julgadoPor: 'daniel',
      herdadoDe: null,
      reconferenciaPendente: false,
    });
  });

  // O ciclo da spec §5: conferido de novo, o enunciado deixa de ser provisório
  // e volta a ser elegível à vitrine.
  it('limpa a pendencia mesmo quando o veredito reprova', () => {
    expect(dadosDoVeredito('errada', agora, 'daniel').reconferenciaPendente).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run test/teses/importar-veredito.test.ts`
Expected: FAIL — `dadosDoVeredito` não é exportada.

- [ ] **Step 3: Extrair a função e limpar a pendência**

Em `scripts/importar-veredito-teses.ts`, acrescentar a função exportada acima de `main()`:

```typescript
/**
 * Os campos que um veredito conferido grava. Extraído para ser testável sem
 * banco: `herdadoDe: null` e `reconferenciaPendente: false` são o que
 * transforma um veredito provisório (spec §4.1, nível 2) em julgamento próprio.
 */
export function dadosDoVeredito(veredito: string, agora: Date, julgadoPor: string) {
  return { veredito, julgadoEm: agora, julgadoPor, herdadoDe: null, reconferenciaPendente: false };
}
```

E usá-la no `updateMany` da linha 85-88:

```typescript
      await prisma.teseEnunciado.updateMany({
        where: { destilacaoId: d.id },
        data: dadosDoVeredito(caso.veredito, agora, julgadoPor),
      });
```

A `update` das divergências (linha 109-112) **não** muda: `TeseDivergencia` não tem a coluna.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run test/teses/importar-veredito.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 5: Verificação e commit**

```bash
npx vitest run
npx tsc --noEmit -p tsconfig.json
git add scripts/importar-veredito-teses.ts test/teses/importar-veredito.test.ts
git commit -m "feat(teses): conferir de novo limpa a pendência"
```

---

### Task 4: A seção de reconferência na folha

**Files:**
- Modify: `scripts/build-folha-teses-tcu.ts` (a seleção, por volta da linha 79; a montagem dos cartões)
- Modify: `scripts/lib/folha-teses-template.mjs` (o bloco do cartão)
- Test: `test/teses/folha-reconferencia.test.ts`

**Interfaces:**
- Consumes: a coluna da Task 2.
- Produces: `selecionarReconferencia(destilacoes): CartaoReconferencia[]`, com `interface CartaoReconferencia { chave: string; enunciadoNovo: string; enunciadoAnterior: string; julgadoPor: string; julgadoEm: Date }`

> **Por que a seleção ignora os filtros da folha.** A folha recorta por `--min-no-voto` e por tema. Um enunciado pendente que caísse fora desse recorte sumiria em silêncio — e ele já foi conferido uma vez, então o limiar de citação não tem o que dizer sobre ele. A seção de reconferência é selecionada **antes** e **independentemente** desses filtros.

- [ ] **Step 1: Escrever o teste da seleção**

Criar `test/teses/folha-reconferencia.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { selecionarReconferencia } from '../build-folha-teses-tcu';

const anterior = {
  id: 'ant-1',
  enunciado: 'Redacao antiga, aprovada em agosto.',
  julgadoPor: 'daniel',
  julgadoEm: new Date('2026-08-13T00:00:00Z'),
};

const destilacao = (over = {}) => ({
  chave: '1441/2016',
  numeroAlvo: 1441,
  anoAlvo: 2016,
  enunciados: [{
    id: 'novo-1',
    enunciado: 'Redacao nova, ninguem leu.',
    reconferenciaPendente: true,
    herdadoDe: 'ant-1',
    ...over,
  }],
});

describe('selecionarReconferencia', () => {
  it('traz o texto novo ao lado do texto que foi aprovado', () => {
    const r = selecionarReconferencia([destilacao()], new Map([['ant-1', anterior]]));
    expect(r).toHaveLength(1);
    expect(r[0].enunciadoNovo).toBe('Redacao nova, ninguem leu.');
    expect(r[0].enunciadoAnterior).toBe('Redacao antiga, aprovada em agosto.');
    expect(r[0].julgadoPor).toBe('daniel');
  });

  it('ignora enunciado sem pendencia', () => {
    const r = selecionarReconferencia([destilacao({ reconferenciaPendente: false })], new Map([['ant-1', anterior]]));
    expect(r).toHaveLength(0);
  });

  // Sem o antecessor nao ha o que comparar, e um cartao com um lado vazio pede
  // um julgamento as cegas — que e o oposto do proposito da secao.
  it('ignora pendencia cujo antecessor sumiu do banco', () => {
    const r = selecionarReconferencia([destilacao()], new Map());
    expect(r).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run test/teses/folha-reconferencia.test.ts`
Expected: FAIL — `selecionarReconferencia` não é exportada.

- [ ] **Step 3: Implementar a seleção**

Em `scripts/build-folha-teses-tcu.ts`, acima de `main()`:

```typescript
export interface CartaoReconferencia {
  chave: string;
  enunciadoNovo: string;
  enunciadoAnterior: string;
  julgadoPor: string;
  julgadoEm: Date;
}

/**
 * Os enunciados vigentes que carregam veredito provisório (spec §4.1, nível 2),
 * cada um ao lado do texto que foi efetivamente aprovado.
 *
 * Selecionada ANTES e independentemente dos recortes de `--min-no-voto` e
 * `--tema`: quem já foi conferido uma vez não pode sumir da fila por um limiar
 * de citação.
 */
export function selecionarReconferencia(
  destilacoes: Array<{
    chave: string;
    enunciados: Array<{ id: string; enunciado: string; reconferenciaPendente: boolean; herdadoDe: string | null }>;
  }>,
  anterioresPorId: Map<string, { enunciado: string; julgadoPor: string | null; julgadoEm: Date | null }>
): CartaoReconferencia[] {
  const cartoes: CartaoReconferencia[] = [];
  for (const d of destilacoes) {
    for (const e of d.enunciados) {
      if (!e.reconferenciaPendente || !e.herdadoDe) continue;
      const ant = anterioresPorId.get(e.herdadoDe);
      if (!ant || !ant.julgadoPor || !ant.julgadoEm) continue;
      cartoes.push({
        chave: d.chave,
        enunciadoNovo: e.enunciado,
        enunciadoAnterior: ant.enunciado,
        julgadoPor: ant.julgadoPor,
        julgadoEm: ant.julgadoEm,
      });
    }
  }
  return cartoes;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run test/teses/folha-reconferencia.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Ligar na folha**

Em `main()`, depois do `findMany` da linha 79 e **antes** dos filtros de limiar e tema:

```typescript
  const pendentes = await prisma.teseEnunciado.findMany({
    where: { reconferenciaPendente: true, destilacao: { atual: true } },
    select: { herdadoDe: true },
  });
  const anteriores = await prisma.teseEnunciado.findMany({
    where: { id: { in: pendentes.map((p) => p.herdadoDe!).filter(Boolean) } },
    select: { id: true, enunciado: true, julgadoPor: true, julgadoEm: true },
  });
  const cartoesReconferencia = selecionarReconferencia(
    destilacoes,
    new Map(anteriores.map((a) => [a.id, a]))
  );
  console.log(`reconferência pendente: ${cartoesReconferencia.length} enunciado(s)`);
```

Passar `cartoesReconferencia` ao template, que renderiza a seção no topo com o texto novo à esquerda, o texto aprovado à direita, e a data da aprovação anterior. Os botões de veredito são os mesmos dos demais cartões — o export volta por `importar-veredito-teses` sem tratamento especial.

- [ ] **Step 6: Verificação e commit**

```bash
npx vitest run
npx tsc --noEmit -p tsconfig.json
git add scripts/build-folha-teses-tcu.ts scripts/lib/folha-teses-template.mjs test/teses/folha-reconferencia.test.ts
git commit -m "feat(teses): seção de reconferência na folha de calibração"
```

---

### Task 5: Backfill do que já se perdeu

**Files:**
- Create: `scripts/backfill-heranca-editorial.ts`
- Create: `lib/tcu/backfill-heranca.ts`
- Test: `lib/tcu/backfill-heranca.test.ts`
- Test: `e2e/heranca-editorial.spec.ts`

> **Correção de 09/09/2026 — este texto estava errado, e o erro chegou ao código.**
> A versão original devolvia `marcar: string[]`, uma lista pura de ids. Como o
> segundo movimento gravava só `reconferenciaPendente`, e como nesses
> enunciados o `herdadoDe` é nulo por construção, a fila da folha
> (`lib/teses/reconferencia.ts`, que exige `reconferenciaPendente` **E**
> `herdadoDe`) os descartava em silêncio: metade do backfill era inerte, contra
> a spec §7, que manda "marcar a pendência **e gravar `herdadoDe`**". O plano
> abaixo já está corrigido — `marcar` carrega o id do antecessor **conferido
> individualmente** (nunca o de lote, que faria a folha exibir "Aprovada por
> danbarral:lote-confianca-alta"), o vigente traz `julgadoPor` para não pedir
> reconferência do que uma pessoa acabou de conferir, e o grupo traz `chave`
> para o dry-run poder listar o que vai tocar.

**Interfaces:**
- Consumes: `carregarVeredito(..., { herdarComTextoDiferente: true })` da Task 1; a coluna da Task 2.
- Produces:
  - `interface PlanoHerdar { chave: string; enunciadoId: string; veredito: string; publicado: boolean; herdadoDe: string }`
  - `interface PlanoMarcar { chave: string; enunciadoId: string; herdadoDe: string }`
  - `interface GrupoDeVersoes { chave: string; vigentes: Array<{ id: string; enunciado: string; veredito: string | null; julgadoPor: string | null }>; anteriores: Array<AnteriorJulgavel> }`
  - `planejarBackfill(grupos: GrupoDeVersoes[]): { herdar: PlanoHerdar[]; marcar: PlanoMarcar[] }`

> **O backfill aplica a MESMA regra da Task 1, chamando a mesma função.** Um
> `planejarBackfill` com lógica própria seria uma segunda implementação da
> herança, livre para divergir da primeira — e o projeto já tem o predicado de
> elegibilidade centralizado exatamente por esse motivo. Em particular, o
> pareamento é por **versão**, nunca enunciado a enunciado: a spec §4.2 proíbe
> adivinhar qual tese nova corresponde a qual antiga, e um `chaveAnterior` por
> enunciado seria essa adivinhação com outro nome.

- [ ] **Step 1: Escrever o teste dos dois movimentos**

> **Testar `planejarBackfill` isolado NÃO basta.** Foi exatamente assim que o
> defeito acima atravessou cinco revisões: o plano casava com o teste, e o
> teste nunca perguntava se a fila mostrava alguma coisa. O arquivo precisa
> conter também o par **`planejarBackfill` → `selecionarReconferencia`**,
> alimentando a saída de um na entrada do outro, que é como os dois se
> encontram em produção.

Criar `lib/tcu/backfill-heranca.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { planejarBackfill, type GrupoDeVersoes } from './backfill-heranca';
import { selecionarReconferencia } from '../teses/reconferencia';

const em = new Date('2026-08-13T00:00:00Z');
const antecessorJulgado = {
  id: 'ant-1', enunciado: 'Antiga.', veredito: 'fiel',
  julgadoEm: em, julgadoPor: 'daniel',
  publicado: true, vitrinePublica: true, retiradoEm: null, retiradoMotivo: null,
};
const antecessorDeLote = { ...antecessorJulgado, id: 'ant-2', julgadoPor: 'danbarral:lote-confianca-alta' };

const grupo = (over: Partial<GrupoDeVersoes> = {}): GrupoDeVersoes => ({
  chave: '1441/2016',
  vigentes: [],
  anteriores: [antecessorJulgado],
  ...over,
});

describe('planejarBackfill', () => {
  // Primeiro movimento: os 3 acórdãos que sumiram (spec §7).
  it('herda para enunciado vigente SEM veredito', () => {
    const r = planejarBackfill([grupo({
      vigentes: [{ id: 'novo-1', enunciado: 'Nova.', veredito: null, julgadoPor: null }],
    })]);
    expect(r.herdar).toEqual([
      { chave: '1441/2016', enunciadoId: 'novo-1', veredito: 'fiel', publicado: true, herdadoDe: 'ant-1' },
    ]);
    expect(r.marcar).toEqual([]);
  });

  // Segundo movimento: os 6 carimbados pelo lote (spec §7). Nada sai do ar —
  // o veredito de lote fica, e a pendencia torna visivel o que estava oculto.
  // A marca vem acompanhada de `herdadoDe`, senao a fila a descarta.
  it('apenas marca quando o vigente ja tem veredito e o antecessor foi conferido', () => {
    const r = planejarBackfill([grupo({
      vigentes: [{ id: 'novo-2', enunciado: 'Nova.', veredito: 'fiel', julgadoPor: 'danbarral:lote-confianca-alta' }],
    })]);
    expect(r.herdar).toEqual([]);
    expect(r.marcar).toEqual([{ chave: '1441/2016', enunciadoId: 'novo-2', herdadoDe: 'ant-1' }]);
  });

  // O id gravado e o do antecessor CONFERIDO INDIVIDUALMENTE, nunca o de lote
  // — com o de lote, a folha exibiria "Aprovada por danbarral:lote-...".
  it('marca apontando para o antecessor conferido, nao para o de lote', () => {
    const r = planejarBackfill([grupo({
      vigentes: [{ id: 'novo-6', enunciado: 'Nova.', veredito: 'fiel', julgadoPor: 'danbarral:lote-confianca-alta' }],
      anteriores: [antecessorDeLote, antecessorJulgado],
    })]);
    expect(r.marcar).toEqual([{ chave: '1441/2016', enunciadoId: 'novo-6', herdadoDe: 'ant-1' }]);
  });

  // Antecessor de lote nao e conferencia individual: marcar seria ruido.
  it('nao marca quando o antecessor tambem era de lote', () => {
    const r = planejarBackfill([grupo({
      vigentes: [{ id: 'novo-3', enunciado: 'Nova.', veredito: 'fiel', julgadoPor: 'danbarral:lote-confianca-alta' }],
      anteriores: [antecessorDeLote],
    })]);
    expect(r.herdar).toEqual([]);
    expect(r.marcar).toEqual([]);
  });

  // Pedir reconferencia do que uma pessoa acabou de conferir e inventar
  // trabalho, e contradiz `dados-do-veredito.ts`.
  it('nao marca quando o proprio vigente ja foi conferido por uma pessoa', () => {
    const r = planejarBackfill([grupo({
      vigentes: [{ id: 'novo-7', enunciado: 'Nova.', veredito: 'fiel', julgadoPor: 'daniel' }],
    })]);
    expect(r.marcar).toEqual([]);
  });

  // O backfill nao pode inventar onde a regra da Task 1 se recusa a decidir.
  it('nao herda quando a versao anterior tem vereditos divergentes', () => {
    const r = planejarBackfill([grupo({
      vigentes: [{ id: 'novo-4', enunciado: 'Nova.', veredito: null, julgadoPor: null }],
      anteriores: [antecessorJulgado, { ...antecessorJulgado, id: 'ant-3', veredito: 'errada' }],
    })]);
    expect(r.herdar).toEqual([]);
  });

  // Texto identico ja e tratado pela redestilacao (nivel 1); o backfill nao
  // tem o que fazer, e marcar seria pendencia falsa.
  it('ignora enunciado cujo texto e identico ao do antecessor', () => {
    const r = planejarBackfill([grupo({
      vigentes: [{ id: 'novo-5', enunciado: 'Antiga.', veredito: 'fiel', julgadoPor: null }],
    })]);
    expect(r.herdar).toEqual([]);
    expect(r.marcar).toEqual([]);
  });
});

// O par completo: o plano só vale se o que ele grava chega à fila. Um helper
// simula a escrita do script (cada movimento grava `reconferenciaPendente` E
// `herdadoDe`) e entrega o resultado a `selecionarReconferencia`; as asserções
// conferem que o cartão aparece com o texto anterior e a AUTORIA certos.
describe('planejarBackfill — o que o plano grava chega mesmo a fila', () => {
  // ... aplicarNaFila(plano, enunciados, anteriores) → selecionarReconferencia
  it('o 2o movimento produz um cartao visivel, com o texto e a autoria certos', () => { /* ... */ });
  it('o 1o movimento tambem chega a fila', () => { /* ... */ });
  it('a marca nunca atribui a uma pessoa um carimbo de lote', () => { /* ... */ });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/tcu/backfill-heranca.test.ts`
Expected: FAIL — módulo `./backfill-heranca` não existe.

- [ ] **Step 3: Implementar o planejamento**

Criar `lib/tcu/backfill-heranca.ts`:

```typescript
/**
 * O plano do backfill da spec §7, em dois movimentos distintos.
 *
 * Função pura: decide o que fazer, não faz. Assim os dois movimentos são
 * testáveis sem banco, e o script fica só com a parte que escreve.
 *
 * A decisão de herdar NÃO é reimplementada aqui — ela vem de `carregarVeredito`
 * com o nível 2 ligado, a mesma função que a redestilação usa. Uma segunda
 * implementação estaria livre para divergir da primeira, e é justamente contra
 * isso que este projeto centraliza suas regras.
 *
 * POR QUE O PLANO NÃO CARREGA `retiradoEm`/`retiradoMotivo` — a justificativa
 * fica NO ARQUIVO, não no diretório de planejamento: medido em 09/09/2026, as
 * 3 únicas retiradas do banco estão todas na versão VIGENTE, então não há o
 * que recuperar, e o nível 2 fecha a lacuna para o futuro. É um fato do banco
 * naquela data, e envelhece.
 */
import { carregarVeredito, type AnteriorParaHeranca } from './carregar-veredito';

const ETIQUETA_DE_LOTE = ':lote-';

export type AnteriorJulgavel = AnteriorParaHeranca;

/** Um julgamento é de pessoa quando não traz a etiqueta de lote. */
function ehConferenciaIndividual(julgadoPor: string | null | undefined): boolean {
  return julgadoPor != null && !julgadoPor.includes(ETIQUETA_DE_LOTE);
}

export interface PlanoHerdar {
  chave: string;
  enunciadoId: string;
  veredito: string;
  publicado: boolean;
  herdadoDe: string;
}

/**
 * O segundo movimento também grava `herdadoDe`, e não só a marca de pendência:
 * sem ele a fila da folha descarta o enunciado em silêncio.
 */
export interface PlanoMarcar {
  chave: string;
  enunciadoId: string;
  herdadoDe: string;
}

export interface GrupoDeVersoes {
  chave: string;
  vigentes: Array<{ id: string; enunciado: string; veredito: string | null; julgadoPor: string | null }>;
  anteriores: AnteriorJulgavel[];
}

export function planejarBackfill(
  grupos: GrupoDeVersoes[]
): { herdar: PlanoHerdar[]; marcar: PlanoMarcar[] } {
  const herdar: PlanoHerdar[] = [];
  const marcar: PlanoMarcar[] = [];

  for (const g of grupos) {
    // Uma conferência individual em qualquer enunciado da versão anterior
    // qualifica o grupo: a folha julga por cartão de acórdão, então o
    // julgamento vale para a versão inteira. Guardamos QUAL enunciado era, e
    // não apenas que houve um: é o id dele que o segundo movimento grava.
    const conferidoIndividualmente = g.anteriores.find(
      (a) => a.veredito !== null && ehConferenciaIndividual(a.julgadoPor)
    );

    for (const v of g.vigentes) {
      const h = carregarVeredito(v.enunciado, g.anteriores, { herdarComTextoDiferente: true });

      // Texto idêntico não é assunto do backfill: a redestilação já resolveu
      // pelo nível 1, e marcar pendência aqui seria pendência falsa.
      if (!h.reconferenciaPendente) continue;

      if (v.veredito === null) {
        // Primeiro movimento. `h.veredito` só é não-nulo quando a versão
        // anterior falou com uma voz só — a regra da Task 1 já cuidou disso.
        if (h.veredito === null || h.herdadoDe === null) continue;
        herdar.push({
          chave: g.chave,
          enunciadoId: v.id,
          veredito: h.veredito,
          publicado: h.publicado,
          herdadoDe: h.herdadoDe,
        });
        continue;
      }

      // Segundo movimento: o vigente já tem veredito, então nada sai do ar.
      // Quem já foi conferido por uma PESSOA nesta versão está lido.
      if (ehConferenciaIndividual(v.julgadoPor)) continue;

      // Só marca quando o antecessor foi conferência individual — marcar um
      // lote que sucede outro lote não informa nada a ninguém.
      if (conferidoIndividualmente) {
        marcar.push({ chave: g.chave, enunciadoId: v.id, herdadoDe: conferidoIndividualmente.id });
      }
    }
  }

  return { herdar, marcar };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run lib/tcu/backfill-heranca.test.ts`
Expected: PASS — os dois movimentos e o par com a fila.

- [ ] **Step 5: Escrever o script**

Criar `scripts/backfill-heranca-editorial.ts`:

```typescript
/**
 * Recupera o julgamento editorial perdido nas redestilações anteriores à
 * herança de nível 2 (spec §7).
 *
 * Dois movimentos, e a diferença entre eles importa: o primeiro DEVOLVE teses
 * ao acervo restrito; o segundo não muda o que está no ar, apenas torna visível
 * que um veredito de lote está sentado sobre uma conferência individual
 * anterior. O relatório os separa por isso.
 *
 * Uso:
 *   npx tsx scripts/backfill-heranca-editorial.ts               # dry-run
 *   npx tsx scripts/backfill-heranca-editorial.ts --executar
 */
import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { planejarBackfill, type GrupoDeVersoes } from '../lib/tcu/backfill-heranca';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter, log: ['error'] });

const SELECT_ENUNCIADO = {
  id: true, enunciado: true, veredito: true, julgadoEm: true, julgadoPor: true,
  publicado: true, vitrinePublica: true, retiradoEm: true, retiradoMotivo: true,
  // Mesmo par que `persistir-tese.ts` seleciona: sem eles `carregarVeredito`
  // não reconhece um antecessor provisório e perde o rastro do julgamento.
  herdadoDe: true, reconferenciaPendente: true,
} as const;

async function montarGrupos(): Promise<GrupoDeVersoes[]> {
  const destilacoes = await prisma.teseDestilacao.findMany({
    orderBy: { criadoEm: 'asc' },
    select: {
      id: true, numeroAlvo: true, anoAlvo: true, atual: true, criadoEm: true,
      enunciados: { select: SELECT_ENUNCIADO },
    },
  });

  // Pareamento por VERSÃO (spec §4.2): a vigente com a imediatamente anterior
  // do mesmo alvo. Nunca enunciado a enunciado.
  const porAlvo = new Map<string, typeof destilacoes>();
  for (const d of destilacoes) {
    const chave = `${d.numeroAlvo}/${d.anoAlvo}`;
    porAlvo.set(chave, [...(porAlvo.get(chave) ?? []), d]);
  }

  const grupos: GrupoDeVersoes[] = [];
  for (const versoes of porAlvo.values()) {
    const vigente = versoes.find((v) => v.atual);
    const anterior = versoes.filter((v) => !v.atual).at(-1);
    if (!vigente || !anterior) continue;
    grupos.push({
      chave: `${vigente.numeroAlvo}/${vigente.anoAlvo}`,
      vigentes: vigente.enunciados.map((e) => ({
        id: e.id,
        enunciado: e.enunciado,
        veredito: e.veredito,
        // `julgadoPor` do VIGENTE: sem ele o plano marcaria pendência sobre o
        // que uma pessoa acabou de conferir.
        julgadoPor: e.julgadoPor,
      })),
      anteriores: anterior.enunciados,
    });
  }
  return grupos;
}

async function main() {
  const executar = process.argv.includes('--executar');

  console.log('\n=== BACKFILL DA HERANÇA EDITORIAL ===\n');

  const grupos = await montarGrupos();
  console.log(`Alvos com versão anterior: ${grupos.length}`);

  const { herdar, marcar } = planejarBackfill(grupos);

  // Contagens não deixam conferir nada, e este script roda uma vez só, contra
  // produção: o dry-run é o único pré-voo do operador. Listar chave e id é o
  // que permite abrir a folha e olhar o acórdão antes de aplicar (é o que
  // `scripts/publicar-acervo-teses.ts` já faz com o que vai tocar).
  console.log(`\n1º movimento — voltam ao acervo restrito: ${herdar.length} enunciado(s)`);
  for (const h of herdar) {
    console.log(`   Acórdão ${h.chave} · ${h.enunciadoId} · veredito ${h.veredito}` +
      `${h.publicado ? ' · publicado' : ''} · herda de ${h.herdadoDe}`);
  }

  console.log(`\n2º movimento — só ganham a marca de pendência: ${marcar.length} enunciado(s)`);
  console.log('   (o 2º não muda o que está no ar; torna visível o veredito de lote sobre conferência anterior)');
  for (const m of marcar) {
    console.log(`   Acórdão ${m.chave} · ${m.enunciadoId} · herda de ${m.herdadoDe}`);
  }

  if (!executar) {
    console.log('\nModo: dry-run (nada será gravado)');
    console.log('Para aplicar: --executar\n');
    return;
  }

  console.log('\nModo: EXECUTAR');

  // Tudo numa transação só: uma falha no meio deixava metade do primeiro
  // movimento aplicada, sem forma barata de descobrir onde parou — e o segundo
  // movimento grava linha a linha (cada uma com o seu `herdadoDe`), então não
  // há `updateMany` que sirva de âncora.
  await prisma.$transaction([
    ...herdar.map((h) =>
      prisma.teseEnunciado.update({
        where: { id: h.enunciadoId },
        data: {
          veredito: h.veredito,
          publicado: h.publicado,
          herdadoDe: h.herdadoDe,
          vitrinePublica: false,
          julgadoEm: null,
          julgadoPor: null,
          reconferenciaPendente: true,
        },
      })
    ),
    ...marcar.map((m) =>
      prisma.teseEnunciado.update({
        where: { id: m.enunciadoId },
        // `herdadoDe` junto da marca: a fila da folha descarta em silêncio a
        // pendência que não aponta para o enunciado aprovado.
        data: { reconferenciaPendente: true, herdadoDe: m.herdadoDe },
      })
    ),
  ]);

  console.log(`\nHerdados: ${herdar.length} · Marcados: ${marcar.length}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 6: Escrever o teste de integração**

Criar `e2e/heranca-editorial.spec.ts`, no molde do que a Onda 4 usa: banco descartável da Neon, `beforeAll` que cria uma destilação anterior conferida individualmente, publicada e na vitrine, e uma vigente com texto diferente. Roda `persistirDestilacao` e confere:

```typescript
test('texto novo sai da vitrine, fica no acervo e entra na fila', async () => {
  const vigente = await prisma.teseEnunciado.findFirstOrThrow({
    where: { destilacao: { numeroAlvo: 9999, anoAlvo: 2026, atual: true } },
  });

  expect(vigente.veredito).toBe('fiel');
  expect(vigente.publicado).toBe(true);
  expect(vigente.vitrinePublica).toBe(false);
  expect(vigente.julgadoPor).toBeNull();
  expect(vigente.reconferenciaPendente).toBe(true);
});
```

Acrescentar o arquivo à lista do passo **Run isolated database scenarios** em `.github/workflows/test.yml`.

> **Guarda obrigatória no topo do spec.** Este é o único arquivo de `e2e/` que
> fala com o banco fora do navegador, e por isso escapa de
> `e2e/fixtures/database.ts` — aquela função só decide o que vai para
> `webServer.env`, e devolve `TEST_DATABASE_URL` sem olhar para
> `DATABASE_URL`. Neste projeto a `DATABASE_URL` local aponta para PRODUÇÃO.
> O `beforeAll` precisa abortar quando `DATABASE_URL` e `TEST_DATABASE_URL` não
> apontarem para o mesmo banco (mesmo host, mesmo nome), com mensagem dizendo
> por quê — e o `afterAll` precisa desistir da limpeza pelo mesmo teste, para
> que ela não seja a primeira escrita a escapar. A guarda fica NESTE arquivo, e
> não no helper compartilhado: endurecer o helper quebraria a execução local
> dos outros três specs, que nunca tocam `DATABASE_URL`.

- [ ] **Step 7: Verificação e commit**

```bash
npx vitest run
npx tsc --noEmit -p tsconfig.json
git add lib/tcu/backfill-heranca.ts lib/tcu/backfill-heranca.test.ts scripts/backfill-heranca-editorial.ts e2e/heranca-editorial.spec.ts .github/workflows/test.yml
git commit -m "feat(teses): backfill da herança editorial, em dois movimentos"
```

- [ ] **Step 8: Executar o backfill (do usuário)**

Rodar o dry-run e levar o relatório ao usuário. A execução contra produção é dele, depois da revisão. Resultado esperado, pelos números da spec §7: **3 acórdãos** voltam ao acervo restrito e **6** ganham a marca de pendência.

---

## Fora do escopo, por desenho

- **Reconferir as teses.** O plano constrói a fila; enchê-la de vereditos é trabalho editorial do usuário.
- **Divergências (`TeseDivergencia`).** Não têm coluna de pendência e não são publicadas como as teses. O nível 2 fica desligado para elas, explicitamente (Task 2, Step 5).
- **Mudar o predicado de elegibilidade.** A spec é explícita: o que muda é o que chega até ele.
- **Impedir a redestilação de quem já foi conferido.** Era a terceira alternativa considerada e foi descartada: ela congelaria a base justamente nos acórdãos mais citados.
