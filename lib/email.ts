/**
 * Utilitário para envio de emails
 * Em desenvolvimento: simula envio (console.log)
 * Em produção: usa Resend
 */

import { Resend } from 'resend';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  success: boolean;
  error?: string;
  retryable?: boolean;
}

export async function sendEmail(options: EmailOptions): Promise<SendEmailResult> {
  const { to, subject, html, text } = options;

  // Em desenvolvimento, apenas loga no console
  if (process.env.NODE_ENV === 'development' && !process.env.RESEND_API_KEY) {
    console.log('\n📧 ===== EMAIL SIMULADO (DEV) =====');
    console.log(`Para: ${to}`);
    console.log(`Assunto: ${subject}`);
    console.log(`Conteúdo HTML:\n${html.substring(0, 200)}...`);
    if (text) console.log(`Conteúdo Texto:\n${text.substring(0, 200)}...`);
    console.log('===== FIM DO EMAIL =====\n');
    return { success: true };
  }

  // Em produção ou desenvolvimento com RESEND_API_KEY configurado
  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.EMAIL_FROM || 'noreply@profdanielbarral.com';
    const maxRetries = 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await resend.emails.send({
          from: fromEmail,
          to,
          subject,
          html,
          text: text || undefined,
        });

        if (result.error) {
          throw new Error(result.error.message);
        }

        console.log('Email enviado com sucesso:', { to, subject, id: result.data?.id });
        return { success: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isRetryable = errorMessage.includes('rate') ||
          errorMessage.includes('timeout') ||
          errorMessage.includes('5') || // 5xx errors
          errorMessage.includes('ECONNRESET');

        if (isRetryable && attempt < maxRetries) {
          console.warn(`Email retry ${attempt + 1}/${maxRetries} para ${to}:`, errorMessage);
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); // Backoff
          continue;
        }

        console.error('Erro ao enviar email:', { to, subject, error: errorMessage, attempt });
        return { success: false, error: errorMessage, retryable: isRetryable };
      }
    }
  }

  // Fallback se não tiver API key configurada
  console.warn('RESEND_API_KEY não configurado - Email não enviado');
  return { success: false, error: 'RESEND_API_KEY não configurado', retryable: false };
}

/**
 * Envia email de verificação de conta
 */
export async function sendVerificationEmail(
  email: string,
  name: string,
  token: string
): Promise<boolean> {
  const verificationUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/verificar-email?token=${token}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #2563eb 0%, #9333ea 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #9333ea 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Bem-vindo(a), ${name}!</h1>
          </div>
          <div class="content">
            <p>Olá ${name},</p>
            <p>Obrigado por se cadastrar no site do <strong>Prof. Daniel Barral</strong>!</p>
            <p>Para ativar sua conta e ter acesso aos materiais dos cursos, por favor confirme seu endereço de email clicando no botão abaixo:</p>

            <div style="text-align: center;">
              <a href="${verificationUrl}" class="button">Verificar Meu Email</a>
            </div>

            <div class="warning">
              <strong>⏰ Link válido por 24 horas</strong><br>
              Este link de verificação expira em 24 horas por questões de segurança.
            </div>

            <p>Se o botão não funcionar, copie e cole este link no seu navegador:</p>
            <p style="word-break: break-all; color: #2563eb;">${verificationUrl}</p>

            <p>Se você não se cadastrou no nosso site, por favor ignore este email.</p>

            <p>Atenciosamente,<br><strong>Equipe Prof. Daniel Barral</strong></p>
          </div>
          <div class="footer">
            <p>Este é um email automático, por favor não responda.</p>
            <p>© ${new Date().getFullYear()} Prof. Daniel Barral - Todos os direitos reservados</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
Bem-vindo(a), ${name}!

Obrigado por se cadastrar no site do Prof. Daniel Barral!

Para ativar sua conta, acesse o link abaixo:
${verificationUrl}

Este link é válido por 24 horas.

Se você não se cadastrou no nosso site, por favor ignore este email.

Atenciosamente,
Equipe Prof. Daniel Barral
  `;

  const result = await sendEmail({
    to: email,
    subject: 'Confirme seu email - Prof. Daniel Barral',
    html,
    text,
  });
  return result.success;
}

/**
 * Envia email de recuperação de senha
 */
export async function sendPasswordResetEmail(
  email: string,
  name: string,
  token: string
): Promise<boolean> {
  const resetUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/redefinir-senha?token=${token}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #2563eb 0%, #9333ea 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #9333ea 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .warning { background: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Recuperação de Senha</h1>
          </div>
          <div class="content">
            <p>Olá ${name},</p>
            <p>Recebemos uma solicitação para redefinir a senha da sua conta no site do <strong>Prof. Daniel Barral</strong>.</p>
            <p>Para criar uma nova senha, clique no botão abaixo:</p>

            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">Redefinir Minha Senha</a>
            </div>

            <div class="warning">
              <strong>⏰ Link válido por 1 hora</strong><br>
              Este link de recuperação expira em 1 hora por questões de segurança.
            </div>

            <p>Se o botão não funcionar, copie e cole este link no seu navegador:</p>
            <p style="word-break: break-all; color: #2563eb;">${resetUrl}</p>

            <p><strong>Se você não solicitou esta recuperação de senha, ignore este email.</strong> Sua senha permanecerá inalterada.</p>

            <p>Atenciosamente,<br><strong>Equipe Prof. Daniel Barral</strong></p>
          </div>
          <div class="footer">
            <p>Este é um email automático, por favor não responda.</p>
            <p>© ${new Date().getFullYear()} Prof. Daniel Barral - Todos os direitos reservados</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
Recuperação de Senha

Olá ${name},

Recebemos uma solicitação para redefinir a senha da sua conta no site do Prof. Daniel Barral.

Para criar uma nova senha, acesse o link abaixo:
${resetUrl}

Este link é válido por 1 hora.

Se você não solicitou esta recuperação de senha, ignore este email. Sua senha permanecerá inalterada.

Atenciosamente,
Equipe Prof. Daniel Barral
  `;

  return (await sendEmail({
    to: email,
    subject: 'Recuperação de Senha - Prof. Daniel Barral',
    html,
    text,
  })).success;
}

