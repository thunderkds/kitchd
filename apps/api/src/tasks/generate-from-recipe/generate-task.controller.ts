import {
  Controller,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { WRITE_ROLES } from '../tasks.service';
import { GenerateTaskService } from './generate-task.service';

// Same kitchen-scoped-controller pattern as TasksController/RecipesController:
// derive the caller's own kitchenId server-side, never trust a URL :id.
@Controller('tasks/generate-from-recipe')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GenerateTaskController {
  constructor(
    private readonly generateTaskService: GenerateTaskService,
    private readonly prisma: PrismaService,
  ) {}

  private async callerKitchenId(userId: string): Promise<string> {
    const caller = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!caller) {
      throw new UnauthorizedException('Caller no longer exists');
    }
    return caller.kitchenId;
  }

  @Post('recipe/:recipeId')
  @Roles(...WRITE_ROLES)
  async fromRecipe(
    @Param('recipeId') recipeId: string,
    @Req() req: { user: { sub: string } },
  ) {
    const kitchenId = await this.callerKitchenId(req.user.sub);
    return this.generateTaskService.fromRecipe(recipeId, kitchenId);
  }

  @Post('guideline/:guidelineId')
  @Roles(...WRITE_ROLES)
  async fromGuideline(
    @Param('guidelineId') guidelineId: string,
    @Req() req: { user: { sub: string } },
  ) {
    const kitchenId = await this.callerKitchenId(req.user.sub);
    return this.generateTaskService.fromGuideline(guidelineId, kitchenId);
  }
}
