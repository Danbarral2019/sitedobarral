import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminApi } from '@/lib/api/handler';
import { NotFoundError, ValidationError } from '@/lib/errors/api-error';
import { sendEmail } from '@/lib/email';
import { getLeiArticles } from '@/lib/lei-articles';
import { apiLogger } from "@/lib/logger";

/**
 * POST /api/admin/legislative-acts/notify
 * Envia notificações por email sobre novos atos normativos
 */
export const POST = withAdminApi(async (request, ctx) => {
  const body = await request.json();
  const { actIds, testMode } = body;

  if (!actIds || !Array.isArray(actIds) || actIds.length === 0) {
    throw new ValidationError('IDs dos atos são obrigatórios');
  }

  // Buscar atos selecionados
  const acts = await prisma.legislativeAct.findMany({
    where: {
      id: { in: actIds }
    },
    orderBy: { publishDate: 'desc' }
  });

  if (acts.length === 0) {
    throw new NotFoundError('Ato');
  }

  // Buscar todos os usuários com emailVerified=true (alunos ativos)
  const users = await prisma.user.findMany({
    where: {
      emailVerified: true,
      role: 'student'
    },
    select: {
      email: true,
      name: true
    }
  });

  const TYPE_LABELS: Record<string, string> = {
    'decreto': 'Decreto',
    'portaria': 'Portaria',
    'in': 'IN SEGES',
    'ordem-servico': 'Ordem de Serviço',
    'lei': 'Lei',
    'medida-provisoria': 'Medida Provisória'
  };

  // Gerar HTML do email
  const generateEmailHTML = (userName: string) => {
    const actsHTML = acts.map(act => {
      const leiArticles = getLeiArticles(act);

      return `
        <div style="background: #f9fafb; border: 2px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <span style="background: #dbeafe; color: #1e40af; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">
              ${TYPE_LABELS[act.type] || act.type}
            </span>
            <span style="font-family: monospace; font-weight: bold; color: #111827;">
              ${act.fullNumber}
            </span>
          </div>
          <h3 style="margin: 8px 0; font-size: 18px; color: #111827; font-weight: bold;">
            ${act.title}
          </h3>
          <p style="margin: 8px 0; color: #374151; line-height: 1.6;">
            ${act.ementa}
          </p>
          ${act.summary ? `
            <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px; margin: 12px 0;">
              <strong style="color: #1e40af;">Resumo:</strong>
              <p style="margin: 4px 0 0 0; color: #1f2937;">${act.summary}</p>
            </div>
          ` : ''}
          <div style="margin-top: 12px; font-size: 14px; color: #6b7280;">
            <strong>Órgão:</strong> ${act.issuer} |
            <strong>Publicação:</strong> ${new Date(act.publishDate).toLocaleDateString('pt-BR')}
            ${leiArticles.length > 0 ? ` | <strong>Artigos:</strong> ${leiArticles.join(', ')}` : ''}
          </div>
          ${act.officialUrl ? `
            <div style="margin-top: 12px;">
              <a href="${act.officialUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-weight: bold;">
                Ver Texto Oficial
              </a>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: #ffffff;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); padding: 32px; border-radius: 12px; margin-bottom: 24px; text-align: center;">
            <div style="width: 64px; height: 64px; background: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
              <span style="font-size: 32px;">⚖️</span>
            </div>
            <h1 style="margin: 0 0 8px 0; color: white; font-size: 28px; font-weight: bold;">
              Novos Atos Normativos
            </h1>
            <p style="margin: 0; color: #dbeafe; font-size: 16px;">
              Lei 14.133/2021 - Licitações e Contratos
            </p>
          </div>

          <!-- Saudação -->
          <div style="margin-bottom: 24px;">
            <p style="font-size: 16px; color: #111827; margin: 0 0 8px 0;">
              Olá, <strong>${userName}</strong>!
            </p>
            <p style="font-size: 14px; color: #6b7280; margin: 0; line-height: 1.6;">
              ${acts.length === 1
                ? 'Foi publicado um novo ato normativo relacionado aos seus estudos:'
                : `Foram publicados ${acts.length} novos atos normativos relacionados aos seus estudos:`
              }
            </p>
          </div>

          <!-- Lista de Atos -->
          ${actsHTML}

          <!-- Footer -->
          <div style="margin-top: 32px; padding-top: 24px; border-top: 2px solid #e5e7eb; text-align: center;">
            <p style="margin: 0 0 12px 0; font-size: 14px; color: #6b7280;">
              Acesse a área de legislação para ver todos os atos normativos:
            </p>
            <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/legislacao"
               style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-bottom: 16px;">
              Ver Todos os Atos Normativos
            </a>
            <p style="margin: 16px 0 0 0; font-size: 12px; color: #9ca3af;">
              Você está recebendo este email porque é aluno cadastrado.<br>
              Prof. Daniel Barral - Especialista em Licitações e Contratos
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  // Contadores
  let sent = 0;
  let failed = 0;

  // Modo de teste: envia apenas para o admin
  if (testMode) {
    const testEmail = ctx.user.email || '';
    // AuthPayload não inclui `name`; usar fallback 'Admin'.
    const html = generateEmailHTML('Admin');

    const success = await sendEmail({
      to: testEmail,
      subject: `[TESTE] ${acts.length === 1 ? 'Novo Ato Normativo' : `${acts.length} Novos Atos Normativos`} - Lei 14.133/2021`,
      html
    });

    return NextResponse.json({
      success: true,
      testMode: true,
      sent: success ? 1 : 0,
      failed: success ? 0 : 1,
      recipients: [testEmail]
    });
  }

  // Modo produção: enviar para todos os alunos
  for (const user of users) {
    try {
      const html = generateEmailHTML(user.name || 'Aluno');

      const success = await sendEmail({
        to: user.email,
        subject: acts.length === 1
          ? 'Novo Ato Normativo - Lei 14.133/2021'
          : `${acts.length} Novos Atos Normativos - Lei 14.133/2021`,
        html
      });

      if (success) {
        sent++;
      } else {
        failed++;
      }

      // Pequeno delay para não sobrecarregar (100ms entre emails)
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      apiLogger.error({ err: error }, `Erro ao enviar email para ${user.email}:`);
      failed++;
    }
  }

  // Atualizar campo notifiedAt nos atos
  await prisma.legislativeAct.updateMany({
    where: {
      id: { in: actIds }
    },
    data: {
      notifiedAt: new Date()
    }
  });

  return NextResponse.json({
    success: true,
    sent,
    failed,
    total: users.length,
    acts: acts.length
  });
});
