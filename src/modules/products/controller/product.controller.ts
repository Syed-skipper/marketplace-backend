import { Request, Response } from 'express';
import { ProductService } from '../service/product.service';
import { sendSuccess } from '../../../common/utils/response.util';
import { prisma } from '../../../config/database/prisma.client';

export class ProductController {
  constructor(private readonly service = new ProductService()) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.list(req.query);
    sendSuccess(res, result.items, 'Success', 200, result.meta);
  };

  filterOptions = async (_req: Request, res: Response): Promise<void> => {
    const options = await this.service.getFilterOptions();
    sendSuccess(res, options);
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    const product = await this.service.getById(req.params.id);
    sendSuccess(res, product);
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const seller = await prisma.seller.findUnique({ where: { userId: req.user!.sub } });
    if (!seller) {
      res.status(403).json({ success: false, message: 'Seller profile required' });
      return;
    }
    const product = await this.service.create(seller.id, req.body);
    sendSuccess(res, product, 'Product created', 201);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const seller = await prisma.seller.findUnique({ where: { userId: req.user!.sub } });
    const isAdmin = req.user!.roles.includes('admin');
    const product = await this.service.update(
      req.params.id,
      seller?.id ?? '',
      isAdmin,
      req.body,
    );
    sendSuccess(res, product, 'Product updated');
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    const seller = await prisma.seller.findUnique({ where: { userId: req.user!.sub } });
    const isAdmin = req.user!.roles.includes('admin');
    await this.service.delete(req.params.id, seller?.id ?? '', isAdmin);
    sendSuccess(res, null, 'Product deleted');
  };

  updateStatus = async (req: Request, res: Response): Promise<void> => {
    const isAdmin = req.user!.roles.includes('admin');
    const seller = await prisma.seller.findUnique({ where: { userId: req.user!.sub } });
    const product = await this.service.updateStatus(
      req.params.id,
      req.body.status,
      seller?.id ?? null,
      isAdmin,
    );
    sendSuccess(res, product, 'Status updated');
  };
}
