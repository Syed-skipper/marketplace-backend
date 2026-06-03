/**
 * Full marketplace seed — populates all major tables with demo data.
 * Run: npx tsx prisma/seed.ts
 */
import {
  InventoryTransactionType,
  NotificationType,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  PrismaClient,
  ProductStatus,
  ShipmentStatus,
} from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const PERMISSIONS = [
  'product:create', 'product:update', 'product:delete', 'product:view',
  'inventory:update', 'inventory:view', 'seller:create', 'seller:approve', 'seller:view',
  'order:view', 'order:update', 'order:create', 'order:cancel',
  'payment:view', 'payment:process', 'admin:dashboard', 'admin:users', 'admin:audit',
  'category:create', 'category:update', 'category:delete',
  'review:create', 'review:moderate', 'cart:manage', 'wishlist:manage',
];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: PERMISSIONS,
  seller: [
    'product:create', 'product:update', 'product:delete', 'product:view',
    'inventory:update', 'inventory:view', 'seller:create', 'seller:view', 'order:view', 'order:update',
  ],
  customer: [
    'product:view', 'order:create', 'order:view', 'order:cancel',
    'cart:manage', 'wishlist:manage', 'review:create', 'seller:create',
  ],
};

async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

async function seedRoles() {
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
  const roleRecords: Record<string, string> = {};

  for (const roleName of ['admin', 'seller', 'customer'] as const) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: {
        name: roleName,
        description: `${roleName.charAt(0).toUpperCase() + roleName.slice(1)} role`,
      },
    });
    roleRecords[roleName] = role.id;
    for (const permName of ROLE_PERMISSIONS[roleName] ?? []) {
      const permId = permissionMap[permName];
      if (!permId) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permId } },
        update: {},
        create: { roleId: role.id, permissionId: permId },
      });
    }
  }
  return roleRecords;
}

async function seedUsers(roleRecords: Record<string, string>) {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@marketplace.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123456';
  const customerEmail = process.env.SEED_CUSTOMER_EMAIL ?? 'customer@marketplace.local';
  const customerPassword = process.env.SEED_CUSTOMER_PASSWORD ?? 'Customer@123456';
  const sellerEmail = process.env.SEED_SELLER_EMAIL ?? 'seller@marketplace.local';
  const sellerPassword = process.env.SEED_SELLER_PASSWORD ?? 'Seller@123456';
  const pendingSellerEmail = 'pending.seller@marketplace.local';

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { status: 'ACTIVE', emailVerified: true },
    create: {
      email: adminEmail,
      passwordHash: await hashPassword(adminPassword),
      firstName: 'Super',
      lastName: 'Admin',
      status: 'ACTIVE',
      emailVerified: true,
    },
  });

  const customerUser = await prisma.user.upsert({
    where: { email: customerEmail },
    update: { status: 'ACTIVE', emailVerified: true },
    create: {
      email: customerEmail,
      passwordHash: await hashPassword(customerPassword),
      firstName: 'Jane',
      lastName: 'Customer',
      phone: '+1-555-0100',
      status: 'ACTIVE',
      emailVerified: true,
    },
  });

  const customer2 = await prisma.user.upsert({
    where: { email: 'alex@marketplace.local' },
    update: { status: 'SUSPENDED', emailVerified: true },
    create: {
      email: 'alex@marketplace.local',
      passwordHash: await hashPassword('Customer@123456'),
      firstName: 'Alex',
      lastName: 'Rivera',
      status: 'ACTIVE',
      emailVerified: true,
    },
  });

  const sellerUser = await prisma.user.upsert({
    where: { email: sellerEmail },
    update: { status: 'ACTIVE', emailVerified: true },
    create: {
      email: sellerEmail,
      passwordHash: await hashPassword(sellerPassword),
      firstName: 'Demo',
      lastName: 'Seller',
      status: 'ACTIVE',
      emailVerified: true,
    },
  });

  const pendingSellerUser = await prisma.user.upsert({
    where: { email: pendingSellerEmail },
    update: {},
    create: {
      email: pendingSellerEmail,
      passwordHash: await hashPassword('Seller@123456'),
      firstName: 'Pending',
      lastName: 'Merchant',
      status: 'ACTIVE',
      emailVerified: true,
    },
  });

  const linkRole = async (userId: string, role: string) => {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId: roleRecords[role] } },
      update: {},
      create: { userId, roleId: roleRecords[role] },
    });
  };

  await linkRole(adminUser.id, 'admin');
  await linkRole(customerUser.id, 'customer');
  await linkRole(customer2.id, 'customer');
  await linkRole(sellerUser.id, 'seller');
  await linkRole(pendingSellerUser.id, 'seller');

  return { adminUser, customerUser, customer2, sellerUser, pendingSellerUser, adminEmail, customerEmail, sellerEmail, customerPassword, sellerPassword, adminPassword };
}

