import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { SearchAssetsDto } from './dto/search-assets.dto';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Post('advanced')
  @ApiOperation({ summary: 'ค้นหาไฟล์แบบขั้นสูง' })
  @ApiResponse({ status: 200, description: 'ผลลัพธ์การค้นหา' })
  async advancedSearch(@Body() searchDto: SearchAssetsDto) {
    return this.searchService.advancedSearch(searchDto);
  }

  @Get('filters')
  @ApiOperation({ summary: 'ดึงค่าตัวกรองทั้งหมด' })
  @ApiResponse({ status: 200, description: 'ค่าตัวกรอง' })
  async getFilters() {
    return this.searchService.getAvailableFilters();
  }

  @Get('quick')
  @ApiOperation({ summary: 'ค้นหาแบบรวดเร็ว' })
  async quickSearch(@Query('q') query: string) {
    return this.searchService.quickSearch(query);
  }
}