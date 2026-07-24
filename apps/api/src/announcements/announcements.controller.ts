import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';

// FR-021: "Owner/Chef broadcasts to all Staff" — narrower than the
// Guidelines/Inventory Owner/Admin/Chef gate and the Notes
// everyone-but-Viewer gate. Admin is deliberately excluded here per the
// PRD's literal wording.
const WRITE_ROLES = [Role.OWNER, Role.CHEF];

@Controller('announcements')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnnouncementsController {
  constructor(
    private readonly announcementsService: AnnouncementsService,
    private readonly prisma: PrismaService,
  ) {}

  // Same kitchen-scoped-controller pattern as Recipes/Guidelines/Notes:
  // derive the caller's own kitchenId server-side, never trust a
  // client-supplied scope.
  private async callerKitchenId(userId: string): Promise<string> {
    const caller = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!caller) {
      throw new UnauthorizedException('Caller no longer exists');
    }
    return caller.kitchenId;
  }

  @Get()
  async list(@Req() req: { user: { sub: string } }) {
    const kitchenId = await this.callerKitchenId(req.user.sub);
    return this.announcementsService.list(kitchenId);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Req() req: { user: { sub: string } },
  ) {
    const kitchenId = await this.callerKitchenId(req.user.sub);
    return this.announcementsService.findOneAndMarkRead(
      id,
      kitchenId,
      req.user.sub,
    );
  }

  @Post()
  @Roles(...WRITE_ROLES)
  async create(
    @Body() dto: CreateAnnouncementDto,
    @Req() req: { user: { sub: string } },
  ) {
    const kitchenId = await this.callerKitchenId(req.user.sub);
    return this.announcementsService.create(kitchenId, req.user.sub, dto);
  }
}
