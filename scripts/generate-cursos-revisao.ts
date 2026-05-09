/**
 * Gera estrutura de revisão dos cursos no vault Obsidian.
 *
 * Output: _workspace/cursos-revisao/
 *   ├── README.md                              (índice geral)
 *   ├── curso-10-contratacao-direta/
 *   │   ├── _INSTRUCOES_PROJETO.md             (cole no Cowork como instructions)
 *   │   ├── _INDICE.md                          (lista de lições com status)
 *   │   └── M1-L1_principios-diretrizes.md     (uma por lição)
 *   └── curso-4-processo-sancionador/          (esqueleto: a escrever do zero)
 *       ├── _INSTRUCOES_PROJETO.md
 *       └── _ESCOPO_INICIAL.md
 *
 * Uso: npx tsx scripts/generate-cursos-revisao.ts
 */

import { prisma } from '../lib/prisma';
import { courses } from '../data/courses';
import { promises as fs } from 'fs';
import { join, resolve } from 'path';

const VAULT_REVISAO = resolve(
  'C:/Users/User/projetos/Cofre do obsidian/Site do Barral/_workspace/cursos-revisao'
);

const ERRO_GRAVE_CURSO_ID = '10';

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

const CHECKLIST = `## ✅ Checklist de revisão

- [ ] **Artigos da Lei 14.133/2021** conferidos (número, redação, parágrafos)
- [ ] **Decretos regulamentadores** atualizados (ex.: 11.246/2022, 12.174/2024)
- [ ] **Jurisprudência citada** existe e diz o que se afirma (TCU/STJ/STF)
- [ ] **Doutrina** citada existe (autor, obra, edição corretas)
- [ ] **Sem afirmações categóricas** em matéria controvertida
- [ ] **Sem citações inventadas** ("alucinações" do gerador original)
- [ ] **Português correto** (sem mojibake, ortografia, concordância)
- [ ] **Coerência interna** (a lição não se contradiz)
- [ ] **Linguagem clara** (Lei 15.263/2025 adaptada ao contexto jurídico)
- [ ] **Exemplos práticos** atualizados e plausíveis

## 📝 Anotações da revisão

<!-- Cole aqui os erros encontrados e o que precisa mudar -->

`;

function makeInstrucoesParaRevisao(course: { id: string; title: string; bibliography: string[]; description: string }, totalLicoes: number) {
  const isCursoDoErro = course.id === ERRO_GRAVE_CURSO_ID;
  const alertaErro = isCursoDoErro
    ? `\n## ⚠️ ATENÇÃO: ESTE É O CURSO COM O ERRO GRAVE\n\nFoi a descoberta deste erro que motivou a reescrita de todos os cursos. **Atenção redobrada** ao revisar este material — pode haver outros erros do mesmo padrão que passaram batido.\n`
    : '';

  return `# Projeto Cowork — Curso ${course.id}: ${course.title}

## 📋 Cole o bloco abaixo como **Instruções do Projeto** no Claude.ai/Cowork
${alertaErro}
---

Você é meu assistente de **revisão técnica e pedagógica** do curso "${course.title}", que faço parte da plataforma profdanielbarral.com (autor: Daniel Barral, professor de Direito Administrativo, Licitações e Contratos).

### Contexto

Este curso tem **${totalLicoes} lições** já escritas que preciso revisar **uma a uma**. Encontrei um erro grave em uma das lições do Curso 10 (Contratação Direta) e, por isso, estou reescrevendo / revisando todo o material para garantir qualidade técnica.

### Como trabalharemos

Para cada lição:

1. Vou colar o conteúdo atual no chat (texto integral da lição).
2. Você faz a revisão **crítica e detalhada**, item por item, conferindo:
   - Citações de artigos da Lei 14.133/2021 (número, redação, parágrafos, incisos)
   - Citações de decretos regulamentadores (ex.: 11.246/2022, 12.174/2024)
   - Jurisprudência mencionada (TCU, STJ, STF) — número do acórdão, relator, ano, tese
   - Doutrina citada (autor, obra, edição correta)
   - Coerência interna da lição
   - Linguagem (Lei 15.263/2025 + boa redação jurídica)
3. Aponta **TODOS** os erros encontrados, mesmo os pequenos.
4. Sugere reescrita pontual das partes problemáticas (não reescrever o todo desnecessariamente).

### Regras inegociáveis

- **NÃO inventar citações de acórdãos, súmulas ou doutrina.** Se não tem certeza de que o acórdão existe, dizer "não tenho certeza, peço para conferir".
- **NÃO inventar números de artigos ou parágrafos.** Conferir sempre contra a Lei 14.133/2021 atualizada.
- Quando não souber, **dizer "não sei"** — não chutar.
- **Análise crítica, não superficial.** Quero qualidade tipo revisão de banca, não checagem de ortografia.
- Respostas em **português brasileiro formal**, mas didáticas (sou eu que vou ler e aplicar).

### Bibliografia base do curso

${course.bibliography.map(b => `- ${b}`).join('\n')}

### Ementa oficial

${course.description.trim()}

---

## 📂 Como usar este projeto

1. Crie um projeto novo no Claude.ai chamado **"Curso ${course.id} — ${course.title}"**
2. Cole as instruções acima na seção **"Instruções do Projeto"**
3. Faça **upload da bibliografia** (PDFs/links) na seção **"Project Knowledge"** se tiver
4. Para cada lição neste diretório (\`MN-LK_*.md\`):
   - Abra o arquivo
   - Copie o conteúdo da seção **"📄 Conteúdo atual no banco"**
   - Cole numa nova conversa do projeto Cowork
   - Use o checklist como roteiro da revisão
5. Anote o resultado da revisão na seção **"📝 Anotações da revisão"** do mesmo arquivo
6. Quando terminar, marque o status no \`_INDICE.md\` deste curso

---

## ⚙️ Aplicação das correções no banco (depois)

Depois que tiver as anotações de revisão, posso te ajudar a:

- Aplicar as correções diretamente no banco (\`Lesson.content\`)
- Gerar diff visual antes de aplicar
- Re-indexar os embeddings da lição corrigida (\`scripts/migrate-to-embeddings.ts\`)
- Notificar alunos da atualização (newsletter / push)

Basta me chamar com o checklist preenchido em mãos.
`;
}

