import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, IsDate, IsIn, IsNumber, Min, Max } from 'class-validator';

export class SearchAssetsDto {
  @ApiPropertyOptional({ description: 'ชื่อไฟล์' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ 
    description: 'ประเภทไฟล์',
    enum: ['image', 'video', 'document', 'audio', 'all']
  })
  @IsOptional()
  @IsIn(['image', 'video', 'document', 'audio', 'all'])
  type?: string;

  @ApiPropertyOptional({ description: 'คอลเลคชัน' })
  @IsOptional()
  @IsString()
  collection?: string;

  @ApiPropertyOptional({ description: 'วันที่เริ่มต้น (ISO string)' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  fromDate?: Date;

  @ApiPropertyOptional({ description: 'วันที่สิ้นสุด (ISO string)' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  toDate?: Date;

  @ApiPropertyOptional({ description: 'คำสำคัญ (คั่นด้วย comma)' })
  @IsOptional()
  @IsString()
  keywords?: string;

  @ApiPropertyOptional({ 
    description: 'เรียงตาม',
    enum: ['name', 'updatedAt', 'createdAt', 'size'],
    default: 'updatedAt'
  })
  @IsOptional()
  @IsIn(['name', 'updatedAt', 'createdAt', 'size'])
  sortBy?: string = 'updatedAt';

  @ApiPropertyOptional({ 
    description: 'ทิศทางการเรียง',
    enum: ['ASC', 'DESC'],
    default: 'DESC'
  })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  order?: 'ASC' | 'DESC' = 'DESC';

  @ApiPropertyOptional({ description: 'หน้า', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'จำนวนต่อหน้า', default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;
}