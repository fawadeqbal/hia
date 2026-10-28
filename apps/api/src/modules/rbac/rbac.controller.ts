import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  Role,
  type AccessDto,
  type AuditLogItem,
  type JwtPayload,
  type Paginated,
  type RoleDto,
  type StaffUserDto,
} from '@ecommerce/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  AuditLogQueryDto,
  CreateRoleDto,
  InviteStaffDto,
  UpdateRoleDto,
  UpdateStaffRolesDto,
} from './dto/rbac.dto';
import { RbacService } from './rbac.service';

/** Any signed-in user: which admin areas they can open (used to build the admin menu). */
@ApiTags('RBAC')
@ApiBearerAuth()
@Controller('rbac')
export class RbacController {
  constructor(private readonly rbac: RbacService) {}

  @Get('me')
  me(@CurrentUser('sub') userId: string): Promise<AccessDto> {
    return this.rbac.myAccess(userId);
  }
}

/** Settings area (super admins, or custom roles with settings permissions). */
@ApiTags('Admin · Roles & staff')
@ApiBearerAuth()
@Roles(Role.SUPER_ADMIN)
@Controller('admin')
export class AdminRbacController {
  constructor(private readonly rbac: RbacService) {}

  @Get('roles')
  roles(): Promise<RoleDto[]> {
    return this.rbac.roles();
  }

  @Post('roles')
  createRole(@Body() dto: CreateRoleDto, @CurrentUser('sub') actorId: string): Promise<RoleDto> {
    return this.rbac.createRole(dto, actorId);
  }

  @Patch('roles/:id')
  updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<RoleDto> {
    return this.rbac.updateRole(id, dto, actorId);
  }

  @Delete('roles/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeRole(@Param('id') id: string, @CurrentUser('sub') actorId: string): Promise<void> {
    return this.rbac.removeRole(id, actorId);
  }

  @Get('staff')
  staff(): Promise<StaffUserDto[]> {
    return this.rbac.staff();
  }

  @Post('staff')
  invite(@Body() dto: InviteStaffDto, @CurrentUser() actor: JwtPayload): Promise<StaffUserDto> {
    return this.rbac.inviteStaff(dto, { sub: actor.sub, roles: actor.roles });
  }

  @Put('staff/:id/roles')
  updateRoles(
    @Param('id') id: string,
    @Body() dto: UpdateStaffRolesDto,
    @CurrentUser() actor: JwtPayload,
  ): Promise<StaffUserDto> {
    return this.rbac.updateStaffRoles(id, dto.roleIds, { sub: actor.sub, roles: actor.roles });
  }

  @Post('staff/:id/activate')
  activate(@Param('id') id: string, @CurrentUser('sub') actorId: string): Promise<StaffUserDto> {
    return this.rbac.setStaffActive(id, true, actorId);
  }

  @Post('staff/:id/deactivate')
  deactivate(@Param('id') id: string, @CurrentUser('sub') actorId: string): Promise<StaffUserDto> {
    return this.rbac.setStaffActive(id, false, actorId);
  }

  @Get('audit-logs')
  auditLogs(@Query() q: AuditLogQueryDto): Promise<Paginated<AuditLogItem>> {
    return this.rbac.auditLogs({
      page: q.page,
      limit: q.limit,
      action: q.action,
      entityType: q.entityType,
      actor: q.actor,
      from: q.from,
      to: q.to,
    });
  }
}
