import { Injectable, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { XpService } from './xp.service';
import { AchievementStatus } from '@prisma/client';

@Injectable()
export class AchievementsService {
  private readonly logger = new Logger(AchievementsService.name);

  constructor(
    private prisma: PrismaService,
    private xpService: XpService,
  ) { }

  /**
   * Retorna TODAS as conquistas do catálogo com o estado atual do usuário
   * Inclui conquistas LOCKED, IN_PROGRESS, UNLOCKED e CLAIMED
   * Retorna dados completos: Achievement (catálogo) + UserAchievement (estado do usuário)
   * 
   * @deprecated Para paginação, use getUserAchievementsCursorBased
   */
  async getUserAchievementsLight(userId: string) {
    // 1. Buscar todas as conquistas ativas do catálogo
    const allAchievements = await this.prisma.achievement.findMany({
      where: {
        isActive: true,
      },
      orderBy: [
        { category: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    // 2. Buscar estado do usuário para todas as conquistas (LEFT JOIN via código)
    const userAchievements = await this.prisma.userAchievement.findMany({
      where: { userId },
      include: {
        achievement: true, // Incluir dados do catálogo para garantir consistência
        progressDetails: {
          orderBy: { lastUpdated: 'desc' },
          take: 1, // Pegar apenas o progresso mais recente
        },
      },
    });

    // 3. Criar mapa de achievementId -> UserAchievement para lookup rápido
    const userAchievementMap = new Map(
      userAchievements.map((ua) => [ua.achievementId, ua])
    );

    // 4. Combinar catálogo com estado do usuário e filtrar conquistas ocultas
    const result = allAchievements
      .map((achievement) => {
        const userAchievement = userAchievementMap.get(achievement.id);

        // Se conquista é oculta (isHidden = true) e não foi desbloqueada, não incluir na lista
        if (achievement.isHidden && (!userAchievement || userAchievement.status === AchievementStatus.LOCKED)) {
          return null; // Filtrar depois
        }

        // Se não tem UserAchievement, está LOCKED
        if (!userAchievement) {
          return {
            // Dados do catálogo (Achievement)
            id: achievement.id,
            code: achievement.code,
            title: achievement.title,
            description: achievement.description,
            category: achievement.category,
            rarity: achievement.rarity,
            iconAsset: achievement.iconAsset,
            isHidden: achievement.isHidden,
            criteriaJson: achievement.criteriaJson,
            rewardJson: achievement.rewardJson,
            seasonNumber: achievement.seasonNumber,

            // Estado do usuário (LOCKED - não iniciada)
            status: AchievementStatus.LOCKED,
            progress: 0.0,
            progressText: null,
            currentValue: null,
            targetValue: null,
            unlockedAt: null,
            claimedAt: null,
          };
        }

        // Tem UserAchievement - retornar estado atual
        const latestProgress = userAchievement.progressDetails[0];

        return {
          // Dados do catálogo (Achievement)
          id: achievement.id,
          code: achievement.code,
          title: achievement.title,
          description: achievement.description,
          category: achievement.category,
          rarity: achievement.rarity,
          iconAsset: achievement.iconAsset,
          isHidden: achievement.isHidden,
          criteriaJson: achievement.criteriaJson,
          rewardJson: achievement.rewardJson,
          seasonNumber: achievement.seasonNumber,

          // Estado do usuário (UserAchievement)
          status: userAchievement.status,
          progress: userAchievement.progress,
          progressText: userAchievement.progressText,
          currentValue: userAchievement.currentValue ?? latestProgress?.currentValue ?? null,
          targetValue: userAchievement.targetValue ?? latestProgress?.targetValue ?? null,
          unlockedAt: userAchievement.unlockedAt,
          claimedAt: userAchievement.claimedAt,

          // Dados de progresso detalhado (opcional, do último UserAchievementProgress)
          progressData: latestProgress?.progressData ?? null,
        };
      })
      .filter((item) => item !== null); // Remove conquistas ocultas não desbloqueadas

    return result;
  }

  /**
   * Busca conquistas do usuário com paginação cursor-based
   * Retorna conquistas ordenadas por categoria e data de criação
   * 
   * @param userId - ID do usuário
   * @param take - Número de itens por página (padrão: 20, máximo: 100)
   * @param cursor - ID da última conquista da página anterior (opcional)
   * @returns Objeto com achievements e nextCursor para próxima página
   */
  async getUserAchievementsCursorBased(userId: string, take: number = 20, cursor?: string) {
    // Validar take
    const validTake = Math.min(Math.max(1, take), 100);

    // Construir where clause para conquistas ativas
    const achievementWhere: any = {
      isActive: true,
    };

    if (cursor) {
      // Para cursor-based, precisamos buscar todas as conquistas e filtrar após
      // (já que a ordenação é complexa: category + createdAt)
      // Alternativa: usar apenas id como cursor simplificado
      achievementWhere.id = {
        gt: cursor, // Maior que cursor (para ordem asc por id)
      };
    }

    // Buscar conquistas do catálogo (ordem por category asc, createdAt asc, id asc)
    const allAchievements = await this.prisma.achievement.findMany({
      where: achievementWhere,
      orderBy: [
        { category: 'asc' },
        { createdAt: 'asc' },
        { id: 'asc' }, // Ordem terciária para garantir consistência no cursor
      ],
      take: validTake + 1, // Buscar um a mais para saber se há próxima página
    });

    // Verificar se há próxima página
    const hasNextPage = allAchievements.length > validTake;
    const achievementsPage = hasNextPage ? allAchievements.slice(0, validTake) : allAchievements;

    // Buscar estado do usuário para as conquistas da página atual
    const achievementIds = achievementsPage.map((a) => a.id);
    const userAchievements = await this.prisma.userAchievement.findMany({
      where: {
        userId,
        achievementId: { in: achievementIds },
      },
      include: {
        progressDetails: {
          orderBy: { lastUpdated: 'desc' },
          take: 1,
        },
      },
    });

    // Criar mapa de achievementId -> UserAchievement
    const userAchievementMap = new Map(
      userAchievements.map((ua) => [ua.achievementId, ua])
    );

    // Combinar catálogo com estado do usuário
    const result = achievementsPage
      .map((achievement) => {
        const userAchievement = userAchievementMap.get(achievement.id);

        // Se conquista é oculta e não foi desbloqueada, não incluir
        if (achievement.isHidden && (!userAchievement || userAchievement.status === AchievementStatus.LOCKED)) {
          return null;
        }

        // Se não tem UserAchievement, está LOCKED
        if (!userAchievement) {
          return {
            id: achievement.id,
            code: achievement.code,
            title: achievement.title,
            description: achievement.description,
            category: achievement.category,
            rarity: achievement.rarity,
            iconAsset: achievement.iconAsset,
            isHidden: achievement.isHidden,
            criteriaJson: achievement.criteriaJson,
            rewardJson: achievement.rewardJson,
            seasonNumber: achievement.seasonNumber,
            status: AchievementStatus.LOCKED,
            progress: 0.0,
            progressText: null,
            currentValue: null,
            targetValue: null,
            unlockedAt: null,
            claimedAt: null,
          };
        }

        // Tem UserAchievement - retornar estado atual
        const latestProgress = userAchievement.progressDetails[0];

        return {
          id: achievement.id,
          code: achievement.code,
          title: achievement.title,
          description: achievement.description,
          category: achievement.category,
          rarity: achievement.rarity,
          iconAsset: achievement.iconAsset,
          isHidden: achievement.isHidden,
          criteriaJson: achievement.criteriaJson,
          rewardJson: achievement.rewardJson,
          seasonNumber: achievement.seasonNumber,
          status: userAchievement.status,
          progress: userAchievement.progress,
          progressText: userAchievement.progressText,
          currentValue: userAchievement.currentValue ?? latestProgress?.currentValue ?? null,
          targetValue: userAchievement.targetValue ?? latestProgress?.targetValue ?? null,
          unlockedAt: userAchievement.unlockedAt,
          claimedAt: userAchievement.claimedAt,
          progressData: latestProgress?.progressData ?? null,
        };
      })
      .filter((item) => item !== null);

    // Próximo cursor = id da última conquista da página atual
    const nextCursor = hasNextPage ? achievementsPage[achievementsPage.length - 1].id : null;

    return {
      achievements: result,
      nextCursor,
      hasNextPage,
      count: result.length,
    };
  }

  /**
   * Sincroniza progresso de conquistas do frontend
   * Sempre usa o maior progresso (evita regressão)
   */
  async syncAchievementProgress(
    userId: string,
    authenticatedUserId: string,
    progress: Record<string, number>,
  ): Promise<{
    success: boolean;
    message: string;
    synced_count: number;
    completed_achievements: string[];
  }> {
    // Validar que userId corresponde ao usuário autenticado
    if (userId !== authenticatedUserId) {
      throw new ForbiddenException('Você não pode sincronizar progresso de outro usuário');
    }

    // Validar estrutura
    if (!progress || typeof progress !== 'object') {
      throw new BadRequestException('progress deve ser um objeto');
    }

    const completedAchievements: string[] = [];
    let syncedCount = 0;

    // Processar cada conquista no progresso
    for (const [achievementId, progressValue] of Object.entries(progress)) {
      // Normalizar progresso (0.0 a 1.0)
      const normalizedProgress = Math.max(0.0, Math.min(1.0, parseFloat(progressValue.toString())));

      if (isNaN(normalizedProgress)) {
        this.logger.warn(`Progresso inválido para ${achievementId}: ${progressValue}`);
        continue;
      }

      // Buscar ou criar UserAchievement primeiro
      const userAchievement = await this.prisma.userAchievement.upsert({
        where: {
          userId_achievementId: {
            userId,
            achievementId,
          },
        },
        create: {
          userId,
          achievementId,
          status: AchievementStatus.IN_PROGRESS,
          progress: normalizedProgress,
        },
        update: {
          progress: normalizedProgress,
        },
      });

      // Buscar progresso atual do banco
      const existingProgress = await this.prisma.userAchievementProgress.findFirst({
        where: {
          userAchievementId: userAchievement.id,
        },
        orderBy: {
          lastUpdated: 'desc',
        },
      });

      if (existingProgress) {
        // Atualizar apenas se o novo progresso for maior (evita regressão)
        const currentProgress = existingProgress.currentValue || 0;
        if (normalizedProgress > currentProgress) {
          await this.prisma.userAchievementProgress.create({
            data: {
              userAchievementId: userAchievement.id,
              userId,
              currentValue: normalizedProgress,
              lastUpdated: new Date(),
            },
          });
          syncedCount++;
        }
      } else {
        // Inserir novo progresso
        await this.prisma.userAchievementProgress.create({
          data: {
            userAchievementId: userAchievement.id,
            userId,
            currentValue: normalizedProgress,
            lastUpdated: new Date(),
          },
        });
        syncedCount++;
      }

      // Se progresso é 100%, marcar como completa
      if (normalizedProgress >= 1.0) {
        const wasCompleted = await this.markAchievementAsCompleted(userId, achievementId);
        if (wasCompleted) {
          completedAchievements.push(achievementId);
        }
      }
    }

    return {
      success: true,
      message: 'Progresso sincronizado com sucesso',
      synced_count: syncedCount,
      completed_achievements: completedAchievements,
    };
  }

  /**
   * Busca progresso de conquistas do usuário
   */
  async getUserAchievementProgress(userId: string): Promise<{
    success: boolean;
    progress: Record<string, number>;
    completed_achievements: string[];
    last_sync: string | null;
  }> {
    // Buscar progresso do usuário através de UserAchievement
    const userAchievements = await this.prisma.userAchievement.findMany({
      where: { userId },
      include: {
        progressDetails: {
          orderBy: { lastUpdated: 'desc' },
          take: 1, // Pegar apenas o mais recente
        },
      },
    });

    // Buscar conquistas completas
    const completedRecords = await this.prisma.userAchievement.findMany({
      where: {
        userId,
        status: AchievementStatus.CLAIMED,
      },
      select: {
        achievementId: true,
        unlockedAt: true,
      },
    });

    // Montar objeto de progresso
    const progress: Record<string, number> = {};
    let lastSync: Date | null = null;

    for (const ua of userAchievements) {
      const latestProgress = ua.progressDetails[0];
      if (latestProgress) {
        progress[ua.achievementId] = (latestProgress.currentValue || 0) / 100;
        if (!lastSync || latestProgress.lastUpdated > lastSync) {
          lastSync = latestProgress.lastUpdated;
        }
      } else {
        // Se não tem progressDetails, usar o progress do UserAchievement
        progress[ua.achievementId] = ua.progress;
      }
    }

    // Adicionar conquistas completas (progresso = 1.0)
    const completedAchievements = completedRecords.map((r) => r.achievementId);
    for (const achievementId of completedAchievements) {
      progress[achievementId] = 1.0;
      if (completedRecords.find((r) => r.achievementId === achievementId)?.unlockedAt) {
        const unlockedAt = completedRecords.find((r) => r.achievementId === achievementId)!.unlockedAt;
        if (!lastSync || unlockedAt! > lastSync) {
          lastSync = unlockedAt!;
        }
      }
    }

    return {
      success: true,
      progress,
      completed_achievements: completedAchievements,
      last_sync: lastSync ? lastSync.toISOString() : null,
    };
  }

  /**
   * Marca uma conquista como completa e adiciona XP
   * Retorna true se foi marcada como completa agora, false se já estava completa
   * NOTA: XP e informações da conquista devem vir do cq.json do frontend
   */
  private async markAchievementAsCompleted(
    userId: string,
    achievementId: string,
  ): Promise<boolean> {
    // Verificar se já está completa na tabela user_achievements
    const existing = await this.prisma.userAchievement.findUnique({
      where: {
        userId_achievementId: {
          userId,
          achievementId,
        },
      },
    });

    if (existing && existing.status === AchievementStatus.CLAIMED) {
      return false; // Já estava completa
    }

    // Atualizar ou criar registro na tabela user_achievements
    await this.prisma.userAchievement.upsert({
      where: {
        userId_achievementId: {
          userId,
          achievementId,
        },
      },
      create: {
        userId,
        achievementId,
        status: AchievementStatus.CLAIMED,
        progress: 1.0,
        unlockedAt: new Date(),
        claimedAt: new Date(),
      },
      update: {
        status: AchievementStatus.CLAIMED,
        progress: 1.0,
        unlockedAt: existing?.unlockedAt || new Date(),
        claimedAt: new Date(),
      },
    });

    // Buscar recompensa da conquista e adicionar XP ao usuário
    const achievement = await this.prisma.achievement.findUnique({
      where: { id: achievementId },
      select: { rewardJson: true },
    });

    if (achievement?.rewardJson && typeof achievement.rewardJson === 'object') {
      const reward = achievement.rewardJson as any;
      const xpReward = reward.xp || 0;

      if (xpReward > 0) {
        try {
          await this.xpService.addXp(userId, xpReward);
          this.logger.debug(`✨ ${userId} ganhou ${xpReward} XP por completar ${achievementId}`);
        } catch (error: any) {
          this.logger.warn(`⚠️ Erro ao adicionar XP por conquista: ${error.message}`);
        }
      }
    }

    return true; // Foi marcada como completa agora
  }

  /**
   * Verifica e atualiza conquistas relacionadas a corridas
   * Chamado após criar uma nova corrida
   */
  async checkRunAchievements(userId: string, runData: {
    distance?: number; // em metros
    duration?: number; // em segundos
    averagePace?: number; // min/km
    startTime: Date;
    pathPoints?: Array<{ latitude: number; longitude: number; timestamp?: string }>;
  }): Promise<void> {
    try {
      // Buscar todas as conquistas ativas relacionadas a corridas
      const runAchievements = await this.prisma.achievement.findMany({
        where: {
          category: 'RUN',
          isActive: true,
        },
      });

      // Buscar estatísticas do usuário
      const userStats = await this.getUserRunStats(userId);

      for (const achievement of runAchievements) {
        if (!achievement.criteriaJson) continue;

        const criteria = achievement.criteriaJson as any;
        let progress = 0.0;
        let shouldUpdate = false;

        // Verificar cada tipo de critério
        if (criteria.runs !== undefined) {
          // Total de corridas
          const currentRuns = userStats.totalRuns;
          progress = Math.min(1.0, currentRuns / criteria.runs);
          shouldUpdate = true;
        } else if (criteria.distanceKm !== undefined) {
          // Distância total acumulada (em km)
          const totalDistanceKm = userStats.totalDistanceKm;
          progress = Math.min(1.0, totalDistanceKm / criteria.distanceKm);
          shouldUpdate = true;
        } else if (criteria.singleRunDistanceKm !== undefined && runData.distance) {
          // Corrida única de X km ou mais
          const runDistanceKm = runData.distance / 1000;
          if (runDistanceKm >= criteria.singleRunDistanceKm) {
            progress = 1.0;
            shouldUpdate = true;
          }
        } else if (criteria.consecutiveDays !== undefined) {
          // Dias consecutivos
          const consecutiveDays = userStats.consecutiveDays;
          progress = Math.min(1.0, consecutiveDays / criteria.consecutiveDays);
          shouldUpdate = true;
        } else if (criteria.paceVariationPercent !== undefined && runData.pathPoints) {
          // Variação de pace < X%
          // TODO: Calcular variação de pace da corrida atual
          // Por enquanto, pulamos esta (requer análise detalhada dos pontos)
        } else if (criteria.startHourBetween && Array.isArray(criteria.startHourBetween)) {
          // Corrida entre Xh e Yh
          const startHour = runData.startTime.getHours();
          if (startHour >= criteria.startHourBetween[0] && startHour < criteria.startHourBetween[1]) {
            progress = 1.0;
            shouldUpdate = true;
          }
        } else if (criteria.runsInWeek !== undefined) {
          // Corridas na semana atual
          const runsThisWeek = userStats.runsThisWeek;
          progress = Math.min(1.0, runsThisWeek / criteria.runsInWeek);
          shouldUpdate = true;
        } else if (criteria.lastHourOfWeek === true) {
          // Corrida na última hora da semana
          // TODO: Verificar se está na última hora do período competitivo
        }

        if (shouldUpdate) {
          await this.updateAchievementProgress(userId, achievement.id, progress, {
            currentValue: criteria.runs ? userStats.totalRuns :
              criteria.distanceKm ? userStats.totalDistanceKm :
                criteria.consecutiveDays ? userStats.consecutiveDays :
                  criteria.runsInWeek ? userStats.runsThisWeek :
                    null,
            targetValue: criteria.runs || criteria.distanceKm || criteria.consecutiveDays || criteria.runsInWeek || null,
          });
        }
      }
    } catch (error: any) {
      this.logger.error('❌ Erro ao verificar conquistas de corrida', error?.stack || error);
      // Não lançar erro para não quebrar o fluxo principal
    }
  }

  /**
   * Verifica e atualiza conquistas relacionadas a territórios
   * Chamado após conquistar um novo território
   */
  async checkTerritoryAchievements(
    userId: string,
    territoryData: {
      area?: number; // em m²
      stolen?: boolean; // se roubou de outro jogador
    }
  ): Promise<void> {
    try {
      const territoryAchievements = await this.prisma.achievement.findMany({
        where: {
          category: 'TERRITORY',
          isActive: true,
        },
      });

      const userStats = await this.getUserTerritoryStats(userId);

      for (const achievement of territoryAchievements) {
        if (!achievement.criteriaJson) continue;

        const criteria = achievement.criteriaJson as any;
        let progress = 0.0;
        let shouldUpdate = false;

        if (criteria.territories !== undefined) {
          const currentTerritories = userStats.totalTerritories;
          progress = Math.min(1.0, currentTerritories / criteria.territories);
          shouldUpdate = true;
        } else if (criteria.totalAreaM2 !== undefined) {
          const totalAreaM2 = userStats.totalAreaM2;
          progress = Math.min(1.0, totalAreaM2 / criteria.totalAreaM2);
          shouldUpdate = true;
        } else if (criteria.territorySteal !== undefined && territoryData.stolen) {
          progress = 1.0;
          shouldUpdate = true;
        }
        // TODO: uniqueCities, adjacentTerritories (requer análise geográfica)

        if (shouldUpdate) {
          await this.updateAchievementProgress(userId, achievement.id, progress, {
            currentValue: criteria.territories ? userStats.totalTerritories :
              criteria.totalAreaM2 ? userStats.totalAreaM2 :
                null,
            targetValue: criteria.territories || criteria.totalAreaM2 || null,
          });
        }
      }
    } catch (error: any) {
      this.logger.error('❌ Erro ao verificar conquistas de território', error?.stack || error);
    }
  }

  /**
   * Verifica e atualiza conquistas relacionadas a batalhas
   * Chamado após vencer ou perder uma batalha
   */
  async checkBattleAchievements(
    userId: string,
    battleData: {
      won: boolean;
      winStreak?: number;
      opponentId?: string;
    }
  ): Promise<void> {
    try {
      const battleAchievements = await this.prisma.achievement.findMany({
        where: {
          category: 'SOCIAL',
          isActive: true,
        },
      });

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          battleWins: true,
          battleLosses: true,
          winStreak: true,
        },
      });

      if (!user) return;

      for (const achievement of battleAchievements) {
        if (!achievement.criteriaJson) continue;

        const criteria = achievement.criteriaJson as any;
        let progress = 0.0;
        let shouldUpdate = false;

        if (criteria.battles !== undefined) {
          const totalBattles = user.battleWins + user.battleLosses;
          progress = Math.min(1.0, totalBattles / criteria.battles);
          shouldUpdate = true;
        } else if (criteria.battleWins !== undefined) {
          progress = Math.min(1.0, user.battleWins / criteria.battleWins);
          shouldUpdate = true;
        } else if (criteria.winStreak !== undefined) {
          progress = Math.min(1.0, user.winStreak / criteria.winStreak);
          shouldUpdate = true;
        }
        // TODO: winsAgainstSameUser, comebackWin, friendAfterBattle

        if (shouldUpdate) {
          await this.updateAchievementProgress(userId, achievement.id, progress, {
            currentValue: criteria.battles ? (user.battleWins + user.battleLosses) :
              criteria.battleWins ? user.battleWins :
                criteria.winStreak ? user.winStreak :
                  null,
            targetValue: criteria.battles || criteria.battleWins || criteria.winStreak || null,
          });
        }
      }
    } catch (error: any) {
      this.logger.error('❌ Erro ao verificar conquistas de batalha', error?.stack || error);
    }
  }

  /**
   * Verifica e atualiza conquistas de marcos (nível, troféus)
   */
  async checkMilestoneAchievements(userId: string): Promise<void> {
    try {
      const milestoneAchievements = await this.prisma.achievement.findMany({
        where: {
          category: 'MILESTONE',
          isActive: true,
        },
      });

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          level: true,
          trophies: true,
        },
      });

      if (!user) return;

      for (const achievement of milestoneAchievements) {
        if (!achievement.criteriaJson) continue;

        const criteria = achievement.criteriaJson as any;
        let progress = 0.0;
        let shouldUpdate = false;

        if (criteria.level !== undefined) {
          progress = Math.min(1.0, user.level / criteria.level);
          shouldUpdate = true;
        } else if (criteria.trophies !== undefined) {
          progress = Math.min(1.0, user.trophies / criteria.trophies);
          shouldUpdate = true;
        }

        if (shouldUpdate) {
          await this.updateAchievementProgress(userId, achievement.id, progress, {
            currentValue: criteria.level ? user.level : criteria.trophies ? user.trophies : null,
            targetValue: criteria.level || criteria.trophies || null,
          });
        }
      }
    } catch (error: any) {
      this.logger.error('❌ Erro ao verificar conquistas de marco', error?.stack || error);
    }
  }

  /**
   * Atualiza o progresso de uma conquista
   */
  private async updateAchievementProgress(
    userId: string,
    achievementId: string,
    progress: number,
    values?: { currentValue: number | null; targetValue: number | null }
  ): Promise<void> {
    // Buscar ou criar UserAchievement
    const userAchievement = await this.prisma.userAchievement.upsert({
      where: {
        userId_achievementId: { userId, achievementId },
      },
      create: {
        userId,
        achievementId,
        status: progress >= 1.0 ? AchievementStatus.UNLOCKED : AchievementStatus.IN_PROGRESS,
        progress,
        progressText: values?.targetValue
          ? `${Math.round(values.currentValue || 0)}/${values.targetValue}`
          : `${Math.round(progress * 100)}%`,
        currentValue: values?.currentValue ?? null,
        targetValue: values?.targetValue ?? null,
      },
      update: {
        progress: Math.max(progress, 0), // Não permitir regressão
        status: progress >= 1.0
          ? AchievementStatus.UNLOCKED
          : AchievementStatus.IN_PROGRESS,
        progressText: values?.targetValue
          ? `${Math.round(values.currentValue || 0)}/${values.targetValue}`
          : `${Math.round(progress * 100)}%`,
        currentValue: values?.currentValue ?? undefined,
        targetValue: values?.targetValue ?? undefined,
      },
    });

    // Se completou, marcar como CLAIMED
    if (progress >= 1.0 && userAchievement.status !== AchievementStatus.CLAIMED) {
      await this.markAchievementAsCompleted(userId, achievementId);
    }

    // Registrar progresso detalhado
    await this.prisma.userAchievementProgress.create({
      data: {
        userAchievementId: userAchievement.id,
        userId,
        currentValue: values?.currentValue ?? progress,
        targetValue: values?.targetValue ?? 1.0,
        lastUpdated: new Date(),
      },
    });
  }

  /**
   * Busca estatísticas de corridas do usuário
   */
  private async getUserRunStats(userId: string) {
    const runs = await this.prisma.run.findMany({
      where: { userId },
      select: {
        distance: true,
        startTime: true,
      },
      orderBy: { startTime: 'asc' },
    });

    const totalRuns = runs.length;
    const totalDistanceKm = runs.reduce((sum, r) => sum + (r.distance || 0), 0) / 1000;

    // Calcular dias consecutivos
    let consecutiveDays = 0;
    if (runs.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let checkDate = new Date(today);

      for (let i = runs.length - 1; i >= 0; i--) {
        const runDate = new Date(runs[i].startTime);
        runDate.setHours(0, 0, 0, 0);

        if (runDate.getTime() === checkDate.getTime()) {
          consecutiveDays++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else if (runDate.getTime() < checkDate.getTime()) {
          break;
        }
      }
    }

    // Corridas nesta semana
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const runsThisWeek = runs.filter(r => r.startTime >= weekStart).length;

    return {
      totalRuns,
      totalDistanceKm,
      consecutiveDays,
      runsThisWeek,
    };
  }

  /**
   * Busca estatísticas de territórios do usuário
   */
  private async getUserTerritoryStats(userId: string) {
    const territories = await this.prisma.territory.findMany({
      where: { userId },
      select: {
        area: true,
      },
    });

    return {
      totalTerritories: territories.length,
      totalAreaM2: territories.reduce((sum, t) => sum + (t.area || 0), 0),
    };
  }
}
