/**
 * Newsletter Email Templates (HTML reutilizável)
 * Design: header com gradiente azul-marinho, cards por categoria, CTA, footer profissional
 * Compatível Gmail/Outlook (inline styles, tables, sem CSS classes)
 */

interface WeeklyNewsletterData {
  sendId: string;
  coursesWithNewContent: Array<{
    courseTitle: string;
    documentCount: number;
    documents: Array<{ title: string; category: string }>;
  }>;
  totalNewDocuments: number;
  newVideos: number;
  newTribunalDecisions?: number;
}

interface MonthlyNewsletterData {
  sendId: string;
  documentsByCategory: Record<string, Array<{
    id: string;
    title: string;
    description: string | null;
    category: string;
    uploadedAt: Date;
    url: string | null;
  }>>;
  totalDocuments: number;
}

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://profdanielbarral.com.br';

function trackUrl(sendId: string, originalUrl: string): string {
  return `${baseUrl}/api/newsletter/track?id=${sendId}&type=click&url=${encodeURIComponent(originalUrl)}`;
}

function trackingPixel(sendId: string): string {
  return `<img src="${baseUrl}/api/newsletter/track?id=${sendId}&type=open" width="1" height="1" style="display:block;" alt="" />`;
}

const categoryNames: Record<string, string> = {
  'apostila': 'Apostilas e Material Didático',
  'acordao': 'Acórdãos',
  'parecer': 'Pareceres Jurídicos',
  'edital': 'Editais',
  'artigo': 'Artigos e Doutrinas',
  'orientacao-normativa': 'Orientações Normativas',
  'decor': 'DECOR',
  'enunciado': 'Enunciados',
  'boa_pratica': 'Outros Atos Normativos',
  'tribunal-decisions': 'Decisões de Tribunais (TCEs e CNJ)',
  'outro': 'Outros Documentos',
};

const categoryIcons: Record<string, string> = {
  'apostila': '&#128214;',
  'acordao': '&#9878;',
  'parecer': '&#128196;',
  'edital': '&#128203;',
  'artigo': '&#128221;',
  'orientacao-normativa': '&#128220;',
  'decor': '&#128218;',
  'enunciado': '&#128209;',
  'outro': '&#128195;',
};

const categoryColors: Record<string, string> = {
  'apostila': '#2563eb',
  'acordao': '#7c3aed',
  'parecer': '#0891b2',
  'edital': '#059669',
  'artigo': '#d97706',
  'orientacao-normativa': '#dc2626',
  'decor': '#4f46e5',
  'enunciado': '#0d9488',
  'outro': '#6b7280',
};

