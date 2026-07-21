# Persistência das teses do TCU — Onda A-W1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persistir as teses destiladas dos leading cases do TCU em versões, com o veredito editorial do Daniel colado ao texto exato que ele julgou, e um cron que mantém a base catalogada conforme os dossiês crescem.

**Architecture:** Três tabelas aditivas. A unidade versionada é a destilação inteira de um caso, não a tese individual — o que elimina o problema de identidade entre versões. Um núcleo puro decide o que é elegível e qual veredito se carrega adiante; um núcleo com banco persiste versões; um cron diário consome os dois. O motor de destilação existente não é tocado.

**Tech Stack:** Prisma 7 / Neon, TypeScript, Next.js route handlers (cron), Vitest, tsx.

**Spec:** `docs/superpowers/specs/2026-07-21-persistencia-teses-tcu-design.md`

## Global Constraints

- **Categoria de tese versionada:** a unidade é `TeseDestilacao` (o conjunto de teses de um caso numa data). Nunca versionar `TeseEnunciado` isoladamente.
- **Carregamento de veredito por igualdade EXATA de texto.** Proibido normalizar espaços, pontuação, acentuação ou caixa; proibido usar LLM para parear. Enunciado diferente = sem veredito.
- **O motor não muda.** Nenhuma tarefa altera `lib/tcu/destilar-tese.ts` — nem prompt, nem modelo, nem parâmetros. Ele foi calibrado e aprovado pelo Daniel em 20/07.
- **Esta onda NÃO dispara destilação em massa.** Só o cron, com lote de 5. O backfill dos 126 casos é a onda A-W2.
- **Parâmetros de LLM:** task `enhancement`, `maxTokens: 4096`, `jsonMode: true`, **sem passar `temperature`** (o modelo a depreciou; passá-la retorna HTTP 400).
- **Schema:** o repositório usa `prisma db push` (ver `vercel-build` no `package.json`), **não** migrations. Alterar `prisma/schema.prisma` e rodar `npx prisma db push`.
- **Crons:** `verifyCronAuth(request)` no topo do `GET`; lógica dentro de `withCronTelemetry('<nome>', async () => ({ itemsFound, itemsNew, itemsError, metadata }))`; `export const maxDuration = 300` com orçamento de tempo interno abaixo disso.
- **Elegibilidade:** nunca destilado → `citantesNoVoto >= 5`. Já destilado → `citantesNoVoto >= 1.5 × dossieNoVoto` da versão atual **e** versão atual com mais de 7 dias.
- **Testes:** `npx vitest run <arquivo>`. Testes de lógica pura não tocam banco nem rede.
- **Scripts:** `npx dotenv-cli -e .env.local -- npx tsx <script>`.
- **Commits** em português, sem acentos no assunto, padrão `feat(tcu):` / `fix(tcu):` / `test(tcu):`.

---

### Task 1: Schema das três tabelas

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: models `TeseDestilacao`, `TeseEnunciado`, `TeseDivergencia`, consumidos pelas Tasks 3 e 4.

- [ ] **Step 1: Acrescentar os models ao final do schema**

