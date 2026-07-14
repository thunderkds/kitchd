import { Body, Controller, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsersService } from './users.service';
import { InviteUserDto } from './dto/invite-user.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { UpdateThemeDto } from './dto/update-theme.dto';

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
}
