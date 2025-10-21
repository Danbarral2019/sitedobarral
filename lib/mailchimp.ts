import mailchimp from '@mailchimp/mailchimp_marketing';
import crypto from 'crypto';

/**
 * Biblioteca de integração com MailChimp
 *
 * Configuração necessária no .env:
 * MAILCHIMP_API_KEY=sua_chave_api
 * MAILCHIMP_SERVER_PREFIX=us1 (ou o prefixo do seu servidor)
 * MAILCHIMP_AUDIENCE_ID=id_da_sua_lista
 *
 * Como obter:
 * 1. API Key: Account > Extras > API keys
 * 2. Server Prefix: Último caractere do seu API key (ex: xxxxx-us1)
 * 3. Audience ID: Audience > Settings > Audience name and defaults
 */

// Configuração do cliente MailChimp
const MAILCHIMP_API_KEY = process.env.MAILCHIMP_API_KEY || '';
const MAILCHIMP_SERVER_PREFIX = process.env.MAILCHIMP_SERVER_PREFIX || 'us1';
const MAILCHIMP_AUDIENCE_ID = process.env.MAILCHIMP_AUDIENCE_ID || '';

// Verifica se está configurado
const isConfigured = Boolean(
  MAILCHIMP_API_KEY &&
  MAILCHIMP_SERVER_PREFIX &&
  MAILCHIMP_AUDIENCE_ID
);

// Inicializar cliente apenas se configurado
if (isConfigured) {
  mailchimp.setConfig({
    apiKey: MAILCHIMP_API_KEY,
    server: MAILCHIMP_SERVER_PREFIX,
  });

  // Configurar timeout para evitar socket hang up
  // @ts-ignore - SDK não exporta tipos para timeout
  mailchimp.client.setTimeout(10000); // 10 segundos
}

/**
 * Status de configuração do MailChimp
 */
export function isMailChimpConfigured(): boolean {
  return isConfigured;
}

/**
 * Função auxiliar para retry em caso de erros de rede temporários
 */
async function retryOnNetworkError<T>(
  fn: () => Promise<T>,
  maxRetries = 2,
  delayMs = 1000
): Promise<T> {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error;
      const err = error as { code?: string; message?: string };

      // Apenas retry em erros de rede temporários
      const isNetworkError = err.code === 'ECONNRESET' ||
                            err.code === 'ETIMEDOUT' ||
                            err.message?.includes('socket hang up');

      if (!isNetworkError || attempt === maxRetries) {
        throw error;
      }

      // Aguardar antes de tentar novamente (com backoff exponencial)
      await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
      console.log(`[MailChimp] Tentando novamente (${attempt + 1}/${maxRetries})...`);
    }
  }

  throw lastError;
}

/**
 * Adiciona um novo inscrito à lista do MailChimp
 */
export async function addSubscriber(
  email: string,
  firstName?: string,
  lastName?: string,
  interests?: string[]
): Promise<{ success: boolean; message?: string; error?: string }> {
  if (!isConfigured) {
    console.warn('MailChimp não configurado. Configure as variáveis de ambiente.');
    return {
      success: false,
      error: 'MailChimp não configurado',
    };
  }

  try {
    const emailLower = email.toLowerCase();

    // Criar MD5 hash do email (requerido pelo MailChimp)
    const subscriberHash = crypto.createHash('md5').update(emailLower).digest('hex');

    // Preparar merge fields (campos personalizados)
    const mergeFields: Record<string, string> = {};
    if (firstName) mergeFields.FNAME = firstName;
    if (lastName) mergeFields.LNAME = lastName;

    // Preparar tags (interesses)
    const tags = interests && interests.length > 0
      ? interests.map(interest => ({ name: interest, status: 'active' as const }))
      : [];

    // Adicionar/atualizar inscrito com retry em caso de erro de rede
    const response = await retryOnNetworkError(() =>
      mailchimp.lists.setListMember(
        MAILCHIMP_AUDIENCE_ID,
        subscriberHash,
        {
          email_address: emailLower,
          status_if_new: 'subscribed', // 'subscribed', 'pending', 'unsubscribed', 'cleaned'
          merge_fields: mergeFields,
          tags: tags,
        }
      )
    );

    return {
      success: true,
      message: `Inscrito adicionado com sucesso: ${response.email_address}`,
    };
  } catch (error: unknown) {
    console.error('Erro ao adicionar inscrito no MailChimp:', error);

    // Tratamento de erros específicos
    const err = error as { status?: number; response?: { body?: { detail?: string } }; message?: string };
    if (err.status === 400) {
      return {
        success: false,
        error: 'Email inválido ou já existe com status diferente',
      };
    }

    return {
      success: false,
      error: err.response?.body?.detail || err.message || 'Erro desconhecido',
    };
  }
}

/**
 * Remove um inscrito da lista (marca como unsubscribed)
 */
export async function unsubscribeSubscriber(
  email: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  if (!isConfigured) {
    return {
      success: false,
      error: 'MailChimp não configurado',
    };
  }

  try {
    const emailLower = email.toLowerCase();
    const subscriberHash = crypto.createHash('md5').update(emailLower).digest('hex');

    await mailchimp.lists.updateListMember(
      MAILCHIMP_AUDIENCE_ID,
      subscriberHash,
      {
        status: 'unsubscribed',
      }
    );

    return {
      success: true,
      message: 'Inscrito removido com sucesso',
    };
  } catch (error: unknown) {
    console.error('Erro ao remover inscrito do MailChimp:', error);
    const err = error as { response?: { body?: { detail?: string } }; message?: string };
    return {
      success: false,
      error: err.response?.body?.detail || err.message || 'Erro desconhecido',
    };
  }
}

