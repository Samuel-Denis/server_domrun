import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WeeklyRoomService } from './weekly-room.service';
import { WeeklyScoringService } from './weekly-scoring.service';
import { WeeklyAntiCheatService } from './weekly-anti-cheat.service';
import { generateDayKey, getCompetitionWeekRange, isCompetitionPeriod } from '../utils/week-helper';

/**
 * Serviço para gerenciar submissão de corridas semanais
 */
@Injectable()
export class WeeklyRunService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly weeklyRoomService: WeeklyRoomService,
    private readonly scoringService: WeeklyScoringService,
    private readonly antiCheatService: WeeklyAntiCheatService,
  ) {}

  /**
   * Submete uma corrida para a sala semanal do usuário
   */
  async submitRun(userId: string, runId: string): Promise<any> {
    // 1. Validar que estamos no período competitivo (Terça → Domingo)
    if (!isCompetitionPeriod()) {
      throw new BadRequestException('Corridas só podem ser submetidas durante o período competitivo (Terça 00:00 → Domingo 23:59)');
    }

    // 2. Validar que o usuário está em uma sala ativa
    const roomData = await this.weeklyRoomService.getCurrentRoom(userId);
    if (!roomData) {
      throw new BadRequestException('Você não está em uma sala semanal ativa');
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
    const competitionRange = getCompetitionWeekRange();
    const runStartTime = new Date(run.startTime);
    
    if (runStartTime < competitionRange.startDate || runStartTime > competitionRange.endDate) {
      throw new BadRequestException(
        `Corrida deve ser feita durante o período competitivo (${competitionRange.startDate.toLocaleDateString('pt-BR')} 00:00 → ${competitionRange.endDate.toLocaleDateString('pt-BR')} 23:59)`
      );
    }

    // 5. Verificar se a corrida já foi submetida (unique constraint)
    const existingRun = await this.prisma.weeklyRun.findUnique({
      where: { roomId_runId: { roomId: roomData.id, runId } },
    });

    if (existingRun) {
      throw new BadRequestException('Esta corrida já foi submetida para esta sala');
    }

    // Verificar também pelo unique global runId
    const existingRunGlobal = await this.prisma.weeklyRun.findFirst({
      where: { runId },
    });

    if (existingRunGlobal) {
      throw new BadRequestException('Esta corrida já foi submetida em outra sala');
    }

    // 6. Buscar participante
    const participant = await this.prisma.weeklyRoomParticipant.findFirst({
      where: {
        userId,
        roomId: roomData.id,
      },
    });

    if (!participant) {
      throw new NotFoundException('Participante não encontrado na sala');
    }

    // 7. Buscar liga para cálculos
    const league = await this.prisma.league.findUnique({
      where: { id: roomData.leagueId },
    });

    if (!league) {
      throw new NotFoundException('Liga não encontrada');
    }

    // 8. Calcular métricas
    const distanceMeters = Math.round(Number(run.distance));
    const durationSeconds = run.duration;
    const paceSecKm = this.scoringService.calculatePaceSecKm(distanceMeters, durationSeconds);

    // 9. Calcular scores
    const paceScore = this.scoringService.calculatePaceScore(paceSecKm, league);
    const distanceScore = this.scoringService.calculateDistanceScore(distanceMeters);
    const smoothnessScore = this.scoringService.calculateSmoothnessScore(
      runId,
      run.pathPoints,
    );

    const baseScore = paceScore + distanceScore + smoothnessScore;

    // 10. Validar anti-cheat
    const antiCheatResult = await this.antiCheatService.validateRun(run, run.pathPoints);
    
    const finalScore = Math.round(baseScore * antiCheatResult.multiplier);

    // 11. Criar WeeklyRun
    const dayKey = generateDayKey(run.startTime);

    const weeklyRun = await this.prisma.weeklyRun.create({
      data: {
        participantId: participant.id,
        roomId: roomData.id,
        runId,
        distanceMeters,
        durationSeconds,
        paceSecKm,
        paceScore,
        distanceScore,
        smoothnessScore,
        finalScore,
        dayKey,
        countedDay: false, // Será atualizado no reprocessamento
        countedWeek: false,
        isValid: antiCheatResult.isValid,
        invalidReason: antiCheatResult.invalidReason || null,
        flags: antiCheatResult.flags.length > 0 ? antiCheatResult.flags : undefined,
        multiplier: antiCheatResult.multiplier,
      },
    });

    // 12. Reprocessar pontuações do participante
    await this.scoringService.reprocessParticipantScores(participant.id);

    return weeklyRun;
  }

  /**
   * Lista corridas submetidas pelo usuário na sala atual
   */
  async getUserRuns(userId: string): Promise<any[]> {
    const roomData = await this.weeklyRoomService.getCurrentRoom(userId);
    if (!roomData) {
      return [];
    }

    const participant = await this.prisma.weeklyRoomParticipant.findFirst({
      where: {
        userId,
        roomId: roomData.id,
      },
    });

    if (!participant) {
      return [];
    }

      const runs = await this.prisma.weeklyRun.findMany({
      where: { participantId: participant.id },
      include: {
        room: {
          include: {
            league: true,
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });

    return runs;
  }
}
