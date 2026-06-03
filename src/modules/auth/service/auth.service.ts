import jwt from 'jsonwebtoken';
import { env } from '../../../config/env';
import { AuthRepository } from '../repository/auth.repository';
import {
  AuthenticationError,
  ConflictError,
  DomainError,
  NotFoundError,
} from '../../../common/exceptions/errors';
import { comparePassword, generateSecureToken, hashPassword, hashToken } from '../../../common/utils/hash.util';
import { loadUserPermissions } from '../../../common/middlewares/auth.middleware';
import { eventBus } from '../../../common/events/event-bus';
import { DomainEventType } from '../../../common/events/domain-events';
import { authLogger, auditLogger } from '../../../common/utils/logger';
import type { DeviceInfo, TokenPair } from '../types/auth.types';
import { prisma } from '../../../config/database/prisma.client';
import { ROLES } from '../../../common/constants/permissions';

export class AuthService {
  constructor(private readonly repo = new AuthRepository()) {}

  private signAccessToken(userId: string, email: string, roles: string[], permissions: string[]): string {
    return jwt.sign({ sub: userId, email, roles, permissions }, env.JWT_ACCESS_SECRET, {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    });
  }

  private signRefreshToken(userId: string): string {
    return jwt.sign({ sub: userId, type: 'refresh' }, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    });
  }

  private async issueTokens(
    userId: string,
    email: string,
    device?: DeviceInfo,
  ): Promise<TokenPair> {
    const { roles, permissions } = await loadUserPermissions(userId);
    const accessToken = this.signAccessToken(userId, email, roles, permissions);
    const refreshToken = this.signRefreshToken(userId);
    const tokenHash = hashToken(refreshToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.repo.createRefreshToken({
      userId,
      tokenHash,
      device: device?.device,
      userAgent: device?.userAgent,
      ipAddress: device?.ipAddress,
      expiresAt,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60,
    };
  }

  async register(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }) {
    const existing = await this.repo.findByEmail(data.email);
    if (existing) throw new ConflictError('Email already registered');

    const passwordHash = await hashPassword(data.password);
    const emailVerifyToken = generateSecureToken();

    const user = await this.repo.createUser({
      email: data.email.toLowerCase(),
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      emailVerifyToken,
      roles: {
        create: {
          role: { connect: { name: ROLES.CUSTOMER } },
        },
      },
    });

    await eventBus.publish({
      type: DomainEventType.USER_REGISTERED,
      payload: { userId: user.id, email: user.email },
      occurredAt: new Date(),
    });

    authLogger.info('User registered', { userId: user.id });
    return { id: user.id, email: user.email, message: 'Registration successful. Verify your email.' };
  }

  async login(email: string, password: string, device?: DeviceInfo) {
    const user = await this.repo.findByEmail(email);
    if (!user) throw new AuthenticationError('Invalid credentials');

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new AuthenticationError('Account is locked. Try again later.');
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      const attempts = user.failedLoginAttempts + 1;
      const update: { failedLoginAttempts: number; lockedUntil?: Date } = { failedLoginAttempts: attempts };
      if (attempts >= env.MAX_FAILED_LOGIN_ATTEMPTS) {
        update.lockedUntil = new Date(Date.now() + env.ACCOUNT_LOCK_DURATION_MINUTES * 60 * 1000);
        authLogger.warn('Account locked', { userId: user.id });
      }
      await this.repo.updateUser(user.id, update);
      throw new AuthenticationError('Invalid credentials');
    }

    await this.repo.updateUser(user.id, { failedLoginAttempts: 0, lockedUntil: null });
    const tokens = await this.issueTokens(user.id, user.email, device);
    authLogger.info('User logged in', { userId: user.id });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      tokens,
    };
  }

  async refresh(refreshToken: string, device?: DeviceInfo): Promise<TokenPair> {
    let payload: { sub: string };
    try {
      payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as { sub: string };
    } catch {
      throw new AuthenticationError('Invalid refresh token');
    }

    const tokenHash = hashToken(refreshToken);
    const stored = await this.repo.findRefreshToken(tokenHash);
    if (!stored) throw new AuthenticationError('Refresh token revoked or expired');

    await this.repo.revokeRefreshToken(stored.id);
    const user = await this.repo.findById(payload.sub);
    if (!user) throw new AuthenticationError('User not found');

    return this.issueTokens(user.id, user.email, device);
  }

  async logout(refreshToken?: string, userId?: string): Promise<void> {
    if (refreshToken) {
      await this.repo.revokeTokenByHash(hashToken(refreshToken));
    }
    if (userId) {
      await this.repo.revokeAllUserTokens(userId);
    }
    authLogger.info('User logged out', { userId });
  }

  async logoutAllDevices(userId: string): Promise<void> {
    await this.repo.revokeAllUserTokens(userId);
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.repo.findByEmail(email);
    if (!user) return;

    const token = generateSecureToken();
    await this.repo.updateUser(user.id, {
      passwordResetToken: token,
      passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000),
    });

    await eventBus.publish({
      type: DomainEventType.USER_REGISTERED,
      payload: { userId: user.id, email: user.email, resetToken: token },
      occurredAt: new Date(),
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: { gt: new Date() },
      },
    });
    if (!user) throw new DomainError('Invalid or expired reset token');

    await this.repo.updateUser(user.id, {
      passwordHash: await hashPassword(newPassword),
      passwordResetToken: null,
      passwordResetExpires: null,
    });
  }

  async verifyEmail(token: string): Promise<void> {
    const user = await prisma.user.findFirst({ where: { emailVerifyToken: token } });
    if (!user) throw new NotFoundError('Invalid verification token');

    await this.repo.updateUser(user.id, {
      emailVerified: true,
      emailVerifyToken: null,
      status: 'ACTIVE',
    });

    await eventBus.publish({
      type: DomainEventType.EMAIL_VERIFIED,
      payload: { userId: user.id },
      occurredAt: new Date(),
    });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.repo.findById(userId);
    if (!user) throw new NotFoundError('User not found');

    const valid = await comparePassword(currentPassword, user.passwordHash);
    if (!valid) throw new AuthenticationError('Current password is incorrect');

    await this.repo.updateUser(userId, { passwordHash: await hashPassword(newPassword) });
    await this.repo.revokeAllUserTokens(userId);
    auditLogger.info('Password changed', { userId });
  }

  async assignRole(userId: string, roleName: string): Promise<void> {
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) throw new NotFoundError('Role not found');

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId: role.id } },
      update: {},
      create: { userId, roleId: role.id },
    });
  }
}
