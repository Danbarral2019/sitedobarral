/**
 * Newsletter Email Templates v0.2 (HTML reutilizável)
 *
 * Melhorias v0.2:
 * - Texto introdutório gerado por IA (panorama do mês)
 * - Seção de conteúdos autorais (blog, publicações, vídeos)
 * - Jurisprudência filtrada por relevância com AI summaries
 * - Cobertura de todas as categorias de documentos
 * - Seção de alterações legislativas
 * - Links de redes sociais corrigidos
 *
 * Design: header com gradiente azul-marinho, cards por categoria, CTA, footer profissional
 * Compatível Gmail/Outlook (inline styles, tables, sem CSS classes)
 */

import type { FilteredDecision } from '@/lib/newsletter/relevance-filter';

// ===========================
// Types
// ===========================

export interface MonthlyNewsletterData {
  sendId: string;
  introHtml: string;
  authorContent: {
    blogPosts: Array<{ title: string; slug: string; excerpt: string; publishedAt: Date }>;
    publications: Array<{ title: string; type: string; description: string; externalUrl: string | null; publishedAt: Date }>;
    videos: Array<{ title: string; courseId: string; youtubeUrl: string | null }>;
  };
  selectedDecisions: FilteredDecision[];
  documentsByCategory: Record<string, Array<{
    id: string;
    title: string;
    description: string | null;
    category: string;
    uploadedAt: Date;
    url: string | null;
  }>>;
  legislativeChanges: Array<{ fullNumber: string; title: string; ementa: string; publishDate: Date }>;
  totalDocuments: number;
}

// ===========================
// Constants
// ===========================

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://profdanielbarral.com';

function trackingPixel(sendId: string): string {
  return `<img src="${baseUrl}/api/newsletter/track?id=${sendId}&type=open" width="1" height="1" style="display:block;" alt="" />`;
}

const categoryNames: Record<string, string> = {
  'apostila': 'Apostilas e Material Did\u00e1tico',
  'parecer': 'Pareceres Jur\u00eddicos',
  'edital': 'Editais',
  'artigo': 'Artigos e Doutrinas',
  'orientacao-normativa': 'Orienta\u00e7\u00f5es Normativas',
  'decor': 'DECOR',
  'enunciado': 'Enunciados',
  'boa_pratica': 'Outros Atos Normativos',
  'sumula': 'S\u00famulas',
  'legislacao': 'Legisla\u00e7\u00e3o',
  'outro': 'Outros Documentos',
};

const categoryIcons: Record<string, string> = {
  'apostila': '&#128214;',
  'parecer': '&#128196;',
  'edital': '&#128203;',
  'artigo': '&#128221;',
  'orientacao-normativa': '&#128220;',
  'decor': '&#128218;',
  'enunciado': '&#128209;',
  'boa_pratica': '&#128203;',
  'sumula': '&#128203;',
  'legislacao': '&#9878;',
  'outro': '&#128195;',
};

const categoryColors: Record<string, string> = {
  'apostila': '#20364e',
  'parecer': '#20364e',
  'edital': '#20364e',
  'artigo': '#8a6235',
  'orientacao-normativa': '#8a6235',
  'decor': '#20364e',
  'enunciado': '#20364e',
  'boa_pratica': '#20364e',
  'sumula': '#20364e',
  'legislacao': '#8a6235',
  'outro': '#6b6e72',
};

const tribunalColors: Record<string, string> = {
  'TCU': '#20364e',
  'TCE-SP': '#20364e',
  'TCE-MG': '#20364e',
  'TCE-PR': '#20364e',
  'TCE-SC': '#20364e',
  'TCE-RJ': '#8a6235',
  'TCE-RS': '#8a6235',
  'TCE-PE': '#20364e',
  'STJ': '#8a6235',
  'STF': '#8a6235',
  'CNJ': '#20364e',
  'TST': '#20364e',
};

// ===========================
// Shared Render Helpers
// ===========================

