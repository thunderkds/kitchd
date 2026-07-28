import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsersService } from './users.service';
import { InviteUserDto } from './dto/invite-user.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { UpdateThemeDto } from './dto/update-theme.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('invite')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  invite(@Body() dto: InviteUserDto, @Req() req: { user: { sub: string } }) {
    return this.usersService.invite(req.user.sub, dto);
  }

  @Post('invite/accept')
  acceptInvite(@Body() dto: AcceptInviteDto) {
    return this.usersService.acceptInvite(dto);
  }

  @Patch('me/theme')
  @UseGuards(JwtAuthGuard)
  updateTheme(
    @Body() dto: UpdateThemeDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.usersService.updateTheme(req.user.sub, dto.theme);
  }

  @Get('invites')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  listPendingInvites(@Req() req: { user: { sub: string } }) {
    return this.usersService.listPendingInvites(req.user.sub);
  }

  // Static segment — must stay above the bare @Get() / @Get(':id')-style
  // routes so it is not shadowed. CHEF is included here and nowhere else in
  // this controller: the payload is id/email only, not the member roster.
  @Get('assignable')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN, Role.CHEF)
  listAssignableUsers(@Req() req: { user: { sub: string } }) {
    return this.usersService.listAssignableUsers(req.user.sub);
  }

  @Delete('invites/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  revokeInvite(@Param('id') id: string, @Req() req: { user: { sub: string } }) {
    return this.usersService.revokeInvite(req.user.sub, id);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  listMembers(@Req() req: { user: { sub: string } }) {
    return this.usersService.listMembers(req.user.sub);
  }

  @Patch(':id/role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.usersService.updateRole(req.user.sub, id, dto.role);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  removeMember(@Param('id') id: string, @Req() req: { user: { sub: string } }) {
    return this.usersService.deactivate(req.user.sub, id);
  }
}
