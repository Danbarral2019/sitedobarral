import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Resend } from 'resend';

/**
 * Cron Job: Newsletter Mensal de Documentos Novos
 *
 * Envia email para todos os inscritos na newsletter com:
 * - Resumo de documentos adicionados no último mês
 * - Agrupados por categoria (Acórdãos, ONs, Pareceres, etc.)
 * - Links para acesso na área restrita
 *
 * Segurança: Requer CRON_SECRET no header
 * Agendamento: Configurado no vercel.json (mensal - dia 1 às 9h)
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Verificação de segurança
    const cronSecret = request.headers.get('x-cron-secret');

    if (cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json(
        { error: 'Acesso não autorizado' },
        { status: 401 }
      );
    }

    console.log('[Cron Newsletter] Iniciando envio de newsletter mensal...');

    // 2. Busca documentos adicionados nos últimos 30 dias
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const newDocuments = await prisma.document.findMany({
      where: {
        uploadedAt: {
          gte: thirtyDaysAgo,
        },
        isPublic: true, // Apenas documentos públicos na newsletter
      },
      orderBy: {
        uploadedAt: 'desc',
      },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        uploadedAt: true,
        url: true,
      },
    });

    console.log(`[Cron Newsletter] ${newDocuments.length} documentos novos encontrados`);

    // Se não houver documentos novos, não envia newsletter
    if (newDocuments.length === 0) {
      console.log('[Cron Newsletter] Nenhum documento novo, newsletter não enviada');
      return NextResponse.json({
        success: true,
        message: 'Nenhum documento novo para enviar na newsletter',
        documentCount: 0,
      });
    }

    // 3. Agrupa documentos por categoria
    const documentsByCategory = newDocuments.reduce((acc, doc) => {
      if (!acc[doc.category]) {
        acc[doc.category] = [];
      }
      acc[doc.category].push(doc);
      return acc;
    }, {} as Record<string, typeof newDocuments>);

    // 4. Busca todos os inscritos ativos na newsletter
    const subscribers = await prisma.newsletterSubscriber.findMany({
      where: {
        isActive: true,
      },
      select: {
        email: true,
        name: true,
      },
    });

    console.log(`[Cron Newsletter] ${subscribers.length} inscritos ativos`);

    if (subscribers.length === 0) {
      console.log('[Cron Newsletter] Nenhum inscrito ativo');
      return NextResponse.json({
        success: true,
        message: 'Nenhum inscrito ativo para enviar newsletter',
        documentCount: newDocuments.length,
      });
    }

    // 5. Gera HTML da newsletter
    const newsletterHtml = generateNewsletterHtml(documentsByCategory, newDocuments.length);

    // 6. Inicializa Resend
    const resend = new Resend(process.env.RESEND_API_KEY);

    // 7. Envia email para todos os inscritos (em lote)
    const emailPromises = subscribers.map((subscriber) =>
      resend.emails.send({
        from: process.env.EMAIL_FROM || 'newsletter@profdanielbarral.com.br',
        to: subscriber.email,
        subject: `Novidades do mês: ${newDocuments.length} novos documentos de Licitações`,
        html: newsletterHtml.replace('{{NAME}}', subscriber.name || 'Assinante'),
      })
    );

    const results = await Promise.allSettled(emailPromises);

    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    const errorCount = results.filter((r) => r.status === 'rejected').length;

    console.log(`[Cron Newsletter] Emails enviados: ${successCount} sucesso, ${errorCount} erro`);

    // 8. Log de erros se houver
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`[Cron Newsletter] Erro ao enviar para ${subscribers[index].email}:`, result.reason);
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Newsletter mensal enviada com sucesso',
      stats: {
        documents: newDocuments.length,
        subscribers: subscribers.length,
        emailsSent: successCount,
        emailsFailed: errorCount,
      },
    });

  } catch (error) {
    console.error('[Cron Newsletter] Erro fatal:', error);
    return NextResponse.json(
      {
        error: 'Erro ao enviar newsletter mensal',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}

/**
 * Gera HTML da newsletter mensal
 */