async function seedCategories() {
  const categoryBySlug: Record<string, string> = {};
  const categories = [
    { name: 'Electronics', slug: 'electronics', children: ['Phones', 'Laptops', 'Accessories'] },
    { name: 'Fashion', slug: 'fashion', children: ['Men', 'Women', 'Kids'] },
    { name: 'Home & Kitchen', slug: 'home-kitchen', children: ['Furniture', 'Appliances'] },
  ];

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
        create: { name: childName, slug: childSlug, parentId: parent.id, sortOrder: i },
      });
      categoryBySlug[childSlug] = child.id;
    }
  }
  return categoryBySlug;
}

type ProductSeed = {
  slug: string;
  name: string;
  brand: string;
  categoryId: string;
  description: string;
  price: number;
  discountPrice?: number;
  status: ProductStatus;
  image: string;
  stock?: number;
};

async function seedSellersAndProducts(
  adminId: string,
  sellerUserId: string,
  pendingUserId: string,
  categoryBySlug: Record<string, string>,
) {
  const seller = await prisma.seller.upsert({
    where: { userId: sellerUserId },
    update: { status: 'APPROVED', approvedAt: new Date(), approvedBy: adminId },
    create: {
      userId: sellerUserId,
      businessName: 'TechHub Official',
      businessEmail: 'seller@marketplace.local',
      gstNumber: 'GSTIN123456',
      status: 'APPROVED',
      approvedAt: new Date(),
      approvedBy: adminId,
    },
  });

  await prisma.seller.upsert({
    where: { userId: pendingUserId },
    update: {},
    create: {
      userId: pendingUserId,
      businessName: 'GreenLeaf Organics',
      businessEmail: 'pending.seller@marketplace.local',
      status: 'PENDING',
      documents: { license: 'pending-review.pdf' },
    },
  });

  const products: ProductSeed[] = [
    { slug: 'wireless-noise-cancelling-headphones', name: 'Pro-Series Wireless Noise Cancelling Headphones', brand: 'Audio Master Labs', categoryId: categoryBySlug['electronics-accessories'], description: 'Premium over-ear headphones with adaptive noise cancellation.', price: 299, discountPrice: 249, status: 'ACTIVE', image: 'https://placehold.co/600x600/1a1a2e/eee?text=Headphones' },
    { slug: 'minimalist-titanium-watch', name: 'Minimalist Titanium Quartz Watch', brand: 'Chrono Design', categoryId: categoryBySlug['fashion-men'], description: 'Lightweight titanium case with sapphire crystal.', price: 185, status: 'ACTIVE', image: 'https://placehold.co/600x600/2d3436/eee?text=Watch' },
    { slug: 'instax-mini-camera', name: 'Instax Mini 11 Instant Film Camera', brand: 'Fujifilm', categoryId: categoryBySlug['electronics-phones'], description: 'Compact instant camera with automatic exposure.', price: 69, status: 'ACTIVE', image: 'https://placehold.co/600x600/0984e3/fff?text=Camera' },
    { slug: 'ergonomic-office-chair', name: 'Ergonomic Mesh Office Chair', brand: 'WorkWell', categoryId: categoryBySlug['home-kitchen-furniture'], description: 'Breathable mesh back and lumbar support.', price: 329, discountPrice: 279, status: 'ACTIVE', image: 'https://placehold.co/600x600/6c5ce7/fff?text=Chair' },
    { slug: 'organic-cotton-tshirt', name: 'Organic Cotton Essential T-Shirt', brand: 'EarthWear', categoryId: categoryBySlug['fashion-women'], description: 'GOTS-certified organic cotton.', price: 32, status: 'ACTIVE', image: 'https://placehold.co/600x600/00b894/fff?text=T-Shirt' },
    { slug: 'smart-air-purifier', name: 'Smart HEPA Air Purifier', brand: 'PureAir', categoryId: categoryBySlug['home-kitchen-appliances'], description: 'True HEPA filtration with app control.', price: 199, discountPrice: 169, status: 'ACTIVE', image: 'https://placehold.co/600x600/636e72/fff?text=Purifier' },
    { slug: 'draft-smart-speaker', name: 'Smart Speaker Hub (Draft)', brand: 'Audio Master Labs', categoryId: categoryBySlug['electronics-accessories'], description: 'Awaiting seller publish.', price: 89, status: 'DRAFT', image: 'https://placehold.co/600x600/2d3436/fff?text=Draft' },
    { slug: 'rejected-vape-kit', name: 'Rejected Product Sample', brand: 'Unknown', categoryId: categoryBySlug['electronics-accessories'], description: 'Policy violation sample.', price: 49, status: 'REJECTED', image: 'https://placehold.co/600x600/d63031/fff?text=Rejected' },
  ];

  const productIds: string[] = [];
  const variantBySlug: Record<string, string> = {};

  for (const item of products) {
    const product = await prisma.product.upsert({
      where: { slug: item.slug },
      update: { status: item.status, avgRating: item.status === 'ACTIVE' ? 4.2 : 0, reviewCount: item.status === 'ACTIVE' ? 3 : 0 },
      create: {
        sellerId: seller.id,
        categoryId: item.categoryId,
        name: item.name,
        slug: item.slug,
        description: item.description,
        brand: item.brand,
        status: item.status,
        avgRating: item.status === 'ACTIVE' ? 4.2 : 0,
        reviewCount: item.status === 'ACTIVE' ? 3 : 0,
        images: { create: [{ imageUrl: item.image, sortOrder: 0 }] },
        variants: {
          create: {
            sku: `${item.slug}-default`.toUpperCase().replace(/-/g, '_'),
            price: item.price,
            discountPrice: item.discountPrice,
            color: 'black',
            inventory: { create: { availableStock: item.stock ?? 50, reservedStock: 0 } },
          },
        },
      },
      include: { variants: { include: { inventory: true } } },
    });
    productIds.push(product.id);
    variantBySlug[item.slug] = product.variants[0].id;

    const inv = product.variants[0].inventory;
    if (inv) {
      await prisma.inventoryTransaction.create({
        data: {
          variantId: product.variants[0].id,
          inventoryId: inv.id,
          type: InventoryTransactionType.RESTOCK,
          quantity: 50,
          referenceId: 'seed-restock',
        },
      });
    }
  }

  return { seller, productIds, variantBySlug };
}

