import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class ChecklistItemDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MinLength(1)
  text!: string;

  @IsOptional()
  @IsBoolean()
  done?: boolean;
}
