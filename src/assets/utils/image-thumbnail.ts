import { exec } from 'child_process';
import * as path from 'path';

export function generateImageThumbnail(
  imagePath: string,
  thumbnailsDir: string,
  filename: string,
): Promise<string> {
  const ext = path.extname(filename);
  const baseName = path.basename(filename, ext);
  const thumbName = `thumb_${baseName}.png`;
  const output = path.join(thumbnailsDir, thumbName);

  return new Promise((resolve, reject) => {
    exec(
      `ffmpeg -y -i "${imagePath}" -vf "scale=300:300:force_original_aspect_ratio=decrease" "${output}"`,
      (err) => {
        if (err) return reject(err);
        resolve(thumbName);
      },
    );
  });
}
