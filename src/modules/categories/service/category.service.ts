import { prisma } from '../../../config/database/prisma.client';
import { generateSlug } from '../../../common/utils/slug.util';
import { NotFoundError, ConflictError } from '../../../common/exceptions/errors';

export class CategoryService {
  async getTree() {
    const categories = await prisma.category.findMany({
      where: { parentId: null, isActive: true },
      include: {
        children: {
          where: { isActive: true },
          include: { children: { where: { isActive: true } } },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
    return categories;
  }

  async create(data: { name: string; parentId?: string; sortOrder?: number }) {
    const slug = generateSlug(data.name);
    const existing = await prisma.category.findUnique({ where: { slug } });
    if (existing) throw new ConflictError('Category slug already exists');

    return prisma.category.create({
      data: { name: data.name, slug, parentId: data.parentId, sortOrder: data.sortOrder ?? 0 },
      include: { children: true },
    });
  }

  async update(id: string, data: { name?: string; isActive?: boolean; sortOrder?: number }) {
    const cat = await prisma.category.findUnique({ where: { id } });
    if (!cat) throw new NotFoundError('Category not found');

    const update: { name?: string; slug?: string; isActive?: boolean; sortOrder?: number } = { ...data };
    if (data.name) update.slug = generateSlug(data.name);

    return prisma.category.update({ where: { id }, data: update });
  }

  async delete(id: string) {
    const children = await prisma.category.count({ where: { parentId: id } });
    if (children > 0) throw new ConflictError('Cannot delete category with children');
    await prisma.category.delete({ where: { id } });
  }
}
