import { IsNumber, IsPositive, IsString, MinLength } from 'class-validator';

export class RecipeIngredientInputDto {
  @IsString()
  @MinLength(1)
  ingredientId!: string;

  @IsNumber()
  @IsPositive()
  qty!: number;
}
