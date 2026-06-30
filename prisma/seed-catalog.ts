import {
  InventoryTransactionType,
  PrismaClient,
  ProductStatus,
} from '@prisma/client';

const PRODUCTS_PER_CATEGORY = 100;

type CategorySeedConfig = {
  slug: string;
  label: string;
  productTypes: string[];
  brands: string[];
  adjectives: string[];
  priceMin: number;
  priceMax: number;
  imageHue: string;
};

const CATEGORY_CONFIGS: CategorySeedConfig[] = [
  {
    slug: 'electronics-phones',
    label: 'Phones',
    productTypes: ['Smartphone', '5G Phone', 'Camera Phone', 'Budget Phone', 'Flagship Phone'],
    brands: ['Samsung', 'Apple', 'OnePlus', 'Xiaomi', 'Realme', 'Vivo', 'Oppo', 'Nokia'],
    adjectives: ['Pro', 'Ultra', 'Max', 'Plus', 'Lite', 'Edge', 'Note', 'Prime'],
    priceMin: 4999,
    priceMax: 89999,
    imageHue: '0984e3',
  },
  {
    slug: 'electronics-laptops',
    label: 'Laptops',
    productTypes: ['Ultrabook', 'Gaming Laptop', 'Business Laptop', 'Chromebook', 'Workstation'],
    brands: ['Dell', 'HP', 'Lenovo', 'Asus', 'Acer', 'Apple', 'MSI', 'Razer'],
    adjectives: ['Pro', 'Air', 'Book', 'Studio', 'Elite', 'Flex', 'Swift', 'Nitro'],
    priceMin: 24999,
    priceMax: 149999,
    imageHue: '6c5ce7',
  },
  {
    slug: 'electronics-accessories',
    label: 'Accessories',
    productTypes: ['Earbuds', 'Headphones', 'Power Bank', 'Charger', 'Cable', 'Smart Watch', 'Speaker'],
    brands: ['boAt', 'Sony', 'JBL', 'Anker', 'Noise', 'Logitech', 'Razer', 'Belkin'],
    adjectives: ['Wireless', 'Bluetooth', 'Fast', 'Premium', 'Compact', 'Pro', 'Mini', 'Ultra'],
    priceMin: 199,
    priceMax: 14999,
    imageHue: '1a1a2e',
  },
  {
    slug: 'fashion-men',
    label: 'Men',
    productTypes: ['T-Shirt', 'Shirt', 'Jeans', 'Jacket', 'Sneakers', 'Formal Shoes', 'Watch', 'Belt'],
    brands: ['Roadster', 'Peter England', 'Allen Solly', 'Levis', 'Puma', 'Nike', 'Fossil', 'H&M'],
    adjectives: ['Classic', 'Slim Fit', 'Casual', 'Premium', 'Essential', 'Sport', 'Urban', 'Heritage'],
    priceMin: 299,
    priceMax: 7999,
    imageHue: '2d3436',
  },
  {
    slug: 'fashion-women',
    label: 'Women',
    productTypes: ['Kurti', 'Dress', 'Handbag', 'Heels', 'Saree', 'Top', 'Leggings', 'Jewellery Set'],
    brands: ['Biba', 'W', 'FabIndia', 'Zara', 'H&M', 'Mango', 'Libas', 'Global Desi'],
    adjectives: ['Floral', 'Elegant', 'Casual', 'Festive', 'Boho', 'Classic', 'Trendy', 'Premium'],
    priceMin: 349,
    priceMax: 9999,
    imageHue: 'e84393',
  },
  {
    slug: 'fashion-kids',
    label: 'Kids',
    productTypes: ['T-Shirt', 'Shorts', 'School Shoes', 'Backpack', 'Frock', 'Toy Set', 'Cap', 'Sweater'],
    brands: ['Hopscotch', 'UCB Kids', 'Mothercare', 'FirstCry', 'Max Kids', 'Pantaloons Junior', 'Disney', 'Barbie'],
    adjectives: ['Fun', 'Comfy', 'Cute', 'Playful', 'Soft', 'Bright', 'Smart', 'Active'],
    priceMin: 199,
    priceMax: 3999,
    imageHue: '00b894',
  },
  {
    slug: 'home-kitchen-furniture',
    label: 'Furniture',
    productTypes: ['Sofa', 'Dining Table', 'Office Chair', 'Bookshelf', 'Bed Frame', 'Wardrobe', 'Coffee Table', 'Mattress'],
    brands: ['Wakefit', 'Urban Ladder', 'IKEA', 'Nilkamal', 'Godrej Interio', 'Pepperfry', 'Durian', 'Sleepwell'],
    adjectives: ['Ergonomic', 'Modern', 'Compact', 'Luxury', 'Wooden', 'Foldable', 'Premium', 'Classic'],
    priceMin: 1999,
    priceMax: 59999,
    imageHue: '636e72',
  },
  {
    slug: 'home-kitchen-appliances',
    label: 'Appliances',
    productTypes: ['Mixer Grinder', 'Air Fryer', 'Microwave', 'Refrigerator', 'Washing Machine', 'Vacuum Cleaner', 'Water Purifier', 'Induction Cooktop'],
    brands: ['Philips', 'Bosch', 'LG', 'Samsung', 'Prestige', 'Bajaj', 'Kent', 'IFB'],
    adjectives: ['Smart', 'Energy Saver', 'Compact', 'Digital', 'Premium', 'Automatic', 'Pro', 'Eco'],
    priceMin: 1499,
    priceMax: 69999,
    imageHue: 'fdcb6e',
  },
];

function pick<T>(items: T[], index: number) {
  return items[index % items.length];
}

function randomPrice(min: number, max: number, seed: number) {
  const range = max - min;
  return Math.round(min + ((seed * 7919) % range));
}

