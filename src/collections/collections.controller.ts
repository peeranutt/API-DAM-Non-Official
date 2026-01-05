import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { CollectionsService } from './collections.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('collections')
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Post()
//   @UseGuards(JwtAuthGuard)
  async createCollection(
    @Body() body: { name: string; description?: string },
    @Req() req: Request,
  ) {
    try {
    //   const userId = (req as any).user.id;
    const userId = 1;
      const collection = await this.collectionsService.createCollection(
        body.name,
        userId,
      );
      return { success: true, collection };
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getCollections(@Req() req: Request) {
    const userId = (req as any).user.id;
    const collections = await this.collectionsService.getCollections(userId);
    return { success: true, collections };
  }
}
