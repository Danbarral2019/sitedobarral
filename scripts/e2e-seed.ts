import bcrypt from 'bcryptjs';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '@prisma/client';
import {
  E2E_COURSE_ID,
  E2E_IDS,
  E2E_USERS,
  resolveE2EDatabaseUrl,
} from '../e2e/fixtures/database';

export default async function seedE2E(): Promise<void> {
  const databaseUrl = resolveE2EDatabaseUrl();
  const prisma = new PrismaClient({
    adapter: new PrismaNeon({ connectionString: databaseUrl }),
  });
  const passwordHash = await bcrypt.hash('E2E-only-password', 4);

  try {
    await Promise.all(
      Object.values(E2E_USERS).map((user) =>
        prisma.user.upsert({
          where: { id: user.userId },
          create: {
            id: user.userId,
            email: user.email,
            name: user.name,
            role: user.role,
            passwordHash,
            emailVerified: true,
          },
          update: {
            email: user.email,
            name: user.name,
            role: user.role,
            passwordHash,
            emailVerified: true,
          },
        }),
      ),
    );

    await prisma.enrollment.upsert({
      where: {
        userId_courseId: {
          userId: E2E_IDS.activeUser,
          courseId: E2E_COURSE_ID,
        },
      },
      create: {
        id: E2E_IDS.activeEnrollment,
        userId: E2E_IDS.activeUser,
        courseId: E2E_COURSE_ID,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      update: {
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        isLifetime: false,
      },
    });

    await prisma.enrollment.upsert({
      where: {
        userId_courseId: {
          userId: E2E_IDS.expiredUser,
          courseId: E2E_COURSE_ID,
        },
      },
      create: {
        id: E2E_IDS.expiredEnrollment,
        userId: E2E_IDS.expiredUser,
        courseId: E2E_COURSE_ID,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
      update: {
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        isLifetime: false,
      },
    });

    await prisma.document.upsert({
      where: { id: E2E_IDS.commonDocument },
      create: {
        id: E2E_IDS.commonDocument,
        title: 'Documento comum E2E',
        type: 'pdf',
        url: 'https://example.com/e2e-common.pdf',
        category: 'apostila',
        isPublic: false,
        isCommon: true,
      },
      update: {
        url: 'https://example.com/e2e-common.pdf',
        isPublic: false,
        isCommon: true,
        courseId: null,
      },
    });

    await prisma.document.upsert({
      where: { id: E2E_IDS.privateDocument },
      create: {
        id: E2E_IDS.privateDocument,
        title: 'Documento de curso E2E',
        type: 'pdf',
        url: 'https://example.com/e2e-private.pdf',
        category: 'apostila',
        courseId: E2E_COURSE_ID,
        isPublic: false,
        isCommon: false,
      },
      update: {
        url: 'https://example.com/e2e-private.pdf',
        courseId: E2E_COURSE_ID,
        isPublic: false,
        isCommon: false,
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}
