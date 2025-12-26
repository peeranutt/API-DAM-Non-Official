import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import sharp from 'sharp';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Asset, AssetStatus } from '../entities/asset.entity';
import { AssetMetadata } from '../entities/asset-metadata.entity';
import {
  MetadataField,
  MetadataFieldType,
} from '../entities/metadata-field.entity';
import { generateImageThumbnail } from '../utils/image-thumbnail';
import { generateVideoThumbnail } from '../utils/video-thumbnail';
import {
  pdfToThumbnail,
  officeToPdf,
  generateSvgPlaceholder,
} from '../utils/doc-thumbnail';

export interface AssetJobData {
  filename: string;
  originalPath: string;
  mimetype: string;
  size: number;
  userId?: number;

  assetCode?: string;
  category?: string;
  title?: string;
  keywords?: string;
  description?: string;
  createDate?: string;
  userKeywords?: string;
  collectionId?: string;
  notes?: string;
  accessRights?: string;
  owner?: string;
  modifiedDate?: string;
  status?: string;
}

@Processor('assets')
export class AssetProcessor {
  private readonly logger = new Logger(AssetProcessor.name);

  constructor(
    @InjectRepository(Asset)
    private assetRepository: Repository<Asset>,
    @InjectRepository(AssetMetadata)
    private metadataRepository: Repository<AssetMetadata>,
    @InjectRepository(MetadataField)
    private metadataFieldRepository: Repository<MetadataField>,
  ) {}

  // บันทึก metadata
  private async saveMetadata(savedAsset: Asset, job: Job<AssetJobData>) {
    const metadataMap: Record<string, string> = {
      assetCode: savedAsset.id.toString(),
      category: savedAsset.file_type,
      title: savedAsset.filename,
      keywords: savedAsset.keywords?.join(',') ?? '',
      description: job.data.description ?? '',
      createDate: savedAsset.created_at.toISOString(),
      userKeywords: job.data.userKeywords ?? '',
      collectionId: job.data.collectionId ?? '',
      notes: job.data.notes ?? '',
      accessRights: job.data.accessRights ?? '',
      owner: job.data.userId?.toString() ?? '',
      modifiedDate: savedAsset.created_at.toISOString(),
      status: savedAsset.status,
    };

    const metadataEntries = Object.entries(metadataMap)
      .filter(([_, value]) => value !== '')
      .map(([name, value]) => ({ name, value }));

    const fieldNames = metadataEntries.map((m) => m.name);

    const fields = await this.metadataFieldRepository.find({
      where: { name: In(fieldNames) },
    });

    const fieldsByName = Object.fromEntries(fields.map((f) => [f.name, f]));

    const assetMetadataEntities = metadataEntries
      .map((entry) => {
        const field = fieldsByName[entry.name];
        if (!field) return null;

        return this.metadataRepository.create({
          asset: savedAsset,
          field,
          value: entry.value,
        });
      })
      .filter((m): m is AssetMetadata => m !== null);

    await this.metadataRepository.save(assetMetadataEntities);
  }

  // ไฟล์รูปภาพ
  @Process('process-image')
  async handleImageProcessing(job: Job<AssetJobData>) {
    const { filename, size, userId, mimetype, keywords } = job.data;

    const uploadsDir = path.join(process.cwd(), 'uploads');
    const thumbnailsDir = path.join(uploadsDir, 'thumbnails');

    const imagePath = path.join(uploadsDir, filename);

    await job.progress(20);

    const thumbnailFilename = await generateImageThumbnail(
      imagePath,
      thumbnailsDir,
      filename,
    );

    await job.progress(60);

    /**CREATE ASSET**/
    const asset = this.assetRepository.create({
      filename,
      original_name: filename,
      thumbnail: `uploads/thumbnails/${thumbnailFilename}`,
      file_type: mimetype,
      file_size: size,
      path: `./uploads/${filename}`,
      keywords: keywords ? keywords.split(',') : [],
      create_by: userId,
      status: AssetStatus.ACTIVE,
    });

    const savedAsset = await this.assetRepository.save(asset);

    await this.saveMetadata(savedAsset, job);

    await job.progress(100);

    return {
      success: true,
      assetId: savedAsset.id,
    };
  }

