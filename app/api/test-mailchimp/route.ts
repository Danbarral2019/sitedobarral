import { NextResponse } from 'next/server';
import { isMailChimpConfigured, addSubscriber } from '@/lib/mailchimp';

export async function GET() {
  // Verificar configuração
  const isConfigured = isMailChimpConfigured();

  if (!isConfigured) {
    return NextResponse.json({
      error: 'MailChimp não está configurado',
      env: {
        hasApiKey: !!process.env.MAILCHIMP_API_KEY,
        hasServerPrefix: !!process.env.MAILCHIMP_SERVER_PREFIX,
        hasAudienceId: !!process.env.MAILCHIMP_AUDIENCE_ID,
      }
    }, { status: 500 });
  }

  // Testar adição de subscriber
  try {
    const testEmail = `test+${Date.now()}@example.com`;
    const result = await addSubscriber(testEmail, 'Test', 'User', ['Teste']);

    return NextResponse.json({
      success: true,
      message: 'MailChimp configurado e funcionando!',
      result,
      isConfigured: true,
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Erro ao testar MailChimp',
      details: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
