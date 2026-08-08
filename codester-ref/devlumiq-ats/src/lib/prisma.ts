import { PrismaClient } from '@prisma/client';

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    'DATABASE_URL is missing. Copy .env.example to .env and set DATABASE_URL to your PostgreSQL connection string.'
  );
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV === 'production') {
  globalForPrisma.prisma = prisma;
}

