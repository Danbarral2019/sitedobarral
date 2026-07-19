# Rede de Precedentes do TCU — Fase 1 (Grafo persistido) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persistir a rede de citações entre acórdãos do TCU numa tabela de arestas, cobrindo o passivo (backfill) e as futuras inclusões (cron), e expor a wishlist dos leading cases ausentes mais citados.

**Architecture:** Uma tabela relacional `AcordaoCitacao` (aresta origem→alvo, alvo por número/ano). Um módulo puro extrai as arestas do inteiro teor já guardado (reaproveita o extrator da Fase 0); uma função de I/O persiste idempotentemente. O núcleo `catalogarAcordao` NÃO é tocado — o passivo entra por um backfill e os novos por um cron de varredura dedicado, ambos guardados por uma coluna `precedentesVersao`.

**Tech Stack:** TypeScript, `tsx`, Vitest 4, Prisma 7 (PrismaNeon), Postgres/Neon, Next.js route handler (cron).

## Global Constraints

- **Aditivo e reversível:** só adiciona uma tabela (`AcordaoCitacao`) e uma coluna (`Document.precedentesVersao`). Não altera nenhum campo/tabela existente. `db push` é o padrão do projeto (não há migrations versionadas). Reverter = `DROP TABLE`/`DELETE`.
- **Não tocar `lib/tcu/catalogar-acordao.ts`** (núcleo em produção). A extração de arestas vive em módulo próprio, chamada por backfill e cron.
- **Extração determinística, sem LLM, sem rede** — lê o `tcuTextoCompleto` já guardado (molde de `reanalyze-tcu.ts`).
- **Fluxo contínuo obrigatório** ([[feedback-fluxo-continuo-passivo-e-novos]]): passivo (backfill) + futuras inclusões (cron), ambos via a MESMA função `persistirArestasDeAcordao`. A coluna `precedentesVersao` (constante `PRECEDENTES_VERSAO`) marca o que já foi processado; subir a versão reprocessa.
- **Autoridade conta acórdãos distintos**, não ocorrências: uma aresta por par (origem, alvo), com `noVoto` = alguma ocorrência caiu no voto.
- **Idempotência:** persistir = `deleteMany({origemId})` + `createMany` + set `precedentesVersao`, atômico.
- Comentários e commits em português. Testes Vitest co-localizados. Scripts via `npx tsx`.
- Spec: `docs/superpowers/specs/2026-07-18-rede-precedentes-tcu-fase1-grafo-design.md`.

---

### Task 1: Schema — tabela de arestas + coluna de versão

**Files:**
- Modify: `prisma/schema.prisma` (add model `AcordaoCitacao`; add 2 lines to model `Document`)

**Interfaces:**
- Produces: model Prisma `AcordaoCitacao` (acessível como `prisma.acordaoCitacao`); campo `Document.precedentesVersao Int?`.

- [ ] **Step 1: Adicionar o model e a coluna**

No `prisma/schema.prisma`, adicionar o novo model (junto aos demais models de TCU/Document):

```prisma
/// Aresta da rede de precedentes: um acórdão (origem) cita outro (alvo).
/// O alvo é identificado por número/ano — pode não existir como Document
/// (nó externo). Uma linha por par (origem, alvo), deduplicada.
model AcordaoCitacao {
  id            String   @id @default(cuid())
  origemId      String
  origem        Document @relation("CitacoesDeAcordao", fields: [origemId], references: [id], onDelete: Cascade)
  numeroAlvo    Int
  anoAlvo       Int
  colegiadoAlvo String?
  noVoto        Boolean  @default(false)
  ocorrencias   Int      @default(1)
  criadoEm      DateTime @default(now())

  @@unique([origemId, numeroAlvo, anoAlvo])
  @@index([numeroAlvo, anoAlvo])
  @@index([origemId])
}
```

Dentro do model `Document` (existente), adicionar duas linhas — a relação inversa e a coluna de versão:

