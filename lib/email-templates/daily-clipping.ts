import type { Dispositivo } from '@/lib/clipping/dispositivo-extractor';

export interface ClippingAcordao {
  documentId: string;
  numeroAcordao: string;
  colegiado: string;
  relator: string | null;
  dataSessao: Date | null;
  ementa: string;
  linkPdf: string | null;
  linkInternal: string | null;
  dispositivos: Dispositivo[];
  extractMethod: 'ementa_regex' | 'rtf_parse' | 'pdf_parse' | 'cached' | 'failed';
  aiBullets?: string[];
}

export interface DailyClippingInput {
  sendId: string;
  recipientName: string;
  unsubscribeToken: string;
  referenceDate: Date;
  acordaos: ClippingAcordao[];
  /** Token assinado para "Ver no navegador" sem login. Se omitido, o link some. */
  viewToken?: string;
  /** YYYY-MM-DD do sentDate, usado pelos links de arquivo. Obrigatório se viewToken setado. */
  sentDateParam?: string;
  /** Banner temporário de novidade no topo. Controlado por env CLIPPING_NEW_FEATURE_BANNER. */
  showArchiveBanner?: boolean;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://profdanielbarral.com';

function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' }).format(d);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderAcordaoBlockHtml(a: ClippingAcordao): string {
  const dataStr = a.dataSessao ? fmtDate(a.dataSessao) : '';
  const cabecalho = `Acórdão ${escapeHtml(a.numeroAcordao)} — ${escapeHtml(a.colegiado || 'TCU')}`;
  const meta = [
    a.relator ? `Relator: ${escapeHtml(a.relator)}` : null,
    dataStr ? `Sessão: ${dataStr}` : null,
  ].filter(Boolean).join(' &middot; ');

  const ementaHtml = a.ementa
    ? `<p style="margin:14px 0 6px;font-size:13px;color:#1f2937;line-height:1.5;"><strong style="color:#0f172a;">Ementa (sumário oficial):</strong></p>
       <p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.55;font-style:italic;">${escapeHtml(a.ementa)}</p>`
    : '';

  let dispositivosHtml = '';
  if (a.dispositivos.length > 0) {
    const items = a.dispositivos.map((d) => `
      <li style="margin:0 0 8px;color:#1f2937;font-size:14px;line-height:1.5;">
        <strong style="color:#0f172a;">${escapeHtml(d.numero)}.</strong> ${escapeHtml(d.texto)}
      </li>
    `).join('');
    dispositivosHtml = `
      <p style="margin:14px 0 6px;font-size:13px;color:#1f2937;"><strong style="color:#0f172a;">Dispositivos:</strong></p>
      <ul style="padding-left:18px;margin:0 0 12px;">${items}</ul>
    `;
  } else if (a.extractMethod === 'failed' && (!a.aiBullets || a.aiBullets.length === 0)) {
    dispositivosHtml = `<p style="margin:8px 0;font-size:12px;color:#94a3b8;font-style:italic;">Dispositivos não pôde ser extraído automaticamente — consulte o inteiro teor.</p>`;
  }

  let bulletsHtml = '';
  if (a.aiBullets && a.aiBullets.length > 0) {
    const items = a.aiBullets
      .map((b) => `<li style="margin:0 0 6px;color:#334155;font-size:13.5px;line-height:1.55;">${escapeHtml(b)}</li>`)
      .join('');
    bulletsHtml = `
      <div style="margin:14px 0 12px;padding:12px 14px;background:#f8fafc;border-left:3px solid #6366f1;border-radius:4px;">
        <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#4f46e5;letter-spacing:0.04em;">CONTEXTO E TESE <span style="font-weight:400;color:#94a3b8;">(síntese editorial)</span></p>
        <ul style="padding-left:18px;margin:0;">${items}</ul>
      </div>
    `;
  }

