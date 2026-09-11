import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminApi } from '@/lib/api/handler';
import { NotFoundError } from '@/lib/errors/api-error';
import { CacheInvalidation } from '@/lib/cache/redis-client';

export const DELETE = withAdminApi<{ id: string }>(async (_request, { params, logger }) => {
  const { id } = params;

  const site = await prisma.recommendedSite.findUnique({ where: { id } });
  if (!site) {
    logger.warn({ siteId: id }, 'Recommended site not found for deletion');
    throw new NotFoundError('Site');
  }

  // SiteToCourse cai junto (onDelete: Cascade no schema).
  await prisma.recommendedSite.delete({ where: { id } });

  logger.info({ siteId: id, title: site.title }, 'Recommended site deleted');

  CacheInvalidation.recommendedSites().catch(console.error);

  return NextResponse.json({ success: true });
});