  // ไฟล์วิดีโอ
  @Process('process-video')
  async handleVideoProcessing(job: Job<AssetJobData>) {
    this.logger.log(`Processing video: ${job.data.filename}`);

    try {
      const { filename, size, userId, mimetype, keywords } = job.data;

      const uploadsDir = './uploads';
      const videoPath = path.join(uploadsDir, filename);
      const thumbnailsDir = path.join(uploadsDir, 'thumbnails');

      await job.progress(20);

      const thumbnailPath = await generateVideoThumbnail(
        videoPath,
        thumbnailsDir,
        filename,
      );

      await job.progress(60);

      // บันทึก Video asset ลง database
      const asset = this.assetRepository.create({
        filename,
        original_name: filename,
        thumbnail: `${thumbnailPath}`,
        file_type: mimetype,
        file_size: size,
        path: `./uploads/${filename}`,
        keywords: [],
        create_by: userId,
        status: AssetStatus.ACTIVE,
      });

      const savedAsset = await this.assetRepository.save(asset);

      await this.saveMetadata(savedAsset, job);

      await job.progress(100);

      return {
        success: true,
        assetId: savedAsset.id,
        filename,
        message: 'Video processing completed',
      };
    } catch (error) {
      this.logger.error(
        `Error processing video: ${error?.message ?? error}`,
        error?.stack,
      );
      throw error;
    }
  }

  @Process('process-document')
  async handleDocumentProcessing(job: Job<AssetJobData>) {
    try {
      const { filename, size, userId, mimetype } = job.data;

      const uploadsDir = './uploads';
      const thumbnailsDir = path.join(uploadsDir, 'thumbnails');
      const optimizedDir = path.join(uploadsDir, 'optimized');

      await fs.mkdir(thumbnailsDir, { recursive: true });
      await fs.mkdir(optimizedDir, { recursive: true });

      const inputPath = path.join(uploadsDir, filename);
      const ext = path.extname(filename).toLowerCase();
      const baseName = path.parse(filename).name;
      const thumbPath = path.join(thumbnailsDir, `thumb_${baseName}.png`);

      await job.progress(20);

      if (ext === '.pdf') {
        await pdfToThumbnail(inputPath, thumbPath);
      } else if (
        ['.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx'].includes(ext)
      ) {
        await officeToPdf(inputPath, thumbnailsDir);
        const pdfPath = path.join(thumbnailsDir, `${baseName}.pdf`);
        await pdfToThumbnail(pdfPath, thumbPath);
      } else {
        await sharp(Buffer.from(generateSvgPlaceholder(filename)))
          .png()
          .toFile(thumbPath);
      }

      await job.progress(60);

      const asset = this.assetRepository.create({
        filename,
        original_name: filename,
        thumbnail: `uploads/thumbnails/thumb_${filename}`,
        file_type: mimetype,
        file_size: size,
        path: inputPath,
        keywords: [],
        create_by: userId,
        status: AssetStatus.ACTIVE,
      });

      const savedAsset = await this.assetRepository.save(asset);

      await this.saveMetadata(savedAsset, job);

      await job.progress(100);

      return {
        success: true,
        assetId: savedAsset.id,
      };
    } catch (error) {
      this.logger.error(
        `Document processing failed: ${error?.message ?? error}`,
        error?.stack,
      );
      throw error;
    }
  }

  @Process('cleanup-temp')
  async handleCleanup(job: Job<{ files: string[] }>) {
    this.logger.log(`Cleaning up temporary files`);

    for (const file of job.data.files) {
      try {
        await fs.unlink(file);
        this.logger.log(`Deleted: ${file}`);
      } catch (error) {
        this.logger.warn(
          `Failed to delete ${file}: ${error?.message ?? error}`,
        );
      }
    }

    return { success: true, deletedCount: job.data.files.length };
  }

  @Process('soft-delete')
  async handleSoftDelete(job: Job<{ assetIds: number[] }>) {
    this.logger.log(`Soft deleting assets: ${job.data.assetIds.join(', ')}`);

    try {
      await this.assetRepository.update(
        { id: In(job.data.assetIds) },
        { status: AssetStatus.DELETED },
      );

      return {
        success: true,
        deletedCount: job.data.assetIds.length,
      };
    } catch (error) {
      this.logger.error(
        `Error soft deleting assets: ${error?.message ?? error}`,
      );
      throw error;
    }
  }
}

