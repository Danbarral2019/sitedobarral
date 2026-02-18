import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

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
