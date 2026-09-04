# Teses do TCU — Onda 1: identidade e evidência

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar a evidência de cada tese destilada um dado persistido e íntegro, e a identidade do acórdão-líder inequívoca, para que as ondas seguintes possam publicar sem risco de exibir trecho trocado ou atribuir tese ao acórdão errado.

**Architecture:** Hoje `TeseEnunciado.trechosFonte` guarda *índices* para um dossiê recomposto do grafo a cada uso — e o grafo cresce todo dia, então os índices apodrecem em silêncio. Esta onda copia os trechos citados para uma tabela (`TeseTrechoFonte`), reconstruindo o dossiê histórico via `AcordaoCitacao.criadoEm` enquanto isso ainda é possível, e passa a gravá-los no ato da destilação. Em paralelo, a identidade do acórdão-líder deixa de ser inferida e passa a vir do identificador oficial do TCU (`ACORDAO-COMPLETO-<n>`).

**Tech Stack:** TypeScript, Prisma 7 (PrismaNeon), PostgreSQL (Neon), Vitest, tsx para scripts.

**Spec:** `docs/superpowers/specs/2026-09-04-publicacao-teses-tcu-design.md`

## Global Constraints

- **Idioma:** comentários, mensagens de commit e saída de scripts em português. Identificadores de código em português quando o módulo já usa (todo `lib/tcu/` usa).
- **Diretório de trabalho:** `C:\Users\User\projetos\sitedobarral`. Rodar tudo da raiz.
- **Prisma:** após qualquer mudança em `prisma/schema.prisma`, rodar `npx prisma generate`. Se der erro de engine, matar processos Node e repetir. O deploy usa `prisma db push` — **não criar índices por SQL cru**, eles são apagados no push seguinte.
- **Scripts de dado:** dry-run é o padrão; `--executar` aplica. Nenhum script desta onda escreve sem a flag.
- **Site em produção:** nada nesta onda toca rota, componente ou superfície de busca. Se um passo pedir isso, o plano está sendo mal executado.
- **Testes:** `npx vitest run <caminho>` para um arquivo; `npx vitest run lib/tcu` para o módulo. A suíte inteira (`npx vitest run`) tem 2312 testes e leva ~15s.
- **Vocabulário de veredito:** `fiel | imprecisa | errada` (`lib/tcu/parsear-veredito.ts:13`). Só `fiel` é aprovação.
- **Etiqueta de lote:** `julgadoPor` contendo `:lote-` indica julgamento em lote.

---

### Task 1: Determinismo do dossiê

Hoje `montarDossie` ordena por `noVoto` e comprimento; empates são desfeitos pela ordem de chegada, que vem de um `findMany` sem `orderBy`. Dois runs podem produzir índices diferentes sobre o mesmo grafo — e é sobre esses índices que a evidência será resolvida na Task 5. Sem determinismo, a reconstrução histórica não é reproduzível.

**Files:**
- Modify: `lib/tcu/trechos-de-citacao.ts` (função `montarDossie`, ~linha 85; função `coletarTrechosDoAlvo`, ~linha 106)
- Test: `lib/tcu/trechos-de-citacao.test.ts`

**Interfaces:**
- Consumes: nada de tarefas anteriores.
- Produces: `montarDossie(alvo, trechos, limite?)` com ordenação total determinística; `coletarTrechosDoAlvo(alvo: {numero, ano}, opcoes?: { ateData?: Date })` — o parâmetro `ateData` é consumido pela Task 5.

- [ ] **Step 1: Escrever o teste de determinismo que falha**

Adicionar ao final de `lib/tcu/trechos-de-citacao.test.ts`:

```typescript
describe('montarDossie — determinismo', () => {
  // Três trechos que empatam em noVoto E em comprimento. Sem desempate
  // explícito, a ordem final é a ordem de entrada — e a ordem de entrada
  // vem de um findMany sem orderBy, ou seja, indefinida.
  const empatados = [
    { origemChave: '300/2020', secao: 'voto' as const, noVoto: true, trecho: 'AAA', offset: 0 },
    { origemChave: '100/2020', secao: 'voto' as const, noVoto: true, trecho: 'BBB', offset: 0 },
    { origemChave: '200/2020', secao: 'voto' as const, noVoto: true, trecho: 'CCC', offset: 0 },
  ];

  it('desempata por origemChave, independente da ordem de entrada', () => {
    const alvo = { numero: 1441, ano: 2016 };
    const direta = montarDossie(alvo, empatados).trechos.map((t) => t.trecho);
    const invertida = montarDossie(alvo, [...empatados].reverse()).trechos.map((t) => t.trecho);
    expect(direta).toEqual(invertida);
    // 100/2020 < 200/2020 < 300/2020 → BBB, CCC, AAA
    expect(direta).toEqual(['BBB', 'CCC', 'AAA']);
  });

  it('mantém voto antes de não-voto e mais longo antes de mais curto', () => {
    const d = montarDossie({ numero: 1441, ano: 2016 }, [
      { origemChave: '100/2020', secao: 'relatorio' as const, noVoto: false, trecho: 'nao-voto', offset: 0 },
      { origemChave: '900/2020', secao: 'voto' as const, noVoto: true, trecho: 'curto', offset: 0 },
      { origemChave: '800/2020', secao: 'voto' as const, noVoto: true, trecho: 'trecho bem mais longo', offset: 0 },
    ]);
    expect(d.trechos.map((t) => t.trecho)).toEqual(['trecho bem mais longo', 'curto', 'nao-voto']);
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

Run: `npx vitest run lib/tcu/trechos-de-citacao.test.ts -t "desempata por origemChave"`
Expected: FAIL — a ordem retornada é `['AAA','BBB','CCC']` na primeira chamada e `['CCC','BBB','AAA']` na segunda.

- [ ] **Step 3: Implementar o desempate**

Em `lib/tcu/trechos-de-citacao.ts`, substituir a linha de ordenação dentro de `montarDossie`:

```typescript
  // Voto primeiro; dentro de cada grupo, trechos mais longos (mais informativos).
  dedup.sort((a, b) => Number(b.noVoto) - Number(a.noVoto) || b.trecho.length - a.trecho.length);
```

por:

```typescript
  // Voto primeiro; dentro de cada grupo, trechos mais longos (mais
  // informativos); por fim origemChave, que fecha a ordenação.
  //
  // O desempate por origemChave não é cosmético: a evidência de cada tese é
  // resolvida por ÍNDICE nesta lista (TeseTrechoFonte, spec §7). Empate
  // desfeito pela ordem de chegada — que vem de um findMany sem orderBy —
  // faria dois runs produzirem trechos diferentes para o mesmo índice.
  dedup.sort(
    (a, b) =>
      Number(b.noVoto) - Number(a.noVoto) ||
      b.trecho.length - a.trecho.length ||
      a.origemChave.localeCompare(b.origemChave),
  );
```

- [ ] **Step 4: Rodar os testes de determinismo**

Run: `npx vitest run lib/tcu/trechos-de-citacao.test.ts`
Expected: PASS, incluindo os testes que já existiam no arquivo.

- [ ] **Step 5: Escrever o teste do corte temporal**

O `ateData` precisa filtrar arestas por `criadoEm`. Adicionar em `lib/tcu/trechos-de-citacao.test.ts`, no topo do arquivo (antes dos imports existentes), o mock do Prisma — o arquivo hoje só testa funções puras, então este é o primeiro teste que toca banco:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockArestas, mockDocs } = vi.hoisted(() => ({
  mockArestas: vi.fn(),
  mockDocs: vi.fn(),
}));

vi.mock('../prisma', () => ({
  prisma: {
    acordaoCitacao: { findMany: (...a: unknown[]) => mockArestas(...a) },
    document: { findMany: (...a: unknown[]) => mockDocs(...a) },
  },
}));
```

E o teste, ao final do arquivo:

```typescript
describe('coletarTrechosDoAlvo — corte temporal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockArestas.mockResolvedValue([]);
    mockDocs.mockResolvedValue([]);
  });

  it('sem ateData, não filtra por criadoEm', async () => {
    const { coletarTrechosDoAlvo } = await import('./trechos-de-citacao');
    await coletarTrechosDoAlvo({ numero: 1441, ano: 2016 });
    expect(mockArestas.mock.calls[0][0].where.criadoEm).toBeUndefined();
  });

  it('com ateData, filtra arestas anteriores à data', async () => {
    const { coletarTrechosDoAlvo } = await import('./trechos-de-citacao');
    const corte = new Date('2026-08-01T00:00:00Z');
    await coletarTrechosDoAlvo({ numero: 1441, ano: 2016 }, { ateData: corte });
    expect(mockArestas.mock.calls[0][0].where.criadoEm).toEqual({ lt: corte });
  });

  it('ordena as arestas para não depender da ordem do banco', async () => {
    const { coletarTrechosDoAlvo } = await import('./trechos-de-citacao');
    await coletarTrechosDoAlvo({ numero: 1441, ano: 2016 });
    expect(mockArestas.mock.calls[0][0].orderBy).toEqual({ origemId: 'asc' });
  });
});
```

- [ ] **Step 6: Rodar para confirmar que falha**

Run: `npx vitest run lib/tcu/trechos-de-citacao.test.ts -t "corte temporal"`
Expected: FAIL — `coletarTrechosDoAlvo` não aceita segundo argumento e a chamada não tem `orderBy`.

- [ ] **Step 7: Implementar o corte temporal**

Em `lib/tcu/trechos-de-citacao.ts`, substituir a assinatura e a consulta de arestas de `coletarTrechosDoAlvo`:

```typescript
export async function coletarTrechosDoAlvo(alvo: { numero: number; ano: number }): Promise<DossieUso> {
  const arestas = await prisma.acordaoCitacao.findMany({
    where: { numeroAlvo: alvo.numero, anoAlvo: alvo.ano },
    select: { origemId: true, noVoto: true, ocorrencias: true },
  });
```

por:

