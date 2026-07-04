import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
import { TasksService, WRITE_ROLES } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Controller('tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly prisma: PrismaService,
  ) {}

  // Kitchen-scoped-controller pattern (see Recipes/Inventory): derive
  // the caller's own kitchenId and role server-side, never trust the URL.
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
  async list(@Req() req: { user: { sub: string } }) {
    const { kitchenId } = await this.caller(req.user.sub);
    return this.tasksService.list(kitchenId);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Req() req: { user: { sub: string } },
  ) {
    const { kitchenId } = await this.caller(req.user.sub);
    return this.tasksService.findOne(id, kitchenId);
  }

  @Post()
  @Roles(...WRITE_ROLES)
  async create(
    @Body() dto: CreateTaskDto,
    @Req() req: { user: { sub: string } },
  ) {
    const { kitchenId } = await this.caller(req.user.sub);
    return this.tasksService.create(kitchenId, dto);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
    @Req() req: { user: { sub: string } },
  ) {
    const callerInfo = await this.caller(req.user.sub);
    return this.tasksService.update(id, callerInfo.kitchenId, dto, callerInfo);
  }
}
