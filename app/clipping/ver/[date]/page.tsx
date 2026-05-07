import { notFound } from 'next/navigation';
import { getArchiveEntry, parseSentDateParam } from '@/lib/clipping/archive';
import { verifyViewToken } from '@/lib/clipping/view-token';
import { ClippingArchiveDetail } from '@/components/clipping/ClippingArchiveDetail';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ token?: string }>;
}

export default async function ClippingViewPage({ params, searchParams }: PageProps) {
  const { date } = await params;
  const { token } = await searchParams;

  if (!token) notFound();
  if (!verifyViewToken(token, date)) notFound();

  const sentDate = parseSentDateParam(date);
  if (!sentDate) notFound();

  const entry = await getArchiveEntry(sentDate);
  if (!entry) notFound();

  return (
    <ClippingArchiveDetail
      referenceDate={entry.referenceDate}
      acordaos={entry.acordaos}
      missingIds={entry.missingIds}
      showSiteHeader
    />
  );
}
