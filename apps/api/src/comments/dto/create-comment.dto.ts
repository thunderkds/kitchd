import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { ENTITY_TYPES, EntityType } from '../entity-type';

export class CreateCommentDto {
  @IsIn(ENTITY_TYPES)
  entityType!: EntityType;

  @IsString()
  @MinLength(1)
  entityId!: string;

  @IsString()
  @MinLength(1)
  body!: string;

  // Single-level reply threading only for MVP (see Comment model doc
  // comment in schema.prisma) — must reference a top-level comment.
  @IsOptional()
  @IsString()
  parentId?: string;
}
