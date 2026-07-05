import { Injectable } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  // Recipient's own feed, newest first, plus the current unread count —
  // fetched together so the bell can render both in one call.
  async list(recipientId: string) {
    const [notifications, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { recipientId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({
        where: { recipientId, read: false },
      }),
    ]);
    return { notifications, unreadCount };
  }

  // Marks every currently-unread notification for this recipient as read
  // (AC2: "opening the bell marks visible notifications read"). Scoped
  // strictly to the caller's own recipientId — a user can only ever
  // clear their own feed, never another's.
  async markRead(recipientId: string) {
    await this.prisma.notification.updateMany({
      where: { recipientId, read: false },
      data: { read: true },
    });
    return { unreadCount: 0 };
  }

  // Called by CommentsService#create once mentions resolve (T015 hook).
  // One Notification per mentioned user — no FK to the source Comment,
  // matching the Note/Comment informational-back-reference pattern.
  async notifyMentions(
    kitchenId: string,
    mentionedUserIds: string[],
    authorId: string,
  ) {
    if (mentionedUserIds.length === 0) return;
    await this.prisma.notification.createMany({
      data: mentionedUserIds.map((recipientId) => ({
        kitchenId,
        recipientId,
        type: NotificationType.MENTION,
        body: `You were mentioned in a comment by ${authorId}`,
      })),
    });
  }

  // Called by AlertsService once a low-stock transition is detected
  // (false -> true). One Notification per distinct crossing event — the
  // caller is responsible for only invoking this on an actual
  // transition, not on every poll (AC3 dedup).
  async notifyLowStock(
    kitchenId: string,
    recipientIds: string[],
    ingredientName: string,
  ) {
    if (recipientIds.length === 0) return;
    await this.prisma.notification.createMany({
      data: recipientIds.map((recipientId) => ({
        kitchenId,
        recipientId,
        type: NotificationType.LOW_STOCK,
        body: `${ingredientName} has crossed below its low-stock threshold`,
      })),
    });
  }
}
