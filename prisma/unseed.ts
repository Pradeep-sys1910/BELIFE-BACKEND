/**
 * Removes all BeLife demo seed data.
 *
 *  Run: npm run unseed
 *
 * Deletes every user with an `@seed.belife.site` email. All of their blogs, comments,
 * likes, follows, threads, groups, campaigns, challenges, etc. cascade-delete with them
 * (see onDelete: Cascade in schema.prisma). Real user data is untouched. Categories are
 * shared and intentionally left in place.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SEED_DOMAIN = 'seed.belife.site';

async function main() {
  const targets = await prisma.user.count({ where: { email: { endsWith: `@${SEED_DOMAIN}` } } });
  if (!targets) {
    console.log('✨ No seed users found — nothing to remove.');
    return;
  }
  const deleted = await prisma.user.deleteMany({ where: { email: { endsWith: `@${SEED_DOMAIN}` } } });
  console.log(`🧹 Removed ${deleted.count} seed users and all their content (cascade).`);
}

main()
  .catch((e) => { console.error('❌ Unseed failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
