import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../lib/prisma';
import { courses as staticCourses } from '../data/courses';

const OUTPUT_DIR = path.resolve(process.cwd(), 'docs', 'curso-revisao');
const COURSE_IDS = ['2', '3', '4', '7', '8', '10'];

function indent(text: string, prefix: string): string {
  return text
    .split('\n')
    .map((l) => (l.trim() ? `${prefix}${l}` : ''))
    .join('\n');
}

function hr(): string {
  return '---';
}

async function exportCourse(courseId: string): Promise<string> {
  const meta = staticCourses.find((c) => c.id === courseId);
  if (!meta) throw new Error(`Curso ${courseId} não está em /data/courses.ts`);

  const modules = await prisma.module.findMany({
    where: { courseId },
    orderBy: { displayOrder: 'asc' },
    include: {
      lessons: {
        orderBy: { displayOrder: 'asc' },
        include: {
          documents: {
            orderBy: { displayOrder: 'asc' },
            include: {
              document: { select: { id: true, title: true, category: true, url: true, douUrl: true, summary: true } },
            },
          },
          videos: { orderBy: { displayOrder: 'asc' } },
          quiz: {
            include: {
              questions: { orderBy: { displayOrder: 'asc' } },
            },
          },
        },
      },
    },
  });

  const status = await prisma.courseStatus.findUnique({ where: { courseId } });

  const lines: string[] = [];
  lines.push(`# Revisão editorial — ${meta.title}`);
  lines.push('');
  lines.push(`- **ID interno:** ${courseId}`);
  lines.push(`- **Slug:** \`${meta.slug}\``);
  lines.push(`- **Status:** ${status?.isSuspended ? '🚫 SUSPENSO' : '✅ ativo'}`);
  if (status?.suspendedAt) {
    lines.push(`- **Suspenso em:** ${status.suspendedAt.toISOString().slice(0, 10)}`);
  }
  lines.push(`- **Total de módulos:** ${modules.length}`);
  lines.push(`- **Total de lições:** ${modules.reduce((acc, m) => acc + m.lessons.length, 0)}`);
  lines.push('');

  lines.push('## Ementa do curso (de `/data/courses.ts`)');
  lines.push('');
  lines.push(`**Resumo curto:** ${meta.shortDescription}`);
  lines.push('');
  lines.push('**Descrição completa:**');
  lines.push('');
  lines.push(meta.description.trim());
  lines.push('');
  lines.push('**Bibliografia oficial declarada:**');
  for (const b of meta.bibliography || []) lines.push(`- ${b}`);
  lines.push('');
  lines.push(hr());
  lines.push('');

  if (modules.length === 0) {
    lines.push('> ⚠️ Curso sem módulos cadastrados.');
    return lines.join('\n');
  }

  lines.push('## Conteúdo atual (a ser revisado)');
  lines.push('');

  for (const mod of modules) {
    lines.push(`### Módulo ${mod.displayOrder + 1} — ${mod.title}`);
    lines.push('');
    lines.push(`- **isPublished:** ${mod.isPublished}`);
    if (mod.description) {
      lines.push('');
      lines.push(`> ${mod.description.replace(/\n+/g, '\n> ')}`);
    }
    lines.push('');

    if (mod.lessons.length === 0) {
      lines.push('> Sem lições cadastradas.');
      lines.push('');
      continue;
    }

    for (const lesson of mod.lessons) {
      lines.push(`#### Aula ${mod.displayOrder + 1}.${lesson.displayOrder + 1} — ${lesson.title}`);
      lines.push('');
      lines.push(`- **Slug:** \`${lesson.slug}\``);
      lines.push(`- **isPublished:** ${lesson.isPublished}`);
      if (lesson.estimatedMinutes) lines.push(`- **Tempo estimado:** ${lesson.estimatedMinutes} min`);
      const leiArticles = lesson.leiArticles ? JSON.parse(lesson.leiArticles) : [];
      if (Array.isArray(leiArticles) && leiArticles.length > 0) {
        lines.push(`- **Artigos da Lei 14.133/2021 vinculados:** ${leiArticles.join(', ')}`);
      }
      lines.push('');

      if (lesson.description) {
        lines.push('**Descrição:**');
        lines.push('');
        lines.push(lesson.description.trim());
        lines.push('');
      }

      if (lesson.content) {
        lines.push('**Conteúdo textual atual:**');
        lines.push('');
        lines.push('```markdown');
        lines.push(lesson.content.trim());
        lines.push('```');
        lines.push('');
      } else {
        lines.push('> _(sem conteúdo textual)_');
        lines.push('');
      }

      if (lesson.aiSummary) {
        lines.push('**Resumo IA atual:**');
        lines.push('');
        lines.push(`> ${lesson.aiSummary.replace(/\n+/g, '\n> ')}`);
        lines.push('');
      }

      const keyPoints = lesson.aiKeyPoints ? JSON.parse(lesson.aiKeyPoints) : [];
      if (Array.isArray(keyPoints) && keyPoints.length > 0) {
        lines.push('**Pontos-chave (IA atual):**');
        for (const kp of keyPoints) lines.push(`- ${kp}`);
        lines.push('');
      }

      if (lesson.documents.length > 0) {
        lines.push('**Documentos vinculados:**');
        for (const ld of lesson.documents) {
          const required = ld.isRequired ? ' (obrigatório)' : '';
          lines.push(`- [${ld.document.category}] ${ld.document.title}${required}`);
          if (ld.document.url) lines.push(`  - URL: ${ld.document.url}`);
          if (ld.document.douUrl) lines.push(`  - DOU: ${ld.document.douUrl}`);
          if (ld.note) lines.push(`  - Nota do prof: ${ld.note}`);
        }
        lines.push('');
      }

      if (lesson.videos.length > 0) {
        lines.push('**Vídeos vinculados:**');
        for (const v of lesson.videos) {
          lines.push(`- [${v.title}](${v.youtubeUrl})${v.isRequired ? ' (obrigatório)' : ''}`);
          if (v.description) lines.push(`  - ${v.description}`);
        }
        lines.push('');
      }

      if (lesson.quiz) {
        lines.push('**Quiz:**');
        lines.push('');
        lines.push(`- Título: ${lesson.quiz.title}`);
        lines.push(`- Nota mínima: ${lesson.quiz.passingScore}%`);
        lines.push(`- Tentativas máx.: ${lesson.quiz.maxAttempts ?? 'ilimitadas'}`);
        for (const q of lesson.quiz.questions) {
          lines.push('');
          lines.push(`  **Q${q.displayOrder + 1}.** ${q.text}`);
          let parsedOptions: Array<{ text: string; isCorrect: boolean }> = [];
          try {
            parsedOptions = JSON.parse(q.options);
          } catch {
            // ignore
          }
          for (const opt of parsedOptions) {
            const mark = opt.isCorrect ? '✓' : ' ';
            lines.push(`  - [${mark}] ${opt.text}`);
          }
          if (q.explanation) lines.push(`  - _Explicação:_ ${q.explanation}`);
        }
        lines.push('');
      }

      lines.push(hr());
      lines.push('');
    }
  }

  lines.push('## Checklist de revisão (uso interno)');
  lines.push('');
  lines.push('Para cada aula, conferir:');
  lines.push('');
  lines.push('- [ ] Citações de lei e decreto conferidas no Planalto');
  lines.push('- [ ] Citações de IN/Portaria SEGES/MGI conferidas na fonte oficial');
  lines.push('- [ ] Jurisprudência do TCU citada continua vigente (não foi superada)');
  lines.push('- [ ] Súmulas/Enunciados citados continuam em vigor');
  lines.push('- [ ] Exemplos práticos plausíveis e juridicamente corretos');
  lines.push('- [ ] Cross-link com Lei 14.133 comentada do site (artigos vinculados)');
  lines.push('- [ ] Linguagem alinhada ao tom autoral do Prof. Barral');
  lines.push('- [ ] Sem alucinações (artigos inexistentes, decretos imaginários)');
  lines.push('');

  return lines.join('\n');
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  for (const courseId of COURSE_IDS) {
    const meta = staticCourses.find((c) => c.id === courseId);
    if (!meta) {
      console.log(`Pulando curso ${courseId}: não está em /data/courses.ts`);
      continue;
    }
    const md = await exportCourse(courseId);
    const filename = path.join(OUTPUT_DIR, `${meta.slug}.md`);
    await fs.writeFile(filename, md, 'utf-8');
    console.log(`✅ ${meta.slug}.md (${md.length} chars)`);
  }

  await prisma.$disconnect();
  console.log(`\nArquivos em: ${OUTPUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
