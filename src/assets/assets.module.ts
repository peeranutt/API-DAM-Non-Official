import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssetsService } from './assets.service';
import { AssetsController } from './assets.controller';
import { AssetProcessor } from './processeors/asset.processor';
import { BullModule } from '@nestjs/bull';
import { Asset } from './entities/asset.entity';
import { MetadataField } from './entities/metadata-field.entity';
import { AssetMetadata } from './entities/asset-metadata.entity';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'assets',
    }),
    TypeOrmModule.forFeature([Asset, MetadataField, AssetMetadata]),
  ],
  controllers: [AssetsController],
  providers: [AssetsService, AssetProcessor],
})
export class AssetsModule {}
