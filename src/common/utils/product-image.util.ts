import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { env } from '../../config/env';
import { DomainError } from '../exceptions/errors';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'products');
const MAX_BYTES = 2 * 1024 * 1024;
const DATA_URL_PATTERN = /^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/i;

export async function persistProductImageUrl(imageUrl: string): Promise<string> {
  const trimmed = imageUrl.trim();

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    if (trimmed.length > 500) {
      throw new DomainError('Image URL is too long');
    }
    return trimmed;
  }

  const match = trimmed.match(DATA_URL_PATTERN);
  if (!match) {
    throw new DomainError('Invalid image format. Upload JPEG, PNG, or WebP images only.');
  }

  const ext = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
  const buffer = Buffer.from(match[2], 'base64');

  if (buffer.length > MAX_BYTES) {
    throw new DomainError('Image file exceeds 2MB limit');
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  const filename = `${randomUUID()}.${ext}`;
  await fs.writeFile(path.join(UPLOAD_DIR, filename), buffer);

  return `${env.API_BASE_URL}/uploads/products/${filename}`;
}

export async function persistProductImages(
  images: { imageUrl: string; sortOrder?: number }[] | undefined,
) {
  if (!images?.length) return undefined;
  const persisted = await Promise.all(
    images.map(async (img, i) => ({
      imageUrl: await persistProductImageUrl(img.imageUrl),
      sortOrder: img.sortOrder ?? i,
    })),
  );
  return persisted;
}
