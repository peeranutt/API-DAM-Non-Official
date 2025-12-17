// src/search/search.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, ILike, In } from 'typeorm';
import { Asset } from '../assets/entities/asset.entity';
import { SearchAssetsDto } from './dto/search-assets.dto';

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Asset)
    private assetRepository: Repository<Asset>,
  ) {}

  async advancedSearch(searchDto: SearchAssetsDto) {
    try {
      const {
        name,
        type,
        collection,
        fromDate,
        toDate,
        keywords,
        page = 1,
        limit = 20,
        sortBy = 'updatedAt',
        order = 'DESC'
      } = searchDto;

      const queryBuilder = this.assetRepository.createQueryBuilder('asset');

      // Apply filters
      if (name) {
        queryBuilder.andWhere('asset.name LIKE :name', { name: `%${name}%` });
      }

      if (type && type !== 'all') {
        queryBuilder.andWhere('asset.type = :type', { type });
      }

      if (collection) {
        queryBuilder.andWhere('asset.collection = :collection', { collection });
      }

      if (fromDate && toDate) {
        queryBuilder.andWhere('asset.updatedAt BETWEEN :fromDate AND :toDate', {
          fromDate,
          toDate,
        });
      } else if (fromDate) {
        queryBuilder.andWhere('asset.updatedAt >= :fromDate', { fromDate });
      } else if (toDate) {
        queryBuilder.andWhere('asset.updatedAt <= :toDate', { toDate });
      }

      if (keywords) {
        const keywordArray = keywords
          .split(',')
          .map(k => k.trim())
          .filter(k => k.length > 0);
        
        if (keywordArray.length > 0) {
          queryBuilder.andWhere('asset.keywords LIKE ANY(:keywords)', {
            keywords: keywordArray.map(k => `%${k}%`),
          });
        }
      }

      // Get total count
      const total = await queryBuilder.getCount();

      // Apply sorting and pagination
      queryBuilder.orderBy(`asset.${sortBy}`, order);
      queryBuilder.skip((page - 1) * limit);
      queryBuilder.take(limit);

      const data = await queryBuilder.getMany();

      return {
        success: true,
        data,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error('Advanced search error:', error);
      return {
        success: false,
        data: [],
        error: error.message,
        pagination: {
          total: 0,
          page: 1,
          limit: 20,
          totalPages: 0,
        },
      };
    }
  }

  async getAvailableFilters() {
    try {
      // Get unique types
      const types = await this.assetRepository
        .createQueryBuilder('asset')
        .select('DISTINCT asset.type', 'type')
        .orderBy('type', 'ASC')
        .getRawMany();

      // Get unique collections
      const collections = await this.assetRepository
        .createQueryBuilder('asset')
        .select('DISTINCT asset.collection', 'collection')
        .orderBy('collection', 'ASC')
        .getRawMany();

      // Get all keywords
      // const assets = await this.assetRepository.find({
      //   select: ['keywords'],
      // });

      // const allKeywords = assets
      //   .flatMap(asset => asset.keywords || [])
      //   .filter((keyword, index, self) => 
      //     keyword && self.indexOf(keyword) === index
      //   )
      //   .sort();

      return {
        success: true,
        data: {
          types: types.map(t => t.type).filter(Boolean),
          collections: collections.map(c => c.collection).filter(Boolean),
          // keywords: allKeywords.slice(0, 50), // Limit to 50 keywords
        },
      };
    } catch (error) {
      console.error('Error getting filters:', error);
      return {
        success: true,
        data: {
          types: ['image', 'video', 'document', 'audio'],
          collections: ['marketing', 'design', 'product', 'event'],
          keywords: ['sample', 'test', 'document', 'image'],
        },
      };
    }
  }

  async quickSearch(query: string) {
    try {
      const assets = await this.assetRepository.find({
        where: [
          { filename: ILike(`%${query}%`) },
          // { collection: ILike(`%${query}%`) },
        ],
        take: 10,
        order: { updated_at: 'DESC' },
      });

      return {
        success: true,
        data: assets,
      };
    } catch (error) {
      console.error('Quick search error:', error);
      return {
        success: false,
        data: [],
        error: error.message,
      };
    }
  }
}