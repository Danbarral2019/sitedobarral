/**
 * Biblioteca de integração com LinkedIn Share API
 *
 * Configuração necessária no .env:
 * LINKEDIN_CLIENT_ID=id_do_app
 * LINKEDIN_CLIENT_SECRET=secret_do_app
 * LINKEDIN_ACCESS_TOKEN=token_de_acesso
 * LINKEDIN_PERSON_URN=urn_da_pessoa (ex: urn:li:person:ABC123)
 *
 * Como obter:
 * 1. Criar LinkedIn App em developer.linkedin.com
 * 2. Configurar OAuth 2.0 redirect URLs
 * 3. Solicitar permissões: w_member_social, r_liteprofile
 * 4. Gerar Access Token via OAuth flow
 * 5. Obter Person URN via GET /v2/me
 *
 * Documentação: https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin
 */

const LINKEDIN_API_BASE = 'https://api.linkedin.com/v2';
const LINKEDIN_ACCESS_TOKEN = process.env.LINKEDIN_ACCESS_TOKEN || '';
const LINKEDIN_PERSON_URN = process.env.LINKEDIN_PERSON_URN || '';

/**
 * Verifica se LinkedIn está configurado
 */
export function isLinkedInConfigured(): boolean {
  return Boolean(LINKEDIN_ACCESS_TOKEN && LINKEDIN_PERSON_URN);
}

/**
 * Interface para resposta do LinkedIn
 */
interface LinkedInPostResponse {
  id: string;
}

interface LinkedInImageUploadResponse {
  value: {
    uploadMechanism: {
      'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': {
        uploadUrl: string;
        headers: Record<string, string>;
      };
    };
    asset: string;
  };
}

/**
 * Cria um post no LinkedIn (somente texto)
 *
 * @param text - Texto do post (máximo 3000 caracteres)
 * @returns ID do post
 */
export async function createLinkedInTextPost(
  text: string
): Promise<{ success: boolean; postId?: string; postUrl?: string; error?: string }> {
  if (!isLinkedInConfigured()) {
    console.warn('LinkedIn não configurado. Configure as variáveis de ambiente.');
    return {
      success: false,
      error: 'LinkedIn não configurado',
    };
  }

  try {
    // Validações
    if (text.length > 3000) {
      return {
        success: false,
        error: 'Texto muito longo (máximo 3000 caracteres)',
      };
    }

    console.log('[LinkedIn] Criando post de texto...');

    const response = await fetch(`${LINKEDIN_API_BASE}/ugcPosts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${LINKEDIN_ACCESS_TOKEN}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({
        author: LINKEDIN_PERSON_URN,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: text,
            },
            shareMediaCategory: 'NONE',
          },
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[LinkedIn] Erro ao criar post:', errorData);
      return {
        success: false,
        error: errorData.message || 'Erro ao criar post',
      };
    }

    const data: LinkedInPostResponse = await response.json();
    const postId = data.id;

    console.log('[LinkedIn] Post criado com sucesso:', postId);

    // Construir URL do post (aproximado)
    const postUrl = `https://www.linkedin.com/feed/update/${postId}`;

    return {
      success: true,
      postId,
      postUrl,
    };
  } catch (error: unknown) {
    console.error('[LinkedIn] Erro inesperado:', error);
    const err = error as Error;
    return {
      success: false,
      error: err.message || 'Erro desconhecido',
    };
  }
}

/**
 * Cria um post no LinkedIn com imagem
 *
 * Fluxo:
 * 1. Registra upload da imagem
 * 2. Faz upload da imagem
 * 3. Cria post com a imagem
 *
 * @param text - Texto do post
 * @param imageUrl - URL pública da imagem
 * @returns ID do post
 */
export async function createLinkedInImagePost(
  text: string,
  imageUrl: string
): Promise<{ success: boolean; postId?: string; postUrl?: string; error?: string }> {
  if (!isLinkedInConfigured()) {
    return {
      success: false,
      error: 'LinkedIn não configurado',
    };
  }

  try {
    // Validações
    if (text.length > 3000) {
      return {
        success: false,
        error: 'Texto muito longo (máximo 3000 caracteres)',
      };
    }

    console.log('[LinkedIn] Baixando imagem...');

    // Passo 1: Baixar a imagem
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      return {
        success: false,
        error: 'Erro ao baixar imagem',
      };
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const imageSize = imageBuffer.byteLength;

    console.log('[LinkedIn] Registrando upload de imagem...');

    // Passo 2: Registrar upload da imagem
    const registerResponse = await fetch(`${LINKEDIN_API_BASE}/assets?action=registerUpload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${LINKEDIN_ACCESS_TOKEN}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({
        registerUploadRequest: {
          recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
          owner: LINKEDIN_PERSON_URN,
          serviceRelationships: [
            {
              relationshipType: 'OWNER',
              identifier: 'urn:li:userGeneratedContent',
            },
          ],
        },
      }),
    });

    if (!registerResponse.ok) {
      const errorData = await registerResponse.json();
      console.error('[LinkedIn] Erro ao registrar upload:', errorData);
      return {
        success: false,
        error: errorData.message || 'Erro ao registrar upload',
      };
    }

    const registerData: LinkedInImageUploadResponse = await registerResponse.json();
    const uploadUrl =
      registerData.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']
        .uploadUrl;
    const asset = registerData.value.asset;

    console.log('[LinkedIn] Fazendo upload da imagem...');

    // Passo 3: Upload da imagem
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${LINKEDIN_ACCESS_TOKEN}`,
        'Content-Type': 'application/octet-stream',
      },
      body: imageBuffer,
    });

    if (!uploadResponse.ok) {
      console.error('[LinkedIn] Erro no upload da imagem');
      return {
        success: false,
        error: 'Erro no upload da imagem',
      };
    }

    console.log('[LinkedIn] Criando post com imagem...');

    // Passo 4: Criar post com a imagem
    const postResponse = await fetch(`${LINKEDIN_API_BASE}/ugcPosts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${LINKEDIN_ACCESS_TOKEN}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({
        author: LINKEDIN_PERSON_URN,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: text,
            },
            shareMediaCategory: 'IMAGE',
            media: [
              {
                status: 'READY',
                description: {
                  text: 'Post do blog',
                },
                media: asset,
                title: {
                  text: 'Prof. Daniel Barral',
                },
              },
            ],
          },
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
        },
      }),
    });

    if (!postResponse.ok) {
      const errorData = await postResponse.json();
      console.error('[LinkedIn] Erro ao criar post:', errorData);
      return {
        success: false,
        error: errorData.message || 'Erro ao criar post',
      };
    }

    const data: LinkedInPostResponse = await postResponse.json();
    const postId = data.id;

    console.log('[LinkedIn] Post com imagem criado com sucesso:', postId);

    const postUrl = `https://www.linkedin.com/feed/update/${postId}`;

    return {
      success: true,
      postId,
      postUrl,
    };
  } catch (error: unknown) {
    console.error('[LinkedIn] Erro inesperado:', error);
    const err = error as Error;
    return {
      success: false,
      error: err.message || 'Erro desconhecido',
    };
  }
}

