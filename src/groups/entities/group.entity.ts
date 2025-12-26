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

export enum GroupPermission {
  ADMIN = 'admin',
  MEMBER = 'member',
  VIEWER = 'viewer',
}

@Entity({ name: 'user_groups' })
export class Group {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'varchar',
    length: 100,
  })
  name: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  description: string;

  @Column({
    type: 'int',
  })
  created_by: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @OneToMany(() => GroupMember, (member) => member.group, {
    cascade: true,
  })
  members: GroupMember[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

@Entity({ name: 'group_members' })
export class GroupMember {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'int',
  })
  group_id: number;

  @Column({
    type: 'int',
  })
  user_id: number;

  @Column({
    type: 'enum',
    enum: GroupPermission,
    default: GroupPermission.MEMBER,
  })
  permission: GroupPermission;

  @ManyToOne(() => Group, (group) => group.members)
  @JoinColumn({ name: 'group_id' })
  group: Group;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}