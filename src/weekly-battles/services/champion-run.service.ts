import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WeeklyScoringService } from './weekly-scoring.service';
import { WeeklyAntiCheatService } from './weekly-anti-cheat.service';
import { generateWeekKey, getCurrentWeekRange, getCompetitionWeekRange, parseWeekKey, isCompetitionPeriod } from '../utils/week-helper';
import { LeagueService } from './league.service';

/**
 * Serviço para gerenciar corridas da Liga Imortal
 */
@Injectable()
export class ChampionRunService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scoringService: WeeklyScoringService,
    private readonly antiCheatService: WeeklyAntiCheatService,
    private readonly leagueService: LeagueService,
  ) { }

  /**
   * Submete uma corrida para a Liga Imortal
   */
  async submitChampionRun(userId: string, runId: string): Promise<any> {
    // 1. Validar que estamos no período competitivo (Terça → Domingo)
    if (!isCompetitionPeriod()) {
      const compRange = getCompetitionWeekRange();
      throw new BadRequestException(
        `Corridas só podem ser submetidas durante o período competitivo (${compRange.startDate.toLocaleDateString('pt-BR')} 00:00 → ${compRange.endDate.toLocaleDateString('pt-BR')} 23:59)`
      );
    }

    // 2. Validar que o usuário está na liga Imortal
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { league: true },
    });

    if (!user || !user.league || !user.league.isChampion) {
      throw new BadRequestException('Apenas usuários da Liga Imortal podem submetar corridas aqui');
    }

    // 3. Buscar a corrida no sistema principal
    const run = await this.prisma.run.findUnique({
      where: { id: runId },
      include: {
        pathPoints: {
          orderBy: { sequenceOrder: 'asc' },
        },
      },
    });

    if (!run) {
      throw new NotFoundException('Corrida não encontrada');
    }

    if (run.userId !== userId) {
      throw new BadRequestException('Corrida não pertence ao usuário');
    }

    // 4. Validar que a corrida foi feita dentro do período competitivo
    const compRange = getCompetitionWeekRange();
    const runStartTime = new Date(run.startTime);

    if (runStartTime < compRange.startDate || runStartTime > compRange.endDate) {
      throw new BadRequestException(
        `Corrida deve ser feita durante o período competitivo (${compRange.startDate.toLocaleDateString('pt-BR')} 00:00 → ${compRange.endDate.toLocaleDateString('pt-BR')} 23:59)`
      );
    }

    // 5. Verificar se a corrida já foi submetida
    const existingRun = await this.prisma.championRun.findUnique({
      where: {
        userId_runId: {
          userId,
          runId,
        },
      },
    });

    if (existingRun) {
      throw new BadRequestException('Esta corrida já foi submetida');
    }

    // 6. Calcular métricas
    const distanceMeters = Math.round(Number(run.distance));
    const durationSeconds = run.duration;
    const paceSecKm = this.scoringService.calculatePaceSecKm(distanceMeters, durationSeconds);

    // 7. Calcular scores (mesmo sistema das salas)
    const paceScore = this.scoringService.calculatePaceScore(paceSecKm, user.league);
    const distanceScore = this.scoringService.calculateDistanceScore(distanceMeters);
    const smoothnessScore = await this.scoringService.calculateSmoothnessScore(runId, run.pathPoints);

    const baseScore = paceScore + distanceScore + smoothnessScore;

    // 8. Validar anti-cheat
    const antiCheatResult = await this.antiCheatService.validateRun(run, run.pathPoints);
    const finalScore = Math.round(baseScore * antiCheatResult.multiplier);

    // 9. Calcular troféus ganhos (clamp(floor(finalScore/25), 10, 60))
    const trophiesEarned = antiCheatResult.isValid
      ? Math.max(10, Math.min(60, Math.floor(finalScore / 25)))
      : 0;

    // 10. Criar ChampionRun
    const championRun = await this.prisma.championRun.create({
      data: {
        userId,
        runId,
        distanceMeters,
        durationSeconds,
        paceSecKm,
        finalScore,
        trophiesEarned,
        isValid: antiCheatResult.isValid,
        invalidReason: antiCheatResult.invalidReason || null,
        flags: antiCheatResult.flags.length > 0 ? antiCheatResult.flags : undefined,
        multiplier: antiCheatResult.multiplier,
      },
    });

    // 11. Atualizar troféus do usuário (se válido)
    if (antiCheatResult.isValid && trophiesEarned > 0) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          trophies: {
            increment: trophiesEarned,
          },
        },
      });
    }

    return championRun;
  }

  /**
   * Processa o fechamento semanal da Liga Imortal
   * Aplica penalidades e rebaixamentos
   */
  async processWeeklyClosure(): Promise<void> {
    const weekRange = getCurrentWeekRange();
    const previousWeekStart = new Date(weekRange.startDate);
    previousWeekStart.setDate(previousWeekStart.getDate() - 7);
    const previousWeekEnd = new Date(previousWeekStart);
    previousWeekEnd.setDate(previousWeekStart.getDate() + 6);
    previousWeekEnd.setHours(23, 59, 59, 999);

    const previousWeekKey = generateWeekKey(previousWeekStart);
    const { seasonNumber, weekNumber } = parseWeekKey(previousWeekKey);

    console.log(`🏆 Processando fechamento semanal da Liga Imortal para ${previousWeekKey}...`);

    // Buscar todos os usuários da Liga Imortal
    const immortalLeague = await this.leagueService.findByCode('IMMORTAL');
    if (!immortalLeague) {
      console.log('⚠️  Liga Imortal não encontrada');
      return;
    }

    const users = await this.prisma.user.findMany({
      where: { leagueId: immortalLeague.id },
    });

    console.log(`📋 Encontrados ${users.length} usuários na Liga Imortal`);

    const MIN_VALID_RUNS = 3;
    const PENALTY_TROPHIES = 50; // Penalidade fixa por inatividade

    for (const user of users) {
      await this.processUserWeeklySummary(
        user.id,
        seasonNumber,
        weekNumber,
        previousWeekKey,
        previousWeekStart,
        previousWeekEnd,
        MIN_VALID_RUNS,
        PENALTY_TROPHIES,
      );
    }

    console.log(`✅ Fechamento semanal da Liga Imortal concluído`);
  }

  /**
   * Processa resumo semanal de um usuário Imortal
   */
  private async processUserWeeklySummary(
    userId: string,
    seasonNumber: number,
    weekNumber: number,
    weekKey: string,
    weekStart: Date,
    weekEnd: Date,
    minValidRuns: number,
    penaltyTrophies: number,
  ): Promise<void> {
      // Buscar corridas válidas da semana
      const runs = await this.prisma.championRun.findMany({
        where: {
          userId,
          submittedAt: {
            gte: weekStart,
            lte: weekEnd,
          },
          isValid: true,
        },
      });

      const validRunsCount = runs.length;
      const trophiesEarnedWeek = runs.reduce((sum, run) => sum + run.trophiesEarned, 0);

      // Buscar usuário atual
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return;
      }

      const trophiesBefore = user.trophies;
      let trophiesPenaltyWeek = 0;
      let trophiesAfter = trophiesBefore;
      let demoted = false;
      let demotedToLeagueId: string | null = null;

      // Aplicar penalidade se < 3 corridas válidas
      if (validRunsCount < minValidRuns) {
        trophiesPenaltyWeek = penaltyTrophies;
        trophiesAfter = Math.max(0, trophiesBefore - penaltyTrophies);

        // Aplicar penalidade
        await this.prisma.user.update({
          where: { id: userId },
          data: { trophies: trophiesAfter },
        });
      }

      // Rebaixar se troféus < 3000
      if (trophiesAfter < 3000) {
        const eliteLeague = await this.leagueService.findByCode('ELITE');
        if (eliteLeague) {
          demoted = true;
          demotedToLeagueId = eliteLeague.id;

          await this.prisma.user.update({
            where: { id: userId },
            data: { leagueId: eliteLeague.id },
          });
        }
      }

      // Criar ou atualizar resumo semanal
        await this.prisma.championWeeklySummary.upsert({
        where: {
          userId_seasonNumber_weekNumber: {
            userId,
            seasonNumber,
            weekNumber,
          },
        },
        update: {
          validRunsCount,
          trophiesEarnedWeek,
          trophiesPenaltyWeek,
          trophiesBefore,
          trophiesAfter,
          demoted,
          demotedToLeagueId,
        },
        create: {
          userId,
          seasonNumber,
          weekNumber,
          weekKey,
          weekStart,
          weekEnd,
          validRunsCount,
          trophiesEarnedWeek,
          trophiesPenaltyWeek,
          trophiesBefore,
          trophiesAfter,
          demoted,
          demotedToLeagueId,
      },
    });
  }
}
