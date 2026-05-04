import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { prisma } from '../lib/prisma';

interface LessonFrontmatter {
  courseId: string;
  moduleSlug: string;
  moduleTitle: string;
  moduleDescription?: string;
  moduleDisplayOrder?: number;
  lessonSlug: string;
  title: string;
  description?: string;
  displayOrder?: number;
  estimatedMinutes?: number;
  leiArticles?: number[];
  aiSummary?: string;
  aiKeyPoints?: string[];
  isPublished?: boolean;
}

interface ParsedLesson {
  filePath: string;
  fm: LessonFrontmatter;
  content: string;
}

const REQUIRED_FIELDS: Array<keyof LessonFrontmatter> = [
  'courseId',
  'moduleSlug',
  'moduleTitle',
  'lessonSlug',
  'title',
];

function parseArgs(argv: string[]): { courseSlug: string; dryRun: boolean; baseDir: string } {
  const args = argv.slice(2);
  let courseSlug = '';
  let dryRun = false;
  let baseDir = path.resolve(process.cwd(), 'docs', 'curso-revisao', 'imports');

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--course' && args[i + 1]) {
      courseSlug = args[++i];
    } else if (args[i] === '--dryRun' || args[i] === '--dry-run') {
      dryRun = true;
    } else if (args[i] === '--dir' && args[i + 1]) {
      baseDir = path.resolve(args[++i]);
    } else if (!courseSlug && !args[i].startsWith('--')) {
      courseSlug = args[i];
    }
  }

  if (!courseSlug) {
    console.error('Uso: tsx scripts/import-revised-course.ts <courseSlug> [--dryRun] [--dir path]');
    console.error('Exemplo: tsx scripts/import-revised-course.ts contratacao-direta --dryRun');
    process.exit(1);
  }

  return { courseSlug, dryRun, baseDir };
}

async function loadLessons(courseDir: string): Promise<ParsedLesson[]> {
  const entries = await fs.readdir(courseDir, { withFileTypes: true });
  const files = entries
    .filter(
      (e) =>
        e.isFile() &&
        e.name.endsWith('.md') &&
        !e.name.startsWith('_') &&
        e.name.toLowerCase() !== 'readme.md',
    )
    .map((e) => path.join(courseDir, e.name))
    .sort();

  const lessons: ParsedLesson[] = [];
  for (const filePath of files) {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = matter(raw);
    const fm = parsed.data as LessonFrontmatter;

    for (const field of REQUIRED_FIELDS) {
      if (!fm[field]) {
        throw new Error(`${path.basename(filePath)}: frontmatter obrigatório "${field}" está faltando.`);
      }
    }

    lessons.push({ filePath, fm, content: parsed.content.trim() });
  }
  return lessons;
}

interface ApplyResult {
  modulesCreated: number;
  modulesUpdated: number;
  lessonsCreated: number;
  lessonsUpdated: number;
  errors: string[];
}

