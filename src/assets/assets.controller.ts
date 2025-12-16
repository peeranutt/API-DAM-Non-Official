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
import iconv from 'iconv-lite';

@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          // ชื่อไฟล์
          let originalname = file.originalname;
          try {
            const buffer = Buffer.from(originalname, 'latin1');
            originalname = iconv.decode(buffer, 'utf8');
          } catch (error) {
            console.error('Error decoding filename:', error);
          }
          const cleanName = originalname.replace(/\s+/g, '_');
          // สกุลไฟล์
          const fileExtName = extname(originalname);

          const baseName = cleanName.replace(fileExtName, '');

          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);

          const uniqueName = baseName + '-' + uniqueSuffix;

          cb(null, uniqueName + fileExtName);
        },
      }),
    }),
  )
  async uploadSingle(@UploadedFile() file: Express.Multer.File) {
    console.log('Original filename:', file.originalname); // ควรเป็นชื่อภาษาไทยที่ถูกต้อง
    console.log('Saved filename:', file.filename); // ชื่อไฟล์ที่บันทึก

    console.log('file now:', file);
    const job = await this.assetsService.processAsset(file, 1); // userId hardcoded as 1 for now
    console.log('job now:', job);
    return {
      success: true,
      jobId: job.id,
      filename: file.filename,
      originalFilename: file.originalname,
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
