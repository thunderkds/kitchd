import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { Invite } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService, AuthResult } from '../auth/auth.service';
import { InviteUserDto } from './dto/invite-user.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';

const SALT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async invite(inviterId: string, dto: InviteUserDto): Promise<Invite> {
    const inviter = await this.prisma.user.findUnique({
      where: { id: inviterId },
    });
    if (!inviter) {
      throw new UnauthorizedException('Inviting user no longer exists');
    }

    const kitchen = await this.prisma.kitchen.findUnique({
      where: { id: inviter.kitchenId },
    });
    if (!kitchen) {
      throw new NotFoundException('Kitchen not found');
    }

    const existingMember = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingMember && existingMember.kitchenId === kitchen.id) {
      throw new ConflictException('User is already a member of this kitchen');
    }

    // Re-inviting: reuse and refresh the existing pending invite rather
    // than creating a duplicate row.
    const existingInvite = await this.prisma.invite.findFirst({
      where: { email: dto.email, kitchenId: kitchen.id, status: 'PENDING' },
    });

    const token = randomBytes(32).toString('hex');

    if (existingInvite) {
      return this.prisma.invite.update({
        where: { id: existingInvite.id },
        data: { role: dto.role, token, invitedById: inviterId },
      });
    }

    return this.prisma.invite.create({
      data: {
        email: dto.email,
        role: dto.role,
        token,
        status: 'PENDING',
        organizationId: kitchen.organizationId,
        kitchenId: kitchen.id,
        invitedById: inviterId,
      },
    });
  }

  async acceptInvite(dto: AcceptInviteDto): Promise<AuthResult> {
    const invite = await this.prisma.invite.findUnique({
      where: { token: dto.token },
    });
    if (!invite || invite.status !== 'PENDING') {
      throw new NotFoundException('Invite not found or already used');
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: invite.email },
    });
    if (existing) {
      throw new ConflictException('An account already exists for this email');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: invite.email,
          passwordHash,
          organizationId: invite.organizationId,
          kitchenId: invite.kitchenId,
          role: invite.role,
        },
      });
      await tx.invite.update({
        where: { id: invite.id },
        data: { status: 'ACCEPTED' },
      });
      return created;
    });

    return this.authService.login({
      email: user.email,
      password: dto.password,
    });
  }
}
