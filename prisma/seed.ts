import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const PERMISSIONS = [
  'product:create',
  'product:update',
  'product:delete',
  'product:view',
  'inventory:update',
  'inventory:view',
  'seller:create',
  'seller:approve',
  'seller:view',
  'order:view',
  'order:update',
  'order:create',
  'order:cancel',
  'payment:view',
  'payment:process',
  'admin:dashboard',
  'admin:users',
  'admin:audit',
  'category:create',
  'category:update',
  'category:delete',
  'review:create',
  'review:moderate',
  'cart:manage',
  'wishlist:manage',
];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: PERMISSIONS,
  seller: [
    'product:create',
    'product:update',
    'product:delete',
    'product:view',
    'inventory:update',
    'inventory:view',
    'seller:create',
    'seller:view',
    'order:view',
    'order:update',
  ],
  customer: [
    'product:view',
    'order:create',
    'order:view',
    'order:cancel',
    'cart:manage',
    'wishlist:manage',
    'review:create',
    'seller:create',
  ],
};

async function main() {
  console.log('Seeding database...');

  const permissionRecords = await Promise.all(
    PERMISSIONS.map((name) =>
      prisma.permission.upsert({
        where: { name },
        update: {},
        create: { name, description: `Permission: ${name}` },
      }),
    ),
  );

  const permissionMap = Object.fromEntries(permissionRecords.map((p) => [p.name, p.id]));

  const roles = ['admin', 'seller', 'customer'] as const;
  const roleRecords: Record<string, string> = {};

  for (const roleName of roles) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: {
        name: roleName,
        description: `${roleName.charAt(0).toUpperCase() + roleName.slice(1)} role`,
      },
    });
    roleRecords[roleName] = role.id;

    const perms = ROLE_PERMISSIONS[roleName] ?? [];
    for (const permName of perms) {
      const permId = permissionMap[permName];
      if (!permId) continue;
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId: permId },
        },
        update: {},
        create: { roleId: role.id, permissionId: permId },
      });
    }
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@marketplace.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123456';
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      firstName: 'Super',
      lastName: 'Admin',
      status: 'ACTIVE',
      emailVerified: true,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: { userId: adminUser.id, roleId: roleRecords.admin },
    },
    update: {},
    create: { userId: adminUser.id, roleId: roleRecords.admin },
  });

  const categories = [
    { name: 'Electronics', slug: 'electronics', children: ['Phones', 'Laptops', 'Accessories'] },
    { name: 'Fashion', slug: 'fashion', children: ['Men', 'Women', 'Kids'] },
    { name: 'Home & Kitchen', slug: 'home-kitchen', children: ['Furniture', 'Appliances'] },
  ];

  const categoryBySlug: Record<string, string> = {};

  for (const cat of categories) {
    const parent = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: { name: cat.name, slug: cat.slug, sortOrder: 0 },
    });
    categoryBySlug[cat.slug] = parent.id;

    for (let i = 0; i < cat.children.length; i++) {
      const childName = cat.children[i];
      const childSlug = `${cat.slug}-${childName.toLowerCase().replace(/\s+/g, '-')}`;
      const child = await prisma.category.upsert({
        where: { slug: childSlug },
        update: {},
        create: {
          name: childName,
          slug: childSlug,
          parentId: parent.id,
          sortOrder: i,
        },
      });
      categoryBySlug[childSlug] = child.id;
    }
  }

  const sellerEmail = process.env.SEED_SELLER_EMAIL ?? 'seller@marketplace.local';
  const sellerPassword = process.env.SEED_SELLER_PASSWORD ?? 'Seller@123456';
  const sellerHash = await bcrypt.hash(sellerPassword, 12);

  const sellerUser = await prisma.user.upsert({
    where: { email: sellerEmail },
    update: {},
    create: {
      email: sellerEmail,
      passwordHash: sellerHash,
      firstName: 'Demo',
      lastName: 'Seller',
      status: 'ACTIVE',
      emailVerified: true,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: sellerUser.id, roleId: roleRecords.seller } },
    update: {},
    create: { userId: sellerUser.id, roleId: roleRecords.seller },
  });

  const seller = await prisma.seller.upsert({
    where: { userId: sellerUser.id },
    update: { status: 'APPROVED', approvedAt: new Date(), approvedBy: adminUser.id },
    create: {
      userId: sellerUser.id,
      businessName: 'TechHub Official',
      businessEmail: sellerEmail,
      status: 'APPROVED',
      approvedAt: new Date(),
      approvedBy: adminUser.id,
    },
  });

  const sampleProducts = [
    {
      slug: 'wireless-noise-cancelling-headphones',
      name: 'Pro-Series Wireless Noise Cancelling Headphones',
      brand: 'Audio Master Labs',
      categoryId: categoryBySlug['electronics-accessories'],
      description:
        'Premium over-ear headphones with adaptive noise cancellation and 40-hour battery life.',
      price: 299,
      discountPrice: 249,
      image: 'https://placehold.co/600x600/1a1a2e/eee?text=Headphones',
    },
    {
      slug: 'minimalist-titanium-watch',
      name: 'Minimalist Titanium Quartz Watch',
      brand: 'Chrono Design',
      categoryId: categoryBySlug['fashion-men'],
      description: 'Lightweight titanium case with sapphire crystal and Japanese quartz movement.',
      price: 185,
      image: 'https://placehold.co/600x600/2d3436/eee?text=Watch',
    },
    {
      slug: 'instax-mini-camera',
      name: 'Instax Mini 11 Instant Film Camera',
      brand: 'Fujifilm',
      categoryId: categoryBySlug['electronics-phones'],
      description: 'Compact instant camera with automatic exposure and selfie mirror.',
      price: 69,
      image: 'https://placehold.co/600x600/0984e3/fff?text=Camera',
    },
    {
      slug: 'ergonomic-office-chair',
      name: 'Ergonomic Mesh Office Chair',
      brand: 'WorkWell',
      categoryId: categoryBySlug['home-kitchen-furniture'],
      description: 'Breathable mesh back, lumbar support, and adjustable armrests for all-day comfort.',
      price: 329,
      discountPrice: 279,
      image: 'https://placehold.co/600x600/6c5ce7/fff?text=Chair',
    },
    {
      slug: 'organic-cotton-tshirt',
      name: 'Organic Cotton Essential T-Shirt',
      brand: 'EarthWear',
      categoryId: categoryBySlug['fashion-women'],
      description: 'Soft GOTS-certified organic cotton in a relaxed everyday fit.',
      price: 32,
      image: 'https://placehold.co/600x600/00b894/fff?text=T-Shirt',
    },
    {
      slug: 'smart-air-purifier',
      name: 'Smart HEPA Air Purifier',
      brand: 'PureAir',
      categoryId: categoryBySlug['home-kitchen-appliances'],
      description: 'True HEPA filtration with app control and quiet night mode.',
      price: 199,
      discountPrice: 169,
      image: 'https://placehold.co/600x600/636e72/fff?text=Purifier',
    },
  ];

  for (const item of sampleProducts) {
    await prisma.product.upsert({
      where: { slug: item.slug },
      update: { status: 'ACTIVE' },
      create: {
        sellerId: seller.id,
        categoryId: item.categoryId,
        name: item.name,
        slug: item.slug,
        description: item.description,
        brand: item.brand,
        status: 'ACTIVE',
        images: {
          create: [{ imageUrl: item.image, sortOrder: 0 }],
        },
        variants: {
          create: {
            sku: `${item.slug}-default`.toUpperCase().replace(/-/g, '_'),
            price: item.price,
            discountPrice: item.discountPrice,
            color: 'black',
            inventory: { create: { availableStock: 50, reservedStock: 0 } },
          },
        },
      },
    });
  }

  console.log('Seed completed.');
  console.log(`Super Admin: ${adminEmail}`);
  console.log(`Demo Seller: ${sellerEmail} / ${sellerPassword}`);
  console.log(`Sample products: ${sampleProducts.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
