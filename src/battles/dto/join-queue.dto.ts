import { IsString, IsNotEmpty, IsEnum } from 'class-validator';

export enum BattleMode {
  TIMED = 'timed', // Ex: 15 minutos
  DISTANCE = 'distance', // Ex: 5km
}

export class JoinQueueDto {
  @IsEnum(BattleMode)
  @IsNotEmpty()
  mode: BattleMode;

  @IsString()
  @IsNotEmpty()
  modeValue?: string; // Ex: '15' para timed (15 min) ou '5' para distance (5km)
}