function makeInstrucoesParaEscritaZero(course: { id: string; title: string; bibliography: string[]; description: string }) {
  return `# Projeto Cowork — Curso ${course.id}: ${course.title} (a escrever do zero)

## 📋 Status

- **0 lições no banco** (apenas módulo placeholder)
- Conteúdo a ser **escrito do zero**

---

## 📋 Cole o bloco abaixo como **Instruções do Projeto** no Claude.ai/Cowork

---

Você é meu coautor para escrever do zero o curso "${course.title}", que faz parte da plataforma profdanielbarral.com (autor: Daniel Barral, professor de Direito Administrativo, Licitações e Contratos).

### Ementa oficial

${course.description.trim()}

### Como trabalharemos

1. Primeiro, **definimos juntos a estrutura do curso**: módulos e lições, com base na ementa.
2. Depois, **escrevemos lição por lição**, no padrão das demais (10-25mil chars, didático, com base legal, jurisprudência e exemplos).
3. Cada lição tem:
   - Introdução (contexto e relevância)
   - Base legal (artigos da Lei 14.133/2021 e regulamentos)
   - Desenvolvimento (conceitos, requisitos, procedimentos)
   - Jurisprudência aplicável (TCU, STJ, STF)
   - Aspectos práticos (modelos, checklists, casos)
   - Síntese / pontos de atenção

### Regras inegociáveis

- **NÃO inventar citações.** Acórdão, súmula, doutrina — só citar o que existe e está conferido.
- **NÃO inventar artigos.** Conferir Lei 14.133/2021 atualizada.
- Quando não souber, **dizer "não sei"** — pedir para eu conferir antes.
- **Português brasileiro formal e didático.**
- Linguagem alinhada à Lei 15.263/2025 (Linguagem Simples) **adaptada** ao contexto jurídico — clareza sem perder rigor.

### Bibliografia base

${course.bibliography.map(b => `- ${b}`).join('\n')}

### Padrão dos cursos existentes (para referência)

Os cursos 2 (Planejamento), 3 (Gestão e Fiscalização) e 10 (Contratação Direta) já estão escritos. Use o padrão deles como referência de:

- Tom didático
- Profundidade técnica (~13-22mil chars por lição)
- Estrutura de módulos (5-8 lições por módulo, 6 módulos por curso)
- Citações jurisprudenciais por tópico

---

## 🗂️ Próximos passos

1. Definir estrutura: ver \`_ESCOPO_INICIAL.md\` deste diretório
2. Criar projeto no Cowork e colar as instruções acima
3. Escrever módulo a módulo, lição a lição
4. Quando concluído, me chamar para popular no banco (criar \`Module\` + \`Lesson\` no Prisma)
`;
}