```typescript
export interface OpcoesDossie {
  /**
   * Reconstrói o dossiê como ele era nesta data, ignorando arestas criadas
   * depois. Uma aresta só existe se o inteiro teor do citante já existia
   * quando ela foi extraída, então o corte por criadoEm devolve fielmente o
   * universo de candidatos daquele momento (spec §7).
   */
  ateData?: Date;
}

export async function coletarTrechosDoAlvo(
  alvo: { numero: number; ano: number },
  opcoes: OpcoesDossie = {},
): Promise<DossieUso> {
  const arestas = await prisma.acordaoCitacao.findMany({
    where: {
      numeroAlvo: alvo.numero,
      anoAlvo: alvo.ano,
      ...(opcoes.ateData ? { criadoEm: { lt: opcoes.ateData } } : {}),
    },
    select: { origemId: true, noVoto: true, ocorrencias: true },
    // Ordem estável: o desempate de montarDossie é por origemChave, mas a
    // deduplicação vê os trechos na ordem de chegada.
    orderBy: { origemId: 'asc' },
  });
```

- [ ] **Step 8: Rodar o arquivo inteiro**

Run: `npx vitest run lib/tcu/trechos-de-citacao.test.ts`
Expected: PASS em todos.

- [ ] **Step 9: Rodar o módulo para garantir que nada quebrou**

Run: `npx vitest run lib/tcu`
Expected: PASS (284 testes antes desta task, mais os 5 novos).

- [ ] **Step 10: Commit**

```bash
git add lib/tcu/trechos-de-citacao.ts lib/tcu/trechos-de-citacao.test.ts
git commit -m "fix: dossiê determinístico e corte temporal por criadoEm

O desempate por origemChave fecha a ordenação de montarDossie. Sem ele,
empates em noVoto e comprimento eram desfeitos pela ordem de chegada, que
vem de um findMany sem orderBy — dois runs produziam índices diferentes
para os mesmos trechos. Como a evidência das teses é resolvida por índice
nessa lista, isso tornaria a reconstrução histórica irreprodutível.

coletarTrechosDoAlvo ganha ateData, que filtra arestas por criadoEm e
reconstrói o dossiê de uma data passada."
```

---

### Task 2: Contrato de `escolherCandidato`

O helper devolve `completos[0] ?? cands[0]` quando há vários candidatos. Essa queda é a inferência que o spec §4.1 descarta com evidência: número e ano não identificam um acórdão do TCU, e escolher o primeiro atribui a tese a um colegiado arbitrário.

**Files:**
- Modify: `lib/tcu/buscar-acordao-tcu.ts:56-64`
- Test: `lib/tcu/buscar-acordao-tcu.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `escolherCandidato(cands: CandidatoAcordao[], colegiadoPreferido?: string): CandidatoAcordao | null` com cardinalidade estrita — usado pelas Tasks 4 e 6.

- [ ] **Step 1: Escrever os testes de cardinalidade**

Adicionar em `lib/tcu/buscar-acordao-tcu.test.ts`:

```typescript
describe('escolherCandidato — cardinalidade estrita', () => {
  const base = {
    ano: 2024, relator: null, ementa: '', link: '', isRelacao: false,
  };
  const plenario = { ...base, numero: 56, colegiado: 'Plenário', key: 'ACORDAO-COMPLETO-1' };
  const primeira = { ...base, numero: 56, colegiado: 'Primeira Câmara', key: 'ACORDAO-COMPLETO-2' };
  const relacao = { ...base, numero: 56, colegiado: 'Segunda Câmara', key: 'ACORDAO-COMPLETO-3', isRelacao: true };

  it('zero candidatos → null', () => {
    expect(escolherCandidato([])).toBeNull();
  });

  it('exatamente um não-relação → o candidato', () => {
    expect(escolherCandidato([plenario])?.key).toBe('ACORDAO-COMPLETO-1');
  });

  it('um não-relação entre relações → o não-relação', () => {
    expect(escolherCandidato([relacao, plenario])?.key).toBe('ACORDAO-COMPLETO-1');
  });

  it('dois ou mais não-relação → null por ambiguidade, sem escolher o primeiro', () => {
    expect(escolherCandidato([plenario, primeira])).toBeNull();
  });

  it('só relações → null, sem queda para cands[0]', () => {
    expect(escolherCandidato([relacao])).toBeNull();
  });

  it('colegiadoPreferido resolve a ambiguidade quando casa com exatamente um', () => {
    expect(escolherCandidato([plenario, primeira], 'Plenário')?.key).toBe('ACORDAO-COMPLETO-1');
  });

  it('colegiadoPreferido que não casa não reabre a queda para o primeiro', () => {
    expect(escolherCandidato([plenario, primeira], 'Segunda Câmara')).toBeNull();
  });
});
```

Se o arquivo `lib/tcu/buscar-acordao-tcu.test.ts` não existir, criá-lo com o cabeçalho:

```typescript
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { escolherCandidato } from './buscar-acordao-tcu';
```

- [ ] **Step 2: Rodar para confirmar que falha**

Run: `npx vitest run lib/tcu/buscar-acordao-tcu.test.ts -t "cardinalidade estrita"`
Expected: FAIL nos casos "dois ou mais" (devolve `plenario`) e "só relações" (devolve `relacao`).

- [ ] **Step 3: Implementar a cardinalidade estrita**

Substituir `escolherCandidato` em `lib/tcu/buscar-acordao-tcu.ts`:

```typescript
export function escolherCandidato(cands: CandidatoAcordao[], colegiadoPreferido?: string): CandidatoAcordao | null {
  if (!cands.length) return null;
  if (colegiadoPreferido) {
    const c = cands.find((x) => x.colegiado === colegiadoPreferido && !x.isRelacao);
    if (c) return c;
  }
  const completos = cands.filter((c) => !c.isRelacao);
  return (completos[0] ?? cands[0]) || null;
}
```

por:

```typescript
/**
 * Resolve os candidatos a UM acórdão, ou a nenhum.
 *
 * Cardinalidade estrita, sem queda para `cands[0]`: número e ano NÃO
 * identificam um acórdão do TCU — o 56/2024 existe em Plenário, Primeira e
 * Segunda Câmara. Devolver "algum" candidato atribuiria a tese a um colegiado
 * arbitrário. Ambiguidade é resultado legítimo, e quem chama decide o que
 * fazer com ela (spec §4.2).
 *
 * | não-relação | retorno |
 * |---|---|
 * | zero        | null    |
 * | um          | ele     |
 * | dois ou +   | null    |
 */
export function escolherCandidato(cands: CandidatoAcordao[], colegiadoPreferido?: string): CandidatoAcordao | null {
  const completos = cands.filter((c) => !c.isRelacao);
  if (completos.length === 1) return completos[0];
  if (colegiadoPreferido) {
    const doColegiado = completos.filter((x) => x.colegiado === colegiadoPreferido);
    if (doColegiado.length === 1) return doColegiado[0];
  }
  return null;
}
```

- [ ] **Step 4: Rodar os testes**

Run: `npx vitest run lib/tcu/buscar-acordao-tcu.test.ts`
Expected: PASS.

- [ ] **Step 5: Verificar os outros chamadores**

Run: `grep -rn "escolherCandidato" --include=*.ts lib app scripts | grep -v test`
Expected: aparecem `app/api/cron/destilar-teses-tcu/route.ts` e possivelmente scripts. **Não alterá-los nesta task** — a Task 4 trata o cron. Apenas confirmar que nenhum deles depende de receber "algum" candidato: ler cada chamada e anotar no corpo do commit se algum passar a receber `null` onde antes recebia um objeto.

- [ ] **Step 6: Rodar o módulo**

Run: `npx vitest run lib/tcu`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/tcu/buscar-acordao-tcu.ts lib/tcu/buscar-acordao-tcu.test.ts
git commit -m "fix: escolherCandidato com cardinalidade estrita

Número e ano não identificam um acórdão do TCU: o 56/2024 existe em
Plenário, Primeira e Segunda Câmara. O helper devolvia completos[0] ??
cands[0], atribuindo a tese a um colegiado arbitrário.

Agora: zero não-relação → null; exatamente um → ele; dois ou mais → null
por ambiguidade. colegiadoPreferido só resolve se casar com exatamente um.
Sem queda para cands[0] em nenhum caminho."
```

---

### Task 3: Schema — evidência, identidade e estado de publicação

**Files:**
- Modify: `prisma/schema.prisma` (models `TeseDestilacao` ~linha 2093, `TeseEnunciado` ~linha 2118, `Document`)
- Test: `lib/tcu/schema-teses.test.ts` (criar)

**Interfaces:**
- Consumes: nada.
- Produces: model `TeseTrechoFonte { id, enunciadoId, ordem, trecho, origemNumero, origemAno, origemColegiado, origemUrl, origemLinkPDF, origemDocumentId, noVoto, capturadoEm }` com `@@unique([enunciadoId, ordem])`; campos `TeseDestilacao.{acordaoKey, colegiadoAlvo, relatorAlvo, urlAlvo, documentId}`; campos `TeseEnunciado.{publicado, vitrinePublica, retiradoEm, retiradoMotivo, atualizadoEm, embeddingStatus}`. Consumidos pelas Tasks 4-7 e pelas ondas seguintes.

- [ ] **Step 1: Adicionar os campos de identidade em `TeseDestilacao`**

Em `prisma/schema.prisma`, no model `TeseDestilacao`, após `versaoMotor Int`:

```prisma
  /// Identidade oficial do acórdão-líder, vinda do TCU (spec §4.2). Nulo =
  /// ambíguo ou não resolvido, e nesse caso a destilação fica fora de TODOS os
  /// consumidores — número e ano não identificam um acórdão do TCU.
  acordaoKey    String?
  colegiadoAlvo String?
  relatorAlvo   String?
  urlAlvo       String?
  /// Enriquecimento opcional: o acórdão-líder na nossa base, quando existe.
  /// NÃO é a identidade — em 39 das 93 teses o líder não está aqui.
  documentId    String?
  document      Document? @relation("TeseDestilacaoAcordaoLider", fields: [documentId], references: [id], onDelete: SetNull)
```

E no bloco de índices do mesmo model, junto de `@@index([chave])`:

```prisma
  @@index([acordaoKey])
  @@index([documentId])
```

