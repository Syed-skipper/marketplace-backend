import { Router } from 'express';
import { prisma } from '../../../config/database/prisma.client';
import { asyncHandler } from '../../../common/utils/async-handler';
import { sendSuccess } from '../../../common/utils/response.util';

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  const q = (req.query.q as string) ?? '';
  const limit = Math.min(20, Number(req.query.limit) || 10);

  if (!q.trim()) {
    sendSuccess(res, []);
    return;
  }

  const products = await prisma.$queryRaw<
    Array<{ id: string; name: string; slug: string; rank: number }>
  >`
    SELECT id, name, slug,
           ts_rank(search_vector, plainto_tsquery('english', ${q})) AS rank
    FROM products
    WHERE status = 'ACTIVE'
      AND search_vector @@ plainto_tsquery('english', ${q})
    ORDER BY rank DESC
    LIMIT ${limit}
  `;

  sendSuccess(res, products);
}));

router.get('/suggestions', asyncHandler(async (req, res) => {
  const q = (req.query.q as string) ?? '';
  if (q.length < 2) {
    sendSuccess(res, []);
    return;
  }

  const suggestions = await prisma.$queryRaw<Array<{ name: string }>>`
    SELECT DISTINCT name
    FROM products
    WHERE status = 'ACTIVE' AND name % ${q}
    ORDER BY similarity(name, ${q}) DESC
    LIMIT 10
  `;

  sendSuccess(res, suggestions.map((s) => s.name));
}));

export default router;
