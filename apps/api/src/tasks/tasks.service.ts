import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

// Roles allowed to create Tasks and to assign/reassign a Task to anyone
// in the Kitchen. Mirrors WRITE_ROLES in Recipes/Inventory.
export const WRITE_ROLES: Role[] = [Role.OWNER, Role.ADMIN, Role.CHEF];

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  private async assertAssigneeInKitchen(assigneeId: string, kitchenId: string) {
    const assignee = await this.prisma.user.findUnique({
      where: { id: assigneeId },
    });
    if (!assignee || assignee.kitchenId !== kitchenId) {
      throw new BadRequestException(
        `Assignee ${assigneeId} not found in this kitchen`,
      );
    }
  }

  async list(kitchenId: string) {
    return this.prisma.task.findMany({
      where: { kitchenId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, kitchenId: string) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task || task.kitchenId !== kitchenId) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }

  async create(kitchenId: string, dto: CreateTaskDto) {
    if (dto.assigneeId) {
      await this.assertAssigneeInKitchen(dto.assigneeId, kitchenId);
    }
    return this.prisma.task.create({
      data: {
        kitchenId,
        title: dto.title,
        assigneeId: dto.assigneeId,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        checklistItems: (dto.checklistItems ?? []).map((item) => ({
          id: item.id ?? crypto.randomUUID(),
          text: item.text,
          done: item.done ?? false,
        })),
      },
    });
  }

  // Staff (only) may update `status` and `checklistItems`, and only on a
  // Task currently assigned to themselves. Reassigning (or any other
  // field) requires a WRITE_ROLES role — enforced here, not just hidden
  // client-side, per the Edge Case Checklist.
  //
  // RBAC FIX (T019): Viewer is strictly read-only per FR-018 ("Staff can
  // ... manage own Tasks ... Viewer is read-only"). Previously this
  // branch only checked WRITE_ROLES membership, so a Viewer assigned to
  // a Task could still PATCH its status/checklistItems — the Viewer
  // role was never exercised in T008's own tests. Viewer must always be
  // denied here, regardless of assignment.
  async update(
    id: string,
    kitchenId: string,
    dto: UpdateTaskDto,
    caller: { id: string; role: Role },
  ) {
    const existing = await this.findOne(id, kitchenId);

    const isWriter = WRITE_ROLES.includes(caller.role);

    if (!isWriter) {
      if (caller.role === Role.VIEWER) {
        throw new ForbiddenException('Viewer role is read-only');
      }
      if (existing.assigneeId !== caller.id) {
        throw new ForbiddenException('Not your task');
      }
      const allowedKeys = new Set(['status', 'checklistItems']);
      const attemptedKeys = Object.keys(dto);
      const disallowed = attemptedKeys.filter((k) => !allowedKeys.has(k));
      if (disallowed.length > 0) {
        throw new ForbiddenException(
          `Not allowed to update: ${disallowed.join(', ')}`,
        );
      }
    }

    if (dto.assigneeId) {
      await this.assertAssigneeInKitchen(dto.assigneeId, kitchenId);
    }

    const updated = await this.prisma.task.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.assigneeId !== undefined ? { assigneeId: dto.assigneeId } : {}),
        ...(dto.dueAt !== undefined ? { dueAt: new Date(dto.dueAt) } : {}),
        ...(dto.checklistItems !== undefined
          ? {
              checklistItems: dto.checklistItems.map((item) => ({
                id: item.id ?? crypto.randomUUID(),
                text: item.text,
                done: item.done ?? false,
              })),
            }
          : {}),
      },
    });

    // T017 hook: push the update to every client in the Kitchen.
    // Additive only — never blocks/alters the update path above.
    this.realtimeGateway.emitTaskUpdated(kitchenId, updated);

    return updated;
  }
}