function renderHeader(): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#20364e;">
      <tr>
        <td align="center" style="padding:0;">
          <!--[if mso]>
          <table width="600" cellpadding="0" cellspacing="0" border="0"><tr><td style="background-color:#20364e;padding:40px 30px;">
          <![endif]-->
          <!--[if !mso]><!-->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#20364e;">
            <tr>
              <td align="center" style="padding:40px 30px;">
          <!--<![endif]-->
                <h1 style="margin:0;font-size:32px;color:#ffffff;font-family:Georgia,'Times New Roman',serif;font-weight:700;letter-spacing:0.5px;">Prof. Daniel Barral</h1>
                <table cellpadding="0" cellspacing="0" border="0" style="margin:12px auto 0 auto;">
                  <tr>
                    <td style="height:2px;background-color:#b07d3a;font-size:0;line-height:0;width:60px;">&nbsp;</td>
                  </tr>
                </table>
                <p style="margin:14px 0 0 0;font-size:15px;color:#eeeae4;font-family:Arial,Helvetica,sans-serif;letter-spacing:0.3px;">Direito Administrativo, Licita&#231;&#245;es e Contratos</p>
          <!--[if mso]>
          </td></tr></table>
          <![endif]-->
          <!--[if !mso]><!-->
              </td>
            </tr>
          </table>
          <!--<![endif]-->
        </td>
      </tr>
    </table>`;
}

function renderFooter(sendId: string): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#1a1c20;">
      <tr>
        <td align="center" style="padding:30px 20px 15px 20px;">
          <p style="margin:0 0 6px 0;font-size:16px;color:#f7f6f3;font-family:Georgia,'Times New Roman',serif;font-weight:700;">Prof. Daniel Barral</p>
          <p style="margin:0 0 16px 0;font-size:13px;color:#6b6e72;font-family:Arial,Helvetica,sans-serif;">Direito Administrativo, Licita&#231;&#245;es e Contratos</p>
          <table cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="center" style="padding:0 8px;">
                <a href="https://www.linkedin.com/in/daniel-de-andrade-oliveira-barral-b5110870/" style="color:#e9d8b8;text-decoration:none;font-size:13px;font-family:Arial,Helvetica,sans-serif;">LinkedIn</a>
              </td>
              <td style="color:#3d4044;font-size:13px;">|</td>
              <td align="center" style="padding:0 8px;">
                <a href="https://instagram.com/danbarral" style="color:#e9d8b8;text-decoration:none;font-size:13px;font-family:Arial,Helvetica,sans-serif;">Instagram</a>
              </td>
              <td style="color:#3d4044;font-size:13px;">|</td>
              <td align="center" style="padding:0 8px;">
                <a href="${baseUrl}" style="color:#e9d8b8;text-decoration:none;font-size:13px;font-family:Arial,Helvetica,sans-serif;">Site</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding:0 20px;">
          <table width="80%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="height:1px;background-color:#3d4044;font-size:0;line-height:0;">&nbsp;</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding:15px 20px 10px 20px;">
          <p style="margin:0 0 8px 0;font-size:12px;color:#6b6e72;font-family:Arial,Helvetica,sans-serif;line-height:1.5;">
            Voc&#234; est&#225; recebendo este email porque se inscreveu na nossa newsletter.
          </p>
          <p style="margin:0 0 8px 0;font-size:12px;color:#6b6e72;font-family:Arial,Helvetica,sans-serif;">
            <a href="${baseUrl}/newsletter/unsubscribe" style="color:#6b6e72;text-decoration:underline;">Cancelar inscri&#231;&#227;o</a>
          </p>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding:0 20px 20px 20px;">
          <p style="margin:0;font-size:11px;color:#3d4044;font-family:Arial,Helvetica,sans-serif;">
            &copy; ${new Date().getFullYear()} Prof. Daniel Barral. Todos os direitos reservados.
          </p>
          ${trackingPixel(sendId)}
        </td>
      </tr>
    </table>`;
}

function renderCTAButton(text: string, url: string): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="center" style="padding:24px 20px;">
          <table cellpadding="0" cellspacing="0" border="0">
            <tr>
              <!--[if mso]>
              <td align="center" bgcolor="#20364e" style="border-radius:8px;padding:16px 48px;">
                <a href="${url}" style="display:inline-block;color:#ffffff;text-decoration:none;font-size:17px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;">${text}</a>
              </td>
              <![endif]-->
              <!--[if !mso]><!-->
              <td align="center" style="background:#20364e;border-radius:8px;box-shadow:0 4px 14px rgba(37,99,235,0.35);">
                <a href="${url}" style="display:inline-block;padding:16px 48px;color:#ffffff;text-decoration:none;font-size:17px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;letter-spacing:0.3px;">${text} &rarr;</a>
              </td>
              <!--<![endif]-->
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

