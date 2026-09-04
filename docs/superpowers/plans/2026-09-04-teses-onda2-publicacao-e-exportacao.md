# Teses do TCU — Onda 2: publicação do acervo e exportação para o ELIC

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ligar o produto — publicar as teses elegíveis no acervo restrito e exportá-las para o acervo de RAG do ELIC, com a procedência de cada uma registrada.

**Architecture:** A Onda 1 deixou a evidência persistida e a identidade classificada em três níveis, mas `publicado` nasce `false`, então nada aparece. Esta onda tem duas metades independentes: um script que faz a passagem editorial (`publicar-acervo-teses`), e a entrada das teses no motor de exportação já existente (`runIncrementalExport`), que ganha uma capacidade nova — remover arquivos obsoletos, hoje inexistente.

**Tech Stack:** TypeScript, Prisma 7 (PrismaNeon), PostgreSQL (Neon), Vitest, tsx para scripts, Markdown com frontmatter YAML.

**Spec:** `docs/superpowers/specs/2026-09-04-publicacao-teses-tcu-design.md` — seções 6 (elegibilidade), 8.2 (ELIC) e 10.1 (publicação).

## Global Constraints

- **Diretório de trabalho:** `C:\Users\User\projetos\sitedobarral`. Rodar tudo da raiz.
- **Idioma:** comentários, mensagens de commit e saída de scripts em português, **com acentuação correta** — nunca "nao" por "não", "nivel" por "nível", "acordao" por "acórdão". Um commit da Onda 1 precisou ser refeito por violar isto.
- **Verificação obrigatória antes de reportar qualquer tarefa:** `npx vitest run` (suíte inteira) **e** `npx tsc --noEmit -p tsconfig.json`. Na linha de base desta onda: **2.978 testes passando e zero erros de tipo**. O vitest usa esbuild e não checa tipos — suíte verde não prova compilação.
- **Scripts de dado:** dry-run é o padrão; `--executar` aplica. Nenhum script desta onda escreve sem a flag.
- **Banco de produção:** `DATABASE_URL` aponta para produção. Nenhuma tarefa desta onda deve rodar script contra o banco — nem em dry-run. As execuções ficam com o usuário, depois da revisão.
- **Migrações:** o deploy usa `prisma migrate deploy`. Se alguma tarefa exigir mudança de schema, gere a migração **offline** (`prisma migrate diff --from-schema <schema de HEAD> --to-schema prisma/schema.prisma --script`, filtrando as linhas de log) e **não aplique**. Nenhuma tarefa deste plano deveria precisar disso.
- **Três arquivos são do usuário e não entram em commit algum:** `docs/audits/folha-teses-tcu-licitacoes.html`, `catalogacao-fontes-tcu-licitacoes.docx`, `.claude/settings.json`.
- **Staging explícito** — nunca `git add -A`.
- **Predicado canônico:** `WHERE_ELEGIVEL_BASE` e `evidenciaIntegral` vivem em `lib/tcu/elegibilidade-tese.ts`. Nenhuma tarefa reescreve a regra à mão; todas importam. `WHERE_ELEGIVEL_VITRINE` acrescenta a exigência de nível 1 e **não** é usada nesta onda (a vitrine é a Onda 3).
- **Números medidos em 04/09/2026**, para conferência: 265 destilações atuais (156 nível 1, 70 nível 2, 39 nível 3), 340 enunciados com evidência, 5.463 trechos, **90 enunciados elegíveis**.

---

### Task 1: Publicação do acervo restrito

`publicado` nasce `false` (spec §5), então hoje nenhuma tese apareceria mesmo que as rotas existissem. Este script é a passagem editorial que liga o produto.

**Files:**
- Create: `scripts/publicar-acervo-teses.ts`
- Create: `lib/tcu/publicar-acervo.ts`
- Test: `lib/tcu/publicar-acervo.test.ts`

**Interfaces:**
- Consumes: `WHERE_ELEGIVEL_BASE` e `evidenciaIntegral` de `lib/tcu/elegibilidade-tese.ts`.
- Produces: `selecionarParaPublicar(): Promise<{ publicaveis: string[]; foraPorMotivo: Record<string, number> }>` — ids dos enunciados a publicar e a contagem agregada do que ficou de fora, por motivo. Consumida pelo script.

- [ ] **Step 1: Escrever o teste da seleção**

