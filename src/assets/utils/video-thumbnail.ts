import ffmpeg from 'fluent-ffmpeg';
import * as path from 'path';
import * as fs from 'fs';

export async function generateVideoThumbnail(
  inputPath: string,
  thumbnailsDir: string,
  filename: string,
): Promise<string> {
  await fs.promises.mkdir(thumbnailsDir, { recursive: true });

  const thumbName = `thumb_${path.parse(filename).name}.jpg`;
  const thumbnailPath = path.join(thumbnailsDir, thumbName);

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .screenshots({
        timestamps: ['30%'],
        filename: thumbName,
        folder: thumbnailsDir,
        size: '640x360',
      })
      .on('end', () => resolve(thumbnailPath))
      .on('error', reject);
  });
}
