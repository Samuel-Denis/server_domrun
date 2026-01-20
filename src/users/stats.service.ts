import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AchievementStatus } from '@prisma/client';

@Injectable()
export class StatsService {
  constructor(private prisma: PrismaService) { }

  async calculateUserStats(userId: string) {
    // Total distance (em KM)
    const totalDistanceResult = await this.prisma.run.aggregate({
      where: { userId },
      _sum: { distance: true },
    });
    const totalDistance = (totalDistanceResult._sum.distance || 0) / 1000.0; // converter de metros para KM

    // Total runs
    const totalRuns = await this.prisma.run.count({
      where: { userId },
    });

    // Total territories
    const totalTerritories = await this.prisma.territory.count({
      where: { userId },
    });

    // Average pace (em min/km)
    const avgPaceResult = await this.prisma.run.aggregate({
      where: { userId },
      _avg: { averagePace: true },
    });
    const averagePace = avgPaceResult._avg.averagePace || 0;

    // Total time (em segundos)
    const totalTimeResult = await this.prisma.run.aggregate({
      where: { userId },
      _sum: { duration: true },
    });
    const totalTime = totalTimeResult._sum.duration || 0;

    // Longest run (em KM)
    const longestRunResult = await this.prisma.run.aggregate({
      where: { userId },
      _max: { distance: true },
    });
    const longestRun = (longestRunResult._max.distance || 0) / 1000.0; // converter de metros para KM

    // Territory area (área total dominada)
    const territoryAreaResult = await this.prisma.territory.aggregate({
      where: { userId },
      _sum: { area: true },
    });
    const totalTerritoryAreaM2 = territoryAreaResult._sum.area || 0; // área em metros quadrados
    const totalTerritoryAreaKm2 = totalTerritoryAreaM2 / 1000000; // converter m² para km²

    // Trophies (achievements completed)
    const trophies = await this.prisma.userAchievement.count({
      where: {
        userId,
        status: AchievementStatus.CLAIMED,
      },
    });

    // Current streak (dias consecutivos com corridas)
    // Implementação simplificada - contar corridas dos últimos dias
    const currentStreak = await this.calculateCurrentStreak(userId);

    return {
      totalDistance: Number(totalDistance.toFixed(1)),
      territoryPercentageKm2: Number(totalTerritoryAreaKm2.toFixed(2)), // Área em km² (mantido para compatibilidade)
      totalTerritoryAreaM2: Number(totalTerritoryAreaM2.toFixed(2)), // Área em metros quadrados

      totalRuns,
      totalTerritories,
      averagePace: Number(averagePace.toFixed(1)),
      totalTime: totalTimeResult._sum.duration || 0,// tempo total de corridas
      longestRun: Number(longestRun.toFixed(1)),// maior distância corrida
      currentStreak,
    };
  }

  private async calculateCurrentStreak(userId: string): Promise<number> {
    // Buscar todas as corridas ordenadas por data
      const runs = await this.prisma.run.findMany({
      where: { userId },
      orderBy: { startTime: 'desc' },
      select: { startTime: true },
    });

    if (runs.length === 0) return 0;

    // Converter datas para dias (remover hora)
    const runDays = runs.map((run) => {
      const date = new Date(run.startTime);
      date.setHours(0, 0, 0, 0);
      return date.getTime();
    });

    // Remover duplicatas (mesmo dia)
    const uniqueDays = Array.from(new Set(runDays)).sort((a, b) => b - a);

    if (uniqueDays.length === 0) return 0;

    // Verificar se a primeira corrida é hoje ou ontem
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayTime = yesterday.getTime();

    // Se não tem corrida hoje ou ontem, streak é 0
    if (uniqueDays[0] !== todayTime && uniqueDays[0] !== yesterdayTime) {
      return 0;
    }

    // Contar dias consecutivos
    let streak = 1;
    let expectedDay = uniqueDays[0] === todayTime ? todayTime : yesterdayTime;

    for (let i = 1; i < uniqueDays.length; i++) {
      expectedDay -= 24 * 60 * 60 * 1000; // Subtrair 1 dia
      if (uniqueDays[i] === expectedDay) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }
}
