import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue} from '@nestjs/bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import type { Queue } from 'bull';
import * as fs from 'fs';
import * as path from 'path';
import { Asset, AssetStatus } from './entities/asset.entity';
import { MetadataField } from './entities/metadata-field.entity';
import { AssetMetadata } from './entities/asset-metadata.entity';
import {AssetJobData} from './processeors/asset.processor';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { GroupsService } from '../groups/groups.service';

@Injectable()
export class AssetsService {
  constructor(
    @InjectQueue('assets') private assetQueue: Queue,
    @InjectRepository(Asset) private assetRepository: Repository<Asset>,
    @InjectRepository(MetadataField)
    private metadataFieldRepository: Repository<MetadataField>,
    @InjectRepository(AssetMetadata)
    private assetMetadataRepository: Repository<AssetMetadata>,
    private groupsService: GroupsService,
  ) {}

  async processAsset(file: Express.Multer.File, userId?: number, groupId?: number, storageUrl?: string) {
    const jobData: AssetJobData = {
      filename: file.filename,
      originalPath: file.path,
      storageUrl: storageUrl || '',
      mimetype: file.mimetype,
      size: file.size,
      userId,
      groupId,
    };
    // choose job type based on mimetype
    // let jobName = 'process-image';
    // if (file.mimetype === 'application/pdf') jobName = 'process-pdf';
    // else if (file.mimetype && file.mimetype.startsWith('video/')) jobName = 'process-video';

    let jobName: string;

    if (file.mimetype.startsWith('image/')) {
      jobName = 'process-image';
    } else if (file.mimetype.startsWith('video/')) {
      jobName = 'process-video';
    } else {
      console.log('Processing as document');
      jobName = 'process-document';
    }

    const job = await this.assetQueue.add(jobName, jobData, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: false,
      removeOnFail: false,
    });