```prisma
/// Uma rodada de destilação de um leading case do TCU. É a unidade versionada:
/// as teses de um acórdão NESTA data, geradas por ESTE dossiê. Versionar o
/// conjunto (e não cada tese) elimina o problema de identidade entre versões —
/// o motor pode reordenar, fundir ou dividir teses entre uma rodada e outra.
model TeseDestilacao {
  id            String   @id @default(cuid())
  numeroAlvo    Int
  anoAlvo       Int
  chave         String
  assunto       String   @db.Text
  confianca     String
  versaoMotor   Int
  /// Retrato do dossiê que gerou esta versão. Sem ele não há como saber depois
  /// se o dossiê cresceu o bastante para justificar redestilar.
  dossieTrechos Int
  dossieNoVoto  Int
  sinais        Json?
  atual         Boolean  @default(true)
  criadoEm      DateTime @default(now())

  enunciados   TeseEnunciado[]
  divergencias TeseDivergencia[]

  @@index([numeroAlvo, anoAlvo, atual])
  @@index([chave])
}

/// Uma tese dentro de uma destilação. O veredito do Daniel vive aqui, colado
/// ao texto exato que ele leu.
model TeseEnunciado {
  id           String    @id @default(cuid())
  destilacaoId String
  destilacao   TeseDestilacao @relation(fields: [destilacaoId], references: [id], onDelete: Cascade)
  ordem        Int
  enunciado    String    @db.Text
  inovacao     String    @db.Text
  trechosFonte Json
  veredito     String?
  julgadoEm    DateTime?
  julgadoPor   String?
  /// Id do enunciado da versão anterior de onde o veredito foi herdado por
  /// texto idêntico. Null = julgado diretamente nesta versão.
  herdadoDe    String?

  @@index([destilacaoId])
  @@index([veredito])
}

/// Uma divergência apontada nos votos: outro precedente indicado como o de
/// referência para o mesmo assunto.
model TeseDivergencia {
  id                 String    @id @default(cuid())
  destilacaoId       String
  destilacao         TeseDestilacao @relation(fields: [destilacaoId], references: [id], onDelete: Cascade)
  origemChave        String
  precedenteApontado String
  trecho             String    @db.Text
  natureza           String
  veredito           String?
  julgadoEm          DateTime?
  julgadoPor         String?
  herdadoDe          String?

  @@index([destilacaoId])
}
```

- [ ] **Step 2: Aplicar e gerar o client**

Run: `npx dotenv-cli -e .env.local -- npx prisma db push && npx prisma generate`
Expected: `Your database is now in sync with your Prisma schema.` e `Generated Prisma Client`.

Se der erro de engine, matar processos Node e repetir `npx prisma generate` (ver `docs/TROUBLESHOOTING.md`).

- [ ] **Step 3: Confirmar que as três tabelas existem**

Run:
```bash
npx dotenv-cli -e .env.local -- npx tsx -e "import {prisma} from './lib/prisma'; Promise.all([prisma.teseDestilacao.count(), prisma.teseEnunciado.count(), prisma.teseDivergencia.count()]).then(([d,e,v])=>{console.log('destilacoes',d,'enunciados',e,'divergencias',v); return prisma.\$disconnect()})"
```
Expected: `destilacoes 0 enunciados 0 divergencias 0`

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(tcu): schema de teses destiladas versionadas"
```

---

### Task 2: `carregarVeredito` — o núcleo puro

A regra editorial mais delicada da onda, isolada para ser testável sem banco.

**Files:**
- Create: `lib/tcu/carregar-veredito.ts`
- Test: `lib/tcu/carregar-veredito.test.ts`

**Interfaces:**
- Produces:
  - `export interface EnunciadoJulgavel { id: string; enunciado: string; veredito: string | null }`
  - `export interface VeredictoHerdado { veredito: string | null; herdadoDe: string | null; julgadoEm: Date | null; julgadoPor: string | null }`
  - `export function carregarVeredito(enunciadoNovo: string, anteriores: Array<EnunciadoJulgavel & { julgadoEm: Date | null; julgadoPor: string | null }>): VeredictoHerdado`

- [ ] **Step 1: Escrever os testes que falham**

```typescript
import { describe, it, expect } from 'vitest';
import { carregarVeredito } from './carregar-veredito';

const em = new Date('2026-07-20T12:00:00Z');
const anterior = (enunciado: string, veredito: string | null, id = 'a1') => ({
  id, enunciado, veredito, julgadoEm: veredito ? em : null, julgadoPor: veredito ? 'daniel' : null,
});