- [ ] **Step 2: Adicionar os campos de publicação em `TeseEnunciado`**

No model `TeseEnunciado`, após `herdadoDe String?`:

```prisma
  /// Estado editorial, independente da versão da destilação (spec §5).
  publicado      Boolean   @default(false)
  vitrinePublica Boolean   @default(false)
  retiradoEm     DateTime?
  retiradoMotivo String?
  /// Sinal de mudança para o relatório do export incremental (spec §8.2).
  atualizadoEm   DateTime  @updatedAt
  /// Ciclo do embedding, no desenho de Document e TribunalDecision (spec §9).
  embeddingStatus String?

  trechos TeseTrechoFonte[]
```

E nos índices:

```prisma
  @@index([publicado])
  @@index([vitrinePublica])
  @@index([embeddingStatus])
```

- [ ] **Step 3: Criar o model `TeseTrechoFonte`**

Após o model `TeseEnunciado`:

```prisma
/// A evidência literal de uma tese, copiada no momento da destilação.
///
/// Existe porque `TeseEnunciado.trechosFonte` guarda ÍNDICES para um dossiê que
/// não é persistido e que é recomposto do grafo a cada uso. Como o grafo cresce
/// todo dia, os índices apodrecem — e para os alvos saturados no teto de 40 a
/// verificação por contagem nem detecta (spec §7).
model TeseTrechoFonte {
  id          String   @id @default(cuid())
  enunciadoId String
  enunciado   TeseEnunciado @relation(fields: [enunciadoId], references: [id], onDelete: Cascade)
  ordem       Int
  trecho      String   @db.Text

  /// O acórdão CITANTE — quem escreveu o trecho. Não confundir com o
  /// acórdão-líder, que é o alvo da destilação.
  origemNumero     Int
  origemAno        Int
  origemColegiado  String?
  /// Caminhos para o inteiro teor, copiados no snapshot. Sobrevivem à perda da
  /// relação com Document: evidência que não se pode conferir não é evidência.
  origemUrl        String?
  origemLinkPDF    String?
  origemDocumentId String?
  origemDocument   Document? @relation("TeseTrechoOrigem", fields: [origemDocumentId], references: [id], onDelete: SetNull)

  noVoto      Boolean
  capturadoEm DateTime @default(now())

  /// Torna a gravação idempotente: reexecutar o backfill reescreve as mesmas
  /// linhas em vez de duplicar.
  @@unique([enunciadoId, ordem])
  @@index([enunciadoId])
  @@index([origemDocumentId])
}
```

- [ ] **Step 4: Adicionar os lados inversos em `Document`**

No model `Document`, junto das outras relações:

```prisma
  trechosDeTese      TeseTrechoFonte[] @relation("TeseTrechoOrigem")
  teseDestilacoes    TeseDestilacao[]  @relation("TeseDestilacaoAcordaoLider")
```

- [ ] **Step 5: Gerar o client e aplicar**

```bash
npx prisma generate
npx prisma db push
```

Expected: `generate` sem erro; `db push` reporta as colunas e a tabela novas. Se `generate` falhar com erro de engine, matar processos Node (`taskkill /F /IM node.exe` no PowerShell) e repetir.

- [ ] **Step 6: Escrever o teste de forma do schema**

Criar `lib/tcu/schema-teses.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Testa o CONTRATO do schema, não o banco: estas garantias são as que as
// tasks seguintes assumem, e um `db push` acidental que as remova precisa
// quebrar a suíte, não a produção.
const schema = readFileSync(join(process.cwd(), 'prisma', 'schema.prisma'), 'utf-8');
const model = (nome: string) =>
  new RegExp(`model ${nome} \\{[\\s\\S]*?\\n\\}`).exec(schema)?.[0] ?? '';

describe('schema — teses', () => {
  it('TeseTrechoFonte é único por (enunciado, ordem) — garante idempotência', () => {
    expect(model('TeseTrechoFonte')).toContain('@@unique([enunciadoId, ordem])');
  });

  it('TeseTrechoFonte guarda caminhos para o inteiro teor além da relação', () => {
    const m = model('TeseTrechoFonte');
    expect(m).toContain('origemUrl');
    expect(m).toContain('origemLinkPDF');
    expect(m).toContain('onDelete: SetNull');
  });

  it('perder o Document do citante não apaga o trecho', () => {
    expect(model('TeseTrechoFonte')).not.toContain('onDelete: Cascade\n  origemDocument');
  });

  it('TeseDestilacao tem identidade oficial separada do enriquecimento', () => {
    const m = model('TeseDestilacao');
    expect(m).toContain('acordaoKey');
    expect(m).toContain('colegiadoAlvo');
    expect(m).toContain('documentId');
  });

  it('TeseEnunciado separa estado editorial da versão', () => {
    const m = model('TeseEnunciado');
    for (const campo of ['publicado', 'vitrinePublica', 'retiradoEm', 'retiradoMotivo', 'atualizadoEm', 'embeddingStatus']) {
      expect(m).toContain(campo);
    }
  });
});
```

- [ ] **Step 7: Rodar o teste**

Run: `npx vitest run lib/tcu/schema-teses.test.ts`
Expected: PASS nos 5.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma lib/tcu/schema-teses.test.ts
git commit -m "feat: schema da evidência, identidade e publicação das teses

TeseTrechoFonte guarda o trecho literal com o acórdão CITANTE e dois
caminhos para o inteiro teor (relação com Document e URL/PDF copiados),
para a evidência sobreviver à perda da relação. @@unique(enunciadoId,
ordem) torna a gravação idempotente.

TeseDestilacao ganha a identidade oficial do TCU (acordaoKey e colegiado),
separada do documentId, que é só enriquecimento — em 39 das 93 teses o
acórdão-líder não existe na nossa base.

TeseEnunciado ganha o estado editorial (publicado, vitrinePublica,
retirada) separado da versão da destilação, mais atualizadoEm e
embeddingStatus."
```

---

### Task 4: Elegibilidade canônica como código

O predicado `ELEGIVEL_BASE` do spec §6 aparece em quatro consumidores nas ondas seguintes. Escrito à mão em cada lugar, ele diverge — e a divergência publica tese reprovada ou sem evidência. Esta task o define uma vez.

**Files:**
- Create: `lib/tcu/elegibilidade-tese.ts`
- Test: `lib/tcu/elegibilidade-tese.test.ts`

**Interfaces:**
- Consumes: schema da Task 3.
- Produces:
  - `WHERE_ELEGIVEL_BASE: Prisma.TeseEnunciadoWhereInput` — cláusula reusável.
  - `evidenciaIntegral(enunciado: { trechosFonte: unknown; trechos: Array<unknown> }): boolean`
  - `indicesDeclarados(trechosFonte: unknown): number[]` — índices distintos, ordenados.

- [ ] **Step 1: Escrever os testes**

Criar `lib/tcu/elegibilidade-tese.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { indicesDeclarados, evidenciaIntegral, WHERE_ELEGIVEL_BASE } from './elegibilidade-tese';

describe('indicesDeclarados', () => {
  it('extrai índices distintos e ordenados', () => {
    expect(indicesDeclarados([2, 0, 2, 1])).toEqual([0, 1, 2]);
  });

  it('ignora valor não-numérico, negativo ou não-inteiro', () => {
    expect(indicesDeclarados([0, -1, 1.5, 'x', null, 3])).toEqual([0, 3]);
  });

  it('devolve vazio para não-array', () => {
    expect(indicesDeclarados(null)).toEqual([]);
    expect(indicesDeclarados({})).toEqual([]);
  });
});

describe('evidenciaIntegral', () => {
  const trecho = (ordem: number) => ({ ordem });

  it('exige ao menos um índice declarado — zero e zero não passa', () => {
    // Sem esta condição, 0 === 0 aprovaria uma tese sem nenhuma evidência.
    expect(evidenciaIntegral({ trechosFonte: [], trechos: [] })).toBe(false);
  });

  it('aprova quando todos os índices declarados estão persistidos', () => {
    expect(evidenciaIntegral({ trechosFonte: [0, 1, 2], trechos: [trecho(0), trecho(1), trecho(2)] })).toBe(true);
  });

  it('reprova perda parcial — 3 declarados, 2 persistidos', () => {
    expect(evidenciaIntegral({ trechosFonte: [0, 1, 2], trechos: [trecho(0), trecho(1)] })).toBe(false);
  });

  it('índices repetidos contam uma vez', () => {
    expect(evidenciaIntegral({ trechosFonte: [0, 0, 1], trechos: [trecho(0), trecho(1)] })).toBe(true);
  });

  it('reprova quando há trecho a mais que o declarado', () => {
    expect(evidenciaIntegral({ trechosFonte: [0], trechos: [trecho(0), trecho(1)] })).toBe(false);
  });
});

describe('WHERE_ELEGIVEL_BASE', () => {
  it('exige veredito fiel, não apenas veredito preenchido', () => {
    expect(WHERE_ELEGIVEL_BASE.veredito).toBe('fiel');
  });

  it('exige ausência de retirada, versão atual e identidade resolvida', () => {
    expect(WHERE_ELEGIVEL_BASE.retiradoEm).toBeNull();
    expect(WHERE_ELEGIVEL_BASE.destilacao).toEqual({
      atual: true,
      acordaoKey: { not: null },
    });
  });

  it('exige ao menos um trecho persistido', () => {
    expect(WHERE_ELEGIVEL_BASE.trechos).toEqual({ some: {} });
  });
});
```

- [ ] **Step 2: Rodar para confirmar que falha**

Run: `npx vitest run lib/tcu/elegibilidade-tese.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

Criar `lib/tcu/elegibilidade-tese.ts`:

