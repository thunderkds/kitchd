import { BadRequestException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateShiftLogDto } from './dto/create-shift-log.dto';

// Roles allowed to author a ShiftLog entry. Per FR-018's blanket
// "Viewer is read-only" rule, every role except Viewer may write —
// same shape as Notes (WRITE_ROLES), NOT the narrower Owner/Chef-only
// Announcements gate.
export const WRITE_ROLES: Role[] = [
  Role.OWNER,
  Role.ADMIN,
  Role.CHEF,
  Role.STAFF,
];

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class ShiftLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(kitchenId: string, date?: string) {
    if (date !== undefined && !DATE_ONLY_RE.test(date)) {
      throw new BadRequestException('date must be in YYYY-MM-DD format');
    }

    const dateFilter = date
      ? {
          gte: new Date(`${date}T00:00:00.000Z`),
          lt: new Date(`${date}T23:59:59.999Z`),
        }
      : undefined;

    return this.prisma.shiftLog.findMany({
      where: {
        kitchenId,
        ...(dateFilter ? { createdAt: dateFilter } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(kitchenId: string, authorId: string, dto: CreateShiftLogDto) {
    // createdAt is intentionally never taken from dto — Prisma's
    // @default(now()) on the column server-sets it, closing off a
    // future-dated/backdated entry via client tampering.
    return this.prisma.shiftLog.create({
      data: {
        kitchenId,
        authorId,
        shift: dto.shift,
        body: dto.body,
      },
    });
  }
}
