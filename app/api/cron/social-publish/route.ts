import { prisma } from '@/lib/prisma';
import { withCronRoute } from '@/lib/cron-telemetry';
import { publishToSocialMedia, retryFailedPost } from '@/lib/social-publisher';
import { apiLogger } from '@/lib/logger';

const MAX_NEW_PER_RUN = 5;
const MAX_RETRIES_PER_RUN = 3;
const MAX_RETRY_COUNT = 3;
const PLATFORMS: Array<'instagram' | 'linkedin'> = ['instagram', 'linkedin'];

/**
 * Cron de publicação automática em redes sociais.
 *
 * A cada execução:
 *   1. Retenta posts com status 'failed' e retryCount < MAX_RETRY_COUNT (até MAX_RETRIES_PER_RUN)
 *   2. Publica BlogPosts novos (autoPublishSocial=true, isPublished=true) sem SocialMediaPost
 *      em todas as plataformas (até MAX_NEW_PER_RUN)
 *
 * Limites são conservadores para respeitar rate limits do Instagram/LinkedIn.
 */
export const GET = withCronRoute('social-publish', async () => {
  let itemsFound = 0;
  let itemsNew = 0;
  let itemsError = 0;

  // 1) Retry de posts com falha
  const failed = await prisma.socialMediaPost.findMany({
    where: {
      status: 'failed',
      retryCount: { lt: MAX_RETRY_COUNT },
    },
    orderBy: { createdAt: 'asc' },
    take: MAX_RETRIES_PER_RUN,
    select: { id: true, blogPostId: true, platform: true },
  });

  itemsFound += failed.length;

  for (const post of failed) {
    try {
      const result = await retryFailedPost(post.id);
      if (result.success) itemsNew++;
      else itemsError++;
    } catch (err) {
      itemsError++;
      apiLogger.error(
        { socialPostId: post.id, blogPostId: post.blogPostId, platform: post.platform, err },
        'social-publish retry falhou',
      );
    }
  }

  // 2) Publicação inicial: BlogPosts publicados, autoPublishSocial=true, sem nenhum SocialMediaPost
  const candidates = await prisma.blogPost.findMany({
    where: {
      isPublished: true,
      autoPublishSocial: true,
      socialMediaPosts: { none: {} },
    },
    orderBy: { publishedAt: 'desc' },
    take: MAX_NEW_PER_RUN,
    select: { id: true, slug: true, title: true },
  });

  itemsFound += candidates.length;

  for (const post of candidates) {
    try {
      const result = await publishToSocialMedia(post.id, PLATFORMS);
      const successCount = result.results.filter((r) => r.success).length;
      itemsNew += successCount;
      itemsError += result.results.length - successCount;
    } catch (err) {
      itemsError += PLATFORMS.length;
      apiLogger.error(
        { blogPostId: post.id, slug: post.slug, err },
        'social-publish publicação inicial falhou',
      );
    }
  }

  return {
    itemsFound,
    itemsNew,
    itemsError,
    metadata: {
      retriedFailed: failed.length,
      publishedNew: candidates.length,
    },
  };
});
