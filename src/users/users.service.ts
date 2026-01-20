import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma, AchievementStatus } from '@prisma/client';
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
    const starterLeague = await this.prisma.league.findFirst({
      where: {
        code: 'STARTER',
      },
      orderBy: {
        order: 'asc',
      },
    });

    // Se não encontrar STARTER, busca a primeira liga por ordem (fallback)
    const defaultLeague = starterLeague || await this.prisma.league.findFirst({
      orderBy: {
        order: 'asc',
      },
    });

    return this.prisma.user.create({
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
    return this.prisma.user.findUnique({
      where: { username }
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email }
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
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
      console.log('chegou aqui 2'+ userId);
    const user = await this.prisma.user.findUnique({
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
    const territoryAreaResult = await this.prisma.territory.aggregate({
      where: { userId },
      _sum: { area: true },
    });
    const totalTerritoryAreaM2 = territoryAreaResult._sum.area || 0;

    // Buscar territórios com geometria GeoJSON
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
   * @deprecated Este método foi removido em favor de retornar GeoJSON diretamente.
   * Use geometryGeoJson no retorno dos territórios.
   */

  /**
   * Busca territórios do usuário com geometria em GeoJSON
   * 
   * @param userId - ID do usuário
   * @param simplifyTolerance - Tolerância para simplificação (metros). Se fornecido, aplica ST_SimplifyPreserveTopology.
   *                            Recomendado: 5-20 metros para reduzir pontos sem perder detalhes visuais.
   * @returns Array de territórios com geometryGeoJson incluído (GeoJSON Polygon)
   */
  private async getTerritoriesWithBoundary(userId: string, simplifyTolerance?: number) {
    // Aplicar simplificação se solicitado
    // ST_SimplifyPreserveTopology reduz pontos mantendo topologia (melhor que ST_Simplify)
    // A tolerância é em metros (para geometria em SRID 3857 - Web Mercator)
    const geometrySelect = simplifyTolerance !== undefined && simplifyTolerance > 0
      ? Prisma.sql`ST_AsGeoJSON(ST_SimplifyPreserveTopology(t.geometry, ${simplifyTolerance}))::json`
      : Prisma.sql`ST_AsGeoJSON(t.geometry)::json`;

    // Buscar territórios com geometria em GeoJSON usando SQL raw
    const territoriesRaw = await this.prisma.$queryRaw(Prisma.sql`
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
        ${geometrySelect} as geometry_geojson
      FROM territories t
      WHERE t."userId" = ${userId}::text
      ORDER BY t."createdAt" DESC
    `) as any[];

    // Retornar GeoJSON diretamente (sem converter para boundary points)
    return territoriesRaw.map((t) => ({
      id: t.id,
      userId: t.userId,
      userName: t.userName,
      userColor: t.userColor,
      areaName: t.areaName,
      area: t.area ? parseFloat(t.area) : null,
      capturedAt: t.capturedAt,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      geometryGeoJson: t.geometry_geojson, // GeoJSON Polygon limpo
    }));
  }

  /**
   * Busca perfil público do usuário
   * Por padrão retorna apenas dados básicos (otimizado)
   * Use full=true para obter dados completos (runs, territories, achievements)
   * 
   * @param userId - ID do usuário
   * @param full - Se true, retorna dados completos
   * @param simplifyTolerance - Tolerância de simplificação em metros (opcional, apenas quando full=true)
   */
  async getPublicUserById(userId: string, full: boolean = false, simplifyTolerance?: number) {
    const user = await this.prisma.user.findUnique({
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
        league: {
          select: {
            id: true,
            code: true,
            displayName: true,
            order: true,
            isChampion: true,
            shieldName: true,
            shieldAsset: true,
          },
        },
        winStreak: true,
        trophies: true,
        xp: true,
        battleWins: true,
        battleLosses: true,
        // Não incluir: email, password, updatedAt, lastLogin e outros dados sensíveis
      },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    // Calcular área total de territórios (em m²) - sempre necessário para estatísticas
    const territoryAreaResult = await this.prisma.territory.aggregate({
      where: { userId },
      _sum: { area: true },
      _count: { id: true },
    });
    const totalTerritoryAreaM2 = territoryAreaResult._sum.area || 0;
    const territoriesCount = territoryAreaResult._count.id || 0;

    // Contagem de runs (sempre retornar para estatísticas)
    const runsCount = await this.prisma.run.count({
      where: { userId },
    });

    // Contagem de conquistas (sempre retornar para estatísticas)
    const achievementsCount = await this.prisma.userAchievement.count({
      where: { 
        userId,
        status: AchievementStatus.CLAIMED,
      },
    });

    // Calcular informações de XP
    const xpInfo = await this.xpService.getXpInfo(userId);

    // Resposta base (sempre retornada)
    const baseResponse = {
      ...user,
      totalTerritoryAreaM2: Number(totalTerritoryAreaM2.toFixed(2)),
      territoriesCount,
      runsCount,
      achievementsCount,
      xpInfo,
    };

    // Se full=true, incluir dados completos
    if (full) {
      // Buscar territórios completos com geometria GeoJSON (com simplificação opcional)
      const territoriesWithBoundary = await this.getTerritoriesWithBoundary(userId, simplifyTolerance);

      // Buscar runs completas (apenas últimas 10 para não sobrecarregar)
      const runs = await this.prisma.run.findMany({
        where: { userId },
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
          // Não incluir pathPoints por padrão (muito pesado)
          // Se necessário, criar endpoint específico para pathPoints
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 10, // Limitar a 10 últimas runs
      });

      // Buscar conquistas completas
      const achievements = await this.achievementsService.getUserAchievementsLight(userId);

      return {
        ...baseResponse,
        territories: territoriesWithBoundary,
        runs,
        achievements,
      };
    }

    // Retornar apenas dados básicos (otimizado)
    return baseResponse;
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
    const updatedUser = await this.prisma.user.update({
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
    await this.prisma.user.update({
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
      this.prisma.run.findMany({
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
      this.prisma.run.count({ where: { userId } }),
    ]);

    return {
      runs,
      total,
      limit,
      offset,
    };
  }

  /**
   * Busca runs do usuário com paginação cursor-based (otimizada)
   * 
   * @param userId - ID do usuário
   * @param take - Número de itens por página (padrão: 20, máximo: 100)
   * @param cursor - ID da última run da página anterior (opcional)
   * @returns Objeto com runs e nextCursor para próxima página
   */
  async getUserRunsCursorBased(userId: string, take: number = 20, cursor?: string) {
    // Validar take
    const validTake = Math.min(Math.max(1, take), 100);

    // Construir where clause
    const where = cursor
      ? {
          userId,
          id: {
            lt: cursor, // Menor que cursor (para ordem desc)
          },
        }
      : { userId };

    // Buscar runs (ordem por createdAt desc, usar id como cursor)
    const runs = await this.prisma.run.findMany({
      where,
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' }, // Ordem secundária para garantir consistência
      ],
      take: validTake + 1, // Buscar um a mais para saber se há próxima página
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
        // Não incluir pathPoints por padrão (muito pesado)
        // Criar endpoint separado se necessário
      },
    });

    // Verificar se há próxima página
    const hasNextPage = runs.length > validTake;
    const results = hasNextPage ? runs.slice(0, validTake) : runs;

    // Próximo cursor = id da última run da página atual
    const nextCursor = hasNextPage ? results[results.length - 1].id : null;

    return {
      runs: results,
      nextCursor,
      hasNextPage,
      count: results.length,
    };
  }

  /**
   * Busca territórios do usuário com paginação cursor-based
   * 
   * @param userId - ID do usuário
   * @param take - Número de itens por página (padrão: 20, máximo: 100)
   * @param cursor - ID do último território da página anterior (opcional)
   * @param simplifyTolerance - Tolerância para simplificação em metros (opcional). Se fornecido, aplica ST_SimplifyPreserveTopology.
   * @returns Objeto com territories e nextCursor para próxima página
   */
  async getUserTerritoriesCursorBased(userId: string, take: number = 20, cursor?: string, simplifyTolerance?: number) {
    // Validar take
    const validTake = Math.min(Math.max(1, take), 100);

    // Aplicar simplificação se solicitado
    // ST_SimplifyPreserveTopology reduz pontos mantendo topologia (melhor que ST_Simplify)
    // A tolerância é em metros (para geometria em SRID 3857 - Web Mercator)
    const geometrySelect = simplifyTolerance !== undefined && simplifyTolerance > 0
      ? Prisma.sql`ST_AsGeoJSON(ST_SimplifyPreserveTopology(t.geometry, ${simplifyTolerance}))::json`
      : Prisma.sql`ST_AsGeoJSON(t.geometry)::json`;

    // Buscar territórios (ordem por createdAt desc, usar id como cursor)
    const territoriesRaw = await this.prisma.$queryRaw(Prisma.sql`
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
        ${geometrySelect} as geometry_geojson
      FROM territories t
      WHERE t."userId" = ${userId}::uuid
        ${cursor ? Prisma.sql`AND t.id < ${cursor}::uuid` : Prisma.empty}
      ORDER BY t."createdAt" DESC, t.id DESC
      LIMIT ${validTake + 1}
    `) as any[];

    // Verificar se há próxima página
    const hasNextPage = territoriesRaw.length > validTake;
    const resultsRaw = hasNextPage ? territoriesRaw.slice(0, validTake) : territoriesRaw;

    // Retornar GeoJSON diretamente (sem converter para boundary points)
    const territories = resultsRaw.map((t) => ({
      id: t.id,
      userId: t.userId,
      userName: t.userName,
      userColor: t.userColor,
      areaName: t.areaName,
      area: parseFloat(t.area),
      geometryGeoJson: t.geometry_geojson, // GeoJSON Polygon limpo
      capturedAt: t.capturedAt,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));

    // Próximo cursor = id do último território da página atual
    const nextCursor = hasNextPage ? territories[territories.length - 1].id : null;

    return {
      territories,
      nextCursor,
      hasNextPage,
      count: territories.length,
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
      const users = await this.prisma.user.findMany({
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
