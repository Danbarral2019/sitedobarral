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

const ADMIN_USER_ID_PREFIX = 'admin:';

export function isAdminRecipientId(userId: string): boolean {
  return userId.startsWith(ADMIN_USER_ID_PREFIX);
}

export function getAdminRecipientsFromEnv(
  envCsv: string | undefined = process.env.CLIPPING_ADMIN_RECIPIENTS,
): ClippingRecipient[] {
  if (!envCsv) return [];
  const out: ClippingRecipient[] = [];
  const seen = new Set<string>();
  for (const raw of envCsv.split(',')) {
    const entry = raw.trim();
    if (!entry) continue;
    const match = entry.match(/^(.*?)<([^>]+)>$/);
    const name = match ? match[1].trim().replace(/^"|"$/g, '') : '';
    const email = (match ? match[2] : entry).trim();
    if (!email || !email.includes('@')) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ userId: `${ADMIN_USER_ID_PREFIX}${key}`, email, name: name || email });
  }
  return out;
}

export function mergeAdminRecipients(
  recipients: ClippingRecipient[],
  admins: ClippingRecipient[],
): ClippingRecipient[] {
  const seen = new Set(recipients.map((r) => r.email.toLowerCase()));
  const out = [...recipients];
  for (const a of admins) {
    const key = a.email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a);
  }
  return out;
}