```typescript
/**
 * O predicado de elegibilidade das teses, num lugar só (spec §6).
 *
 * Quatro consumidores dependem dele — vitrine, acervo restrito, busca por IA e
 * export:elic. Reescrito à mão em cada um, ele diverge, e a divergência publica
 * tese reprovada, retirada ou sem evidência.
 *
 * ATENÇÃO: `veredito` preenchido NÃO é aprovação. O vocabulário é
 * `fiel | imprecisa | errada` (parsear-veredito.ts) e as duas últimas reprovam.
 */
import type { Prisma } from '@prisma/client';

/**
 * Filtro SQL do predicado base. A integralidade da evidência (todos os índices
 * declarados persistidos) NÃO cabe aqui — depende de comparar contagens contra
 * um campo Json, o que Prisma não expressa. O `some: {}` barra o caso grosseiro
 * (zero trechos); a integralidade é conferida em memória por
 * `evidenciaIntegral`, e todo consumidor precisa aplicar as duas.
 */
export const WHERE_ELEGIVEL_BASE = {
  veredito: 'fiel',
  retiradoEm: null,
  destilacao: { atual: true, acordaoKey: { not: null } },
  trechos: { some: {} },
} satisfies Prisma.TeseEnunciadoWhereInput;

/** Índices distintos e ordenados declarados em `trechosFonte`. */
export function indicesDeclarados(trechosFonte: unknown): number[] {
  if (!Array.isArray(trechosFonte)) return [];
  const validos = trechosFonte.filter(
    (n): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0,
  );
  return [...new Set(validos)].sort((a, b) => a - b);
}

/**
 * Evidência íntegra: TODOS os índices declarados estão persistidos.
 *
 * A checagem de "> 0" não é redundante com a igualdade: um enunciado que não
 * declara índice nenhum satisfaria `0 === 0` e passaria como se tivesse
 * fundamentação completa, quando não tem evidência alguma.
 */
export function evidenciaIntegral(enunciado: {
  trechosFonte: unknown;
  trechos: Array<{ ordem: number }>;
}): boolean {
  const declarados = indicesDeclarados(enunciado.trechosFonte);
  if (declarados.length === 0) return false;
  const persistidos = new Set(enunciado.trechos.map((t) => t.ordem));
  if (persistidos.size !== declarados.length) return false;
  return declarados.every((i) => persistidos.has(i));
}
```

- [ ] **Step 4: Rodar os testes**

Run: `npx vitest run lib/tcu/elegibilidade-tese.test.ts`
Expected: PASS nos 12.

- [ ] **Step 5: Commit**

```bash
git add lib/tcu/elegibilidade-tese.ts lib/tcu/elegibilidade-tese.test.ts
git commit -m "feat: predicado de elegibilidade das teses num lugar só

Quatro consumidores vão depender dele; reescrito à mão em cada um,
diverge e publica tese reprovada ou sem evidência.

evidenciaIntegral exige que TODOS os índices declarados em trechosFonte
estejam persistidos, e ao menos um declarado — sem essa segunda condição,
um enunciado com trechosFonte vazio passaria por 0 === 0 como se tivesse
fundamentação completa."
```

---

### Task 5: Gravar a evidência no ato da destilação

Fecha a torneira antes de esvaziar o balde: sem isso, cada destilação nova nasceria com a mesma evidência volátil que a Task 6 vai consertar no passivo.

**Files:**
- Modify: `lib/tcu/persistir-tese.ts` (função `persistirDestilacao`, ~linha 108)
- Test: `lib/tcu/persistir-tese.test.ts`

**Interfaces:**
- Consumes: `indicesDeclarados` (Task 4); schema (Task 3).
- Produces: `persistirDestilacao(alvo, tese, dossie, identidade?)` — `identidade` é `{ acordaoKey, colegiadoAlvo, relatorAlvo, urlAlvo } | null`, consumido pela Task 7.

- [ ] **Step 1: Escrever o teste de gravação da evidência**

Adicionar em `lib/tcu/persistir-tese.test.ts`, dentro do `describe` de `persistirDestilacao`. O arquivo precisa de um mock novo para `document.findMany` — acrescentar `mockDocs: vi.fn()` ao bloco `vi.hoisted` existente, `document: { findMany: (...a: unknown[]) => mockDocs(...a) }` ao mock do Prisma, e `mockDocs.mockResolvedValue([])` ao `beforeEach`:

```typescript
  it('grava os trechos citados junto da destilação, resolvidos pelo dossiê em mãos', async () => {
    const dossie = {
      alvo: { numero: 1441, ano: 2016 },
      contagem: { citantesDistintos: 2, noVoto: 2, ocorrenciasTotal: 2 },
      trechos: [
        { origemChave: '100/2020', secao: 'voto' as const, noVoto: true, trecho: 'primeiro', offset: 0 },
        { origemChave: '200/2021', secao: 'voto' as const, noVoto: true, trecho: 'segundo', offset: 0 },
      ],
    };
    await persistirDestilacao(
      { numero: 1441, ano: 2016 },
      { assunto: 'x', confianca: 'alta', teses: [{ enunciado: 'E1', inovacao: 'i', trechosFonte: [1] }], divergencias: [], sinaisQualitativos: [] },
      dossie,
    );
    const criados = ultimoTx.teseDestilacao.create.mock.calls[0][0].data.enunciados.create;
    const trechos = criados[0].trechos.create;
    expect(trechos).toHaveLength(1);
    // trechosFonte: [1] → o SEGUNDO trecho do dossiê
    expect(trechos[0]).toMatchObject({
      ordem: 1, trecho: 'segundo', origemNumero: 200, origemAno: 2021, noVoto: true,
    });
  });

  it('não grava evidência parcial: índice fora do dossiê zera os trechos do enunciado', async () => {
    const dossie = {
      alvo: { numero: 1441, ano: 2016 },
      contagem: { citantesDistintos: 1, noVoto: 1, ocorrenciasTotal: 1 },
      trechos: [{ origemChave: '100/2020', secao: 'voto' as const, noVoto: true, trecho: 'unico', offset: 0 }],
    };
    await persistirDestilacao(
      { numero: 1441, ano: 2016 },
      { assunto: 'x', confianca: 'alta', teses: [{ enunciado: 'E1', inovacao: 'i', trechosFonte: [0, 7] }], divergencias: [], sinaisQualitativos: [] },
      dossie,
    );
    const criados = ultimoTx.teseDestilacao.create.mock.calls[0][0].data.enunciados.create;
    expect(criados[0].trechos.create).toEqual([]);
  });

  it('copia o caminho para o inteiro teor do citante', async () => {
    mockDocs.mockResolvedValue([
      { id: 'doc-100', acordaoNumero: 100, acordaoAno: 2020, tcuOrgaoJulgador: 'Plenário', url: 'https://u/100', tcuLinkPDF: 'https://p/100' },
    ]);
    const dossie = {
      alvo: { numero: 1441, ano: 2016 },
      contagem: { citantesDistintos: 1, noVoto: 1, ocorrenciasTotal: 1 },
      trechos: [{ origemChave: '100/2020', secao: 'voto' as const, noVoto: true, trecho: 'unico', offset: 0 }],
    };
    await persistirDestilacao(
      { numero: 1441, ano: 2016 },
      { assunto: 'x', confianca: 'alta', teses: [{ enunciado: 'E1', inovacao: 'i', trechosFonte: [0] }], divergencias: [], sinaisQualitativos: [] },
      dossie,
    );
    const criados = ultimoTx.teseDestilacao.create.mock.calls[0][0].data.enunciados.create;
    expect(criados[0].trechos.create[0]).toMatchObject({
      origemDocumentId: 'doc-100', origemUrl: 'https://u/100', origemLinkPDF: 'https://p/100',
    });
  });

  it('citante ausente da base zera os trechos — evidência sem caminho não é gravada', async () => {
    mockDocs.mockResolvedValue([]);
    const dossie = {
      alvo: { numero: 1441, ano: 2016 },
      contagem: { citantesDistintos: 1, noVoto: 1, ocorrenciasTotal: 1 },
      trechos: [{ origemChave: '100/2020', secao: 'voto' as const, noVoto: true, trecho: 'unico', offset: 0 }],
    };
    await persistirDestilacao(
      { numero: 1441, ano: 2016 },
      { assunto: 'x', confianca: 'alta', teses: [{ enunciado: 'E1', inovacao: 'i', trechosFonte: [0] }], divergencias: [], sinaisQualitativos: [] },
      dossie,
    );
    const criados = ultimoTx.teseDestilacao.create.mock.calls[0][0].data.enunciados.create;
    expect(criados[0].trechos.create).toEqual([]);
  });

  it('grava a identidade oficial quando fornecida', async () => {
    await persistirDestilacao(
      { numero: 1441, ano: 2016 },
      { assunto: 'x', confianca: 'alta', teses: [], divergencias: [], sinaisQualitativos: [] },
      { alvo: { numero: 1441, ano: 2016 }, contagem: { citantesDistintos: 0, noVoto: 0, ocorrenciasTotal: 0 }, trechos: [] },
      { acordaoKey: 'ACORDAO-COMPLETO-9', colegiadoAlvo: 'Plenário', relatorAlvo: 'Rel', urlAlvo: 'https://x' },
    );
    const data = ultimoTx.teseDestilacao.create.mock.calls[0][0].data;
    expect(data.acordaoKey).toBe('ACORDAO-COMPLETO-9');
    expect(data.colegiadoAlvo).toBe('Plenário');
  });
```

- [ ] **Step 2: Escrever o teste de herança da retirada**

Ainda em `lib/tcu/persistir-tese.test.ts`:

