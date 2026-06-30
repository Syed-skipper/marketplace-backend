import {
  CardBrand,
  CouponStatus,
  CouponType,
  PrismaClient,
  RewardTransactionType,
  UserCouponStatus,
} from '@prisma/client';

export async function seedWallet(prisma: PrismaClient, customerUserId: string) {
  const now = new Date();
  const inSixMonths = new Date(now);
  inSixMonths.setMonth(inSixMonths.getMonth() + 6);
  const started = new Date(now);
  started.setMonth(started.getMonth() - 1);

  const coupons = [
    {
      code: 'WELCOME10',
      title: '10% off your order',
      description: 'Save 10% on orders above ₹499. Max discount ₹200.',
      type: CouponType.PERCENTAGE,
      value: 10,
      minOrderAmount: 499,
      maxDiscount: 200,
    },
    {
      code: 'FLAT200',
      title: '₹200 flat discount',
      description: 'Flat ₹200 off on orders above ₹1,499.',
      type: CouponType.FLAT,
      value: 200,
      minOrderAmount: 1499,
      maxDiscount: null,
    },
    {
      code: 'FREESHIP',
      title: 'Free shipping',
      description: 'Free delivery on your next order above ₹299.',
      type: CouponType.FLAT,
      value: 99,
      minOrderAmount: 299,
      maxDiscount: null,
    },
    {
      code: 'MEGA25',
      title: '25% mega sale',
      description: 'Limited-time 25% off. Max discount ₹500.',
      type: CouponType.PERCENTAGE,
      value: 25,
      minOrderAmount: 999,
      maxDiscount: 500,
    },
  ] as const;

  for (const c of coupons) {
    await prisma.coupon.upsert({
      where: { code: c.code },
      update: {},
      create: {
        code: c.code,
        title: c.title,
        description: c.description,
        type: c.type,
        value: c.value,
        minOrderAmount: c.minOrderAmount,
        maxDiscount: c.maxDiscount,
        startsAt: started,
        expiresAt: inSixMonths,
        status: CouponStatus.ACTIVE,
      },
    });
  }

  const welcome = await prisma.coupon.findUniqueOrThrow({ where: { code: 'WELCOME10' } });
  const flat = await prisma.coupon.findUniqueOrThrow({ where: { code: 'FLAT200' } });

  await prisma.userCoupon.upsert({
    where: { userId_couponId: { userId: customerUserId, couponId: welcome.id } },
    update: {},
    create: { userId: customerUserId, couponId: welcome.id, status: UserCouponStatus.AVAILABLE },
  });

  await prisma.userCoupon.upsert({
    where: { userId_couponId: { userId: customerUserId, couponId: flat.id } },
    update: {},
    create: {
      userId: customerUserId,
      couponId: flat.id,
      status: UserCouponStatus.REDEEMED,
      redeemedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 5),
    },
  });

  const existingCards = await prisma.savedPaymentMethod.count({ where: { userId: customerUserId } });
  if (existingCards === 0) {
    await prisma.savedPaymentMethod.createMany({
      data: [
        {
          userId: customerUserId,
          label: 'Personal Visa',
          brand: CardBrand.VISA,
          last4: '4242',
          expMonth: 12,
          expYear: now.getFullYear() + 2,
          cardholderName: 'Demo Customer',
          isDefault: true,
          providerToken: 'tok_demo_visa_4242',
        },
        {
          userId: customerUserId,
          label: 'Work Mastercard',
          brand: CardBrand.MASTERCARD,
          last4: '5555',
          expMonth: 8,
          expYear: now.getFullYear() + 3,
          cardholderName: 'Demo Customer',
          isDefault: false,
          providerToken: 'tok_demo_mc_5555',
        },
      ],
    });
  }

  const existingRewards = await prisma.rewardAccount.findUnique({ where: { userId: customerUserId } });
  if (!existingRewards) {
    const account = await prisma.rewardAccount.create({
      data: {
        userId: customerUserId,
        points: 1250,
        lifetimeEarned: 1850,
      },
    });

    await prisma.rewardTransaction.createMany({
      data: [
        {
          accountId: account.id,
          type: RewardTransactionType.EARN,
          points: 250,
          description: 'Welcome bonus',
        },
        {
          accountId: account.id,
          type: RewardTransactionType.EARN,
          points: 500,
          description: 'Order #MV-1042 completed',
          referenceId: 'order_mv_1042',
        },
        {
          accountId: account.id,
          type: RewardTransactionType.EARN,
          points: 600,
          description: 'Order #MV-1038 completed',
          referenceId: 'order_mv_1038',
        },
        {
          accountId: account.id,
          type: RewardTransactionType.EARN,
          points: 500,
          description: 'Product review bonus',
        },
        {
          accountId: account.id,
          type: RewardTransactionType.REDEEM,
          points: -600,
          description: 'Redeemed at checkout',
          referenceId: 'order_mv_1050',
        },
      ],
    });
  }
}
