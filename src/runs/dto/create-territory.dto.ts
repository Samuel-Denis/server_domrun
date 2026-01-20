import { IsArray, IsString, IsNumber, IsDateString, ValidateNested, IsNotEmpty, IsOptional, Matches, Min, Max } from 'class-validator';
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
  timestamp: string; // Obrigatório conforme documentação
}

export class CreateTerritoryDto {
  @IsString()
  @IsOptional()
  id?: string; // Aceita string vazia "" do frontend, backend gera UUID

  @IsString()
  @IsOptional()
  userId?: string; // Opcional - backend usa do token, mas aceita para não rejeitar request

  @IsString()
  @IsNotEmpty()
  userName: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'userColor deve estar no formato hexadecimal válido (ex: #7B2CBF)',
  })
  userColor: string; // Formato hexadecimal #RRGGBB

  @IsString()
  @IsNotEmpty()
  areaName: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PositionPointDto)
  @IsNotEmpty()
  boundary: PositionPointDto[]; // Array com 100-5000+ pontos

  @IsDateString()
  @IsNotEmpty()
  capturedAt: string; // Obrigatório conforme documentação

  @IsNumber()
  @IsOptional()
  area?: number; // em metros quadrados (opcional - será calculado pelo backend após ST_Buffer)

  // Dados opcionais da corrida
  @IsNumber()
  @IsOptional()
  distance?: number;

  @IsNumber()
  @IsOptional()
  duration?: number;

  @IsNumber()
  @IsOptional()
  averagePace?: number;

  @IsNumber()
  @IsOptional()
  maxSpeed?: number;

  @IsNumber()
  @IsOptional()
  elevationGain?: number;

  @IsNumber()
  @IsOptional()
  calories?: number;
}
