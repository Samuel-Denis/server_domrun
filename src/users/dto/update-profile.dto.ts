import { IsString, IsNotEmpty, IsOptional, MinLength, Matches, ValidateIf, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateProfileDto {
  @IsString()
  @IsNotEmpty({ message: 'Nome é obrigatório' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Nome de usuário é obrigatório' })
  username: string;

  @IsString()
  @IsOptional()
  @ValidateIf((o) => o.color !== undefined && o.color !== null)
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'A cor deve estar no formato hexadecimal válido (ex: #7B2CBF)',
  })
  color?: string;

  @IsString()
  @IsOptional()
  @ValidateIf((o) => o.password !== undefined && o.password !== null && o.password !== '')
  @MinLength(6, { message: 'A senha deve ter pelo menos 6 caracteres' })
  password?: string;

  @IsString()
  @IsOptional()
  biography?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  weightKg?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  heightCm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  age?: number;
}
