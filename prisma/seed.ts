import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.category.createMany({
    data: [
      { name: 'Sustainable Living', slug: 'sustainable-living', icon: '🌱', description: 'Tips and guides for a sustainable everyday life' },
      { name: 'Eco Travel', slug: 'eco-travel', icon: '✈️', description: 'Travel the world while minimizing your carbon footprint' },
      { name: 'Recycling', slug: 'recycling', icon: '♻️', description: 'How to recycle better and reduce waste' },
      { name: 'Renewable Energy', slug: 'renewable-energy', icon: '⚡', description: 'Solar, wind and clean energy guides' },
      { name: 'Water Conservation', slug: 'water-conservation', icon: '💧', description: 'Save water, protect our future' },
      { name: 'Green Transport', slug: 'green-transport', icon: '🚲', description: 'Eco-friendly ways to get around' },
      { name: 'Sustainable Food', slug: 'sustainable-food', icon: '🥗', description: 'Eat well, tread lightly on the planet' },
      { name: 'Eco Fashion', slug: 'eco-fashion', icon: '👗', description: 'Style without harming the planet' },
      { name: 'Zero Waste', slug: 'zero-waste', icon: '🗑️', description: 'Practical guides to producing less waste every day' },
      { name: 'Organic Gardening', slug: 'organic-gardening', icon: '🌻', description: 'Grow your own food naturally and sustainably' },
      { name: 'Climate Action', slug: 'climate-action', icon: '🌍', description: 'Understanding and fighting climate change' },
      { name: 'Mindful Wellness', slug: 'mindful-wellness', icon: '🧘', description: 'Holistic health for body, mind and planet' },
      { name: 'Green Home', slug: 'green-home', icon: '🏡', description: 'Make your home energy efficient and eco-friendly' },
      { name: 'Wildlife & Nature', slug: 'wildlife-nature', icon: '🦋', description: 'Protecting biodiversity and natural habitats' },
      { name: 'Sustainable Business', slug: 'sustainable-business', icon: '💼', description: 'Green entrepreneurship and ethical business' },
      { name: 'Ocean Conservation', slug: 'ocean-conservation', icon: '🌊', description: 'Protecting our oceans and marine life' },
      { name: 'Air Quality', slug: 'air-quality', icon: '🍃', description: 'Clean air tips and pollution reduction' },
      { name: 'Eco Parenting', slug: 'eco-parenting', icon: '👶', description: 'Raising the next generation of eco-warriors' },
      { name: 'Fitness & Wellness', slug: 'fitness-wellness', icon: '💪', description: 'Natural fitness, gym alternatives and healthy movement' },
    ],
    skipDuplicates: true,
  });
  console.log('🌱 Seeded successfully');
}

main().finally(() => prisma.$disconnect());