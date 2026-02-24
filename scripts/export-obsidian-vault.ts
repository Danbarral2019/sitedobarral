/**
 * Export Obsidian Vault — Lei 14.133/2021
 *
 * Gera um vault Obsidian com [[wikilinks]] bidirecionais a partir dos dados
 * do site do Barral (artigos, documentos, atos normativos, jurisprudência,
 * enunciados e temas).
 *
 * Uso:
 *   npx tsx scripts/export-obsidian-vault.ts
 *   npx tsx scripts/export-obsidian-vault.ts --output-dir ~/Obsidian/Licitações
 *   npx tsx scripts/export-obsidian-vault.ts --dry-run
 *   npx tsx scripts/export-obsidian-vault.ts --no-db
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { writeFile, mkdir } from 'fs/promises';
import { join, resolve } from 'path';
import { homedir } from 'os';

import { LEI_14133_ARTIGOS, type LeiArticle } from '../data/lei-14133-artigos';
import { ENUNCIADOS, ARTIGOS_ENUNCIADOS, type Enunciado } from '../data/enunciados';
import { CROSS_REFERENCES, type CrossReference } from '../data/lei-14133-cross-references';
import { TEMAS_LICITACOES } from '../data/temas-licitacoes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DbDocument {
  id: string;
  title: string;
  description: string | null;
  category: string;
  url: string;
  tags: string | null;
  leiArticles: string | null;
  summary: string | null;
  adminNotes: string | null;
  publicNotes: string | null;
  notesImportance: string | null;
  notesKeyPoints: string | null;
  notesPracticalUse: string | null;
  tcuNumeroAcordao: string | null;
  tcuArea: string | null;
  tcuTema: string | null;
  tcuEmentaCompleta: string | null;
  tcuRelator: string | null;
  tcuOrgaoJulgador: string | null;
  douUrl: string | null;
  douData: Date | null;
  uploadedAt: Date;
}

interface DbLegislativeAct {
  id: string;
  fullNumber: string;
  type: string;
  title: string;
  ementa: string;
  summary: string | null;
  issuer: string;
  publishDate: Date;
  hierarchyLevel: number;
  leiArticles: string | null;
  themes: string | null;
  officialUrl: string | null;
}

interface DbTribunalDecision {
  id: string;
  tribunalCode: string;
  tribunalName: string;
  decisionType: string;
  decisionNumber: string;
  year: number;
  title: string;
  ementa: string;
  summary: string | null;
  relator: string | null;
  orgaoJulgador: string | null;
  themes: string | null;
  leiArticles: string | null;
  url: string | null;
  relevanceScore: number;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    // Fallback: CSV
    return value.split(',').map(s => s.trim()).filter(Boolean);
  }
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[/\\:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, 100);
}

function padArticle(num: string): string {
  // Handle special articles like "184-A"
  const match = num.match(/^(\d+)(.*)/);
  if (!match) return num.padStart(3, '0');
  return match[1].padStart(3, '0') + match[2];
}

function toTitleCase(str: string): string {
  const minor = new Set([
    'da', 'das', 'de', 'do', 'dos', 'e', 'em', 'na', 'nas',
    'no', 'nos', 'a', 'o', 'as', 'os', 'à', 'às', 'ao', 'aos',
    'ou', 'para', 'por', 'com', 'sem', 'sob', 'sobre',
  ]);
  const roman = /^(i{1,3}|iv|v|vi{0,3}|ix|x{1,3}|xl|l|lx{0,3}|xc|c)$/i;
  return str
    .toLowerCase()
    .split(' ')
    .map((w, i) => {
      if (roman.test(w)) return w.toUpperCase();
      if (i > 0 && minor.has(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(' ');
}

function yamlStr(val: string): string {
  if (/[:#\[\]{}&*!|>'"%@`,\n]/.test(val) || val.startsWith('-') || val.startsWith('?')) {
    return `"${val.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return `"${val}"`;
}

function yamlArray(arr: string[]): string {
  if (arr.length === 0) return '[]';
  return '[' + arr.map(v => yamlStr(v)).join(', ') + ']';
}

function truncateText(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + '...';
}

// ---------------------------------------------------------------------------
// Filename & wikilink generators
// ---------------------------------------------------------------------------

function articleSectionLabel(art: LeiArticle): string {
  if (art.secao) return art.secao;
  if (art.capituloCompleto) {
    const parts = art.capituloCompleto.split(' - ');
    if (parts.length > 1) return toTitleCase(parts.slice(1).join(' - '));
    return toTitleCase(art.capituloCompleto);
  }
  // Use theme label as fallback for a more descriptive name
  const tema = TEMAS_LICITACOES.find(t =>
    (t.articles as readonly string[]).includes(art.numero),
  );
  if (tema) return tema.label;
  return toTitleCase(art.capitulo);
}

function articleSlug(art: LeiArticle): string {
  return sanitizeFilename(`Art. ${padArticle(art.numero)} - ${articleSectionLabel(art)}`);
}

function documentSlug(doc: DbDocument): string {
  return sanitizeFilename(`DOC - ${truncateText(doc.title, 80)}`);
}

function actSlug(act: DbLegislativeAct): string {
  return sanitizeFilename(`AN - ${act.fullNumber}`);
}

function decisionSlug(dec: DbTribunalDecision): string {
  const code = dec.tribunalCode.toUpperCase();
  const typeLabel = dec.decisionType === 'acordao' ? 'Acórdão'
    : dec.decisionType === 'decisao' ? 'Decisão'
    : dec.decisionType === 'sumula' ? 'Súmula'
    : dec.decisionType === 'parecer_previo' ? 'Parecer'
    : dec.decisionType;
  return sanitizeFilename(`JUR - ${code} ${typeLabel} ${dec.decisionNumber}`);
}

function enunciadoSlug(en: Enunciado): string {
  return sanitizeFilename(`EN - ${en.orgao} ${en.numero}`);
}

function temaSlug(value: string, label: string): string {
  return sanitizeFilename(`TEMA - ${label}`);
}

function wikilink(slug: string, display?: string): string {
  if (display) return `[[${slug}|${display}]]`;
  return `[[${slug}]]`;
}

// ---------------------------------------------------------------------------
// Link graph
// ---------------------------------------------------------------------------

interface LinkGraph {
  articleToDocuments: Map<string, DbDocument[]>;
  articleToActs: Map<string, DbLegislativeAct[]>;
  articleToDecisions: Map<string, DbTribunalDecision[]>;
  articleToEnunciados: Map<string, Enunciado[]>;
  articleToThemes: Map<string, typeof TEMAS_LICITACOES[number][]>;
  articleToCrossRefs: Map<string, CrossReference[]>;
}

function buildLinkGraph(
  documents: DbDocument[],
  acts: DbLegislativeAct[],
  decisions: DbTribunalDecision[],
): LinkGraph {
  const articleToDocuments = new Map<string, DbDocument[]>();
  const articleToActs = new Map<string, DbLegislativeAct[]>();
  const articleToDecisions = new Map<string, DbTribunalDecision[]>();
  const articleToEnunciados = new Map<string, Enunciado[]>();
  const articleToThemes = new Map<string, typeof TEMAS_LICITACOES[number][]>();
  const articleToCrossRefs = new Map<string, CrossReference[]>();

  // Documents → articles
  for (const doc of documents) {
    for (const artNum of parseJsonArray(doc.leiArticles)) {
      const list = articleToDocuments.get(artNum) || [];
      list.push(doc);
      articleToDocuments.set(artNum, list);
    }
  }

  // Acts → articles
  for (const act of acts) {
    for (const artNum of parseJsonArray(act.leiArticles)) {
      const list = articleToActs.get(artNum) || [];
      list.push(act);
      articleToActs.set(artNum, list);
    }
  }

  // Decisions → articles
  for (const dec of decisions) {
    for (const artNum of parseJsonArray(dec.leiArticles)) {
      const list = articleToDecisions.get(artNum) || [];
      list.push(dec);
      articleToDecisions.set(artNum, list);
    }
  }

  // Enunciados → articles (from static data)
  for (const en of ENUNCIADOS) {
    for (const artNum of en.artigosVinculados) {
      const normalized = artNum.replace(/[-§].*$/, '');
      const list = articleToEnunciados.get(normalized) || [];
      list.push(en);
      articleToEnunciados.set(normalized, list);
    }
  }

  // Themes → articles
  for (const tema of TEMAS_LICITACOES) {
    for (const artNum of tema.articles) {
      const list = articleToThemes.get(artNum) || [];
      list.push(tema);
      articleToThemes.set(artNum, list);
    }
  }

  // Cross-references → articles
  for (const cr of CROSS_REFERENCES) {
    for (const artNum of cr.articles) {
      const list = articleToCrossRefs.get(artNum) || [];
      list.push(cr);
      articleToCrossRefs.set(artNum, list);
    }
  }

  return {
    articleToDocuments, articleToActs, articleToDecisions,
    articleToEnunciados, articleToThemes, articleToCrossRefs,
  };
}

// ---------------------------------------------------------------------------
// Markdown generators
// ---------------------------------------------------------------------------

function generateArticleMd(
  art: LeiArticle,
  graph: LinkGraph,
): string {
  const num = art.numero;
  const themes = graph.articleToThemes.get(num) || [];
  const tags = ['lei14133', ...themes.map(t => t.value)];
  const docs = graph.articleToDocuments.get(num) || [];
  const acts = graph.articleToActs.get(num) || [];
  const decs = graph.articleToDecisions.get(num) || [];
  const enunciados = graph.articleToEnunciados.get(num) || [];
  const crossRefs = graph.articleToCrossRefs.get(num) || [];

  // Find related articles from cross-references (excluding self)
  const relatedArticles = new Set<string>();
  for (const cr of crossRefs) {
    for (const a of cr.articles) {
      if (a !== num) relatedArticles.add(a);
    }
  }

  const lines: string[] = [];

  // Frontmatter
  lines.push('---');
  lines.push('type: artigo');
  lines.push(`numero: ${yamlStr(num)}`);
  if (art.titulo) lines.push(`titulo: ${yamlStr(art.titulo)}`);
  lines.push(`capitulo: ${yamlStr(articleSectionLabel(art))}`);
  lines.push(`tags: ${yamlArray(tags)}`);
  lines.push(`aliases: ${yamlArray([`Art. ${num}`, `Artigo ${num}`])}`);
  lines.push('---');
  lines.push('');

  // Title
  lines.push(`# Art. ${num} — ${articleSectionLabel(art)}`);
  lines.push('');

  // Ementa (full article text)
  const ementaLines = art.ementa.split('\n').filter(Boolean);
  lines.push(`> ${ementaLines[0]}`);
  for (const line of ementaLines.slice(1)) {
    lines.push(`> ${line}`);
  }
  lines.push('');

  // Cross-references
  if (relatedArticles.size > 0) {
    lines.push('## Artigos Relacionados (Cross-References)');
    const sortedRelated = [...relatedArticles].sort((a, b) => {
      const na = parseInt(a), nb = parseInt(b);
      return (isNaN(na) || isNaN(nb)) ? a.localeCompare(b) : na - nb;
    });
    for (const relNum of sortedRelated) {
      const relArt = LEI_14133_ARTIGOS[relNum];
      if (relArt) {
        lines.push(`- ${wikilink(articleSlug(relArt))}`);
      }
    }
    lines.push('');
  }

  // Documents
  if (docs.length > 0) {
    lines.push('## Documentos Vinculados');
    for (const doc of docs) {
      lines.push(`- ${wikilink(documentSlug(doc))}`);
    }
    lines.push('');
  }

  // Legislative acts
  if (acts.length > 0) {
    lines.push('## Atos Normativos');
    for (const act of acts) {
      lines.push(`- ${wikilink(actSlug(act))}`);
    }
    lines.push('');
  }

  // Jurisprudência
  if (decs.length > 0) {
    lines.push('## Jurisprudência');
    for (const dec of decs) {
      lines.push(`- ${wikilink(decisionSlug(dec))}`);
    }
    lines.push('');
  }

  // Enunciados
  if (enunciados.length > 0) {
    lines.push('## Enunciados');
    for (const en of enunciados) {
      const shortText = truncateText(en.texto, 120);
      lines.push(`- ${wikilink(enunciadoSlug(en))} — ${shortText}`);
    }
    lines.push('');
  }

  // Temas
  if (themes.length > 0) {
    lines.push('## Temas');
    for (const t of themes) {
      lines.push(`- ${wikilink(temaSlug(t.value, t.label))}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function generateDocumentMd(doc: DbDocument): string {
  const articles = parseJsonArray(doc.leiArticles);
  const tags = parseJsonArray(doc.tags);
  const lines: string[] = [];

  lines.push('---');
  lines.push('type: documento');
  lines.push(`category: ${yamlStr(doc.category)}`);
  if (doc.notesImportance) lines.push(`importance: ${yamlStr(doc.notesImportance)}`);
  lines.push(`url: ${yamlStr(doc.url)}`);
  if (tags.length > 0) lines.push(`tags: ${yamlArray(tags)}`);
  lines.push(`created: ${doc.uploadedAt.toISOString().slice(0, 10)}`);
  lines.push('---');
  lines.push('');

  lines.push(`# ${doc.title}`);
  lines.push('');

  // Summary or description
  const body = doc.summary || doc.description;
  if (body) {
    lines.push(`> ${body.split('\n')[0]}`);
    for (const line of body.split('\n').slice(1)) {
      if (line.trim()) lines.push(`> ${line}`);
    }
    lines.push('');
  }

  // TCU metadata
  if (doc.tcuRelator || doc.tcuOrgaoJulgador || doc.tcuArea) {
    if (doc.tcuRelator) lines.push(`**Relator:** ${doc.tcuRelator}`);
    if (doc.tcuOrgaoJulgador) lines.push(`**Órgão Julgador:** ${doc.tcuOrgaoJulgador}`);
    if (doc.tcuArea) lines.push(`**Área:** ${doc.tcuArea}`);
    if (doc.tcuTema) lines.push(`**Tema TCU:** ${doc.tcuTema}`);
    lines.push('');
  }

  // TCU ementa completa
  if (doc.tcuEmentaCompleta && doc.tcuEmentaCompleta !== doc.summary) {
    lines.push('## Ementa Completa');
    lines.push('');
    lines.push(doc.tcuEmentaCompleta);
    lines.push('');
  }

  // Lei articles
  if (articles.length > 0) {
    lines.push('## Artigos da Lei 14.133');
    for (const artNum of articles) {
      const art = LEI_14133_ARTIGOS[artNum];
      if (art) {
        lines.push(`- ${wikilink(articleSlug(art))}`);
      } else {
        lines.push(`- Art. ${artNum}`);
      }
    }
    lines.push('');
  }

  // Notes
  const notesSections: string[] = [];
  if (doc.publicNotes) notesSections.push(doc.publicNotes);
  if (doc.notesKeyPoints) notesSections.push(`**Pontos-chave:** ${doc.notesKeyPoints}`);
  if (doc.notesPracticalUse) notesSections.push(`**Uso Prático:** ${doc.notesPracticalUse}`);

  if (notesSections.length > 0) {
    lines.push('## Notas');
    lines.push('');
    lines.push(notesSections.join('\n\n'));
    lines.push('');
  }

  // DOU link
  if (doc.douUrl) {
    lines.push('## Referência DOU');
    lines.push(`- [Diário Oficial da União](${doc.douUrl})`);
    if (doc.douData) lines.push(`- Data: ${doc.douData.toISOString().slice(0, 10)}`);
    lines.push('');
  }

  return lines.join('\n');
}

function generateActMd(act: DbLegislativeAct): string {
  const articles = parseJsonArray(act.leiArticles);
  const themes = parseJsonArray(act.themes);
  const lines: string[] = [];

  lines.push('---');
  lines.push('type: ato-normativo');
  lines.push(`subtype: ${yamlStr(act.type)}`);
  lines.push(`issuer: ${yamlStr(act.issuer)}`);
  lines.push(`hierarchy: ${act.hierarchyLevel}`);
  lines.push(`publishDate: ${act.publishDate.toISOString().slice(0, 10)}`);
  if (act.officialUrl) lines.push(`url: ${yamlStr(act.officialUrl)}`);
  if (themes.length > 0) lines.push(`tags: ${yamlArray([act.type, ...themes])}`);
  lines.push('---');
  lines.push('');

  lines.push(`# ${act.fullNumber}`);
  lines.push('');

  // Ementa
  lines.push(`> ${act.ementa}`);
  lines.push('');

  // Summary
  if (act.summary) {
    lines.push(act.summary);
    lines.push('');
  }

  // Lei articles
  if (articles.length > 0) {
    lines.push('## Artigos da Lei 14.133');
    for (const artNum of articles) {
      const art = LEI_14133_ARTIGOS[artNum];
      if (art) {
        lines.push(`- ${wikilink(articleSlug(art))}`);
      } else {
        lines.push(`- Art. ${artNum}`);
      }
    }
    lines.push('');
  }

  // Temas
  if (themes.length > 0) {
    lines.push('## Temas');
    for (const themeValue of themes) {
      const tema = TEMAS_LICITACOES.find(t => t.value === themeValue);
      if (tema) {
        lines.push(`- ${wikilink(temaSlug(tema.value, tema.label))}`);
      } else {
        lines.push(`- ${themeValue}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

function generateDecisionMd(dec: DbTribunalDecision): string {
  const articles = parseJsonArray(dec.leiArticles);
  const themes = parseJsonArray(dec.themes);
  const tags = [dec.tribunalCode.toLowerCase(), ...themes];
  const lines: string[] = [];

  lines.push('---');
  lines.push('type: jurisprudencia');
  lines.push(`tribunal: ${yamlStr(dec.tribunalCode)}`);
  lines.push(`decisionType: ${yamlStr(dec.decisionType)}`);
  lines.push(`year: ${dec.year}`);
  lines.push(`relevance: ${dec.relevanceScore}`);
  if (dec.url) lines.push(`url: ${yamlStr(dec.url)}`);
  lines.push(`tags: ${yamlArray(tags)}`);
  lines.push('---');
  lines.push('');

  lines.push(`# ${dec.tribunalCode} — ${dec.title}`);
  lines.push('');

  // Metadata
  if (dec.relator) lines.push(`**Relator:** ${dec.relator}`);
  if (dec.orgaoJulgador) lines.push(`**Órgão:** ${dec.orgaoJulgador}`);
  lines.push('');

  // Ementa
  lines.push(`> ${dec.ementa.split('\n')[0]}`);
  for (const line of dec.ementa.split('\n').slice(1)) {
    if (line.trim()) lines.push(`> ${line}`);
  }
  lines.push('');

  // Summary
  if (dec.summary) {
    lines.push(dec.summary);
    lines.push('');
  }

  // Lei articles
  if (articles.length > 0) {
    lines.push('## Artigos da Lei 14.133');
    for (const artNum of articles) {
      const art = LEI_14133_ARTIGOS[artNum];
      if (art) {
        lines.push(`- ${wikilink(articleSlug(art))}`);
      } else {
        lines.push(`- Art. ${artNum}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

function generateEnunciadoMd(en: Enunciado): string {
  const lines: string[] = [];

  lines.push('---');
  lines.push('type: enunciado');
  lines.push(`orgao: ${yamlStr(en.orgao)}`);
  lines.push(`numero: ${en.numero}`);
  lines.push(`jornada: ${yamlStr(en.jornada)}`);
  if (en.data) lines.push(`data: ${en.data}`);
  lines.push(`tema: ${yamlStr(en.tema)}`);
  if (en.url) lines.push(`url: ${yamlStr(en.url)}`);
  const tagSlugs = en.tema.toLowerCase()
    .replace(/[^\w\sà-ü-]/g, '')
    .split(/[\s-]+/)
    .filter(w => w.length > 2)
    .slice(0, 4);
  lines.push(`tags: ${yamlArray([en.orgao.toLowerCase(), ...tagSlugs])}`);
  lines.push('---');
  lines.push('');

  lines.push(`# Enunciado ${en.orgao} nº ${en.numero}`);
  lines.push('');

  // Full text
  lines.push(`> ${en.texto}`);
  lines.push('');

  // Linked articles
  if (en.artigosVinculados.length > 0) {
    lines.push('## Artigos Vinculados');
    for (const artNum of en.artigosVinculados) {
      const normalized = artNum.replace(/[-§].*$/, '');
      const art = LEI_14133_ARTIGOS[normalized];
      if (art) {
        lines.push(`- ${wikilink(articleSlug(art))}`);
      } else {
        lines.push(`- Art. ${artNum}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

function generateTemaMd(
  tema: typeof TEMAS_LICITACOES[number],
  documents: DbDocument[],
  acts: DbLegislativeAct[],
  decisions: DbTribunalDecision[],
): string {
  const lines: string[] = [];

  lines.push('---');
  lines.push('type: tema');
  lines.push(`value: ${yamlStr(tema.value)}`);
  lines.push('---');
  lines.push('');

  lines.push(`# ${tema.label}`);
  lines.push('');

  // Articles in this theme
  lines.push('## Artigos');
  for (const artNum of tema.articles) {
    const art = LEI_14133_ARTIGOS[artNum];
    if (art) {
      lines.push(`- ${wikilink(articleSlug(art))}`);
    }
  }
  lines.push('');

  // Documents with matching theme or articles
  const themeDocs = documents.filter(doc => {
    const docTags = parseJsonArray(doc.tags);
    const docArticles = parseJsonArray(doc.leiArticles);
    return docTags.includes(tema.value) ||
      docArticles.some(a => (tema.articles as readonly string[]).includes(a));
  });
  if (themeDocs.length > 0) {
    lines.push('## Documentos sobre este tema');
    for (const doc of themeDocs.slice(0, 30)) {
      lines.push(`- ${wikilink(documentSlug(doc))}`);
    }
    if (themeDocs.length > 30) lines.push(`- *(+${themeDocs.length - 30} documentos)*`);
    lines.push('');
  }

  // Acts with matching theme
  const themeActs = acts.filter(act => {
    const actThemes = parseJsonArray(act.themes);
    const actArticles = parseJsonArray(act.leiArticles);
    return actThemes.includes(tema.value) ||
      actArticles.some(a => (tema.articles as readonly string[]).includes(a));
  });
  if (themeActs.length > 0) {
    lines.push('## Atos Normativos');
    for (const act of themeActs) {
      lines.push(`- ${wikilink(actSlug(act))}`);
    }
    lines.push('');
  }

  // Decisions
  const themeDecs = decisions.filter(dec => {
    const decArticles = parseJsonArray(dec.leiArticles);
    return decArticles.some(a => (tema.articles as readonly string[]).includes(a));
  });
  if (themeDecs.length > 0) {
    lines.push('## Jurisprudência');
    for (const dec of themeDecs.slice(0, 20)) {
      lines.push(`- ${wikilink(decisionSlug(dec))}`);
    }
    if (themeDecs.length > 20) lines.push(`- *(+${themeDecs.length - 20} decisões)*`);
    lines.push('');
  }

  return lines.join('\n');
}

function generateMOC(
  documents: DbDocument[],
  acts: DbLegislativeAct[],
  decisions: DbTribunalDecision[],
): string {
  const lines: string[] = [];

  lines.push('# Lei 14.133/2021 — Mapa de Conteúdo');
  lines.push('');

  // Group articles by titulo
  const byTitulo = new Map<string, LeiArticle[]>();
  for (const [, art] of Object.entries(LEI_14133_ARTIGOS)) {
    const key = art.titulo || art.capitulo;
    const list = byTitulo.get(key) || [];
    list.push(art);
    byTitulo.set(key, list);
  }

  lines.push('## Estrutura da Lei');
  lines.push('');
  for (const [titulo, arts] of byTitulo) {
    lines.push(`### ${toTitleCase(titulo)}`);
    for (const art of arts) {
      lines.push(`- ${wikilink(articleSlug(art))}`);
    }
    lines.push('');
  }

  // Themes
  lines.push('## Temas');
  lines.push('');
  for (const tema of TEMAS_LICITACOES) {
    const slug = temaSlug(tema.value, tema.label);
    lines.push(`- ${wikilink(slug)} (${tema.articles.length} artigos)`);
  }
  lines.push('');

  // Stats
  const totalArticles = Object.keys(LEI_14133_ARTIGOS).length;
  lines.push('## Estatísticas');
  lines.push('');
  lines.push(`- **${totalArticles}** artigos da Lei 14.133/2021`);
  lines.push(`- **${documents.length}** documentos`);
  lines.push(`- **${acts.length}** atos normativos`);
  lines.push(`- **${decisions.length}** decisões de tribunais`);
  lines.push(`- **${ENUNCIADOS.length}** enunciados interpretativos`);
  lines.push(`- **${TEMAS_LICITACOES.length}** temas`);
  lines.push(`- **${CROSS_REFERENCES.length}** grupos de cross-references`);
  lines.push('');
  lines.push(`*Vault gerado em ${new Date().toISOString().slice(0, 10)}*`);
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// File writing
// ---------------------------------------------------------------------------

interface FileEntry {
  path: string;
  content: string;
}

async function writeVault(outputDir: string, files: FileEntry[]): Promise<void> {
  // Collect unique directories
  const dirs = new Set<string>();
  for (const f of files) {
    const dir = join(outputDir, f.path, '..');
    dirs.add(resolve(dir));
  }

  // Create directories
  for (const d of dirs) {
    await mkdir(d, { recursive: true });
  }

  // Write files
  for (const f of files) {
    await writeFile(join(outputDir, f.path), f.content, 'utf-8');
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Parse CLI args
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const noDb = args.includes('--no-db');

  let outputDir = join(homedir(), 'Obsidian', 'Licitações');
  const dirIdx = args.indexOf('--output-dir');
  if (dirIdx !== -1 && args[dirIdx + 1]) {
    outputDir = resolve(args[dirIdx + 1].replace(/^~/, homedir()));
  }

  console.log('=== Export Obsidian Vault — Lei 14.133/2021 ===\n');
  console.log(`Output: ${outputDir}`);
  console.log(`Dry run: ${dryRun}`);
  console.log(`No DB: ${noDb}`);
  console.log('');

  // -----------------------------------------------------------------------
  // Phase 1: Collect data
  // -----------------------------------------------------------------------
  console.log('--- Fase 1: Coleta de dados ---');

  // Static data
  const articleEntries = Object.entries(LEI_14133_ARTIGOS);
  console.log(`  Artigos: ${articleEntries.length}`);
  console.log(`  Enunciados: ${ENUNCIADOS.length}`);
  console.log(`  Cross-references: ${CROSS_REFERENCES.length} grupos`);
  console.log(`  Temas: ${TEMAS_LICITACOES.length}`);

  // DB data
  let documents: DbDocument[] = [];
  let acts: DbLegislativeAct[] = [];
  let decisions: DbTribunalDecision[] = [];

  if (!noDb) {
    const { PrismaClient } = await import('@prisma/client');
    const { PrismaNeon } = await import('@prisma/adapter-neon');
    const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
    const prisma = new PrismaClient({ adapter, log: ['error', 'warn'] });

    try {
      documents = await prisma.document.findMany({
        select: {
          id: true, title: true, description: true, category: true, url: true,
          tags: true, leiArticles: true, summary: true,
          adminNotes: true, publicNotes: true, notesImportance: true,
          notesKeyPoints: true, notesPracticalUse: true,
          tcuNumeroAcordao: true, tcuArea: true, tcuTema: true,
          tcuEmentaCompleta: true, tcuRelator: true, tcuOrgaoJulgador: true,
          douUrl: true, douData: true, uploadedAt: true,
        },
      });
      console.log(`  Documentos (DB): ${documents.length}`);

      acts = await prisma.legislativeAct.findMany({
        select: {
          id: true, fullNumber: true, type: true, title: true,
          ementa: true, summary: true, issuer: true, publishDate: true,
          hierarchyLevel: true, leiArticles: true, themes: true, officialUrl: true,
        },
      });
      console.log(`  Atos Normativos (DB): ${acts.length}`);

      decisions = await prisma.tribunalDecision.findMany({
        where: {
          approvalStatus: { in: ['auto_approved', 'manually_approved'] },
        },
        select: {
          id: true, tribunalCode: true, tribunalName: true,
          decisionType: true, decisionNumber: true, year: true,
          title: true, ementa: true, summary: true,
          relator: true, orgaoJulgador: true,
          themes: true, leiArticles: true, url: true, relevanceScore: true,
        },
      });
      console.log(`  Jurisprudência (DB): ${decisions.length}`);
    } finally {
      await prisma.$disconnect();
    }
  } else {
    console.log('  (DB ignorado — modo --no-db)');
  }

  console.log('');

  // -----------------------------------------------------------------------
  // Phase 2: Build link graph
  // -----------------------------------------------------------------------
  console.log('--- Fase 2: Construindo grafo de links ---');
  const graph = buildLinkGraph(documents, acts, decisions);
  console.log(`  articleToDocuments: ${graph.articleToDocuments.size} artigos com docs`);
  console.log(`  articleToActs: ${graph.articleToActs.size} artigos com atos`);
  console.log(`  articleToDecisions: ${graph.articleToDecisions.size} artigos com decisões`);
  console.log(`  articleToEnunciados: ${graph.articleToEnunciados.size} artigos com enunciados`);
  console.log(`  articleToThemes: ${graph.articleToThemes.size} artigos com temas`);
  console.log(`  articleToCrossRefs: ${graph.articleToCrossRefs.size} artigos com cross-refs`);
  console.log('');

  // -----------------------------------------------------------------------
  // Phase 3: Generate files
  // -----------------------------------------------------------------------
  console.log('--- Fase 3: Gerando arquivos Markdown ---');
  const files: FileEntry[] = [];

  // 3a. Articles
  for (const [, art] of articleEntries) {
    const slug = articleSlug(art);
    files.push({
      path: join('Artigos', `${slug}.md`),
      content: generateArticleMd(art, graph),
    });
  }
  console.log(`  Artigos: ${articleEntries.length} arquivos`);

  // 3b. Documents
  // Deduplicate by slug (some documents may produce the same filename)
  const docSlugs = new Set<string>();
  for (const doc of documents) {
    const slug = documentSlug(doc);
    if (docSlugs.has(slug)) continue;
    docSlugs.add(slug);
    files.push({
      path: join('Documentos', `${slug}.md`),
      content: generateDocumentMd(doc),
    });
  }
  console.log(`  Documentos: ${docSlugs.size} arquivos`);

  // 3c. Legislative Acts
  for (const act of acts) {
    const slug = actSlug(act);
    files.push({
      path: join('Atos Normativos', `${slug}.md`),
      content: generateActMd(act),
    });
  }
  console.log(`  Atos Normativos: ${acts.length} arquivos`);

  // 3d. Jurisprudência
  const decSlugs = new Set<string>();
  for (const dec of decisions) {
    const slug = decisionSlug(dec);
    if (decSlugs.has(slug)) continue;
    decSlugs.add(slug);
    files.push({
      path: join('Jurisprudência', `${slug}.md`),
      content: generateDecisionMd(dec),
    });
  }
  console.log(`  Jurisprudência: ${decSlugs.size} arquivos`);

  // 3e. Enunciados
  for (const en of ENUNCIADOS) {
    const slug = enunciadoSlug(en);
    files.push({
      path: join('Enunciados', `${slug}.md`),
      content: generateEnunciadoMd(en),
    });
  }
  console.log(`  Enunciados: ${ENUNCIADOS.length} arquivos`);

  // 3f. Temas
  for (const tema of TEMAS_LICITACOES) {
    const slug = temaSlug(tema.value, tema.label);
    files.push({
      path: join('Temas', `${slug}.md`),
      content: generateTemaMd(tema, documents, acts, decisions),
    });
  }
  console.log(`  Temas: ${TEMAS_LICITACOES.length} arquivos`);

  // 3g. MOC
  files.push({
    path: 'MOC.md',
    content: generateMOC(documents, acts, decisions),
  });
  console.log(`  MOC: 1 arquivo`);

  console.log('');
  console.log(`Total: ${files.length} arquivos`);
  console.log('');

  // -----------------------------------------------------------------------
  // Phase 4: Write (or dry-run)
  // -----------------------------------------------------------------------
  if (dryRun) {
    console.log('=== DRY RUN — nenhum arquivo criado ===');
    console.log('');
    console.log('Resumo por pasta:');
    const byDir = new Map<string, number>();
    for (const f of files) {
      const dir = f.path.split('/')[0] || '(raiz)';
      byDir.set(dir, (byDir.get(dir) || 0) + 1);
    }
    for (const [dir, count] of [...byDir].sort()) {
      console.log(`  ${dir}: ${count} arquivos`);
    }
  } else {
    console.log(`Escrevendo ${files.length} arquivos em ${outputDir}...`);
    await writeVault(outputDir, files);
    console.log('Vault exportado com sucesso!');
  }
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
