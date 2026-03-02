/**
 * Import Obsidian Lessons — callable module
 *
 * Extracted from scripts/import-obsidian-lessons.ts.
 * Imports course content from the Obsidian vault into the database (LMS).
 */

import { createHash } from 'crypto';
import { prisma } from '../prisma';
import { parseVaultCourses, resolveDocumentLinks, buildLinkMap } from './parser';
import { courses } from '../../data/courses';

import type { ObsidianCourse } from './types';
import type { ImportResult } from './types';

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
// Stats
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

// ---------------------------------------------------------------------------
// Import a single course
// ---------------------------------------------------------------------------

async function importCourse(
  obsidianCourse: ObsidianCourse,
  courseId: string,
  stats: Stats,
  opts: { dryRun: boolean; force: boolean },
  linkMap: Map<string, string>,
): Promise<void> {
  const moduleIdMap = new Map<string, string>();
  const lessonSlugMap = new Map<string, string>();
  const touchedModuleIds = new Set<string>();
  const touchedLessonIds = new Set<string>();

  const sortedModules = [...obsidianCourse.modules].sort(
    (a, b) => a.displayOrder - b.displayOrder,
  );

  for (const obsMod of sortedModules) {
    const moduleLabel = `M${String(obsMod.displayOrder).padStart(2, '0')} ${obsMod.title}`;

    try {
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

      const sortedLessons = [...obsMod.lessons].sort(
        (a, b) => a.displayOrder - b.displayOrder,
      );

      for (const obsLesson of sortedLessons) {
        const lessonLabel = `    L${String(obsLesson.displayOrder).padStart(2, '0')} ${obsLesson.slug}`;

        try {
          let processedContent = obsLesson.content || null;
          if (processedContent && linkMap.size > 0) {
            processedContent = resolveDocumentLinks(processedContent, linkMap);
          }

          const hash = processedContent ? contentHash(processedContent) : '';

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

            const existingHash = existingLesson.content
              ? contentHash(existingLesson.content)
              : '';

            if (!opts.force && hash === existingHash) {
              stats.lessonsUnchanged++;
              console.log(`${lessonLabel} -> unchanged`);
              continue;
            }

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

  // Prerequisites
  for (const obsMod of sortedModules) {
    for (const obsLesson of obsMod.lessons) {
      if (!obsLesson.prerequisiteSlug) continue;

      const lessonId = lessonSlugMap.get(`${courseId}:${obsLesson.slug}`);
      const prereqId = lessonSlugMap.get(`${courseId}:${obsLesson.prerequisiteSlug}`);

      if (!lessonId || !prereqId) {
        const moduleId = moduleIdMap.get(obsMod.title);
        if (!moduleId || opts.dryRun) continue;

        const lesson = await prisma.lesson.findUnique({
          where: { moduleId_slug: { moduleId, slug: obsLesson.slug } },
          select: { id: true },
        });

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

  // Orphan detection (NEVER delete — only warn)
  if (!opts.dryRun) {
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
// Public API
// ---------------------------------------------------------------------------

export interface LessonImportOptions {
  vaultPath: string;
  dryRun: boolean;
  force: boolean;
  courseSlug?: string;
}

export async function runLessonImport(opts: LessonImportOptions): Promise<ImportResult> {
  let vaultCourses: ObsidianCourse[];
  try {
    vaultCourses = parseVaultCourses(opts.vaultPath);
  } catch (err) {
    throw new Error(
      `Erro ao ler vault: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (vaultCourses.length === 0) {
    throw new Error('Nenhum curso encontrado no vault.');
  }

  if (opts.courseSlug) {
    vaultCourses = vaultCourses.filter((c) => c.slug === opts.courseSlug);
    if (vaultCourses.length === 0) {
      throw new Error(`Curso "${opts.courseSlug}" nao encontrado no vault.`);
    }
  }

  for (const vc of vaultCourses) {
    const course = findCourseBySlug(vc.slug);
    if (!course) {
      throw new Error(
        `Curso "${vc.slug}" do vault nao existe em data/courses.ts. Cursos validos: ${courses.map((c) => c.slug).join(', ')}`,
      );
    }
  }

  // Build unified link map
  const linkEntries: { name: string; url: string }[] = [];

  const allDocs = await prisma.document.findMany({ select: { id: true, title: true } });
  for (const doc of allDocs) {
    linkEntries.push({ name: doc.title, url: `/documento/${doc.id}` });
  }

  const allActs = await prisma.legislativeAct.findMany({
    select: { id: true, fullNumber: true, title: true },
  });
  for (const act of allActs) {
    linkEntries.push({ name: act.fullNumber, url: `/legislacao/${act.id}` });
    if (act.title !== act.fullNumber) {
      linkEntries.push({ name: act.title, url: `/legislacao/${act.id}` });
    }
  }

  const allDecisions = await prisma.tribunalDecision.findMany({
    where: { approvalStatus: { in: ['auto_approved', 'manually_approved'] } },
    select: { id: true, title: true, fullIdentifier: true },
  });
  for (const dec of allDecisions) {
    linkEntries.push({ name: dec.fullIdentifier, url: `/jurisprudencia/${dec.id}` });
    if (dec.title !== dec.fullIdentifier) {
      linkEntries.push({ name: dec.title, url: `/jurisprudencia/${dec.id}` });
    }
  }

  const linkMap = buildLinkMap(linkEntries);
  console.log(`Link map: ${linkMap.size} entradas (${allDocs.length} docs, ${allActs.length} atos, ${allDecisions.length} decisoes)\n`);

  const stats = newStats();

  for (const vc of vaultCourses) {
    const course = findCourseBySlug(vc.slug)!;

    const totalModules = vc.modules.length;
    const totalLessons = vc.modules.reduce((s, m) => s + m.lessons.length, 0);

    console.log(
      `[${vc.slug}] ${course.title} (ID: ${course.id}) — ${totalModules} modulos, ${totalLessons} licoes`,
    );

    stats.coursesProcessed++;

    await importCourse(vc, course.id, stats, { dryRun: opts.dryRun, force: opts.force }, linkMap);

    console.log('');
  }

  return stats;
}
