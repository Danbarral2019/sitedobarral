import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

// Auto-load .env.local when running scripts outside Next.js
if (!process.env.DATABASE_URL && !process.env.NEXT_RUNTIME) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('dotenv').config({ path: '.env.local' });
  } catch {
    // dotenv not available — ignore
  }
}

// Singleton pattern para o Prisma Client
// Previne múltiplas instâncias durante hot-reload no desenvolvimento
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

if (!globalForPrisma.prisma) {
  const adapter = new PrismaNeon({
    connectionString: process.env.DATABASE_URL!,
  });

  globalForPrisma.prisma = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

export const prisma = globalForPrisma.prisma;

// Graceful disconnect on process termination
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
});
