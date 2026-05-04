import { prisma } from '@/lib/prisma';

export interface ClippingRecipient {
  userId: string;
  email: string;
  name: string;
}

export async function getClippingRecipients(): Promise<ClippingRecipient[]> {
  const now = new Date();

  const users = await prisma.user.findMany({
    where: {
      clippingOptOut: false,
      emailVerified: true,
      OR: [
        {
          subscriptions: {
            some: {
              status: 'active',
              currentPeriodEnd: { gt: now },
            },
          },
        },
        {
          enrollments: {
            some: {
              OR: [
                { isLifetime: true },
                { expiresAt: { gt: now } },
              ],
            },
          },
        },
      ],
    },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  const seen = new Set<string>();
  const out: ClippingRecipient[] = [];
  for (const u of users) {
    const emailKey = u.email.toLowerCase();
    if (seen.has(emailKey)) continue;
    seen.add(emailKey);
    out.push({ userId: u.id, email: u.email, name: u.name });
  }
  return out;
}

export function applyBetaFilter(
  recipients: ClippingRecipient[],
  betaEmailsCsv: string | undefined,
): ClippingRecipient[] {
  if (!betaEmailsCsv) return recipients;
  const allow = new Set(
    betaEmailsCsv
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
  if (allow.size === 0) return recipients;
  return recipients.filter((r) => allow.has(r.email.toLowerCase()));
}
