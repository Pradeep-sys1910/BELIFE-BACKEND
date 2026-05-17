import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.category.createMany({
    data: [
      { name: 'Sustainable Living', slug: 'sustainable-living', icon: '🌿' },
      { name: 'Eco Travel', slug: 'eco-travel', icon: '✈️' },
      { name: 'Green Living', slug: 'green-living', icon: '🌱' },
      { name: 'Sustainability', slug: 'sustainability', icon: '♻️' },
      { name: 'Renewable Energy', slug: 'renewable-energy', icon: '☀️' },
      { name: 'Water Conservation', slug: 'water-conservation', icon: '💧' },
    ],
    skipDuplicates: true,
  });
  console.log('🌱 Seeded successfully');
}

main().finally(() => prisma.$disconnect());