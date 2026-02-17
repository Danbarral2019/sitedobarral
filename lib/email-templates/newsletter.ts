/**
 * Newsletter Email Templates (HTML reutilizavel)
 * Design: header com gradiente azul, cards por categoria, CTA, footer profissional
 * Compativel Gmail/Outlook (inline styles, tables)
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
  'apostila': 'Apostilas e Material Didatico',
  'acordao': 'Acordaos',
  'parecer': 'Pareceres Juridicos',
  'edital': 'Editais',
  'artigo': 'Artigos e Doutrinas',
  'orientacao-normativa': 'Orientacoes Normativas',
  'decor': 'DECOR',
  'enunciado': 'Enunciados',
  'outro': 'Outros Documentos',
};

function renderHeader(): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(135deg, #003366 0%, #0066cc 100%);">
      <tr>
        <td align="center" style="padding:30px 20px;">
          <h1 style="margin:0;font-size:28px;color:#ffffff;font-family:Arial,sans-serif;">Prof. Daniel Barral</h1>
          <p style="margin:10px 0 0 0;font-size:16px;color:#ffffff;opacity:0.9;font-family:Arial,sans-serif;">Licitacoes e Contratos Publicos</p>
        </td>
      </tr>
    </table>`;
}

function renderFooter(sendId: string): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8f9fa;border-top:1px solid #e0e0e0;">
      <tr>
        <td align="center" style="padding:20px;">
          <p style="margin:0 0 10px 0;font-size:14px;color:#666666;font-family:Arial,sans-serif;">
            Prof. Daniel Barral - Licitacoes e Contratos Publicos
          </p>
          <p style="margin:0 0 10px 0;font-size:12px;color:#999999;font-family:Arial,sans-serif;">
            <a href="${trackUrl(sendId, baseUrl)}" style="color:#0066cc;text-decoration:none;">www.profdanielbarral.com.br</a>
          </p>
          <p style="margin:0;font-size:11px;color:#999999;font-family:Arial,sans-serif;">
            Voce esta recebendo este email porque se inscreveu na nossa newsletter.
            <br>
            <a href="${trackUrl(sendId, `${baseUrl}/newsletter/unsubscribe`)}" style="color:#999999;text-decoration:underline;">Cancelar inscricao</a>
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
              <td align="center" style="background-color:#0066cc;border-radius:5px;">
                <a href="${trackUrl(sendId, url)}" style="display:inline-block;padding:15px 40px;color:#ffffff;text-decoration:none;font-size:16px;font-weight:bold;font-family:Arial,sans-serif;">${text}</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

export function renderWeeklyNewsletter(data: WeeklyNewsletterData): string {
  const { sendId, coursesWithNewContent, totalNewDocuments, newVideos } = data;
  const totalContent = totalNewDocuments + newVideos;

  let contentCards = '';
  for (const { courseTitle, documentCount, documents } of coursesWithNewContent) {
    const docList = documents.slice(0, 3).map(doc =>
      `<tr><td style="padding:4px 0 4px 15px;color:#374151;font-size:14px;font-family:Arial,sans-serif;">- ${doc.title}</td></tr>`
    ).join('');
    const moreCount = documentCount - 3;
    const moreRow = moreCount > 0
      ? `<tr><td style="padding:4px 0 4px 15px;color:#6b7280;font-size:14px;font-style:italic;font-family:Arial,sans-serif;">E mais ${moreCount} ${moreCount === 1 ? 'material' : 'materiais'}...</td></tr>`
      : '';

    contentCards += `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:15px 0;background-color:#ffffff;border-left:4px solid #0066cc;border-radius:4px;">
        <tr>
          <td style="padding:20px;">
            <h3 style="margin:0 0 10px 0;color:#1f2937;font-size:16px;font-family:Arial,sans-serif;">${courseTitle}</h3>
            <p style="color:#6b7280;margin:0 0 10px 0;font-size:14px;font-family:Arial,sans-serif;">${documentCount} ${documentCount === 1 ? 'novo material' : 'novos materiais'}</p>
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
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:15px 0;background-color:#ffffff;border-left:4px solid #dc2626;border-radius:4px;">
        <tr>
          <td style="padding:20px;">
            <h3 style="margin:0 0 10px 0;color:#1f2937;font-size:16px;font-family:Arial,sans-serif;">Videos</h3>
            <p style="color:#6b7280;margin:0;font-size:14px;font-family:Arial,sans-serif;">${newVideos} ${newVideos === 1 ? 'novo video' : 'novos videos'} adicionado${newVideos > 1 ? 's' : ''}</p>
          </td>
        </tr>
      </table>`;
  }

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Novidades da Semana - Prof. Daniel Barral</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background-color:#f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f4;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;">
          <tr><td>${renderHeader()}</td></tr>
          <tr>
            <td style="padding:30px 20px;">
              <p style="margin:0 0 20px 0;font-size:16px;color:#333333;font-family:Arial,sans-serif;">
                Ola, <strong>{{NAME}}</strong>!
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(135deg, #10b981 0%, #059669 100%);border-radius:8px;">
                <tr>
                  <td align="center" style="padding:20px;">
                    <h2 style="margin:0 0 10px 0;font-size:32px;color:#ffffff;font-family:Arial,sans-serif;">${totalContent}</h2>
                    <p style="margin:0;font-size:18px;color:#ffffff;font-family:Arial,sans-serif;">novos conteudos esta semana!</p>
                  </td>
                </tr>
              </table>

              <p style="margin:20px 0;font-size:16px;color:#333333;line-height:1.6;font-family:Arial,sans-serif;">
                Confira as novidades que foram adicionadas a plataforma nos ultimos 7 dias:
              </p>

              ${contentCards}

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#dbeafe;border-left:4px solid #0066cc;border-radius:8px;margin:20px 0;">
                <tr>
                  <td style="padding:15px;">
                    <p style="margin:0;color:#1e40af;font-size:14px;font-family:Arial,sans-serif;">
                      <strong>Para alunos matriculados:</strong> Todos esses materiais ja estao disponiveis na sua area restrita!
                    </p>
                  </td>
                </tr>
              </table>

              ${renderCTAButton(sendId, 'Acessar Plataforma', `${baseUrl}/area-restrita`)}

              <p style="font-size:14px;color:#666666;font-family:Arial,sans-serif;">
                <strong>Nao e aluno ainda?</strong> Conheca nossos cursos e <a href="${trackUrl(sendId, `${baseUrl}/contato`)}" style="color:#0066cc;">entre em contato</a> para participar das proximas turmas.
              </p>

              <p style="font-family:Arial,sans-serif;color:#333333;">Bons estudos!<br><strong>Equipe Prof. Daniel Barral</strong></p>
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

  let categorySections = '';
  for (const [category, docs] of Object.entries(documentsByCategory)) {
    const categoryName = categoryNames[category] || category;

    let docRows = '';
    docs.forEach((doc, index) => {
      docRows += `
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:15px;background-color:#f8f9fa;border-left:4px solid #0066cc;border-radius:4px;">
          <tr>
            <td style="padding:15px;">
              <h3 style="margin:0 0 8px 0;font-size:16px;color:#222222;font-family:Arial,sans-serif;">
                ${index + 1}. ${doc.title}
              </h3>
              ${doc.description ? `
                <p style="margin:0 0 10px 0;color:#555555;font-size:14px;line-height:1.5;font-family:Arial,sans-serif;">
                  ${doc.description.substring(0, 200)}${doc.description.length > 200 ? '...' : ''}
                </p>
              ` : ''}
              <p style="margin:0;font-size:12px;color:#777777;font-family:Arial,sans-serif;">
                Adicionado em: ${new Date(doc.uploadedAt).toLocaleDateString('pt-BR')}
              </p>
            </td>
          </tr>
        </table>`;
    });

    categorySections += `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:30px;">
        <tr>
          <td>
            <h2 style="color:#003366;font-size:20px;border-bottom:2px solid #0066cc;padding-bottom:10px;margin-bottom:15px;font-family:Arial,sans-serif;">
              ${categoryName} (${docs.length})
            </h2>
            ${docRows}
          </td>
        </tr>
      </table>`;
  }

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Newsletter Mensal - Prof. Daniel Barral</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background-color:#f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f4;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;">
          <tr><td>${renderHeader()}</td></tr>
          <tr>
            <td style="padding:30px 20px;">
              <p style="margin:0 0 20px 0;font-size:16px;color:#333333;font-family:Arial,sans-serif;">
                Ola, <strong>{{NAME}}</strong>!
              </p>

              <p style="margin:0 0 20px 0;font-size:16px;color:#333333;line-height:1.6;font-family:Arial,sans-serif;">
                Confira as novidades deste mes! Foram adicionados <strong>${totalDocuments} novos documentos</strong>
                na plataforma, todos relacionados a Licitacoes e Contratos Publicos.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fff3cd;border:1px solid #ffc107;border-radius:8px;margin-bottom:30px;">
                <tr>
                  <td style="padding:15px;">
                    <p style="margin:0;color:#856404;font-size:14px;font-family:Arial,sans-serif;">
                      <strong>Dica:</strong> Acesse a <a href="${trackUrl(sendId, `${baseUrl}/area-restrita`)}" style="color:#0066cc;text-decoration:none;">Area Restrita</a>
                      para visualizar os documentos completos e fazer download.
                    </p>
                  </td>
                </tr>
              </table>

              ${categorySections}

              ${renderCTAButton(sendId, 'Acessar Area Restrita', `${baseUrl}/area-restrita`)}
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
