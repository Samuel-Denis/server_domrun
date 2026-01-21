import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LeagueService } from './league.service';
import { WeeklyScoringService } from './weekly-scoring.service';
import { generateWeekKey, getCurrentWeekRange, parseWeekKey } from '../utils/week-helper';

/**
 * Serviço responsável pelo fechamento semanal das salas
 */
@Injectable()
export class WeeklyClosureService {
  private readonly logger = new Logger(WeeklyClosureService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly leagueService: LeagueService,
    private readonly scoringService: WeeklyScoringService,
  ) {}

  /**
   * Processa o fechamento da semana anterior
   * Deve ser executado toda segunda-feira às 00:00
   */
  async closePreviousWeek(): Promise<void> {
    const now = new Date();
    const weekRange = getCurrentWeekRange();
    
    // Calcular semana anterior
    const previousWeekStart = new Date(weekRange.startDate);
    previousWeekStart.setDate(previousWeekStart.getDate() - 7);
    const previousWeekEnd = new Date(previousWeekStart);
    previousWeekEnd.setDate(previousWeekStart.getDate() + 6);
    previousWeekEnd.setHours(23, 59, 59, 999);

    const previousWeekKey = generateWeekKey(previousWeekStart);
    const { seasonNumber, weekNumber } = parseWeekKey(previousWeekKey);

    this.logger.log(`🔒 Fechando semana ${previousWeekKey}...`);

    // Buscar todas as salas da semana anterior que ainda estão abertas
    const rooms = await this.prisma.weeklyRoom.findMany({
      where: {
        weekKey: previousWeekKey,
        status: { in: ['OPEN', 'IN_PROGRESS'] },
      },
      include: {
        league: true,
      },
    });

    this.logger.log(`📋 Encontradas ${rooms.length} salas para fechar`);

    for (const room of rooms) {
      await this.processRoomClosure(room.id, room.league);
    }

    this.logger.log(`✅ Fechamento da semana ${previousWeekKey} concluído`);
  }

  /**
   * Processa o fechamento de uma sala específica
   */
  private async processRoomClosure(roomId: string, league: any): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // 1. Buscar participantes
      const participants = await this.prisma.weeklyRoomParticipant.findMany({
        where: { roomId },
      });

      // 2. Reprocessar todas as pontuações dos participantes
      for (const participant of participants) {
        await this.scoringService.reprocessParticipantScores(participant.id);
      }

      // 3. Calcular bônus de consistência semanal
      await this.calculateConsistencyBonuses(roomId, league);

      // 4. Buscar participantes atualizados com pontuações recalculadas para desempate

      // Calcular melhor corrida e pace médio para cada participante
      const participantsWithTiebreaker = await Promise.all(
        participants.map(async (p) => {
            const countedRuns = await this.prisma.weeklyRun.findMany({
            where: {
              participantId: p.id,
              isValid: true,
              countedWeek: true,
            },
            orderBy: { finalScore: 'desc' },
          });

          const bestRun = countedRuns[0];
          const bestRunScore = bestRun?.finalScore || 0;

          // Calcular pace médio das top 5 (em segundos/km)
          const avgPaceSecKm = countedRuns.length > 0
            ? Math.round(countedRuns.reduce((sum, r) => sum + r.paceSecKm, 0) / countedRuns.length)
            : 0;

          // Última submissão
          const lastSubmittedAt = countedRuns.length > 0
            ? countedRuns[countedRuns.length - 1].submittedAt
            : new Date(0);

          return {
            ...p,
            bestRunScore,
            avgPaceSecKm,
            lastSubmittedAt,
          };
        })
      );

      // 4. Ordenar participantes com desempate completo
      const updatedParticipants = participantsWithTiebreaker.sort((a, b) => {
        // 1. Pontuação total + bônus
        const totalA = a.totalPoints + a.consistencyBonus;
        const totalB = b.totalPoints + b.consistencyBonus;
        if (totalB !== totalA) return totalB - totalA;

        // 2. Melhor corrida (maior finalScore entre as contadas)
        if (b.bestRunScore !== a.bestRunScore) return b.bestRunScore - a.bestRunScore;

        // 3. Pace médio das top 5 (menor pace = melhor)
        if (a.avgPaceSecKm !== b.avgPaceSecKm) return a.avgPaceSecKm - b.avgPaceSecKm;

        // 4. Última submissão (mais recente = melhor, mas invertido para manter ordem)
        return a.lastSubmittedAt.getTime() - b.lastSubmittedAt.getTime();
      });

