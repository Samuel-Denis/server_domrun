import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

/**
 * DTO para submissão de corrida semanal
 */
export class SubmitWeeklyRunDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  runId: string; // ID da corrida no sistema principal (Run)
}
