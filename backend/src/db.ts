// backend/src/db.ts
import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __PRISMA__: PrismaClient | undefined;
}

// Reaproveita em dev/hot-reload; cria novo em prod
export const prisma: PrismaClient = globalThis.__PRISMA__ ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__PRISMA__ = prisma;
}

// (Opcional) desligar graciosamente
process.once('SIGINT', async () => {
  try { await prisma.$disconnect(); } finally { process.exit(0); }
});
process.once('SIGTERM', async () => {
  try { await prisma.$disconnect(); } finally { process.exit(0); }
});

export default prisma;
