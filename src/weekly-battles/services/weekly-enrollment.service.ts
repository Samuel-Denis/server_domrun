import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LeagueService } from './league.service';
import { getEnrollmentPeriod, isEnrollmentPeriod, getNextWeekKey, parseWeekKey } from '../utils/week-helper';

/**
 * Serviço para gerenciar inscrições semanais
 */
@Injectable()
export class WeeklyEnrollmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly leagueService: LeagueService,
  ) {}

  /**
   * Inscreve o usuário para a próxima semana
   * Disponível apenas durante segunda-feira (00:00 - 23:59)
   */
  async enrollUser(userId: string): Promise<any> {
    // 1. Verificar se estamos no período de inscrição
    if (!isEnrollmentPeriod()) {
      const enrollmentPeriod = getEnrollmentPeriod();
      throw new BadRequestException(
        `Período de inscrição é apenas na segunda-feira (${enrollmentPeriod.startDate.toLocaleDateString('pt-BR')} 00:00 - 23:59)`
      );
    }

    // 2. Buscar usuário e verificar se tem liga (não pode ser Imortal)
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      include: { league: true },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    if (!user.leagueId || !user.league) {
      throw new BadRequestException('Usuário precisa ter uma liga atribuída para se inscrever');
    }

    if (user.league.isChampion) {
      throw new BadRequestException('Usuários da Liga Imortal não participam de salas semanais');
    }

    // 3. Obter weekKey da próxima semana
    const nextWeekKey = getNextWeekKey();
    const { seasonNumber, weekNumber } = parseWeekKey(nextWeekKey);

    // 4. Verificar se já está inscrito
    const existingEnrollment = await this.prisma.client.weeklyEnrollment.findUnique({
      where: {
        userId_weekKey: {
          userId,
          weekKey: nextWeekKey,
        },
      },
    });

    if (existingEnrollment) {
      throw new BadRequestException('Você já está inscrito para esta semana');
    }

    // 5. Criar inscrição
    const enrollment = await this.prisma.client.weeklyEnrollment.create({
      data: {
        userId,
        weekKey: nextWeekKey,
        seasonNumber,
        weekNumber,
        leagueId: user.leagueId,
      },
      include: {
        league: {
          select: {
            code: true,
            displayName: true,
          },
        },
      },
    });

    return enrollment;
  }

  /**
   * Remove inscrição do usuário (cancelamento)
   */
  async unenrollUser(userId: string, weekKey?: string): Promise<void> {
    const targetWeekKey = weekKey || getNextWeekKey();

    // Verificar se está no período de inscrição
    if (!isEnrollmentPeriod()) {
      throw new BadRequestException('Só é possível cancelar inscrição durante o período de inscrição (segunda-feira)');
    }

    const enrollment = await this.prisma.client.weeklyEnrollment.findUnique({
      where: {
        userId_weekKey: {
          userId,
          weekKey: targetWeekKey,
        },
      },
    });

    if (!enrollment) {
      throw new NotFoundException('Inscrição não encontrada');
    }

    await this.prisma.client.weeklyEnrollment.delete({
      where: { id: enrollment.id },
    });
  }

  /**
   * Verifica se usuário está inscrito para uma semana
   */
  async isUserEnrolled(userId: string, weekKey: string): Promise<boolean> {
    const enrollment = await this.prisma.client.weeklyEnrollment.findUnique({
      where: {
        userId_weekKey: {
          userId,
          weekKey,
        },
      },
    });

    return !!enrollment;
  }

  /**
   * Busca todas as inscrições de uma semana específica
   */
  async getEnrollmentsForWeek(weekKey: string): Promise<any[]> {
    return this.prisma.client.weeklyEnrollment.findMany({
      where: { weekKey },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            leagueId: true,
          },
        },
        league: {
          select: {
            code: true,
            displayName: true,
            order: true,
          },
        },
      },
      orderBy: [
        { league: { order: 'asc' } },
        { enrolledAt: 'asc' },
      ],
    });
  }

  /**
   * Busca inscrições de um usuário
   */
  async getUserEnrollments(userId: string): Promise<any[]> {
    return this.prisma.client.weeklyEnrollment.findMany({
      where: { userId },
      include: {
        league: {
          select: {
            code: true,
            displayName: true,
          },
        },
      },
      orderBy: { enrolledAt: 'desc' },
    });
  }
}
