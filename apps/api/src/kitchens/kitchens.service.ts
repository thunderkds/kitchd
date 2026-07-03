import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class KitchensService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const kitchen = await this.prisma.kitchen.findUnique({ where: { id } });
    if (!kitchen) {
      throw new NotFoundException('Kitchen not found');
    }
    return kitchen;
  }

  async rename(id: string, name: string) {
    await this.findById(id);
    return this.prisma.kitchen.update({ where: { id }, data: { name } });
  }
}
