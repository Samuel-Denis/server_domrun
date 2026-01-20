import { IsArray, IsString, IsNumber, IsDateString, ValidateNested, IsNotEmpty, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class PositionPointDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @IsDateString()
  @IsNotEmpty()
  timestamp: string;
}

export class CreateRunDto {
  @IsString()
  @IsOptional()
  id?: string; // Aceita string vazia "" do frontend, backend gera UUID

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PositionPointDto)
  @IsNotEmpty()
  path: PositionPointDto[]; // Array de pontos do trajeto

  @IsDateString()
  @IsNotEmpty()
  startTime: string;

  @IsDateString()
  @IsOptional()
  endTime?: string;

  @IsNumber()
  @IsOptional()
  distance?: number; // em metros

  @IsString()
  @IsOptional()
  caption?: string;

  @IsNumber()
  @IsOptional()
  duration?: number; // em segundos

  @IsNumber()
  @IsOptional()
  averagePace?: number; // em min/km

  @IsNumber()
  @IsOptional()
  maxSpeed?: number; // em km/h

  @IsNumber()
  @IsOptional()
  elevationGain?: number; // em metros

  @IsNumber()
  @IsOptional()
  calories?: number;
}