```typescript
  it('herda a retirada em texto idêntico — tese retirada não ressuscita', async () => {
    mockAnterior.mockResolvedValue({
      id: 'ant', enunciados: [{
        id: 'e-ant', enunciado: 'E1', veredito: 'fiel',
        julgadoEm: new Date('2026-08-01'), julgadoPor: 'daniel',
        publicado: true, vitrinePublica: true,
        retiradoEm: new Date('2026-08-20'), retiradoMotivo: 'matéria de pessoal',
      }],
      divergencias: [],
    });
    await persistirDestilacao(
      { numero: 1441, ano: 2016 },
      { assunto: 'x', confianca: 'alta', teses: [{ enunciado: 'E1', inovacao: 'i', trechosFonte: [] }], divergencias: [], sinaisQualitativos: [] },
      { alvo: { numero: 1441, ano: 2016 }, contagem: { citantesDistintos: 0, noVoto: 0, ocorrenciasTotal: 0 }, trechos: [] },
    );
    const criado = ultimoTx.teseDestilacao.create.mock.calls[0][0].data.enunciados.create[0];
    expect(criado.retiradoEm).toEqual(new Date('2026-08-20'));
    expect(criado.retiradoMotivo).toBe('matéria de pessoal');
    expect(criado.publicado).toBe(true);
    expect(criado.vitrinePublica).toBe(true);
  });

  it('texto alterado não herda nada — volta à fila de julgamento', async () => {
    mockAnterior.mockResolvedValue({
      id: 'ant', enunciados: [{
        id: 'e-ant', enunciado: 'TEXTO ANTIGO', veredito: 'fiel',
        julgadoEm: new Date('2026-08-01'), julgadoPor: 'daniel',
        publicado: true, vitrinePublica: true, retiradoEm: null, retiradoMotivo: null,
      }],
      divergencias: [],
    });
    await persistirDestilacao(
      { numero: 1441, ano: 2016 },
      { assunto: 'x', confianca: 'alta', teses: [{ enunciado: 'TEXTO NOVO', inovacao: 'i', trechosFonte: [] }], divergencias: [], sinaisQualitativos: [] },
      { alvo: { numero: 1441, ano: 2016 }, contagem: { citantesDistintos: 0, noVoto: 0, ocorrenciasTotal: 0 }, trechos: [] },
    );
    const criado = ultimoTx.teseDestilacao.create.mock.calls[0][0].data.enunciados.create[0];
    expect(criado.veredito).toBeNull();
    expect(criado.publicado).toBe(false);
    expect(criado.vitrinePublica).toBe(false);
    expect(criado.retiradoEm).toBeNull();
  });
```

Se o arquivo ainda não tiver um `mockAnterior` para `teseDestilacao.findFirst`, adicioná-lo ao bloco `vi.hoisted` existente e ao mock do Prisma, no mesmo padrão dos outros mocks do arquivo.

- [ ] **Step 3: Rodar para confirmar que falha**

Run: `npx vitest run lib/tcu/persistir-tese.test.ts`
Expected: FAIL nos 5 testes novos — `trechos` não é gerado, `identidade` não é aceita, retirada não é herdada.

- [ ] **Step 4: Estender a herança de veredito**

Em `lib/tcu/carregar-veredito.ts`, ampliar o retorno de `carregarVeredito` para carregar também o estado editorial:

```typescript
export function carregarVeredito(
  enunciadoNovo: string,
  anteriores: Array<EnunciadoJulgavel & {
    julgadoEm: Date | null;
    julgadoPor: string | null;
    publicado?: boolean;
    vitrinePublica?: boolean;
    retiradoEm?: Date | null;
    retiradoMotivo?: string | null;
  }>
): VeredictoHerdado {
  const par = anteriores.find((a) => a.veredito !== null && a.enunciado === enunciadoNovo);
  if (!par) return { ...SEM_VEREDITO };
  return {
    veredito: par.veredito,
    herdadoDe: par.id,
    julgadoEm: par.julgadoEm,
    julgadoPor: par.julgadoPor,
    // O estado editorial acompanha o veredito quando o TEXTO é idêntico.
    // A retirada em especial: sem herdá-la, redestilar ressuscitaria uma tese
    // que alguém tirou do ar de propósito (spec §5).
    publicado: par.publicado ?? false,
    vitrinePublica: par.vitrinePublica ?? false,
    retiradoEm: par.retiradoEm ?? null,
    retiradoMotivo: par.retiradoMotivo ?? null,
  };
}
```

Atualizar `SEM_VEREDITO` no mesmo arquivo para incluir `publicado: false, vitrinePublica: false, retiradoEm: null, retiradoMotivo: null`, e o tipo `VeredictoHerdado` para os quatro campos novos.

- [ ] **Step 5: Gravar os trechos e a identidade em `persistirDestilacao`**

Em `lib/tcu/persistir-tese.ts`, adicionar o import e um helper acima da função:

```typescript
import { indicesDeclarados } from './elegibilidade-tese';

/**
 * Resolve os índices declarados contra o dossiê EM MÃOS — aqui não há
 * reconstrução nem verificação a fazer: o cron acabou de montar este dossiê,
 * então os índices casam por construção.
 *
 * Tudo ou nada: se qualquer índice declarado estiver fora do dossiê, devolve
 * lista vazia. Evidência parcial faria a tese parecer fundamentada pela metade
 * (spec §6, EVIDENCIA_INTEGRAL).
 */
function trechosParaGravar(
  trechosFonte: unknown,
  dossie: DossieUso,
  porChave: Map<string, DocCitante>,
): Array<Record<string, unknown>> {
  const indices = indicesDeclarados(trechosFonte);
  if (indices.length === 0) return [];
  const linhas: Array<Record<string, unknown>> = [];
  for (const i of indices) {
    const t = dossie.trechos[i];
    if (!t) return []; // índice fora do dossiê invalida o enunciado inteiro
    const [num, ano] = t.origemChave.split('/');
    const origemNumero = parseInt(num, 10);
    const origemAno = parseInt(ano, 10);
    if (!Number.isFinite(origemNumero) || !Number.isFinite(origemAno)) return [];
    const doc = porChave.get(t.origemChave) ?? null;
    // Invariante da spec §7.1: todo trecho consumível tem ao menos um caminho
    // para o inteiro teor. Sem nenhum, o enunciado inteiro fica sem evidência.
    if (!doc?.id && !doc?.url && !doc?.tcuLinkPDF) return [];
    linhas.push({
      ordem: i,
      trecho: t.trecho,
      origemNumero,
      origemAno,
      origemColegiado: doc?.tcuOrgaoJulgador ?? null,
      origemUrl: doc?.url ?? null,
      origemLinkPDF: doc?.tcuLinkPDF ?? null,
      origemDocumentId: doc?.id ?? null,
      noVoto: t.noVoto,
    });
  }
  return linhas;
}

interface DocCitante {
  id: string;
  acordaoNumero: number | null;
  acordaoAno: number | null;
  tcuOrgaoJulgador: string | null;
  url: string | null;
  tcuLinkPDF: string | null;
}

/**
 * Mapa chave->Document dos acórdãos CITANTES do dossiê, para os trechos
 * carregarem o caminho até o inteiro teor. Uma consulta por destilação.
 */
async function citantesDoDossie(dossie: DossieUso): Promise<Map<string, DocCitante>> {
  const pares = [...new Set(dossie.trechos.map((t) => t.origemChave))]
    .map((c) => c.split('/'))
    .map(([n, a]) => ({ numero: parseInt(n, 10), ano: parseInt(a, 10) }))
    .filter((p) => Number.isFinite(p.numero) && Number.isFinite(p.ano));
  if (pares.length === 0) return new Map();
  const docs = await prisma.document.findMany({
    where: { OR: pares.map((p) => ({ acordaoNumero: p.numero, acordaoAno: p.ano })) },
    select: { id: true, acordaoNumero: true, acordaoAno: true, tcuOrgaoJulgador: true, url: true, tcuLinkPDF: true },
  });
  return new Map(docs.map((d) => [`${d.acordaoNumero}/${d.acordaoAno}`, d]));
}
```

Alterar a assinatura e o mapeamento dos enunciados:

```typescript
export interface IdentidadeAlvo {
  acordaoKey: string;
  colegiadoAlvo: string | null;
  relatorAlvo: string | null;
  urlAlvo: string | null;
}

export async function persistirDestilacao(
  alvo: { numero: number; ano: number },
  tese: TeseDestilada,
  dossie: DossieUso,
  identidade?: IdentidadeAlvo | null,
): Promise<{ destilacaoId: string; herdados: number; novos: number }> {
```

No `include` do `findFirst` de `anterior`, acrescentar os campos editoriais ao `select` dos enunciados:

```typescript
      enunciados: {
        select: {
          id: true, enunciado: true, veredito: true, julgadoEm: true, julgadoPor: true,
          publicado: true, vitrinePublica: true, retiradoEm: true, retiradoMotivo: true,
        },
      },
```

Antes do `map` que monta `enunciados`, carregar o mapa dos citantes numa consulta só:

```typescript
  const porChave = await citantesDoDossie(dossie);
```

No `map` que monta `enunciados`, acrescentar os trechos:

```typescript
    return {
      ordem: i,
      enunciado: t.enunciado,
      inovacao: t.inovacao,
      trechosFonte: t.trechosFonte as unknown as object,
      ...h,
      trechos: { create: trechosParaGravar(t.trechosFonte, dossie, porChave) },
    };
```

E no `create` da destilação, os campos de identidade:

```typescript
        dossieNoVoto: dossie.contagem.noVoto,
        acordaoKey: identidade?.acordaoKey ?? null,
        colegiadoAlvo: identidade?.colegiadoAlvo ?? null,
        relatorAlvo: identidade?.relatorAlvo ?? null,
        urlAlvo: identidade?.urlAlvo ?? null,
```

- [ ] **Step 6: Rodar os testes**

Run: `npx vitest run lib/tcu/persistir-tese.test.ts`
Expected: PASS em todos, incluindo os que já existiam.

- [ ] **Step 7: Rodar o módulo**

Run: `npx vitest run lib/tcu`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add lib/tcu/persistir-tese.ts lib/tcu/carregar-veredito.ts lib/tcu/persistir-tese.test.ts
git commit -m "feat: evidência e identidade gravadas no ato da destilação

Fecha a torneira antes de esvaziar o balde: sem isso cada destilação nova
nasceria com a mesma evidência volátil que o backfill vai consertar no
passivo. Aqui não há reconstrução — o cron acabou de montar o dossiê, e
os índices casam por construção.

Gravação tudo-ou-nada: índice fora do dossiê zera os trechos do enunciado,
que então fica inelegível. Evidência parcial faria a tese parecer
fundamentada pela metade.

