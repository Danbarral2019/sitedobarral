import { apiLogger } from "@/lib/logger";

/**
 * Biblioteca de integração com Instagram Graph API
 *
 * Configuração necessária no .env:
 * INSTAGRAM_APP_ID=id_do_app
 * INSTAGRAM_APP_SECRET=secret_do_app
 * INSTAGRAM_ACCESS_TOKEN=token_de_acesso_longa_duracao
 * INSTAGRAM_BUSINESS_ACCOUNT_ID=id_da_conta_business
 *
 * Como obter:
 * 1. Criar Facebook App em developers.facebook.com
 * 2. Adicionar produto "Instagram Basic Display"
 * 3. Configurar permissões: instagram_basic, instagram_content_publish
 * 4. Gerar Access Token de longa duração (60 dias)
 * 5. Conectar Instagram Business Account
 * 6. Obter Business Account ID via API
 *
 * Documentação: https://developers.facebook.com/docs/instagram-api/
 */

const INSTAGRAM_API_BASE = 'https://graph.facebook.com/v18.0';
const INSTAGRAM_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN || '';
const INSTAGRAM_BUSINESS_ACCOUNT_ID = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || '';

/**
 * Verifica se Instagram está configurado
 */
export function isInstagramConfigured(): boolean {
  return Boolean(INSTAGRAM_ACCESS_TOKEN && INSTAGRAM_BUSINESS_ACCOUNT_ID);
}

/**
 * Interface para resposta do Instagram
 */
interface InstagramMediaResponse {
  id: string;
}

interface InstagramPostResponse {
  id: string;
  permalink?: string;
}

/**
 * Cria um post no Instagram com imagem
 *
 * Fluxo:
 * 1. Cria container com a imagem
 * 2. Publica o container
 *
 * @param imageUrl - URL pública da imagem (deve ser HTTPS)
 * @param caption - Legenda do post (máximo 2200 caracteres)
 * @returns ID do post e permalink
 */
export async function createInstagramPost(
  imageUrl: string,
  caption: string
): Promise<{ success: boolean; postId?: string; permalink?: string; error?: string }> {
  if (!isInstagramConfigured()) {
    return {
      success: false,
      error: 'Instagram não configurado',
    };
  }

  try {
    // Validações
    if (!imageUrl.startsWith('https://')) {
      return {
        success: false,
        error: 'A URL da imagem deve usar HTTPS',
      };
    }

    if (caption.length > 2200) {
      return {
        success: false,
        error: 'Caption muito longa (máximo 2200 caracteres)',
      };
    }

    // Passo 1: Criar container com a imagem
    const createContainerResponse = await fetch(
      `${INSTAGRAM_API_BASE}/${INSTAGRAM_BUSINESS_ACCOUNT_ID}/media`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_url: imageUrl,
          caption: caption,
          access_token: INSTAGRAM_ACCESS_TOKEN,
        }),
      }
    );

    if (!createContainerResponse.ok) {
      const errorData = await createContainerResponse.json();
      apiLogger.error({ err: errorData }, '[Instagram] Erro ao criar container:');
      return {
        success: false,
        error: errorData.error?.message || 'Erro ao criar container de mídia',
      };
    }

    const containerData: InstagramMediaResponse = await createContainerResponse.json();
    const creationId = containerData.id;

    // Aguardar alguns segundos para o Instagram processar a imagem
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Passo 2: Publicar o container

    const publishResponse = await fetch(
      `${INSTAGRAM_API_BASE}/${INSTAGRAM_BUSINESS_ACCOUNT_ID}/media_publish`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          creation_id: creationId,
          access_token: INSTAGRAM_ACCESS_TOKEN,
        }),
      }
    );

    if (!publishResponse.ok) {
      const errorData = await publishResponse.json();
      apiLogger.error({ err: errorData }, '[Instagram] Erro ao publicar:');
      return {
        success: false,
        error: errorData.error?.message || 'Erro ao publicar post',
      };
    }

    const publishData: InstagramPostResponse = await publishResponse.json();
    const postId = publishData.id;

    // Obter permalink do post (opcional)
    let permalink: string | undefined;
    try {
      const mediaResponse = await fetch(
        `${INSTAGRAM_API_BASE}/${postId}?fields=permalink&access_token=${INSTAGRAM_ACCESS_TOKEN}`
      );

      if (mediaResponse.ok) {
        const mediaData = await mediaResponse.json();
        permalink = mediaData.permalink;
      }
    } catch {
      // Silently fail - permalink is optional
    }

    return {
      success: true,
      postId,
      permalink,
    };
  } catch (error: unknown) {
    apiLogger.error({ err: error }, '[Instagram] Erro inesperado:');
    const err = error as Error;
    return {
      success: false,
      error: err.message || 'Erro desconhecido',
    };
  }
}

/**
 * Gera caption otimizada para Instagram
 *
 * @param title - Título do post
 * @param excerpt - Resumo do post
 * @param slug - Slug do post (para URL)
 * @param hashtags - Hashtags opcionais
 * @returns Caption formatada
 */
export function generateInstagramCaption(
  title: string,
  excerpt: string,
  slug: string,
  hashtags: string[] = [
    'DireitoAdministrativo',
    'Licitacoes',
    'ContratosPublicos',
    'DireitoPublico',
    'Concursos',
  ]
): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://profdanielbarral.com';
  const postUrl = `${baseUrl}/blog/${slug}`;

  // Limitar excerpt para não exceder limite de caracteres
  const maxExcerptLength = 2200 - title.length - postUrl.length - hashtags.join(' #').length - 100;
  const truncatedExcerpt =
    excerpt.length > maxExcerptLength ? excerpt.substring(0, maxExcerptLength) + '...' : excerpt;

  const caption = `${title}

${truncatedExcerpt}

📖 Leia o artigo completo em:
${postUrl}

#${hashtags.join(' #')}`;

  return caption;
}

/**
 * Renova o Access Token do Instagram (60 dias)
 *
 * @param currentToken - Token atual
 * @returns Novo token de longa duração
 */
export async function refreshInstagramToken(
  currentToken: string
): Promise<{ success: boolean; accessToken?: string; expiresIn?: number; error?: string }> {
  try {
    const response = await fetch(
      `${INSTAGRAM_API_BASE}/oauth/access_token?grant_type=ig_exchange_token&client_secret=${process.env.INSTAGRAM_APP_SECRET}&access_token=${currentToken}`
    );

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.error?.message || 'Erro ao renovar token',
      };
    }

    const data = await response.json();

    return {
      success: true,
      accessToken: data.access_token,
      expiresIn: data.expires_in, // Segundos (geralmente 5184000 = 60 dias)
    };
  } catch (error: unknown) {
    const err = error as Error;
    return {
      success: false,
      error: err.message || 'Erro desconhecido',
    };
  }
}
