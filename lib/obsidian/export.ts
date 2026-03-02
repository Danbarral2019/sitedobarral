/**
 * Export Obsidian Vault — Lei 14.133/2021
 *
 * Reusable module extracted from scripts/export-obsidian-vault.ts.
 * Contains all types, utilities, generators, and write logic.
 */

import { writeFile, mkdir } from 'fs/promises';
import { join, resolve } from 'path';

import { LEI_14133_ARTIGOS, type LeiArticle } from '../../data/lei-14133-artigos';
import { ENUNCIADOS, type Enunciado } from '../../data/enunciados';
import { CROSS_REFERENCES, type CrossReference } from '../../data/lei-14133-cross-references';
import { TEMAS_LICITACOES } from '../../data/temas-licitacoes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DbDocument {
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

export interface DbLegislativeAct {
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

export interface DbTribunalDecision {
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
// Prisma select constants
// ---------------------------------------------------------------------------

export const EXPORT_DOC_SELECT = {
  id: true, title: true, description: true, category: true, url: true,
  tags: true, leiArticles: true, summary: true,
  adminNotes: true, publicNotes: true, notesImportance: true,
  notesKeyPoints: true, notesPracticalUse: true,
  tcuNumeroAcordao: true, tcuArea: true, tcuTema: true,
  tcuEmentaCompleta: true, tcuRelator: true, tcuOrgaoJulgador: true,
  douUrl: true, douData: true, uploadedAt: true,
} as const;

export const EXPORT_ACT_SELECT = {
  id: true, fullNumber: true, type: true, title: true,
  ementa: true, summary: true, issuer: true, publishDate: true,
  hierarchyLevel: true, leiArticles: true, themes: true, officialUrl: true,
} as const;

export const EXPORT_DECISION_SELECT = {
  id: true, tribunalCode: true, tribunalName: true,
  decisionType: true, decisionNumber: true, year: true,
  title: true, ementa: true, summary: true,
  relator: true, orgaoJulgador: true,
  themes: true, leiArticles: true, url: true, relevanceScore: true,
} as const;

export const EXPORT_DECISION_WHERE = {
  approvalStatus: { in: ['auto_approved', 'manually_approved'] as string[] },
} as const;

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return value.split(',').map(s => s.trim()).filter(Boolean);
  }
}