async function seedCustomerData(
  customerUserId: string,
  customer2Id: string,
  variantBySlug: Record<string, string>,
  productIds: string[],
) {
  await prisma.address.createMany({
    data: [
      { userId: customerUserId, type: 'SHIPPING', street: '742 Evergreen Terrace', city: 'Springfield', state: 'IL', country: 'USA', postalCode: '62704', isDefault: true },
      { userId: customerUserId, type: 'BILLING', street: '123 Market Street', city: 'San Francisco', state: 'CA', country: 'USA', postalCode: '94105', isDefault: false },
      { userId: customer2Id, type: 'SHIPPING', street: '88 Ocean Drive', city: 'Miami', state: 'FL', country: 'USA', postalCode: '33139', isDefault: true },
    ],
    skipDuplicates: true,
  });

  const cart = await prisma.cart.upsert({
    where: { userId: customerUserId },
    update: {},
    create: { userId: customerUserId },
  });

  const cartVariants = [variantBySlug['wireless-noise-cancelling-headphones'], variantBySlug['organic-cotton-tshirt']];
  for (const variantId of cartVariants) {
    await prisma.cartItem.upsert({
      where: { cartId_variantId: { cartId: cart.id, variantId } },
      update: { quantity: 1 },
      create: { cartId: cart.id, variantId, quantity: 1 },
    });
  }

  let wishlist = await prisma.wishlist.findFirst({ where: { userId: customerUserId } });
  if (!wishlist) {
    wishlist = await prisma.wishlist.create({ data: { userId: customerUserId, name: 'Default' } });
  }

  for (const productId of productIds.slice(0, 3)) {
    await prisma.wishlistItem.upsert({
      where: { wishlistId_productId: { wishlistId: wishlist.id, productId } },
      update: {},
      create: { wishlistId: wishlist.id, productId },
    }).catch(() => undefined);
  }

  for (let i = 0; i < 3; i++) {
    await prisma.review.upsert({
      where: { productId_userId: { productId: productIds[i], userId: customerUserId } },
      update: {},
      create: {
        productId: productIds[i],
        userId: customerUserId,
        rating: 4 + (i % 2),
        comment: ['Great quality!', 'Fast delivery, happy with purchase.', 'Exactly as described.'][i],
        isVerifiedPurchase: true,
      },
    }).catch(() => undefined);
  }
}