describe('carregarVeredito', () => {
  it('herda o veredito quando o texto e IDENTICO', () => {
    const r = carregarVeredito('A prescricao e de dez anos.', [anterior('A prescricao e de dez anos.', 'fiel')]);
    expect(r).toEqual({ veredito: 'fiel', herdadoDe: 'a1', julgadoEm: em, julgadoPor: 'daniel' });
  });

  it('NAO herda quando muda a pontuacao — redacao diferente e julgamento novo', () => {
    const r = carregarVeredito('A prescricao e de dez anos', [anterior('A prescricao e de dez anos.', 'fiel')]);
    expect(r.veredito).toBeNull();
    expect(r.herdadoDe).toBeNull();
  });

  it('NAO herda quando muda so o espacamento', () => {
    const r = carregarVeredito('A  prescricao e de dez anos.', [anterior('A prescricao e de dez anos.', 'fiel')]);
    expect(r.veredito).toBeNull();
  });

  it('NAO herda quando muda so a caixa', () => {
    const r = carregarVeredito('a prescricao e de dez anos.', [anterior('A prescricao e de dez anos.', 'fiel')]);
    expect(r.veredito).toBeNull();
  });

  it('herda veredito negativo tambem', () => {
    const r = carregarVeredito('Tese ruim.', [anterior('Tese ruim.', 'errada')]);
    expect(r.veredito).toBe('errada');
  });

  it('nao herda de um anterior que nunca foi julgado', () => {
    const r = carregarVeredito('Tese X.', [anterior('Tese X.', null)]);
    expect(r).toEqual({ veredito: null, herdadoDe: null, julgadoEm: null, julgadoPor: null });
  });

  it('acha o par correto entre varios anteriores', () => {
    const r = carregarVeredito('Segunda tese.', [
      anterior('Primeira tese.', 'fiel', 'a1'),
      anterior('Segunda tese.', 'imprecisa', 'a2'),
    ]);
    expect(r).toMatchObject({ veredito: 'imprecisa', herdadoDe: 'a2' });
  });

  it('sem anteriores, nasce sem veredito', () => {
    expect(carregarVeredito('Tese nova.', []).veredito).toBeNull();
  });

  it('com anteriores duplicados julgados, usa o primeiro', () => {
    const r = carregarVeredito('Tese.', [anterior('Tese.', 'fiel', 'a1'), anterior('Tese.', 'errada', 'a2')]);
    expect(r.herdadoDe).toBe('a1');
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx vitest run lib/tcu/carregar-veredito.test.ts`
Expected: FAIL — `Failed to resolve import "./carregar-veredito"`.

- [ ] **Step 3: Implementar**

```typescript
/**
 * Decide se o veredito editorial de uma versão anterior acompanha um enunciado
 * para a versão nova (spec §2.3).
 *
 * A comparação é de igualdade EXATA de texto — sem normalizar espaços,
 * pontuação, acentuação ou caixa, e sem modelo. Normalizar seria decidir que
 * duas redações diferentes são a mesma tese, e esse julgamento é do Daniel,
 * não nosso. O custo assumido é que uma vírgula alterada devolve o enunciado
 * à fila; o erro inverso — carregar uma aprovação para um texto que ele não
 * leu — é inaceitável, porque a tese leva a assinatura dele.
 */

export interface EnunciadoJulgavel {
  id: string;
  enunciado: string;
  veredito: string | null;
}

export interface VeredictoHerdado {
  veredito: string | null;
  herdadoDe: string | null;
  julgadoEm: Date | null;
  julgadoPor: string | null;
}

const SEM_VEREDITO: VeredictoHerdado = {
  veredito: null,
  herdadoDe: null,
  julgadoEm: null,
  julgadoPor: null,
};

export function carregarVeredito(
  enunciadoNovo: string,
  anteriores: Array<EnunciadoJulgavel & { julgadoEm: Date | null; julgadoPor: string | null }>
): VeredictoHerdado {
  const par = anteriores.find((a) => a.veredito !== null && a.enunciado === enunciadoNovo);
  if (!par) return { ...SEM_VEREDITO };
  return {
    veredito: par.veredito,
    herdadoDe: par.id,
    julgadoEm: par.julgadoEm,
    julgadoPor: par.julgadoPor,
  };
}
```

- [ ] **Step 4: Rodar para ver passar**

Run: `npx vitest run lib/tcu/carregar-veredito.test.ts`
Expected: PASS — 9 testes.

- [ ] **Step 5: Commit**

```bash
git add lib/tcu/carregar-veredito.ts lib/tcu/carregar-veredito.test.ts
git commit -m "feat(tcu): carregamento de veredito por texto identico entre versoes"
```

---

### Task 3: Elegibilidade e persistência

**Files:**
- Create: `lib/tcu/persistir-tese.ts`
- Test: `lib/tcu/persistir-tese.test.ts`

**Interfaces:**
- Consumes: `carregarVeredito` (Task 2); models da Task 1; `TeseDestilada` de `lib/tcu/destilar-tese` (campos: `chave`, `assunto`, `teses: Array<{enunciado, inovacao, trechosFonte}>`, `sinaisQualitativos`, `divergencias: Array<{origemChave, precedenteApontado, trecho, natureza}>`, `confianca`); `DossieUso` de `lib/tcu/trechos-de-citacao` (campos: `alvo`, `contagem: {citantesDistintos, noVoto, ocorrenciasTotal}`, `trechos`).
- Produces:
  - `export const MIN_NO_VOTO = 5`, `export const FATOR_CRESCIMENTO = 1.5`, `export const DIAS_MINIMOS = 7`, `export const VERSAO_MOTOR = 1`
  - `export interface Candidato { numero: number; ano: number; chave: string; noVoto: number }`
  - `export function ehElegivel(noVotoAtual: number, versaoAtual: { dossieNoVoto: number; criadoEm: Date } | null, agora: Date): boolean`
  - `export async function selecionarElegiveis(limite: number): Promise<Candidato[]>`
  - `export async function persistirDestilacao(alvo: {numero: number; ano: number}, tese: TeseDestilada, dossie: DossieUso): Promise<{ destilacaoId: string; herdados: number; novos: number }>`

- [ ] **Step 1: Escrever os testes da regra de elegibilidade**

Testes puros — `ehElegivel` não toca banco.

```typescript
import { describe, it, expect } from 'vitest';
import { ehElegivel, MIN_NO_VOTO, FATOR_CRESCIMENTO, DIAS_MINIMOS } from './persistir-tese';

const agora = new Date('2026-07-21T12:00:00Z');
const diasAtras = (n: number) => new Date(agora.getTime() - n * 24 * 60 * 60 * 1000);

describe('ehElegivel — nunca destilado', () => {
  it('entra na fila com 5 citantes no voto', () => expect(ehElegivel(5, null, agora)).toBe(true));
  it('entra com mais de 5', () => expect(ehElegivel(40, null, agora)).toBe(true));
  it('NAO entra com 4 — abaixo do limiar em que o motor produz tese', () =>
    expect(ehElegivel(4, null, agora)).toBe(false));
  it('NAO entra com zero', () => expect(ehElegivel(0, null, agora)).toBe(false));
});

describe('ehElegivel — ja destilado', () => {
  it('redestila quando cresceu 50% e passaram mais de 7 dias', () =>
    expect(ehElegivel(15, { dossieNoVoto: 10, criadoEm: diasAtras(8) }, agora)).toBe(true));

  it('NAO redestila quando cresceu pouco, mesmo com muito tempo', () =>
    expect(ehElegivel(14, { dossieNoVoto: 10, criadoEm: diasAtras(90) }, agora)).toBe(false));

  it('NAO redestila quando cresceu muito mas e recente — evita cascata durante a campanha', () =>
    expect(ehElegivel(100, { dossieNoVoto: 10, criadoEm: diasAtras(1) }, agora)).toBe(false));

  it('NAO redestila exatamente em 7 dias (exige MAIS de 7)', () =>
    expect(ehElegivel(20, { dossieNoVoto: 10, criadoEm: diasAtras(7) }, agora)).toBe(false));

  it('NAO redestila se o dossie encolheu', () =>
    expect(ehElegivel(5, { dossieNoVoto: 40, criadoEm: diasAtras(30) }, agora)).toBe(false));
});

describe('constantes travadas pela spec', () => {
  it('os tres limiares sao os da spec', () => {
    expect(MIN_NO_VOTO).toBe(5);
    expect(FATOR_CRESCIMENTO).toBe(1.5);
    expect(DIAS_MINIMOS).toBe(7);
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx vitest run lib/tcu/persistir-tese.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar o módulo**

```typescript
/**
 * Persistência das teses destiladas (spec 2026-07-21). Núcleo único,
 * compartilhado entre o cron diário e o backfill da onda A-W2, para as duas
 * rotas não divergirem.
 *
 * A unidade versionada é a destilação INTEIRA de um caso, nunca a tese
 * individual: o motor pode reordenar, fundir ou dividir teses entre rodadas,
 * então "a tese 2 do acórdão" não é uma identidade estável. O que existe é
 * "este enunciado, nesta versão".
 */
import { prisma } from '../prisma';
import { carregarVeredito } from './carregar-veredito';
import type { TeseDestilada } from './destilar-tese';
import type { DossieUso } from './trechos-de-citacao';

/** Faixa medida em que o motor produz tese em vez de se calar. */
export const MIN_NO_VOTO = 5;
/** Evita redestilar por ruído de crescimento. */
export const FATOR_CRESCIMENTO = 1.5;
/** Evita cascata de redestilação enquanto a campanha da frente C1 ingere. */
export const DIAS_MINIMOS = 7;
/** Sobe quando prompt ou modelo do motor mudarem, forçando redestilação. */
export const VERSAO_MOTOR = 1;

export interface Candidato {
  numero: number;
  ano: number;
  chave: string;
  noVoto: number;
}

export function ehElegivel(
  noVotoAtual: number,
  versaoAtual: { dossieNoVoto: number; criadoEm: Date } | null,
  agora: Date
): boolean {
  if (versaoAtual === null) return noVotoAtual >= MIN_NO_VOTO;
  const cresceu = noVotoAtual >= versaoAtual.dossieNoVoto * FATOR_CRESCIMENTO;
  const dias = (agora.getTime() - versaoAtual.criadoEm.getTime()) / (24 * 60 * 60 * 1000);
  return cresceu && dias > DIAS_MINIMOS;
}

/**
 * Candidatos à destilação. A contagem de citantes-no-voto vem do grafo
 * (`AcordaoCitacao`), que é a fonte da verdade da Fase 1.
 */
export async function selecionarElegiveis(limite: number): Promise<Candidato[]> {
  const agora = new Date();

  const alvos = await prisma.$queryRaw<Array<{ numero: number; ano: number; no_voto: number }>>`
    SELECT "numeroAlvo" AS numero, "anoAlvo" AS ano,
           count(DISTINCT "origemId") FILTER (WHERE "noVoto")::int AS no_voto
    FROM "AcordaoCitacao"
    GROUP BY 1, 2
    HAVING count(DISTINCT "origemId") FILTER (WHERE "noVoto") >= ${MIN_NO_VOTO}
    ORDER BY no_voto DESC`;

  const atuais = await prisma.teseDestilacao.findMany({
    where: { atual: true },
    select: { numeroAlvo: true, anoAlvo: true, dossieNoVoto: true, criadoEm: true, versaoMotor: true },
  });
  const porChave = new Map(atuais.map((a) => [`${a.numeroAlvo}/${a.anoAlvo}`, a]));

  const out: Candidato[] = [];
  for (const alvo of alvos) {
    if (out.length >= limite) break;
    const chave = `${alvo.numero}/${alvo.ano}`;
    const atual = porChave.get(chave) ?? null;
    // Versão de motor antiga força redestilação, independente do crescimento.
    const motorDesatualizado = atual !== null && atual.versaoMotor < VERSAO_MOTOR;
    if (motorDesatualizado || ehElegivel(alvo.no_voto, atual, agora)) {
      out.push({ numero: alvo.numero, ano: alvo.ano, chave, noVoto: alvo.no_voto });
    }
  }
  return out;
}

/**
 * Grava uma versão nova e desmarca a anterior, numa transação — duas versões
 * com `atual: true` para o mesmo caso quebrariam a exibição.
 */
export async function persistirDestilacao(
  alvo: { numero: number; ano: number },
  tese: TeseDestilada,
  dossie: DossieUso
): Promise<{ destilacaoId: string; herdados: number; novos: number }> {
  const chave = `${alvo.numero}/${alvo.ano}`;

  const anterior = await prisma.teseDestilacao.findFirst({
    where: { numeroAlvo: alvo.numero, anoAlvo: alvo.ano, atual: true },
    include: {
      enunciados: { select: { id: true, enunciado: true, veredito: true, julgadoEm: true, julgadoPor: true } },
      divergencias: { select: { id: true, trecho: true, veredito: true, julgadoEm: true, julgadoPor: true } },
    },
  });

  const anterioresEnunciados = anterior?.enunciados ?? [];
  const anterioresDivergencias = (anterior?.divergencias ?? []).map((d) => ({
    id: d.id,
    enunciado: d.trecho, // a divergência é pareada pelo trecho de apoio
    veredito: d.veredito,
    julgadoEm: d.julgadoEm,
    julgadoPor: d.julgadoPor,
  }));

  let herdados = 0;
  const enunciados = (tese.teses ?? []).map((t, i) => {
    const h = carregarVeredito(t.enunciado, anterioresEnunciados);
    if (h.veredito !== null) herdados++;
    return {
      ordem: i,
      enunciado: t.enunciado,
      inovacao: t.inovacao,
      trechosFonte: t.trechosFonte as unknown as object,
      ...h,
    };
  });

  const divergencias = (tese.divergencias ?? []).map((d) => {
    const h = carregarVeredito(d.trecho, anterioresDivergencias);
    if (h.veredito !== null) herdados++;
    return {
      origemChave: d.origemChave,
      precedenteApontado: d.precedenteApontado,
      trecho: d.trecho,
      natureza: d.natureza,
      ...h,
    };
  });

  const criada = await prisma.$transaction(async (tx) => {
    if (anterior) {
      await tx.teseDestilacao.update({ where: { id: anterior.id }, data: { atual: false } });
    }
    return tx.teseDestilacao.create({
      data: {
        numeroAlvo: alvo.numero,
        anoAlvo: alvo.ano,
        chave,
        assunto: tese.assunto ?? '',
        confianca: tese.confianca ?? 'baixa',
        versaoMotor: VERSAO_MOTOR,
        dossieTrechos: dossie.trechos.length,
        dossieNoVoto: dossie.contagem.noVoto,
        sinais: (tese.sinaisQualitativos ?? []) as unknown as object,
        atual: true,
        enunciados: { create: enunciados },
        divergencias: { create: divergencias },
      },
    });
  });

  return {
    destilacaoId: criada.id,
    herdados,
    novos: enunciados.length + divergencias.length - herdados,
  };
}
```

- [ ] **Step 4: Rodar para ver passar**

Run: `npx vitest run lib/tcu/persistir-tese.test.ts`
Expected: PASS — 11 testes.

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -v "__tests__" | head -20`
Expected: nenhum erro apontando para `lib/tcu/persistir-tese.ts` ou `lib/tcu/carregar-veredito.ts`. O projeto tem 8 erros pré-existentes em `lib/jurisprudencia/__tests__/*.test.ts` — filtrados pelo `grep`, não os corrija.

- [ ] **Step 6: Provar o invariante contra o banco real, uma vez**

O invariante de §7.3 da spec (no máximo uma versão `atual` por caso) é o que a transação existe para garantir. Provar com dado real:

```bash
npx dotenv-cli -e .env.local -- npx tsx -e "
import {prisma} from './lib/prisma';
import {persistirDestilacao} from './lib/tcu/persistir-tese';
const alvo={numero:999999,ano:1999};
const dossie:any={alvo,contagem:{citantesDistintos:9,noVoto:9,ocorrenciasTotal:9},trechos:[{trecho:'t'}]};
const tese:any={chave:'999999/1999',assunto:'teste',confianca:'alta',sinaisQualitativos:[],divergencias:[],
  teses:[{enunciado:'Enunciado estavel.',inovacao:'i',trechosFonte:[0]},{enunciado:'Enunciado que vai mudar.',inovacao:'i',trechosFonte:[0]}]};
(async()=>{
  const v1=await persistirDestilacao(alvo,tese,dossie);
  await prisma.teseEnunciado.updateMany({where:{destilacaoId:v1.destilacaoId},data:{veredito:'fiel',julgadoPor:'teste',julgadoEm:new Date()}});
  const tese2={...tese,teses:[tese.teses[0],{...tese.teses[1],enunciado:'Enunciado que MUDOU.'}]};
  const v2=await persistirDestilacao(alvo,tese2,dossie);
  const atuais=await prisma.teseDestilacao.count({where:{numeroAlvo:999999,anoAlvo:1999,atual:true}});
  const enun=await prisma.teseEnunciado.findMany({where:{destilacaoId:v2.destilacaoId},orderBy:{ordem:'asc'},select:{enunciado:true,veredito:true,herdadoDe:true}});
  console.log('versoes atuais (tem que ser 1):',atuais);
  console.log('herdados na v2 (tem que ser 1):',v2.herdados);
  console.table(enun);
  await prisma.teseDestilacao.deleteMany({where:{numeroAlvo:999999,anoAlvo:1999}});
  console.log('limpo');
  await prisma.\$disconnect();
})()"
```
Expected: `versoes atuais (tem que ser 1): 1`; `herdados na v2 (tem que ser 1): 1`; na tabela, o enunciado inalterado com `veredito: 'fiel'` e `herdadoDe` preenchido, e o alterado com `veredito: null`. Termina com `limpo` — **os dados de teste têm que ser apagados**, o número 999999/1999 é fictício e não pode ficar no banco.

- [ ] **Step 7: Commit**

```bash
git add lib/tcu/persistir-tese.ts lib/tcu/persistir-tese.test.ts
git commit -m "feat(tcu): elegibilidade e persistencia versionada das teses"
```

---

### Task 4: Cron `destilar-teses-tcu`

**Files:**
- Create: `app/api/cron/destilar-teses-tcu/route.ts`
- Modify: `vercel.json`

**Interfaces:**
- Consumes: `selecionarElegiveis`, `persistirDestilacao` (Task 3); `coletarTrechosDoAlvo` de `lib/tcu/trechos-de-citacao`; `montarPromptTese`, `parseRespostaTese` de `lib/tcu/destilar-tese`; `buscarAcordaoPorNumero`, `escolherCandidato` de `lib/tcu/buscar-acordao-tcu`; `generate` de `lib/ai`.

- [ ] **Step 1: Escrever a rota**

```typescript
/**
 * Destila e persiste a tese dos leading cases que cruzaram o limiar, para a
 * base não crescer descatalogada conforme a campanha de ingestão engorda os
 * dossiês (spec 2026-07-21 §4.3).
 *
 * Lote pequeno de propósito: cada destilação é uma chamada de LLM, e o
 * comportamento em regime ainda não foi observado.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyCronAuth } from '@/lib/cron-auth';
import { withCronTelemetry } from '@/lib/cron-telemetry';
import { selecionarElegiveis, persistirDestilacao } from '@/lib/tcu/persistir-tese';
import { coletarTrechosDoAlvo } from '@/lib/tcu/trechos-de-citacao';
import { montarPromptTese, parseRespostaTese } from '@/lib/tcu/destilar-tese';
import { buscarAcordaoPorNumero, escolherCandidato } from '@/lib/tcu/buscar-acordao-tcu';
import { generate } from '@/lib/ai';

export const maxDuration = 300;

const LOTE = 5;
const TIME_BUDGET_MS = 240_000;
const dorme = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  let corpo: Record<string, unknown> = {};

  await withCronTelemetry('destilar-teses-tcu', async () => {
    const inicio = Date.now();
    const candidatos = await selecionarElegiveis(LOTE);

    let ok = 0, semTese = 0, erros = 0, herdadosTotal = 0;
    const processados: string[] = [];

    for (const c of candidatos) {
      if (Date.now() - inicio > TIME_BUDGET_MS) break;
      try {
        const dossie = await coletarTrechosDoAlvo({ numero: c.numero, ano: c.ano });

        const cands = await buscarAcordaoPorNumero(c.numero, c.ano);
        await dorme(1000); // rate limit de 1 req/s contra o TCU
        const proprio = escolherCandidato(cands);

        const { systemPrompt, userContent } = montarPromptTese({
          chave: c.chave,
          ementaPropria: proprio?.ementa ?? null,
          colegiado: proprio?.colegiado ?? null,
          relator: proprio?.relator ?? null,
          dossie,
        });

        // Sem `temperature`: o modelo de `enhancement` a depreciou (HTTP 400).
        const { text } = await generate('enhancement', {
          systemPrompt,
          messages: [{ role: 'user', content: userContent }],
          maxTokens: 4096,
          jsonMode: true,
        });

        const tese = parseRespostaTese(c.chave, text);
        const r = await persistirDestilacao({ numero: c.numero, ano: c.ano }, tese, dossie);
        herdadosTotal += r.herdados;
        processados.push(c.chave);
        if ((tese.teses ?? []).length === 0) semTese++;
        else ok++;
      } catch (e) {
        // Um caso que falha não pode derrubar o lote.
        erros++;
        console.error(`[destilar-teses-tcu] ${c.chave}:`, (e as Error).message);
      }
    }

    const restam = await prisma.teseDestilacao.count({ where: { atual: true } });
    corpo = { candidatos: candidatos.length, ok, semTese, erros, herdadosTotal, processados, totalComTeseAtual: restam };

    return {
      itemsFound: candidatos.length,
      itemsNew: ok,
      itemsError: erros,
      metadata: { semTese, herdadosTotal, totalComTeseAtual: restam },
    };
  });

  return NextResponse.json(corpo);
}
```

⚠️ `semTese` conta os casos em que o motor se calou (`teses: []`). Isso é o comportamento conservador correto, **não** um erro — por isso não entra em `itemsError`, que dispararia alerta de cron com falha.

- [ ] **Step 2: Registrar no `vercel.json`**

Acrescentar ao array `crons`, mantendo o formato dos vizinhos. Às 7h15, depois do cron de precedentes das 6h45, para que o grafo do dia já esteja atualizado:

```json
    {
      "path": "/api/cron/destilar-teses-tcu",
      "schedule": "15 7 * * *"
    },
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -v "__tests__" | head -20`
Expected: nenhum erro apontando para `app/api/cron/destilar-teses-tcu/route.ts`.

- [ ] **Step 4: Rodar a suíte inteira**

Run: `npx vitest run 2>&1 | tail -10`
Expected: verde. A referência ao fim da onda W1 da frente C1 era 167 arquivos e 2.382 testes; agora devem ser mais, com os arquivos novos das Tasks 2 e 3.

- [ ] **Step 5: Commit**

```bash
git add app/api/cron/destilar-teses-tcu/route.ts vercel.json
git commit -m "feat(tcu): cron diario de destilacao de teses (lote de 5)"
```

---

### Task 5: Build e PR

- [ ] **Step 1: Build de produção**

Run: `npm run build`
Expected: exit 0, `Compiled successfully`.

- [ ] **Step 2: Abrir o PR**

```bash
git push -u origin feat/persistencia-teses-tcu
```

Título: "Persistencia das teses do TCU — onda A-W1". No corpo: as três tabelas; a decisão de versionar o conjunto e não a tese; o carregamento de veredito por texto idêntico e por que sem normalização; o fato de **a onda terminar sem teses no banco de propósito**; e que o disparo em massa dos 126 casos é a onda A-W2.

---

## Notas de execução

- **O motor não muda.** Se a destilação parecer ruim durante os testes, isso é achado para a A-W2, não bug a corrigir aqui. O prompt e os parâmetros foram calibrados e aprovados.
- **Nenhuma tarefa dispara backfill.** O cron processa no máximo 5 por dia. Se alguém quiser ver os 126 casos destilados, isso é a próxima onda — fazer agora devolve à fila do Daniel enunciados que ele acabou de aprovar.
- **A comparação de enunciado é exata e assim deve permanecer.** Se um review sugerir normalizar espaços ou pontuação "para reduzir retrabalho", isso contradiz a spec §2.3 — leve ao Daniel em vez de aplicar.
- **Dados de teste com o número fictício 999999/1999 têm que ser apagados** ao fim do Step 6 da Task 3. Um acórdão inexistente no banco polui o grafo e as contagens.