function makeEscopoInicial(course: { id: string; title: string; description: string }) {
  return `# Escopo Inicial — Curso ${course.id}: ${course.title}

## Ementa

${course.description.trim()}

## Estrutura sugerida

> Esta é apenas uma sugestão. Defina a estrutura final junto com o assistente no projeto Cowork.

### Módulo 1 — Fundamentos
- L1: Introdução e contexto na Lei 14.133/2021
- L2: Base constitucional e princípios aplicáveis
- L3: ...

### Módulo 2 — [a definir]
- ...

### Módulo 3 — [a definir]
- ...

### Módulo 4 — [a definir]
- ...

### Módulo 5 — [a definir]
- ...

### Módulo 6 — Aspectos práticos e jurisprudência
- ...

## Padrão de referência

Os cursos 2, 3 e 10 (que já estão escritos) seguem este padrão:

| Curso | Módulos | Lições | Chars/lição |
|---|---|---|---|
| 2 — Planejamento | 6 | 37 | ~13mil |
| 3 — Gestão e Fiscalização | 6 | 38 | ~14mil |
| 10 — Contratação Direta | 6 | 29 | ~22mil |

**Padrão recomendado**: ~30-35 lições, ~15mil chars/lição.
`;
}

function makeIndice(
  course: { id: string; title: string },
  modules: Array<{ displayOrder: number; title: string; lessons: Array<{ displayOrder: number; title: string; content: string | null }> }>
) {
  const totalLicoes = modules.reduce((s, m) => s + m.lessons.length, 0);
  let md = `# Índice de Revisão — Curso ${course.id}: ${course.title}

**Total: ${modules.length} módulos, ${totalLicoes} lições**

| Status | Significado |
|---|---|
| ⬜ Pendente | Ainda não revisada |
| 🟡 Em revisão | Em andamento no Cowork |
| 🟢 Revisada | Anotações prontas (esperando aplicação no banco) |
| ✅ Aplicada | Correções já no banco de produção |

---

`;
  for (const m of modules) {
    md += `## M${m.displayOrder} — ${m.title}\n\n`;
    if (m.lessons.length === 0) {
      md += '*(sem lições)*\n\n';
      continue;
    }
    for (const l of m.lessons) {
      const slug = slugify(l.title);
      const filename = `M${m.displayOrder}-L${l.displayOrder}_${slug}.md`;
      const chars = l.content?.length || 0;
      md += `- ⬜ [${filename}](${filename}) — L${l.displayOrder} ${l.title} _(${chars.toLocaleString('pt-BR')} chars)_\n`;
    }
    md += '\n';
  }
  return md;
}

function makeLicaoFile(
  course: { id: string; title: string },
  module: { displayOrder: number; title: string },
  lesson: { displayOrder: number; title: string; content: string | null; id: string }
) {
  const charsAtual = lesson.content?.length || 0;
  const today = new Date().toISOString().slice(0, 10);

  return `---
curso: "${course.id} - ${course.title}"
modulo: "M${module.displayOrder} - ${module.title}"
licao: "L${lesson.displayOrder} - ${lesson.title}"
lessonId: "${lesson.id}"
status: "pendente-revisao"
charsAtual: ${charsAtual}
charsRevisado: null
ultimaAtualizacao: "${today}"
---

# M${module.displayOrder}.L${lesson.displayOrder} — ${lesson.title}

> **Curso:** ${course.title} (id ${course.id})
> **Módulo:** M${module.displayOrder} — ${module.title}
> **Lição:** L${lesson.displayOrder}

${CHECKLIST}
---

## 📄 Conteúdo atual no banco

${lesson.content || '*(sem conteúdo)*'}
`;
}