async function seedOrders(customerUserId: string, sellerId: string, variantBySlug: Record<string, string>) {
  const shippingAddress = {
    street: '742 Evergreen Terrace',
    city: 'Springfield',
    state: 'IL',
    country: 'USA',
    postalCode: '62704',
  };

  const orders: { number: string; status: OrderStatus; variantSlug: string; qty: number; tracking?: string }[] = [
    { number: 'ORD-SEED-1001', status: 'DELIVERED', variantSlug: 'minimalist-titanium-watch', qty: 1 },
    { number: 'ORD-SEED-1002', status: 'SHIPPED', variantSlug: 'ergonomic-office-chair', qty: 1, tracking: 'TRK-SEED-88421' },
    { number: 'ORD-SEED-1003', status: 'PROCESSING', variantSlug: 'smart-air-purifier', qty: 1 },
  ];

  for (const o of orders) {
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantBySlug[o.variantSlug] },
      include: { product: true },
    });
    if (!variant) continue;

    const price = Number(variant.discountPrice ?? variant.price);
    const subtotal = price * o.qty;
    const tax = subtotal * 0.18;
    const shippingFee = 50;
    const totalAmount = subtotal + tax + shippingFee;

    const order = await prisma.order.upsert({
      where: { orderNumber: o.number },
      update: { status: o.status },
      create: {
        orderNumber: o.number,
        userId: customerUserId,
        status: o.status,
        subtotal,
        tax,
        shippingFee,
        totalAmount,
        shippingAddress,
        items: {
          create: {
            productId: variant.productId,
            sellerId,
            variantId: variant.id,
            price,
            quantity: o.qty,
          },
        },
      },
    });

    const existingPayment = await prisma.payment.findFirst({ where: { orderId: order.id } });
    if (!existingPayment) {
      await prisma.payment.create({
        data: {
          orderId: order.id,
          provider: PaymentProvider.STRIPE,
          transactionId: `pi_seed_${order.id.slice(0, 8)}`,
          status: PaymentStatus.SUCCESS,
          amount: totalAmount,
        },
      });
    }

    if (o.tracking) {
      const existingShipment = await prisma.shipment.findFirst({ where: { orderId: order.id } });
      if (!existingShipment) {
        await prisma.shipment.create({
          data: {
            orderId: order.id,
            trackingNumber: o.tracking,
            carrier: 'FedEx',
            status: o.status === 'DELIVERED' ? ShipmentStatus.DELIVERED : ShipmentStatus.IN_TRANSIT,
          },
        });
      }
    }
  }
}

