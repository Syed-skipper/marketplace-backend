import {
  CardBrand,
  CouponStatus,
  CouponType,
  Prisma,
  RewardTransactionType,
  UserCouponStatus,
} from '@prisma/client';
import { prisma } from '../../../config/database/prisma.client';
import { ConflictError, DomainError, NotFoundError } from '../../../common/exceptions/errors';

type SavedCardInput = {
  label?: string;
  brand: CardBrand;
  last4: string;
  expMonth: number;
  expYear: number;
  cardholderName?: string;
  isDefault?: boolean;
};

type UpdateSavedCardInput = {
  label?: string;
  isDefault?: boolean;
};

function serializeCoupon(coupon: {
  id: string;
  code: string;
  title: string;
  description: string | null;
  type: CouponType;
  value: Prisma.Decimal;
  minOrderAmount: Prisma.Decimal | null;
  maxDiscount: Prisma.Decimal | null;
  startsAt: Date;
  expiresAt: Date;
  status: CouponStatus;
}) {
  return {
    id: coupon.id,
    code: coupon.code,
    title: coupon.title,
    description: coupon.description,
    type: coupon.type,
    value: Number(coupon.value),
    minOrderAmount: coupon.minOrderAmount != null ? Number(coupon.minOrderAmount) : null,
    maxDiscount: coupon.maxDiscount != null ? Number(coupon.maxDiscount) : null,
    startsAt: coupon.startsAt.toISOString(),
    expiresAt: coupon.expiresAt.toISOString(),
    status: coupon.status,
  };
}