Criar `lib/tcu/publicar-acervo.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockEnunciados } = vi.hoisted(() => ({ mockEnunciados: vi.fn() }));
vi.mock('../prisma', () => ({
  prisma: { teseEnunciado: { findMany: (...a: unknown[]) => mockEnunciados(...a) } },
}));

import { selecionarParaPublicar } from './publicar-acervo';

const enunciado = (over: Record<string, unknown> = {}) => ({
  id: 'e1',
  trechosFonte: [0],
  trechos: [{ ordem: 0, origemDocumentId: 'd1', origemUrl: null, origemLinkPDF: null }],
  ...over,
});

describe('selecionarParaPublicar', () => {
  beforeEach(() => vi.clearAllMocks());

  it('consulta usando o predicado canônico e publicado false', async () => {
    mockEnunciados.mockResolvedValue([]);
    await selecionarParaPublicar();
    const where = mockEnunciados.mock.calls[0][0].where;
    expect(where.veredito).toBe('fiel');
    expect(where.retiradoEm).toBeNull();
    expect(where.publicado).toBe(false);
  });

  it('publica o enunciado com evidência íntegra', async () => {
    mockEnunciados.mockResolvedValue([enunciado()]);
    const r = await selecionarParaPublicar();
    expect(r.publicaveis).toEqual(['e1']);
  });

  it('exclui evidência incompleta e conta o motivo', async () => {
    // declara dois índices, só um persistido
    mockEnunciados.mockResolvedValue([enunciado({ trechosFonte: [0, 1] })]);
    const r = await selecionarParaPublicar();
    expect(r.publicaveis).toEqual([]);
    expect(r.foraPorMotivo['evidência incompleta']).toBe(1);
  });

  it('exclui trecho sem caminho para o inteiro teor', async () => {
    mockEnunciados.mockResolvedValue([
      enunciado({ trechos: [{ ordem: 0, origemDocumentId: null, origemUrl: null, origemLinkPDF: null }] }),
    ]);
    const r = await selecionarParaPublicar();
    expect(r.publicaveis).toEqual([]);
    expect(r.foraPorMotivo['evidência incompleta']).toBe(1);
  });
});
```

- [ ] **Step 2: Rodar para confirmar que falha**

Run: `npx vitest run lib/tcu/publicar-acervo.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar a seleção**

Criar `lib/tcu/publicar-acervo.ts`:

```typescript
/**
 * A passagem editorial que liga o acervo restrito (spec §10.1).
 *
 * `publicado` nasce false, então sem este passo as rotas da Onda 3 existiriam
 * sem nada para mostrar. Não exige conferência individual: o acervo é material
 * de trabalho para quem tem acesso ativo, exibido com a evidência ao lado, e a
 * curadoria caso a caso é justamente o que não escala. A vitrine pública, essa
 * sim, exige (§10.2) — e é a Onda 3.
 */
import { prisma } from '../prisma';
import { WHERE_ELEGIVEL_BASE, evidenciaIntegral } from './elegibilidade-tese';

export interface ResultadoSelecao {
  publicaveis: string[];
  foraPorMotivo: Record<string, number>;
}

export async function selecionarParaPublicar(): Promise<ResultadoSelecao> {
  // O filtro SQL cobre veredito, retirada, versão atual e "tem algum trecho";
  // a integralidade da evidência não cabe em Prisma (compara contagem contra um
  // campo Json) e é conferida em memória logo abaixo.
  const candidatos = await prisma.teseEnunciado.findMany({
    where: { ...WHERE_ELEGIVEL_BASE, publicado: false },
    select: {
      id: true,
      trechosFonte: true,
      trechos: {
        select: { ordem: true, origemDocumentId: true, origemUrl: true, origemLinkPDF: true },
      },
    },
  });

  const publicaveis: string[] = [];
  const foraPorMotivo: Record<string, number> = {};
  const contar = (motivo: string) => {
    foraPorMotivo[motivo] = (foraPorMotivo[motivo] ?? 0) + 1;
  };

  for (const c of candidatos) {
    if (!evidenciaIntegral(c)) {
      contar('evidência incompleta');
      continue;
    }
    publicaveis.push(c.id);
  }

  return { publicaveis, foraPorMotivo };
}
```

- [ ] **Step 4: Rodar os testes**

Run: `npx vitest run lib/tcu/publicar-acervo.test.ts`
Expected: PASS nos 4.

- [ ] **Step 5: Escrever o script**

Criar `scripts/publicar-acervo-teses.ts`:

```typescript
/**
 * Publica no acervo restrito as teses elegíveis (spec §10.1).
 *
 * Uso:
 *   npx tsx scripts/publicar-acervo-teses.ts               # dry-run
 *   npx tsx scripts/publicar-acervo-teses.ts --executar
 *   npx tsx scripts/publicar-acervo-teses.ts --executar --limit 20
 *   npx tsx scripts/publicar-acervo-teses.ts --despublicar --executar
 *
 * `--despublicar` desfaz apenas o que este script fez: enunciados com
 * `publicado = true` e `vitrinePublica = false`. Não toca no que já foi
 * promovido à vitrine — despublicar por baixo de uma promoção editorial seria
 * desfazer decisão de outra pessoa.
 */
import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { selecionarParaPublicar } from '../lib/tcu/publicar-acervo';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter, log: ['error'] });

