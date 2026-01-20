import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { League, Run } from '@prisma/client';

/**
 * Serviço responsável pelo cálculo de pontuação semanal
 */
@Injectable()
export class WeeklyScoringService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calcula paceSecKm (segundos por km) a partir de uma corrida
   */
  calculatePaceSecKm(distanceMeters: number, durationSeconds: number): number {
    if (distanceMeters <= 0 || durationSeconds <= 0) {
      return 0;
    }
    const distanceKm = distanceMeters / 1000;
    return Math.round(durationSeconds / distanceKm);
  }

  /**
   * Calcula PaceScore (0-650) normalizado pela liga
   * Aplica smurfCap se necessário
   */
  calculatePaceScore(paceSecKm: number, league: League): number {
    // Aplicar smurfCap se existir (anti-smurf para ligas baixas)
    let adjustedPace = paceSecKm;
    if (league.smurfCapSecKm && paceSecKm < league.smurfCapSecKm) {
      adjustedPace = league.smurfCapSecKm;
    }

    // Normalização linear entre paceTopSecKm (max score) e paceBaseSecKm (zero score)
    if (adjustedPace <= league.paceTopSecKm) {
      return 650; // Pontuação máxima
    }
    if (adjustedPace >= league.paceBaseSecKm) {
      return 0; // Pontuação zero
    }

    // Interpolação linear
    const range = league.paceBaseSecKm - league.paceTopSecKm;
    const progress = (adjustedPace - league.paceTopSecKm) / range;
    return Math.round(650 * (1 - progress));
  }

  /**
   * Calcula DistanceScore (0-200)
   * Mínimo 4.5km, máximo em 5km
   */
  calculateDistanceScore(distanceMeters: number): number {
    const MIN_DISTANCE = 4500; // 4.5km
    const MAX_DISTANCE = 5000; // 5km

    if (distanceMeters < MIN_DISTANCE) {
      return 0;
    }
    if (distanceMeters >= MAX_DISTANCE) {
      return 200;
    }

    // Interpolação linear entre 4.5km e 5km
    const progress = (distanceMeters - MIN_DISTANCE) / (MAX_DISTANCE - MIN_DISTANCE);
    return Math.round(200 * progress);
  }

  /**
   * Calcula SmoothnessScore (0-150) baseado em regularidade do pace
   * Analisa variações de velocidade em segmentos de 500m
   */
  calculateSmoothnessScore(runId: string, pathPoints: any[]): number {
    if (!pathPoints || pathPoints.length < 10) {
      return 0;
    }

    // Dividir trajeto em segmentos de 500m
    const segments: number[] = [];
    let currentSegmentDistance = 0;
    let segmentStartIndex = 0;

    for (let i = 1; i < pathPoints.length; i++) {
      const prev = pathPoints[i - 1];
      const curr = pathPoints[i];
      
      // Calcular distância entre pontos (Haversine simplificado)
      const distance = this.calculateDistance(
        prev.latitude,
        prev.longitude,
        curr.latitude,
        curr.longitude
      );

      currentSegmentDistance += distance;

      if (currentSegmentDistance >= 500 || i === pathPoints.length - 1) {
        // Calcular pace do segmento
        const segmentDuration = (new Date(curr.timestamp).getTime() - 
                                 new Date(prev.timestamp).getTime()) / 1000;
        const segmentPace = this.calculatePaceSecKm(currentSegmentDistance, segmentDuration);
        
        segments.push(segmentPace);
        
        currentSegmentDistance = 0;
        segmentStartIndex = i;
      }
    }

    if (segments.length < 2) {
      return 0;
    }

    // Calcular coeficiente de variação (CV) do pace
    const avgPace = segments.reduce((a, b) => a + b, 0) / segments.length;
    const variance = segments.reduce((sum, pace) => sum + Math.pow(pace - avgPace, 2), 0) / segments.length;
    const stdDev = Math.sqrt(variance);
    const cv = avgPace > 0 ? stdDev / avgPace : 1;

    // Score baseado em regularidade (CV menor = mais regular = maior score)
    // CV ideal < 0.1 = 150 pontos, CV > 0.3 = 0 pontos
    const maxCV = 0.3;
    const minCV = 0.1;
    
    if (cv <= minCV) {
      return 150;
    }
    if (cv >= maxCV) {
      return 0;
    }

    const progress = (cv - minCV) / (maxCV - minCV);
    return Math.round(150 * (1 - progress));
  }

  /**
   * Calcula distância entre dois pontos (Haversine simplificado, em metros)
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Raio da Terra em metros
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Reprocessa pontuações de um participante
   * Atualiza countedDay e countedWeek conforme regras
   */
  async reprocessParticipantScores(participantId: string): Promise<void> {
    await this.prisma.client.$transaction(async (tx) => {
      // 1. Reprocessar máximo 2 corridas por dia
      const runs = await tx.weeklyRun.findMany({
        where: { participantId, isValid: true },
        orderBy: { submittedAt: 'asc' },
      });

      // Agrupar por dayKey
      const runsByDay = new Map<string, typeof runs>();
      for (const run of runs) {
        if (!runsByDay.has(run.dayKey)) {
          runsByDay.set(run.dayKey, []);
        }
        runsByDay.get(run.dayKey)!.push(run);
      }

      // Resetar countedDay
      await tx.weeklyRun.updateMany({
        where: { participantId },
        data: { countedDay: false },
      });

      // Marcar top 2 por dia
      for (const [dayKey, dayRuns] of runsByDay.entries()) {
        const sorted = [...dayRuns].sort((a, b) => b.finalScore - a.finalScore);
        const top2 = sorted.slice(0, 2);
        
        for (const run of top2) {
          await tx.weeklyRun.update({
            where: { id: run.id },
            data: { countedDay: true },
          });
        }
      }

      // 2. Reprocessar melhores 5 da semana (apenas countedDay=true)
      await tx.weeklyRun.updateMany({
        where: { participantId },
        data: { countedWeek: false },
      });

      const validRuns = await tx.weeklyRun.findMany({
        where: { participantId, isValid: true, countedDay: true },
        orderBy: { finalScore: 'desc' },
      });

      const top5 = validRuns.slice(0, 5);
      for (const run of top5) {
        await tx.weeklyRun.update({
          where: { id: run.id },
          data: { countedWeek: true },
        });
      }

      // 3. Atualizar totalPoints e runsValidCount do participante
      const countedRuns = await tx.weeklyRun.findMany({
        where: { participantId, isValid: true, countedWeek: true },
      });

      const totalPoints = countedRuns.reduce((sum, run) => sum + run.finalScore, 0);
      const runsValidCount = countedRuns.length;

      await tx.weeklyRoomParticipant.update({
        where: { id: participantId },
        data: { totalPoints, runsValidCount },
      });
    });
  }
}
