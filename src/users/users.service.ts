import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { UploadService } from './upload.service';
import { StatsService } from './stats.service';
import { AchievementsService } from './achievements.service';
import { XpService } from './xp.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private uploadService: UploadService,
    private statsService: StatsService,
    private achievementsService: AchievementsService,
    private xpService: XpService,
  ) { }

  async create({ username, email, password, name }: CreateUserDto) {
    // Buscar a primeira liga (STARTER) para atribuir ao novo usuário
    const starterLeague = await this.prisma.client.league.findFirst({
      where: {
        code: 'STARTER',
      },
      orderBy: {
        order: 'asc',
      },
    });

    // Se não encontrar STARTER, busca a primeira liga por ordem (fallback)
    const defaultLeague = starterLeague || await this.prisma.client.league.findFirst({
      orderBy: {
        order: 'asc',
      },
    });

    return this.prisma.client.user.create({
      data: {
        username,
        email,
        password,
        name,
        leagueId: defaultLeague?.id || null, // Atribui a liga STARTER (ou primeira disponível)
      }
    });
  }

  async findByUsername(username: string) {
    return this.prisma.client.user.findUnique({
      where: { username }
    });
  }

  async findByEmail(email: string) {
    return this.prisma.client.user.findUnique({
      where: { email }
    });
  }

  async findById(id: string) {
    return this.prisma.client.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        photoUrl: true,
        color: true,
        biography: true,
        level: true,
        trophies: true,
        league: true,
        winStreak: true,
        createdAt: true,
        updatedAt: true,
        lastLogin: true,
        territories: true,
        runs: {

          include: {
            pathPoints: true,
          },
        },
        userAchievements: true,
        xp: true,
        battleWins: true,
        battleLosses: true,
      },
    });
  }

  async getUserByIdComplete(userId: string) {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        photoUrl: true,
        color: true,
        biography: true,
        level: true,
        xp: true,
        trophies: true,
        winStreak: true,
        createdAt: true,
        updatedAt: true,
        lastLogin: true,
        battleWins: true,
        battleLosses: true,
        league: {
          select: {
            id: true,
            code: true,
            displayName: true,
            order: true,
            isChampion: true,
            minTrophiesToEnter: true,
            paceTopSecKm: true,
            paceBaseSecKm: true,
            smurfCapSecKm: true,
            weeklyConsistencyMaxBonus: true,
            shieldName: true,
            shieldAsset: true,
            rewardJson: true,
            themeJson: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        userAchievements: {
          select: {
            id: true,
            userId: true,
            achievementId: true,
            status: true,
            progress: true,
            progressText: true,
            unlockedAt: true,
            claimedAt: true,
            currentValue: true,
            targetValue: true,
            updatedAt: true,
            achievement: {
              select: {
                id: true,
                code: true,
                title: true,
                description: true,
                category: true,
                rarity: true,
                iconAsset: true,
                isActive: true,
                isHidden: true,
                criteriaJson: true,
                rewardJson: true,
                seasonNumber: true,
              },
            },
          },
        },
        runs: {
          select: {
            id: true,
            userId: true,
            startTime: true,
            endTime: true,
            distance: true,
            duration: true,
            averagePace: true,
            maxSpeed: true,
            elevationGain: true,
            calories: true,
            caption: true,
            territoryId: true,
            mapImageUrl: true,
            mapImageCleanUrl: true,
            createdAt: true,

            pathPoints: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        // territories será buscado separadamente com SQL raw para incluir boundary
        // Não incluir password e outros dados sensíveis
      },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    // Calcular área total de territórios (em m²)
    const territoryAreaResult = await this.prisma.client.territory.aggregate({
      where: { userId },
      _sum: { area: true },
    });
    const totalTerritoryAreaM2 = territoryAreaResult._sum.area || 0;

    // Buscar territórios com boundary (geometria PostGIS convertida para array de pontos)
    const territoriesWithBoundary = await this.getTerritoriesWithBoundary(userId);

    // Calcular informações de XP
    const xpInfo = await this.xpService.getXpInfo(userId);

    return {
      ...user,
      territories: territoriesWithBoundary,
      totalTerritoryAreaM2: Number(totalTerritoryAreaM2.toFixed(2)),
      xpInfo,
    };
  }

  /**
   * Converte GeoJSON Polygon para formato boundary (array de pontos)
   * 
   * Após processamento PostGIS, o território é um Polygon bufferizado.
   * Este método extrai o ring externo do polígono e converte de volta para
   * o formato boundary que o frontend espera.
   * 
   * @param geoJson - GeoJSON Polygon retornado do PostGIS (ST_AsGeoJSON)
   * @returns Array de pontos no formato {latitude, longitude, timestamp}
   */
  private geoJsonToBoundaryPoints(geoJson: any): Array<{ latitude: number; longitude: number; timestamp?: string }> {
    // Valida se é um Polygon válido
    if (!geoJson || geoJson.type !== 'Polygon') {
      return [];
    }

    // GeoJSON Polygon structure:
    // {
    //   type: "Polygon",
    //   coordinates: [
    //     [[lng, lat], [lng, lat], ...],  // Ring externo (boundary)
    //     [[lng, lat], ...]                // Holes (não usados aqui)
    //   ]
    // }
    // coordinates[0] é o ring externo (contorno do polígono)
    const coordinates = geoJson.coordinates[0] as number[][];

    // Converte cada coordenada [lng, lat] para {latitude, longitude, timestamp}
    return coordinates.map((coord) => ({
      latitude: coord[1], // GeoJSON usa [longitude, latitude] (invertido do formato comum)
      longitude: coord[0],
      timestamp: new Date().toISOString(), // Timestamp aproximado (não preservado do original)
    }));
  }

  /**
   * Busca territórios do usuário com boundary (geometria convertida para array de pontos)
   * 
   * @param userId - ID do usuário
   * @returns Array de territórios com boundary incluído
   */
  private async getTerritoriesWithBoundary(userId: string) {
    // Buscar territórios com geometria em GeoJSON usando SQL raw
    const territoriesRaw = await this.prisma.client.$queryRawUnsafe(`
      SELECT 
        t.id,
        t."userId",
        t."userName",
        t."userColor",
        t."areaName",
        t.area,
        t."capturedAt",
        t."createdAt",
        t."updatedAt",
        ST_AsGeoJSON(t.geometry)::json as geometry_geojson
      FROM territories t
      WHERE t."userId" = $1
      ORDER BY t."createdAt" DESC
    `, userId) as any[];

    // Converter GeoJSON para boundary e formatar retorno
    return territoriesRaw.map((t) => {
      const geoJson = t.geometry_geojson;
      const boundary = this.geoJsonToBoundaryPoints(geoJson);

      return {
        id: t.id,
        userId: t.userId,
        userName: t.userName,
        userColor: t.userColor,
        areaName: t.areaName,
        area: t.area ? parseFloat(t.area) : null,
        capturedAt: t.capturedAt,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        boundary,
      };
    });
  }

  async getPublicUserById(userId: string) {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        name: true,
        photoUrl: true,
        color: true,
        biography: true,
        level: true,
        createdAt: true,
        league: true,
        winStreak: true,
        trophies: true,
        xp: true,
        lastLogin: true,
        updatedAt: true,
        territories: true,
        runs: true,
        userAchievements: true,
        battlesWon: true,
        battleWins: true,
        battleLosses: true,
        // Não incluir: email, password, updatedAt, lastLogin e outros dados sensíveis
      },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    // Calcular área total de territórios (em m²)
    const territoryAreaResult = await this.prisma.client.territory.aggregate({
      where: { userId },
      _sum: { area: true },
    });
    const totalTerritoryAreaM2 = territoryAreaResult._sum.area || 0;

    // Calcular informações de XP
    const xpInfo = await this.xpService.getXpInfo(userId);

    return {
      ...user,
      totalTerritoryAreaM2: Number(totalTerritoryAreaM2.toFixed(2)),
      xpInfo,
    };
  }

  async updateProfile(
    userId: string,
    updateProfileDto: UpdateProfileDto,
    file?: Express.Multer.File,
  ) {
    // Verificar se o usuário existe
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    // Verificar se o username já está em uso por outro usuário
    if (updateProfileDto.username && updateProfileDto.username !== user.username) {
      const existingUser = await this.findByUsername(updateProfileDto.username);
      if (existingUser) {
        throw new ConflictException('Nome de usuário já está em uso');
      }
    }

    // Preparar dados para atualização
    const updateData: any = {
      name: updateProfileDto.name,
      username: updateProfileDto.username,
    };

    // Adicionar campos opcionais apenas se foram fornecidos
    if (updateProfileDto.color !== undefined) {
      updateData.color = updateProfileDto.color;
    }

    if (updateProfileDto.biography !== undefined) {
      updateData.biography = updateProfileDto.biography || null;
    }

    // Se a senha foi fornecida, fazer hash
    if (updateProfileDto.password) {
      updateData.password = await bcrypt.hash(updateProfileDto.password, 10);
    }

    // Se uma nova imagem foi enviada, salvar e atualizar photoUrl
    if (file) {
      // Deletar imagem antiga se existir
      if (user.photoUrl) {
        await this.uploadService.deleteProfileImage(user.photoUrl);
      }

      // Salvar nova imagem
      const photoUrl = await this.uploadService.saveProfileImage(file, userId);
      updateData.photoUrl = photoUrl;
    }

    // Atualizar o usuário
    const updatedUser = await this.prisma.client.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        color: true,
        biography: true,
        photoUrl: true,
        level: true,
        createdAt: true,
        updatedAt: true,
        lastLogin: true,
      },
    });

    return updatedUser;
  }

  async updateLastLogin(userId: string) {
    await this.prisma.client.user.update({
      where: { id: userId },
      data: { lastLogin: new Date() },
    });
  }

  async getCompleteProfile(userId: string) {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    // Buscar dados em paralelo (posts removidos do sistema)
    const [stats, achievements, runsData] = await Promise.all([
      this.statsService.calculateUserStats(userId),
      this.achievementsService.getUserAchievementsLight(userId),
      this.getUserRuns(userId, 20, 0),
    ]);

    // Formatar usuário
    const userData = {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      photoUrl: user.photoUrl,
      color: user.color,
      biography: user.biography,
      level: user.level || 1,
      trophies: user.trophies,
      league: user.league,
      winStreak: user.winStreak,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLogin: user.lastLogin,
      territories: user.territories,
      runs: runsData.runs,
      userAchievementsCompleted: user.userAchievements || [],
      battleWins: user.battleWins,
      battleLosses: user.battleLosses,

    };

    const xpInfo = await this.xpService.getXpInfo(userId);

    return {
      user: userData,
      stats,
      xpInfo,
    };
  }

  async getUserRuns(userId: string, limit = 20, offset = 0) {
    const [runs, total] = await Promise.all([
      this.prisma.client.run.findMany({
        where: { userId },
        orderBy: { startTime: 'desc' },
        take: limit,
        skip: offset,
        include: {

          pathPoints: {
            orderBy: { sequenceOrder: 'asc' },
          },
        },
      }),
      this.prisma.client.run.count({ where: { userId } }),
    ]);

    return {
      runs,
      total,
      limit,
      offset,
    };
  }

  findAll() {
    return `This action returns all users`;
  }

  findOne(id: number) {
    return `This action returns a #${id} user`;
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    return `This action updates a #${id} user`;
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }

  async getTrophyRanking(limit: number = 10) {
    const users = await this.prisma.client.user.findMany({
      take: limit,
      orderBy: {
        trophies: 'desc',
      },
      select: {
        id: true,
        username: true,
        name: true,
        photoUrl: true,
        color: true,
        trophies: true,
        league: true,
        winStreak: true,
        level: true,
        battleWins: true,
        battleLosses: true,
      },
    });

    return {
      ranking: users.map((user, index) => ({
        position: index + 1,
        id: user.id,
        username: user.username,
        name: user.name,
        photoUrl: user.photoUrl,
        color: user.color,
        trophies: user.trophies,
        league: user.league || null,
        winStreak: user.winStreak,
        level: user.level,
        battleWins: user.battleWins,
        battleLosses: user.battleLosses,
      })),
      total: users.length,
    };
  }
}
