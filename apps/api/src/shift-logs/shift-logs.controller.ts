import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { ShiftLogsService, WRITE_ROLES } from './shift-logs.service';
import { CreateShiftLogDto } from './dto/create-shift-log.dto';

@Controller('shift-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ShiftLogsController {
  constructor(
    private readonly shiftLogsService: ShiftLogsService,
    private readonly prisma: PrismaService,
  ) {}

  // Kitchen-scoped-controller pattern (see Notes/Tasks/Recipes):
  // derive the caller's own kitchenId server-side, never trust the URL.
  private async caller(
    userId: string,
  ): Promise<{ id: string; kitchenId: string; role: Role }> {
    const caller = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!caller) {
      throw new UnauthorizedException('Caller no longer exists');
    }
    return { id: caller.id, kitchenId: caller.kitchenId, role: caller.role };
  }

  @Get()
  async list(
    @Query('date') date: string | undefined,
    @Req() req: { user: { sub: string } },
  ) {
    const { kitchenId } = await this.caller(req.user.sub);
    return this.shiftLogsService.list(kitchenId, date);
  }

  @Post()
  @Roles(...WRITE_ROLES)
  async create(
    @Body() dto: CreateShiftLogDto,
    @Req() req: { user: { sub: string } },
  ) {
    const { kitchenId, id } = await this.caller(req.user.sub);
    return this.shiftLogsService.create(kitchenId, id, dto);
  }
}