async function despublicar(executar: boolean) {
  const alvos = await prisma.teseEnunciado.findMany({
    where: { publicado: true, vitrinePublica: false },
    select: { id: true },
  });
  console.log(`\nA despublicar: ${alvos.length} enunciados`);
  console.log('(enunciados na vitrine não são tocados)');
  if (!executar) {
    console.log('\nDry-run. Para aplicar: --executar\n');
    return;
  }
  const r = await prisma.teseEnunciado.updateMany({
    where: { id: { in: alvos.map(a => a.id) } },
    data: { publicado: false },
  });
  console.log(`\nDespublicados: ${r.count}\n`);
}

async function main() {
  const args = process.argv.slice(2);
  const executar = args.includes('--executar');
  const i = args.indexOf('--limit');
  const limite = i >= 0 && args[i + 1] ? parseInt(args[i + 1], 10) : undefined;

  if (args.includes('--despublicar')) {
    await despublicar(executar);
    return;
  }

  const { publicaveis, foraPorMotivo } = await selecionarParaPublicar();
  const alvos = limite ? publicaveis.slice(0, limite) : publicaveis;

  console.log('\n=== PUBLICAÇÃO DO ACERVO RESTRITO ===\n');
  console.log(`Elegíveis e ainda não publicados: ${publicaveis.length}`);
  if (limite) console.log(`Limitado a: ${alvos.length}`);
  const fora = Object.entries(foraPorMotivo);
  if (fora.length > 0) {
    console.log('\nFicaram de fora:');
    for (const [motivo, n] of fora) console.log(`  ${motivo}: ${n}`);
  }
  console.log(executar ? '\nModo: EXECUTAR\n' : '\nModo: dry-run (nada será gravado)\n');

  if (!executar) {
    console.log('Para aplicar: --executar\n');
    return;
  }

  const r = await prisma.teseEnunciado.updateMany({
    where: { id: { in: alvos } },
    data: { publicado: true },
  });
  console.log(`Publicados: ${r.count}\n`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 6: Verificar tipos e suíte**

Run: `npx tsc --noEmit -p tsconfig.json` e `npx vitest run`
Expected: zero erros de tipo; suíte verde (2.978 + 4 novos).

**NÃO execute o script** — nem em dry-run. Ele conecta no banco de produção, e a execução fica com o usuário.

- [ ] **Step 7: Commit**

```bash
git add lib/tcu/publicar-acervo.ts lib/tcu/publicar-acervo.test.ts scripts/publicar-acervo-teses.ts
git commit -m "feat: publicação do acervo restrito das teses

publicado nasce false, então sem este passo as rotas da Onda 3 existiriam
sem nada para mostrar. O script é a passagem editorial que liga o produto.

Não exige conferência individual: o acervo é material de trabalho para
quem tem acesso ativo, exibido com a evidência ao lado, e curadoria caso a
caso não escala em centenas de teses. A vitrine pública exige, e é a
Onda 3.

--despublicar desfaz só o que este script fez (publicado sem vitrine),
para não desfazer promoção editorial de outra pessoa.

Não executado: a aplicação em produção fica com o usuário."
```

---

### Task 2: Geração do Markdown de uma tese

A peça pura: dado um acórdão-líder e suas teses elegíveis, produzir o arquivo. Separada da Task 3 porque é testável sem tocar no motor de exportação, e porque é onde mora a regra dos três níveis de procedência.

**Files:**
- Create: `lib/obsidian/tese-md.ts`
- Test: `lib/obsidian/tese-md.test.ts`

**Interfaces:**
- Consumes: `sanitizeFilename` e `yamlStr` de `lib/obsidian/export.ts` (leia o arquivo antes — siga o estilo dos geradores existentes, como `generateDecisionMd`).
- Produces:
  - `caminhoTese(d: DestilacaoParaExport): string` — ex. `teses/acordao-1441-2016-plenario.md`
  - `gerarTeseMd(d: DestilacaoParaExport): string`
  - `interface DestilacaoParaExport` — o shape que a Task 3 monta a partir do banco.

- [ ] **Step 1: Escrever os testes**

Criar `lib/obsidian/tese-md.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { caminhoTese, gerarTeseMd, type DestilacaoParaExport } from './tese-md';

const base: DestilacaoParaExport = {
  id: 'd1',
  numeroAlvo: 1441,
  anoAlvo: 2016,
  colegiadoAlvo: 'Plenário',
  relatorAlvo: 'Min. Fulano',
  acordaoKey: 'ACORDAO-COMPLETO-123',
  urlAlvo: 'https://pesquisa.apps.tcu.gov.br/documento/acordao-completo-123',
  origemIdentidade: 'tcu-oficial',
  citantesConcordantes: null,
  assunto: 'Prescrição da pretensão punitiva',
  confianca: 'alta',
  dossieNoVoto: 262,
  atualizadoEm: new Date('2026-09-04T12:00:00Z'),
  enunciados: [
    {
      id: 'e1',
      enunciado: 'A pretensão punitiva subordina-se ao prazo de dez anos.',
      inovacao: 'Fixou o prazo geral.',
      veredito: 'fiel',
      publicado: true,
      trechos: [
        {
          ordem: 0,
          trecho: 'Conforme o Acórdão 1441/2016, o prazo é decenal.',
          origemNumero: 100,
          origemAno: 2020,
          origemColegiado: 'Plenário',
          origemUrl: 'https://u/100',
          origemLinkPDF: null,
          noVoto: true,
        },
      ],
    },
  ],
};

describe('caminhoTese', () => {
  it('inclui o colegiado quando conhecido', () => {
    expect(caminhoTese(base)).toBe('teses/acordao-1441-2016-plenario.md');
  });

  it('omite o colegiado no nível 3 — não afirma no nome o que não afirma no corpo', () => {
    const semColegiado = { ...base, colegiadoAlvo: null, acordaoKey: null, origemIdentidade: null };
    expect(caminhoTese(semColegiado)).toBe('teses/acordao-1441-2016.md');
  });
});

describe('gerarTeseMd — frontmatter por nível', () => {
  it('nível 1 traz acordaoKey, fonteOficial e colegiado', () => {
    const md = gerarTeseMd(base);
    expect(md).toContain('origemIdentidade: tcu-oficial');
    expect(md).toContain('acordaoKey: ACORDAO-COMPLETO-123');
    expect(md).toContain('fonteOficial: https://pesquisa.apps.tcu.gov.br/documento/acordao-completo-123');
    expect(md).toContain('colegiado: Plenário');
  });

  it('nível 2 traz colegiado e citantesConcordantes, sem chave oficial', () => {
    const md = gerarTeseMd({
      ...base,
      acordaoKey: null,
      urlAlvo: null,
      origemIdentidade: 'convergencia-citantes',
      colegiadoAlvo: 'Segunda Câmara',
      citantesConcordantes: 23,
    });
    expect(md).toContain('origemIdentidade: convergencia-citantes');
    expect(md).toContain('colegiado: Segunda Câmara');
    expect(md).toContain('citantesConcordantes: 23');
    expect(md).not.toContain('acordaoKey:');
    expect(md).not.toContain('fonteOficial:');
  });

  it('nível 3 não afirma colegiado algum', () => {
    const md = gerarTeseMd({
      ...base, acordaoKey: null, urlAlvo: null, colegiadoAlvo: null, origemIdentidade: null,
    });
    expect(md).not.toContain('colegiado:');
    expect(md).not.toContain('acordaoKey:');
    expect(md).not.toContain('origemIdentidade:');
  });

  it('fonteSite só aparece quando alguma tese está publicada', () => {
    expect(gerarTeseMd(base)).toContain('fonteSite: https://profbarral.com.br/teses/1441-2016-plenario');
    const naoPublicada = { ...base, enunciados: [{ ...base.enunciados[0], publicado: false }] };
    expect(gerarTeseMd(naoPublicada)).not.toContain('fonteSite:');
  });
});

describe('gerarTeseMd — corpo', () => {
  it('traz o enunciado, a inovação e o trecho com o citante identificado', () => {
    const md = gerarTeseMd(base);
    expect(md).toContain('A pretensão punitiva subordina-se ao prazo de dez anos.');
    expect(md).toContain('Fixou o prazo geral.');
    expect(md).toContain('Conforme o Acórdão 1441/2016, o prazo é decenal.');
    expect(md).toContain('100/2020');
  });

  it('liga o trecho ao inteiro teor do citante quando há URL', () => {
    expect(gerarTeseMd(base)).toContain('https://u/100');
  });
});
```

- [ ] **Step 2: Rodar para confirmar que falha**

Run: `npx vitest run lib/obsidian/tese-md.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

Criar `lib/obsidian/tese-md.ts`. Leia antes `lib/obsidian/export.ts` e siga o estilo de um gerador existente (`generateDecisionMd`), inclusive o uso de `yamlStr` para escapar strings:

```typescript
/**
 * Gera o Markdown de um acórdão-líder e suas teses, para o acervo de RAG do
 * ELIC (spec §8.2).
 *
 * Um arquivo por acórdão-líder, não por tese: um enunciado isolado é uma frase
 * de súmula sem contexto, e a recuperação melhora quando as teses do mesmo
 * precedente, sua evidência e o relator chegam juntos.
 *
 * O frontmatter varia com o NÍVEL DE PROCEDÊNCIA (spec §4.3). Exigir
 * `acordaoKey` em todos deixaria 109 das 265 destilações inválidas — só 156
 * têm identidade oficial.
 */
import { sanitizeFilename, yamlStr } from './export';

export interface TrechoParaExport {
  ordem: number;
  trecho: string;
  origemNumero: number;
  origemAno: number;
  origemColegiado: string | null;
  origemUrl: string | null;
  origemLinkPDF: string | null;
  noVoto: boolean;
}

export interface EnunciadoParaExport {
  id: string;
  enunciado: string;
  inovacao: string;
  veredito: string | null;
  publicado: boolean;
  trechos: TrechoParaExport[];
}

export interface DestilacaoParaExport {
  id: string;
  numeroAlvo: number;
  anoAlvo: number;
  colegiadoAlvo: string | null;
  relatorAlvo: string | null;
  acordaoKey: string | null;
  urlAlvo: string | null;
  origemIdentidade: string | null;
  citantesConcordantes: number | null;
  assunto: string;
  confianca: string;
  dossieNoVoto: number;
  atualizadoEm: Date;
  enunciados: EnunciadoParaExport[];
}

/** Slug do colegiado para nome de arquivo: "Segunda Câmara" -> "segunda-camara". */
function slugColegiado(colegiado: string): string {
  return sanitizeFilename(
    colegiado.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '-'),
  );
}

export function caminhoTese(d: DestilacaoParaExport): string {
  const partes = ['acordao', String(d.numeroAlvo), String(d.anoAlvo)];
  // O colegiado entra no nome APENAS quando conhecido: nomear
  // "acordao-2298-2025-plenario.md" sem saber afirmaria no caminho do arquivo
  // o que a tese não afirma no corpo.
  if (d.colegiadoAlvo) partes.push(slugColegiado(d.colegiadoAlvo));
  return `teses/${partes.join('-')}.md`;
}

export function gerarTeseMd(d: DestilacaoParaExport): string {
  const publicada = d.enunciados.some(e => e.publicado);
  const fm: string[] = [
    '---',
    'tipo: tese-tcu',
    `acordao: ${yamlStr(`${d.numeroAlvo}/${d.anoAlvo}`)}`,
    `numero: ${d.numeroAlvo}`,
    `ano: ${d.anoAlvo}`,
  ];
  if (d.relatorAlvo) fm.push(`relator: ${yamlStr(d.relatorAlvo)}`);
  fm.push(`assunto: ${yamlStr(d.assunto)}`);
  fm.push(`teses: ${d.enunciados.length}`);
  fm.push(`citacoesNoVoto: ${d.dossieNoVoto}`);
  fm.push(`confianca: ${d.confianca}`);
  fm.push(`vereditos: [${d.enunciados.map(e => e.veredito ?? 'null').join(', ')}]`);
  fm.push(`destilacaoId: ${yamlStr(d.id)}`);
  fm.push(`atualizadoEm: ${d.atualizadoEm.toISOString()}`);

  if (d.origemIdentidade) fm.push(`origemIdentidade: ${d.origemIdentidade}`);
  if (d.colegiadoAlvo) fm.push(`colegiado: ${yamlStr(d.colegiadoAlvo)}`);
  if (d.acordaoKey) fm.push(`acordaoKey: ${d.acordaoKey}`);
  if (d.urlAlvo) fm.push(`fonteOficial: ${d.urlAlvo}`);
  if (d.citantesConcordantes !== null) fm.push(`citantesConcordantes: ${d.citantesConcordantes}`);
  if (publicada) {
    const slug = [d.numeroAlvo, d.anoAlvo].join('-');
    const comColegiado = d.colegiadoAlvo ? `${slug}-${slugColegiado(d.colegiadoAlvo)}` : slug;
    fm.push(`fonteSite: https://profbarral.com.br/teses/${comColegiado}`);
  }
  fm.push('---', '');

  const corpo: string[] = [
    `# Acórdão ${d.numeroAlvo}/${d.anoAlvo}${d.colegiadoAlvo ? ` — ${d.colegiadoAlvo}` : ''}`,
    '',
    d.assunto,
    '',
  ];

  if (d.origemIdentidade === 'convergencia-citantes') {
    corpo.push(
      `> Colegiado segundo os ${d.citantesConcordantes ?? 0} votos citantes que o informam, ` +
        `todos concordantes. Sem confirmação no registro oficial do TCU.`,
      '',
    );
  } else if (!d.colegiadoAlvo) {
    corpo.push('> Colegiado não identificado: o TCU registra mais de um acórdão com este número e ano, e os votos citantes não convergem.', '');
  }

  for (const e of d.enunciados) {
    corpo.push(`## ${e.enunciado}`, '');
    if (e.inovacao) corpo.push(`**Inovação:** ${e.inovacao}`, '');
    corpo.push('**Trechos que sustentam a tese:**', '');
    for (const t of e.trechos) {
      const origem = `Acórdão ${t.origemNumero}/${t.origemAno}${t.origemColegiado ? ` — ${t.origemColegiado}` : ''}`;
      const link = t.origemUrl ?? t.origemLinkPDF;
      corpo.push(`- ${origem}${t.noVoto ? ' (voto)' : ''}${link ? ` — ${link}` : ''}`);
      corpo.push(`  > ${t.trecho}`, '');
    }
  }

  return fm.join('\n') + corpo.join('\n') + '\n';
}
```

- [ ] **Step 4: Rodar os testes**

Run: `npx vitest run lib/obsidian/tese-md.test.ts`
Expected: PASS nos 8.

- [ ] **Step 5: Verificar tipos e suíte**

Run: `npx tsc --noEmit -p tsconfig.json` e `npx vitest run`
Expected: zero erros; suíte verde.

- [ ] **Step 6: Commit**

```bash
git add lib/obsidian/tese-md.ts lib/obsidian/tese-md.test.ts
git commit -m "feat: geração do Markdown das teses para o ELIC

Um arquivo por acórdão-líder, não por tese: um enunciado isolado é uma
frase de súmula sem contexto, e a recuperação melhora quando as teses do
mesmo precedente, sua evidência e o relator chegam juntos.

O frontmatter varia com o nível de procedência (spec §4.3). O colegiado
entra no nome do arquivo apenas quando conhecido — nomeá-lo sem saber
afirmaria no caminho o que a tese não afirma no corpo. No nível 2 o corpo
diz quantos votos citantes sustentam o colegiado; no nível 3 diz que ele
não foi identificado."
```

---

### Task 3: Teses no motor de exportação, com remoção de obsoletos

**Files:**
- Modify: `lib/obsidian/incremental-export.ts` (interface `ExportResult` ~linha 54; opções ~linha 63; montagem de `files` ~linha 240; escrita ~linha 250)
- Modify: `lib/obsidian/export.ts` (acrescentar `removerObsoletos`, junto de `writeVault` ~linha 864)
- Modify: `scripts/export-elic.ts` (ligar a flag e reportar)
- Test: `lib/obsidian/remover-obsoletos.test.ts`

**Interfaces:**
- Consumes: `caminhoTese`, `gerarTeseMd`, `DestilacaoParaExport` da Task 2; `WHERE_ELEGIVEL_BASE` e `evidenciaIntegral` de `lib/tcu/elegibilidade-tese.ts`.
- Produces: `IncrementalExportOptions.incluirTeses?: boolean`; `ExportResult.teses: number` e `ExportResult.filesRemoved: number`.

- [ ] **Step 1: Escrever o teste da remoção de obsoletos**

Criar `lib/obsidian/remover-obsoletos.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockReaddir, mockRm } = vi.hoisted(() => ({ mockReaddir: vi.fn(), mockRm: vi.fn() }));
vi.mock('fs/promises', async () => {
  const real = await vi.importActual<typeof import('fs/promises')>('fs/promises');
  return { ...real, readdir: (...a: unknown[]) => mockReaddir(...a), rm: (...a: unknown[]) => mockRm(...a) };
});

