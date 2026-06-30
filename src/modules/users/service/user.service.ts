import { AddressType, Prisma } from '@prisma/client';
import { prisma } from '../../../config/database/prisma.client';
import { DomainError, NotFoundError } from '../../../common/exceptions/errors';
import { reverseGeocodeCoordinates } from './geocoding.service';

type AddressInput = {
  type: AddressType;
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  isDefault?: boolean;
};

export class UserService {
  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        status: true,
        emailVerified: true,
        createdAt: true,
        roles: { include: { role: { select: { name: true } } } },
        addresses: { orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] },
      },
    });
    if (!user) throw new NotFoundError('User not found');
    return user;
  }

  async updateProfile(
    userId: string,
    data: { firstName?: string; lastName?: string; phone?: string | null },
  ) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.firstName !== undefined && { firstName: data.firstName }),
        ...(data.lastName !== undefined && { lastName: data.lastName }),
        ...(data.phone !== undefined && { phone: data.phone }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        status: true,
        emailVerified: true,
        createdAt: true,
        roles: { include: { role: { select: { name: true } } } },
      },
    });
    return user;
  }

  async listAddresses(userId: string) {
    return prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async getAddress(userId: string, addressId: string) {
    const address = await prisma.address.findFirst({
      where: { id: addressId, userId },
    });
    if (!address) throw new NotFoundError('Address not found');
    return address;
  }

  private async clearDefaultAddresses(userId: string, tx: Prisma.TransactionClient) {
    await tx.address.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });
  }

  async createAddress(userId: string, data: AddressInput) {
    return prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await this.clearDefaultAddresses(userId, tx);
      }
      const isFirst = (await tx.address.count({ where: { userId } })) === 0;
      return tx.address.create({
        data: {
          userId,
          type: data.type,
          street: data.street,
          city: data.city,
          state: data.state,
          country: data.country,
          postalCode: data.postalCode,
          isDefault: data.isDefault ?? isFirst,
        },
      });
    });
  }

  async updateAddress(userId: string, addressId: string, data: Partial<AddressInput>) {
    await this.getAddress(userId, addressId);
    return prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await this.clearDefaultAddresses(userId, tx);
      }
      return tx.address.update({
        where: { id: addressId },
        data: {
          ...(data.type !== undefined && { type: data.type }),
          ...(data.street !== undefined && { street: data.street }),
          ...(data.city !== undefined && { city: data.city }),
          ...(data.state !== undefined && { state: data.state }),
          ...(data.country !== undefined && { country: data.country }),
          ...(data.postalCode !== undefined && { postalCode: data.postalCode }),
          ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
        },
      });
    });
  }

  async deleteAddress(userId: string, addressId: string) {
    await this.getAddress(userId, addressId);
    await prisma.address.delete({ where: { id: addressId } });
    const remaining = await prisma.address.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    if (remaining.length && !remaining.some((a) => a.isDefault)) {
      await prisma.address.update({
        where: { id: remaining[0].id },
        data: { isDefault: true },
      });
    }
  }

  async reverseGeocode(latitude: number, longitude: number) {
    try {
      return await reverseGeocodeCoordinates(latitude, longitude);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not resolve address';
      throw new DomainError(message);
    }
  }
}