/**
 * Atualiza tags/interesses de um inscrito
 */
export async function updateSubscriberTags(
  email: string,
  tagsToAdd: string[],
  tagsToRemove?: string[]
): Promise<{ success: boolean; message?: string; error?: string }> {
  if (!isConfigured) {
    return {
      success: false,
      error: 'MailChimp não configurado',
    };
  }

  try {
    const emailLower = email.toLowerCase();
    const subscriberHash = crypto.createHash('md5').update(emailLower).digest('hex');

    const tags = [
      ...tagsToAdd.map(tag => ({ name: tag, status: 'active' as const })),
      ...(tagsToRemove || []).map(tag => ({ name: tag, status: 'inactive' as const })),
    ];

    await mailchimp.lists.updateListMemberTags(
      MAILCHIMP_AUDIENCE_ID,
      subscriberHash,
      {
        tags: tags,
      }
    );

    return {
      success: true,
      message: 'Tags atualizadas com sucesso',
    };
  } catch (error: unknown) {
    console.error('Erro ao atualizar tags no MailChimp:', error);
    const err = error as { response?: { body?: { detail?: string } }; message?: string };
    return {
      success: false,
      error: err.response?.body?.detail || err.message || 'Erro desconhecido',
    };
  }
}

/**
 * Obtém informações de um inscrito
 */
export async function getSubscriber(
  email: string
): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
  if (!isConfigured) {
    return {
      success: false,
      error: 'MailChimp não configurado',
    };
  }

  try {
    const emailLower = email.toLowerCase();
    const subscriberHash = crypto.createHash('md5').update(emailLower).digest('hex');

    const response = await mailchimp.lists.getListMember(
      MAILCHIMP_AUDIENCE_ID,
      subscriberHash
    );

    return {
      success: true,
      data: response,
    };
  } catch (error: unknown) {
    console.error('Erro ao buscar inscrito no MailChimp:', error);
    const err = error as { response?: { body?: { detail?: string } }; message?: string };
    return {
      success: false,
      error: err.response?.body?.detail || err.message || 'Erro desconhecido',
    };
  }
}

/**
 * Sincroniza inscritos do banco de dados local com o MailChimp
 */
export async function syncSubscribers(
  subscribers: Array<{
    email: string;
    name?: string;
    interests?: string[];
  }>
): Promise<{
  success: boolean;
  synced: number;
  failed: number;
  errors: string[];
}> {
  if (!isConfigured) {
    return {
      success: false,
      synced: 0,
      failed: subscribers.length,
      errors: ['MailChimp não configurado'],
    };
  }

  let synced = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const subscriber of subscribers) {
    const [firstName, ...lastNameParts] = (subscriber.name || '').split(' ');
    const lastName = lastNameParts.join(' ');

    const result = await addSubscriber(
      subscriber.email,
      firstName,
      lastName,
      subscriber.interests
    );

    if (result.success) {
      synced++;
    } else {
      failed++;
      errors.push(`${subscriber.email}: ${result.error}`);
    }
  }

  return {
    success: failed === 0,
    synced,
    failed,
    errors,
  };
}

/**
 * Envia uma campanha de email para a lista
 */
export async function createCampaign(
  subject: string,
  htmlContent: string,
  previewText?: string
): Promise<{ success: boolean; campaignId?: string; error?: string; message?: string }> {
  if (!isConfigured) {
    return {
      success: false,
      error: 'MailChimp não configurado',
    };
  }

  try {
    // Criar campanha
    const campaign = await mailchimp.campaigns.create({
      type: 'regular',
      recipients: {
        list_id: MAILCHIMP_AUDIENCE_ID,
      },
      settings: {
        subject_line: subject,
        preview_text: previewText || subject,
        title: `Campanha: ${subject}`,
        from_name: 'Prof. Daniel Barral',
        reply_to: process.env.MAILCHIMP_REPLY_TO || 'noreply@profbarral.com.br',
      },
    });

    // Adicionar conteúdo HTML
    await mailchimp.campaigns.setContent(campaign.id, {
      html: htmlContent,
    });

    return {
      success: true,
      campaignId: campaign.id,
      message: 'Campanha criada com sucesso. Use o ID para enviá-la.',
    };
  } catch (error: unknown) {
    console.error('Erro ao criar campanha no MailChimp:', error);
    const err = error as { response?: { body?: { detail?: string } }; message?: string };
    return {
      success: false,
      error: err.response?.body?.detail || err.message || 'Erro desconhecido',
    };
  }
}

/**
 * Envia uma campanha previamente criada
 */
export async function sendCampaign(
  campaignId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  if (!isConfigured) {
    return {
      success: false,
      error: 'MailChimp não configurado',
    };
  }

  try {
    await mailchimp.campaigns.send(campaignId);

    return {
      success: true,
      message: 'Campanha enviada com sucesso',
    };
  } catch (error: unknown) {
    console.error('Erro ao enviar campanha no MailChimp:', error);
    const err = error as { response?: { body?: { detail?: string } }; message?: string };
    return {
      success: false,
      error: err.response?.body?.detail || err.message || 'Erro desconhecido',
    };
  }
}
