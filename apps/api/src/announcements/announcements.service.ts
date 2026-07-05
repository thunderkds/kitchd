import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';

@Injectable()
export class AnnouncementsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(kitchenId: string) {
    return this.prisma.announcement.findMany({
      where: { kitchenId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(
    kitchenId: string,
    authorId: string,
    dto: CreateAnnouncementDto,
  ) {
    // No other-member check needed: an Announcement posted to a Kitchen
    // with zero other members yet is still a valid write — visibility to
    // future members is derived at read time via the kitchenId scope.
    return this.prisma.announcement.create({
      data: {
        kitchenId,
        authorId,
        title: dto.title,
        body: dto.body,
      },
    });
  }

  // GETting the detail marks it read for the caller. Uses Prisma's atomic
  // `push` update expression (not a read-modify-write) so two members
  // reading concurrently can't race and clobber each other's read_by
  // entry. push is safe to call even if the id is already present —
  // dedup happens in the read path via a Set, keeping the array
  // idempotent without needing a SQL-level "append if absent".
  async findOneAndMarkRead(id: string, kitchenId: string, callerId: string) {
    const existing = await this.prisma.announcement.findUnique({
      where: { id },
    });
    if (!existing || existing.kitchenId !== kitchenId) {
      throw new NotFoundException('Announcement not found');
    }

    if (existing.readBy.includes(callerId)) {
      return existing;
    }

    return this.prisma.announcement.update({
      where: { id },
      data: { readBy: { push: callerId } },
    });
  }
}
