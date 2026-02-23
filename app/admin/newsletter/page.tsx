/**
 * Newsletter Admin Page (Server Component)
 * Analytics dashboard + subscriber list
 */

import { ResourceListContainer } from '@/components/admin/ResourceListContainer';
import { fetchNewsletterSubscribersPaginated } from '@/lib/newsletter';
import { newsletterConfig, NewsletterHeader } from './config';
import { prisma } from '@/lib/prisma';
import { NewsletterAnalytics } from './analytics';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

async function getAnalyticsData() {
  const sends = await prisma.newsletterSend.findMany({
    orderBy: { sentAt: 'desc' },
  });

  const totalSent = sends.reduce((sum, s) => sum + s.totalSent, 0);
  const totalOpens = sends.reduce((sum, s) => sum + s.opens, 0);
  const totalClicks = sends.reduce((sum, s) => sum + s.clicks, 0);
  const totalFailed = sends.reduce((sum, s) => sum + s.totalFailed, 0);

  const avgOpenRate = totalSent > 0 ? (totalOpens / totalSent) * 100 : 0;
  const avgClickRate = totalSent > 0 ? (totalClicks / totalSent) * 100 : 0;

  // Volume por semana (ultimas 12 semanas)
  const twelveWeeksAgo = new Date();
  twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);

  const recentSends = sends.filter(s => s.sentAt >= twelveWeeksAgo);

  const weeklyVolume: Array<{ week: string; count: number }> = [];
  for (let i = 11; i >= 0; i--) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - (i + 1) * 7);
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() - i * 7);

    const weekLabel = `${weekStart.getDate().toString().padStart(2, '0')}/${(weekStart.getMonth() + 1).toString().padStart(2, '0')}`;

    const count = recentSends
      .filter(s => s.sentAt >= weekStart && s.sentAt < weekEnd)
      .reduce((sum, s) => sum + s.totalSent, 0);

    weeklyVolume.push({ week: weekLabel, count });
  }

  return {
    totalSent,
    totalFailed,
    avgOpenRate: Math.round(avgOpenRate * 10) / 10,
    avgClickRate: Math.round(avgClickRate * 10) / 10,
    recentSends: sends.slice(0, 10).map(s => ({
      id: s.id,
      type: s.type,
      subject: s.subject,
      sentAt: s.sentAt.toISOString(),
      totalSent: s.totalSent,
      opens: s.opens,
      clicks: s.clicks,
      openRate: s.totalSent > 0 ? Math.round((s.opens / s.totalSent) * 1000) / 10 : 0,
      clickRate: s.totalSent > 0 ? Math.round((s.clicks / s.totalSent) * 1000) / 10 : 0,
    })),
    weeklyVolume,
  };
}

export default async function NewsletterPage({ searchParams }: PageProps) {
  const analytics = await getAnalyticsData();

  return (
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <NewsletterHeader />

          <NewsletterAnalytics data={analytics} />

          <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 overflow-hidden">
            <ResourceListContainer
              searchParams={await searchParams}
              fetchData={fetchNewsletterSubscribersPaginated}
              config={newsletterConfig}
            />
          </div>
        </div>
      </div>
  );
}

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Newsletter | Admin',
  description: 'Gerenciar assinantes da newsletter',
};
