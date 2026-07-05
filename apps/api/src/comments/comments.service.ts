import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ENTITY_TYPES } from './entity-type';

// Roles allowed to author a Comment. FR-018 names Comments alongside
// Notes ("Staff can... add Notes/Comments; Viewer is read-only") — same
// everyone-but-Viewer shape as Notes/ShiftLog.
export const WRITE_ROLES: Role[] = [
  Role.OWNER,
  Role.ADMIN,
  Role.CHEF,
  Role.STAFF,
];

// Matches an @mention token: '@' followed by username-shaped chars.
// Deliberately conservative (no unicode) — matches the local-part shape
// of the emails this app issues (see auth signup/invite flows).
const MENTION_PATTERN = /@([a-zA-Z0-9_.-]+)/g;

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  // Resolves @mention tokens in a comment body against ONLY the given
  // Kitchen's membership — never cross-Kitchen. Unresolved or
  // non-member mentions are silently dropped (the comment still posts),
  // per the Edge Case Checklist. Users have no separate "username"
  // field in this schema, so a mention resolves against the local part
  // of a member's email (case-insensitive), matching how invites/signup
  // already identify users by email.
  private async resolveMentions(
    kitchenId: string,
    body: string,
  ): Promise<string[]> {
    const tokens = new Set(
      [...body.matchAll(MENTION_PATTERN)].map((m) => m[1].toLowerCase()),
    );
    if (tokens.size === 0) return [];

    const members = await this.prisma.user.findMany({
      where: { kitchenId },
      select: { id: true, email: true },
    });

    const resolved = new Set<string>();
    for (const member of members) {
      const localPart = member.email.split('@')[0]?.toLowerCase();
      if (localPart && tokens.has(localPart)) {
        resolved.add(member.id);
      }
    }
    return [...resolved];
  }

  private validateEntity(dto: { entityType: string; entityId: string }) {
    if (!ENTITY_TYPES.includes(dto.entityType as any)) {
      throw new BadRequestException(
        `entityType must be one of: ${ENTITY_TYPES.join(', ')}`,
      );
    }
  }

  async list(kitchenId: string, entityType: string, entityId: string) {
    this.validateEntity({ entityType, entityId });
    return this.prisma.comment.findMany({
      where: { kitchenId, entityType, entityId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string, kitchenId: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id } });
    if (!comment || comment.kitchenId !== kitchenId) {
      throw new NotFoundException('Comment not found');
    }
    return comment;
  }

  async create(kitchenId: string, authorId: string, dto: CreateCommentDto) {
    this.validateEntity(dto);

    if (dto.parentId) {
      // Single-level reply threading only for MVP: a reply's parent must
      // itself be a top-level comment (parentId null) on the same
      // entity — no unbounded nesting.
      const parent = await this.findOne(dto.parentId, kitchenId);
      if (parent.parentId) {
        throw new BadRequestException(
          'Replies may only be one level deep (cannot reply to a reply)',
        );
      }
      if (
        parent.entityType !== dto.entityType ||
        parent.entityId !== dto.entityId
      ) {
        throw new BadRequestException(
          'parentId must reference a comment on the same entity',
        );
      }
    }

    const mentions = await this.resolveMentions(kitchenId, dto.body);

    return this.prisma.comment.create({
      data: {
        kitchenId,
        authorId,
        entityType: dto.entityType,
        entityId: dto.entityId,
        body: dto.body,
        parentId: dto.parentId,
        mentions,
      },
    });
  }

  // Only the author may delete their own Comment — matches the Notes
  // moderation shape (no cross-author edit/delete rights in this MVP).
  async remove(id: string, kitchenId: string, caller: { id: string }) {
    const existing = await this.findOne(id, kitchenId);
    if (existing.authorId !== caller.id) {
      throw new ForbiddenException('Not your comment');
    }
    await this.prisma.comment.delete({ where: { id } });
    return { id };
  }
}
