import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Collection } from './entities/collection.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class CollectionsService {
  constructor(
    @InjectRepository(Collection)
    private collectionRepository: Repository<Collection>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async createCollection(
    name: string,
    creatorId: number,
  ): Promise<Collection> {
    const collection = this.collectionRepository.create({
      name,
      create_by: creatorId,
    });

    return await this.collectionRepository.save(collection);
  }

  async getCollections(userId: number): Promise<Collection[]> {
    return await this.collectionRepository.find({
      where: { create_by: userId },
    });
  }
}