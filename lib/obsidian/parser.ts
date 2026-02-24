import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import matter from 'gray-matter';

import type {
  ObsidianCourse,
  ObsidianModule,
  ObsidianLesson,
  ObsidianVideo,
} from './types';

// ---------------------------------------------------------------------------
// Content processing
// ---------------------------------------------------------------------------

/**
 * Convert Obsidian wikilinks to web-friendly markdown links.
 *
 * Patterns handled (in order):
 *  - [[Art. NNN...|Art. NN]]  -> [Art. NN](/area-restrita/artigo/NN)
 *  - [[DOC - X|display]]      -> [display](/legislacao?q=X)
 *  - [[DOC - X]]              -> [X](/legislacao?q=X)
 *  - [[TEMA - X]]             -> **X**
 *  - [[X|Y]]                  -> **Y**   (generic fallback)
 *  - [[X]]                    -> **X**   (generic fallback)
 */
export function processWikilinks(content: string): string {
  let result = content;

  // Art. links with display text  –  [[Art. 018...|Art. 18]]
  result = result.replace(
    /\[\[Art\.\s*\d+[^|]*\|([^\]]+)\]\]/g,
    (_match, display: string) => {
      const numMatch = display.match(/\d+/);
      const num = numMatch ? numMatch[0] : '0';
      return `[${display}](/area-restrita/artigo/${num})`;
    },
  );

  // Art. links without display text  –  [[Art. 018...]]
  result = result.replace(
    /\[\[Art\.\s*(\d+)[^\]]*\]\]/g,
    (_match, num: string) => {
      const n = parseInt(num, 10).toString();
      return `[Art. ${n}](/area-restrita/artigo/${n})`;
    },
  );

  // DOC links with display text  –  [[DOC - X|display]]
  result = result.replace(
    /\[\[DOC\s*-\s*([^|\]]+)\|([^\]]+)\]\]/g,
    (_match, docName: string, display: string) => {
      const q = encodeURIComponent(docName.trim());
      return `[${display.trim()}](/legislacao?q=${q})`;
    },
  );

  // DOC links without display text  –  [[DOC - X]]
  result = result.replace(
    /\[\[DOC\s*-\s*([^\]]+)\]\]/g,
    (_match, docName: string) => {
      const name = docName.trim();
      const q = encodeURIComponent(name);
      return `[${name}](/legislacao?q=${q})`;
    },
  );

  // TEMA links  –  [[TEMA - X]]
  result = result.replace(
    /\[\[TEMA\s*-\s*([^\]]+)\]\]/g,
    (_match, tema: string) => `**${tema.trim()}**`,
  );

  // Generic wikilink with display text  –  [[X|Y]]
  result = result.replace(
    /\[\[([^|\]]+)\|([^\]]+)\]\]/g,
    (_match, _target: string, display: string) => `**${display.trim()}**`,
  );

  // Generic wikilink without display text  –  [[X]]
  result = result.replace(
    /\[\[([^\]]+)\]\]/g,
    (_match, target: string) => `**${target.trim()}**`,
  );

  return result;
}

/**
 * Convert Obsidian callouts to standard markdown block-quotes.
 *
 *   > [!important] Title  ->  > **Importante:** Title
 */
export function processCallouts(content: string): string {
  const calloutMap: Record<string, string> = {
    important: 'Importante:',
    warning: 'Atenção:',
    tip: 'Dica:',
    note: 'Nota:',
    example: 'Exemplo:',
    info: 'Info:',
  };

  return content.replace(
    /^(>\s*)\[!(\w+)\]\s*(.*)/gm,
    (_match, prefix: string, type: string, title: string) => {
      const label = calloutMap[type.toLowerCase()];
      if (label) {
        return `${prefix}**${label}** ${title}`.trimEnd();
      }
      // Unknown callout type — keep as bold label
      return `${prefix}**${type}:** ${title}`.trimEnd();
    },
  );
}

