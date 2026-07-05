import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { LINKED_ENTITY_TYPES } from './linked-entity-type';

// Roles allowed to create Notes. Per PRD FR-018 ("Staff can view
// Guidelines, manage own Tasks, and add Notes/Comments; Viewer is
// read-only") every role except Viewer may author a Note.
export const WRITE_ROLES: Role[] = [
  Role.OWNER,
  Role.ADMIN,
  Role.CHEF,
  Role.STAFF,
];

export type NoteScope = 'mine' | 'team';

@Injectable()
export class NotesService {
  constructor(private readonly prisma: PrismaService) {}

  private validateLink(dto: {
    linkedEntityType?: string;
    linkedEntityId?: string;
  }) {
    const hasType = dto.linkedEntityType !== undefined;
    const hasId = dto.linkedEntityId !== undefined;
    if (hasType !== hasId) {
      throw new BadRequestException(
        'linkedEntityType and linkedEntityId must be provided together',
      );
    }
    if (hasType && !LINKED_ENTITY_TYPES.includes(dto.linkedEntityType as any)) {
      throw new BadRequestException(
        `linkedEntityType must be one of: ${LINKED_ENTITY_TYPES.join(', ')}`,
      );
    }
  }

  async list(
    kitchenId: string,
    callerId: string,
    options: { scope: NoteScope; tag?: string; q?: string },
  ) {
    return this.prisma.note.findMany({
      where: {
        kitchenId,
        ...(options.scope === 'mine' ? { authorId: callerId } : {}),
        ...(options.tag ? { tags: { has: options.tag } } : {}),
        ...(options.q
          ? {
              OR: [
                { title: { contains: options.q, mode: 'insensitive' } },
                { body: { contains: options.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      // Pinned notes surfaced first (UI requirement), newest next.
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(id: string, kitchenId: string) {
    const note = await this.prisma.note.findUnique({ where: { id } });
    if (!note || note.kitchenId !== kitchenId) {
      throw new NotFoundException('Note not found');
    }
    return note;
  }

  async create(kitchenId: string, authorId: string, dto: CreateNoteDto) {
    this.validateLink(dto);
    return this.prisma.note.create({
      data: {
        kitchenId,
        authorId,
        title: dto.title,
        body: dto.body,
        tags: dto.tags ?? [],
        linkedEntityType: dto.linkedEntityType,
        linkedEntityId: dto.linkedEntityId,
      },
    });
  }

  // Only the author may edit/pin/delete their own Note — FR-018 grants
  // Staff the ability to "add Notes" but not to moderate others'; no
  // role is given cross-author edit rights in this MVP.
  async update(
    id: string,
    kitchenId: string,
    dto: UpdateNoteDto,
    caller: { id: string },
  ) {
    const existing = await this.findOne(id, kitchenId);
    if (existing.authorId !== caller.id) {
      throw new ForbiddenException('Not your note');
    }
    this.validateLink(dto);

    return this.prisma.note.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.body !== undefined ? { body: dto.body } : {}),
        ...(dto.tags !== undefined ? { tags: dto.tags } : {}),
        ...(dto.pinned !== undefined ? { pinned: dto.pinned } : {}),
        ...(dto.linkedEntityType !== undefined
          ? { linkedEntityType: dto.linkedEntityType }
          : {}),
        ...(dto.linkedEntityId !== undefined
          ? { linkedEntityId: dto.linkedEntityId }
          : {}),
      },
    });
  }

  async remove(id: string, kitchenId: string, caller: { id: string }) {
    const existing = await this.findOne(id, kitchenId);
    if (existing.authorId !== caller.id) {
      throw new ForbiddenException('Not your note');
    }
    await this.prisma.note.delete({ where: { id } });
    return { id };
  }
}
