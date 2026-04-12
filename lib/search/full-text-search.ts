/**
 * Full-Text Search Utility
 *
 * Busca textual via PostgreSQL tsvector com stemming português,
 * tratamento de acentos (unaccent) e ranking por relevância (ts_rank).
 *
 * Usa prisma.$queryRawUnsafe() seguindo o padrão de lib/embeddings/vector-search.ts.
 */

import { prisma } from '@/lib/prisma';

// ===========================
// Types
// ===========================

export interface FTSResult<T> {
  data: T;
  rank: number;
}

export interface FTSOptions {
  limit?: number;
}

export interface DocumentFTSOptions extends FTSOptions {
  enrolledCourseIds?: string[];
  excludeCategories?: string[];
}

export interface VideoFTSOptions extends FTSOptions {
  enrolledCourseIds?: string[];
}

export interface SiteFTSOptions extends FTSOptions {
  siteIds?: string[];
}

// Row types returned from raw SQL
interface DocumentRow {
  id: string;
  title: string;
  description: string | null;
  category: string;
  type: string;
  url: string | null;
  course_id: string | null;
  tags: string | null;
  uploaded_at: Date;
  is_public: boolean;
  rank: number;
}

interface GlossaryRow {
  id: string;
  term: string;
  slug: string;
  definition: string;
  short_def: string | null;
  category: string | null;
  rank: number;
}

interface LegislativeActRow {
  id: string;
  type: string;
  full_number: string;
  title: string;
  ementa: string;
  summary: string | null;
  issuer: string;
  publish_date: Date;
  hierarchy_level: number;
  lei_articles: string | null;
  official_url: string | null;
  pdf_url: string | null;
  rank: number;
}

interface VideoRow {
  id: string;
  title: string;
  description: string | null;
  youtube_url: string;
  youtube_id: string;
  thumbnail_url: string | null;
  course_id: string;
  rank: number;
}

interface SiteRow {
  id: string;
  title: string;
  description: string;
  url: string;
  favicon_url: string | null;
  category: string | null;
  rank: number;
}

interface BlogPostRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  author: string;
  published_at: Date;
  tags: string | null;
  rank: number;
}

interface FAQRow {
  id: string;
  question: string;
  answer: string;
  category: string;
  rank: number;
}

// ===========================
// Query Builder
// ===========================

/**
 * Sanitize user input for use with websearch_to_tsquery.
 * Removes special characters that could break the query parser.
 */
