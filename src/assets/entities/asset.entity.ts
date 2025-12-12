import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { AssetMetadata } from './asset-metadata.entity';

export enum AssetStatus {
  ACTIVE = 'active',
  DELETED = 'deleted',
}

@Entity({ name: 'assets' })
export class Asset {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'varchar',
    length: 255,
  })
  filename: string;

  @Column({
    type: 'varchar',
    length: 50,
  })
  file_type: string;

  @Column({
    type: 'bigint',
    nullable: true,
  })
  file_size: number;

  @Column({
    type: 'varchar',
  })
  path: string;

  @Column({
    type: 'enum',
    enum: AssetStatus,
    default: AssetStatus.ACTIVE,
  })
  status: AssetStatus;

  @Column({
    type: 'int',
    nullable: true,
  })
  create_by: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'create_by' })
  creator: User;

  @OneToMany(() => AssetMetadata, (metadata) => metadata.asset, {
    cascade: true,
    eager: true,
  })
  metadata: AssetMetadata[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}