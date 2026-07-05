import {
  Controller,
  Get,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { AlertsService, DEFAULT_EXPIRING_SOON_DAYS } from './alerts.service';
import { ExpiringSoonQueryDto } from './dto/expiring-soon-query.dto';

@Controller('inventory/alerts')
@UseGuards(JwtAuthGuard)
export class AlertsController {
  constructor(
    private readonly alertsService: AlertsService,
    private readonly prisma: PrismaService,
  ) {}

  // Mirrors the Kitchens/Inventory pattern: access is always scoped to the
  // caller's own Kitchen, derived server-side, never trusted from the URL.
  private async callerKitchenId(userId: string): Promise<string> {
    const caller = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!caller) {
      throw new UnauthorizedException('Caller no longer exists');
    }
    return caller.kitchenId;
  }

  @Get('low-stock')
  async lowStock(@Req() req: { user: { sub: string } }) {
    const kitchenId = await this.callerKitchenId(req.user.sub);
    return this.alertsService.lowStock(kitchenId);
  }

  @Get('expiring')
  async expiringSoon(
    @Query() query: ExpiringSoonQueryDto,
    @Req() req: { user: { sub: string } },
  ) {
    const kitchenId = await this.callerKitchenId(req.user.sub);
    return this.alertsService.expiringSoon(
      kitchenId,
      query.days ?? DEFAULT_EXPIRING_SOON_DAYS,
    );
  }
}
