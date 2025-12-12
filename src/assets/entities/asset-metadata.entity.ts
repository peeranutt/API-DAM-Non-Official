import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Asset } from './asset.entity';
import { MetadataField } from './metadata-field.entity';

@Entity({ name: 'asset_metadata' })
export class AssetMetadata {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'int',
  })
  asset_id: number;

  @ManyToOne(() => Asset, (asset) => asset.metadata)
  @JoinColumn({ name: 'asset_id' })
  asset: Asset;

  @Column({
    type: 'int',
  })
  field_id: number;

  @ManyToOne(() => MetadataField)
  @JoinColumn({ name: 'field_id' })
  field: MetadataField;

  @Column({
    type: 'varchar',
    length: 255,
  })
  value: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}