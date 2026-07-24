import { IsString, MinLength } from 'class-validator';

export class RenameKitchenDto {
  @IsString()
  @MinLength(1)
  name!: string;
}