  const linkPdfHtml = a.linkPdf
    ? `<a href="${escapeHtml(a.linkPdf)}" style="color:#1d4ed8;text-decoration:none;font-weight:600;font-size:13px;">Inteiro teor (PDF) →</a>`
    : '';
  const linkInternalHtml = a.linkInternal
    ? ` &middot; <a href="${escapeHtml(a.linkInternal)}" style="color:#64748b;text-decoration:none;font-size:13px;">Ver no site</a>`
    : '';

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;border-bottom:1px solid #e2e8f0;padding-bottom:18px;">
      <tr>
        <td>
          <h3 style="margin:0 0 4px;font-size:16px;color:#0f172a;font-weight:700;">${cabecalho}</h3>
          <p style="margin:0;font-size:12px;color:#64748b;">${meta}</p>
          ${ementaHtml}
          ${dispositivosHtml}
          ${bulletsHtml}
          <p style="margin:8px 0 0;">${linkPdfHtml}${linkInternalHtml}</p>
        </td>
      </tr>
    </table>
  `;
}

function renderAcordaoBlockText(a: ClippingAcordao): string {
  const dataStr = a.dataSessao ? fmtDate(a.dataSessao) : '';
  const lines: string[] = [];
  lines.push(`ACÓRDÃO ${a.numeroAcordao} — ${a.colegiado || 'TCU'}`);
  const meta = [a.relator ? `Relator: ${a.relator}` : null, dataStr ? `Sessão: ${dataStr}` : null].filter(Boolean).join(' · ');
  if (meta) lines.push(meta);
  if (a.ementa) {
    lines.push('');
    lines.push('Ementa (sumário oficial):');
    lines.push(a.ementa);
  }
  if (a.dispositivos.length > 0) {
    lines.push('');
    lines.push('Dispositivos:');
    for (const d of a.dispositivos) {
      lines.push(`${d.numero}. ${d.texto}`);
    }
  }
  if (a.aiBullets && a.aiBullets.length > 0) {
    lines.push('');
    lines.push('Contexto e tese (síntese editorial):');
    for (const b of a.aiBullets) {
      lines.push(`- ${b}`);
    }
  }
  if (a.linkPdf) lines.push(`Inteiro teor: ${a.linkPdf}`);
  return lines.join('\n');
}

export function renderDailyClipping(input: DailyClippingInput): RenderedEmail {
  const {
    sendId,
    recipientName,
    unsubscribeToken,
    referenceDate,
    acordaos,
    viewToken,
    sentDateParam,
    showArchiveBanner,
  } = input;
  const dataRef = fmtDate(referenceDate);
  const subject = `Clipping TCU — ${dataRef} (${acordaos.length} ${acordaos.length === 1 ? 'destaque' : 'destaques'})`;

  const unsubscribeUrl = `${baseUrl}/clipping/cancelar?token=${encodeURIComponent(unsubscribeToken)}`;
  const trackingUrl = `${baseUrl}/api/clipping/track?send=${encodeURIComponent(sendId)}`;
  const archiveUrl = `${baseUrl}/area-restrita/clipping`;
  const viewInBrowserUrl =
    viewToken && sentDateParam
      ? `${baseUrl}/clipping/ver/${sentDateParam}?token=${encodeURIComponent(viewToken)}`
      : null;
  const greeting = recipientName ? `Olá, ${escapeHtml(recipientName.split(' ')[0])}.` : 'Olá.';

  const blocksHtml = acordaos.map(renderAcordaoBlockHtml).join('\n');
  const blocksText = acordaos.map(renderAcordaoBlockText).join('\n\n────────────────────────────\n\n');

  const viewInBrowserHtml = viewInBrowserUrl
    ? `<p style="margin:0 0 12px;font-size:11px;color:#94a3b8;text-align:right;"><a href="${viewInBrowserUrl}" style="color:#94a3b8;text-decoration:underline;">Ver no navegador</a></p>`
    : '';

  const bannerHtml = showArchiveBanner
    ? `<div style="margin:0 0 18px;padding:12px 16px;background:#eff6ff;border-left:4px solid #2563eb;border-radius:6px;">
         <p style="margin:0;font-size:13px;color:#1e3a8a;line-height:1.5;">
           <strong>Novidade:</strong> agora você pode reler clippings anteriores em
           <a href="${archiveUrl}" style="color:#1d4ed8;font-weight:600;text-decoration:underline;">/area-restrita/clipping</a>,
           com busca por palavra-chave.
         </p>
       </div>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
  <tr>
    <td align="center">
      <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#0f172a 0%,#1e3a8a 100%);padding:28px 32px;color:#f8fafc;">
            <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">Prof. Daniel Barral</p>
            <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">Clipping TCU</h1>
            <p style="margin:6px 0 0;font-size:14px;color:#cbd5e1;">Decisões publicadas em ${dataRef} &middot; ${acordaos.length} ${acordaos.length === 1 ? 'destaque' : 'destaques'}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px;">
            ${viewInBrowserHtml}
            ${bannerHtml}
            <p style="margin:0 0 18px;font-size:14px;color:#334155;line-height:1.55;">
              ${greeting} Seguem as decisões do TCU sobre licitações e contratos publicadas em <strong>${dataRef}</strong>. Os trechos abaixo vêm direto do inteiro teor do acórdão.
            </p>
            ${blocksHtml}
            <p style="margin:24px 0 0;font-size:12px;color:#64748b;line-height:1.5;">
              Você recebe este clipping porque é aluno ativo. O cancelamento abaixo afeta apenas o clipping diário — não a newsletter mensal nem comunicações da plataforma.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:18px 32px;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:12px;color:#64748b;text-align:center;">
              <a href="${archiveUrl}" style="color:#475569;text-decoration:underline;">Ver clippings anteriores</a>
              &nbsp;&middot;&nbsp;
              <a href="${unsubscribeUrl}" style="color:#475569;text-decoration:underline;">Cancelar clipping diário</a>
              &nbsp;&middot;&nbsp;
              <a href="${baseUrl}" style="color:#475569;text-decoration:underline;">Acessar o site</a>
            </p>
            <p style="margin:8px 0 0;font-size:11px;color:#94a3b8;text-align:center;">Prof. Daniel Barral &middot; profdanielbarral.com</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
<img src="${trackingUrl}" width="1" height="1" alt="" style="display:block;border:0;outline:none;" />
</body>
</html>`;

  const text = [
    `Clipping TCU — ${dataRef}`,
    `${acordaos.length} ${acordaos.length === 1 ? 'destaque' : 'destaques'}`,
    viewInBrowserUrl ? `Ver no navegador: ${viewInBrowserUrl}` : null,
    showArchiveBanner ? 'NOVIDADE: arquivo de clippings em ' + archiveUrl : null,
    '',
    `${recipientName ? `Olá, ${recipientName.split(' ')[0]}.` : 'Olá.'} Seguem as decisões do TCU sobre licitações e contratos publicadas em ${dataRef}. Os trechos abaixo vêm direto do inteiro teor do acórdão.`,
    '',
    '────────────────────────────',
    '',
    blocksText,
    '',
    '────────────────────────────',
    '',
    `Ver clippings anteriores: ${archiveUrl}`,
    `Cancelar clipping: ${unsubscribeUrl}`,
    `Site: ${baseUrl}`,
    '',
    'Prof. Daniel Barral · profdanielbarral.com',
  ].filter((l): l is string => l !== null).join('\n');

  return { subject, html, text };
}
