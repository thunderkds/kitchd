import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  ValidateIf,
} from 'class-validator';
import { StockMovementType } from '@prisma/client';

/**
 * For CONSUME/WASTE/ADJUST movements only. RECEIVE goes through
 * POST /ingredients/:id/stock/receive, which also creates the StockBatch.
 */
export class CreateStockMovementDto {
  @IsEnum(StockMovementType)
  type!: Exclude<StockMovementType, 'RECEIVE'>;

  @IsNumber()
  @IsPositive()
  qty!: number;

  // Waste/adjust entries require a reason (FR-009); consume does not.
  @ValidateIf(
    (dto: CreateStockMovementDto) =>
      dto.type === 'WASTE' || dto.type === 'ADJUST',
  )
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  batchId?: string;
}