function sanitizeQuery(query: string): string {
  if (!query || !query.trim()) return '';
  // websearch_to_tsquery handles most syntax natively (AND, OR, quotes, -)
  // We only need to escape characters that could break the SQL string
  return query.replace(/'/g, "''").trim();
}

/**
 * Build the tsquery expression using websearch_to_tsquery (PostgreSQL 11+).
 * Supports: AND (implicit space), OR, quotes for phrases, - for negation.
 */
function buildTsQueryExpr(paramIndex: number): string {
  return `websearch_to_tsquery('portuguese_unaccent', $${paramIndex})`;
}

// ===========================
// Search Functions
// ===========================

export async function searchDocuments(
  query: string,
  options: DocumentFTSOptions = {}
): Promise<FTSResult<DocumentRow>[]> {
  const sanitized = sanitizeQuery(query);
  if (!sanitized) return [];

  const { enrolledCourseIds = [], excludeCategories = [], limit = 500 } = options;

  // Build WHERE clauses
  const conditions: string[] = [
    `search_vector @@ ${buildTsQueryExpr(1)}`,
  ];

  // Access control: isCommon OR isPublic OR courseId in enrolled
  const accessParts: string[] = ['"isCommon" = true', '"isPublic" = true'];
  if (enrolledCourseIds.length > 0) {
    const escaped = enrolledCourseIds.map(id => `'${id.replace(/'/g, "''")}'`).join(', ');
    accessParts.push(`"courseId" IN (${escaped})`);
  }
  conditions.push(`(${accessParts.join(' OR ')})`);

  // Exclude categories passed by caller (no hardcoded defaults)
  if (excludeCategories.length > 0) {
    const excludeEscaped = excludeCategories.map(c => `'${c.replace(/'/g, "''")}'`).join(', ');
    conditions.push(`category NOT IN (${excludeEscaped})`);
  }

  const sql = `
    SELECT
      id, title, description, category, type, url,
      "courseId" as course_id,
      tags,
      "uploadedAt" as uploaded_at,
      "isPublic" as is_public,
      ts_rank(search_vector, ${buildTsQueryExpr(1)}) as rank
    FROM "Document"
    WHERE ${conditions.join(' AND ')}
    ORDER BY rank DESC, "uploadedAt" DESC
    LIMIT ${limit}
  `;

  const rows = await prisma.$queryRawUnsafe<DocumentRow[]>(sql, sanitized);
  return rows.map(row => ({ data: row, rank: row.rank }));
}

export async function searchGlossary(
  query: string,
  options: FTSOptions = {}
): Promise<FTSResult<GlossaryRow>[]> {
  const sanitized = sanitizeQuery(query);
  if (!sanitized) return [];

  const { limit = 500 } = options;

  const sql = `
    SELECT
      id, term, slug, definition,
      "shortDef" as short_def,
      category,
      ts_rank(search_vector, ${buildTsQueryExpr(1)}) as rank
    FROM "GlossaryTerm"
    WHERE "isPublic" = true
      AND search_vector @@ ${buildTsQueryExpr(1)}
    ORDER BY rank DESC
    LIMIT ${limit}
  `;

  const rows = await prisma.$queryRawUnsafe<GlossaryRow[]>(sql, sanitized);
  return rows.map(row => ({ data: row, rank: row.rank }));
}

export async function searchLegislativeActs(
  query: string,
  options: FTSOptions = {}
): Promise<FTSResult<LegislativeActRow>[]> {
  const sanitized = sanitizeQuery(query);
  if (!sanitized) return [];

  const { limit = 500 } = options;

  const sql = `
    SELECT
      id, type, "fullNumber" as full_number, title, ementa,
      summary, issuer,
      "publishDate" as publish_date,
      "hierarchyLevel" as hierarchy_level,
      "leiArticles" as lei_articles,
      "officialUrl" as official_url,
      "pdfUrl" as pdf_url,
      ts_rank(search_vector, ${buildTsQueryExpr(1)}) as rank
    FROM "LegislativeAct"
    WHERE search_vector @@ ${buildTsQueryExpr(1)}
    ORDER BY rank DESC, "hierarchyLevel" ASC, year DESC
    LIMIT ${limit}
  `;

  const rows = await prisma.$queryRawUnsafe<LegislativeActRow[]>(sql, sanitized);
  return rows.map(row => ({ data: row, rank: row.rank }));
}

export async function searchVideos(
  query: string,
  options: VideoFTSOptions = {}
): Promise<FTSResult<VideoRow>[]> {
  const sanitized = sanitizeQuery(query);
  if (!sanitized) return [];

  const { enrolledCourseIds = [], limit = 500 } = options;

  const conditions: string[] = [
    '"isActive" = true',
    `search_vector @@ ${buildTsQueryExpr(1)}`,
  ];

  if (enrolledCourseIds.length > 0) {
    const escaped = enrolledCourseIds.map(id => `'${id.replace(/'/g, "''")}'`).join(', ');
    conditions.push(`"courseId" IN (${escaped})`);
  }

  const sql = `
    SELECT
      id, title, description,
      "youtubeUrl" as youtube_url,
      "youtubeId" as youtube_id,
      "thumbnailUrl" as thumbnail_url,
      "courseId" as course_id,
      ts_rank(search_vector, ${buildTsQueryExpr(1)}) as rank
    FROM "CourseVideo"
    WHERE ${conditions.join(' AND ')}
    ORDER BY rank DESC, "displayOrder" ASC
    LIMIT ${limit}
  `;

  const rows = await prisma.$queryRawUnsafe<VideoRow[]>(sql, sanitized);
  return rows.map(row => ({ data: row, rank: row.rank }));
}

export async function searchSites(
  query: string,
  options: SiteFTSOptions = {}
): Promise<FTSResult<SiteRow>[]> {
  const sanitized = sanitizeQuery(query);
  if (!sanitized) return [];

  const { siteIds = [], limit = 500 } = options;

  const conditions: string[] = [
    '"isActive" = true',
    `search_vector @@ ${buildTsQueryExpr(1)}`,
  ];

  if (siteIds.length > 0) {
    const escaped = siteIds.map(id => `'${id.replace(/'/g, "''")}'`).join(', ');
    conditions.push(`id IN (${escaped})`);
  }

  const sql = `
    SELECT
      id, title, description, url,
      "faviconUrl" as favicon_url,
      category,
      ts_rank(search_vector, ${buildTsQueryExpr(1)}) as rank
    FROM "RecommendedSite"
    WHERE ${conditions.join(' AND ')}
    ORDER BY rank DESC, "displayOrder" ASC
    LIMIT ${limit}
  `;

  const rows = await prisma.$queryRawUnsafe<SiteRow[]>(sql, sanitized);
  return rows.map(row => ({ data: row, rank: row.rank }));
}

export async function searchBlogPosts(
  query: string,
  options: FTSOptions = {}
): Promise<FTSResult<BlogPostRow>[]> {
  const sanitized = sanitizeQuery(query);
  if (!sanitized) return [];

  const { limit = 500 } = options;

  const sql = `
    SELECT
      id, slug, title, excerpt, author,
      "publishedAt" as published_at,
      tags,
      ts_rank(search_vector, ${buildTsQueryExpr(1)}) as rank
    FROM "BlogPost"
    WHERE "isPublished" = true
      AND search_vector @@ ${buildTsQueryExpr(1)}
    ORDER BY rank DESC, "publishedAt" DESC
    LIMIT ${limit}
  `;

  const rows = await prisma.$queryRawUnsafe<BlogPostRow[]>(sql, sanitized);
  return rows.map(row => ({ data: row, rank: row.rank }));
}

export async function searchFAQs(
  query: string,
  options: FTSOptions = {}
): Promise<FTSResult<FAQRow>[]> {
  const sanitized = sanitizeQuery(query);
  if (!sanitized) return [];

  const { limit = 500 } = options;

  const sql = `
    SELECT
      id, question, answer, category,
      ts_rank(search_vector, ${buildTsQueryExpr(1)}) as rank
    FROM "FAQ"
    WHERE "isPublished" = true
      AND search_vector @@ ${buildTsQueryExpr(1)}
    ORDER BY rank DESC
    LIMIT ${limit}
  `;

  const rows = await prisma.$queryRawUnsafe<FAQRow[]>(sql, sanitized);
  return rows.map(row => ({ data: row, rank: row.rank }));
}