```prisma
  precedentesVersao  Int?
  citacoesDeAcordao  AcordaoCitacao[] @relation("CitacoesDeAcordao")
```

- [ ] **Step 2: Aplicar no banco e gerar o client**

Run: `npx prisma db push && npx prisma generate`
Expected: "Your database is now in sync with your Prisma schema." e client gerado, sem erro. (Se o engine travar, matar Node e repetir `npx prisma generate` — ver CLAUDE.md.)

- [ ] **Step 3: Smoke — o model responde**

Run:
```bash
npx tsx -e "import {prisma} from './lib/prisma'; (async()=>{const n=await prisma.acordaoCitacao.count(); console.log('AcordaoCitacao count:', n); await prisma.\$disconnect();})()"
```
Expected: `AcordaoCitacao count: 0` (tabela criada, vazia). Sem erro de "table does not exist".

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(tcu): schema AcordaoCitacao + Document.precedentesVersao (rede de precedentes fase 1)"
```

---

### Task 2: Ampliar o extrator para "Acórdão TCU N/AAAA"

**Files:**
- Modify: `lib/tcu/acordao-citation-extractor.ts` (a regex `AC_RE`)
- Modify: `lib/tcu/acordao-citation-extractor.test.ts` (novos casos)

**Interfaces:**
- Consumes/Produces: `extractAcordaoCitations` (assinatura inalterada). Passa a reconhecer o "TCU" (ou "TCU-") entre "Acórdão" e o número.

- [ ] **Step 1: Escrever os testes que falham**

Adicionar ao final do `describe('extractAcordaoCitations', ...)` em `lib/tcu/acordao-citation-extractor.test.ts`:

```ts
  it('reconhece "Acórdão TCU 1234/2020" (TCU antes do número)', () => {
    const [c] = extractAcordaoCitations('conforme o Acórdão TCU 1234/2020, de relatoria...');
    expect(c).toMatchObject({ numero: 1234, ano: 2020 });
  });

  it('reconhece "Acórdão TCU nº 4.851/2017-Plenário"', () => {
    const [c] = extractAcordaoCitations('vide Acórdão TCU nº 4.851/2017-Plenário');
    expect(c).toMatchObject({ numero: 4851, ano: 2017, colegiado: 'Plenário' });
  });

  it('continua reconhecendo "TCU" depois do número (não conta duas vezes)', () => {
    const cs = extractAcordaoCitations('o Acórdão 5.429/2025-TCU-1ª Câmara decidiu');
    expect(cs).toHaveLength(1);
    expect(cs[0]).toMatchObject({ numero: 5429, ano: 2025, colegiado: 'Primeira Câmara' });
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/tcu/acordao-citation-extractor.test.ts`
Expected: FAIL nos 2 primeiros novos casos (o "Acórdão TCU 1234/2020" não casa hoje). O terceiro pode já passar.

- [ ] **Step 3: Ampliar a regex**

Em `lib/tcu/acordao-citation-extractor.ts`, na constante `AC_RE`, inserir um `(?:tcu\s+)?` opcional entre o rótulo "Acórdão" e o "nº?/número". A linha atual:

```ts
const AC_RE = new RegExp(
  '\\b(?:ac[óo]rd[ãa]os?|ac\\.?)\\s+(?:n[.ºo°]*\\s*)?(\\d[\\d.]*)\\s*\\/\\s*(\\d{4})' + COLEG,
  'gi'
);
```

passa a:

```ts
const AC_RE = new RegExp(
  '\\b(?:ac[óo]rd[ãa]os?|ac\\.?)\\s+(?:tcu\\s+)?(?:n[.ºo°]*\\s*)?(\\d[\\d.]*)\\s*\\/\\s*(\\d{4})' + COLEG,
  'gi'
);
```

Não alterar `AC_LISTA_RE` (a cauda de lista não repete o "Acórdão"/"TCU").

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run lib/tcu/acordao-citation-extractor.test.ts`
Expected: PASS (13 testes: os 10 originais + 3 novos). Se algum negativo antigo quebrar, revisar o `(?:tcu\s+)?` — ele é opcional e não deve casar outras palavras.

- [ ] **Step 5: Commit**

```bash
git add lib/tcu/acordao-citation-extractor.ts lib/tcu/acordao-citation-extractor.test.ts
git commit -m "feat(tcu): extrator reconhece \"Acórdão TCU N/AAAA\" (TCU antes do número)"
```

---

### Task 3: Extração → arestas (módulo puro) + persistência (I/O)

**Files:**
- Create: `lib/tcu/extrair-arestas-precedentes.ts`
- Test: `lib/tcu/extrair-arestas-precedentes.test.ts`

**Interfaces:**
- Consumes: `extractAcordaoCitations` (Task 1/2); `seccionarAcordao`, `secaoDe` (`lib/tcu/seccionar-acordao.ts`); `prisma` (`lib/prisma.ts`).
- Produces:
  - `const PRECEDENTES_VERSAO = 1`
  - `interface ArestaPrecedente { numeroAlvo: number; anoAlvo: number; colegiadoAlvo: string | null; noVoto: boolean; ocorrencias: number }`
  - `function arestasDeAcordao(texto: string, self: { numero: number | null; ano: number | null }): ArestaPrecedente[]` (puro)
  - `async function persistirArestasDeAcordao(p: { origemId: string; numeroSelf: number | null; anoSelf: number | null; texto: string }): Promise<number>` (I/O)

- [ ] **Step 1: Escrever os testes do módulo puro**

Criar `lib/tcu/extrair-arestas-precedentes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { arestasDeAcordao } from './extrair-arestas-precedentes';

describe('arestasDeAcordao', () => {
  it('deduplica por par (numeroAlvo, anoAlvo) e conta ocorrências', () => {
    const t = 'cita o Acórdão 100/2015 e depois o Acórdão 100/2015 de novo.';
    const as = arestasDeAcordao(t, { numero: 1, ano: 2020 });
    expect(as).toHaveLength(1);
    expect(as[0]).toMatchObject({ numeroAlvo: 100, anoAlvo: 2015, ocorrencias: 2 });
  });

  it('descarta auto-citação', () => {
    const t = 'este é o Acórdão 500/2021 e cita o Acórdão 900/2019.';
    const as = arestasDeAcordao(t, { numero: 500, ano: 2021 });
    expect(as.map((a) => a.numeroAlvo)).toEqual([900]);
  });

  it('marca noVoto quando a citação cai na seção do voto', () => {
    // RELATÓRIO ... VOTO ... ACÓRDÃO Nº — o marcador de voto em linha própria.
    const t = [
      'RELATÓRIO',
      'a parte alega ofensa ao Acórdão 111/2010.',
      'VOTO',
      'acompanho o Acórdão 222/2011 como razão de decidir.',
      'ACÓRDÃO Nº 9/2022 - TCU - Plenário',
    ].join('\n');
    const as = arestasDeAcordao(t, { numero: 9, ano: 2022 });
    const rel = as.find((a) => a.numeroAlvo === 111);
    const voto = as.find((a) => a.numeroAlvo === 222);
    expect(rel?.noVoto).toBe(false);
    expect(voto?.noVoto).toBe(true);
  });

  it('não quebra quando self é nulo (não filtra por número inexistente)', () => {
    const as = arestasDeAcordao('cita o Acórdão 7/2007.', { numero: null, ano: null });
    expect(as).toHaveLength(1);
    expect(as[0].numeroAlvo).toBe(7);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/tcu/extrair-arestas-precedentes.test.ts`
Expected: FAIL — "Failed to resolve import './extrair-arestas-precedentes'".

- [ ] **Step 3: Implementar o módulo**

Criar `lib/tcu/extrair-arestas-precedentes.ts`:

```ts
/**
 * Converte o inteiro teor de um acórdão nas ARESTAS da rede de precedentes:
 * quem ele cita (por número/ano), em que seção, quantas vezes. Reaproveita o
 * extrator puro da Fase 0 e o seccionamento. Módulo compartilhado pelo backfill
 * (passivo) e pelo cron (futuras inclusões) — a lição do fluxo contínuo.
 *
 * `arestasDeAcordao` é puro (texto → arestas). `persistirArestasDeAcordao` é o
 * ponto de escrita, idempotente por origem.
 */
import { extractAcordaoCitations } from './acordao-citation-extractor';
import { seccionarAcordao, secaoDe } from './seccionar-acordao';
import { prisma } from '../prisma';

/** Sobe quando a extração muda, para o backfill/cron reprocessarem. */
export const PRECEDENTES_VERSAO = 1;

export interface ArestaPrecedente {
  numeroAlvo: number;
  anoAlvo: number;
  colegiadoAlvo: string | null;
  /** Alguma ocorrência desta citação caiu na seção do voto (razão de decidir). */
  noVoto: boolean;
  ocorrencias: number;
}

/**
 * Extrai as arestas (origem → alvo) do texto, deduplicadas por (numeroAlvo,
 * anoAlvo). Descarta auto-citação (alvo == self). Puro: não toca banco.
 */
export function arestasDeAcordao(
  texto: string,
  self: { numero: number | null; ano: number | null }
): ArestaPrecedente[] {
  if (!texto) return [];
  const secoes = seccionarAcordao(texto);
  const porAlvo = new Map<string, ArestaPrecedente>();

  for (const c of extractAcordaoCitations(texto)) {
    // Auto-citação: o próprio acórdão no cabeçalho/dispositivo.
    if (self.numero != null && self.ano != null && c.numero === self.numero && c.ano === self.ano) {
      continue;
    }
    const chave = `${c.numero}/${c.ano}`;
    const noVoto = secaoDe(secoes, c.index) === 'voto';
    const e = porAlvo.get(chave);
    if (e) {
      e.ocorrencias += 1;
      e.noVoto = e.noVoto || noVoto;
      if (e.colegiadoAlvo === null && c.colegiado) e.colegiadoAlvo = c.colegiado;
    } else {
      porAlvo.set(chave, {
        numeroAlvo: c.numero,
        anoAlvo: c.ano,
        colegiadoAlvo: c.colegiado,
        noVoto,
        ocorrencias: 1,
      });
    }
  }
  return [...porAlvo.values()];
}

/**
 * Persiste as arestas de um acórdão, idempotente: apaga as arestas antigas
 * daquela origem, insere as novas e marca `precedentesVersao`. Tudo numa
 * transação — reprocessar é seguro. Retorna o nº de arestas gravadas.
 */
export async function persistirArestasDeAcordao(p: {
  origemId: string;
  numeroSelf: number | null;
  anoSelf: number | null;
  texto: string;
}): Promise<number> {
  const arestas = arestasDeAcordao(p.texto, { numero: p.numeroSelf, ano: p.anoSelf });
  await prisma.$transaction([
    prisma.acordaoCitacao.deleteMany({ where: { origemId: p.origemId } }),
    ...(arestas.length
      ? [prisma.acordaoCitacao.createMany({ data: arestas.map((a) => ({ origemId: p.origemId, ...a })) })]
      : []),
    prisma.document.update({ where: { id: p.origemId }, data: { precedentesVersao: PRECEDENTES_VERSAO } }),
  ]);
  return arestas.length;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run lib/tcu/extrair-arestas-precedentes.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add lib/tcu/extrair-arestas-precedentes.ts lib/tcu/extrair-arestas-precedentes.test.ts
git commit -m "feat(tcu): extração e persistência das arestas de precedentes (puro + idempotente)"
```

---

### Task 4: Backfill do passivo

**Files:**
- Create: `scripts/backfill-precedentes-tcu.ts`

**Interfaces:**
- Consumes: `persistirArestasDeAcordao`, `arestasDeAcordao`, `PRECEDENTES_VERSAO` (Task 3); `prisma`.
- Produces: popula `AcordaoCitacao` para o passivo (docs com `tcuTextoCompleto`). Idempotente. Leitura+escrita, sem rede.

> **Nota:** script de I/O (padrão de `reanalyze-tcu.ts`); a lógica pura já foi testada na Task 3. Verificação = dry-run + execução com `--limit` pequeno, inspecionando as contagens.

- [ ] **Step 1: Escrever o script**

Criar `scripts/backfill-precedentes-tcu.ts`:

```ts
/**
 * Popula a rede de precedentes (AcordaoCitacao) a partir do tcuTextoCompleto
 * JÁ GUARDADO — sem rede. Backfill do passivo; as futuras inclusões entram
 * pelo cron sync-precedentes-tcu. Idempotente (persistir apaga+reinsere por
 * origem e marca precedentesVersao). Pula quem já está na versão corrente.
 *
 * Uso: npx tsx scripts/backfill-precedentes-tcu.ts               # dry-run
 *      npx tsx scripts/backfill-precedentes-tcu.ts --execute
 *      npx tsx scripts/backfill-precedentes-tcu.ts --execute --limit=50
 *      npx tsx scripts/backfill-precedentes-tcu.ts --execute --force
 *
 * Ref.: docs/superpowers/specs/2026-07-18-rede-precedentes-tcu-fase1-grafo-design.md
 */
import { prisma } from '../lib/prisma';
import {
  arestasDeAcordao,
  persistirArestasDeAcordao,
  PRECEDENTES_VERSAO,
} from '../lib/tcu/extrair-arestas-precedentes';

const EXECUTE = process.argv.includes('--execute');
const FORCE = process.argv.includes('--force');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;

async function main() {
  console.log(EXECUTE ? '🔴 EXECUÇÃO\n' : '🔵 DRY-RUN — nada será gravado (use --execute)\n');

  const docs = await prisma.document.findMany({
    where: {
      category: 'acordao',
      tcuTextoCompleto: { not: null },
      ...(FORCE ? {} : { OR: [{ precedentesVersao: null }, { precedentesVersao: { lt: PRECEDENTES_VERSAO } }] }),
    },
    select: { id: true, title: true, acordaoNumero: true, acordaoAno: true, tcuTextoCompleto: true },
    orderBy: { id: 'asc' },
    ...(LIMIT ? { take: LIMIT } : {}),
  });
  console.log(`Acórdãos a processar: ${docs.length}\n`);

  let comArestas = 0, semArestas = 0, totalArestas = 0;
  for (let i = 0; i < docs.length; i++) {
    const d = docs[i];
    const texto = d.tcuTextoCompleto ?? '';
    if (EXECUTE) {
      const n = await persistirArestasDeAcordao({
        origemId: d.id,
        numeroSelf: d.acordaoNumero,
        anoSelf: d.acordaoAno,
        texto,
      });
      totalArestas += n;
      if (n > 0) comArestas++; else semArestas++;
    } else {
      const n = arestasDeAcordao(texto, { numero: d.acordaoNumero, ano: d.acordaoAno }).length;
      totalArestas += n;
      if (n > 0) comArestas++; else semArestas++;
    }
    if (i < 5 || i % 200 === 0) {
      const n = EXECUTE ? '' : ' (dry-run)';
      console.log(`  [${i + 1}/${docs.length}] ${d.title.slice(0, 44).padEnd(46)} arestas até aqui: ${totalArestas}${n}`);
    }
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Documentos: ${docs.length} · com arestas: ${comArestas} · sem arestas: ${semArestas}`);
  console.log(`Total de arestas: ${totalArestas} (média ${(totalArestas / (docs.length || 1)).toFixed(1)}/doc)`);
  if (!EXECUTE) console.log('\n🔵 DRY-RUN — nada gravado.');
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
```

- [ ] **Step 2: Dry-run**

Run: `npx tsx scripts/backfill-precedentes-tcu.ts --limit=100`
Expected: "Acórdãos a processar: 100"; total de arestas > 0 (média ~10-25/doc); "DRY-RUN — nada gravado". Nenhuma escrita.

- [ ] **Step 3: Execução com limite pequeno (valida a escrita)**

Run: `npx tsx scripts/backfill-precedentes-tcu.ts --execute --limit=20`
Expected: 20 documentos processados, arestas gravadas. Verificar:
```bash
npx tsx -e "import {prisma} from './lib/prisma'; (async()=>{const n=await prisma.acordaoCitacao.count(); const v=await prisma.document.count({where:{precedentesVersao:1}}); console.log('arestas:',n,'docs v1:',v); await prisma.\$disconnect();})()"
```
Expected: `arestas` > 0 e `docs v1: 20`. Rodar o mesmo `--execute --limit=20` DE NOVO e confirmar que a contagem de arestas **não duplica** (idempotência: apaga+reinsere).

- [ ] **Step 4: Commit** (o backfill completo do acervo roda na Task 6, após o cron existir)

```bash
git add scripts/backfill-precedentes-tcu.ts
git commit -m "feat(tcu): backfill da rede de precedentes a partir do texto guardado"
```

---

### Task 5: Cron de varredura (futuras inclusões)

**Files:**
- Create: `app/api/cron/sync-precedentes-tcu/route.ts`
- Modify: `vercel.json` (agendar o cron)

**Interfaces:**
- Consumes: `persistirArestasDeAcordao`, `PRECEDENTES_VERSAO` (Task 3); `prisma`; `verifyCronAuth` (`lib/cron-auth`); `withCronTelemetry` (`lib/cron-telemetry`); `apiLogger` (`lib/logger`).
- Produces: endpoint `GET /api/cron/sync-precedentes-tcu` que popula arestas de docs com `tcuTextoCompleto` e `precedentesVersao` defasada, em lote.

- [ ] **Step 1: Escrever o cron** (espelha `catalog-tcu-inteiro-teor/route.ts`, mas SEM rede — só regex+escrita)

Criar `app/api/cron/sync-precedentes-tcu/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { persistirArestasDeAcordao, PRECEDENTES_VERSAO } from '@/lib/tcu/extrair-arestas-precedentes';
import { verifyCronAuth } from '@/lib/cron-auth';
import { withCronTelemetry } from '@/lib/cron-telemetry';
import { apiLogger } from '@/lib/logger';

/**
 * Cron: varre acórdãos já com inteiro teor cuja rede de precedentes ainda não
 * foi extraída (ou está numa versão antiga) e popula as arestas. Sem rede —
 * lê o tcuTextoCompleto guardado e roda a regex. Fecha o fluxo contínuo: o
 * backfill cobre o passivo, este cron cobre os acórdãos novos.
 *
 * Fila: category='acordao' + tcuTextoCompleto NOT NULL + (precedentesVersao IS
 * NULL OR < PRECEDENTES_VERSAO). Como cada item marca a versão ao terminar, a
 * fila drena e não há retentativa infinita.
 */
export const maxDuration = 300;

const LOTE = 200; // sem rede: cada item é regex + poucas escritas; lote maior que o de catalogação
const TIME_BUDGET_MS = 250_000;

export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  let body: Record<string, unknown> = {};

  await withCronTelemetry('sync-precedentes-tcu', async () => {
    const filaWhere = {
      category: 'acordao' as const,
      tcuTextoCompleto: { not: null },
      OR: [{ precedentesVersao: null }, { precedentesVersao: { lt: PRECEDENTES_VERSAO } }],
    };

    const alvos = await prisma.document.findMany({
      where: filaWhere,
      select: { id: true, acordaoNumero: true, acordaoAno: true, tcuTextoCompleto: true },
      orderBy: { id: 'asc' },
      take: LOTE,
    });

    let ok = 0, falha = 0, totalArestas = 0;
    const inicio = Date.now();
    for (const alvo of alvos) {
      if (Date.now() - inicio > TIME_BUDGET_MS) {
        apiLogger.warn({ ok, restantes: alvos.length - ok - falha }, '[sync-precedentes] orçamento de tempo esgotado; retoma no próximo run');
        break;
      }
      try {
        const n = await persistirArestasDeAcordao({
          origemId: alvo.id,
          numeroSelf: alvo.acordaoNumero,
          anoSelf: alvo.acordaoAno,
          texto: alvo.tcuTextoCompleto ?? '',
        });
        totalArestas += n;
        ok++;
      } catch (err) {
        falha++;
        apiLogger.error({ err, documentId: alvo.id }, '[sync-precedentes] erro ao extrair arestas');
      }
    }

    const restamNaFila = await prisma.document.count({ where: filaWhere });
    apiLogger.info({ ok, falha, totalArestas, restamNaFila }, '[sync-precedentes] lote concluído');
    body = { ok, falha, totalArestas, restamNaFila };
    return { itemsFound: alvos.length, itemsNew: ok, itemsError: falha, metadata: body };
  });

  return NextResponse.json(body);
}
```

- [ ] **Step 2: Agendar no `vercel.json`**

Adicionar ao array `crons` em `vercel.json` uma entrada (seguir o formato das existentes — ler o arquivo primeiro para casar aspas/indentação):

```json
    { "path": "/api/cron/sync-precedentes-tcu", "schedule": "45 6 * * *" }
