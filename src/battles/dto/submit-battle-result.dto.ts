import { IsString, IsNotEmpty, IsNumber, IsArray, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class PositionPointDto {
  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  @IsString()
  @IsNotEmpty()
  timestamp: string;
}

export class SubmitBattleResultDto {
  @IsString()
  @IsNotEmpty()
  battleId: string;

  @IsNumber()
  @IsNotEmpty()
  distance: number; // em metros

  @IsNumber()
  @IsNotEmpty()
  duration: number; // em segundos

  @IsNumber()
  @IsNotEmpty()
  averagePace: number; // em min/km

  @IsNumber()
  @IsOptional()
  maxSpeed?: number; // em km/h

  @IsNumber()
  @IsOptional()
  elevationGain?: number; // em metros

  @IsNumber()
  @IsOptional()
  calories?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PositionPointDto)
  @IsNotEmpty()
  path: PositionPointDto[]; // Array de pontos GPS para validação anti-cheat
}
