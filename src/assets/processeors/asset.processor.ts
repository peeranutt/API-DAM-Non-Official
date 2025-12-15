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
import { MetadataField, MetadataFieldType } from '../entities/metadata-field.entity';

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

  // ไฟล์รูปภาพ
  @Process('process-image')
  async handleImageProcessing(job: Job<AssetJobData>) {
    this.logger.log(`Processing image: ${job.data.filename}`);

    try {
      const { filename, originalPath, mimetype, size, userId, 
        assetCode, category, title, keywords, description, createDate, 
        userKeywords, collectionId, notes, accessRights, owner, 
        modifiedDate, status
      } = job.data;

      if (!mimetype.startsWith('image/')) {
        this.logger.log(`Skipping non-image file: ${filename}`);
        return { success: true, message: 'Not an image file' };
      }

      // สร้าง directories สำหรับเก็บไฟล์ที่ประมวลผลแล้ว
      const uploadsDir = './uploads';
      const thumbnailsDir = path.join(uploadsDir, 'thumbnails');
      const optimizedDir = path.join(uploadsDir, 'optimized');

      // สร้าง directories
      await fs.mkdir(thumbnailsDir, { recursive: true });
      await fs.mkdir(optimizedDir, { recursive: true });

      const inputPath = path.join(uploadsDir, filename);

      await job.progress(10);

      // สร้าง Thumbnail (300x300)
      const thumbnailPath = path.join(thumbnailsDir, `thumb_${filename}`);
      await sharp(inputPath)
        .resize(300, 300, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toFile(thumbnailPath);

      this.logger.log(`Thumbnail created: ${thumbnailPath}`);
      await job.progress(30);

      // สร้าง Optimized version (max 1920px)
      const optimizedPath = path.join(optimizedDir, `opt_${filename}`);
      await sharp(inputPath)
        .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toFile(optimizedPath);

      this.logger.log(`Optimized image created: ${optimizedPath}`);
      await job.progress(50);

      // ดึง metadata
      const imageMetadata = await sharp(inputPath).metadata();
      console.log('Image Metadata:', imageMetadata);

      await job.progress(60);

      // บันทึก Asset ลง database
      const asset = this.assetRepository.create({
        filename,
        file_type: imageMetadata.format || mimetype,
        file_size: size,
        path: inputPath,
        create_by: userId,
        status: AssetStatus.ACTIVE,
      });

      const savedAsset = await this.assetRepository.save(asset);

      await job.progress(75);

      // บันทึก metadata ลง database
      const metadataEntries = [
        // { meta_key: 'width', meta_value: imageMetadata.width?.toString() || '' },
        // { meta_key: 'height', meta_value: imageMetadata.height?.toString() || '' },
        // { meta_key: 'format', meta_value: imageMetadata.format || '' },
        // { meta_key: 'space', meta_value: imageMetadata.space || '' },
        // { meta_key: 'channels', meta_value: imageMetadata.channels?.toString() || '' },
        // { meta_key: 'density', meta_value: imageMetadata.density?.toString() || '' },
        // { meta_key: 'hasAlpha', meta_value: imageMetadata.hasAlpha?.toString() || 'false' },
        // { meta_key: 'thumbnail_path', meta_value: `thumbnails/thumb_${filename}` },
        // { meta_key: 'optimized_path', meta_value: `optimized/opt_${filename}` },

        // Metadata ที่มาจากฟอร์มของผู้ใช้ (จาก job.data)
            ...(assetCode ? [{ meta_key: 'asset_code', meta_value: assetCode }] : []),
            ...(category ? [{ meta_key: 'category', meta_value: category }] : []),
            ...(title ? [{ meta_key: 'title', meta_value: title }] : []),
            ...(keywords ? [{ meta_key: 'keywords', meta_value: keywords }] : []),
            ...(description ? [{ meta_key: 'description', meta_value: description }] : []),
            ...(createDate ? [{ meta_key: 'creation_date', meta_value: createDate }] : []),
            // ใช้ชื่อฟิลด์ให้ตรงกับที่ปรากฏในตาราง metadata_fields
            ...(userKeywords ? [{ meta_key: 'user_keywords', meta_value: userKeywords }] : []), 
            ...(collectionId ? [{ meta_key: 'collection_id', meta_value: collectionId.toString() }] : []),
            ...(notes ? [{ meta_key: 'notes', meta_value: notes }] : []),
            ...(accessRights ? [{ meta_key: 'access_rights', meta_value: accessRights }] : []),
            ...(owner ? [{ meta_key: 'owner', meta_value: owner }] : []),
            ...(modifiedDate ? [{ meta_key: 'modified_date', meta_value: modifiedDate }] : []),
            ...(status ? [{ meta_key: 'asset_status_user', meta_value: status }] : []), // ตั้งชื่อให้ต่างจาก status ระบบ

      ];

      // Ensure metadata fields exist and map entries to AssetMetadata with field relation
      const keys = metadataEntries.map((e) => e.meta_key);
      const existingFields = await this.metadataFieldRepository.find({ where: { name: In(keys) } });

      const fieldsByName: Record<string, MetadataField> = {};
      for (const f of existingFields) fieldsByName[f.name] = f;

      const toCreateFields = keys.filter((k) => !fieldsByName[k]);
      for (const name of toCreateFields) {
        const newField = this.metadataFieldRepository.create({ name, type: MetadataFieldType.TEXT, options: null });
        const savedField = await this.metadataFieldRepository.save(newField);
        fieldsByName[savedField.name] = savedField;
      }

      const assetMetadataEntities = metadataEntries.map((entry) => {
        const field = fieldsByName[entry.meta_key];
        return this.metadataRepository.create({
          asset: savedAsset,
          field: field,
          value: entry.meta_value,
        });
      });

      await this.metadataRepository.save(assetMetadataEntities);

      await job.progress(100);

      return {
        success: true,
        assetId: savedAsset.id,
        filename,
        thumbnail: `thumbnails/thumb_${filename}`,
        optimized: `optimized/opt_${filename}`,
        metadata: {
          width: imageMetadata.width,
          height: imageMetadata.height,
          format: imageMetadata.format,
          space: imageMetadata.space,
          channels: imageMetadata.channels,
          // hasAlpha: imageMetadata.hasAlpha,
        },
      };
    } catch (error) {
      this.logger.error(
        `Error processing image: ${error?.message ?? error}`,
        error?.stack,
      );
      throw error;
    }
  }

  // ไฟล์วิดีโอ
  @Process('process-video')
  async handleVideoProcessing(job: Job<AssetJobData>) {
    this.logger.log(`Processing video: ${job.data.filename}`);

    try {
      const { filename, size, userId, mimetype } = job.data;

      await job.progress(25);

      // บันทึก Video asset ลง database
      const asset = this.assetRepository.create({
        filename,
        file_type: mimetype,
        file_size: size,
        path: `./uploads/${filename}`,
        create_by: userId,
        status: AssetStatus.ACTIVE,
      });

      const savedAsset = await this.assetRepository.save(asset);

      await job.progress(75);

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

  // ไฟล์ PDF
  @Process('process-pdf')
  async handlePdfProcessing(job: Job<AssetJobData>) {
    this.logger.log(`Processing PDF: ${job.data.filename}`);

    try {
      const { filename, originalPath, size, userId, mimetype } = job.data;

      const uploadsDir = './uploads';
      const thumbnailsDir = path.join(uploadsDir, 'thumbnails');
      const optimizedDir = path.join(uploadsDir, 'optimized');

      await fs.mkdir(thumbnailsDir, { recursive: true });
      await fs.mkdir(optimizedDir, { recursive: true });

      const inputPath = path.join(uploadsDir, filename);

      await job.progress(20);

      // create a PNG thumbnail as a fallback by rendering a small SVG
      const baseName = filename.replace(/\.[^.]+$/, '');
      const thumbFilename = `thumb_${baseName}.png`;
      const thumbnailPath = path.join(thumbnailsDir, thumbFilename);

      const svg = `
      <svg width="800" height="1000" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f8fafc" />
        <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" font-size="36" fill="#111827" font-family="Arial, Helvetica, sans-serif">PDF Preview</text>
        <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-size="20" fill="#6b7280">${filename}</text>
      </svg>`;

      await sharp(Buffer.from(svg)).png().toFile(thumbnailPath);

      await job.progress(60);

      // copy original PDF to optimized folder (keep original as preview source)
      const optimizedPath = path.join(optimizedDir, filename);
      try {
        await fs.copyFile(inputPath, optimizedPath);
      } catch (e) {
        this.logger.warn(`Could not copy PDF to optimized folder: ${e?.message ?? e}`);
      }

      // save Asset to database
      const asset = this.assetRepository.create({
        filename,
        file_type: mimetype,
        file_size: size,
        path: inputPath,
        create_by: userId,
        status: AssetStatus.ACTIVE,
      });

      const savedAsset = await this.assetRepository.save(asset);

      // metadata entries
      const metadataEntries = [
        { meta_key: 'format', meta_value: 'pdf' },
        { meta_key: 'thumbnail_path', meta_value: `thumbnails/${thumbFilename}` },
        { meta_key: 'optimized_path', meta_value: `optimized/${filename}` },
      ];

      // Ensure metadata fields exist and map entries to AssetMetadata with field relation
      const keys = metadataEntries.map((e) => e.meta_key);
      const existingFields = await this.metadataFieldRepository.find({ where: { name: In(keys) } });

      const fieldsByName: Record<string, MetadataField> = {};
      for (const f of existingFields) fieldsByName[f.name] = f;

      const toCreateFields = keys.filter((k) => !fieldsByName[k]);
      for (const name of toCreateFields) {
        const newField = this.metadataFieldRepository.create({ name, type: MetadataFieldType.TEXT, options: null });
        const savedField = await this.metadataFieldRepository.save(newField);
        fieldsByName[savedField.name] = savedField;
      }

      const assetMetadataEntities = metadataEntries.map((entry) => {
        const field = fieldsByName[entry.meta_key];
        return this.metadataRepository.create({
          asset: savedAsset,
          field: field,
          value: entry.meta_value,
        });
      });

      await this.metadataRepository.save(assetMetadataEntities);

      await job.progress(100);

      return {
        success: true,
        assetId: savedAsset.id,
        filename,
        thumbnail: `thumbnails/${thumbFilename}`,
        optimized: `optimized/${filename}`,
        metadata: {
          format: 'pdf',
        },
      };
    } catch (error) {
      this.logger.error(
        `Error processing PDF: ${error?.message ?? error}`,
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
        this.logger.warn(`Failed to delete ${file}: ${error?.message ?? error}`);
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
      this.logger.error(`Error soft deleting assets: ${error?.message ?? error}`);
      throw error;
    }
  }
}