// src/assets/utils/video-thumbnail.ts
import ffmpeg from 'fluent-ffmpeg';
import * as path from 'path';
import * as fs from 'fs';

export async function generateVideoThumbnail(
  inputPath: string,
  outputDir: string,
  filename: string,
): Promise<string> {
  await fs.promises.mkdir(outputDir, { recursive: true });

  const thumbName = `thumb-${path.parse(filename).name}.jpg`;
  const outputPath = path.join(outputDir, thumbName);

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .screenshots({
        timestamps: ['30%'],
        filename: thumbName,
        folder: outputDir,
        size: '640x360',
      })
      .on('end', () => resolve(outputPath))
      .on('error', reject);
  });
}