```

(6h45 — logo após o `catalog-tcu-inteiro-teor` das 6h30, para pegar o que ele acabou de catalogar.)

- [ ] **Step 3: Verificar build e JSON**

Run: `npx tsc --noEmit` (ou o typecheck do projeto) e valide o `vercel.json`:
```bash
npx tsx -e "console.log('vercel.json ok:', !!require('./vercel.json').crons.find(c=>c.path==='/api/cron/sync-precedentes-tcu'))"
```
Expected: sem erro de tipo; `vercel.json ok: true`.

- [ ] **Step 4: Commit**

```bash
git add app/api/cron/sync-precedentes-tcu/route.ts vercel.json
git commit -m "feat(tcu): cron sync-precedentes-tcu (fluxo contínuo das arestas)"
```

---

### Task 6: Rodar o backfill completo do acervo

**Files:** nenhum (execução operacional).

- [ ] **Step 1: Backfill completo**

Run: `npx tsx scripts/backfill-precedentes-tcu.ts --execute`
Expected: ~1.685 documentos processados (os com `tcuTextoCompleto`); total de arestas na casa das dezenas de milhares (o probe achou 40.107 ocorrências → menos após dedup por par). Sem erro.

- [ ] **Step 2: Sanidade dos números**

Run:
```bash
npx tsx -e "import {prisma} from './lib/prisma'; (async()=>{const arestas=await prisma.acordaoCitacao.count(); const docsV1=await prisma.document.count({where:{precedentesVersao:1}}); const noVoto=await prisma.acordaoCitacao.count({where:{noVoto:true}}); console.log({arestas, docsV1, noVoto}); await prisma.\$disconnect();})()"
```
Expected: `arestas` > 0 (dezenas de milhares), `docsV1` ≈ 1.685, `noVoto` > 0 e menor que `arestas`. Registrar os números no ledger.

- [ ] **Step 3: Commit** (nenhum arquivo — anotar no ledger que o backfill rodou e os números)

---

### Task 7: Wishlist — consulta + relatório

**Files:**
- Create: `scripts/wishlist-precedentes-tcu.ts`

**Interfaces:**
- Consumes: `prisma`.
- Produces: `docs/audits/2026-07-18-wishlist-precedentes-tcu.json` + resumo no console — os leading cases ausentes mais citados.

- [ ] **Step 1: Escrever o script**

Criar `scripts/wishlist-precedentes-tcu.ts`:

```ts
/**
 * Wishlist da rede de precedentes: os acórdãos mais citados que NÃO existem no
 * acervo (nós externos), ordenados por autoridade. É a lista de importação
 * prioritária da Fase 2. Só leitura.
 *
 * Uso: npx tsx scripts/wishlist-precedentes-tcu.ts
 */
