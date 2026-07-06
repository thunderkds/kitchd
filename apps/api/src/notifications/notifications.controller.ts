import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

// No RolesGuard here: notifications are a user's own personal feed, not
// shared kitchen data. Every authenticated role (including Viewer) can
// read and clear their own notifications — this isn't a write to shared
// state, so the Notes-style everyone-but-Viewer gate doesn't apply (see
// memory/learnings.md T019/T016 notes on personal-data RBAC scope).
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async list(@Req() req: { user: { sub: string } }) {
    return this.notificationsService.list(req.user.sub);
  }

  @Post('mark-read')
  async markRead(@Req() req: { user: { sub: string } }) {
    return this.notificationsService.markRead(req.user.sub);
  }
}
