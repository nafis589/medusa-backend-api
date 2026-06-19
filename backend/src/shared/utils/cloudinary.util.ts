import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { v2 as cloudinary } from 'cloudinary';
import { AppError } from '@shared/errors/app-error';

let configured = false;

function getPublicBaseUrl(): string {
  if (process.env.PUBLIC_API_URL?.trim()) {
    return process.env.PUBLIC_API_URL.trim().replace(/\/$/, '');
  }
  const port = process.env.PORT ?? '5000';
  return `http://localhost:${port}`;
}

/** Cloud name must be set and must not look like an email or URL. */
export function isCloudinaryConfigured(): boolean {
  if (process.env.CLOUDINARY_DISABLED === 'true') return false;

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

  if (!cloudName || !apiKey || !apiSecret) return false;
  if (cloudName.includes('@')) return false;

  return true;
}

function ensureConfigured(): void {
  if (configured) return;

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });

  configured = true;
}

async function uploadImageLocally(source: string, folder: string): Promise<string> {
  if (source.startsWith('http://') || source.startsWith('https://')) {
    return source;
  }

  const match = /^data:image\/([\w+.-]+);base64,(.+)$/i.exec(source);
  if (!match) {
    throw new AppError(400, 'INVALID_IMAGE', "Format d'image non supporté");
  }

  const ext = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
  const buffer = Buffer.from(match[2], 'base64');

  if (buffer.length === 0) {
    throw new AppError(400, 'INVALID_IMAGE', 'Image vide');
  }

  const dir = path.join(process.cwd(), 'uploads', ...folder.split('/'));
  await fs.mkdir(dir, { recursive: true });
  const filename = `${randomUUID()}.${ext}`;
  await fs.writeFile(path.join(dir, filename), buffer);

  return `${getPublicBaseUrl()}/uploads/${folder}/${filename}`;
}

/**
 * Uploads an image to Cloudinary from a base64 data URL or a temporary HTTP(S) URL.
 * Falls back to local disk storage in development when Cloudinary is not configured.
 */
export async function uploadImage(source: string, folder = 'marketplace/products'): Promise<string> {
  if (process.env.NODE_ENV === 'test') {
    if (source.startsWith('http://') || source.startsWith('https://')) {
      return source;
    }
    return `https://res.cloudinary.com/test/${folder}/mock-${String(Date.now())}.jpg`;
  }

  if (!isCloudinaryConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      throw new AppError(
        503,
        'IMAGE_UPLOAD_UNAVAILABLE',
        'Le téléversement d’images n’est pas configuré (Cloudinary).',
      );
    }

    return uploadImageLocally(source, folder);
  }

  ensureConfigured();

  try {
    const result = await cloudinary.uploader.upload(source, {
      folder,
      resource_type: 'image',
    });

    return result.secure_url;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Cloudinary upload failed';

    if (process.env.NODE_ENV !== 'production') {
      return uploadImageLocally(source, folder);
    }

    throw new AppError(
      502,
      'IMAGE_UPLOAD_FAILED',
      'Échec du téléversement de l’image. Vérifiez la configuration Cloudinary.',
      message,
    );
  }
}
