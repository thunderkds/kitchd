import {
  Controller,
  HttpCode,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { TaskCompletionService } from './task-completion.service';

// Same kitchen-scoped-controller pattern as TasksController: derive the
// caller's own kitchenId/role server-side, never trust the URL.
//
// Deliberately NOT decorated with @Roles(...WRITE_ROLES) — any
// authenticated Kitchen member may attempt to complete a Task; the
// own-task-assignment check for non-writers lives in
// TaskCompletionService#loadTask (see RBAC nuance note there).
@Controller('tasks/:id/complete')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TaskCompletionController {
  constructor(
    private readonly taskCompletionService: TaskCompletionService,
    private readonly prisma: PrismaService,
  ) {}

  private async caller(
    userId: string,
  ): Promise<{ id: string; kitchenId: string; role: Role }> {
    const caller = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!caller) {
      throw new UnauthorizedException('Caller no longer exists');
    }
    return { id: caller.id, kitchenId: caller.kitchenId, role: caller.role };
  }

  @Post('preview')
  @HttpCode(200)
  async preview(
    @Param('id') id: string,
    @Req() req: { user: { sub: string } },
  ) {
    const caller = await this.caller(req.user.sub);
    return this.taskCompletionService.preview(id, caller.kitchenId, caller);
  }

  @Post('confirm')
  async confirm(
    @Param('id') id: string,
    @Req() req: { user: { sub: string } },
  ) {
    const caller = await this.caller(req.user.sub);
    return this.taskCompletionService.confirm(id, caller.kitchenId, caller);
  }
}