function renderPreheader(text: string): string {
  return `<div style="display:none;font-size:1px;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;">${text}&#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;</div>`;
}

function renderSectionTitle(icon: string, title: string, subtitle?: string): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
      <tr>
        <td style="padding:0;">
          <span style="font-size:20px;vertical-align:middle;">${icon}</span>
          <span style="font-size:20px;color:#1a1c20;font-family:Georgia,'Times New Roman',serif;font-weight:700;vertical-align:middle;padding-left:8px;">${title}</span>
          ${subtitle ? `<span style="font-size:13px;color:#6b6e72;font-family:Arial,Helvetica,sans-serif;vertical-align:middle;padding-left:8px;">${subtitle}</span>` : ''}
        </td>
      </tr>
      <tr>
        <td style="padding:6px 0 0 0;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="height:2px;background:#20364e;font-size:0;line-height:0;width:60px;">&nbsp;</td></tr>
          </table>
        </td>
      </tr>
    </table>`;
}

// ===========================
// Section: Author Content
// ===========================

function renderAuthorContentSection(authorContent: MonthlyNewsletterData['authorContent']): string {
  const { blogPosts, publications, videos } = authorContent;
  const hasContent = blogPosts.length > 0 || publications.length > 0 || videos.length > 0;

  if (!hasContent) return '';

  let items = '';

  // Blog posts
  for (const post of blogPosts) {
    items += `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px;border:1px solid #e9d8b8;border-left:4px solid #b07d3a;border-radius:6px;background-color:#e9d8b8;">
        <tr>
          <td style="padding:14px 16px;">
            <p style="margin:0 0 2px 0;font-size:11px;color:#8a6235;font-family:Arial,Helvetica,sans-serif;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">&#128221; Artigo no Blog</p>
            <h3 style="margin:0 0 6px 0;font-size:15px;color:#1a1c20;font-family:Arial,Helvetica,sans-serif;font-weight:600;">
              <a href="${baseUrl}/blog/${post.slug}" style="color:#1a1c20;text-decoration:none;">${post.title}</a>
            </h3>
            <p style="margin:0 0 8px 0;color:#6b6e72;font-size:13px;line-height:1.6;font-family:Arial,Helvetica,sans-serif;">
              ${post.excerpt.substring(0, 180)}${post.excerpt.length > 180 ? '...' : ''}
            </p>
            <a href="${baseUrl}/blog/${post.slug}" style="color:#8a6235;font-size:13px;font-weight:600;font-family:Arial,Helvetica,sans-serif;text-decoration:none;">Ler artigo &rarr;</a>
          </td>
        </tr>
      </table>`;
  }

  // Publications
  const publicationTypeNames: Record<string, string> = {
    'livro': 'Livro',
    'artigo': 'Artigo Publicado',
    'noticia': 'Not\u00edcia',
  };

  for (const pub of publications) {
    const typeName = publicationTypeNames[pub.type] || pub.type;
    items += `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px;border:1px solid #e9d8b8;border-left:4px solid #b07d3a;border-radius:6px;background-color:#e9d8b8;">
        <tr>
          <td style="padding:14px 16px;">
            <p style="margin:0 0 2px 0;font-size:11px;color:#8a6235;font-family:Arial,Helvetica,sans-serif;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">&#128218; ${typeName}</p>
            <h3 style="margin:0 0 6px 0;font-size:15px;color:#1a1c20;font-family:Arial,Helvetica,sans-serif;font-weight:600;">${pub.title}</h3>
            <p style="margin:0 0 8px 0;color:#6b6e72;font-size:13px;line-height:1.6;font-family:Arial,Helvetica,sans-serif;">
              ${pub.description.substring(0, 180)}${pub.description.length > 180 ? '...' : ''}
            </p>
            ${pub.externalUrl ? `<a href="${pub.externalUrl}" style="color:#8a6235;font-size:13px;font-weight:600;font-family:Arial,Helvetica,sans-serif;text-decoration:none;">Acessar &rarr;</a>` : ''}
          </td>
        </tr>
      </table>`;
  }

  // Videos
  for (const video of videos) {
    items += `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px;border:1px solid #e9d8b8;border-left:4px solid #b07d3a;border-radius:6px;background-color:#e9d8b8;">
        <tr>
          <td style="padding:14px 16px;">
            <p style="margin:0 0 2px 0;font-size:11px;color:#8a6235;font-family:Arial,Helvetica,sans-serif;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">&#127909; V&#237;deo</p>
            <h3 style="margin:0 0 6px 0;font-size:15px;color:#1a1c20;font-family:Arial,Helvetica,sans-serif;font-weight:600;">${video.title}</h3>
            <a href="${video.youtubeUrl ?? ''}" style="color:#8a6235;font-size:13px;font-weight:600;font-family:Arial,Helvetica,sans-serif;text-decoration:none;">Assistir &rarr;</a>
          </td>
        </tr>
      </table>`;
  }

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;">
      <tr>
        <td>
          ${renderSectionTitle('&#11088;', 'Destaques do Professor')}
          ${items}
        </td>
      </tr>
    </table>`;
}

