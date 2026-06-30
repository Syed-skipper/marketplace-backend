/**
 * Adds gallery images to catalog products that only have one image.
 * Run: npm run db:seed:galleries
 */
import { PrismaClient } from '@prisma/client';
import { backfillCatalogProductGalleries } from './seed-catalog';

const prisma = new PrismaClient();

async function main() {
  await backfillCatalogProductGalleries(prisma);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