      // 5. Buscar participantes atualizados do banco para aplicar mudanças
      const participantsFromDb = await tx.weeklyRoomParticipant.findMany({
        where: { roomId },
      });

      // 6. Atualizar posições e aplicar promoção/rebaixamento
      const PROMOTION_TOP = 4; // Top 4 promove
      const DEMOTION_BOTTOM = 4; // Bottom 4 rebaixa
      const MIN_VALID_RUNS = 3; // Mínimo de corridas válidas

      for (let i = 0; i < updatedParticipants.length; i++) {
        const participantData = updatedParticipants[i];
        const participant = participantsFromDb.find(p => p.id === participantData.id);
        
        if (!participant) continue;
        const position = i + 1;
        const hasMinimumRuns = participantData.runsValidCount >= MIN_VALID_RUNS;

        let promoted = false;
        let demoted = false;
        let newLeagueId = participant.startingLeagueId;

        if (hasMinimumRuns) {
          if (position <= PROMOTION_TOP) {
            // Promover
            const nextLeague = await this.leagueService.getNextLeague(participantData.startingLeagueId);
            if (nextLeague) {
              promoted = true;
              newLeagueId = nextLeague.id;
            }
          } else if (position > updatedParticipants.length - DEMOTION_BOTTOM) {
            // Rebaixar (exceto Starter que nunca rebaixa)
            const currentLeague = await this.prisma.league.findUnique({
              where: { id: participantData.startingLeagueId },
            });

            if (currentLeague && currentLeague.order > 1) {
              const previousLeague = await this.leagueService.getPreviousLeague(participantData.startingLeagueId);
              if (previousLeague) {
                demoted = true;
                newLeagueId = previousLeague.id;
              }
            }
          }
        } else {
          // Sem mínimo de corridas: pode rebaixar mas não promove
          if (position > updatedParticipants.length - DEMOTION_BOTTOM) {
            const currentLeague = await this.prisma.league.findUnique({
              where: { id: participantData.startingLeagueId },
            });

            if (currentLeague && currentLeague.order > 1) {
              const previousLeague = await this.leagueService.getPreviousLeague(participantData.startingLeagueId);
              if (previousLeague) {
                demoted = true;
                newLeagueId = previousLeague.id;
              }
            }
          }
        }

        // Atualizar participante
        await this.prisma.weeklyRoomParticipant.update({
          where: { id: participant.id },
          data: {
            position,
            promoted,
            demoted,
            endingLeagueId: newLeagueId,
            processedAt: new Date(),
          },
        });

        // Atualizar liga do usuário
        await this.prisma.user.update({
          where: { id: participant.userId },
          data: { leagueId: newLeagueId },
        });
      }

      // 8. Marcar sala como FINISHED
      await this.prisma.weeklyRoom.update({
        where: { id: roomId },
        data: { status: 'FINISHED' },
      });

      this.logger.log(`✅ Sala ${roomId} processada: ${updatedParticipants.length} participantes`);
    });
  }

  /**
   * Calcula bônus de consistência semanal
   * Baseado na distribuição de corridas em dias diferentes
   */
  private async calculateConsistencyBonuses(
    roomId: string,
    league: any,
  ): Promise<void> {
    const participants = await this.prisma.weeklyRoomParticipant.findMany({
      where: { roomId },
    });

    for (const participant of participants) {
      // Buscar corridas válidas do participante
      const runs = await this.prisma.weeklyRun.findMany({
        where: {
          participantId: participant.id,
          isValid: true,
          countedDay: true,
        },
      });

      // Contar quantos dias diferentes têm corridas
      const uniqueDays = new Set(runs.map((r: any) => r.dayKey));
      const daysWithRuns = uniqueDays.size;

      // Bônus máximo = league.weeklyConsistencyMaxBonus
      // 5 dias = 100%, 4 dias = 80%, 3 dias = 60%, 2 dias = 40%, 1 dia = 20%
      let bonusPercentage = 0;
      if (daysWithRuns >= 5) {
        bonusPercentage = 1.0;
      } else if (daysWithRuns === 4) {
        bonusPercentage = 0.8;
      } else if (daysWithRuns === 3) {
        bonusPercentage = 0.6;
      } else if (daysWithRuns === 2) {
        bonusPercentage = 0.4;
      } else if (daysWithRuns === 1) {
        bonusPercentage = 0.2;
      }

      const consistencyBonus = Math.round(league.weeklyConsistencyMaxBonus * bonusPercentage);

      await this.prisma.weeklyRoomParticipant.update({
        where: { id: participant.id },
        data: { consistencyBonus },
      });
    }
  }
}