function makeReadmeGeral(stats: Array<{ id: string; title: string; total: number; status: 'revisao' | 'esqueleto' }>) {
  const revisao = stats.filter(s => s.status === 'revisao');
  const esqueleto = stats.filter(s => s.status === 'esqueleto');
  const totalLicoes = revisao.reduce((s, c) => s + c.total, 0);

  return `# 🎓 Cursos — Revisão e Reescrita

Estrutura de trabalho para revisão e reescrita dos cursos da plataforma profdanielbarral.com no Claude.ai/Cowork.

## 📚 Cursos a revisar (já têm conteúdo)

**${totalLicoes} lições** distribuídas em ${revisao.length} cursos:

${revisao.map(c => `- 📖 [curso-${c.id}-${slugify(c.title)}/](curso-${c.id}-${slugify(c.title)}/) — **${c.title}** (${c.total} lições)`).join('\n')}

## ✏️ Cursos a escrever do zero (esqueletos)

${esqueleto.map(c => `- 🆕 [curso-${c.id}-${slugify(c.title)}/](curso-${c.id}-${slugify(c.title)}/) — **${c.title}** (sem lições)`).join('\n')}

## 🚀 Como usar

1. **Para cada curso**, crie um projeto no Claude.ai/Cowork chamado *"Curso XX — Título"*
2. Abra o arquivo \`_INSTRUCOES_PROJETO.md\` da pasta do curso e cole o conteúdo como **Instruções do Projeto** no Cowork
3. Para cursos a revisar: trabalhe lição por lição, abrindo cada arquivo \`MN-LK_*.md\`, copiando o conteúdo e colando no chat
4. Anote os erros e correções diretamente no arquivo da lição (seção *Anotações da revisão*)
5. Quando terminar uma lição, atualize o status no \`_INDICE.md\` do curso
6. Me chame quando tiver as correções prontas para aplicar no banco

## ⚠️ Erro grave

O **Curso 10 (Contratação Direta)** é o que motivou esta reescrita — atenção redobrada ao revisá-lo.

---

_Gerado em ${new Date().toLocaleDateString('pt-BR')} a partir do banco de produção._
`;
}

async function main() {
  console.log(`Output: ${VAULT_REVISAO}`);

  await fs.mkdir(VAULT_REVISAO, { recursive: true });

  const allModules = await prisma.module.findMany({
    include: {
      lessons: {
        select: { id: true, title: true, displayOrder: true, content: true },
        orderBy: { displayOrder: 'asc' },
      },
    },
    orderBy: [{ courseId: 'asc' }, { displayOrder: 'asc' }],
  });

  const modulesByCourse = new Map<string, typeof allModules>();
  for (const m of allModules) {
    if (!modulesByCourse.has(m.courseId)) modulesByCourse.set(m.courseId, []);
    modulesByCourse.get(m.courseId)!.push(m);
  }

  const stats: Array<{ id: string; title: string; total: number; status: 'revisao' | 'esqueleto' }> = [];

  for (const course of courses) {
    const mods = modulesByCourse.get(course.id) || [];
    const totalLicoes = mods.reduce((s, m) => s + m.lessons.length, 0);
    const courseDir = join(VAULT_REVISAO, `curso-${course.id}-${slugify(course.title)}`);
    await fs.mkdir(courseDir, { recursive: true });

    if (totalLicoes > 0) {
      // Modo revisão
      console.log(`\n[curso ${course.id}] revisão — ${mods.length} módulos, ${totalLicoes} lições`);
      await fs.writeFile(
        join(courseDir, '_INSTRUCOES_PROJETO.md'),
        makeInstrucoesParaRevisao(course, totalLicoes),
        'utf8'
      );
      await fs.writeFile(join(courseDir, '_INDICE.md'), makeIndice(course, mods), 'utf8');

      for (const m of mods) {
        for (const l of m.lessons) {
          const slug = slugify(l.title);
          const filename = `M${m.displayOrder}-L${l.displayOrder}_${slug}.md`;
          await fs.writeFile(join(courseDir, filename), makeLicaoFile(course, m, l), 'utf8');
        }
      }
      stats.push({ id: course.id, title: course.title, total: totalLicoes, status: 'revisao' });
    } else {
      // Modo esqueleto
      console.log(`[curso ${course.id}] esqueleto — escrita do zero`);
      await fs.writeFile(
        join(courseDir, '_INSTRUCOES_PROJETO.md'),
        makeInstrucoesParaEscritaZero(course),
        'utf8'
      );
      await fs.writeFile(join(courseDir, '_ESCOPO_INICIAL.md'), makeEscopoInicial(course), 'utf8');
      stats.push({ id: course.id, title: course.title, total: 0, status: 'esqueleto' });
    }
  }

  await fs.writeFile(join(VAULT_REVISAO, 'README.md'), makeReadmeGeral(stats), 'utf8');

  console.log(`\n✓ Estrutura criada em ${VAULT_REVISAO}`);
  console.log(`  - ${stats.filter(s => s.status === 'revisao').length} cursos com conteúdo`);
  console.log(`  - ${stats.filter(s => s.status === 'esqueleto').length} esqueletos`);
  console.log(`  - ${stats.reduce((s, c) => s + c.total, 0)} arquivos de lição`);

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
