import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { GuidelineType } from '@prisma/client';

export class CreateGuidelineDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsEnum(GuidelineType)
  type!: GuidelineType;

  // Empty steps array is accepted (a Guideline can start as a draft) —
  // per Edge Case Checklist.
  @IsArray()
  @IsString({ each: true })
  steps!: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];
}
