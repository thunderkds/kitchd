import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
import { GuidelinesService } from './guidelines.service';
import { CreateGuidelineDto } from './dto/create-guideline.dto';
import { UpdateGuidelineDto } from './dto/update-guideline.dto';

const WRITE_ROLES = [Role.OWNER, Role.ADMIN, Role.CHEF];

@Controller('guidelines')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GuidelinesController {
  constructor(
    private readonly guidelinesService: GuidelinesService,
    private readonly prisma: PrismaService,
  ) {}

  // Same kitchen-scoped-controller pattern as Recipes/Tasks/Inventory:
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
  async list(
    @Req() req: { user: { sub: string } },
    @Query('type') type?: string,
  ) {
    const kitchenId = await this.callerKitchenId(req.user.sub);
    return this.guidelinesService.list(kitchenId, type);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Req() req: { user: { sub: string } },
  ) {
    const kitchenId = await this.callerKitchenId(req.user.sub);
    return this.guidelinesService.findOne(id, kitchenId);
  }

  @Post()
  @Roles(...WRITE_ROLES)
  async create(
    @Body() dto: CreateGuidelineDto,
    @Req() req: { user: { sub: string } },
  ) {
    const kitchenId = await this.callerKitchenId(req.user.sub);
    return this.guidelinesService.create(kitchenId, dto);
  }

  @Patch(':id')
  @Roles(...WRITE_ROLES)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateGuidelineDto,
    @Req() req: { user: { sub: string } },
  ) {
    const kitchenId = await this.callerKitchenId(req.user.sub);
    return this.guidelinesService.update(id, kitchenId, dto);
  }
}