A herança por texto idêntico passa a carregar o estado editorial,
inclusive a retirada — sem isso, redestilar ressuscitaria uma tese tirada
do ar de propósito."
```

---

### Task 6: Backfill da identidade oficial

**Files:**
- Create: `scripts/backfill-identidade-teses.ts`
- Test: `lib/tcu/resolver-identidade.test.ts`
- Create: `lib/tcu/resolver-identidade.ts`

**Interfaces:**
- Consumes: `escolherCandidato` (Task 2), `buscarAcordaoPorNumero`, schema (Task 3).
- Produces: `resolverIdentidade(numero, ano): Promise<IdentidadeAlvo | null>` — consumido pela Task 7.

- [ ] **Step 1: Escrever os testes de resolução**

Criar `lib/tcu/resolver-identidade.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockBuscar } = vi.hoisted(() => ({ mockBuscar: vi.fn() }));
vi.mock('./buscar-acordao-tcu', async () => {
  const real = await vi.importActual<typeof import('./buscar-acordao-tcu')>('./buscar-acordao-tcu');
  return { ...real, buscarAcordaoPorNumero: (...a: unknown[]) => mockBuscar(...a) };
});

import { resolverIdentidade } from './resolver-identidade';

const cand = (key: string, colegiado: string, isRelacao = false) => ({
  numero: 56, ano: 2024, colegiado, relator: 'Rel X', ementa: '', key,
  link: `https://pesquisa.apps.tcu.gov.br/documento/${key.toLowerCase()}`, isRelacao,
});

