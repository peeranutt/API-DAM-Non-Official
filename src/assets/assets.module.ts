import { Module } from '@nestjs/common';
import { AssetsService } from './assets.service';
import { AssetsController } from './assets.controller';
import { AssetProcessor } from './processeors/asset.processor';
import { BullModule } from '@nestjs/bull';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'assets',
    })
  ],
  controllers: [AssetsController],
  providers: [AssetsService],
})
export class AssetsModule {}
