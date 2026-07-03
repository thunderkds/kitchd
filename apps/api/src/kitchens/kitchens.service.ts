import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class KitchensService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string, callerKitchenId: string) {
    // Scope strictly to the caller's own Kitchen: a mismatched id must
    // behave identically to a non-existent kitchen (404), never a 403,
    // so we don't leak the existence of other orgs' kitchens.
    if (id !== callerKitchenId) {
      throw new NotFoundException('Kitchen not found');
    }
    const kitchen = await this.prisma.kitchen.findUnique({ where: { id } });
    if (!kitchen) {
      throw new NotFoundException('Kitchen not found');
    }
    return kitchen;
  }

  async rename(id: string, name: string, callerKitchenId: string) {
    await this.findById(id, callerKitchenId);
    return this.prisma.kitchen.update({ where: { id }, data: { name } });
  }
}