function generateNewsletterHtml(
  documentsByCategory: Record<string, Array<{
    id: string;
    title: string;
    description: string | null;
    category: string;
    uploadedAt: Date;
    url: string | null;
  }>>,
  totalDocuments: number
): string {
  const categoryNames: Record<string, string> = {
    'apostila': 'Apostilas e Material Didático',
    'acordao': 'Acórdãos',
    'parecer': 'Pareceres Jurídicos',
    'edital': 'Editais',
    'artigo': 'Artigos e Doutrinas',
    'orientacao-normativa': 'Orientações Normativas',
    'outro': 'Outros Documentos',
  };

  const categoryEmojis: Record<string, string> = {
    'apostila': '📚',
    'acordao': '⚖️',
    'parecer': '📋',
    'edital': '📄',
    'artigo': '📰',
    'orientacao-normativa': '📜',
    'outro': '📁',
  };

  // Monta seções por categoria
  let categorySections = '';
  for (const [category, docs] of Object.entries(documentsByCategory)) {
    const categoryName = categoryNames[category] || category;
    const emoji = categoryEmojis[category] || '📄';

    categorySections += `
      <div style="margin-bottom: 30px;">
        <h2 style="color: #003366; font-size: 20px; border-bottom: 2px solid #0066cc; padding-bottom: 10px; margin-bottom: 15px;">
          ${emoji} ${categoryName} (${docs.length})
        </h2>
        <div style="padding-left: 15px;">
    `;

    docs.forEach((doc, index) => {
      categorySections += `
        <div style="margin-bottom: 20px; padding: 15px; background-color: #f8f9fa; border-left: 4px solid #0066cc; border-radius: 4px;">
          <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #222;">
            ${index + 1}. ${doc.title}
          </h3>
          ${doc.description ? `
            <p style="margin: 0 0 10px 0; color: #555; font-size: 14px; line-height: 1.5;">
              ${doc.description.substring(0, 200)}${doc.description.length > 200 ? '...' : ''}
            </p>
          ` : ''}
          <p style="margin: 0; font-size: 12px; color: #777;">
            Adicionado em: ${new Date(doc.uploadedAt).toLocaleDateString('pt-BR')}
          </p>
        </div>
      `;
    });

    categorySections += `
        </div>
      </div>
    `;
  }

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Newsletter Mensal - Prof. Daniel Barral</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #003366 0%, #0066cc 100%); color: white; padding: 30px 20px; text-align: center;">
      <h1 style="margin: 0; font-size: 28px;">Prof. Daniel Barral</h1>
      <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Licitações e Contratos Públicos</p>
    </div>

    <!-- Greeting -->
    <div style="padding: 30px 20px;">
      <p style="margin: 0 0 20px 0; font-size: 16px; color: #333;">
        Olá, <strong>{{NAME}}</strong>!
      </p>

      <p style="margin: 0 0 20px 0; font-size: 16px; color: #333; line-height: 1.6;">
        Confira as novidades deste mês! Foram adicionados <strong>${totalDocuments} novos documentos</strong>
        na plataforma, todos relacionados a Licitações e Contratos Públicos.
      </p>

      <!-- Highlight Box -->
      <div style="background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 15px; margin-bottom: 30px;">
        <p style="margin: 0; color: #856404; font-size: 14px;">
          <strong>💡 Dica:</strong> Acesse a <a href="${process.env.NEXT_PUBLIC_BASE_URL}/area-restrita" style="color: #0066cc; text-decoration: none;">Área Restrita</a>
          para visualizar os documentos completos e fazer download.
        </p>
      </div>

      <!-- Categories -->
      ${categorySections}

      <!-- CTA -->
      <div style="text-align: center; margin-top: 40px; padding: 30px 20px; background-color: #f8f9fa; border-radius: 8px;">
        <p style="margin: 0 0 20px 0; font-size: 16px; color: #333;">
          Explore todos os documentos na plataforma:
        </p>
        <a href="${process.env.NEXT_PUBLIC_BASE_URL}/area-restrita"
           style="display: inline-block; background-color: #0066cc; color: white; text-decoration: none; padding: 15px 40px; border-radius: 5px; font-size: 16px; font-weight: bold;">
          Acessar Área Restrita
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
      <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">
        Prof. Daniel Barral - Licitações e Contratos Públicos
      </p>
      <p style="margin: 0 0 10px 0; font-size: 12px; color: #999;">
        <a href="${process.env.NEXT_PUBLIC_BASE_URL}" style="color: #0066cc; text-decoration: none;">www.profdanielbarral.com.br</a>
      </p>
      <p style="margin: 0; font-size: 11px; color: #999;">
        Você está recebendo este email porque se inscreveu na nossa newsletter.
        <br>
        <a href="${process.env.NEXT_PUBLIC_BASE_URL}/newsletter/unsubscribe" style="color: #999; text-decoration: underline;">Cancelar inscrição</a>
      </p>
    </div>

  </div>
</body>
</html>
  `;
}
