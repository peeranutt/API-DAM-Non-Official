import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Group, GroupMember, GroupPermission } from './entities/group.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class GroupsService {
  constructor(
    @InjectRepository(Group)
    private groupRepository: Repository<Group>,
    @InjectRepository(GroupMember)
    private groupMemberRepository: Repository<GroupMember>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async createGroup(
    name: string,
    description: string,
    creatorId: number,
  ): Promise<Group> {
    const group = this.groupRepository.create({
      name,
      description,
      created_by: creatorId,
    });

    const savedGroup = await this.groupRepository.save(group);

    // Add creator as admin
    const creator = await this.userRepository.findOne({ where: { id: creatorId } });
    if (!creator) {
      throw new NotFoundException('Creator not found');
    }
    await this.addMember(savedGroup.id, creator.username, GroupPermission.ADMIN);

    return savedGroup;
  }

  async addMember(
    groupId: number,
    username: string,
    permission: GroupPermission = GroupPermission.MEMBER,
  ): Promise<GroupMember> {
    const user = await this.userRepository.findOne({ where: { username } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if already a member
    const existing = await this.groupMemberRepository.findOne({
      where: { group_id: groupId, user_id: user.id },
    });
    if (existing) {
      throw new ForbiddenException('User is already a member of this group');
    }

    const member = this.groupMemberRepository.create({
      group_id: groupId,
      user_id: user.id,
      permission,
    });

    return await this.groupMemberRepository.save(member);
  }

  async getUserGroups(userId: number): Promise<Group[]> {
    const members = await this.groupMemberRepository.find({
      where: { user_id: userId },
      relations: ['group'],
    });

    return members.map((member) => member.group);
  }

  async getGroupMembers(groupId: number): Promise<GroupMember[]> {
    return await this.groupMemberRepository.find({
      where: { group_id: groupId },
      relations: ['user'],
    });
  }

  async canUserViewGroup(groupId: number, userId: number): Promise<boolean> {
    const permission = await this.checkUserPermission(groupId, userId);
    return permission !== null;
  }

  async checkUserPermission(
    groupId: number,
    userId: number,
  ): Promise<GroupPermission | null> {
    const member = await this.groupMemberRepository.findOne({
      where: { group_id: groupId, user_id: userId },
    });

    return member ? member.permission : null;
  }

  async canUserUploadToGroup(
    groupId: number,
    userId: number,
  ): Promise<boolean> {
    const permission = await this.checkUserPermission(groupId, userId);
    return (
      permission === GroupPermission.ADMIN ||
      permission === GroupPermission.MEMBER
    );
  }

  async removeMember(groupId: number, userId: number): Promise<void> {
    const member = await this.groupMemberRepository.findOne({
      where: { group_id: groupId, user_id: userId },
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    await this.groupMemberRepository.remove(member);
  }

  async updateMemberPermission(
    groupId: number,
    memberUserId: number,
    newPermission: GroupPermission,
  ): Promise<GroupMember> {
    const member = await this.groupMemberRepository.findOne({
      where: { group_id: groupId, user_id: memberUserId },
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    member.permission = newPermission;
    return await this.groupMemberRepository.save(member);
  }
}