async function seedNotifications(userIds: string[]) {
  const templates: { type: NotificationType; title: string; message: string }[] = [
    { type: 'ORDER_SHIPPED', title: 'Order shipped', message: 'Your order ORD-SEED-1002 is on the way.' },
    { type: 'ORDER_DELIVERED', title: 'Order delivered', message: 'Your order ORD-SEED-1001 was delivered.' },
    { type: 'SYSTEM', title: 'Welcome to MarketPlace', message: 'Explore curated products from verified sellers.' },
    { type: 'SELLER_APPROVED', title: 'Seller account approved', message: 'Your seller profile is now active.' },
  ];

  for (const userId of userIds) {
    for (const t of templates) {
      await prisma.notification.create({
        data: { userId, type: t.type, title: t.title, message: t.message, isRead: false },
      });
    }
  }
}

async function seedAuditLogs(adminId: string) {
  const targetCount = 10;
  const existing = await prisma.auditLog.count();
  if (existing >= targetCount) return;

  const templates = [
    { action: 'SELLER_APPROVED', entityType: 'seller', entityId: 'seed-seller', daysAgo: 0, hoursAgo: 2 },
    { action: 'PRODUCT_MODERATED', entityType: 'product', entityId: 'seed-product', daysAgo: 0, hoursAgo: 5 },
    { action: 'USER_LOGIN', entityType: 'user', entityId: adminId, daysAgo: 0, hoursAgo: 1 },
    { action: 'ORDER_VIEWED', entityType: 'order', entityId: 'seed-order', daysAgo: 1, hoursAgo: 0 },
    { action: 'PAYMENT_REFUND_INITIATED', entityType: 'payment', entityId: 'seed-pay', daysAgo: 1, hoursAgo: 4 },
    { action: 'CATEGORY_UPDATED', entityType: 'category', entityId: 'seed-cat', daysAgo: 2, hoursAgo: 0 },
    { action: 'SELLER_REJECTED', entityType: 'seller', entityId: 'seed-reject', daysAgo: 3, hoursAgo: 0 },
    { action: 'INVENTORY_ADJUSTED', entityType: 'inventory', entityId: 'seed-inv', daysAgo: 4, hoursAgo: 0 },
    { action: 'USER_SUSPENDED', entityType: 'user', entityId: 'seed-user', daysAgo: 5, hoursAgo: 0 },
    { action: 'ORDER_CANCELLED', entityType: 'order', entityId: 'seed-cancel', daysAgo: 6, hoursAgo: 0 },
  ];

  for (const t of templates) {
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - t.daysAgo);
    createdAt.setHours(createdAt.getHours() - t.hoursAgo);
    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: t.action,
        entityType: t.entityType,
        entityId: t.entityId,
        metadata: { source: 'seed' },
        ipAddress: '127.0.0.1',
        createdAt,
      },
    });
  }
}

