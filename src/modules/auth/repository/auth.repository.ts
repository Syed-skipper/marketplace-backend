import { prisma } from '../../../config/database/prisma.client';
import { Prisma } from '@prisma/client';

export class AuthRepository {
  findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
        seller: true,
      },
    });
  }

  findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: {
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
      },
    });
  }

  createUser(data: Prisma.UserCreateInput) {
    return prisma.user.create({ data });
  }

  updateUser(id: string, data: Prisma.UserUpdateInput) {
    return prisma.user.update({ where: { id }, data });
  }

  createRefreshToken(data: {
    userId: string;
    tokenHash: string;
    device?: string;
    userAgent?: string;
    ipAddress?: string;
    expiresAt: Date;
  }) {
    return prisma.refreshToken.create({ data });
  }

  findRefreshToken(tokenHash: string) {
    return prisma.refreshToken.findFirst({
      where: { tokenHash, revoked: false, expiresAt: { gt: new Date() } },
      include: { user: true },
    });
  }

  revokeRefreshToken(id: string) {
    return prisma.refreshToken.update({ where: { id }, data: { revoked: true } });
  }

  revokeAllUserTokens(userId: string) {
    return prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    });
  }

  revokeTokenByHash(tokenHash: string) {
    return prisma.refreshToken.updateMany({
      where: { tokenHash },
      data: { revoked: true },
    });
  }
}
