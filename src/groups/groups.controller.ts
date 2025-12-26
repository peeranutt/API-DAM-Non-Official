import { Controller, Get, Post, Delete, Body, Param, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GroupPermission } from './entities/group.entity';

@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async createGroup(
    @Body() body: { name: string; description?: string },
    @Req() req: Request,
  ) {
    const userId = (req as any).user.id;
    const group = await this.groupsService.createGroup(body.name, body.description || '', userId);
    return { success: true, group };
  }

  @Post(':groupId/members')
  @UseGuards(JwtAuthGuard)
  async addMember(
    @Param('groupId') groupId: number,
    @Body() body: { username: string; permission?: GroupPermission },
    @Req() req: Request,
  ) {
    const userId = (req as any).user.id;
    const permission = await this.groupsService.checkUserPermission(groupId, userId);

    if (permission !== GroupPermission.ADMIN) {
      throw new ForbiddenException('Only group admins can add members');
    }

    const member = await this.groupsService.addMember(groupId, body.username, body.permission);
    return { success: true, member };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getUserGroups(@Req() req: Request) {
    const userId = (req as any).user.id;
    const groups = await this.groupsService.getUserGroups(userId);
    return { success: true, groups };
  }

  @Get(':groupId/members')
  @UseGuards(JwtAuthGuard)
  async getGroupMembers(@Param('groupId') groupId: number, @Req() req: Request) {
    const userId = (req as any).user.id;
    const canView = await this.groupsService.canUserViewGroup(groupId, userId);

    if (!canView) {
      throw new ForbiddenException('You do not have permission to view this group');
    }

    const members = await this.groupsService.getGroupMembers(groupId);
    return { success: true, members };
  }

  @Delete(':groupId/members/:userId')
  @UseGuards(JwtAuthGuard)
  async removeMember(
    @Param('groupId') groupId: number,
    @Param('userId') memberUserId: number,
    @Req() req: Request,
  ) {
    const userId = (req as any).user.id;
    const permission = await this.groupsService.checkUserPermission(groupId, userId);

    if (permission !== GroupPermission.ADMIN) {
      throw new ForbiddenException('Only group admins can remove members');
    }

    await this.groupsService.removeMember(groupId, memberUserId);
    return { success: true, message: 'Member removed' };
  }
}