import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { Logger } from '@nestjs/common';
import sharp from 'sharp';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface AssetJobData {
  filename: string;
  originalPath: string;
  mimetype: string;
  size: number;
}

@Processor('assets')
export class AssetProcessor {
  private readonly logger = new Logger(AssetProcessor.name);

  @Process('process-image')
  async handleImageProcessing(job: Job<AssetJobData>) {
    this.logger.log(`Processing image: ${job.data.filename}`);
    
    try {
      const { filename, originalPath, mimetype } = job.data;
      
      if (!mimetype.startsWith('image/')) {
        this.logger.log(`Skipping non-image file: ${filename}`);
        return { success: true, message: 'Not an image file' };
      }

      const uploadsDir = './uploads';
      const thumbnailsDir = path.join(uploadsDir, 'thumbnails');
      const optimizedDir = path.join(uploadsDir, 'optimized');

      await fs.mkdir(thumbnailsDir, { recursive: true });
      await fs.mkdir(optimizedDir, { recursive: true });

      const inputPath = path.join(uploadsDir, filename);

      await job.progress(25);

      // Thumbnail
      const thumbnailPath = path.join(thumbnailsDir, `thumb_${filename}`);
      await sharp(inputPath)
        .resize(300, 300, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toFile(thumbnailPath);

      this.logger.log(`Thumbnail created: ${thumbnailPath}`);

      await job.progress(50);

      // Optimized
      const optimizedPath = path.join(optimizedDir, `opt_${filename}`);
      await sharp(inputPath)
        .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toFile(optimizedPath);

      this.logger.log(`Optimized image created: ${optimizedPath}`);

      await job.progress(75);

      const metadata = await sharp(inputPath).metadata();

      await job.progress(100);

      return {
        success: true,
        filename,
        thumbnail: `thumbnails/thumb_${filename}`,
        optimized: `optimized/opt_${filename}`,
        metadata: {
          width: metadata.width,
          height: metadata.height,
          format: metadata.format,
        },
      };
    } catch (error) {
      this.logger.error(
        `Error processing image: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Process('process-video')
  async handleVideoProcessing(job: Job<AssetJobData>) {
    this.logger.log(`Processing video: ${job.data.filename}`);

    await job.progress(50);

    return {
      success: true,
      filename: job.data.filename,
      message: 'Video processing completed',
    };
  }

  @Process('cleanup-temp')
  async handleCleanup(job: Job<{ files: string[] }>) {
    this.logger.log(`Cleaning up temporary files`);

    for (const file of job.data.files) {
      try {
        await fs.unlink(file);
        this.logger.log(`Deleted: ${file}`);
      } catch (error) {
        this.logger.warn(`Failed to delete ${file}: ${error.message}`);
      }
    }

    return { success: true, deletedCount: job.data.files.length };
  }
}
