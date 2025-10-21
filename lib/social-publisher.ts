/**
 * Orquestrador de publicações em redes sociais
 *
 * Responsável por:
 * - Gerar imagem Open Graph
 * - Publicar no Instagram
 * - Publicar no LinkedIn
 * - Salvar registros no banco de dados
 * - Gerenciar retry em caso de falhas
 */

import { prisma } from './prisma';
import {
  createInstagramPost,
  generateInstagramCaption,
  isInstagramConfigured,
} from './instagram';
import {
  createLinkedInImagePost,
  generateLinkedInText,
  isLinkedInConfigured,
} from './linkedin';

/**
 * Resultado de publicação individual
 */
interface PublicationResult {
  platform: string;
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
}

/**
 * Resultado geral de publicações
 */
interface SocialPublishResult {
  success: boolean;
  results: PublicationResult[];
  imageUrl: string;
  message?: string;
}

/**
 * Publica um post do blog em todas as redes sociais configuradas
 *
 * @param blogPostId - ID do post do blog
 * @param platforms - Plataformas para publicar (padrão: todas configuradas)
 * @returns Resultado das publicações
 */
export async function publishToSocialMedia(
  blogPostId: string,
  platforms: ('instagram' | 'linkedin')[] = ['instagram', 'linkedin']
): Promise<SocialPublishResult> {
  try {
    console.log(`[SocialPublisher] Iniciando publicação do post ${blogPostId}...`);

    // 1. Buscar post do blog
    const post = await prisma.blogPost.findUnique({
      where: { id: blogPostId },
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        isPublished: true,
        autoPublishSocial: true,
      },
    });

    if (!post) {
      return {
        success: false,
        results: [],
        imageUrl: '',
        message: 'Post não encontrado',
      };
    }

    if (!post.isPublished) {
      return {
        success: false,
        results: [],
        imageUrl: '',
        message: 'Post não está publicado',
      };
    }

    if (!post.autoPublishSocial) {
      return {
        success: false,
        results: [],
        imageUrl: '',
        message: 'Publicação automática desabilitada para este post',
      };
    }

    // 2. Gerar URL da imagem OG
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://profdanielbarral.com';
    const imageUrl = `${baseUrl}/api/og/${post.slug}`;

    console.log(`[SocialPublisher] Imagem OG: ${imageUrl}`);

    // 3. Publicar em cada plataforma
    const results: PublicationResult[] = [];

    // Instagram
    if (platforms.includes('instagram') && isInstagramConfigured()) {
      console.log('[SocialPublisher] Publicando no Instagram...');

      const caption = generateInstagramCaption(post.title, post.excerpt, post.slug);

      const instagramResult = await createInstagramPost(imageUrl, caption);

      // Salvar no banco
      await prisma.socialMediaPost.create({
        data: {
          blogPostId: post.id,
          platform: 'instagram',
          postId: instagramResult.postId,
          postUrl: instagramResult.permalink,
          status: instagramResult.success ? 'published' : 'failed',
          error: instagramResult.error,
          publishedAt: instagramResult.success ? new Date() : null,
        },
      });

      results.push({
        platform: 'instagram',
        success: instagramResult.success,
        postId: instagramResult.postId,
        postUrl: instagramResult.permalink,
        error: instagramResult.error,
      });

      console.log(
        `[SocialPublisher] Instagram: ${instagramResult.success ? 'Sucesso' : 'Falhou'}`
      );
    } else if (platforms.includes('instagram')) {
      console.log('[SocialPublisher] Instagram não configurado - pulando');
    }

    // LinkedIn
    if (platforms.includes('linkedin') && isLinkedInConfigured()) {
      console.log('[SocialPublisher] Publicando no LinkedIn...');

      const linkedinText = generateLinkedInText(post.title, post.excerpt, post.slug);

      const linkedinResult = await createLinkedInImagePost(linkedinText, imageUrl);

      // Salvar no banco
      await prisma.socialMediaPost.create({
        data: {
          blogPostId: post.id,
          platform: 'linkedin',
          postId: linkedinResult.postId,
          postUrl: linkedinResult.postUrl,
          status: linkedinResult.success ? 'published' : 'failed',
          error: linkedinResult.error,
          publishedAt: linkedinResult.success ? new Date() : null,
        },
      });

      results.push({
        platform: 'linkedin',
        success: linkedinResult.success,
        postId: linkedinResult.postId,
        postUrl: linkedinResult.postUrl,
        error: linkedinResult.error,
      });

      console.log(
        `[SocialPublisher] LinkedIn: ${linkedinResult.success ? 'Sucesso' : 'Falhou'}`
      );
    } else if (platforms.includes('linkedin')) {
      console.log('[SocialPublisher] LinkedIn não configurado - pulando');
    }

    // 4. Atualizar campo socialMediaImage no post
    if (results.length > 0) {
      await prisma.blogPost.update({
        where: { id: post.id },
        data: { socialMediaImage: imageUrl },
      });
    }

    // 5. Determinar sucesso geral
    const allSuccessful = results.length > 0 && results.every((r) => r.success);
    const someSuccessful = results.some((r) => r.success);

    return {
      success: allSuccessful,
      results,
      imageUrl,
      message: allSuccessful
        ? 'Publicado em todas as redes sociais com sucesso!'
        : someSuccessful
          ? 'Publicado parcialmente. Verifique os erros.'
          : 'Falha ao publicar em todas as redes.',
    };
  } catch (error) {
    console.error('[SocialPublisher] Erro inesperado:', error);
    return {
      success: false,
      results: [],
      imageUrl: '',
      message: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

/**
 * Republica posts que falharam anteriormente
 *
 * @param socialMediaPostId - ID do registro de publicação
 * @param maxRetries - Número máximo de tentativas (padrão: 3)
 */
export async function retryFailedPost(
  socialMediaPostId: string,
  maxRetries: number = 3
): Promise<{ success: boolean; error?: string }> {
  try {
    // Buscar registro de publicação
    const socialPost = await prisma.socialMediaPost.findUnique({
      where: { id: socialMediaPostId },
      include: {
        blogPost: {
          select: {
            id: true,
            slug: true,
            title: true,
            excerpt: true,
            socialMediaImage: true,
          },
        },
      },
    });

    if (!socialPost) {
      return { success: false, error: 'Registro não encontrado' };
    }

    if (socialPost.status === 'published') {
      return { success: false, error: 'Post já foi publicado com sucesso' };
    }

    if (socialPost.retryCount >= maxRetries) {
      return {
        success: false,
        error: `Número máximo de tentativas (${maxRetries}) atingido`,
      };
    }

    console.log(
      `[SocialPublisher] Tentando republicar no ${socialPost.platform} (tentativa ${socialPost.retryCount + 1}/${maxRetries})...`
    );

    const imageUrl = socialPost.blogPost.socialMediaImage || '';

    let result: { success: boolean; postId?: string; postUrl?: string; error?: string };

    // Publicar na plataforma correspondente
    if (socialPost.platform === 'instagram') {
      const caption = generateInstagramCaption(
        socialPost.blogPost.title,
        socialPost.blogPost.excerpt,
        socialPost.blogPost.slug
      );
      result = await createInstagramPost(imageUrl, caption);
    } else if (socialPost.platform === 'linkedin') {
      const text = generateLinkedInText(
        socialPost.blogPost.title,
        socialPost.blogPost.excerpt,
        socialPost.blogPost.slug
      );
      result = await createLinkedInImagePost(text, imageUrl);
    } else {
      return { success: false, error: 'Plataforma não suportada' };
    }

    // Atualizar registro
    await prisma.socialMediaPost.update({
      where: { id: socialMediaPostId },
      data: {
        status: result.success ? 'published' : 'failed',
        postId: result.postId,
        postUrl: result.postUrl || result.postId,
        error: result.error,
        retryCount: { increment: 1 },
        publishedAt: result.success ? new Date() : null,
      },
    });

    return {
      success: result.success,
      error: result.error,
    };
  } catch (error) {
    console.error('[SocialPublisher] Erro ao tentar republicar:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

/**
 * Obtém estatísticas de publicações em redes sociais
 */
export async function getSocialMediaStats(): Promise<{
  total: number;
  published: number;
  failed: number;
  pending: number;
  byPlatform: {
    platform: string;
    total: number;
    published: number;
    failed: number;
  }[];
}> {
  const [total, published, failed, pending, byPlatform] = await Promise.all([
    prisma.socialMediaPost.count(),
    prisma.socialMediaPost.count({ where: { status: 'published' } }),
    prisma.socialMediaPost.count({ where: { status: 'failed' } }),
    prisma.socialMediaPost.count({ where: { status: 'pending' } }),
    prisma.socialMediaPost.groupBy({
      by: ['platform'],
      _count: true,
    }),
  ]);

  const platformStats = await Promise.all(
    byPlatform.map(async (p) => ({
      platform: p.platform,
      total: p._count,
      published: await prisma.socialMediaPost.count({
        where: { platform: p.platform, status: 'published' },
      }),
      failed: await prisma.socialMediaPost.count({
        where: { platform: p.platform, status: 'failed' },
      }),
    }))
  );

  return {
    total,
    published,
    failed,
    pending,
    byPlatform: platformStats,
  };
}