    return job;
  }

  async saveAsset(
    filename: string,
    fileType: string,
    fileSize: number,
    filePath: string,
    userId?: number,
    groupId?: number,
  ) {
    const assetPartial: Partial<Asset> = {
      filename,
      file_type: fileType,
      file_size: fileSize,
      path: filePath,
      create_by: userId ?? 0,
      group_id: groupId,
      status: AssetStatus.ACTIVE,
    };

    const asset = this.assetRepository.create(assetPartial);
    return await this.assetRepository.save(asset);
  }

  async saveAssetMetadata(
  assetId: number,
  metadata: { fieldId: number; value: string }[],
) {
  const asset = await this.assetRepository.findOne({
    where: { id: assetId },
  });

  if (!asset) {
    throw new NotFoundException('Asset not found');
  }

  // โหลด metadata_fields
  const fieldIds = metadata.map((m) => m.fieldId);

  const fields = await this.metadataFieldRepository.find({
    where: { id: In(fieldIds) },
  });

  const fieldsById = Object.fromEntries(
    fields.map((f) => [f.id, f]),
  );

  // โหลด asset_metadata เดิม
  const existingMetadata = await this.assetMetadataRepository.find({
    where: {
      asset: { id: assetId },
      field: { id: In(fieldIds) },
    },
    relations: ['field'],
  });

  const existingByFieldId = Object.fromEntries(
    existingMetadata.map((m) => [m.field.id, m]),
  );

  // update / insert metadata
  let newTitle: string | null = null;

  for (const { fieldId, value } of metadata) {
    const field = fieldsById[fieldId];
    if (!field) continue;

    // ถ้าเป็น title → เก็บไว้ไป update asset
    if (field.name === 'title') {
      newTitle = value;
    }

    const existing = existingByFieldId[fieldId];

    if (existing) {
      existing.value = value;
      await this.assetMetadataRepository.save(existing);
    } else {
      await this.assetMetadataRepository.save(
        this.assetMetadataRepository.create({
          asset,
          field,
          value,
        }),
      );
    }
  }

  // update asset (title + updated_at)
  const assetUpdate: Partial<Asset> = {
    updated_at: new Date(), // update timestamp
  };

  if (newTitle !== null && newTitle !== '') {
    assetUpdate.filename = newTitle; // sync title → filename
  }

  await this.assetRepository.update(assetId, assetUpdate);
}


  async getJobStatus(jobId: string) {
    const job = await this.assetQueue.getJob(jobId);
    
    if (!job) {
      return { error: 'Job not found' };
    }

    const state = await job.getState();
    const progress = job.progress();
    const result = job.returnvalue;

    return {
      id: job.id,
      state,
      progress,
      result,
      timestamp: job.timestamp,
    };
  }

  async canUserAccessAsset(assetId: number, userId: number): Promise<boolean> {
    const asset = await this.assetRepository.findOne({
      where: { id: assetId },
    });

    if (!asset) {
      return false;
    }

    // If it's a personal asset, only the creator can access it
    if (!asset.group_id) {
      return asset.create_by === userId;
    }

    // If it's a group asset, check if user is a member of the group
    return await this.groupsService.canUserViewGroup(asset.group_id, userId);
  }

  async canUserUploadToGroup(groupId: number, userId: number): Promise<boolean> {
    return await this.groupsService.canUserUploadToGroup(groupId, userId);
  }

  async findAll(userId: number): Promise<Asset[]> {
    // Get user's groups
    let groupIds: number[] = [];
    try {
      const userGroups = await this.groupsService.getUserGroups(userId);
      groupIds = userGroups.map(group => group.id);
    } catch (error) {
      // If groups table doesn't exist yet, ignore and use only personal assets
      console.warn('Groups service not available, using only personal assets');
    }

    // Find assets that are either:
    // 1. Created by the user (personal assets)
    // 2. Belong to groups where the user is a member
    const whereCondition: any[] = [
      { create_by: userId },
    ];

    if (groupIds.length > 0) {
      whereCondition.push({ group_id: In(groupIds) });
    }

    return this.assetRepository.find({
      where: whereCondition,
      relations: ['creator'], // Temporarily remove 'group' until groups table is created
    });
  }

  async findOne(id: number) {
    return await this.assetRepository.findOne({
      where: { id },
      relations: ['metadata'],
    });
  }

  async getFileStream(
  id: string,
  type: 'thumb' | 'original' = 'thumb',
): Promise<{
  readStream: any;
  fileMimeType: string;
  fileName: string;
}> {
  const assetId = Number(id);

  const asset = await this.assetRepository.findOne({
    where: { id: assetId },
  });

  if (!asset) {
    throw new NotFoundException(`Asset ${id} not found`);
  }

  const relativePath =
    type === 'thumb' && asset.thumbnail
      ? asset.thumbnail
      : asset.path;

  const filePath = path.join(process.cwd(), relativePath);

  console.log('Serving file:', filePath);

  if (!fs.existsSync(filePath)) {
    throw new NotFoundException('File not found on disk');
  }

  const mimeType =
    type === 'thumb'
      ? 'image/png'
      : asset.file_type;

  return {
    readStream: fs.createReadStream(filePath),
    fileMimeType: mimeType,
    fileName: path.basename(filePath),
  };
}


  async getMetadataFields() {
    return await this.metadataFieldRepository.find();
  }

  async getAssetForDownload(id: number){
    const asset = await this.assetRepository.findOne({
      where: { id },
    });

    if (!asset) return null;

    const fullPath = path.resolve(asset.path);

    if (!fs.existsSync(fullPath)) {
      return null;
    }

    return {
      fullPath,
      original_name: asset.original_name
    }
  }

  async searchByFilters(filters: any) {
    const { name, type, collection, dateRange, keywords } = filters;
    
    let query = this.assetRepository.createQueryBuilder('asset');

    if (name) {
      query.andWhere('asset.name LIKE :name', { name: `%${name}%` });
    }

    if (type) {
      query.andWhere('asset.type = :type', { type });
    }

    if (collection) {
      query.andWhere('asset.collection = :collection', { collection });
    }

    if (dateRange && dateRange.start && dateRange.end) {
      query.andWhere('asset.updatedAt BETWEEN :start AND :end', {
        start: dateRange.start,
        end: dateRange.end,
      });
    }

    if (keywords && keywords.length > 0) {
      query.andWhere('asset.keywords && :keywords', { keywords });
    }

    return query.getMany();
  }

  async getSearchSuggestions(query: string) {
    const suggestions = await this.assetRepository
      .createQueryBuilder('asset')
      .select(['DISTINCT asset.name', 'asset.type', 'asset.collection'])
      .where('asset.name ILIKE :query', { query: `%${query}%` })
      .orWhere('asset.collection ILIKE :query', { query: `%${query}%` })
      .limit(10)
      .getRawMany();

    return suggestions;
  }

  create(createAssetDto: CreateAssetDto) {
    return 'This action adds a new asset';
  }

  update(id: number, updateAssetDto: UpdateAssetDto) {
    return `This action updates a #${id} asset`;
  }

  remove(id: number) {
    return `This action removes a #${id} asset`;
  }
}