export class WalletService {
  async listSavedCards(userId: string) {
    return prisma.savedPaymentMethod.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        label: true,
        brand: true,
        last4: true,
        expMonth: true,
        expYear: true,
        cardholderName: true,
        isDefault: true,
        createdAt: true,
      },
    });
  }

  async createSavedCard(userId: string, data: SavedCardInput) {
    const now = new Date();
    const expiry = new Date(data.expYear, data.expMonth - 1, 1);
    if (expiry < now) {
      throw new DomainError('Card has expired');
    }

    const existing = await prisma.savedPaymentMethod.findFirst({
      where: { userId, brand: data.brand, last4: data.last4, expMonth: data.expMonth, expYear: data.expYear },
    });
    if (existing) {
      throw new ConflictError('This card is already saved');
    }

    return prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.savedPaymentMethod.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }

      const isFirst = (await tx.savedPaymentMethod.count({ where: { userId } })) === 0;

      return tx.savedPaymentMethod.create({
        data: {
          userId,
          label: data.label,
          brand: data.brand,
          last4: data.last4,
          expMonth: data.expMonth,
          expYear: data.expYear,
          cardholderName: data.cardholderName,
          isDefault: data.isDefault ?? isFirst,
          providerToken: `tok_demo_${Date.now()}`,
        },
        select: {
          id: true,
          label: true,
          brand: true,
          last4: true,
          expMonth: true,
          expYear: true,
          cardholderName: true,
          isDefault: true,
          createdAt: true,
        },
      });
    });
  }

  async updateSavedCard(userId: string, cardId: string, data: UpdateSavedCardInput) {
    const card = await prisma.savedPaymentMethod.findFirst({
      where: { id: cardId, userId },
    });
    if (!card) throw new NotFoundError('Saved card not found');

    return prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.savedPaymentMethod.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.savedPaymentMethod.update({
        where: { id: cardId },
        data: {
          ...(data.label !== undefined && { label: data.label }),
          ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
        },
        select: {
          id: true,
          label: true,
          brand: true,
          last4: true,
          expMonth: true,
          expYear: true,
          cardholderName: true,
          isDefault: true,
          createdAt: true,
        },
      });
    });
  }

  async deleteSavedCard(userId: string, cardId: string) {
    const card = await prisma.savedPaymentMethod.findFirst({
      where: { id: cardId, userId },
    });
    if (!card) throw new NotFoundError('Saved card not found');

    await prisma.$transaction(async (tx) => {
      await tx.savedPaymentMethod.delete({ where: { id: cardId } });

      if (card.isDefault) {
        const next = await tx.savedPaymentMethod.findFirst({
          where: { userId },
          orderBy: { createdAt: 'desc' },
        });
        if (next) {
          await tx.savedPaymentMethod.update({
            where: { id: next.id },
            data: { isDefault: true },
          });
        }
      }
    });
  }

  private async getOrCreateRewardAccount(userId: string) {
    let account = await prisma.rewardAccount.findUnique({
      where: { userId },
      include: {
        transactions: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });

    if (!account) {
      account = await prisma.$transaction(async (tx) => {
        const created = await tx.rewardAccount.create({
          data: {
            userId,
            points: 250,
            lifetimeEarned: 250,
          },
        });
        await tx.rewardTransaction.create({
          data: {
            accountId: created.id,
            type: RewardTransactionType.EARN,
            points: 250,
            description: 'Welcome bonus',
          },
        });
        return tx.rewardAccount.findUniqueOrThrow({
          where: { id: created.id },
          include: {
            transactions: { orderBy: { createdAt: 'desc' }, take: 20 },
          },
        });
      });
    }

    return account;
  }

  async getRewards(userId: string) {
    const account = await this.getOrCreateRewardAccount(userId);
    return {
      points: account.points,
      lifetimeEarned: account.lifetimeEarned,
      transactions: account.transactions.map((t) => ({
        id: t.id,
        type: t.type,
        points: t.points,
        description: t.description,
        referenceId: t.referenceId,
        createdAt: t.createdAt.toISOString(),
      })),
    };
  }

  async listUserCoupons(userId: string) {
    const rows = await prisma.userCoupon.findMany({
      where: { userId },
      include: { coupon: true },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });

    const now = new Date();
    return rows.map((row) => {
      const expired = row.coupon.expiresAt < now || row.coupon.status !== CouponStatus.ACTIVE;
      const effectiveStatus =
        row.status === UserCouponStatus.AVAILABLE && expired
          ? UserCouponStatus.EXPIRED
          : row.status;

      return {
        id: row.id,
        status: effectiveStatus,
        redeemedAt: row.redeemedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        coupon: serializeCoupon(row.coupon),
      };
    });
  }

  async listAvailableCoupons(userId: string) {
    const now = new Date();
    const claimed = await prisma.userCoupon.findMany({
      where: { userId },
      select: { couponId: true },
    });
    const claimedIds = claimed.map((c) => c.couponId);

    const coupons = await prisma.coupon.findMany({
      where: {
        status: CouponStatus.ACTIVE,
        startsAt: { lte: now },
        expiresAt: { gt: now },
        ...(claimedIds.length > 0 && { id: { notIn: claimedIds } }),
      },
      orderBy: { expiresAt: 'asc' },
    });

    return coupons.map(serializeCoupon);
  }

  async claimCoupon(userId: string, code: string) {
    const normalized = code.trim().toUpperCase();
    const coupon = await prisma.coupon.findUnique({ where: { code: normalized } });
    if (!coupon) throw new NotFoundError('Coupon not found');

    const now = new Date();
    if (coupon.status !== CouponStatus.ACTIVE) {
      throw new DomainError('This coupon is no longer active');
    }
    if (coupon.startsAt > now) {
      throw new DomainError('This coupon is not yet available');
    }
    if (coupon.expiresAt <= now) {
      throw new DomainError('This coupon has expired');
    }
    if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
      throw new DomainError('This coupon has reached its usage limit');
    }

    const existing = await prisma.userCoupon.findUnique({
      where: { userId_couponId: { userId, couponId: coupon.id } },
    });
    if (existing) {
      throw new ConflictError('You have already claimed this coupon');
    }

    const userCoupon = await prisma.$transaction(async (tx) => {
      const created = await tx.userCoupon.create({
        data: { userId, couponId: coupon.id },
        include: { coupon: true },
      });
      await tx.coupon.update({
        where: { id: coupon.id },
        data: { usedCount: { increment: 1 } },
      });
      return created;
    });

    return {
      id: userCoupon.id,
      status: userCoupon.status,
      redeemedAt: null,
      createdAt: userCoupon.createdAt.toISOString(),
      coupon: serializeCoupon(userCoupon.coupon),
    };
  }
}