// ไฟล์ PDF
// @Process('process-pdf')
// async handlePdfProcessing(job: Job<AssetJobData>) {
//   this.logger.log(`Processing PDF: ${job.data.filename}`);

//   try {
//     const { filename, originalPath, size, userId, mimetype } = job.data;

//     const uploadsDir = './uploads';
//     const thumbnailsDir = path.join(uploadsDir, 'thumbnails');
//     const optimizedDir = path.join(uploadsDir, 'optimized');

//     await fs.mkdir(thumbnailsDir, { recursive: true });
//     await fs.mkdir(optimizedDir, { recursive: true });

//     const inputPath = path.join(uploadsDir, filename);

//     await job.progress(20);

//     // create a PNG thumbnail as a fallback by rendering a small SVG
//     const baseName = filename.replace(/\.[^.]+$/, '');
//     const thumbFilename = `thumb_${baseName}.png`;
//     const thumbnailPath = path.join(thumbnailsDir, thumbFilename);

//     const svg = `
//     <svg width="800" height="1000" xmlns="http://www.w3.org/2000/svg">
//       <rect width="100%" height="100%" fill="#f8fafc" />
//       <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" font-size="36" fill="#111827" font-family="Arial, Helvetica, sans-serif">PDF Preview</text>
//       <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-size="20" fill="#6b7280">${filename}</text>
//     </svg>`;

//     await sharp(Buffer.from(svg)).png().toFile(thumbnailPath);

//     await job.progress(60);

//     // copy original PDF to optimized folder (keep original as preview source)
//     const optimizedPath = path.join(optimizedDir, filename);
//     try {
//       await fs.copyFile(inputPath, optimizedPath);
//     } catch (e) {
//       this.logger.warn(
//         `Could not copy PDF to optimized folder: ${e?.message ?? e}`,
//       );
//     }

//     // save Asset to database
//     const asset = this.assetRepository.create({
//       filename,
//       file_type: mimetype,
//       file_size: size,
//       path: inputPath,
//       create_by: userId,
//       status: AssetStatus.ACTIVE,
//     });

//     const savedAsset = await this.assetRepository.save(asset);

//     // metadata entries
//     const metadataEntries = [
//       { meta_key: 'format', meta_value: 'pdf' },
//       {
//         meta_key: 'thumbnail_path',
//         meta_value: `thumbnails/${thumbFilename}`,
//       },
//       { meta_key: 'optimized_path', meta_value: `optimized/${filename}` },
//     ];

//     // Ensure metadata fields exist and map entries to AssetMetadata with field relation
//     const keys = metadataEntries.map((e) => e.meta_key);
//     const existingFields = await this.metadataFieldRepository.find({
//       where: { name: In(keys) },
//     });

//     const fieldsByName: Record<string, MetadataField> = {};
//     for (const f of existingFields) fieldsByName[f.name] = f;

//     const toCreateFields = keys.filter((k) => !fieldsByName[k]);
//     for (const name of toCreateFields) {
//       const newField = this.metadataFieldRepository.create({
//         name,
//         type: MetadataFieldType.TEXT,
//         options: null,
//       });
//       const savedField = await this.metadataFieldRepository.save(newField);
//       fieldsByName[savedField.name] = savedField;
//     }

//     const assetMetadataEntities = metadataEntries.map((entry) => {
//       const field = fieldsByName[entry.meta_key];
//       return this.metadataRepository.create({
//         asset: savedAsset,
//         field: field,
//         value: entry.meta_value,
//       });
//     });

//     await this.metadataRepository.save(assetMetadataEntities);

//     await job.progress(100);

//     return {
//       success: true,
//       assetId: savedAsset.id,
//       filename,
//       thumbnail: `thumbnails/${thumbFilename}`,
//       optimized: `optimized/${filename}`,
//       metadata: {
//         format: 'pdf',
//       },
//     };
//   } catch (error) {
//     this.logger.error(
//       `Error processing PDF: ${error?.message ?? error}`,
//       error?.stack,
//     );
//     throw error;
//   }
// }