function renderHeader(): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#1e3a5f;">
      <tr>
        <td align="center" style="padding:0;">
          <!--[if mso]>
          <table width="600" cellpadding="0" cellspacing="0" border="0"><tr><td style="background-color:#1e3a5f;padding:40px 30px;">
          <![endif]-->
          <!--[if !mso]><!-->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%);">
            <tr>
              <td align="center" style="padding:40px 30px;">
          <!--<![endif]-->
                <h1 style="margin:0;font-size:32px;color:#ffffff;font-family:Georgia,'Times New Roman',serif;font-weight:700;letter-spacing:0.5px;">Prof. Daniel Barral</h1>
                <table cellpadding="0" cellspacing="0" border="0" style="margin:12px auto 0 auto;">
                  <tr>
                    <td style="height:2px;background-color:#60a5fa;font-size:0;line-height:0;width:60px;">&nbsp;</td>
                  </tr>
                </table>
                <p style="margin:14px 0 0 0;font-size:15px;color:#bfdbfe;font-family:Arial,Helvetica,sans-serif;letter-spacing:0.3px;">Direito Administrativo, Licita&#231;&#245;es e Contratos</p>
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
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#1e293b;">
      <tr>
        <td align="center" style="padding:30px 20px 15px 20px;">
          <p style="margin:0 0 6px 0;font-size:16px;color:#f1f5f9;font-family:Georgia,'Times New Roman',serif;font-weight:700;">Prof. Daniel Barral</p>
          <p style="margin:0 0 16px 0;font-size:13px;color:#94a3b8;font-family:Arial,Helvetica,sans-serif;">Direito Administrativo, Licita&#231;&#245;es e Contratos</p>
          <table cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="center" style="padding:0 8px;">
                <a href="${trackUrl(sendId, 'https://www.linkedin.com/in/danielbarral')}" style="color:#60a5fa;text-decoration:none;font-size:13px;font-family:Arial,Helvetica,sans-serif;">LinkedIn</a>
              </td>
              <td style="color:#475569;font-size:13px;">|</td>
              <td align="center" style="padding:0 8px;">
                <a href="${trackUrl(sendId, '#')}" style="color:#60a5fa;text-decoration:none;font-size:13px;font-family:Arial,Helvetica,sans-serif;">Instagram</a>
              </td>
              <td style="color:#475569;font-size:13px;">|</td>
              <td align="center" style="padding:0 8px;">
                <a href="${trackUrl(sendId, baseUrl)}" style="color:#60a5fa;text-decoration:none;font-size:13px;font-family:Arial,Helvetica,sans-serif;">Site</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding:0 20px;">
          <table width="80%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="height:1px;background-color:#334155;font-size:0;line-height:0;">&nbsp;</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding:15px 20px 10px 20px;">
          <p style="margin:0 0 8px 0;font-size:12px;color:#64748b;font-family:Arial,Helvetica,sans-serif;line-height:1.5;">
            Voc&#234; est&#225; recebendo este email porque se inscreveu na nossa newsletter.
          </p>
          <p style="margin:0 0 8px 0;font-size:12px;color:#64748b;font-family:Arial,Helvetica,sans-serif;">
            <a href="${trackUrl(sendId, `${baseUrl}/newsletter/unsubscribe`)}" style="color:#94a3b8;text-decoration:underline;">Cancelar inscri&#231;&#227;o</a>
          </p>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding:0 20px 20px 20px;">
          <p style="margin:0;font-size:11px;color:#475569;font-family:Arial,Helvetica,sans-serif;">
            &copy; ${new Date().getFullYear()} Prof. Daniel Barral. Todos os direitos reservados.
          </p>
          ${trackingPixel(sendId)}
        </td>
      </tr>
    </table>`;
}

function renderCTAButton(sendId: string, text: string, url: string): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="center" style="padding:30px 20px;">
          <table cellpadding="0" cellspacing="0" border="0">
            <tr>
              <!--[if mso]>
              <td align="center" bgcolor="#2563eb" style="border-radius:8px;padding:16px 48px;">
                <a href="${trackUrl(sendId, url)}" style="display:inline-block;color:#ffffff;text-decoration:none;font-size:17px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;">${text}</a>
              </td>
              <![endif]-->
              <!--[if !mso]><!-->
              <td align="center" style="background:linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);border-radius:8px;box-shadow:0 4px 14px rgba(37,99,235,0.35);">
                <a href="${trackUrl(sendId, url)}" style="display:inline-block;padding:16px 48px;color:#ffffff;text-decoration:none;font-size:17px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;letter-spacing:0.3px;">${text} &rarr;</a>
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

export function renderWeeklyNewsletter(data: WeeklyNewsletterData): string {
  const { sendId, coursesWithNewContent, totalNewDocuments, newVideos, newTribunalDecisions = 0 } = data;
  const totalContent = totalNewDocuments + newVideos + newTribunalDecisions;

  let contentCards = '';
  for (const { courseTitle, documentCount, documents } of coursesWithNewContent) {
    const icon = documents.length > 0 ? (categoryIcons[documents[0].category] || '&#128195;') : '&#128195;';
    const docList = documents.slice(0, 3).map(doc =>
      `<tr>
        <td style="padding:6px 0 6px 20px;color:#374151;font-size:14px;font-family:Arial,Helvetica,sans-serif;line-height:1.5;">
          <span style="color:#9ca3af;">&#8226;</span>&nbsp; ${doc.title}
        </td>
      </tr>`
    ).join('');
    const moreCount = documentCount - 3;
    const moreRow = moreCount > 0
      ? `<tr><td style="padding:6px 0 6px 20px;color:#9ca3af;font-size:13px;font-style:italic;font-family:Arial,Helvetica,sans-serif;">E mais ${moreCount} ${moreCount === 1 ? 'material' : 'materiais'}...</td></tr>`
      : '';

    contentCards += `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:12px 0;border:1px solid #e5e7eb;border-left:4px solid #2563eb;border-radius:8px;">
        <tr>
          <td style="padding:20px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="30" valign="top" style="font-size:20px;padding-right:10px;">${icon}</td>
                <td>
                  <h3 style="margin:0 0 6px 0;color:#1e293b;font-size:17px;font-family:Arial,Helvetica,sans-serif;font-weight:700;">${courseTitle}</h3>
                  <p style="color:#64748b;margin:0 0 12px 0;font-size:13px;font-family:Arial,Helvetica,sans-serif;">${documentCount} ${documentCount === 1 ? 'novo material adicionado' : 'novos materiais adicionados'}</p>
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              ${docList}
              ${moreRow}
            </table>
          </td>
        </tr>
      </table>`;
  }

  if (newVideos > 0) {
    contentCards += `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:12px 0;border:1px solid #e5e7eb;border-left:4px solid #dc2626;border-radius:8px;">
        <tr>
          <td style="padding:20px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="30" valign="top" style="font-size:20px;padding-right:10px;">&#127909;</td>
                <td>
                  <h3 style="margin:0 0 6px 0;color:#1e293b;font-size:17px;font-family:Arial,Helvetica,sans-serif;font-weight:700;">V&#237;deos</h3>
                  <p style="color:#64748b;margin:0;font-size:13px;font-family:Arial,Helvetica,sans-serif;">${newVideos} ${newVideos === 1 ? 'novo v&#237;deo adicionado' : 'novos v&#237;deos adicionados'}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>`;
  }

  if (newTribunalDecisions > 0) {
    contentCards += `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:12px 0;border:1px solid #e5e7eb;border-left:4px solid #6366f1;border-radius:8px;">
        <tr>
          <td style="padding:20px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="30" valign="top" style="font-size:20px;padding-right:10px;">&#9878;</td>
                <td>
                  <h3 style="margin:0 0 6px 0;color:#1e293b;font-size:17px;font-family:Arial,Helvetica,sans-serif;font-weight:700;">Decis&#245;es de Tribunais</h3>
                  <p style="color:#64748b;margin:0;font-size:13px;font-family:Arial,Helvetica,sans-serif;">${newTribunalDecisions} ${newTribunalDecisions === 1 ? 'nova decis&#227;o de TCE/CNJ' : 'novas decis&#245;es de TCEs e CNJ'}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>`;
  }

  return `<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Novidades da Semana - Prof. Daniel Barral</title>
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
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#f1f5f9;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  ${renderPreheader(`${totalContent} novos conte&#250;dos dispon&#237;veis esta semana na plataforma do Prof. Daniel Barral.`)}
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9;">
    <tr>
      <td align="center" style="padding:20px 10px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <tr><td>${renderHeader()}</td></tr>
          <tr>
            <td style="padding:30px 30px 10px 30px;">
              <p style="margin:0 0 24px 0;font-size:16px;color:#334155;font-family:Arial,Helvetica,sans-serif;line-height:1.6;">
                Ol&#225;, <strong>{{NAME}}</strong>! Confira o que h&#225; de novo esta semana:
              </p>

              <!-- Banner destaque -->
              <!--[if mso]>
              <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="#059669" style="border-radius:10px;padding:28px 20px;">
              <![endif]-->
              <!--[if !mso]><!-->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(135deg, #059669 0%, #047857 100%);border-radius:10px;">
                <tr>
                  <td align="center" style="padding:28px 20px;">
              <!--<![endif]-->
                    <h2 style="margin:0 0 6px 0;font-size:42px;color:#ffffff;font-family:Georgia,'Times New Roman',serif;font-weight:700;">${totalContent}</h2>
                    <p style="margin:0;font-size:16px;color:#d1fae5;font-family:Arial,Helvetica,sans-serif;letter-spacing:0.3px;">novos conte&#250;dos esta semana</p>
              <!--[if mso]>
              </td></tr></table>
              <![endif]-->
              <!--[if !mso]><!-->
                  </td>
                </tr>
              </table>
              <!--<![endif]-->

              <p style="margin:24px 0 16px 0;font-size:15px;color:#475569;line-height:1.7;font-family:Arial,Helvetica,sans-serif;">
                Confira as novidades adicionadas &#224; plataforma nos &#250;ltimos 7 dias:
              </p>

              ${contentCards}

              <!-- Dica da Semana -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;border:1px solid #fde68a;border-left:4px solid #f59e0b;border-radius:8px;background-color:#fffbeb;">
                <tr>
                  <td style="padding:18px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="28" valign="top" style="font-size:18px;padding-right:10px;">&#128161;</td>
                        <td>
                          <p style="margin:0 0 4px 0;color:#92400e;font-size:14px;font-weight:700;font-family:Arial,Helvetica,sans-serif;">Dica da Semana</p>
                          <p style="margin:0;color:#78350f;font-size:14px;font-family:Arial,Helvetica,sans-serif;line-height:1.6;">A Lei 14.133/2021 trouxe diversas inova&#231;&#245;es. Fique atento &#224;s atualiza&#231;&#245;es publicadas no site!</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Aviso alunos -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 0 0;border:1px solid #bfdbfe;border-left:4px solid #2563eb;border-radius:8px;background-color:#eff6ff;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0;color:#1e40af;font-size:14px;font-family:Arial,Helvetica,sans-serif;line-height:1.6;">
                      <strong>Para alunos matriculados:</strong> Todos esses materiais j&#225; est&#227;o dispon&#237;veis na sua &#225;rea restrita!
                    </p>
                  </td>
                </tr>
              </table>

              ${renderCTAButton(sendId, 'Acessar Plataforma', `${baseUrl}/area-restrita`)}

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 10px 0;border-top:1px solid #e5e7eb;">
                <tr>
                  <td style="padding:20px 0 0 0;">
                    <p style="font-size:14px;color:#64748b;font-family:Arial,Helvetica,sans-serif;line-height:1.6;margin:0 0 10px 0;">
                      <strong>N&#227;o &#233; aluno ainda?</strong> Conhe&#231;a nossos cursos e <a href="${trackUrl(sendId, `${baseUrl}/contato`)}" style="color:#2563eb;text-decoration:none;font-weight:600;">entre em contato</a> para participar das pr&#243;ximas turmas.
                    </p>
                    <p style="font-family:Arial,Helvetica,sans-serif;color:#334155;margin:0;font-size:15px;line-height:1.6;">Bons estudos!<br><strong style="color:#1e3a5f;">Equipe Prof. Daniel Barral</strong></p>
                  </td>
                </tr>
              </table>
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

export function renderMonthlyNewsletter(data: MonthlyNewsletterData): string {
  const { sendId, documentsByCategory, totalDocuments } = data;

  const categoryCount = Object.keys(documentsByCategory).length;

  // Mini dashboard stats
  const statsHtml = `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px 0;">
      <tr>
        <td width="50%" style="padding:0 6px 0 0;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e5e7eb;border-radius:8px;background-color:#f8fafc;">
            <tr>
              <td align="center" style="padding:20px 12px;">
                <p style="margin:0 0 4px 0;font-size:32px;color:#1e3a5f;font-family:Georgia,'Times New Roman',serif;font-weight:700;">${totalDocuments}</p>
                <p style="margin:0;font-size:12px;color:#64748b;font-family:Arial,Helvetica,sans-serif;text-transform:uppercase;letter-spacing:0.5px;">Documentos</p>
              </td>
            </tr>
          </table>
        </td>
        <td width="50%" style="padding:0 0 0 6px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e5e7eb;border-radius:8px;background-color:#f8fafc;">
            <tr>
              <td align="center" style="padding:20px 12px;">
                <p style="margin:0 0 4px 0;font-size:32px;color:#1e3a5f;font-family:Georgia,'Times New Roman',serif;font-weight:700;">${categoryCount}</p>
                <p style="margin:0;font-size:12px;color:#64748b;font-family:Arial,Helvetica,sans-serif;text-transform:uppercase;letter-spacing:0.5px;">Categorias</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;

  let categorySections = '';
  for (const [category, docs] of Object.entries(documentsByCategory)) {
    const categoryName = categoryNames[category] || category;
    const borderColor = categoryColors[category] || '#6b7280';
    const icon = categoryIcons[category] || '&#128195;';

    let docRows = '';
    docs.forEach((doc, index) => {
      docRows += `
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;border:1px solid #f1f5f9;border-radius:6px;background-color:#fafbfc;">
          <tr>
            <td style="padding:14px 16px;">
              <h3 style="margin:0 0 6px 0;font-size:15px;color:#1e293b;font-family:Arial,Helvetica,sans-serif;font-weight:600;">
                ${index + 1}. ${doc.title}
              </h3>
              ${doc.description ? `
                <p style="margin:0 0 8px 0;color:#64748b;font-size:13px;line-height:1.6;font-family:Arial,Helvetica,sans-serif;">
                  ${doc.description.substring(0, 200)}${doc.description.length > 200 ? '...' : ''}
                </p>
              ` : ''}
              <p style="margin:0;font-size:12px;color:#94a3b8;font-family:Arial,Helvetica,sans-serif;">
                Adicionado em: ${new Date(doc.uploadedAt).toLocaleDateString('pt-BR')}
              </p>
            </td>
          </tr>
        </table>`;
    });

    categorySections += `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
        <tr>
          <td>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px;border-bottom:2px solid ${borderColor};">
              <tr>
                <td style="padding:0 0 10px 0;">
                  <span style="font-size:18px;vertical-align:middle;">${icon}</span>
                  <span style="font-size:19px;color:#1e293b;font-family:Arial,Helvetica,sans-serif;font-weight:700;vertical-align:middle;padding-left:6px;">${categoryName}</span>
                  <span style="font-size:13px;color:#94a3b8;font-family:Arial,Helvetica,sans-serif;vertical-align:middle;padding-left:8px;">(${docs.length})</span>
                </td>
              </tr>
            </table>
            ${docRows}
          </td>
        </tr>
      </table>`;
  }

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
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#f1f5f9;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  ${renderPreheader(`${totalDocuments} novos documentos adicionados este m&#234;s. Confira o resumo mensal da plataforma do Prof. Daniel Barral.`)}
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9;">
    <tr>
      <td align="center" style="padding:20px 10px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <tr><td>${renderHeader()}</td></tr>
          <tr>
            <td style="padding:30px 30px 10px 30px;">
              <p style="margin:0 0 20px 0;font-size:16px;color:#334155;font-family:Arial,Helvetica,sans-serif;line-height:1.6;">
                Ol&#225;, <strong>{{NAME}}</strong>! Aqui est&#225; o resumo do m&#234;s:
              </p>

              <p style="margin:0 0 24px 0;font-size:15px;color:#475569;line-height:1.7;font-family:Arial,Helvetica,sans-serif;">
                Foram adicionados <strong style="color:#1e3a5f;">${totalDocuments} novos documentos</strong>
                na plataforma, todos relacionados a Licita&#231;&#245;es e Contratos P&#250;blicos.
              </p>

              <!-- Mini Dashboard -->
              ${statsHtml}

              <!-- Conteudos por categoria -->
              ${categorySections}

              <!-- Proximos Passos -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px 0;border:1px solid #c7d2fe;border-left:4px solid #6366f1;border-radius:8px;background-color:#eef2ff;">
                <tr>
                  <td style="padding:20px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="28" valign="top" style="font-size:18px;padding-right:10px;">&#128640;</td>
                        <td>
                          <p style="margin:0 0 6px 0;color:#3730a3;font-size:15px;font-weight:700;font-family:Arial,Helvetica,sans-serif;">Pr&#243;ximos Passos</p>
                          <p style="margin:0;color:#4338ca;font-size:14px;font-family:Arial,Helvetica,sans-serif;line-height:1.6;">
                            Fique atento &#224;s novidades da plataforma! Em breve teremos novos cursos e materiais exclusivos sobre Licita&#231;&#245;es e Contratos P&#250;blicos.
                            Acesse a <a href="${trackUrl(sendId, `${baseUrl}/area-restrita`)}" style="color:#4338ca;font-weight:600;">&#193;rea Restrita</a> para acompanhar tudo.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${renderCTAButton(sendId, 'Acessar &#193;rea Restrita', `${baseUrl}/area-restrita`)}
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