import { removerObsoletos } from './export';

describe('removerObsoletos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRm.mockResolvedValue(undefined);
  });

  it('remove o que não está no conjunto esperado', async () => {
    mockReaddir.mockResolvedValue(['a.md', 'b.md', 'c.md']);
    const n = await removerObsoletos('/destino', 'teses', new Set(['teses/a.md', 'teses/c.md']), false);
    expect(n).toBe(1);
    expect(mockRm).toHaveBeenCalledTimes(1);
    expect(String(mockRm.mock.calls[0][0])).toContain('b.md');
  });

  it('não remove nada quando tudo é esperado', async () => {
    mockReaddir.mockResolvedValue(['a.md']);
    const n = await removerObsoletos('/destino', 'teses', new Set(['teses/a.md']), false);
    expect(n).toBe(0);
    expect(mockRm).not.toHaveBeenCalled();
  });

  it('dry-run conta mas não remove', async () => {
    mockReaddir.mockResolvedValue(['a.md', 'b.md']);
    const n = await removerObsoletos('/destino', 'teses', new Set(['teses/a.md']), true);
    expect(n).toBe(1);
    expect(mockRm).not.toHaveBeenCalled();
  });

  it('diretório inexistente não é erro', async () => {
    mockReaddir.mockRejectedValue(Object.assign(new Error('nope'), { code: 'ENOENT' }));
    await expect(removerObsoletos('/destino', 'teses', new Set(), false)).resolves.toBe(0);
  });

  it('ignora arquivo que não termina em .md', async () => {
    mockReaddir.mockResolvedValue(['a.md', 'leia-me.txt']);
    const n = await removerObsoletos('/destino', 'teses', new Set(['teses/a.md']), false);
    expect(n).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar para confirmar que falha**

Run: `npx vitest run lib/obsidian/remover-obsoletos.test.ts`
Expected: FAIL — `removerObsoletos` não existe.

- [ ] **Step 3: Implementar a remoção**

Em `lib/obsidian/export.ts`, junto de `writeVault`:

```typescript
/**
 * Remove, de UM subdiretório, os arquivos que não estão no conjunto esperado.
 *
 * O motor nunca apagou nada. Sem isto, uma tese retirada, reprovada numa
 * redestilação ou que perdeu a evidência continuaria no acervo de RAG do ELIC
 * para sempre, sendo recuperada como se valesse (spec §8.2).
 *
 * O escopo é ESTRITAMENTE o subdiretório recebido: o destino é uma pasta do
 * OneDrive de trabalho com material de outras origens, e apagar fora dele
 * destruiria arquivo de terceiro. Por isso a função não recebe um caminho
 * livre nem varre recursivamente.
 */
export async function removerObsoletos(
  outputDir: string,
  subdiretorio: string,
  esperados: Set<string>,
  dryRun: boolean,
): Promise<number> {
  const dir = join(outputDir, subdiretorio);
  let entradas: string[];
  try {
    entradas = await readdir(dir);
  } catch {
    return 0; // diretório ainda não existe: nada a remover
  }

  let removidos = 0;
  for (const nome of entradas) {
    if (!nome.endsWith('.md')) continue;
    const relativo = `${subdiretorio}/${nome}`;
    if (esperados.has(relativo)) continue;
    removidos++;
    if (!dryRun) await rm(join(dir, nome));
  }
  return removidos;
}
```

Acrescente `readdir` e `rm` ao import de `fs/promises` no topo do arquivo.

- [ ] **Step 4: Rodar os testes da remoção**

Run: `npx vitest run lib/obsidian/remover-obsoletos.test.ts`
Expected: PASS nos 5.

- [ ] **Step 5: Buscar as teses e gerar os arquivos**

Em `lib/obsidian/incremental-export.ts`:

Acrescente à interface `IncrementalExportOptions`:

```typescript
  /**
   * Inclui as teses destiladas do TCU (subdiretório `teses/`).
   *
   * Default `false`: o cofre do Obsidian do professor não as recebe. O ELIC
   * liga, porque lá o destino é índice de RAG.
   */
  incluirTeses?: boolean;
```

Acrescente a `ExportResult`:

```typescript
  teses: number;
  filesRemoved: number;
```

E, no corpo, antes da escrita dos arquivos:

```typescript
    // -----------------------------------------------------------------------
    // Teses do TCU (spec §8.2)
    //
    // O subdiretório `teses/` é regenerado POR INTEIRO a cada exportação, não
    // por delta. A regra por delta tem um furo: quando uma tese DEIXA de ser
    // elegível, ela some do conjunto consultado e nada marca o arquivo como
    // desatualizado — o arquivo fica com a tese que já não vale ao lado das
    // que valem. Detectar isso exigiria consultar as quatro formas de sair;
    // como são algumas dezenas de arquivos pequenos, regenerar é mais barato
    // e correto por construção.
    // -----------------------------------------------------------------------
    let totalTeses = 0;
    const caminhosDeTese = new Set<string>();
    if (opts.incluirTeses) {
      const destilacoes = await prisma.teseDestilacao.findMany({
        where: { atual: true, enunciados: { some: WHERE_ELEGIVEL_BASE } },
        select: {
          id: true, numeroAlvo: true, anoAlvo: true, colegiadoAlvo: true,
          relatorAlvo: true, acordaoKey: true, urlAlvo: true,
          origemIdentidade: true, citantesConcordantes: true,
          assunto: true, confianca: true, dossieNoVoto: true,
          enunciados: {
            where: WHERE_ELEGIVEL_BASE,
            select: {
              id: true, enunciado: true, inovacao: true, veredito: true,
              publicado: true, trechosFonte: true, atualizadoEm: true,
              trechos: {
                orderBy: { ordem: 'asc' },
                select: {
                  ordem: true, trecho: true, origemNumero: true, origemAno: true,
                  origemColegiado: true, origemUrl: true, origemLinkPDF: true, noVoto: true,
                },
              },
            },
          },
        },
      });

      for (const d of destilacoes) {
        // A integralidade da evidência não cabe no filtro SQL (compara contagem
        // contra um campo Json), então é conferida aqui, enunciado a enunciado.
        const elegiveis = d.enunciados.filter(e => evidenciaIntegral(e));
        if (elegiveis.length === 0) continue;
        const atualizadoEm = elegiveis
          .map(e => e.atualizadoEm)
          .reduce((a, b) => (a > b ? a : b));
        const dados = { ...d, atualizadoEm, enunciados: elegiveis };
        const caminho = caminhoTese(dados);
        caminhosDeTese.add(caminho);
        files.push({ path: caminho, content: gerarTeseMd(dados) });
        totalTeses++;
      }
    }
```

Acrescente os imports no topo: `caminhoTese`, `gerarTeseMd` de `./tese-md`; `WHERE_ELEGIVEL_BASE`, `evidenciaIntegral` de `../tcu/elegibilidade-tese`.

- [ ] **Step 6: Ligar a remoção e reportar**

Ainda em `incremental-export.ts`, na escrita:

```typescript
    let removidos = 0;
    if (opts.dryRun) {
      console.log(`  [DRY RUN] ${files.length} arquivos seriam escritos`);
      if (opts.incluirTeses) {
        removidos = await removerObsoletos(opts.outputDir, 'teses', caminhosDeTese, true);
        console.log(`  [DRY RUN] ${removidos} arquivos obsoletos seriam removidos de teses/`);
      }
    } else {
      await writeVault(opts.outputDir, files);
      if (opts.incluirTeses) {
        removidos = await removerObsoletos(opts.outputDir, 'teses', caminhosDeTese, false);
      }
    }
```

E no retorno, acrescente `teses: totalTeses` e `filesRemoved: removidos`. Importe `removerObsoletos` de `./export`.

- [ ] **Step 7: Ligar no script do ELIC**

Em `scripts/export-elic.ts`, passe `incluirTeses: true` na chamada a `runIncrementalExport` (junto de `incluirCombustivelDoGrafo`), e acrescente as teses ao README que o script escreve, no mesmo padrão dos outros contadores. Reporte `filesRemoved` na saída.

- [ ] **Step 8: Verificar tipos e suíte**

Run: `npx tsc --noEmit -p tsconfig.json` e `npx vitest run`
Expected: zero erros; suíte verde. **Atenção:** `ExportResult` ganhou dois campos obrigatórios — se algum chamador construir esse objeto literalmente, o `tsc` vai acusar. Corrija o chamador, não afrouxe o tipo.

**NÃO rode `npm run export:elic`** — ele escreve na pasta do OneDrive e lê o banco de produção. A execução fica com o usuário.

- [ ] **Step 9: Commit**

```bash
git add lib/obsidian/export.ts lib/obsidian/incremental-export.ts lib/obsidian/remover-obsoletos.test.ts scripts/export-elic.ts
git commit -m "feat: teses no export do ELIC, com remoção de obsoletos

O subdiretório teses/ é regenerado por inteiro a cada exportação, não por
delta. A regra por delta tem um furo: quando uma tese DEIXA de ser
elegível, some do conjunto consultado e nada marca o arquivo como
desatualizado — ele fica com a tese que já não vale ao lado das que
valem. São algumas dezenas de arquivos pequenos; regenerar é mais barato
que detectar as quatro formas de sair.

A remoção de obsoletos é capacidade nova: o motor nunca apagou nada, e
sem ela uma tese retirada seguiria no acervo de RAG para sempre, sendo
recuperada como se valesse. O escopo é estritamente o subdiretório
teses/ — o destino é uma pasta do OneDrive com material de outras
origens, e apagar fora dele destruiria arquivo de terceiro."
```

---

## Autorrevisão do plano

**Cobertura do spec (Onda 2 — passos 7 a 9 da §14):**

| Item | Task |
|---|---|
| 7. `publicar-acervo-teses` | Task 1 |
| 8. Teses no `runIncrementalExport`, com regeneração integral de `teses/` | Tasks 2 e 3 |
| 9. `export:elic --full` inicial | Execução do usuário, fora do plano |
| §8.2 formato, frontmatter por nível, nome de arquivo | Task 2 |
| §8.2 remoção de obsoletos restrita a `teses/` | Task 3 |
| §10.1 `--despublicar` sem tocar na vitrine | Task 1 |

**Fora do escopo, por desenho:** as rotas web e a vitrine (Onda 3); embeddings e busca (Onda 4). O predicado `WHERE_ELEGIVEL_VITRINE` já existe e não é usado aqui.

**Consistência de tipos:** `DestilacaoParaExport` (Task 2) é o shape que a Task 3 monta com um `select` explícito; os nomes de campo do `select` batem um a um com a interface, incluindo `origemIdentidade` e `citantesConcordantes`, criados na Onda 1. `atualizadoEm` está em `TeseEnunciado`, não em `TeseDestilacao` — por isso a Task 3 o deriva pelo máximo dos enunciados elegíveis antes de montar o objeto, e a Task 2 o recebe pronto.

**Uma decisão que o executor deve conhecer:** a Task 3 filtra `evidenciaIntegral` em memória depois do `select`. Isso é deliberado e não é ineficiência a corrigir — a integralidade compara a contagem de trechos persistidos contra um campo `Json` (`trechosFonte`), e Prisma não expressa isso em `where`. O filtro SQL cobre o resto.
