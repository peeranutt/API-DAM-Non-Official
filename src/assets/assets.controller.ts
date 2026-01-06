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
  Res,
  Req,
  Put,
  NotFoundException,
  UploadedFiles,
  BadRequestException,
  ForbiddenException,
  Query,
} from '@nestjs/common';
import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import iconv from 'iconv-lite';
import type { Response } from 'express';
import * as path from 'path';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import * as fs from 'fs';
import { sha256File } from './processeors/hash';
import { GroupsService } from '../groups/groups.service';
import { UseGuards } from '@nestjs/common/decorators/core/use-guards.decorator';

interface UploadJobResult {
  jobId: string;
  filename: string;
  checksum: string;
}

@Controller('assets')
export class AssetsController {
  constructor(
    private readonly assetsService: AssetsService,
    private readonly groupsService: GroupsService,
  ) {}

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          console.log('Original filename:', file.originalname);
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
          console.log('Saved file as:', uniqueName + fileExtName);
        },
      }),
    }),
  )
  async uploadMultiple(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('checksums') checksums: string[],
    @Body('groupId') groupId: string | undefined,
    @Req() req: Request,
  ) {
    const userId = (req as any).user.id;

    // If groupId is provided, check if user can upload to that group
    if (groupId) {
      const canUpload = await this.assetsService.canUserUploadToGroup(+groupId, userId);
      if (!canUpload) {
        throw new BadRequestException('You do not have permission to upload to this group');
      }
    }

    const checksumArray = Array.isArray(checksums) ? checksums : [checksums];

    if (files.length !== checksumArray.length) {
      throw new Error('Number of files and checksums do not match');
    }

    console.log('file now:', files);
    const jobs: UploadJobResult[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const clientHash = checksumArray[i];
      const serverHash = await sha256File(file.path);

      if (clientHash !== serverHash) {
        // ไฟล์เสีย / upload ไม่ครบ
        fs.unlinkSync(file.path);
        throw new BadRequestException(
          `Checksum mismatch: ${file.originalname}`,
        );
      }

      // checksum ตรง
      const job = await this.assetsService.processAsset(file, userId, groupId ? +groupId : undefined);
      jobs.push({
        jobId: String(job.id),
        filename: file.originalname,
        checksum: serverHash,
      });
    }

    return { success: true, count: files.length, jobs };
  }

  @Put(':assetId/metadata')
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
  @UseGuards(JwtAuthGuard)
  async findAll(@Req() req: Request) {
    const userId = (req as any).user.id;
    return this.assetsService.findAll(userId);
  }

  @Get('file/:id')
  @UseGuards(JwtAuthGuard)
  async getFile(
    @Param('id') id: string,
    @Query('type') type: 'thumb' | 'original',
    @Res() res: Response,
    @Req() req: Request,
  ) {
    const userId = (req as any).user.id;

    // Check if user can access this asset
    const canAccess = await this.assetsService.canUserAccessAsset(+id, userId);
    if (!canAccess) {
      return res
        .status(403)
        .send('You do not have permission to access this asset');
    }

    try {
      const { readStream, fileMimeType, fileName } =
        await this.assetsService.getFileStream(id, type);

      const encodedFilename = encodeURIComponent(fileName);

      if (!readStream) {
        return res.status(404).send('Asset file not found');
      }

      res.setHeader('Content-Type', fileMimeType);
      res.setHeader(
        'Content-Disposition',
        `inline; filename="file"; filename*=UTF-8''${encodedFilename}`,
      );
      readStream.pipe(res);
    } catch (error) {
      console.error('Error serving asset file:', error);
      res.status(500).send('Internal server error');
    }
  }

  @Get(':id/download')
  @UseGuards(JwtAuthGuard)
  async downloadAsset(
    @Param('id') id: number,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    const userId = (req as any).user.id;

    // Check if user can access this asset
    const canAccess = await this.assetsService.canUserAccessAsset(id, userId);
    if (!canAccess) {
      return res
        .status(403)
        .send('You do not have permission to access this asset');
    }

    const asset = await this.assetsService.getAssetForDownload(id);

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    return res.download(asset.fullPath, asset.original_name);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string, @Req() req: Request) {
    const userId = (req as any).user.id;
    const asset = await this.assetsService.findOne(+id);

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    // Check if user can access this asset
    const canAccess = await this.assetsService.canUserAccessAsset(+id, userId);
    if (!canAccess) {
      throw new ForbiddenException(
        'You do not have permission to access this asset',
      );
    }

    return asset;
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