describe('resolverIdentidade', () => {
  beforeEach(() => vi.clearAllMocks());

  it('candidato único resolve com key, colegiado, relator e url', async () => {
    mockBuscar.mockResolvedValue([cand('ACORDAO-COMPLETO-1', 'Plenário')]);
    const r = await resolverIdentidade(56, 2024);
    expect(r).toEqual({
      acordaoKey: 'ACORDAO-COMPLETO-1',
      colegiadoAlvo: 'Plenário',
      relatorAlvo: 'Rel X',
      urlAlvo: 'https://pesquisa.apps.tcu.gov.br/documento/acordao-completo-1',
    });
  });

  it('dois candidatos não-relação → null por ambiguidade', async () => {
    mockBuscar.mockResolvedValue([
      cand('ACORDAO-COMPLETO-1', 'Plenário'),
      cand('ACORDAO-COMPLETO-2', 'Primeira Câmara'),
    ]);
    expect(await resolverIdentidade(56, 2024)).toBeNull();
  });

  it('nenhum candidato → null', async () => {
    mockBuscar.mockResolvedValue([]);
    expect(await resolverIdentidade(56, 2024)).toBeNull();
  });

  it('falha de rede → null, sem lançar e sem gravar identidade errada', async () => {
    mockBuscar.mockRejectedValue(new Error('ETIMEDOUT'));
    expect(await resolverIdentidade(56, 2024)).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar para confirmar que falha**

Run: `npx vitest run lib/tcu/resolver-identidade.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar `resolverIdentidade`**

Criar `lib/tcu/resolver-identidade.ts`:

```typescript
/**
 * Resolve a identidade oficial de um acórdão contra o TCU (spec §4.2).
 *
 * A identidade NÃO vem da nossa base nem do grafo: o colegiado do grafo é
 * extraído por regex do texto de quem cita e discorda da base em casos reais,
 * e em 39 das 93 teses o acórdão-líder sequer existe como Document.
 */
import { buscarAcordaoPorNumero, escolherCandidato } from './buscar-acordao-tcu';

export interface IdentidadeAlvo {
  acordaoKey: string;
  colegiadoAlvo: string | null;
  relatorAlvo: string | null;
  urlAlvo: string | null;
}

export async function resolverIdentidade(numero: number, ano: number): Promise<IdentidadeAlvo | null> {
  let candidatos;
  try {
    candidatos = await buscarAcordaoPorNumero(numero, ano);
  } catch {
    // Falha de rede não é ambiguidade: devolve null e o alvo continua na fila
    // para a próxima passada, sem gravar identidade errada.
    return null;
  }
  const escolhido = escolherCandidato(candidatos);
  if (!escolhido) return null;
  return {
    acordaoKey: escolhido.key,
    colegiadoAlvo: escolhido.colegiado || null,
    relatorAlvo: escolhido.relator,
    urlAlvo: escolhido.link || null,
  };
}
```

- [ ] **Step 4: Rodar os testes**

Run: `npx vitest run lib/tcu/resolver-identidade.test.ts`
Expected: PASS nos 4.

- [ ] **Step 5: Escrever o script de backfill**

Criar `scripts/backfill-identidade-teses.ts`:

```typescript
/**
 * Resolve a identidade oficial das destilações atuais contra o TCU.
 *
 * Sem identidade resolvida a destilação fica fora de TODOS os consumidores
 * (spec §6), então este backfill é pré-requisito de qualquer publicação.
 *
 * Uso:
 *   npx tsx scripts/backfill-identidade-teses.ts              # dry-run
 *   npx tsx scripts/backfill-identidade-teses.ts --executar
 *   npx tsx scripts/backfill-identidade-teses.ts --executar --limit 20
 */
import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { resolverIdentidade } from '../lib/tcu/resolver-identidade';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter, log: ['error'] });

const DELAY_MS = 1000; // 1 req/s — educado com o TCU
const dorme = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const args = process.argv.slice(2);
  const executar = args.includes('--executar');
  const i = args.indexOf('--limit');
  const limit = i >= 0 && args[i + 1] ? parseInt(args[i + 1], 10) : undefined;

  const alvos = await prisma.teseDestilacao.findMany({
    where: { atual: true, acordaoKey: null },
    select: { id: true, numeroAlvo: true, anoAlvo: true },
    orderBy: [{ numeroAlvo: 'asc' }, { anoAlvo: 'asc' }],
    ...(limit ? { take: limit } : {}),
  });

  console.log(`\n=== IDENTIDADE OFICIAL DAS TESES ===\n`);
  console.log(`Destilações sem identidade: ${alvos.length}`);
  console.log(executar ? 'Modo: EXECUTAR\n' : 'Modo: dry-run (nada será gravado)\n');

  let resolvidos = 0, ambiguos = 0;
  for (const a of alvos) {
    const ident = await resolverIdentidade(a.numeroAlvo, a.anoAlvo);
    await dorme(DELAY_MS);
    if (!ident) {
      ambiguos++;
      console.log(`  ?  ${a.numeroAlvo}/${a.anoAlvo} — ambíguo ou não encontrado`);
      continue;
    }
    resolvidos++;
    console.log(`  ok ${a.numeroAlvo}/${a.anoAlvo} — ${ident.colegiadoAlvo} (${ident.acordaoKey})`);
    if (executar) {
      await prisma.teseDestilacao.update({ where: { id: a.id }, data: ident });
    }
  }

  console.log(`\nResolvidos: ${resolvidos} · sem identidade: ${ambiguos}`);
  if (!executar) console.log('\nPara aplicar: --executar\n');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 6: Rodar o dry-run com limite pequeno**

Run: `npx tsx scripts/backfill-identidade-teses.ts --limit 5`
Expected: lista 5 alvos com `ok` ou `?`, e a linha final "Para aplicar: --executar". Nada gravado.

- [ ] **Step 7: Executar o backfill completo**

Run: `npx tsx scripts/backfill-identidade-teses.ts --executar`
Expected: ~265 alvos a 1 req/s (~5 min). Anotar o total de resolvidos e ambíguos — esse número entra no relatório final da onda.

- [ ] **Step 8: Conferir no banco**

```bash
npx tsx -e "import('./lib/prisma').then(async ({prisma})=>{const r=await prisma.\$queryRawUnsafe('SELECT count(*) FILTER (WHERE \"acordaoKey\" IS NOT NULL)::int AS com, count(*)::int AS total FROM \"TeseDestilacao\" WHERE atual = true');console.log(r[0]);process.exit(0)})"
```
Expected: `com` próximo de `total`, com a diferença sendo os ambíguos relatados no Step 7.

- [ ] **Step 9: Commit**

```bash
git add lib/tcu/resolver-identidade.ts lib/tcu/resolver-identidade.test.ts scripts/backfill-identidade-teses.ts
git commit -m "feat: identidade oficial das teses resolvida contra o TCU

A identidade não vem da nossa base nem do grafo: o colegiado do grafo é
regex sobre o texto de quem cita e discorda da base em casos reais
(2007/2025 e 2515/2023), e em 39 das 93 teses o acórdão-líder sequer
existe como Document.

Falha de rede devolve null em vez de lançar, para o alvo continuar na
fila em vez de gravar identidade errada."
```

---

### Task 7: Backfill da evidência histórica

A janela fecha com o tempo: cada dia de crescimento do grafo aumenta a chance de a reconstrução não casar. Esta é a task urgente da onda.

**Files:**
- Create: `scripts/backfill-evidencia-teses.ts`
- Test: `lib/tcu/reconstruir-evidencia.test.ts`
- Create: `lib/tcu/reconstruir-evidencia.ts`

**Interfaces:**
- Consumes: `coletarTrechosDoAlvo` com `ateData` (Task 1), `indicesDeclarados` (Task 4), schema (Task 3).
- Produces: `reconstruirEvidencia(destilacao, enunciados): Promise<ResultadoReconstrucao>`.

- [ ] **Step 1: Escrever os testes**

Criar `lib/tcu/reconstruir-evidencia.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockColetar, mockDocs } = vi.hoisted(() => ({ mockColetar: vi.fn(), mockDocs: vi.fn() }));
vi.mock('./trechos-de-citacao', () => ({ coletarTrechosDoAlvo: (...a: unknown[]) => mockColetar(...a) }));
vi.mock('../prisma', () => ({ prisma: { document: { findMany: (...a: unknown[]) => mockDocs(...a) } } }));

import { reconstruirEvidencia } from './reconstruir-evidencia';

const dossieCom = (n: number) => ({
  alvo: { numero: 1441, ano: 2016 },
  contagem: { citantesDistintos: n, noVoto: n, ocorrenciasTotal: n },
  trechos: Array.from({ length: n }, (_, i) => ({
    origemChave: `${100 + i}/2020`, secao: 'voto' as const, noVoto: true,
    trecho: `trecho ${i}`, offset: 0,
  })),
});

const destilacao = { id: 'd1', numeroAlvo: 1441, anoAlvo: 2016, criadoEm: new Date('2026-08-01'), dossieTrechos: 3 };

describe('reconstruirEvidencia', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDocs.mockResolvedValue([
      { id: 'doc-100', acordaoNumero: 100, acordaoAno: 2020, tcuOrgaoJulgador: 'Plenário', url: 'https://u/100', tcuLinkPDF: 'https://p/100' },
    ]);
  });

  it('reconstrói com o corte temporal da destilação', async () => {
    mockColetar.mockResolvedValue(dossieCom(3));
    await reconstruirEvidencia(destilacao, [{ id: 'e1', trechosFonte: [0] }]);
    expect(mockColetar).toHaveBeenCalledWith(
      { numero: 1441, ano: 2016 },
      { ateData: new Date('2026-08-01') },
    );
  });

  it('recusa quando a contagem não casa com dossieTrechos', async () => {
    mockColetar.mockResolvedValue(dossieCom(5)); // gravado 3, agora 5
    const r = await reconstruirEvidencia(destilacao, [{ id: 'e1', trechosFonte: [0] }]);
    expect(r.status).toBe('contagem-divergente');
    expect(r.linhasPorEnunciado).toEqual({});
  });

  it('copia url e pdf do citante para o trecho', async () => {
    mockColetar.mockResolvedValue(dossieCom(3));
    const r = await reconstruirEvidencia(destilacao, [{ id: 'e1', trechosFonte: [0] }]);
    expect(r.status).toBe('ok');
    expect(r.linhasPorEnunciado['e1'][0]).toMatchObject({
      ordem: 0, origemNumero: 100, origemAno: 2020,
      origemDocumentId: 'doc-100', origemUrl: 'https://u/100', origemLinkPDF: 'https://p/100',
    });
  });

  it('descarta o enunciado inteiro quando um índice declarado está fora do dossiê', async () => {
    mockColetar.mockResolvedValue(dossieCom(3));
    const r = await reconstruirEvidencia(destilacao, [{ id: 'e1', trechosFonte: [0, 9] }]);
    expect(r.linhasPorEnunciado['e1']).toBeUndefined();
  });

  it('descarta trecho sem nenhum caminho para o inteiro teor', async () => {
    mockDocs.mockResolvedValue([]); // citante não está na base
    mockColetar.mockResolvedValue(dossieCom(3));
    const r = await reconstruirEvidencia(destilacao, [{ id: 'e1', trechosFonte: [0] }]);
    // Sem Document, sem url e sem pdf: não há como conferir a evidência.
    expect(r.linhasPorEnunciado['e1']).toBeUndefined();
  });

  it('índices repetidos colapsam numa linha só', async () => {
    mockColetar.mockResolvedValue(dossieCom(3));
    const r = await reconstruirEvidencia(destilacao, [{ id: 'e1', trechosFonte: [0, 0] }]);
    expect(r.linhasPorEnunciado['e1']).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Rodar para confirmar que falha**

Run: `npx vitest run lib/tcu/reconstruir-evidencia.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

Criar `lib/tcu/reconstruir-evidencia.ts`:

```typescript
/**
 * Reconstrói a evidência de uma destilação já gravada (spec §7.2).
 *
 * Difere de `persistirDestilacao`, que grava a evidência com o dossiê em mãos:
 * aqui o dossiê já não existe e precisa ser recomposto do grafo no estado em
 * que estava na data da destilação. Por isso a verificação por contagem — e por
 * isso a urgência: cada dia de crescimento do grafo torna a reconstrução mais
 * frágil.
 */
import { coletarTrechosDoAlvo } from './trechos-de-citacao';
import { indicesDeclarados } from './elegibilidade-tese';
import { prisma } from '../prisma';

export interface LinhaTrecho {
  ordem: number;
  trecho: string;
  origemNumero: number;
  origemAno: number;
  origemColegiado: string | null;
  origemUrl: string | null;
  origemLinkPDF: string | null;
  origemDocumentId: string | null;
  noVoto: boolean;
}

export interface ResultadoReconstrucao {
  status: 'ok' | 'contagem-divergente';
  linhasPorEnunciado: Record<string, LinhaTrecho[]>;
  descartados: number;
}

export async function reconstruirEvidencia(
  destilacao: { id: string; numeroAlvo: number; anoAlvo: number; criadoEm: Date; dossieTrechos: number },
  enunciados: Array<{ id: string; trechosFonte: unknown }>,
): Promise<ResultadoReconstrucao> {
  const dossie = await coletarTrechosDoAlvo(
    { numero: destilacao.numeroAlvo, ano: destilacao.anoAlvo },
    { ateData: destilacao.criadoEm },
  );

  // A guarda que impede exibir evidência trocada. Não protege os alvos
  // saturados no teto de 40 — lá a contagem continua batendo enquanto o
  // conteúdo muda — mas é o sinal disponível, e o corte por criadoEm é o que
  // efetivamente reconstrói o conjunto certo.
  if (dossie.trechos.length !== destilacao.dossieTrechos) {
    return { status: 'contagem-divergente', linhasPorEnunciado: {}, descartados: enunciados.length };
  }

  const chaves = [...new Set(dossie.trechos.map((t) => t.origemChave))];
  const pares = chaves
    .map((c) => c.split('/'))
    .map(([n, a]) => ({ numero: parseInt(n, 10), ano: parseInt(a, 10) }))
    .filter((p) => Number.isFinite(p.numero) && Number.isFinite(p.ano));

  const docs = await prisma.document.findMany({
    where: { OR: pares.map((p) => ({ acordaoNumero: p.numero, acordaoAno: p.ano })) },
    select: { id: true, acordaoNumero: true, acordaoAno: true, tcuOrgaoJulgador: true, url: true, tcuLinkPDF: true },
  });
  const porChave = new Map(docs.map((d) => [`${d.acordaoNumero}/${d.acordaoAno}`, d]));

  const linhasPorEnunciado: Record<string, LinhaTrecho[]> = {};
  let descartados = 0;

  for (const e of enunciados) {
    const indices = indicesDeclarados(e.trechosFonte);
    if (indices.length === 0) { descartados++; continue; }

    const linhas: LinhaTrecho[] = [];
    let invalido = false;
    for (const i of indices) {
      const t = dossie.trechos[i];
      if (!t) { invalido = true; break; }
      const [n, a] = t.origemChave.split('/');
      const origemNumero = parseInt(n, 10);
      const origemAno = parseInt(a, 10);
      if (!Number.isFinite(origemNumero) || !Number.isFinite(origemAno)) { invalido = true; break; }
      const doc = porChave.get(t.origemChave) ?? null;
      // Invariante da spec §7.1: todo trecho consumível tem ao menos um
      // caminho para o inteiro teor. Sem nenhum, não se grava.
      if (!doc?.id && !doc?.url && !doc?.tcuLinkPDF) { invalido = true; break; }
      linhas.push({
        ordem: i,
        trecho: t.trecho,
        origemNumero,
        origemAno,
        origemColegiado: doc?.tcuOrgaoJulgador ?? null,
        origemUrl: doc?.url ?? null,
        origemLinkPDF: doc?.tcuLinkPDF ?? null,
        origemDocumentId: doc?.id ?? null,
        noVoto: t.noVoto,
      });
    }
    if (invalido) { descartados++; continue; }
    linhasPorEnunciado[e.id] = linhas;
  }

  return { status: 'ok', linhasPorEnunciado, descartados };
}
```

- [ ] **Step 4: Rodar os testes**

Run: `npx vitest run lib/tcu/reconstruir-evidencia.test.ts`
Expected: PASS nos 6.

- [ ] **Step 5: Escrever o script de backfill**

Criar `scripts/backfill-evidencia-teses.ts`:

```typescript
/**
 * Persiste a evidência das teses já destiladas, reconstruindo o dossiê
 * histórico (spec §7.2).
 *
 * URGENTE: a janela fecha com o crescimento do grafo. Cada dia aumenta a chance
 * de a contagem não casar e o enunciado ficar sem evidência para sempre.
 *
 * Idempotente: a gravação é um upsert por (enunciadoId, ordem) dentro de uma
 * transação por enunciado — reexecutar reescreve as mesmas linhas.
 *
 * Uso:
 *   npx tsx scripts/backfill-evidencia-teses.ts              # dry-run
 *   npx tsx scripts/backfill-evidencia-teses.ts --executar
 */
import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { reconstruirEvidencia } from '../lib/tcu/reconstruir-evidencia';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter, log: ['error'] });

async function main() {
  const executar = process.argv.includes('--executar');

  const destilacoes = await prisma.teseDestilacao.findMany({
    where: { atual: true, enunciados: { some: { veredito: 'fiel' } } },
    select: {
      id: true, numeroAlvo: true, anoAlvo: true, criadoEm: true, dossieTrechos: true,
      enunciados: { where: { veredito: 'fiel' }, select: { id: true, trechosFonte: true } },
    },
    orderBy: { criadoEm: 'asc' },
  });

  console.log(`\n=== EVIDÊNCIA DAS TESES ===\n`);
  console.log(`Destilações com tese fiel: ${destilacoes.length}`);
  console.log(executar ? 'Modo: EXECUTAR\n' : 'Modo: dry-run (nada será gravado)\n');

  let comEvidencia = 0, semEvidencia = 0, divergentes = 0, linhas = 0;

  for (const d of destilacoes) {
    const r = await reconstruirEvidencia(d, d.enunciados);
    if (r.status === 'contagem-divergente') {
      divergentes++;
      console.log(`  !  ${d.numeroAlvo}/${d.anoAlvo} — dossiê mudou desde a destilação`);
      continue;
    }
    for (const e of d.enunciados) {
      const ls = r.linhasPorEnunciado[e.id];
      if (!ls) { semEvidencia++; continue; }
      comEvidencia++;
      linhas += ls.length;
      if (executar) {
        await prisma.$transaction(
          ls.map((l) =>
            prisma.teseTrechoFonte.upsert({
              where: { enunciadoId_ordem: { enunciadoId: e.id, ordem: l.ordem } },
              create: { enunciadoId: e.id, ...l },
              update: { ...l },
            }),
          ),
        );
      }
    }
  }

  console.log(`\nEnunciados com evidência: ${comEvidencia} (${linhas} trechos)`);
  console.log(`Sem evidência: ${semEvidencia} · destilações com dossiê divergente: ${divergentes}`);
  if (!executar) console.log('\nPara aplicar: --executar\n');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 6: Rodar o dry-run**

Run: `npx tsx scripts/backfill-evidencia-teses.ts`
Expected: relatório com "Enunciados com evidência", "Sem evidência" e "dossiê divergente". Nada gravado. Anotar os três números.

- [ ] **Step 7: Executar**

Run: `npx tsx scripts/backfill-evidencia-teses.ts --executar`
Expected: mesmos números do dry-run, agora persistidos.

- [ ] **Step 8: Verificar a idempotência rodando de novo**

Run: `npx tsx scripts/backfill-evidencia-teses.ts --executar`
Expected: **exatamente os mesmos números**. Se o total de trechos mudar, o upsert não está colapsando por `(enunciadoId, ordem)` — parar e investigar antes de seguir.

- [ ] **Step 9: Commit**

```bash
git add lib/tcu/reconstruir-evidencia.ts lib/tcu/reconstruir-evidencia.test.ts scripts/backfill-evidencia-teses.ts
git commit -m "feat: backfill da evidência histórica das teses

Reconstrói o dossiê no estado em que estava na data da destilação, via
AcordaoCitacao.criadoEm, e persiste os trechos citados. Urgente porque a
janela fecha: cada dia de crescimento do grafo aumenta a chance de a
contagem não casar.

Tudo-ou-nada por enunciado: índice fora do dossiê, ou trecho sem caminho
para o inteiro teor, descarta o enunciado inteiro. Upsert por
(enunciadoId, ordem) em transação torna a reexecução idempotente."
```

---

### Task 8: Identidade no cron de destilação e retirada dos 3 enunciados

**Files:**
- Modify: `app/api/cron/destilar-teses-tcu/route.ts:73-95`
- Create: `scripts/retirar-teses.ts`
- Test: `lib/tcu/persistir-tese.test.ts` (já coberto na Task 5)

**Interfaces:**
- Consumes: `resolverIdentidade` (Task 6), `persistirDestilacao` com `identidade` (Task 5).
- Produces: nada para tasks seguintes desta onda.

- [ ] **Step 1: Passar a identidade no cron**

Em `app/api/cron/destilar-teses-tcu/route.ts`, dentro do `for (const c of candidatos)`, logo após `const proprio = escolherCandidato(cands);`, substituir por:

```typescript
        // Identidade oficial ANTES de gastar a destilação: sem ela a tese
        // ficaria fora de todos os consumidores (spec §6), e destilar para
        // depois descartar é gastar LLM à toa.
        const proprio = escolherCandidato(cands);
        if (!proprio) {
          ambiguos++;
          continue;
        }
        const identidade = {
          acordaoKey: proprio.key,
          colegiadoAlvo: proprio.colegiado || null,
          relatorAlvo: proprio.relator,
          urlAlvo: proprio.link || null,
        };
```

Declarar `let ambiguos = 0;` junto dos outros contadores (`let ok = 0, semTese = 0, erros = 0, herdadosTotal = 0;`), e passar a identidade na chamada:

```typescript
        const r = await persistirDestilacao({ numero: c.numero, ano: c.ano }, tese, dossie, identidade);
```

- [ ] **Step 2: Incluir o contador na telemetria**

No mesmo arquivo, acrescentar `ambiguos` ao objeto `corpo` e ao `metadata` do retorno:

```typescript
    corpo = {
      candidatos: candidatos.length,
      ok, semTese, erros, herdadosTotal, foraDaBase, semTema, ambiguos, processados,
      totalComTeseAtual: restam,
    };
```

```typescript
      metadata: { semTese, herdadosTotal, foraDaBase, semTema, ambiguos, totalComTeseAtual: restam },
```

- [ ] **Step 3: Verificar que o cron compila**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "destilar-teses|persistir-tese"`
Expected: sem saída (nenhum erro nesses arquivos).

- [ ] **Step 4: Escrever o script de retirada**

Criar `scripts/retirar-teses.ts`:

```typescript
/**
 * Retirada editorial de teses (spec §5).
 *
 * Torna o enunciado inelegível em TODOS os consumidores. `retiradoMotivo` é
 * obrigatório: retirada sem motivo registrado é retirada que ninguém consegue
 * auditar depois.
 *
 * Uso:
 *   npx tsx scripts/retirar-teses.ts --chave 1724/2025 --motivo "matéria de pessoal"
 *   npx tsx scripts/retirar-teses.ts --chave 1724/2025 --motivo "..." --executar
 */
import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter, log: ['error'] });

async function main() {
  const args = process.argv.slice(2);
  const val = (f: string) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
  const chave = val('--chave');
  const motivo = val('--motivo');
  const executar = args.includes('--executar');

  if (!chave || !motivo) {
    console.error('Uso: --chave <numero/ano> --motivo "<texto>" [--executar]');
    process.exit(1);
  }

  const alvos = await prisma.teseEnunciado.findMany({
    where: { destilacao: { chave, atual: true }, retiradoEm: null },
    select: { id: true, enunciado: true },
  });

  console.log(`\nTeses de ${chave} a retirar: ${alvos.length}`);
  for (const a of alvos) console.log(`  - ${a.enunciado.slice(0, 90)}...`);
  console.log(`\nMotivo: ${motivo}`);

  if (!executar) {
    console.log('\nDry-run. Para aplicar: --executar\n');
    return;
  }

  const r = await prisma.teseEnunciado.updateMany({
    where: { id: { in: alvos.map((a) => a.id) } },
    data: { retiradoEm: new Date(), retiradoMotivo: motivo, publicado: false, vitrinePublica: false },
  });
  console.log(`\nRetiradas: ${r.count}\n`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 5: Retirar os 3 enunciados de matéria estranha**

```bash
npx tsx scripts/retirar-teses.ts --chave 1724/2025 --motivo "matéria de pessoal: registro de ato de pensão, fora do escopo de licitações e contratos"
npx tsx scripts/retirar-teses.ts --chave 966/2025 --motivo "matéria de pessoal: aposentadoria e VBC de plano de carreira, fora do escopo do site"
```

Conferir a listagem de cada um e, se corresponder ao esperado, repetir com `--executar`.

- [ ] **Step 6: Conferir o estado final da onda**

```bash
npx tsx -e "import('./lib/prisma').then(async ({prisma})=>{const r=await prisma.\$queryRawUnsafe(\`SELECT count(*)::int AS fiel, count(*) FILTER (WHERE te.\\\"retiradoEm\\\" IS NULL)::int AS nao_retiradas, count(*) FILTER (WHERE td.\\\"acordaoKey\\\" IS NOT NULL)::int AS com_identidade, count(*) FILTER (WHERE EXISTS (SELECT 1 FROM \\\"TeseTrechoFonte\\\" t WHERE t.\\\"enunciadoId\\\" = te.id))::int AS com_evidencia FROM \\\"TeseEnunciado\\\" te JOIN \\\"TeseDestilacao\\\" td ON td.id = te.\\\"destilacaoId\\\" WHERE td.atual = true AND te.veredito = 'fiel'\`);console.log(r[0]);process.exit(0)})"
```
Expected: os quatro números. `com_identidade` e `com_evidencia` são o que a Onda 2 poderá publicar.

- [ ] **Step 7: Rodar a suíte inteira**

Run: `npx vitest run`
Expected: PASS. A contagem deve ser 2312 + os testes novos desta onda (~32).

- [ ] **Step 8: Commit**

```bash
git add app/api/cron/destilar-teses-tcu/route.ts scripts/retirar-teses.ts
git commit -m "feat: identidade oficial no cron e retirada editorial

O cron resolve a identidade ANTES de destilar e pula o alvo ambíguo —
destilar para depois descartar é gastar LLM à toa. O contador de ambíguos
entra na telemetria, para se ver quando o filtro passa a barrar demais.

retirar-teses exige motivo: retirada sem motivo registrado é retirada que
ninguém consegue auditar depois."
```

---

## Autorrevisão do plano

**Cobertura do spec (Onda 1, itens 1-6 da §14):**

| Item da sequência | Task |
|---|---|
| 1. Determinismo + `ateData` | Task 1 |
| 2. Migration (evidência, identidade, publicação) | Task 3 |
| 3. Cron grava identidade; `persistirDestilacao` grava evidência e herda retirada | Tasks 5 e 8 |
| 4. Backfill da identidade | Task 6 |
| 5. Backfill da evidência | Task 7 |
| 6. Retirada dos 3 enunciados | Task 8 |
| Predicado `ELEGIVEL_BASE` / `EVIDENCIA_INTEGRAL` (§6) | Task 4 |
| Contrato de `escolherCandidato` (§4.2) | Task 2 |

**Fora do escopo desta onda, por desenho:** publicação do acervo (§10.1), export ELIC (§8.2), rotas (§8.1), embeddings e busca (§9). Cada uma vira seu próprio plano.

**Consistência de tipos:** `IdentidadeAlvo` é definida na Task 5 (`persistir-tese.ts`) e reexportada pela Task 6 (`resolver-identidade.ts`) — na execução da Task 6, importar de `./persistir-tese` em vez de redeclarar, para não haver duas definições. `LinhaTrecho` (Task 7) tem os mesmos campos que o objeto montado por `trechosParaGravar` (Task 5), com a diferença deliberada de que a Task 5 grava `origemUrl`/`origemLinkPDF`/`origemDocumentId` como `null` (o cron não consulta `Document`) enquanto a Task 7 os preenche. A autorrevisão pegou aqui uma inconsistência, corrigida no próprio plano: na primeira versão a Task 5 gravava os três campos como `null`, o que violaria a invariante da spec §7.1 desde o primeiro dia — o cron produziria evidência sem caminho para o inteiro teor, e `evidenciaIntegral` não detectaria, porque ela só confere cobertura de índices. A Task 5 passou a consultar `Document` pelas chaves do dossiê, com a mesma regra de descarte da Task 7.