const GALLERY_VIEW_LABELS = ['Front', 'Side', 'Back', 'Detail'] as const;

export async function backfillCatalogProductGalleries(prisma: PrismaClient) {
  const products = await prisma.product.findMany({
    where: { slug: { startsWith: 'catalog-' } },
    include: { images: { orderBy: { sortOrder: 'asc' } } },
  });

  let updated = 0;

  for (const product of products) {
    if (product.images.length >= GALLERY_VIEW_LABELS.length) continue;

    const baseUrl = product.images[0]?.imageUrl ?? '';
    const hueMatch = baseUrl.match(/placehold\.co\/600x600\/([a-f0-9]+)\//i);
    const hue = hueMatch?.[1] ?? 'cccccc';
    const textMatch = baseUrl.match(/text=([^&]+)/);
    const baseText = textMatch ? decodeURIComponent(textMatch[1].replace(/\+/g, ' ')) : 'Product';

    for (let i = product.images.length; i < GALLERY_VIEW_LABELS.length; i++) {
      await prisma.productImage.create({
        data: {
          productId: product.id,
          imageUrl: `https://placehold.co/600x600/${hue}/fff?text=${encodeURIComponent(`${baseText} ${GALLERY_VIEW_LABELS[i]}`)}`,
          sortOrder: i,
        },
      });
    }

    updated += 1;
  }

  console.log(`Gallery backfill: updated ${updated} catalog products with extra images.`);
  return updated;
}

export async function seedBulkCatalogProducts(
  prisma: PrismaClient,
  sellerId: string,
  categoryBySlug: Record<string, string>,
) {
  const existingBulk = await prisma.product.count({
    where: { slug: { startsWith: 'catalog-' } },
  });
  if (existingBulk >= PRODUCTS_PER_CATEGORY * CATEGORY_CONFIGS.length) {
    console.log(`Catalog seed skipped (${existingBulk} bulk products already present).`);
    return { bulkCount: existingBulk, variantBySlug: {} as Record<string, string> };
  }

  let created = 0;
  const variantBySlug: Record<string, string> = {};
  const batch: Array<ReturnType<typeof buildProductCreate>> = [];

  function buildProductCreate(config: CategorySeedConfig, index: number) {
    const n = index + 1;
    const brand = pick(config.brands, index);
    const type = pick(config.productTypes, index + 2);
    const adj = pick(config.adjectives, index + 3);
    const name = `${brand} ${adj} ${type} ${String(n).padStart(3, '0')}`;
    const slug = `catalog-${config.slug}-${String(n).padStart(3, '0')}`;
    const price = randomPrice(config.priceMin, config.priceMax, n + index);
    const hasDiscount = n % 3 === 0;
    const discountPrice = hasDiscount ? Math.round(price * (0.65 + (n % 5) * 0.05)) : undefined;
    const avgRating = Number((3 + ((n * 7) % 20) / 10).toFixed(1));
    const reviewCount = 5 + ((n * 13) % 450);
    const stock = 10 + ((n * 17) % 190);

    return {
      slug,
      data: {
        sellerId,
        categoryId: categoryBySlug[config.slug],
        name,
        slug,
        description: `Premium ${type.toLowerCase()} from ${brand}. Built for everyday use with reliable performance and great value.`,
        brand,
        status: 'ACTIVE' as ProductStatus,
        avgRating,
        reviewCount,
        images: {
          create: GALLERY_VIEW_LABELS.map((label, i) => ({
            imageUrl: `https://placehold.co/600x600/${config.imageHue}/fff?text=${encodeURIComponent(`${type} ${label}`)}`,
            sortOrder: i,
          })),
        },
        variants: {
          create: {
            sku: slug.toUpperCase().replace(/-/g, '_'),
            price,
            discountPrice,
            color: pick(['black', 'white', 'blue', 'silver', 'red'], index),
            inventory: { create: { availableStock: stock, reservedStock: 0 } },
          },
        },
      },
    };
  }

  for (const config of CATEGORY_CONFIGS) {
    if (!categoryBySlug[config.slug]) continue;
    for (let i = 0; i < PRODUCTS_PER_CATEGORY; i++) {
      batch.push(buildProductCreate(config, i));
      if (batch.length >= 20) {
        for (const item of batch) {
          const product = await prisma.product.upsert({
            where: { slug: item.slug },
            update: {
              status: 'ACTIVE',
              avgRating: item.data.avgRating,
              reviewCount: item.data.reviewCount,
            },
            create: item.data,
            include: { variants: { include: { inventory: true } } },
          });
          variantBySlug[item.slug] = product.variants[0].id;
          const inv = product.variants[0].inventory;
          if (inv) {
            await prisma.inventoryTransaction.create({
              data: {
                variantId: product.variants[0].id,
                inventoryId: inv.id,
                type: InventoryTransactionType.RESTOCK,
                quantity: inv.availableStock,
                referenceId: 'seed-bulk-restock',
              },
            }).catch(() => undefined);
          }
          created += 1;
        }
        batch.length = 0;
        console.log(`  … ${created} catalog products seeded`);
      }
    }
  }

  for (const item of batch) {
    const product = await prisma.product.upsert({
      where: { slug: item.slug },
      update: {
        status: 'ACTIVE',
        avgRating: item.data.avgRating,
        reviewCount: item.data.reviewCount,
      },
      create: item.data,
      include: { variants: { include: { inventory: true } } },
    });
    variantBySlug[item.slug] = product.variants[0].id;
    created += 1;
  }

  console.log(`Catalog seed complete: ${created} products across ${CATEGORY_CONFIGS.length} categories.`);
  await backfillCatalogProductGalleries(prisma);
  return { bulkCount: created, variantBySlug };
}
