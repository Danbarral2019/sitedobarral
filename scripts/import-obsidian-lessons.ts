/**
 * Import Obsidian Lessons — Vault para Banco de Dados
 *
 * Importa conteudo de cursos do vault Obsidian para o banco de dados (LMS).
 * Converte wikilinks/callouts, faz upsert de modulos/licoes/videos e detecta orfaos.
 *
 * Uso:
 *   npx tsx scripts/import-obsidian-lessons.ts              # all courses
 *   npx tsx scripts/import-obsidian-lessons.ts --course planejamento-contratacoes
 *   npx tsx scripts/import-obsidian-lessons.ts --dry-run
 *   npx tsx scripts/import-obsidian-lessons.ts --force       # ignore content hash, update all
 *   npx tsx scripts/import-obsidian-lessons.ts --vault /custom/path
 */

import { createHash } from 'crypto';
import { prisma } from '../lib/prisma';
import { parseVaultCourses, resolveDocumentLinks, buildDocMap } from '../lib/obsidian/parser';
import { courses } from '../data/courses';

import type { ObsidianCourse } from '../lib/obsidian/types';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);

  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');

  let courseSlug: string | null = null;
  const courseIdx = args.indexOf('--course');
  if (courseIdx !== -1 && args[courseIdx + 1]) {
    courseSlug = args[courseIdx + 1];
  }

  let vaultPath = '/Users/danba/Documents/Licitações-Obsidian';
  const vaultIdx = args.indexOf('--vault');
  if (vaultIdx !== -1 && args[vaultIdx + 1]) {
    vaultPath = args[vaultIdx + 1];
  }

  return { dryRun, force, courseSlug, vaultPath };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function contentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:v=|\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function findCourseBySlug(slug: string) {
  return courses.find((c) => c.slug === slug) ?? null;
}

// ---------------------------------------------------------------------------
// Import logic
// ---------------------------------------------------------------------------

interface Stats {
  coursesProcessed: number;
  modulesCreated: number;
  modulesUpdated: number;
  lessonsCreated: number;
  lessonsUpdated: number;
  lessonsUnchanged: number;
  videosCreated: number;
  warnings: string[];
}

function newStats(): Stats {
  return {
    coursesProcessed: 0,
    modulesCreated: 0,
    modulesUpdated: 0,
    lessonsCreated: 0,
    lessonsUpdated: 0,
    lessonsUnchanged: 0,
    videosCreated: 0,
    warnings: [],
  };
}