/** Run all content transformations. */
export function processContent(content: string): string {
  let result = content;
  result = processWikilinks(result);
  result = processCallouts(result);
  return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function md5(data: string): string {
  return crypto.createHash('md5').update(data, 'utf8').digest('hex');
}

/** Extract numeric order from a prefix like "M01-…" or "L03-…". */
function extractOrder(name: string, prefix: string): number {
  const re = new RegExp(`^${prefix}(\\d+)-`);
  const m = name.match(re);
  return m ? parseInt(m[1], 10) : 0;
}

/** Remove a prefix like "M01-" or "L02-" from a name to get the slug. */
function extractSlug(name: string, prefix: string): string {
  const re = new RegExp(`^${prefix}\\d+-`);
  return name.replace(re, '');
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Parse a single lesson `.md` file.
 *
 * Expected frontmatter fields:
 *   type, title, description, estimatedMinutes, isPublished,
 *   leiArticles, prerequisiteSlug, videos
 */
export function parseLessonFile(filePath: string): ObsidianLesson {
  const raw = fs.readFileSync(filePath, 'utf8');
  const { data, content } = matter(raw);

  const basename = path.basename(filePath, '.md'); // e.g. L01-conceitos-basicos
  const displayOrder = extractOrder(basename, 'L');
  const slug = extractSlug(basename, 'L');

  const videos: ObsidianVideo[] = Array.isArray(data.videos)
    ? data.videos.map((v: Record<string, string>) => ({
        title: v.title ?? '',
        youtubeUrl: v.youtubeUrl ?? v.url ?? '',
      }))
    : [];

  return {
    slug,
    title: data.title ?? slug,
    description: data.description ?? null,
    content: processContent(content.trim()),
    estimatedMinutes: data.estimatedMinutes ?? null,
    isPublished: data.isPublished !== false, // default true
    leiArticles: Array.isArray(data.leiArticles)
      ? data.leiArticles.map(String)
      : [],
    prerequisiteSlug: data.prerequisiteSlug ?? null,
    displayOrder,
    videos,
    contentHash: md5(raw),
  };
}

/**
 * Parse a module directory.
 *
 * Expects:
 *  - `_modulo.md` with frontmatter (title, description, isPublished)
 *  - `L*.md` files for lessons
 */
export function parseModuleDir(dirPath: string): ObsidianModule {
  const dirName = path.basename(dirPath);
  const displayOrder = extractOrder(dirName, 'M');
  const slug = extractSlug(dirName, 'M');

  // Read module metadata from _modulo.md
  const metaPath = path.join(dirPath, '_modulo.md');
  let title = slug;
  let description: string | null = null;
  let isPublished = true;

  if (fs.existsSync(metaPath)) {
    const { data } = matter(fs.readFileSync(metaPath, 'utf8'));
    title = data.title ?? slug;
    description = data.description ?? null;
    isPublished = data.isPublished !== false;
  }

  // Collect lesson files (L*.md)
  const entries = fs.readdirSync(dirPath);
  const lessonFiles = entries
    .filter((f) => /^L\d+-.+\.md$/i.test(f))
    .sort(); // alphabetical sort keeps L01, L02, … in order

  const lessons = lessonFiles.map((f) =>
    parseLessonFile(path.join(dirPath, f)),
  );

  return {
    slug,
    title,
    description,
    isPublished,
    displayOrder,
    lessons,
  };
}

/**
 * Scan the vault's `Cursos/` directory and return all courses.
 *
 * Directory layout:
 *   {vaultPath}/Cursos/{course-slug}/M01-modulo/L01-aula.md
 */
export function parseVaultCourses(vaultPath: string): ObsidianCourse[] {
  const cursosDir = path.join(vaultPath, 'Cursos');

  if (!fs.existsSync(cursosDir)) {
    throw new Error(`Courses directory not found: ${cursosDir}`);
  }

  const courseDirs = fs
    .readdirSync(cursosDir)
    .filter((entry) => {
      const full = path.join(cursosDir, entry);
      return fs.statSync(full).isDirectory();
    })
    .sort();

  return courseDirs.map((courseDir) => {
    const courseSlug = courseDir;
    const coursePath = path.join(cursosDir, courseDir);

    // Each sub-directory starting with M is a module
    const moduleDirs = fs
      .readdirSync(coursePath)
      .filter((entry) => {
        const full = path.join(coursePath, entry);
        return fs.statSync(full).isDirectory() && /^M\d+-/.test(entry);
      })
      .sort();

    const modules = moduleDirs.map((m) =>
      parseModuleDir(path.join(coursePath, m)),
    );

    return {
      slug: courseSlug,
      modules,
    };
  });
}
