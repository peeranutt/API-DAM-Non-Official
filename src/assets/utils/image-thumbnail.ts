import * as path from 'path';
import * as fs from 'fs';
import sharp from 'sharp';

export async function generateImageThumbnail(
  imagePath: string,
  thumbnailsDir: string,
  filename: string,
): Promise<string> {
  await fs.promises.mkdir(thumbnailsDir, { recursive: true });

  const ext = path.extname(filename);
  const baseName = path.basename(filename, ext);

  const thumbName = `thumb_${baseName}.png`;
  const thumbnailPath = path.join(thumbnailsDir, thumbName);

  await sharp(imagePath)
    .resize(300, 300, {
      fit: 'inside', // ไม่บิดรูป
      withoutEnlargement: true,
    })
    .png({ quality: 80 })
    .toFile(thumbnailPath);

  return thumbName;
}