// ===========================
// Section: Selected Decisions (Jurisprudência)
// ===========================

function renderSelectedDecisionsSection(decisions: FilteredDecision[]): string {
  if (decisions.length === 0) return '';

  let decisionCards = '';
  for (const decision of decisions) {
    const tribunalColor = tribunalColors[decision.tribunalCode] || '#6b6e72';

    // Theme tags
    const themeTags = decision.themes.slice(0, 3).map(theme =>
      `<span style="display:inline-block;padding:2px 8px;margin:0 4px 4px 0;background-color:#f7f6f3;border-radius:4px;font-size:11px;color:#3d4044;font-family:Arial,Helvetica,sans-serif;">${theme}</span>`
    ).join('');

    // Lei articles
    const articleTags = decision.leiArticles.slice(0, 4).map(art =>
      `<span style="display:inline-block;padding:2px 8px;margin:0 4px 4px 0;background-color:#f7f6f3;border-radius:4px;font-size:11px;color:#20364e;font-family:Arial,Helvetica,sans-serif;">Art. ${art}</span>`
    ).join('');

    decisionCards += `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px;border:1px solid #e8e6e1;border-left:4px solid ${tribunalColor};border-radius:6px;background-color:#f7f6f3;">
        <tr>
          <td style="padding:16px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;">
              <tr>
                <td>
                  <span style="display:inline-block;padding:3px 10px;background-color:${tribunalColor};border-radius:4px;font-size:11px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-weight:600;">${decision.tribunalCode}</span>
                </td>
              </tr>
            </table>
            <h3 style="margin:0 0 8px 0;font-size:15px;color:#1a1c20;font-family:Arial,Helvetica,sans-serif;font-weight:600;line-height:1.4;">
              ${decision.title}
            </h3>
            <p style="margin:0 0 10px 0;color:#3d4044;font-size:13px;line-height:1.7;font-family:Arial,Helvetica,sans-serif;">
              ${decision.aiSummary}
            </p>
            ${themeTags || articleTags ? `
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:0;">
                    ${themeTags}${articleTags}
                  </td>
                </tr>
              </table>
            ` : ''}
          </td>
        </tr>
      </table>`;
  }

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;">
      <tr>
        <td>
          ${renderSectionTitle('&#9878;', 'Jurisprud&#234;ncia Selecionada', `(${decisions.length} decis&#245;es)`)}
          <p style="margin:0 0 16px 0;font-size:13px;color:#6b6e72;font-family:Arial,Helvetica,sans-serif;line-height:1.5;">
            Selecionamos as decis&#245;es mais relevantes do m&#234;s para o estudo da Lei 14.133/2021, com resumo explicativo de cada uma.
          </p>
          ${decisionCards}
        </td>
      </tr>
    </table>`;
}

// ===========================
// Section: Other Document Categories
// ===========================

function renderDocumentCategories(documentsByCategory: MonthlyNewsletterData['documentsByCategory']): string {
  let sections = '';

  for (const [category, docs] of Object.entries(documentsByCategory)) {
    const categoryName = categoryNames[category] || category;
    const borderColor = categoryColors[category] || '#6b6e72';
    const icon = categoryIcons[category] || '&#128195;';

    let docRows = '';
    docs.forEach((doc, index) => {
      docRows += `
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;border:1px solid #f7f6f3;border-radius:6px;background-color:#f7f6f3;">
          <tr>
            <td style="padding:14px 16px;">
              <h3 style="margin:0 0 6px 0;font-size:15px;color:#1a1c20;font-family:Arial,Helvetica,sans-serif;font-weight:600;">
                ${index + 1}. ${doc.title}
              </h3>
              ${doc.description ? `
                <p style="margin:0 0 8px 0;color:#6b6e72;font-size:13px;line-height:1.6;font-family:Arial,Helvetica,sans-serif;">
                  ${doc.description.substring(0, 200)}${doc.description.length > 200 ? '...' : ''}
                </p>
              ` : ''}
              <p style="margin:0;font-size:12px;color:#6b6e72;font-family:Arial,Helvetica,sans-serif;">
                Adicionado em: ${new Date(doc.uploadedAt).toLocaleDateString('pt-BR')}
              </p>
            </td>
          </tr>
        </table>`;
    });

    sections += `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
        <tr>
          <td>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px;border-bottom:2px solid ${borderColor};">
              <tr>
                <td style="padding:0 0 10px 0;">
                  <span style="font-size:18px;vertical-align:middle;">${icon}</span>
                  <span style="font-size:19px;color:#1a1c20;font-family:Arial,Helvetica,sans-serif;font-weight:700;vertical-align:middle;padding-left:6px;">${categoryName}</span>
                  <span style="font-size:13px;color:#6b6e72;font-family:Arial,Helvetica,sans-serif;vertical-align:middle;padding-left:8px;">(${docs.length})</span>
                </td>
              </tr>
            </table>
            ${docRows}
          </td>
        </tr>
      </table>`;
  }

  if (!sections) return '';

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
      <tr>
        <td>
          ${renderSectionTitle('&#128196;', 'Demais Documentos')}
          ${sections}
        </td>
      </tr>
    </table>`;
}

