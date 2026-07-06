import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { LINKED_ENTITY_TYPES, LinkedEntityType } from '../linked-entity-type';

export class CreateNoteDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsString()
  @MinLength(1)
  body!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  tags?: string[];

  @IsOptional()
  @IsIn(LINKED_ENTITY_TYPES)
  linkedEntityType?: LinkedEntityType;

  @IsOptional()
  @IsString()
  linkedEntityId?: string;
}