/**
 * Gera texto otimizado para LinkedIn
 *
 * @param title - Título do post
 * @param excerpt - Resumo do post
 * @param slug - Slug do post (para URL)
 * @returns Texto formatado para LinkedIn
 */
export function generateLinkedInText(title: string, excerpt: string, slug: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://profdanielbarral.com';
  const postUrl = `${baseUrl}/blog/${slug}`;

  // Limitar excerpt para não exceder limite
  const maxExcerptLength = 3000 - title.length - postUrl.length - 200;
  const truncatedExcerpt =
    excerpt.length > maxExcerptLength ? excerpt.substring(0, maxExcerptLength) + '...' : excerpt;

  const text = `📚 ${title}

${truncatedExcerpt}

Leia o artigo completo em:
${postUrl}

#DireitoAdministrativo #Licitacoes #ContratosPublicos #DireitoPublico #Concursos`;

  return text;
}

/**
 * Obter informações do perfil (Person URN)
 *
 * Use esta função para descobrir o Person URN da sua conta
 */
export async function getLinkedInProfile(): Promise<{
  success: boolean;
  personUrn?: string;
  firstName?: string;
  lastName?: string;
  error?: string;
}> {
  if (!LINKEDIN_ACCESS_TOKEN) {
    return {
      success: false,
      error: 'Access Token não configurado',
    };
  }

  try {
    const response = await fetch(`${LINKEDIN_API_BASE}/me`, {
      headers: {
        Authorization: `Bearer ${LINKEDIN_ACCESS_TOKEN}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.message || 'Erro ao obter perfil',
      };
    }

    const data = await response.json();

    return {
      success: true,
      personUrn: `urn:li:person:${data.id}`,
      firstName: data.localizedFirstName,
      lastName: data.localizedLastName,
    };
  } catch (error: unknown) {
    const err = error as Error;
    return {
      success: false,
      error: err.message || 'Erro desconhecido',
    };
  }
}
