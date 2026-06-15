import { v2 as cloudinary } from 'cloudinary';

let configured = false;

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

/**
 * Uploads an image to Cloudinary from a base64 data URL or a temporary HTTP(S) URL.
 * In test mode, returns the source URL unchanged (or a mock URL for base64).
 */
export async function uploadImage(source: string, folder = 'marketplace/products'): Promise<string> {
  if (process.env.NODE_ENV === 'test') {
    if (source.startsWith('http://') || source.startsWith('https://')) {
      return source;
    }
    return `https://res.cloudinary.com/test/${folder}/mock-${String(Date.now())}.jpg`;
  }

  ensureConfigured();

  const result = await cloudinary.uploader.upload(source, {
    folder,
    resource_type: 'image',
  });

  return result.secure_url;
}
