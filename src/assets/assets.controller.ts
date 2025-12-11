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
            file.originalname + Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(
            null,
            uniqueName + extname(file.originalname),
          );
        },
      }),
    }),
  )
  async uploadSingle(@UploadedFile() file: Express.Multer.File){
    console.log("file now:",file);
    const job =await this.assetsService.processAsset(file)
    return {
      success: true,
      jobId: job.id,
      file: file.filename,
      message: 'File uploaded and queued for processing',
    };
  }
  // uploadSingle(@UploadedFile() file: Express.Multer.File){
  //   console.log(file);
  //   return { success: true, file: file.filename };
  // }
  // create(@Body() createAssetDto: CreateAssetDto) {
  //   return this.assetsService.create(createAssetDto);
  // }

  @Get('job/:jobId')
  async getJobStatus(@Param('jobId') jobId: string) {
    return this.assetsService.getJobStatus(jobId);
  }

  @Get()
  findAll() {
    return this.assetsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
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
