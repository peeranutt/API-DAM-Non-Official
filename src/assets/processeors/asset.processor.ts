import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import { Asset, AssetStatus, StorageLocation } from '../entities/asset.entity';
import { AssetMetadata } from '../entities/asset-metadata.entity';
import { MetadataField } from '../entities/metadata-field.entity';
import { generateImageThumbnail } from '../utils/image-thumbnail';
import { generateVideoThumbnail } from '../utils/video-thumbnail';
import { pdfToThumbnail, officeToPdf, generateSvgPlaceholder } from '../utils/doc-thumbnail';
import { StorageConfig, DEFAULT_STORAGE } from '../config/storage.config';

export interface AssetJobData {
  filename: string;
  originalPath?: string;
  storageUrl: string;
  mimetype: string;
  size: number;
  userId?: number;
  groupId?: number;
  storageLocation?: StorageLocation;

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

  @Process('process-image')
  async handleImageProcessing(job: Job<AssetJobData>) {
    const { filename, originalPath, size, userId, groupId, mimetype, keywords, storageLocation } = job.data;
    const selectedStorage = storageLocation || DEFAULT_STORAGE;

    const uploadsDir = StorageConfig.getUploadsDir(selectedStorage);
    const thumbnailsDir = StorageConfig.getThumbnailsDir(selectedStorage);

    await StorageConfig.ensureDirectories(selectedStorage);

    const imagePath = originalPath || path.join(uploadsDir, filename);

    await job.progress(20);

    const thumbnailFilename = await generateImageThumbnail(
      imagePath,
      thumbnailsDir,
      filename,
    );

    await job.progress(60);

    // Store paths relative to storage root
    const relativePath = StorageConfig.getRelativePath(selectedStorage, imagePath);
    const relativeThumbnail = `${selectedStorage}/uploads/thumbnails/${thumbnailFilename}`;

    const asset = this.assetRepository.create({
      filename,
      original_name: filename,
      thumbnail: relativeThumbnail,
      file_type: mimetype,
      file_size: size,
      path: relativePath,
      storage_location: selectedStorage,
      keywords: keywords ? keywords.split(',') : [],
      create_by: userId,
      group_id: groupId,
      status: AssetStatus.ACTIVE,
    });

    const savedAsset = await this.assetRepository.save(asset);
    await this.saveMetadata(savedAsset, job);
    await job.progress(100);

    return {
      success: true,
      assetId: savedAsset.id,
      storageLocation: selectedStorage,
    };
  }

  @Process('process-video')
  async handleVideoProcessing(job: Job<AssetJobData>) {
    this.logger.log(`Processing video: ${job.data.filename}`);

    try {
      const { filename, originalPath, size, userId, groupId, mimetype, keywords, storageLocation } = job.data;
      const selectedStorage = storageLocation || DEFAULT_STORAGE;

      const uploadsDir = StorageConfig.getUploadsDir(selectedStorage);
      const thumbnailsDir = StorageConfig.getThumbnailsDir(selectedStorage);

      await StorageConfig.ensureDirectories(selectedStorage);

      const videoPath = originalPath || path.join(uploadsDir, filename);

      await job.progress(20);

      const thumbnailPath = await generateVideoThumbnail(
        videoPath,
        thumbnailsDir,
        filename,
      );

      await job.progress(60);

      const relativePath = StorageConfig.getRelativePath(selectedStorage, videoPath);
      const relativeThumbnail = `${selectedStorage}/uploads/thumbnails/${path.basename(thumbnailPath)}`;

      const asset = this.assetRepository.create({
        filename,
        original_name: filename,
        thumbnail: relativeThumbnail,
        file_type: mimetype,
        file_size: size,
        path: relativePath,
        storage_location: selectedStorage,
        keywords: [],
        create_by: userId,
        group_id: groupId,
        status: AssetStatus.ACTIVE,
      });

      const savedAsset = await this.assetRepository.save(asset);
      await this.saveMetadata(savedAsset, job);
      await job.progress(100);

      return {
        success: true,
        assetId: savedAsset.id,
        filename,
        storageLocation: selectedStorage,
        message: 'Video processing completed',
      };
    } catch (error) {
      this.logger.error(`Error processing video: ${error?.message ?? error}`, error?.stack);
      throw error;
    }
  }

  @Process('process-document')
  async handleDocumentProcessing(job: Job<AssetJobData>) {
    try {
      const { filename, originalPath, size, userId, groupId, mimetype, storageLocation } = job.data;
      const selectedStorage = storageLocation || DEFAULT_STORAGE;

      const uploadsDir = StorageConfig.getUploadsDir(selectedStorage);
      const thumbnailsDir = StorageConfig.getThumbnailsDir(selectedStorage);

      await StorageConfig.ensureDirectories(selectedStorage);

      const inputPath = originalPath || path.join(uploadsDir, filename);

      const ext = path.extname(filename).toLowerCase();
      const baseName = path.parse(filename).name;
      const thumbPath = path.join(thumbnailsDir, `thumb_${baseName}.png`);

      await job.progress(20);

      if (ext === '.pdf') {
        await pdfToThumbnail(inputPath, thumbPath);
      } else if (['.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx'].includes(ext)) {
        await officeToPdf(inputPath, thumbnailsDir);
        const pdfPath = path.join(thumbnailsDir, `${baseName}.pdf`);
        await pdfToThumbnail(pdfPath, thumbPath);
      } else {
        const svgPath = path.join(thumbnailsDir, `thumb_${baseName}.svg`);
        await fsPromises.writeFile(svgPath, generateSvgPlaceholder(filename), 'utf-8');
      }

      await job.progress(60);

      const relativePath = StorageConfig.getRelativePath(selectedStorage, inputPath);
      const relativeThumbnail = `${selectedStorage}/uploads/thumbnails/thumb_${baseName}.png`;

      const asset = this.assetRepository.create({
        filename,
        original_name: filename,
        thumbnail: relativeThumbnail,
        file_type: mimetype,
        file_size: size,
        path: relativePath,
        storage_location: selectedStorage,
        keywords: [],
        create_by: userId,
        group_id: groupId,
        status: AssetStatus.ACTIVE,
      });

      const savedAsset = await this.assetRepository.save(asset);
      await this.saveMetadata(savedAsset, job);
      await job.progress(100);

      return {
        success: true,
        assetId: savedAsset.id,
        storageLocation: selectedStorage,
      };
    } catch (error) {
      this.logger.error(`Document processing failed: ${error?.message ?? error}`, error?.stack);
      throw error;
    }
  }

  @Process('cleanup-temp')
  async handleCleanup(job: Job<{ files: string[] }>) {
    this.logger.log(`Cleaning up temporary files`);

    for (const file of job.data.files) {
      try {
        await fsPromises.unlink(file);
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