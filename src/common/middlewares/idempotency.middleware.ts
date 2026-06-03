import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { prisma } from '../../config/database/prisma.client';
import { sendSuccess } from '../utils/response.util';

export async function idempotencyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const key = req.get('Idempotency-Key');
  if (!key || req.method === 'GET') {
    next();
    return;
  }

  const requestHash = crypto
    .createHash('sha256')
    .update(JSON.stringify({ method: req.method, path: req.path, body: req.body }))
    .digest('hex');

  const existing = await prisma.idempotencyKey.findUnique({ where: { key } });

  if (existing) {
    if (existing.requestHash !== requestHash) {
      res.status(422).json({
        success: false,
        message: 'Idempotency key reused with different request payload',
      });
      return;
    }
    if (existing.status === 'COMPLETED' && existing.response) {
      sendSuccess(res, existing.response, 'Success (idempotent)');
      return;
    }
  }

  const originalJson = res.json.bind(res);
  res.json = function (body: unknown) {
    void prisma.idempotencyKey.upsert({
      where: { key },
      update: {
        response: body as object,
        status: 'COMPLETED',
        requestHash,
      },
      create: {
        key,
        requestHash,
        response: body as object,
        status: 'COMPLETED',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    return originalJson(body);
  };

  next();
}