export function sanitizeFilename(name: string): string {
  return name
    .replace(/[/\\:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, 100);
}

export function padArticle(num: string): string {
  const match = num.match(/^(\d+)(.*)/);
  if (!match) return num.padStart(3, '0');
  return match[1].padStart(3, '0') + match[2];
}

export function toTitleCase(str: string): string {
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

export function yamlStr(val: string): string {
  if (/[:#\[\]{}&*!|>'"%@`,\n]/.test(val) || val.startsWith('-') || val.startsWith('?')) {
    return `"${val.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return `"${val}"`;
}

export function yamlArray(arr: string[]): string {
  if (arr.length === 0) return '[]';
  return '[' + arr.map(v => yamlStr(v)).join(', ') + ']';
}

export function truncateText(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + '...';
}

// ---------------------------------------------------------------------------
// Filename & wikilink generators
// ---------------------------------------------------------------------------

export function articleSectionLabel(art: LeiArticle): string {
  if (art.secao) return art.secao;
  if (art.capituloCompleto) {
    const parts = art.capituloCompleto.split(' - ');
    if (parts.length > 1) return toTitleCase(parts.slice(1).join(' - '));
    return toTitleCase(art.capituloCompleto);
  }
  const tema = TEMAS_LICITACOES.find(t =>
    (t.articles as readonly string[]).includes(art.numero),
  );
  if (tema) return tema.label;
  return toTitleCase(art.capitulo);
}

export function articleSlug(art: LeiArticle): string {
  return sanitizeFilename(`Art. ${padArticle(art.numero)} - ${articleSectionLabel(art)}`);
}

export function documentSlug(doc: DbDocument): string {
  return sanitizeFilename(`DOC - ${truncateText(doc.title, 80)}`);
}

export function actSlug(act: DbLegislativeAct): string {
  return sanitizeFilename(`AN - ${act.fullNumber}`);
}

export function decisionSlug(dec: DbTribunalDecision): string {
  const code = dec.tribunalCode.toUpperCase();
  const typeLabel = dec.decisionType === 'acordao' ? 'Acórdão'
    : dec.decisionType === 'decisao' ? 'Decisão'
    : dec.decisionType === 'sumula' ? 'Súmula'
    : dec.decisionType === 'parecer_previo' ? 'Parecer'
    : dec.decisionType;
  return sanitizeFilename(`JUR - ${code} ${typeLabel} ${dec.decisionNumber}`);
}

export function enunciadoSlug(en: Enunciado): string {
  return sanitizeFilename(`EN - ${en.orgao} ${en.numero}`);
}

export function temaSlug(value: string, label: string): string {
  return sanitizeFilename(`TEMA - ${label}`);
}

export function wikilink(slug: string, display?: string): string {
  if (display) return `[[${slug}|${display}]]`;
  return `[[${slug}]]`;
}

// ---------------------------------------------------------------------------
// Link graph
// ---------------------------------------------------------------------------

export interface LinkGraph {
  articleToDocuments: Map<string, DbDocument[]>;
  articleToActs: Map<string, DbLegislativeAct[]>;
  articleToDecisions: Map<string, DbTribunalDecision[]>;
  articleToEnunciados: Map<string, Enunciado[]>;
  articleToThemes: Map<string, typeof TEMAS_LICITACOES[number][]>;
  articleToCrossRefs: Map<string, CrossReference[]>;
}

export function buildLinkGraph(
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

  for (const doc of documents) {
    for (const artNum of parseJsonArray(doc.leiArticles)) {
      const list = articleToDocuments.get(artNum) || [];
      list.push(doc);
      articleToDocuments.set(artNum, list);
    }
  }

  for (const act of acts) {
    for (const artNum of parseJsonArray(act.leiArticles)) {
      const list = articleToActs.get(artNum) || [];
      list.push(act);
      articleToActs.set(artNum, list);
    }
  }

  for (const dec of decisions) {
    for (const artNum of parseJsonArray(dec.leiArticles)) {
      const list = articleToDecisions.get(artNum) || [];
      list.push(dec);
      articleToDecisions.set(artNum, list);
    }
  }

  for (const en of ENUNCIADOS) {
    for (const artNum of en.artigosVinculados) {
      const normalized = artNum.replace(/[-§].*$/, '');
      const list = articleToEnunciados.get(normalized) || [];
      list.push(en);
      articleToEnunciados.set(normalized, list);
    }
  }

  for (const tema of TEMAS_LICITACOES) {
    for (const artNum of tema.articles) {
      const list = articleToThemes.get(artNum) || [];
      list.push(tema);
      articleToThemes.set(artNum, list);
    }
  }

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

export function generateArticleMd(
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

  const relatedArticles = new Set<string>();
  for (const cr of crossRefs) {
    for (const a of cr.articles) {
      if (a !== num) relatedArticles.add(a);
    }
  }

  const lines: string[] = [];

  lines.push('---');
  lines.push('type: artigo');
  lines.push(`numero: ${yamlStr(num)}`);
  if (art.titulo) lines.push(`titulo: ${yamlStr(art.titulo)}`);
  lines.push(`capitulo: ${yamlStr(articleSectionLabel(art))}`);
  lines.push(`tags: ${yamlArray(tags)}`);
  lines.push(`aliases: ${yamlArray([`Art. ${num}`, `Artigo ${num}`])}`);
  lines.push('---');
  lines.push('');

  lines.push(`# Art. ${num} — ${articleSectionLabel(art)}`);
  lines.push('');

  const ementaLines = art.ementa.split('\n').filter(Boolean);
  lines.push(`> ${ementaLines[0]}`);
  for (const line of ementaLines.slice(1)) {
    lines.push(`> ${line}`);
  }
  lines.push('');

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

  if (docs.length > 0) {
    lines.push('## Documentos Vinculados');
    for (const doc of docs) {
      lines.push(`- ${wikilink(documentSlug(doc))}`);
    }
    lines.push('');
  }

  if (acts.length > 0) {
    lines.push('## Atos Normativos');
    for (const act of acts) {
      lines.push(`- ${wikilink(actSlug(act))}`);
    }
    lines.push('');
  }

  if (decs.length > 0) {
    lines.push('## Jurisprudência');
    for (const dec of decs) {
      lines.push(`- ${wikilink(decisionSlug(dec))}`);
    }
    lines.push('');
  }

  if (enunciados.length > 0) {
    lines.push('## Enunciados');
    for (const en of enunciados) {
      const shortText = truncateText(en.texto, 120);
      lines.push(`- ${wikilink(enunciadoSlug(en))} — ${shortText}`);
    }
    lines.push('');
  }

  if (themes.length > 0) {
    lines.push('## Temas');
    for (const t of themes) {
      lines.push(`- ${wikilink(temaSlug(t.value, t.label))}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function generateDocumentMd(doc: DbDocument): string {
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

  const body = doc.summary || doc.description;
  if (body) {
    lines.push(`> ${body.split('\n')[0]}`);
    for (const line of body.split('\n').slice(1)) {
      if (line.trim()) lines.push(`> ${line}`);
    }
    lines.push('');
  }

  if (doc.tcuRelator || doc.tcuOrgaoJulgador || doc.tcuArea) {
    if (doc.tcuRelator) lines.push(`**Relator:** ${doc.tcuRelator}`);
    if (doc.tcuOrgaoJulgador) lines.push(`**Órgão Julgador:** ${doc.tcuOrgaoJulgador}`);
    if (doc.tcuArea) lines.push(`**Área:** ${doc.tcuArea}`);
    if (doc.tcuTema) lines.push(`**Tema TCU:** ${doc.tcuTema}`);
    lines.push('');
  }

  if (doc.tcuEmentaCompleta && doc.tcuEmentaCompleta !== doc.summary) {
    lines.push('## Ementa Completa');
    lines.push('');
    lines.push(doc.tcuEmentaCompleta);
    lines.push('');
  }

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

  if (doc.douUrl) {
    lines.push('## Referência DOU');
    lines.push(`- [Diário Oficial da União](${doc.douUrl})`);
    if (doc.douData) lines.push(`- Data: ${doc.douData.toISOString().slice(0, 10)}`);
    lines.push('');
  }

  return lines.join('\n');
}

export function generateActMd(act: DbLegislativeAct): string {
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

  lines.push(`> ${act.ementa}`);
  lines.push('');

  if (act.summary) {
    lines.push(act.summary);
    lines.push('');
  }

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

export function generateDecisionMd(dec: DbTribunalDecision): string {
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

  if (dec.relator) lines.push(`**Relator:** ${dec.relator}`);
  if (dec.orgaoJulgador) lines.push(`**Órgão:** ${dec.orgaoJulgador}`);
  lines.push('');

  lines.push(`> ${dec.ementa.split('\n')[0]}`);
  for (const line of dec.ementa.split('\n').slice(1)) {
    if (line.trim()) lines.push(`> ${line}`);
  }
  lines.push('');

  if (dec.summary) {
    lines.push(dec.summary);
    lines.push('');
  }

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

export function generateEnunciadoMd(en: Enunciado): string {
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

  lines.push(`> ${en.texto}`);
  lines.push('');

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

export function generateTemaMd(
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

  lines.push('## Artigos');
  for (const artNum of tema.articles) {
    const art = LEI_14133_ARTIGOS[artNum];
    if (art) {
      lines.push(`- ${wikilink(articleSlug(art))}`);
    }
  }
  lines.push('');

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

export function generateMOC(
  documents: DbDocument[],
  acts: DbLegislativeAct[],
  decisions: DbTribunalDecision[],
): string {
  const lines: string[] = [];

  lines.push('# Lei 14.133/2021 — Mapa de Conteúdo');
  lines.push('');

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

  lines.push('## Temas');
  lines.push('');
  for (const tema of TEMAS_LICITACOES) {
    const slug = temaSlug(tema.value, tema.label);
    lines.push(`- ${wikilink(slug)} (${tema.articles.length} artigos)`);
  }
  lines.push('');

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

export interface FileEntry {
  path: string;
  content: string;
}

export async function writeVault(outputDir: string, files: FileEntry[]): Promise<void> {
  const dirs = new Set<string>();
  for (const f of files) {
    const dir = join(outputDir, f.path, '..');
    dirs.add(resolve(dir));
  }

  for (const d of dirs) {
    await mkdir(d, { recursive: true });
  }

  for (const f of files) {
    await writeFile(join(outputDir, f.path), f.content, 'utf-8');
  }
}

// ---------------------------------------------------------------------------
// Full export: generate all files from DB data
// ---------------------------------------------------------------------------

export function generateAllFiles(
  documents: DbDocument[],
  acts: DbLegislativeAct[],
  decisions: DbTribunalDecision[],
): FileEntry[] {
  const graph = buildLinkGraph(documents, acts, decisions);
  const files: FileEntry[] = [];
  const articleEntries = Object.entries(LEI_14133_ARTIGOS);

  // Articles
  for (const [, art] of articleEntries) {
    files.push({
      path: join('Artigos', `${articleSlug(art)}.md`),
      content: generateArticleMd(art, graph),
    });
  }

  // Documents (deduplicate by slug)
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

  // Legislative Acts
  for (const act of acts) {
    files.push({
      path: join('Atos Normativos', `${actSlug(act)}.md`),
      content: generateActMd(act),
    });
  }

  // Decisions (deduplicate by slug)
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

  // Enunciados
  for (const en of ENUNCIADOS) {
    files.push({
      path: join('Enunciados', `${enunciadoSlug(en)}.md`),
      content: generateEnunciadoMd(en),
    });
  }

  // Temas
  for (const tema of TEMAS_LICITACOES) {
    files.push({
      path: join('Temas', `${temaSlug(tema.value, tema.label)}.md`),
      content: generateTemaMd(tema, documents, acts, decisions),
    });
  }

  // MOC
  files.push({
    path: 'MOC.md',
    content: generateMOC(documents, acts, decisions),
  });

  return files;
}

// Re-export static data for convenience
export { LEI_14133_ARTIGOS, ENUNCIADOS, TEMAS_LICITACOES, CROSS_REFERENCES };
export type { LeiArticle, Enunciado, CrossReference };
