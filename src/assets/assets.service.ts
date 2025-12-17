import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue} from '@nestjs/bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Queue } from 'bull';
import * as fs from 'fs';
import * as path from 'path';
import { Asset, AssetStatus } from './entities/asset.entity';
import { MetadataField } from './entities/metadata-field.entity';
import { AssetMetadata } from './entities/asset-metadata.entity';
import {AssetJobData} from './processeors/asset.processor';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';

@Injectable()
export class AssetsService {
  constructor(
    @InjectQueue('assets') private assetQueue: Queue,
    @InjectRepository(Asset) private assetRepository: Repository<Asset>,
    @InjectRepository(MetadataField)
    private metadataFieldRepository: Repository<MetadataField>,
    @InjectRepository(AssetMetadata)
    private assetMetadataRepository: Repository<AssetMetadata>,
  ) {}

  async processAsset(file: Express.Multer.File, userId?: number) {
    const jobData: AssetJobData = {
      filename: file.filename,
      originalPath: file.path,
      mimetype: file.mimetype,
      size: file.size,
      userId,
    };
    // choose job type based on mimetype
    let jobName = 'process-image';
    if (file.mimetype === 'application/pdf') jobName = 'process-pdf';
    else if (file.mimetype && file.mimetype.startsWith('video/')) jobName = 'process-video';

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
  ) {
    const assetPartial: Partial<Asset> = {
      filename,
      file_type: fileType,
      file_size: fileSize,
      path: filePath,
      create_by: userId ?? 0,
      status: AssetStatus.ACTIVE,
    };

    const asset = this.assetRepository.create(assetPartial);
    return await this.assetRepository.save(asset);
  }

  async saveAssetMetadata(
    assetId: number,
    metadataList: { fieldId: number; value: string }[],
  ) {
    const metadata = metadataList.map((item) =>
      this.assetMetadataRepository.create({
        asset_id: assetId,
        field_id: item.fieldId,
        value: item.value,
      }),
    );

    return await this.assetMetadataRepository.save(metadata);
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

  async findAll(): Promise<Asset[]> {
    // ดึง Asset ทั้งหมดจากฐานข้อมูล
    return this.assetRepository.find(); 
  }

  async findOne(id: number) {
    return await this.assetRepository.findOne({
      where: { id },
      relations: ['metadata'],
    });
  }

  async getFileStream(
    id: string,
  ): Promise<{ readStream: fs.ReadStream; fileMimeType: string; fileName: string }> {
    const assetId = parseInt(id, 10);
    
    const asset = await this.assetRepository.findOne({ where: { id: assetId } });
    
    if (!asset) {
      throw new NotFoundException(`Asset with ID ${id} not found`);
    }

    const filePath = path.join(process.cwd(), asset.path);

    //สำหรับ Debugging สามารถลบทิ้งได้หลังจากแก้ไขเสร็จ
    console.log(`Attempting to read file at path: ${filePath}`); 

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(`Asset file for ID ${id} not found on disk`);
    }

    const readStream = fs.createReadStream(filePath);

    return {
      readStream: readStream,
      fileMimeType: asset.file_type, 
      fileName: asset.filename, 
    };
  }

  async getMetadataFields() {
    return await this.metadataFieldRepository.find();
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
