import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum MetadataFieldType {
  TEXT = 'text',
  NUMBER = 'number',
  DATE = 'date',
  SELECT = 'select',
  BOOLEAN = 'boolean',
}

@Entity({ name: 'metadata_fields' })
export class MetadataField {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'varchar',
    length: 100,
    unique: true,
  })
  name: string;

  @Column({
    type: 'enum',
    enum: MetadataFieldType,
  })
  type: MetadataFieldType;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  options?: string | null; // JSON string for select options

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}