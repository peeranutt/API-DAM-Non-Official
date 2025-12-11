import { Injectable } from '@nestjs/common';
import { InjectQueue} from '@nestjs/bull';
import type { Queue } from 'bull';
import {AssetJobData} from './processeors/asset.processor';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';

@Injectable()
export class AssetsService {
  constructor(
    @InjectQueue('assets') private assetQueue: Queue,
  ) {}

  async processAsset(file: Express.Multer.File) {
    const jobData: AssetJobData = {
      filename: file.filename,
      originalPath: file.path,
      mimetype: file.mimetype,
      size: file.size,
    };
    const job = await this.assetQueue.add('process-image', jobData, {
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

  create(createAssetDto: CreateAssetDto) {
    return 'This action adds a new asset';
  }

  findAll() {
    return `This action returns all assets`;
  }

  findOne(id: number) {
    return `This action returns a #${id} asset`;
  }

  update(id: number, updateAssetDto: UpdateAssetDto) {
    return `This action updates a #${id} asset`;
  }

  remove(id: number) {
    return `This action removes a #${id} asset`;
  }
}
