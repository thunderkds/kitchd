import { IsIn, IsString, MinLength } from 'class-validator';
import { Shift } from '@prisma/client';

const SHIFT_VALUES = [Shift.MORNING, Shift.EVENING];

export class CreateShiftLogDto {
  @IsIn(SHIFT_VALUES)
  shift!: Shift;

  @IsString()
  @MinLength(1)
  body!: string;

  // Deliberately no createdAt field — it is server-set only (see
  // shift-logs.service.ts) to prevent a future-dated/backdated entry
  // via client tampering. Any createdAt sent in the request body is
  // ignored (whitelist: true strips unknown-but-also-here-defined
  // fields are simply not part of this DTO's shape).
}