async function applyLessons(
  lessons: ParsedLesson[],
  dryRun: boolean,
): Promise<ApplyResult> {
  const result: ApplyResult = {
    modulesCreated: 0,
    modulesUpdated: 0,
    lessonsCreated: 0,
    lessonsUpdated: 0,
    errors: [],
  };

  const moduleCache = new Map<string, string>();

  for (const lesson of lessons) {
    const { fm, content } = lesson;
    const fileLabel = path.basename(lesson.filePath);

    try {
      const moduleKey = `${fm.courseId}::${fm.moduleSlug}`;
      let moduleId = moduleCache.get(moduleKey);

      if (!moduleId) {
        const existingModule = await prisma.module.findFirst({
          where: { courseId: fm.courseId, title: fm.moduleTitle },
          select: { id: true, title: true, description: true, displayOrder: true },
        });

        if (existingModule) {
          moduleId = existingModule.id;
          const needsUpdate =
            existingModule.title !== fm.moduleTitle ||
            (fm.moduleDescription !== undefined && existingModule.description !== fm.moduleDescription) ||
            (fm.moduleDisplayOrder !== undefined && existingModule.displayOrder !== fm.moduleDisplayOrder);
          if (needsUpdate && !dryRun) {
            await prisma.module.update({
              where: { id: moduleId },
              data: {
                title: fm.moduleTitle,
                description: fm.moduleDescription ?? undefined,
                displayOrder: fm.moduleDisplayOrder ?? undefined,
              },
            });
          }
          if (needsUpdate) result.modulesUpdated++;
        } else {
          if (dryRun) {
            moduleId = `<new-module-${moduleKey}>`;
          } else {
            const created = await prisma.module.create({
              data: {
                courseId: fm.courseId,
                title: fm.moduleTitle,
                description: fm.moduleDescription ?? null,
                displayOrder: fm.moduleDisplayOrder ?? 0,
                isPublished: true,
              },
              select: { id: true },
            });
            moduleId = created.id;
          }
          result.modulesCreated++;
        }
        moduleCache.set(moduleKey, moduleId);
      }

      const aiKeyPointsJson = fm.aiKeyPoints && fm.aiKeyPoints.length > 0 ? JSON.stringify(fm.aiKeyPoints) : null;
      const leiArticlesJson = fm.leiArticles && fm.leiArticles.length > 0 ? JSON.stringify(fm.leiArticles) : null;

      const existingLesson = moduleId.startsWith('<new')
        ? null
        : await prisma.lesson.findUnique({
            where: { moduleId_slug: { moduleId, slug: fm.lessonSlug } },
            select: { id: true },
          });

      if (existingLesson) {
        if (!dryRun) {
          await prisma.lesson.update({
            where: { id: existingLesson.id },
            data: {
              title: fm.title,
              description: fm.description ?? null,
              content,
              displayOrder: fm.displayOrder ?? undefined,
              estimatedMinutes: fm.estimatedMinutes ?? undefined,
              aiSummary: fm.aiSummary ?? null,
              aiKeyPoints: aiKeyPointsJson,
              leiArticles: leiArticlesJson,
              isPublished: fm.isPublished ?? true,
            },
          });
        }
        result.lessonsUpdated++;
        console.log(`  ↻ ${fileLabel} → atualiza Lesson "${fm.title}"`);
      } else {
        if (!dryRun && !moduleId.startsWith('<new')) {
          await prisma.lesson.create({
            data: {
              moduleId,
              slug: fm.lessonSlug,
              title: fm.title,
              description: fm.description ?? null,
              content,
              displayOrder: fm.displayOrder ?? 0,
              estimatedMinutes: fm.estimatedMinutes ?? null,
              aiSummary: fm.aiSummary ?? null,
              aiKeyPoints: aiKeyPointsJson,
              leiArticles: leiArticlesJson,
              isPublished: fm.isPublished ?? true,
            },
          });
        }
        result.lessonsCreated++;
        console.log(`  + ${fileLabel} → cria Lesson "${fm.title}"`);
      }
    } catch (e) {
      const msg = `${fileLabel}: ${e instanceof Error ? e.message : String(e)}`;
      result.errors.push(msg);
      console.error(`  ✗ ${msg}`);
    }
  }

  return result;
}

async function main() {
  const { courseSlug, dryRun, baseDir } = parseArgs(process.argv);
  const courseDir = path.join(baseDir, courseSlug);

  try {
    await fs.access(courseDir);
  } catch {
    console.error(`Pasta não encontrada: ${courseDir}`);
    process.exit(1);
  }

  console.log(`\nImportando curso "${courseSlug}"${dryRun ? ' (DRY RUN — sem escrita)' : ''}`);
  console.log(`  pasta: ${courseDir}\n`);

  const lessons = await loadLessons(courseDir);
  console.log(`${lessons.length} arquivo(s) de lição encontrado(s)\n`);

  if (lessons.length === 0) {
    console.log('Nada a importar.');
    await prisma.$disconnect();
    return;
  }

  const courseIds = new Set(lessons.map((l) => l.fm.courseId));
  if (courseIds.size > 1) {
    console.error(`Múltiplos courseId encontrados nos arquivos: ${[...courseIds].join(', ')}`);
    console.error('Use uma pasta por curso.');
    process.exit(1);
  }

  const result = await applyLessons(lessons, dryRun);

  console.log(`\nResumo${dryRun ? ' (dry-run)' : ''}:`);
  console.log(`  módulos criados:    ${result.modulesCreated}`);
  console.log(`  módulos atualizados: ${result.modulesUpdated}`);
  console.log(`  lições criadas:     ${result.lessonsCreated}`);
  console.log(`  lições atualizadas:  ${result.lessonsUpdated}`);
  if (result.errors.length > 0) {
    console.log(`  erros:               ${result.errors.length}`);
    process.exitCode = 1;
  }

  if (dryRun) {
    console.log(`\n→ Para aplicar de verdade, rode novamente sem --dryRun.`);
  } else {
    console.log(`\n→ Pronto. Para republicar o curso: tsx scripts/republish-course.ts <courseId>`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
