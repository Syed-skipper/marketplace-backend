import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { AuthenticationError, AuthorizationError } from '../exceptions/errors';
import { prisma } from '../../config/database/prisma.client';

export interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : req.cookies?.accessToken;

  if (!token) {
    next(new AuthenticationError('Authentication required'));
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
    req.user = payload;
    next();
  } catch {
    next(new AuthenticationError('Invalid or expired token'));
  }
}

export function optionalAuthenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : req.cookies?.accessToken;
  if (!token) {
    next();
    return;
  }
  try {
    req.user = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
  } catch {
    // ignore invalid token for optional auth
  }
  next();
}

export function hasRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AuthenticationError('Authentication required'));
      return;
    }
    const has = roles.some((r) => req.user!.roles.includes(r));
    if (!has) {
      next(new AuthorizationError(`Requires one of roles: ${roles.join(', ')}`));
      return;
    }
    next();
  };
}

export function hasPermission(...permissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AuthenticationError('Authentication required'));
      return;
    }
    const has = permissions.some((p) => req.user!.permissions.includes(p));
    if (!has) {
      next(new AuthorizationError(`Requires one of permissions: ${permissions.join(', ')}`));
      return;
    }
    next();
  };
}

export async function loadUserPermissions(userId: string): Promise<{
  roles: string[];
  permissions: string[];
}> {
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: {
      role: {
        include: {
          permissions: { include: { permission: true } },
        },
      },
    },
  });

  const roles = userRoles.map((ur) => ur.role.name);
  const permissionSet = new Set<string>();
  for (const ur of userRoles) {
    for (const rp of ur.role.permissions) {
      permissionSet.add(rp.permission.name);
    }
  }

  return { roles, permissions: Array.from(permissionSet) };
}
