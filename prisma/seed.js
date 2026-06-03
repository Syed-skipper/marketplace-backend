"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt_1 = __importDefault(require("bcrypt"));
const prisma = new client_1.PrismaClient();
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
const ROLE_PERMISSIONS = {
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
    const permissionRecords = await Promise.all(PERMISSIONS.map((name) => prisma.permission.upsert({
        where: { name },
        update: {},
        create: { name, description: `Permission: ${name}` },
    })));
    const permissionMap = Object.fromEntries(permissionRecords.map((p) => [p.name, p.id]));
    const roles = ['admin', 'seller', 'customer'];
    const roleRecords = {};
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
            if (!permId)
                continue;
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
    const passwordHash = await bcrypt_1.default.hash(adminPassword, 12);
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
    for (const cat of categories) {
        const parent = await prisma.category.upsert({
            where: { slug: cat.slug },
            update: {},
            create: { name: cat.name, slug: cat.slug, sortOrder: 0 },
        });
        for (let i = 0; i < cat.children.length; i++) {
            const childName = cat.children[i];
            const childSlug = `${cat.slug}-${childName.toLowerCase().replace(/\s+/g, '-')}`;
            await prisma.category.upsert({
                where: { slug: childSlug },
                update: {},
                create: {
                    name: childName,
                    slug: childSlug,
                    parentId: parent.id,
                    sortOrder: i,
                },
            });
        }
    }
    console.log('Seed completed.');
    console.log(`Super Admin: ${adminEmail}`);
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map