// ===========================
// Section: Legislative Changes
// ===========================

function renderLegislativeChangesSection(changes: MonthlyNewsletterData['legislativeChanges']): string {
  if (changes.length === 0) return '';

  let rows = '';
  for (const act of changes) {
    rows += `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;border:1px solid #e9d8b8;border-left:4px solid #8a6235;border-radius:6px;background-color:#e9d8b8;">
        <tr>
          <td style="padding:14px 16px;">
            <p style="margin:0 0 2px 0;font-size:11px;color:#8a6235;font-family:Arial,Helvetica,sans-serif;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">${act.fullNumber}</p>
            <h3 style="margin:0 0 6px 0;font-size:15px;color:#1a1c20;font-family:Arial,Helvetica,sans-serif;font-weight:600;">${act.title}</h3>
            <p style="margin:0;color:#6b6e72;font-size:13px;line-height:1.6;font-family:Arial,Helvetica,sans-serif;">
              ${act.ementa.substring(0, 250)}${act.ementa.length > 250 ? '...' : ''}
            </p>
          </td>
        </tr>
      </table>`;
  }

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;">
      <tr>
        <td>
          ${renderSectionTitle('&#128220;', 'Altera&#231;&#245;es Legislativas')}
          ${rows}
        </td>
      </tr>
    </table>`;
}

// ===========================
// Main Render Function
// ===========================

export function renderMonthlyNewsletter(data: MonthlyNewsletterData): string {
  const {
    sendId,
    introHtml,
    authorContent,
    selectedDecisions,
    documentsByCategory,
    legislativeChanges,
    totalDocuments,
  } = data;

  const categoryCount = Object.keys(documentsByCategory).length;
  const hasAuthorContent = authorContent.blogPosts.length > 0 || authorContent.publications.length > 0 || authorContent.videos.length > 0;

  // Mini dashboard stats (3 columns)
  const statsHtml = `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px 0;">
      <tr>
        <td width="33%" style="padding:0 4px 0 0;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e8e6e1;border-radius:8px;background-color:#f7f6f3;">
            <tr>
              <td align="center" style="padding:16px 8px;">
                <p style="margin:0 0 4px 0;font-size:28px;color:#20364e;font-family:Georgia,'Times New Roman',serif;font-weight:700;">${totalDocuments}</p>
                <p style="margin:0;font-size:11px;color:#6b6e72;font-family:Arial,Helvetica,sans-serif;text-transform:uppercase;letter-spacing:0.5px;">Documentos</p>
              </td>
            </tr>
          </table>
        </td>
        <td width="34%" style="padding:0 2px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e8e6e1;border-radius:8px;background-color:#f7f6f3;">
            <tr>
              <td align="center" style="padding:16px 8px;">
                <p style="margin:0 0 4px 0;font-size:28px;color:#20364e;font-family:Georgia,'Times New Roman',serif;font-weight:700;">${selectedDecisions.length}</p>
                <p style="margin:0;font-size:11px;color:#6b6e72;font-family:Arial,Helvetica,sans-serif;text-transform:uppercase;letter-spacing:0.5px;">Destaques</p>
              </td>
            </tr>
          </table>
        </td>
        <td width="33%" style="padding:0 0 0 4px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e8e6e1;border-radius:8px;background-color:#f7f6f3;">
            <tr>
              <td align="center" style="padding:16px 8px;">
                <p style="margin:0 0 4px 0;font-size:28px;color:#20364e;font-family:Georgia,'Times New Roman',serif;font-weight:700;">${categoryCount + (selectedDecisions.length > 0 ? 1 : 0) + (legislativeChanges.length > 0 ? 1 : 0) + (hasAuthorContent ? 1 : 0)}</p>
                <p style="margin:0;font-size:11px;color:#6b6e72;font-family:Arial,Helvetica,sans-serif;text-transform:uppercase;letter-spacing:0.5px;">Se&#231;&#245;es</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;

  return `<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Newsletter Mensal - Prof. Daniel Barral</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#f7f6f3;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  ${renderPreheader(`Destaques de Licita&#231;&#245;es e Contratos: ${selectedDecisions.length} decis&#245;es selecionadas, ${totalDocuments} documentos. Confira a curadoria mensal do Prof. Daniel Barral.`)}
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f7f6f3;">
    <tr>
      <td align="center" style="padding:20px 10px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <tr><td>${renderHeader()}</td></tr>
          <tr>
            <td style="padding:30px 30px 10px 30px;">

              <!-- 1. Saudação + Texto Introdutório IA -->
              <p style="margin:0 0 16px 0;font-size:17px;color:#3d4044;font-family:Arial,Helvetica,sans-serif;line-height:1.6;">
                Ol&#225;, <strong>{{NAME}}</strong>!
              </p>
              <p style="margin:0 0 24px 0;font-size:15px;color:#3d4044;line-height:1.7;font-family:Arial,Helvetica,sans-serif;">
                ${introHtml}
              </p>

              <!-- 2. Mini Dashboard -->
              ${statsHtml}

              <!-- 3. Conteúdos do Professor -->
              ${renderAuthorContentSection(authorContent)}

              <!-- 4. Jurisprudência Selecionada -->
              ${renderSelectedDecisionsSection(selectedDecisions)}

              <!-- 5. Demais Categorias de Documentos -->
              ${renderDocumentCategories(documentsByCategory)}

              <!-- 6. Alterações Legislativas -->
              ${renderLegislativeChangesSection(legislativeChanges)}

              <!-- 7. CTA Arquivo Completo -->
              ${renderCTAButton('Ver todos os documentos do m&#234;s', `${baseUrl}/novidades`)}

              <!-- 8. Próximos Passos -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px 0;border:1px solid #eeeae4;border-left:4px solid #20364e;border-radius:8px;background-color:#f7f6f3;">
                <tr>
                  <td style="padding:20px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="28" valign="top" style="font-size:18px;padding-right:10px;">&#128640;</td>
                        <td>
                          <p style="margin:0 0 6px 0;color:#20364e;font-size:15px;font-weight:700;font-family:Arial,Helvetica,sans-serif;">Pr&#243;ximos Passos</p>
                          <p style="margin:0;color:#20364e;font-size:14px;font-family:Arial,Helvetica,sans-serif;line-height:1.6;">
                            Acesse a <a href="${baseUrl}/area-restrita" style="color:#20364e;font-weight:600;">&#193;rea Restrita</a> para consultar os documentos na &#237;ntegra, utilizar o assistente de IA e acompanhar todas as novidades da plataforma.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${renderCTAButton('Acessar &#193;rea Restrita', `${baseUrl}/area-restrita`)}
            </td>
          </tr>
          <tr><td>${renderFooter(sendId)}</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
