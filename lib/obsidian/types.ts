export interface ObsidianLesson {
  slug: string;           // from filename: L01-conceitos-basicos -> conceitos-basicos
  title: string;          // from frontmatter
  description: string | null;
  content: string;        // markdown body (after frontmatter)
  estimatedMinutes: number | null;
  isPublished: boolean;
  leiArticles: string[];  // e.g. ["18", "19", "20"]
  prerequisiteSlug: string | null;
  displayOrder: number;   // from L{NN} prefix
  videos: ObsidianVideo[];
  contentHash: string;    // MD5 of raw file content for change detection
}

export interface ObsidianVideo {
  title: string;
  youtubeUrl: string;
}

export interface ObsidianModule {
  slug: string;           // from dir name: M01-introducao -> introducao
  title: string;          // from _modulo.md frontmatter
  description: string | null;
  isPublished: boolean;
  displayOrder: number;   // from M{NN} prefix
  lessons: ObsidianLesson[];
}

export interface ObsidianCourse {
  slug: string;           // from dir name: planejamento-contratacoes
  modules: ObsidianModule[];
}

export interface ImportResult {
  coursesProcessed: number;
  modulesCreated: number;
  modulesUpdated: number;
  lessonsCreated: number;
  lessonsUpdated: number;
  lessonsUnchanged: number;
  videosCreated: number;
  warnings: string[];
}
