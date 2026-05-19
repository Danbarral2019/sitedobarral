import { baseUrl, renderButton, wrapEmail } from './shell';

interface Props {
  recipientName: string;
}

export function renderPlanningAnnounceEmail({ recipientName }: Props): string {
  const greetingName = recipientName.trim() || 'aluno(a)';
  const planningUrl = `${baseUrl}/area-restrita/planejamento`;
  const content = `
    <h2 style="margin:0 0 16px 0;font-family:Georgia,'Times New Roman',serif;font-size:24px;color:#1e3a5f;font-weight:700;">
      Novo módulo: Planejamento da Contratação
    </h2>

    <p style="margin:0 0 16px 0;">Olá, ${escapeHtml(greetingName)}.</p>

    <p style="margin:0 0 16px 0;">
      Lançamos um novo módulo guiado para ajudar você a elaborar
      <strong>ETP (Estudo Técnico Preliminar)</strong> e
      <strong>TR (Termo de Referência)</strong> com base na Lei 14.133, sem partir do zero.
    </p>

    <h3 style="margin:24px 0 8px 0;font-family:Georgia,'Times New Roman',serif;font-size:18px;color:#1e3a5f;font-weight:700;">
      O que você encontra
    </h3>
    <ul style="margin:0 0 16px 0;padding-left:20px;">
      <li style="margin-bottom:8px;">
        <strong>Sessões por contratação:</strong> cada projeto é uma sessão sua, com versionamento próprio.
      </li>
      <li style="margin-bottom:8px;">
        <strong>Trilhas guiadas ETP → TR:</strong> passo a passo, com perguntas que conduzem à elaboração.
      </li>
      <li style="margin-bottom:8px;">
        <strong>Matriz de modalidade:</strong> pregão, concorrência, dispensa ou inexigibilidade, com justificativa pronta.
      </li>
      <li style="margin-bottom:8px;">
        <strong>Exportação em DOCX e PDF</strong> quando o documento estiver pronto.
      </li>
    </ul>

    ${renderButton('Abrir o módulo', planningUrl)}

    <p style="margin:24px 0 0 0;font-size:14px;color:#475569;">
      Qualquer dúvida ou sugestão, responda este email.
    </p>

    <p style="margin:16px 0 0 0;font-size:14px;color:#475569;">
      Bons estudos,<br>
      <strong>Prof. Daniel Barral</strong>
    </p>
  `;
  return wrapEmail({
    previewText: 'Novo módulo: Planejamento da Contratação — ETP e TR guiados pela Lei 14.133.',
    contentHtml: content,
  });
}

export const PLANNING_ANNOUNCE_SUBJECT = 'Novo módulo: Planejamento da Contratação (ETP + TR)';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
