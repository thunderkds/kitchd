import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { RecipeIngredientInputDto } from './recipe-ingredient-input.dto';

// Recipe edits are full-replace: every field here, when supplied,
// replaces the corresponding value. A partial PATCH still only needs
// to send the fields it changes; whichever fields are sent are what
// get written into the new version snapshot alongside the unchanged
// fields already on the Recipe.
export class UpdateRecipeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  steps?: string[];

  @IsOptional()
  @IsInt()
  @IsPositive()
  servings?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientInputDto)
  ingredients?: RecipeIngredientInputDto[];
}
