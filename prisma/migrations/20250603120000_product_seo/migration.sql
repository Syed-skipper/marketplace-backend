-- AlterTable
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "meta_title" VARCHAR(70);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "meta_description" VARCHAR(320);
