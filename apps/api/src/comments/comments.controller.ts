import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
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
import { CommentsService, WRITE_ROLES } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@Controller('comments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CommentsController {
  constructor(
    private readonly commentsService: CommentsService,
    private readonly prisma: PrismaService,
  ) {}

  // Kitchen-scoped-controller pattern (see Notes/Tasks/Recipes):
  // derive the caller's own kitchenId server-side, never trust the URL
  // or query params.
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
    @Query('entityType') entityType: string | undefined,
    @Query('entityId') entityId: string | undefined,
    @Req() req: { user: { sub: string } },
  ) {
    if (!entityType || !entityId) {
      throw new BadRequestException('entityType and entityId are required');
    }
    const { kitchenId } = await this.caller(req.user.sub);
    return this.commentsService.list(kitchenId, entityType, entityId);
  }

  @Post()
  @Roles(...WRITE_ROLES)
  async create(
    @Body() dto: CreateCommentDto,
    @Req() req: { user: { sub: string } },
  ) {
    const { kitchenId, id } = await this.caller(req.user.sub);
    return this.commentsService.create(kitchenId, id, dto);
  }

  @Delete(':id')
  @Roles(...WRITE_ROLES)
  async remove(@Param('id') id: string, @Req() req: { user: { sub: string } }) {
    const caller = await this.caller(req.user.sub);
    return this.commentsService.remove(id, caller.kitchenId, caller);
  }
}
