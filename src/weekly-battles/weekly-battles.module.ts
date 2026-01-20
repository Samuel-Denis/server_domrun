import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { WeeklyBattlesController, LeaguesController } from './weekly-battles.controller';
import { WeeklyRoomService } from './services/weekly-room.service';
import { WeeklyRunService } from './services/weekly-run.service';
import { WeeklyScoringService } from './services/weekly-scoring.service';
import { WeeklyAntiCheatService } from './services/weekly-anti-cheat.service';
import { WeeklyClosureService } from './services/weekly-closure.service';
import { ChampionRunService } from './services/champion-run.service';
import { LeagueService } from './services/league.service';
import { WeeklySchedulerService } from './services/weekly-scheduler.service';
import { WeeklyEnrollmentService } from './services/weekly-enrollment.service';

/**
 * Módulo de Batalhas Semanais
 * 
 * Gerencia:
 * - Salas semanais por liga
 * - Submissão e pontuação de corridas
 * - Fechamento semanal automático
 * - Liga Imortal (sistema especial)
 */
@Module({
  imports: [PrismaModule, ScheduleModule.forRoot()],
  controllers: [WeeklyBattlesController, LeaguesController],
  providers: [
    LeagueService,
    WeeklyRoomService,
    WeeklyRunService,
    WeeklyScoringService,
    WeeklyAntiCheatService,
    WeeklyClosureService,
    ChampionRunService,
    WeeklySchedulerService,
    WeeklyEnrollmentService,
  ],
  exports: [
    LeagueService,
    WeeklyRoomService,
    WeeklyRunService,
    WeeklyEnrollmentService,
  ],
})
export class WeeklyBattlesModule {}
