import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GuidelineType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGuidelineDto } from './dto/create-guideline.dto';
import { UpdateGuidelineDto } from './dto/update-guideline.dto';

@Injectable()
export class GuidelinesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(kitchenId: string, type?: string) {
    if (
      type !== undefined &&
      !Object.values(GuidelineType).includes(type as GuidelineType)
    ) {
      throw new BadRequestException(`Invalid type filter: ${type}`);
    }
    return this.prisma.guideline.findMany({
      where: {
        kitchenId,
        ...(type ? { type: type as GuidelineType } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, kitchenId: string) {
    const guideline = await this.prisma.guideline.findUnique({
      where: { id },
    });
    if (!guideline || guideline.kitchenId !== kitchenId) {
      throw new NotFoundException('Guideline not found');
    }
    return guideline;
  }

  async create(kitchenId: string, dto: CreateGuidelineDto) {
    return this.prisma.guideline.create({
      data: {
        kitchenId,
        title: dto.title,
        type: dto.type,
        steps: dto.steps,
        attachments: dto.attachments ?? [],
      },
    });
  }

  async update(id: string, kitchenId: string, dto: UpdateGuidelineDto) {
    await this.findOne(id, kitchenId);
    return this.prisma.guideline.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.steps !== undefined ? { steps: dto.steps } : {}),
        ...(dto.attachments !== undefined
          ? { attachments: dto.attachments }
          : {}),
      },
    });
  }
}
