import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';

//จัดการ background jobs => processing asset
@Module({
  imports: [
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
      },
    }),
  ],
})
export class QueueModule {}