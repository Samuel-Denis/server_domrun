import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { generateWeekKey, getCurrentWeekRange, getCompetitionWeekRange, parseWeekKey } from '../utils/week-helper';
import { LeagueService } from './league.service';

/**
 * Serviço para gerenciar salas semanais
 */
@Injectable()
export class WeeklyRoomService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly leagueService: LeagueService,
  ) { }

  /**
   * Cria salas semanais para todas as ligas não-campeãs
   * Agrupa usuários INSCRITOS em batches de 20 por sala
   * Deve ser executado na Terça 00:00, após período de inscrições
   * 
   * IMPORTANTE: startDate e endDate das salas devem ser ajustados para período competitivo (Terça-Domingo)
   */
  async createWeeklyRooms(): Promise<void> {
    const competitionRange = getCompetitionWeekRange(); // Terça 00:00 → Domingo 23:59
    const weekKey = generateWeekKey();
    const { seasonNumber, weekNumber } = parseWeekKey(weekKey);

    console.log(`📅 Criando salas semanais para ${weekKey} (Season ${seasonNumber}, Week ${weekNumber})`);

    // Buscar todas as inscrições desta semana, agrupadas por liga
    const enrollments = await this.prisma.weeklyEnrollment.findMany({
      where: { weekKey },
      include: {
        user: {
          select: {
            id: true,
            leagueId: true,
          },
        },
        league: {
          select: {
            id: true,
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

    if (enrollments.length === 0) {
      console.log(`⚠️  Nenhuma inscrição encontrada para ${weekKey}`);
      return;
    }

    // Agrupar inscrições por liga
    const enrollmentsByLeague = new Map<string, typeof enrollments>();
    for (const enrollment of enrollments) {
      const leagueId = enrollment.leagueId;
      if (!enrollmentsByLeague.has(leagueId)) {
        enrollmentsByLeague.set(leagueId, []);
      }
      enrollmentsByLeague.get(leagueId)!.push(enrollment);
    }

    // Criar salas para cada liga
    for (const [leagueId, leagueEnrollments] of enrollmentsByLeague.entries()) {
      await this.createRoomsForLeague(
        leagueId,
        seasonNumber,
        weekNumber,
        weekKey,
        competitionRange, // Usar período competitivo (Terça-Domingo)
        leagueEnrollments.map(e => e.user.id),
      );
    }

    console.log(`✅ Salas semanais criadas com sucesso (${enrollments.length} inscritos)`);
  }

  /**
   * Cria salas para uma liga específica usando apenas usuários inscritos
   */
  private async createRoomsForLeague(
    leagueId: string,
    seasonNumber: number,
    weekNumber: number,
    weekKey: string,
    weekRange: { startDate: Date; endDate: Date },
    enrolledUserIds: string[],
  ): Promise<void> {
    if (enrolledUserIds.length === 0) {
      console.log(`ℹ️  Nenhum usuário inscrito na liga ${leagueId}, pulando...`);
      return;
    }

    // Agrupar em batches de 20
    const BATCH_SIZE = 20;
    const batches: string[][] = [];

    for (let i = 0; i < enrolledUserIds.length; i += BATCH_SIZE) {
      batches.push(enrolledUserIds.slice(i, i + BATCH_SIZE));
    }

    console.log(`🏠 Liga ${leagueId}: ${enrolledUserIds.length} inscritos → ${batches.length} sala(s)`);

    // Criar uma sala para cada batch
    for (let roomNumber = 1; roomNumber <= batches.length; roomNumber++) {
      const userIds = batches[roomNumber - 1];

        // Verificar se sala já existe (idempotência)
        // Usar findFirst pois Prisma precisa do nome da constraint composta
        const existingRoom = await this.prisma.weeklyRoom.findFirst({
          where: {
            leagueId,
            seasonNumber,
            weekNumber,
            roomNumber,
          },
        });

        if (existingRoom) {
          console.log(`⚠️  Sala ${leagueId}-${roomNumber} já existe, pulando...`);
          return;
        }

        // Criar sala com período competitivo (Terça 00:00 → Domingo 23:59)
        const room = await this.prisma.weeklyRoom.create({
          data: {
            leagueId,
            seasonNumber,
            weekNumber,
            weekKey,
            roomNumber,
            startDate: weekRange.startDate, // Terça 00:00
            endDate: weekRange.endDate, // Domingo 23:59
            status: 'OPEN',
          },
        });

        // Criar participantes (usar leagueId do snapshot da inscrição)
        for (const userId of userIds) {
          // Buscar inscrição para obter leagueId no momento da inscrição
          const enrollment = await this.prisma.weeklyEnrollment.findUnique({
            where: {
              userId_weekKey: {
                userId,
                weekKey,
              },
            },
          });

          if (enrollment) {
            await this.prisma.weeklyRoomParticipant.create({
              data: {
                roomId: room.id,
                userId,
                startingLeagueId: enrollment.leagueId,
                weekKey: weekKey, // Copiar weekKey do WeeklyRoom (obrigatório para constraint @@unique([userId, weekKey]))
              },
            });
          }
        }

        console.log(`✅ Sala ${room.id} criada com ${userIds.length} participantes`);
    }
  }

  /**
   * Busca sala atual do usuário
   */
  async getCurrentRoom(userId: string): Promise<any | null> {
    const weekKey = generateWeekKey();

    const participant = await this.prisma.weeklyRoomParticipant.findFirst({
      where: {
        userId,
        room: {
          weekKey,
          status: { in: ['OPEN', 'IN_PROGRESS'] },
          startDate: { lte: new Date() },
          endDate: { gte: new Date() },
        },
      },
      include: {
        room: {
          include: {
            league: true,
          },
        },
      },
    });

    if (!participant) {
      return null;
    }

    const room = participant.room;
    const participantsCount = await this.prisma.weeklyRoomParticipant.count({
      where: { roomId: room.id },
    });

    return {
      ...room,
      userParticipant: {
        id: participant.id,
        totalPoints: participant.totalPoints,
        runsValidCount: participant.runsValidCount,
        position: participant.position,
      },
      participantsCount,
    };
  }

  /**
   * Busca ranking da sala
   */
  async getRoomRanking(roomId: string): Promise<any | null> {
    const room = await this.prisma.weeklyRoom.findUnique({
      where: { id: roomId },
      include: {
        league: true,
      },
    });

    if (!room) {
      throw new NotFoundException('Sala não encontrada');
    }

    const participants = await this.prisma.weeklyRoomParticipant.findMany({
      where: { roomId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            photoUrl: true,
          },
        },
      },
      orderBy: { totalPoints: 'desc' },
    });

    const rankings = participants.map((p, index) => ({
      position: index + 1,
      userId: p.user.id,
      userName: p.user.name,
      userPhotoUrl: p.user.photoUrl || undefined,
      totalPoints: p.totalPoints,
      consistencyBonus: p.consistencyBonus,
      runsValidCount: p.runsValidCount,
      promoted: p.promoted,
      demoted: p.demoted,
    }));

    return {
      roomId: room.id,
      league: {
        code: room.league.code,
        displayName: room.league.displayName,
      },
      weekKey: room.weekKey,
      rankings,
    };
  }
}