async function seedDashboardHistory(
  customerUserId: string,
  customer2Id: string,
  sellerId: string,
  variantBySlug: Record<string, string>,
) {
  const slugs = [
    'wireless-noise-cancelling-headphones',
    'minimalist-titanium-watch',
    'organic-cotton-tshirt',
    'ergonomic-office-chair',
  ];
  const statuses: OrderStatus[] = ['DELIVERED', 'SHIPPED', 'PAID', 'PROCESSING'];
  const now = new Date();
  const shippingAddress = {
    street: '742 Evergreen Terrace',
    city: 'Springfield',
    state: 'IL',
    country: 'USA',
    postalCode: '62704',
  };

  for (let monthOffset = 5; monthOffset >= 0; monthOffset--) {
    for (let i = 0; i < 2; i++) {
      const createdAt = new Date(now.getFullYear(), now.getMonth() - monthOffset, 8 + i * 10, 10, 0, 0);
      const orderNumber = `ORD-HIST-${createdAt.getFullYear()}${String(createdAt.getMonth() + 1).padStart(2, '0')}-${monthOffset}-${i}`;
      const userId = i % 2 === 0 ? customerUserId : customer2Id;
      const slug = slugs[(monthOffset + i) % slugs.length];
      const variantId = variantBySlug[slug];
      if (!variantId) continue;

      const variant = await prisma.productVariant.findUnique({
        where: { id: variantId },
        include: { product: true },
      });
      if (!variant) continue;

      const price = Number(variant.discountPrice ?? variant.price);
      const subtotal = price;
      const tax = subtotal * 0.18;
      const shippingFee = 50;
      const totalAmount = subtotal + tax + shippingFee;
      const status = statuses[(monthOffset + i) % statuses.length];

      const order = await prisma.order.upsert({
        where: { orderNumber },
        update: { status, totalAmount, createdAt },
        create: {
          orderNumber,
          userId,
          status,
          subtotal,
          tax,
          shippingFee,
          totalAmount,
          shippingAddress,
          createdAt,
          items: {
            create: {
              productId: variant.productId,
              sellerId,
              variantId: variant.id,
              price,
              quantity: 1,
            },
          },
        },
      });

      const existingPayment = await prisma.payment.findFirst({ where: { orderId: order.id } });
      if (!existingPayment) {
        await prisma.payment.create({
          data: {
            orderId: order.id,
            provider: PaymentProvider.STRIPE,
            transactionId: `pi_hist_${order.id.slice(0, 8)}`,
            status: PaymentStatus.SUCCESS,
            amount: totalAmount,
            createdAt,
          },
        });
      }
    }
  }

  const approvedAt = new Date(now.getFullYear(), now.getMonth() - 2, 15);
  await prisma.seller.updateMany({
    where: { businessEmail: 'seller@marketplace.local' },
    data: { approvedAt },
  });
}

async function main() {
  console.log('Seeding database (full)...');
  const roleRecords = await seedRoles();
  const users = await seedUsers(roleRecords);
  const categoryBySlug = await seedCategories();
  const { seller, productIds, variantBySlug } = await seedSellersAndProducts(
    users.adminUser.id,
    users.sellerUser.id,
    users.pendingSellerUser.id,
    categoryBySlug,
  );
  await seedCustomerData(users.customerUser.id, users.customer2.id, variantBySlug, productIds);
  await seedOrders(users.customerUser.id, seller.id, variantBySlug);
  await seedDashboardHistory(
    users.customerUser.id,
    users.customer2.id,
    seller.id,
    variantBySlug,
  );
  await seedNotifications([
    users.customerUser.id,
    users.sellerUser.id,
    users.adminUser.id,
  ]);
  await seedAuditLogs(users.adminUser.id);

  console.log('\nSeed completed.\n');
  console.log('--- Demo accounts ---');
  console.log(`Admin:    ${users.adminEmail} / ${users.adminPassword}`);
  console.log(`Customer: ${users.customerEmail} / ${users.customerPassword}`);
  console.log(`Seller:   ${users.sellerEmail} / ${users.sellerPassword}`);
  console.log(`Pending:  pending.seller@marketplace.local / Seller@123456`);
  console.log(`Products: ${productIds.length} (6 active, 1 draft, 1 rejected)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
