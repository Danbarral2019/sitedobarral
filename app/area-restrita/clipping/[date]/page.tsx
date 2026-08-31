import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { verifyToken } from '@/lib/auth';
import {
 getArchiveEntry,
 parseSentDateParam,
 userIsEligibleForClipping,
} from '@/lib/clipping/archive';
import { ClippingArchiveDetail } from '@/components/clipping/ClippingArchiveDetail';

export const dynamic = 'force-dynamic';

interface PageProps {
 params: Promise<{ date: string }>;
}

export default async function ClippingArchiveDetailPage({ params }: PageProps) {
 const { date } = await params;
 const cookieStore = await cookies();
 const token = cookieStore.get('auth-token')?.value;
 const next = `/area-restrita/clipping/${date}`;
 if (!token) redirect(`/login?next=${encodeURIComponent(next)}`);
 const payload = await verifyToken(token);
 if (!payload) redirect(`/login?next=${encodeURIComponent(next)}`);

 const eligible = await userIsEligibleForClipping(payload.userId);
 if (!eligible) redirect('/area-restrita/clipping');

 const sentDate = parseSentDateParam(date);
 if (!sentDate) notFound();

 const entry = await getArchiveEntry(sentDate);
 if (!entry) notFound();

 return (
 <ClippingArchiveDetail
 referenceDate={entry.referenceDate}
 groups={entry.groups}
 missingIds={entry.missingIds}
 backHref="/area-restrita/clipping"
 />
 );
}
