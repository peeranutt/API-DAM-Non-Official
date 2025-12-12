import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const uniqueName =
            file.originalname + '-' + Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, uniqueName + extname(file.originalname));
        },
      }),
    }),
  )
  async uploadSingle(@UploadedFile() file: Express.Multer.File) {
    console.log('file now:', file);
    const job = await this.assetsService.processAsset(file, 1); // userId hardcoded as 1 for now
    console.log('job now:', job);
    return {
      success: true,
      jobId: job.id,
      filename: file.filename,
      message: 'File uploaded and queued for processing',
    };
  }

  @Post(':assetId/metadata')
  async saveMetadata(
    @Param('assetId') assetId: number,
    @Body() body: { metadata: { fieldId: number; value: string }[] },
  ) {
    await this.assetsService.saveAssetMetadata(assetId, body.metadata);
    return { success: true, message: 'Metadata saved' };
  }

  @Get('job/:jobId')
  async getJobStatus(@Param('jobId') jobId: string) {
    return this.assetsService.getJobStatus(jobId);
  }

  @Get('metadata-fields')
  async getMetadataFields() {
    return this.assetsService.getMetadataFields();
  }

  @Get()
  async findAll() {
    return this.assetsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.assetsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAssetDto: UpdateAssetDto) {
    return this.assetsService.update(+id, updateAssetDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.assetsService.remove(+id);
  }
}