import { PrismaClient } from '@prisma/client';

// Singleton pattern para o Prisma Client
// Previne múltiplas instâncias durante hot-reload no desenvolvimento
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaPromise: Promise<void> | undefined;
};

// Create PrismaClient with proper error handling
const createPrismaClient = () => {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

  // Connect eagerly and store the promise
  const connectionPromise = client.$connect().catch((err) => {
    console.error('Failed to connect to database:', err);
    throw err;
  });

  return { client, connectionPromise };
};

// Get or create the singleton
if (!globalForPrisma.prisma) {
  const { client, connectionPromise } = createPrismaClient();
  globalForPrisma.prisma = client;
  globalForPrisma.prismaPromise = connectionPromise;
}

export const prisma = globalForPrisma.prisma;

// Ensure connection before using in API routes
export const ensureConnection = async () => {
  if (globalForPrisma.prismaPromise) {
    await globalForPrisma.prismaPromise;
  }
  return prisma;
};
