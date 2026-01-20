import { IsString, IsNotEmpty, IsObject, IsNumber, Min, Max, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class SyncAchievementProgressDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsObject()
  @IsNotEmpty()
  progress: Record<string, number>; // achievementId -> progress (0.0 a 1.0)
}