import { writeFileSync } from 'fs';
import { prisma } from '../lib/prisma';

const SAIDA = 'docs/audits/2026-07-18-wishlist-precedentes-tcu.json';

interface Linha { numeroAlvo: number; anoAlvo: number; citadoPor: bigint; citadoNoVoto: bigint }

async function main() {
  const linhas = await prisma.$queryRaw<Linha[]>`
    SELECT ac."numeroAlvo", ac."anoAlvo",
           COUNT(*) AS "citadoPor",
           COUNT(*) FILTER (WHERE ac."noVoto") AS "citadoNoVoto"
    FROM "AcordaoCitacao" ac
    WHERE NOT EXISTS (
      SELECT 1 FROM "Document" d
      WHERE d.category = 'acordao'
        AND d."acordaoNumero" = ac."numeroAlvo"
        AND d."acordaoAno" = ac."anoAlvo"
    )
    GROUP BY ac."numeroAlvo", ac."anoAlvo"
    ORDER BY COUNT(*) DESC
    LIMIT 100;
  `;

  const wishlist = linhas.map((l) => ({
    chave: `${l.numeroAlvo}/${l.anoAlvo}`,
    numero: l.numeroAlvo,
    ano: l.anoAlvo,
    citadoPor: Number(l.citadoPor),
    citadoNoVoto: Number(l.citadoNoVoto),
  }));

  const resumo = { geradoEm: '2026-07-18', total: wishlist.length, wishlist };
  writeFileSync(SAIDA, JSON.stringify(resumo, null, 2) + '\n', 'utf8');

  console.log(`Top 20 leading cases AUSENTES (a importar na Fase 2):\n`);
  for (const w of wishlist.slice(0, 20)) {
    console.log(`  ${w.chave.padEnd(12)} citado por ${String(w.citadoPor).padStart(3)} (voto: ${w.citadoNoVoto})`);
  }
  console.log(`\n📄 ${SAIDA} — ${wishlist.length} acórdãos ausentes rankeados`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
```

- [ ] **Step 2: Rodar**

Run: `npx tsx scripts/wishlist-precedentes-tcu.ts`
Expected: lista com os leading cases externos no topo (esperado o 1441/2016 com ~185 no topo, coerente com o probe); JSON criado. Confirmar que os top da wishlist batem, em ordem de grandeza, com o `topLeadingCases` do probe (os `alvoId: null`).

- [ ] **Step 3: Commit**

```bash
git add scripts/wishlist-precedentes-tcu.ts docs/audits/2026-07-18-wishlist-precedentes-tcu.json
git commit -m "feat(tcu): wishlist dos leading cases ausentes (entregável da fase 1)"
```

---

## Notas de execução

- **Ordem:** 1 → 2 → 3 → 4 → 5 → 6 → 7. Task 2 e 3 dependem do schema (Task 1, para o `prisma.acordaoCitacao`); 4/5 dependem de 3; 6 depende de 4+5 existirem; 7 depende de 6 (dados no banco).
- **Sem tocar produção visível:** nada altera o comportamento do site. O cron novo só roda após deploy (merge para `main`) — que fica para o Daniel.
- **Reversível:** `DROP TABLE "AcordaoCitacao"` + `ALTER TABLE "Document" DROP COLUMN "precedentesVersao"` desfazem tudo.
- **Regressão:** rodar `npx vitest run lib/tcu/` ao final — a suíte de `lib/tcu/` deve continuar verde com os testes novos.
