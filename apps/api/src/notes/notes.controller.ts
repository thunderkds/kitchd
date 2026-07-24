import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { NotesService, NoteScope, WRITE_ROLES } from './notes.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';

@Controller('notes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotesController {
  constructor(
    private readonly notesService: NotesService,
    private readonly prisma: PrismaService,
  ) {}

  // Kitchen-scoped-controller pattern (see Tasks/Recipes/Inventory):
  // derive the caller's own kitchenId server-side, never trust the URL.
  private async caller(
    userId: string,
  ): Promise<{ id: string; kitchenId: string; role: Role }> {
    const caller = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!caller) {
      throw new UnauthorizedException('Caller no longer exists');
    }
    return { id: caller.id, kitchenId: caller.kitchenId, role: caller.role };
  }

  @Get()
  async list(
    @Query('scope') scopeParam: string | undefined,
    @Query('tag') tag: string | undefined,
    @Query('q') q: string | undefined,
    @Req() req: { user: { sub: string } },
  ) {
    // Enum query-param filters need explicit validation — @Query()
    // strings bypass DTO @IsEnum checks (see memory/learnings.md).
    const scope: NoteScope = scopeParam === 'mine' ? 'mine' : 'team';
    if (
      scopeParam !== undefined &&
      scopeParam !== 'mine' &&
      scopeParam !== 'team'
    ) {
      throw new BadRequestException('scope must be "mine" or "team"');
    }
    const { kitchenId, id } = await this.caller(req.user.sub);
    return this.notesService.list(kitchenId, id, { scope, tag, q });
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Req() req: { user: { sub: string } },
  ) {
    const { kitchenId } = await this.caller(req.user.sub);
    return this.notesService.findOne(id, kitchenId);
  }

  @Post()
  @Roles(...WRITE_ROLES)
  async create(
    @Body() dto: CreateNoteDto,
    @Req() req: { user: { sub: string } },
  ) {
    const { kitchenId, id } = await this.caller(req.user.sub);
    return this.notesService.create(kitchenId, id, dto);
  }

  @Patch(':id')
  @Roles(...WRITE_ROLES)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateNoteDto,
    @Req() req: { user: { sub: string } },
  ) {
    const caller = await this.caller(req.user.sub);
    return this.notesService.update(id, caller.kitchenId, dto, caller);
  }

  @Delete(':id')
  @Roles(...WRITE_ROLES)
  async remove(@Param('id') id: string, @Req() req: { user: { sub: string } }) {
    const caller = await this.caller(req.user.sub);
    return this.notesService.remove(id, caller.kitchenId, caller);
  }
}
