import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Nothing to seed.');
}

main().finally(() => prisma.$disconnect());