/**
 * Envia email de boas-vindas após cadastro
 */
export async function sendWelcomeEmail(
  to: string,
  name: string
): Promise<boolean> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://profbarral.com.br';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #2563eb 0%, #9333ea 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #9333ea 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .guide { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #e5e7eb; }
          .guide-item { margin: 12px 0; display: flex; align-items: flex-start; }
          .guide-number { display: inline-block; width: 28px; height: 28px; background: linear-gradient(135deg, #2563eb, #9333ea); color: white; border-radius: 50%; text-align: center; line-height: 28px; font-weight: bold; font-size: 14px; margin-right: 12px; flex-shrink: 0; }
          .guide-text { flex: 1; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Bem-vindo(a), ${name}!</h1>
            <p style="margin: 8px 0 0; opacity: 0.9;">Seu cadastro foi realizado com sucesso</p>
          </div>
          <div class="content">
            <p>Olá ${name},</p>
            <p>É um prazer ter você conosco! Abaixo segue um guia rápido para você aproveitar ao máximo a plataforma:</p>

            <div class="guide">
              <h3 style="margin-top: 0; color: #1f2937;">Guia Rápido</h3>
              <div class="guide-item">
                <span class="guide-number">1</span>
                <div class="guide-text">
                  <strong>Acesse seus cursos</strong><br>
                  <span style="font-size: 14px; color: #6b7280;">Na área restrita você encontra todos os materiais dos cursos em que está matriculado.</span>
                </div>
              </div>
              <div class="guide-item">
                <span class="guide-number">2</span>
                <div class="guide-text">
                  <strong>Use o Assistente de IA</strong><br>
                  <span style="font-size: 14px; color: #6b7280;">Tire dúvidas sobre licitações e contratos diretamente com nosso assistente inteligente.</span>
                </div>
              </div>
              <div class="guide-item">
                <span class="guide-number">3</span>
                <div class="guide-text">
                  <strong>Pesquise documentos</strong><br>
                  <span style="font-size: 14px; color: #6b7280;">Acesse acórdãos do TCU, pareceres, orientações normativas e muito mais.</span>
                </div>
              </div>
              <div class="guide-item">
                <span class="guide-number">4</span>
                <div class="guide-text">
                  <strong>Consulte a Lei 14.133 Comentada</strong><br>
                  <span style="font-size: 14px; color: #6b7280;">Navegue pelos 195 artigos da Nova Lei de Licitações com comentários e documentos relacionados.</span>
                </div>
              </div>
            </div>

            <p>Tem alguma dúvida? Acesse nossa <a href="${baseUrl}/faq" style="color: #2563eb; font-weight: bold;">página de perguntas frequentes</a> ou entre em contato pelo <a href="${baseUrl}/contato" style="color: #2563eb; font-weight: bold;">formulário de contato</a>.</p>

            <div style="text-align: center;">
              <a href="${baseUrl}/area-restrita" class="button">Acessar a Plataforma</a>
            </div>

            <p>Bons estudos!<br><strong>Prof. Daniel Barral</strong><br><span style="font-size: 14px; color: #6b7280;">Especialista em Direito Administrativo, Licitações e Contratos</span></p>
          </div>
          <div class="footer">
            <p>Este é um email automático, por favor não responda.</p>
            <p>&copy; ${new Date().getFullYear()} Prof. Daniel Barral - Todos os direitos reservados</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
Bem-vindo(a), ${name}!

Seu cadastro foi realizado com sucesso no site do Prof. Daniel Barral.

GUIA RAPIDO:

1. Acesse seus cursos - Na área restrita você encontra todos os materiais.
2. Use o Assistente de IA - Tire dúvidas sobre licitações e contratos.
3. Pesquise documentos - Acórdãos do TCU, pareceres, orientações normativas e mais.
4. Consulte a Lei 14.133 Comentada - 195 artigos com comentários e documentos.

Dúvidas? Acesse: ${baseUrl}/faq
Contato: ${baseUrl}/contato

Bons estudos!
Prof. Daniel Barral
  `;

  const result = await sendEmail({
    to,
    subject: 'Bem-vindo(a) ao site do Prof. Daniel Barral!',
    html,
    text,
  });
  return result.success;
}

/**
 * Envia email de notificação de expiração de acesso (3 meses antes)
 */
export async function sendExpirationNotification(
  email: string,
  name: string,
  courseId: string,
  daysRemaining: number,
  expiresAt: Date
): Promise<boolean> {
  const upgradeUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/upgrade/${courseId}`;
  const expirationDate = new Date(expiresAt).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  // Formatação da mensagem de dias restantes
  let remainingMessage = '';
  if (daysRemaining <= 7) {
    remainingMessage = `apenas ${daysRemaining} ${daysRemaining === 1 ? 'dia' : 'dias'}`;
  } else if (daysRemaining <= 30) {
    remainingMessage = `${daysRemaining} dias`;
  } else {
    const months = Math.floor(daysRemaining / 30);
    remainingMessage = `aproximadamente ${months} ${months === 1 ? 'mês' : 'meses'}`;
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #f59e0b 0%, #dc2626 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #2563eb 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 8px; }
          .highlight { background: linear-gradient(135deg, #7c3aed 0%, #2563eb 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; }
          .benefits { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #e5e7eb; }
          .benefit-item { display: flex; align-items: start; margin: 10px 0; }
          .check { color: #10b981; margin-right: 10px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⏰ Seu Acesso Está Expirando</h1>
          </div>
          <div class="content">
            <p>Olá ${name},</p>

            <div class="warning">
              <strong>⚠️ Atenção:</strong> Seu acesso ao curso está próximo do vencimento!<br><br>
              <strong>Tempo restante:</strong> ${remainingMessage}<br>
              <strong>Data de expiração:</strong> ${expirationDate}
            </div>

            <p>Não perca o acesso aos valiosos materiais do curso. Temos uma oferta especial para você!</p>

            <div class="highlight">
              <h2 style="margin: 0 0 10px 0;">✨ Acesso Vitalício Disponível</h2>
              <p style="margin: 0; font-size: 16px;">Garanta acesso ilimitado por toda a vida!</p>
            </div>

            <div class="benefits">
              <h3 style="margin-top: 0;">Com o Acesso Vitalício você terá:</h3>
              <div class="benefit-item">
                <span class="check">✓</span>
                <span><strong>Acesso para sempre</strong> - Sem preocupações com renovação</span>
              </div>
              <div class="benefit-item">
                <span class="check">✓</span>
                <span><strong>Todas as atualizações futuras</strong> - Material sempre atualizado</span>
              </div>
              <div class="benefit-item">
                <span class="check">✓</span>
                <span><strong>Download ilimitado</strong> - Baixe todos os materiais</span>
              </div>
              <div class="benefit-item">
                <span class="check">✓</span>
                <span><strong>Investimento único</strong> - Pague uma vez, use sempre</span>
              </div>
            </div>

            <div style="text-align: center;">
              <a href="${upgradeUrl}" class="button">👑 Fazer Upgrade Agora</a>
            </div>

            <p style="text-align: center; color: #666; font-size: 14px; margin-top: 20px;">
              Ou acesse: <a href="${upgradeUrl}" style="color: #2563eb;">${upgradeUrl}</a>
            </p>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

            <p style="font-size: 14px; color: #666;">
              <strong>Dúvidas?</strong> Entre em contato conosco através do site ou responda este email.
            </p>

            <p>Atenciosamente,<br><strong>Equipe Prof. Daniel Barral</strong></p>
          </div>
          <div class="footer">
            <p>Este é um email automático enviado para lembrá-lo sobre a expiração do seu acesso.</p>
            <p>© ${new Date().getFullYear()} Prof. Daniel Barral - Todos os direitos reservados</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
⏰ Seu Acesso Está Expirando

Olá ${name},

ATENÇÃO: Seu acesso ao curso está próximo do vencimento!

Tempo restante: ${remainingMessage}
Data de expiração: ${expirationDate}

Não perca o acesso aos valiosos materiais do curso. Temos uma oferta especial para você!

✨ ACESSO VITALÍCIO DISPONÍVEL
Garanta acesso ilimitado por toda a vida!

Com o Acesso Vitalício você terá:
✓ Acesso para sempre - Sem preocupações com renovação
✓ Todas as atualizações futuras - Material sempre atualizado
✓ Download ilimitado - Baixe todos os materiais
✓ Investimento único - Pague uma vez, use sempre

Faça upgrade agora em: ${upgradeUrl}

Dúvidas? Entre em contato conosco através do site ou responda este email.

Atenciosamente,
Equipe Prof. Daniel Barral
  `;

  return (await sendEmail({
    to: email,
    subject: `⏰ Seu acesso expira em ${remainingMessage} - Prof. Daniel Barral`,
    html,
    text,
  })).success;
}

/**
 * Envia notificação ao admin sobre nova mensagem de contato
 */
export async function sendContactNotification(
  contactData: {
    name: string;
    email: string;
    phone?: string | null;
    courseInterest?: string | null;
    message: string;
  },
  contactId: string
): Promise<boolean> {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@profdanielbarral.com';
  const isTestimonial = contactData.courseInterest === 'depoimento';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, ${isTestimonial ? '#f59e0b 0%, #ea580c' : '#2563eb 0%, #1d4ed8'} 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .field { background: white; padding: 15px; margin: 15px 0; border-radius: 8px; border-left: 4px solid #2563eb; }
          .field-label { font-weight: bold; color: #1f2937; margin-bottom: 5px; }
          .field-value { color: #4b5563; }
          .message-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border: 2px solid #e5e7eb; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .badge { display: inline-block; background: ${isTestimonial ? '#f59e0b' : '#2563eb'}; color: white; padding: 5px 15px; border-radius: 20px; font-size: 12px; font-weight: bold; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${isTestimonial ? '⭐' : '📧'} ${isTestimonial ? 'Novo Depoimento Recebido' : 'Nova Mensagem de Contato'}</h1>
          </div>
          <div class="content">
            ${isTestimonial ? '<div class="badge">AGUARDANDO MODERAÇÃO</div>' : ''}

            <div class="field">
              <div class="field-label">Nome:</div>
              <div class="field-value">${contactData.name}</div>
            </div>

            <div class="field">
              <div class="field-label">E-mail:</div>
              <div class="field-value"><a href="mailto:${contactData.email}">${contactData.email}</a></div>
            </div>

            ${contactData.phone ? `
              <div class="field">
                <div class="field-label">Telefone:</div>
                <div class="field-value">${contactData.phone}</div>
              </div>
            ` : ''}

            ${contactData.courseInterest && contactData.courseInterest !== 'depoimento' ? `
              <div class="field">
                <div class="field-label">Curso de Interesse:</div>
                <div class="field-value">${contactData.courseInterest}</div>
              </div>
            ` : ''}

            <div class="message-box">
              <div class="field-label">${isTestimonial ? 'Depoimento:' : 'Mensagem:'}</div>
              <div class="field-value" style="white-space: pre-wrap;">${contactData.message}</div>
            </div>

            <div style="background: #eff6ff; padding: 15px; border-radius: 8px; margin-top: 20px;">
              <p style="margin: 0; color: #1e40af; font-size: 14px;">
                <strong>ID da Mensagem:</strong> ${contactId}<br>
                <strong>Recebida em:</strong> ${new Date().toLocaleString('pt-BR')}
              </p>
            </div>

            ${isTestimonial ? `
              <p style="margin-top: 20px; color: #f59e0b; font-weight: bold;">
                Este depoimento precisa ser moderado antes de aparecer no site.<br>
                Acesse o painel admin para aprovar ou rejeitar.
              </p>
            ` : ''}
          </div>
          <div class="footer">
            <p>Notificação automática do sistema de contato</p>
            <p>© ${new Date().getFullYear()} Prof. Daniel Barral</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
${isTestimonial ? '⭐ NOVO DEPOIMENTO RECEBIDO' : '📧 NOVA MENSAGEM DE CONTATO'}
${isTestimonial ? '(AGUARDANDO MODERAÇÃO)' : ''}

Nome: ${contactData.name}
E-mail: ${contactData.email}
${contactData.phone ? `Telefone: ${contactData.phone}` : ''}
${contactData.courseInterest && contactData.courseInterest !== 'depoimento' ? `Curso: ${contactData.courseInterest}` : ''}

${isTestimonial ? 'DEPOIMENTO' : 'MENSAGEM'}:
${contactData.message}

---
ID: ${contactId}
Recebida em: ${new Date().toLocaleString('pt-BR')}
  `;

  return (await sendEmail({
    to: adminEmail,
    subject: isTestimonial ? '⭐ Novo Depoimento para Moderação' : '📧 Nova Mensagem de Contato',
    html,
    text,
  })).success;
}

/**
 * Envia alerta de destaques TCU com potencial editorial ao admin
 */
export async function sendTcuHighlightAlert(
  highlights: Array<{
    id: string;
    title: string;
    score: number;
    thesisSummary: string;
    whyImportant: string;
    articleAngle: string;
    leiConnections: Array<{ article: string; connection: string }>;
    documentUrl: string;
  }>
): Promise<boolean> {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@profdanielbarral.com';
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://profbarral.com.br';
  const n = highlights.length;

  const highlightCards = highlights.map(h => {
    const scoreColor = h.score >= 85 ? '#16a34a' : '#ca8a04';
    const scoreBg = h.score >= 85 ? '#dcfce7' : '#fef9c3';
    const leiTags = h.leiConnections.length > 0
      ? h.leiConnections.map(c =>
          `<span style="display:inline-block;background:#ede9fe;color:#6d28d9;padding:3px 10px;border-radius:12px;font-size:12px;margin:2px;">Art. ${c.article}</span>`
        ).join(' ')
      : '';

    return `
      <div style="background:white;border-radius:12px;padding:24px;margin:16px 0;border-left:4px solid ${scoreColor};box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
          <h3 style="margin:0;color:#1f2937;font-size:16px;flex:1;">${h.title}</h3>
          <span style="background:${scoreBg};color:${scoreColor};padding:4px 12px;border-radius:20px;font-size:13px;font-weight:bold;white-space:nowrap;margin-left:12px;">${h.score}/100</span>
        </div>

        <div style="background:#f8fafc;padding:14px;border-radius:8px;margin:10px 0;">
          <div style="font-weight:600;color:#475569;font-size:13px;margin-bottom:6px;">Tese Principal</div>
          <div style="color:#334155;font-size:14px;">${h.thesisSummary}</div>
        </div>

        <div style="background:#f8fafc;padding:14px;border-radius:8px;margin:10px 0;">
          <div style="font-weight:600;color:#475569;font-size:13px;margin-bottom:6px;">Por que Merece Destaque</div>
          <div style="color:#334155;font-size:14px;">${h.whyImportant}</div>
        </div>

        <div style="background:#faf5ff;padding:14px;border-radius:8px;margin:10px 0;border:1px solid #e9d5ff;">
          <div style="font-weight:600;color:#7c3aed;font-size:13px;margin-bottom:6px;">Sugestao de Artigo</div>
          <div style="color:#4c1d95;font-size:14px;">${h.articleAngle}</div>
        </div>

        ${leiTags ? `<div style="margin:10px 0;">${leiTags}</div>` : ''}

        <div style="margin-top:14px;display:flex;gap:12px;">
          <a href="${baseUrl}/admin/tcu-highlights" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:white;padding:8px 18px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;">Revisar no Admin</a>
          <a href="${h.documentUrl}" style="display:inline-block;background:#f1f5f9;color:#475569;padding:8px 18px;border-radius:6px;text-decoration:none;font-size:13px;" target="_blank">Ver Acordao Completo</a>
        </div>
      </div>
    `;
  }).join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 640px; margin: 0 auto; padding: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div style="background:linear-gradient(135deg,#7c3aed 0%,#4f46e5 100%);color:white;padding:30px;text-align:center;border-radius:12px 12px 0 0;">
            <h1 style="margin:0;font-size:22px;">Destaques TCU</h1>
            <p style="margin:8px 0 0;opacity:0.9;font-size:15px;">${n} acordao(s) com potencial para artigo no blog</p>
          </div>
          <div style="background:#f9fafb;padding:24px;border-radius:0 0 12px 12px;">
            <p style="color:#4b5563;font-size:14px;">A IA identificou os seguintes acordaos como excepcionalmente relevantes para publicacao no blog:</p>
            ${highlightCards}
            <div style="text-align:center;margin-top:24px;">
              <a href="${baseUrl}/admin/tcu-highlights" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:bold;">Ver Todos os Destaques</a>
            </div>
          </div>
          <div style="text-align:center;margin-top:20px;color:#9ca3af;font-size:12px;">
            <p>Notificacao automatica do sistema de analise TCU</p>
            <p>&copy; ${new Date().getFullYear()} Prof. Daniel Barral</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = highlights.map(h =>
    `=== ${h.title} (Score: ${h.score}/100) ===\n\nTese: ${h.thesisSummary}\n\nImportancia: ${h.whyImportant}\n\nSugestao de artigo: ${h.articleAngle}\n\nLink: ${h.documentUrl}\n`
  ).join('\n---\n\n');

  return (await sendEmail({
    to: adminEmail,
    subject: `[TCU] ${n} acordao(s) com potencial para artigo`,
    html,
    text: `${n} ACORDAO(S) TCU COM POTENCIAL EDITORIAL\n\n${text}\n\nRevisar em: ${baseUrl}/admin/tcu-highlights`,
  })).success;
}

/**
 * Envia alerta de destaques editoriais de TCEs (decisões estaduais)
 * Gradiente teal/emerald para diferenciar do TCU (purple)
 */
export async function sendTribunalHighlightAlert(
  highlights: Array<{
    id: string;
    title: string;
    score: number;
    thesisSummary: string;
    whyImportant: string;
    articleAngle: string;
    leiConnections: Array<{ article: string; connection: string }>;
    decisionUrl: string;
    tribunalCode: string;
  }>
): Promise<boolean> {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@profdanielbarral.com';
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://profbarral.com.br';
  const n = highlights.length;

  const highlightCards = highlights.map(h => {
    const scoreColor = h.score >= 85 ? '#16a34a' : '#ca8a04';
    const scoreBg = h.score >= 85 ? '#dcfce7' : '#fef9c3';
    const leiTags = h.leiConnections.length > 0
      ? h.leiConnections.map(c =>
          `<span style="display:inline-block;background:#ccfbf1;color:#0f766e;padding:3px 10px;border-radius:12px;font-size:12px;margin:2px;">Art. ${c.article}</span>`
        ).join(' ')
      : '';

    return `
      <div style="background:white;border-radius:12px;padding:24px;margin:16px 0;border-left:4px solid ${scoreColor};box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
          <div style="flex:1;">
            <span style="display:inline-block;background:#ccfbf1;color:#0f766e;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:bold;margin-bottom:8px;">${h.tribunalCode}</span>
            <h3 style="margin:0;color:#1f2937;font-size:16px;">${h.title}</h3>
          </div>
          <span style="background:${scoreBg};color:${scoreColor};padding:4px 12px;border-radius:20px;font-size:13px;font-weight:bold;white-space:nowrap;margin-left:12px;">${h.score}/100</span>
        </div>

        <div style="background:#f8fafc;padding:14px;border-radius:8px;margin:10px 0;">
          <div style="font-weight:600;color:#475569;font-size:13px;margin-bottom:6px;">Tese Principal</div>
          <div style="color:#334155;font-size:14px;">${h.thesisSummary}</div>
        </div>

        <div style="background:#f8fafc;padding:14px;border-radius:8px;margin:10px 0;">
          <div style="font-weight:600;color:#475569;font-size:13px;margin-bottom:6px;">Por que Merece Destaque</div>
          <div style="color:#334155;font-size:14px;">${h.whyImportant}</div>
        </div>

        <div style="background:#f0fdfa;padding:14px;border-radius:8px;margin:10px 0;border:1px solid #99f6e4;">
          <div style="font-weight:600;color:#0f766e;font-size:13px;margin-bottom:6px;">Sugestao de Artigo</div>
          <div style="color:#134e4a;font-size:14px;">${h.articleAngle}</div>
        </div>

        ${leiTags ? `<div style="margin:10px 0;">${leiTags}</div>` : ''}

        <div style="margin-top:14px;display:flex;gap:12px;">
          <a href="${baseUrl}/admin/tribunal-highlights" style="display:inline-block;background:linear-gradient(135deg,#0d9488,#059669);color:white;padding:8px 18px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;">Revisar no Admin</a>
          ${h.decisionUrl ? `<a href="${h.decisionUrl}" style="display:inline-block;background:#f1f5f9;color:#475569;padding:8px 18px;border-radius:6px;text-decoration:none;font-size:13px;" target="_blank">Ver Decisao Completa</a>` : ''}
        </div>
      </div>
    `;
  }).join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 640px; margin: 0 auto; padding: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div style="background:linear-gradient(135deg,#0d9488 0%,#059669 100%);color:white;padding:30px;text-align:center;border-radius:12px 12px 0 0;">
            <h1 style="margin:0;font-size:22px;">Destaques TCE</h1>
            <p style="margin:8px 0 0;opacity:0.9;font-size:15px;">${n} decisao(oes) com potencial para artigo no blog</p>
          </div>
          <div style="background:#f9fafb;padding:24px;border-radius:0 0 12px 12px;">
            <p style="color:#4b5563;font-size:14px;">A IA identificou as seguintes decisoes de Tribunais de Contas Estaduais como relevantes para publicacao no blog:</p>
            ${highlightCards}
            <div style="text-align:center;margin-top:24px;">
              <a href="${baseUrl}/admin/tribunal-highlights" style="display:inline-block;background:linear-gradient(135deg,#0d9488,#059669);color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:bold;">Ver Todos os Destaques</a>
            </div>
          </div>
          <div style="text-align:center;margin-top:20px;color:#9ca3af;font-size:12px;">
            <p>Notificacao automatica do sistema de analise TCE</p>
            <p>&copy; ${new Date().getFullYear()} Prof. Daniel Barral</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = highlights.map(h =>
    `=== [${h.tribunalCode}] ${h.title} (Score: ${h.score}/100) ===\n\nTese: ${h.thesisSummary}\n\nImportancia: ${h.whyImportant}\n\nSugestao de artigo: ${h.articleAngle}\n\n${h.decisionUrl ? `Link: ${h.decisionUrl}\n` : ''}`
  ).join('\n---\n\n');

  return (await sendEmail({
    to: adminEmail,
    subject: `[TCE] ${n} decisao(oes) com potencial para artigo`,
    html,
    text: `${n} DECISAO(OES) TCE COM POTENCIAL EDITORIAL\n\n${text}\n\nRevisar em: ${baseUrl}/admin/tribunal-highlights`,
  })).success;
}

/**
 * Envia notificação de novos documentos para aluno matriculado
 */
export async function sendNewDocumentsNotification(
  email: string,
  name: string,
  courseTitle: string,
  documents: Array<{
    title: string;
    description?: string | null;
    category: string;
    uploadedAt: Date;
  }>
): Promise<boolean> {
  const areaRestritaUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/area-restrita`;
  const documentCount = documents.length;

  // Agrupar documentos por categoria
  const docsByCategory = documents.reduce((acc, doc) => {
    const category = doc.category || 'outro';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(doc);
    return acc;
  }, {} as Record<string, typeof documents>);

  // Mapeamento de categorias para labels amigáveis
  const categoryLabels: Record<string, string> = {
    'apostila': '📖 Apostilas',
    'conteudo-programatico': '📋 Conteúdo Programático',
    'bibliografia': '📚 Bibliografia',
    'acordao': '⚖️ Acórdãos',
    'parecer': '📝 Pareceres',
    'artigo': '📑 Artigos',
    'edital': '📰 Editais',
    'link': '🔗 Links',
    'video': '🎥 Vídeos',
    'outro': '📄 Outros',
  };

  // Construir lista HTML de documentos por categoria
  let documentsHtml = '';
  Object.entries(docsByCategory).forEach(([category, docs]) => {
    const categoryLabel = categoryLabels[category] || '📄 Outros';
    documentsHtml += `
      <div style="background: white; padding: 20px; margin: 15px 0; border-radius: 8px; border-left: 4px solid #2563eb;">
        <h3 style="margin: 0 0 15px 0; color: #1f2937; font-size: 16px;">${categoryLabel}</h3>
        ${docs.map(doc => `
          <div style="margin: 10px 0; padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
            <div style="font-weight: bold; color: #374151; margin-bottom: 5px;">${doc.title}</div>
            ${doc.description ? `<div style="font-size: 14px; color: #6b7280; line-height: 1.5;">${doc.description}</div>` : ''}
            <div style="font-size: 12px; color: #9ca3af; margin-top: 5px;">
              Adicionado em: ${new Date(doc.uploadedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  });

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #9333ea 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .highlight-box { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; }
          .info-box { background: #dbeafe; border-left: 4px solid #2563eb; padding: 15px; border-radius: 8px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📚 Novos Materiais Disponíveis!</h1>
          </div>
          <div class="content">
            <p>Olá <strong>${name}</strong>,</p>

            <div class="highlight-box">
              <h2 style="margin: 0 0 10px 0; font-size: 24px;">${documentCount} ${documentCount === 1 ? 'novo material' : 'novos materiais'}</h2>
              <p style="margin: 0; font-size: 16px;">foram adicionados ao curso <strong>${courseTitle}</strong></p>
            </div>

            <p>Confira abaixo os materiais que acabaram de ser disponibilizados para você:</p>

            ${documentsHtml}

            <div class="info-box">
              <p style="margin: 0; color: #1e40af;">
                <strong>💡 Dica:</strong> Acesse sua área restrita para visualizar e fazer download de todos os materiais.
              </p>
            </div>

            <div style="text-align: center;">
              <a href="${areaRestritaUrl}" class="button">📖 Acessar Área Restrita</a>
            </div>

            <p style="text-align: center; color: #666; font-size: 14px; margin-top: 20px;">
              Ou acesse diretamente: <a href="${areaRestritaUrl}" style="color: #2563eb;">${areaRestritaUrl}</a>
            </p>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

            <p style="font-size: 14px; color: #666;">
              Este material é de uso exclusivo dos alunos matriculados. O compartilhamento não autorizado pode resultar na suspensão do acesso.
            </p>

            <p>Bons estudos!<br><strong>Equipe Prof. Daniel Barral</strong></p>
          </div>
          <div class="footer">
            <p>Você está recebendo este email porque está matriculado no curso <strong>${courseTitle}</strong>.</p>
            <p>© ${new Date().getFullYear()} Prof. Daniel Barral - Todos os direitos reservados</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
📚 NOVOS MATERIAIS DISPONÍVEIS!

Olá ${name},

${documentCount} ${documentCount === 1 ? 'novo material foi adicionado' : 'novos materiais foram adicionados'} ao curso: ${courseTitle}

MATERIAIS ADICIONADOS:

${Object.entries(docsByCategory).map(([category, docs]) => {
  const categoryLabel = categoryLabels[category] || 'Outros';
  return `
${categoryLabel}
${docs.map(doc => `
- ${doc.title}
  ${doc.description || ''}
  Adicionado em: ${new Date(doc.uploadedAt).toLocaleDateString('pt-BR')}
`).join('\n')}`;
}).join('\n')}

💡 DICA: Acesse sua área restrita para visualizar e fazer download de todos os materiais.

Acessar área restrita: ${areaRestritaUrl}

---
Este material é de uso exclusivo dos alunos matriculados. O compartilhamento não autorizado pode resultar na suspensão do acesso.

Bons estudos!
Equipe Prof. Daniel Barral

Você está recebendo este email porque está matriculado no curso ${courseTitle}.
  `;

  return (await sendEmail({
    to: email,
    subject: `📚 ${documentCount} ${documentCount === 1 ? 'novo material disponível' : 'novos materiais disponíveis'} - ${courseTitle}`,
    html,
    text,
  })).success;
}

/**
 * Envia email de boas-vindas ao curso (LMS)
 */
export async function sendCourseWelcomeEmail(
  email: string,
  name: string,
  courseTitle: string,
  courseSlug: string
): Promise<boolean> {
  const courseUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/area-restrita/curso/${courseSlug}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #2563eb 0%, #9333ea 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #9333ea 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .tips { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #e5e7eb; }
          .tip-item { margin: 8px 0; }
          .check { color: #10b981; margin-right: 8px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Bem-vindo(a) ao Curso!</h1>
          </div>
          <div class="content">
            <p>Olá ${name},</p>
            <p>Que bom que você iniciou seus estudos no curso <strong>${courseTitle}</strong>!</p>

            <div class="tips">
              <h3 style="margin-top: 0;">Dicas para aproveitar ao máximo:</h3>
              <div class="tip-item"><span class="check">&#10003;</span> Siga os módulos na ordem — cada um prepara para o próximo</div>
              <div class="tip-item"><span class="check">&#10003;</span> Consulte os documentos de apoio em cada aula</div>
              <div class="tip-item"><span class="check">&#10003;</span> Use o assistente de IA para tirar dúvidas</div>
              <div class="tip-item"><span class="check">&#10003;</span> Responda os quizzes para testar seu conhecimento</div>
            </div>

            <div style="text-align: center;">
              <a href="${courseUrl}" class="button">Continuar Estudando</a>
            </div>

            <p>Bons estudos!<br><strong>Equipe Prof. Daniel Barral</strong></p>
          </div>
          <div class="footer">
            <p>Este é um email automático, por favor não responda.</p>
            <p>&copy; ${new Date().getFullYear()} Prof. Daniel Barral - Todos os direitos reservados</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
Bem-vindo(a) ao Curso!

Olá ${name},

Que bom que você iniciou seus estudos no curso: ${courseTitle}!

Dicas para aproveitar ao máximo:
- Siga os módulos na ordem
- Consulte os documentos de apoio
- Use o assistente de IA para dúvidas
- Responda os quizzes

Continuar estudando: ${courseUrl}

Bons estudos!
Equipe Prof. Daniel Barral
  `;

  return (await sendEmail({
    to: email,
    subject: `Bem-vindo(a) ao curso: ${courseTitle}`,
    html,
    text,
  })).success;
}

/**
 * Envia email de conclusao de modulo (LMS)
 */
export async function sendModuleCompletionEmail(
  email: string,
  name: string,
  courseTitle: string,
  moduleTitle: string,
  courseSlug: string
): Promise<boolean> {
  const courseUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/area-restrita/curso/${courseSlug}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .achievement { background: white; border: 2px solid #059669; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Módulo Concluído!</h1>
          </div>
          <div class="content">
            <p>Olá ${name},</p>

            <div class="achievement">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">Você concluiu com sucesso:</p>
              <h2 style="margin: 0; color: #059669;">${moduleTitle}</h2>
              <p style="margin: 10px 0 0; font-size: 14px; color: #666;">do curso <strong>${courseTitle}</strong></p>
            </div>

            <p>Continue assim! Cada módulo concluído te aproxima mais do certificado de conclusão do curso.</p>

            <div style="text-align: center;">
              <a href="${courseUrl}" class="button">Continuar para o Próximo Módulo</a>
            </div>

            <p>Bons estudos!<br><strong>Equipe Prof. Daniel Barral</strong></p>
          </div>
          <div class="footer">
            <p>Este é um email automático, por favor não responda.</p>
            <p>&copy; ${new Date().getFullYear()} Prof. Daniel Barral - Todos os direitos reservados</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
Módulo Concluído!

Olá ${name},

Você concluiu com sucesso o módulo: ${moduleTitle}
do curso: ${courseTitle}

Continue assim! Cada módulo concluído te aproxima mais do certificado.

Continuar estudando: ${courseUrl}

Bons estudos!
Equipe Prof. Daniel Barral
  `;

  return (await sendEmail({
    to: email,
    subject: `Módulo concluído: ${moduleTitle} - ${courseTitle}`,
    html,
    text,
  })).success;
}

/**
 * Envia email de lembrete de inatividade (LMS)
 */
export async function sendInactivityReminderEmail(
  email: string,
  name: string,
  courseTitle: string,
  courseSlug: string,
  daysSinceAccess: number
): Promise<boolean> {
  const courseUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/area-restrita/curso/${courseSlug}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .reminder-box { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 8px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Sentimos sua falta!</h1>
          </div>
          <div class="content">
            <p>Olá ${name},</p>

            <div class="reminder-box">
              <p style="margin: 0;">Faz <strong>${daysSinceAccess} dias</strong> que você não acessa o curso <strong>${courseTitle}</strong>.</p>
            </div>

            <p>A constância é fundamental para o aprendizado. Que tal reservar alguns minutos hoje para retomar seus estudos?</p>
            <p>Seu progresso está salvo e você pode continuar de onde parou.</p>

            <div style="text-align: center;">
              <a href="${courseUrl}" class="button">Retomar Estudos</a>
            </div>

            <p>Estamos torcendo por você!<br><strong>Equipe Prof. Daniel Barral</strong></p>
          </div>
          <div class="footer">
            <p>Este é um email automático, por favor não responda.</p>
            <p>&copy; ${new Date().getFullYear()} Prof. Daniel Barral - Todos os direitos reservados</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
Sentimos sua falta!

Olá ${name},

Faz ${daysSinceAccess} dias que você não acessa o curso: ${courseTitle}.

A constância é fundamental para o aprendizado. Que tal reservar alguns minutos hoje para retomar seus estudos?

Seu progresso está salvo e você pode continuar de onde parou.

Retomar estudos: ${courseUrl}

Estamos torcendo por você!
Equipe Prof. Daniel Barral
  `;

  return (await sendEmail({
    to: email,
    subject: `Sentimos sua falta - ${courseTitle}`,
    html,
    text,
  })).success;
}

/**
 * Envia notificação de certificado ao aluno
 */
export async function sendCertificateNotification(
  email: string,
  name: string,
  courseTitle: string,
  certificateNumber: string,
  verificationUrl: string
): Promise<boolean> {
  const downloadUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/area-restrita/curso/certificado/${certificateNumber}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .cert-box { background: white; border: 2px solid #059669; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; }
          .cert-number { font-size: 18px; font-weight: bold; color: #059669; letter-spacing: 2px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Parabéns, ${name}!</h1>
          </div>
          <div class="content">
            <p>Temos o prazer de informar que você concluiu com sucesso o curso:</p>
            <h2 style="color: #1f2937; text-align: center;">${courseTitle}</h2>

            <div class="cert-box">
              <p style="margin: 0 0 10px 0; color: #666;">Seu certificado:</p>
              <div class="cert-number">${certificateNumber}</div>
            </div>

            <div style="text-align: center;">
              <a href="${downloadUrl}" class="button">Baixar Certificado em PDF</a>
            </div>

            <p style="text-align: center; font-size: 14px; color: #666;">
              Verifique a autenticidade em:<br>
              <a href="${verificationUrl}" style="color: #059669;">${verificationUrl}</a>
            </p>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

            <p>Atenciosamente,<br><strong>Equipe Prof. Daniel Barral</strong></p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Prof. Daniel Barral - Todos os direitos reservados</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
Parabéns, ${name}!

Você concluiu com sucesso o curso: ${courseTitle}

Seu certificado: ${certificateNumber}

Baixar certificado: ${downloadUrl}
Verificar autenticidade: ${verificationUrl}

Atenciosamente,
Equipe Prof. Daniel Barral
  `;

  return (await sendEmail({
    to: email,
    subject: `Certificado de Conclusão - ${courseTitle}`,
    html,
    text,
  })).success;
}