async function importCourse(
  obsidianCourse: ObsidianCourse,
  courseId: string,
  stats: Stats,
  opts: { dryRun: boolean; force: boolean },
  docMap: Map<string, string>,
): Promise<void> {
  const moduleIdMap = new Map<string, string>(); // module title -> db id
  const lessonSlugMap = new Map<string, string>(); // "courseId:slug" -> db lesson id
  const touchedModuleIds = new Set<string>();
  const touchedLessonIds = new Set<string>();

  // Sort modules by displayOrder
  const sortedModules = [...obsidianCourse.modules].sort(
    (a, b) => a.displayOrder - b.displayOrder,
  );

  // ------------------------------------------------------------------
  // Pass 1: Upsert modules and lessons
  // ------------------------------------------------------------------
  for (const obsMod of sortedModules) {
    const moduleLabel = `M${String(obsMod.displayOrder).padStart(2, '0')} ${obsMod.title}`;

    try {
      // Find existing module by courseId + title
      const existingModule = await prisma.module.findFirst({
        where: { courseId, title: obsMod.title },
      });

      let moduleId: string;

      if (existingModule) {
        moduleId = existingModule.id;

        if (!opts.dryRun) {
          await prisma.module.update({
            where: { id: moduleId },
            data: {
              displayOrder: obsMod.displayOrder,
              description: obsMod.description ?? undefined,
              isPublished: obsMod.isPublished ?? false,
            },
          });
        }

        stats.modulesUpdated++;
        console.log(`  ${moduleLabel} -> updated`);
      } else {
        if (opts.dryRun) {
          moduleId = `dry-run-${obsMod.title}`;
          stats.modulesCreated++;
          console.log(`  ${moduleLabel} -> created (dry-run)`);
        } else {
          const created = await prisma.module.create({
            data: {
              courseId,
              title: obsMod.title,
              description: obsMod.description ?? null,
              displayOrder: obsMod.displayOrder,
              isPublished: obsMod.isPublished ?? false,
            },
          });
          moduleId = created.id;
          stats.modulesCreated++;
          console.log(`  ${moduleLabel} -> created`);
        }
      }

      moduleIdMap.set(obsMod.title, moduleId);
      touchedModuleIds.add(moduleId);

      // Sort lessons by displayOrder
      const sortedLessons = [...obsMod.lessons].sort(
        (a, b) => a.displayOrder - b.displayOrder,
      );

      for (const obsLesson of sortedLessons) {
        const lessonLabel = `    L${String(obsLesson.displayOrder).padStart(2, '0')} ${obsLesson.slug}`;

        try {
          // Content already processed by parser (wikilinks, callouts)
          // Resolve document links using the docMap (DOC → /documento/{id})
          let processedContent = obsLesson.content || null;
          if (processedContent && docMap.size > 0) {
            processedContent = resolveDocumentLinks(processedContent, docMap);
          }

          const hash = processedContent ? contentHash(processedContent) : '';

          // Check existing lesson by unique constraint
          const existingLesson = opts.dryRun
            ? null
            : await prisma.lesson.findUnique({
                where: {
                  moduleId_slug: { moduleId, slug: obsLesson.slug },
                },
              });

          if (existingLesson) {
            touchedLessonIds.add(existingLesson.id);
            lessonSlugMap.set(`${courseId}:${obsLesson.slug}`, existingLesson.id);

            // Check if content changed (compare hash stored in description prefix or raw content)
            const existingHash = existingLesson.content
              ? contentHash(existingLesson.content)
              : '';

            if (!opts.force && hash === existingHash) {
              stats.lessonsUnchanged++;
              console.log(`${lessonLabel} -> unchanged`);
              continue;
            }

            // Update
            if (!opts.dryRun) {
              await prisma.lesson.update({
                where: { id: existingLesson.id },
                data: {
                  title: obsLesson.title,
                  description: obsLesson.description ?? undefined,
                  content: processedContent,
                  displayOrder: obsLesson.displayOrder,
                  isPublished: obsLesson.isPublished ?? false,
                  estimatedMinutes: obsLesson.estimatedMinutes ?? undefined,
                  leiArticles: obsLesson.leiArticles
                    ? JSON.stringify(obsLesson.leiArticles)
                    : undefined,
                },
              });
            }

            stats.lessonsUpdated++;
            console.log(`${lessonLabel} -> updated`);
          } else {
            // Create
            if (opts.dryRun) {
              stats.lessonsCreated++;
              console.log(`${lessonLabel} -> created (dry-run)`);
            } else {
              const created = await prisma.lesson.create({
                data: {
                  moduleId,
                  title: obsLesson.title,
                  slug: obsLesson.slug,
                  description: obsLesson.description ?? null,
                  content: processedContent,
                  displayOrder: obsLesson.displayOrder,
                  isPublished: obsLesson.isPublished ?? false,
                  estimatedMinutes: obsLesson.estimatedMinutes ?? null,
                  leiArticles: obsLesson.leiArticles
                    ? JSON.stringify(obsLesson.leiArticles)
                    : null,
                },
              });
              touchedLessonIds.add(created.id);
              lessonSlugMap.set(`${courseId}:${obsLesson.slug}`, created.id);
              stats.lessonsCreated++;
              console.log(`${lessonLabel} -> created`);
            }
          }

          // Videos
          if (obsLesson.videos && obsLesson.videos.length > 0 && !opts.dryRun) {
            const lessonId =
              lessonSlugMap.get(`${courseId}:${obsLesson.slug}`) ??
              (
                await prisma.lesson.findUnique({
                  where: { moduleId_slug: { moduleId, slug: obsLesson.slug } },
                  select: { id: true },
                })
              )?.id;

            if (lessonId) {
              // Delete existing videos for this lesson, then recreate
              await prisma.lessonVideo.deleteMany({ where: { lessonId } });

              for (let vi = 0; vi < obsLesson.videos.length; vi++) {
                const video = obsLesson.videos[vi];
                const youtubeId = extractYouTubeId(video.youtubeUrl);

                if (!youtubeId) {
                  stats.warnings.push(
                    `[${obsidianCourse.slug}] ${obsLesson.slug}: URL de video invalida: ${video.youtubeUrl}`,
                  );
                  continue;
                }

                await prisma.lessonVideo.create({
                  data: {
                    lessonId,
                    title: video.title,
                    youtubeUrl: video.youtubeUrl,
                    youtubeId,
                    displayOrder: vi,
                  },
                });
                stats.videosCreated++;
              }
            }
          } else if (obsLesson.videos && obsLesson.videos.length > 0 && opts.dryRun) {
            stats.videosCreated += obsLesson.videos.length;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          stats.warnings.push(
            `[${obsidianCourse.slug}] Erro na licao ${obsLesson.slug}: ${msg}`,
          );
          console.error(`${lessonLabel} -> ERRO: ${msg}`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      stats.warnings.push(
        `[${obsidianCourse.slug}] Erro no modulo "${obsMod.title}": ${msg}`,
      );
      console.error(`  ${moduleLabel} -> ERRO: ${msg}`);
    }
  }

  // ------------------------------------------------------------------
  // Pass 2: Prerequisites
  // ------------------------------------------------------------------
  for (const obsMod of sortedModules) {
    for (const obsLesson of obsMod.lessons) {
      if (!obsLesson.prerequisiteSlug) continue;

      const lessonId = lessonSlugMap.get(`${courseId}:${obsLesson.slug}`);
      const prereqId = lessonSlugMap.get(`${courseId}:${obsLesson.prerequisiteSlug}`);

      if (!lessonId || !prereqId) {
        // Try to find them in DB
        const moduleId = moduleIdMap.get(obsMod.title);
        if (!moduleId || opts.dryRun) continue;

        const lesson = await prisma.lesson.findUnique({
          where: { moduleId_slug: { moduleId, slug: obsLesson.slug } },
          select: { id: true },
        });

        // Find prerequisite in any module of this course
        const prereqLesson = await prisma.lesson.findFirst({
          where: {
            slug: obsLesson.prerequisiteSlug,
            module: { courseId },
          },
          select: { id: true },
        });

        if (lesson && prereqLesson) {
          await prisma.lesson.update({
            where: { id: lesson.id },
            data: { prerequisiteId: prereqLesson.id },
          });
          console.log(
            `    Prerequisito: ${obsLesson.slug} <- ${obsLesson.prerequisiteSlug}`,
          );
        } else if (!prereqLesson) {
          stats.warnings.push(
            `[${obsidianCourse.slug}] Prerequisito nao encontrado: ${obsLesson.prerequisiteSlug} (para ${obsLesson.slug})`,
          );
        }
      } else if (!opts.dryRun) {
        await prisma.lesson.update({
          where: { id: lessonId },
          data: { prerequisiteId: prereqId },
        });
        console.log(
          `    Prerequisito: ${obsLesson.slug} <- ${obsLesson.prerequisiteSlug}`,
        );
      }
    }
  }

  // ------------------------------------------------------------------
  // Pass 3: Orphan detection (NEVER delete — only warn)
  // ------------------------------------------------------------------
  if (!opts.dryRun) {
    // Find all modules for this course
    const dbModules = await prisma.module.findMany({
      where: { courseId },
      select: { id: true, title: true },
    });

    for (const dbMod of dbModules) {
      if (!touchedModuleIds.has(dbMod.id)) {
        stats.warnings.push(
          `[${obsidianCourse.slug}] Modulo orfao no DB (nao existe no vault): "${dbMod.title}" (${dbMod.id})`,
        );
      }
    }

    // Find all lessons for this course
    const dbLessons = await prisma.lesson.findMany({
      where: { module: { courseId } },
      select: { id: true, slug: true, module: { select: { title: true } } },
    });

    for (const dbLesson of dbLessons) {
      if (!touchedLessonIds.has(dbLesson.id)) {
        stats.warnings.push(
          `[${obsidianCourse.slug}] Licao orfa no DB (nao existe no vault): "${dbLesson.slug}" em "${dbLesson.module.title}" (${dbLesson.id})`,
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { dryRun, force, courseSlug, vaultPath } = parseArgs();

  console.log('=== Obsidian -> Site — Import Lessons ===\n');

  // Load vault
  console.log(`Vault: ${vaultPath}`);

  let vaultCourses: ObsidianCourse[];
  try {
    vaultCourses = await parseVaultCourses(vaultPath);
  } catch (err) {
    console.error(
      `Erro ao ler vault: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  }

  if (vaultCourses.length === 0) {
    console.error('Nenhum curso encontrado no vault.');
    process.exit(1);
  }

  // Filter if --course specified
  if (courseSlug) {
    vaultCourses = vaultCourses.filter((c) => c.slug === courseSlug);
    if (vaultCourses.length === 0) {
      console.error(`Curso "${courseSlug}" nao encontrado no vault.`);
      console.error(
        'Cursos disponiveis:',
        (await parseVaultCourses(vaultPath)).map((c) => c.slug).join(', '),
      );
      process.exit(1);
    }
  }

  // Validate: each course slug must exist in data/courses.ts
  for (const vc of vaultCourses) {
    const course = findCourseBySlug(vc.slug);
    if (!course) {
      console.error(
        `Curso "${vc.slug}" do vault nao existe em data/courses.ts. Cursos validos: ${courses.map((c) => c.slug).join(', ')}`,
      );
      process.exit(1);
    }
  }

  const courseSlugs = vaultCourses.map((c) => c.slug).join(', ');
  console.log(`Courses: ${courseSlugs}`);
  console.log(`Dry run: ${dryRun}`);
  console.log(`Force: ${force}`);
  console.log('');

  // Build document map for resolving DOC links → /documento/{id}
  const allDocs = await prisma.document.findMany({ select: { id: true, title: true } });
  const docMap = buildDocMap(allDocs);
  console.log(`Document map: ${docMap.size} documentos para resolucao de links\n`);

  const stats = newStats();

  for (const vc of vaultCourses) {
    const course = findCourseBySlug(vc.slug)!;

    const totalModules = vc.modules.length;
    const totalLessons = vc.modules.reduce((s, m) => s + m.lessons.length, 0);

    console.log(
      `[${vc.slug}] ${course.title} (ID: ${course.id}) — ${totalModules} modulos, ${totalLessons} licoes`,
    );

    stats.coursesProcessed++;

    await importCourse(vc, course.id, stats, { dryRun, force }, docMap);

    console.log('');
  }

  // ------------------------------------------------------------------
  // Summary
  // ------------------------------------------------------------------
  console.log('--- Resultado ---');
  console.log(`Cursos processados: ${stats.coursesProcessed}`);
  console.log(
    `Modulos criados: ${stats.modulesCreated} | atualizados: ${stats.modulesUpdated}`,
  );
  console.log(
    `Licoes criadas: ${stats.lessonsCreated} | atualizadas: ${stats.lessonsUpdated} | inalteradas: ${stats.lessonsUnchanged}`,
  );
  console.log(`Videos criados: ${stats.videosCreated}`);
  console.log(`Warnings: ${stats.warnings.length}`);

  if (stats.warnings.length > 0) {
    console.log('\n--- Warnings ---');
    for (const w of stats.warnings) {
      console.log(`  ! ${w}`);
    }
  }

  if (dryRun) {
    console.log('\n[DRY RUN] Nenhuma alteracao feita no banco de dados.');
  }
}

main()
  .catch((err) => {
    console.error('Erro fatal:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
