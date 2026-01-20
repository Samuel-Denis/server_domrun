import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BattleScoreService } from './battle-score.service';
import { TrophyService } from './trophy.service';
import { AntiCheatService, AntiCheatResult } from './anti-cheat.service';
import { LeagueService } from './league.service';
import { SubmitBattleResultDto } from '../dto/submit-battle-result.dto';
import { BattleResponseDto } from '../dto/battle-response.dto';
import { BattleResultDto } from '../dto/battle-result.dto';
import { randomUUID } from 'crypto';
import { AchievementsService } from '../../users/achievements.service';

@Injectable()
export class BattleService {
  private readonly MATCHMAKING_TROPHY_RANGE = 200; // ±200 troféus para matchmaking

  constructor(
    private readonly prisma: PrismaService,
    private readonly battleScoreService: BattleScoreService,
    private readonly trophyService: TrophyService,
    private readonly antiCheatService: AntiCheatService,
    private readonly leagueService: LeagueService,
    @Inject(forwardRef(() => AchievementsService))
    private readonly achievementsService: AchievementsService,
  ) {}

  /**
   * Busca um oponente para matchmaking
   * Filtro: diferença máxima de ±200 troféus
   */
  async findOpponent(userId: string, mode: string): Promise<string | null> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { trophies: true },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    // Busca jogadores na fila com diferença máxima de ±200 troféus
    const minTrophies = Math.max(0, user.trophies - this.MATCHMAKING_TROPHY_RANGE);
    const maxTrophies = user.trophies + this.MATCHMAKING_TROPHY_RANGE;

    // Procura jogadores buscando match no mesmo modo usando SQL direto
    const waitingBattles = await this.prisma.client.$queryRawUnsafe<any[]>(
      `SELECT b.* FROM battles b
       INNER JOIN users u ON b."player1Id" = u.id
       WHERE b.status = 'SEARCHING' 
         AND b.mode = $1 
         AND b."player1Id" != $2
         AND u.trophies >= $3
         AND u.trophies <= $4
       ORDER BY b."createdAt" ASC
       LIMIT 1`,
      mode,
      userId,
      minTrophies,
      maxTrophies
    );
    
    if (waitingBattles.length === 0) {
      return null; // Nenhum oponente encontrado
    }

    return waitingBattles[0].player1Id;
  }

  /**
   * Cria uma nova batalha ou faz match com uma existente
   */
  async joinQueue(userId: string, mode: string): Promise<BattleResponseDto> {
    // Verifica se o usuário já está em uma batalha ativa usando SQL raw
    const activeBattles = await this.prisma.client.$queryRawUnsafe<any[]>(
      `SELECT * FROM battles WHERE ("player1Id" = $1 OR "player2Id" = $1) AND status IN ('SEARCHING', 'IN_PROGRESS') LIMIT 1`,
      userId
    );
    
    if (activeBattles.length > 0) {
      const activeBattle = activeBattles[0];
      // Busca dados completos da batalha
      return await this.getBattleResponse(activeBattle.id);
    }

    // Tenta encontrar um oponente
    const opponentId = await this.findOpponent(userId, mode);

    if (opponentId) {
      // Encontrou oponente - busca a batalha dele e atualiza
      const opponentBattles = await this.prisma.client.$queryRawUnsafe<any[]>(
        `SELECT * FROM battles WHERE status = 'SEARCHING' AND mode = $1 AND "player1Id" = $2 LIMIT 1`,
        mode,
        opponentId
      );
      
      if (opponentBattles.length > 0) {
        const opponentBattle = opponentBattles[0];
        
        // Atualiza a batalha existente
        await this.prisma.client.$executeRawUnsafe(
          `UPDATE battles SET "player2Id" = $1, status = 'IN_PROGRESS', "updatedAt" = NOW() WHERE id = $2`,
          userId,
          opponentBattle.id
        );
        
        return await this.getBattleResponse(opponentBattle.id);
      }
    }
    
    // Não encontrou oponente - cria nova batalha em busca
    const battleId = randomUUID();
    await this.prisma.client.$executeRawUnsafe(
      `INSERT INTO battles (id, "player1Id", mode, status, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'SEARCHING', NOW(), NOW())`,
      battleId,
      userId,
      mode
    );
    
    return await this.getBattleResponse(battleId);
  }

  /**
   * Busca dados completos de uma batalha formatados
   */
  private async getBattleResponse(battleId: string): Promise<BattleResponseDto> {
    const battles = await this.prisma.client.$queryRawUnsafe<any[]>(
      `SELECT 
        b.*,
        json_build_object(
          'id', p1.id, 'username', p1.username, 'name', p1.name, 
          'color', p1.color, 'photoUrl', p1."photoUrl", 
          'trophies', p1.trophies, 'league', p1.league
        ) as player1_data,
        CASE 
          WHEN p2.id IS NOT NULL THEN json_build_object(
            'id', p2.id, 'username', p2.username, 'name', p2.name,
            'color', p2.color, 'photoUrl', p2."photoUrl",
            'trophies', p2.trophies, 'league', p2.league
          )
          ELSE NULL
        END as player2_data
       FROM battles b
       INNER JOIN users p1 ON b."player1Id" = p1.id
       LEFT JOIN users p2 ON b."player2Id" = p2.id
       WHERE b.id = $1`,
      battleId
    );

    if (battles.length === 0) {
      throw new NotFoundException('Batalha não encontrada');
    }

    const battle = battles[0];
    return this.formatBattleResponse(battle);
  }

  /**
   * Armazena resultados anti-cheat temporariamente para ambos os jogadores
   */
  private playerAntiCheatResults = new Map<string, AntiCheatResult>(); // battleId_userId -> AntiCheatResult

  /**
   * Submete o resultado de uma batalha
   */
  async submitBattleResult(
    userId: string,
    dto: SubmitBattleResultDto,
  ): Promise<BattleResultDto> {
    // Busca a batalha
    const battles = await this.prisma.client.$queryRawUnsafe<any[]>(
      `SELECT b.*, 
        json_build_object('id', p1.id, 'trophies', p1.trophies) as player1_data,
        json_build_object('id', p2.id, 'trophies', p2.trophies) as player2_data
       FROM battles b
       INNER JOIN users p1 ON b."player1Id" = p1.id
       INNER JOIN users p2 ON b."player2Id" = p2.id
       WHERE b.id = $1`,
      dto.battleId
    );

    if (battles.length === 0) {
      throw new NotFoundException('Batalha não encontrada');
    }

    const battle = battles[0];

    // Verifica se o usuário faz parte da batalha
    if (battle.player1Id !== userId && battle.player2Id !== userId) {
      throw new ForbiddenException('Você não faz parte desta batalha');
    }

    // Verifica se a batalha está em progresso
    if (battle.status !== 'IN_PROGRESS') {
      throw new BadRequestException('Batalha não está em progresso');
    }

    // Validação anti-cheat
    const antiCheatResult = this.antiCheatService.validateRun(
      dto.distance,
      dto.duration,
      dto.averagePace,
      dto.path,
    );

    // Armazena resultado anti-cheat temporariamente
    const antiCheatKey = `${dto.battleId}_${userId}`;
    this.playerAntiCheatResults.set(antiCheatKey, antiCheatResult);

    // Calcula o Battle Score
    const battleScore = this.battleScoreService.calculateBattleScore(
      dto.distance,
      dto.averagePace,
    );

    // Atualiza o score do jogador na batalha
    const isPlayer1 = battle.player1Id === userId;
    const p1Score = isPlayer1 ? battleScore : (battle.p1Score || null);
    const p2Score = !isPlayer1 ? battleScore : (battle.p2Score || null);

    await this.prisma.client.$executeRawUnsafe(
      `UPDATE battles SET "p1Score" = $1, "p2Score" = $2, "updatedAt" = NOW() WHERE id = $3`,
      p1Score,
      p2Score,
      dto.battleId
    );

    // Verifica se ambos os jogadores já submeteram
    const updatedBattles = await this.prisma.client.$queryRawUnsafe<any[]>(
      `SELECT b.*, 
        json_build_object('id', p1.id, 'trophies', p1.trophies) as player1_data,
        json_build_object('id', p2.id, 'trophies', p2.trophies) as player2_data
       FROM battles b
       INNER JOIN users p1 ON b."player1Id" = p1.id
       INNER JOIN users p2 ON b."player2Id" = p2.id
       WHERE b.id = $1`,
      dto.battleId
    );

    const updatedBattle = updatedBattles[0];

    if (updatedBattle && updatedBattle.p1Score !== null && updatedBattle.p2Score !== null) {
      // Ambos submeteram - busca resultado anti-cheat do outro jogador
      const otherPlayerId = battle.player1Id === userId ? battle.player2Id : battle.player1Id;
      const otherPlayerAntiCheatKey = `${dto.battleId}_${otherPlayerId}`;
      const otherPlayerAntiCheat = this.playerAntiCheatResults.get(otherPlayerAntiCheatKey) || 
        { isValid: true, isSuspicious: false, warnings: [] }; // Fallback se não encontrado
      
      // Limpa resultados temporários
      this.playerAntiCheatResults.delete(antiCheatKey);
      this.playerAntiCheatResults.delete(otherPlayerAntiCheatKey);
      
      return this.finishBattle(dto.battleId, antiCheatResult, otherPlayerAntiCheat);
    }

    // Ainda esperando o outro jogador
    return {
      battleId: battle.id,
      winnerId: '',
      loserId: '',
      p1Score: p1Score || 0,
      p2Score: p2Score || 0,
      p1TrophyChange: 0,
      p2TrophyChange: 0,
      p1NewTrophies: battle.player1_data.trophies,
      p2NewTrophies: battle.player2_data.trophies,
      invalidated: !antiCheatResult.isValid,
      reason: antiCheatResult.reason,
    };
  }

  /**
   * Finaliza uma batalha e atualiza troféus
   */
  private async finishBattle(
    battleId: string,
    player1AntiCheat: AntiCheatResult,
    player2AntiCheat: AntiCheatResult,
  ): Promise<BattleResultDto> {
    const battles = await this.prisma.client.$queryRawUnsafe<any[]>(
      `SELECT b.*,
        json_build_object('id', p1.id, 'trophies', p1.trophies) as player1_data,
        json_build_object('id', p2.id, 'trophies', p2.trophies) as player2_data
       FROM battles b
       INNER JOIN users p1 ON b."player1Id" = p1.id
       INNER JOIN users p2 ON b."player2Id" = p2.id
       WHERE b.id = $1`,
      battleId
    );

    if (battles.length === 0 || battles[0].p1Score === null || battles[0].p2Score === null) {
      throw new BadRequestException('Batalha não pode ser finalizada');
    }

    const battle = battles[0];

    // Verifica se algum jogador teve resultado invalidado
    const isPlayer1Invalidated = !player1AntiCheat.isValid;
    const isPlayer2Invalidated = !player2AntiCheat.isValid;

    let winnerId: string;
    let loserId: string;
    let invalidated = false;
    let reason: string | undefined;

    // Lógica de determinação do vencedor
    if (isPlayer1Invalidated && isPlayer2Invalidated) {
      invalidated = true;
      reason = 'Ambos os jogadores tiveram resultados invalidados';
      winnerId = battle.p1Score >= battle.p2Score ? battle.player1Id : battle.player2Id;
      loserId = winnerId === battle.player1Id ? battle.player2Id : battle.player1Id;
    } else if (isPlayer1Invalidated) {
      winnerId = battle.player2Id;
      loserId = battle.player1Id;
      invalidated = true;
      reason = `Jogador 1: ${player1AntiCheat.reason}`;
    } else if (isPlayer2Invalidated) {
      winnerId = battle.player1Id;
      loserId = battle.player2Id;
      invalidated = true;
      reason = `Jogador 2: ${player2AntiCheat.reason}`;
    } else {
      winnerId = battle.p1Score >= battle.p2Score ? battle.player1Id : battle.player2Id;
      loserId = winnerId === battle.player1Id ? battle.player2Id : battle.player1Id;
    }

    // Calcula mudanças de troféus
    let winnerChange = 0;
    let loserChange = 0;
    let winnerNewTrophies = winnerId === battle.player1Id ? battle.player1_data.trophies : battle.player2_data.trophies;
    let loserNewTrophies = loserId === battle.player1Id ? battle.player1_data.trophies : battle.player2_data.trophies;

    if (!invalidated) {
      const trophyUpdate = this.trophyService.updateTrophies(
        winnerId,
        loserId,
        winnerNewTrophies,
        loserNewTrophies,
      );
      winnerChange = trophyUpdate.winnerChange;
      loserChange = trophyUpdate.loserChange;
      winnerNewTrophies = trophyUpdate.winnerNewTrophies;
      loserNewTrophies = trophyUpdate.loserNewTrophies;
    }

    // Atualiza os jogadores e a batalha em uma transaction
    await Promise.all([
      // Atualiza vencedor
      this.prisma.client.$executeRawUnsafe(
        `UPDATE users SET 
          trophies = $1, 
          league = $2, 
          "winStreak" = "winStreak" + 1,
          "battleWins" = "battleWins" + 1,
          "updatedAt" = NOW()
        WHERE id = $3`,
        winnerNewTrophies,
        this.leagueService.getLeagueFromTrophies(winnerNewTrophies),
        winnerId
      ),
      // Atualiza perdedor
      this.prisma.client.$executeRawUnsafe(
        `UPDATE users SET 
          trophies = $1, 
          league = $2, 
          "winStreak" = 0,
          "battleLosses" = "battleLosses" + 1,
          "updatedAt" = NOW()
        WHERE id = $3`,
        loserNewTrophies,
        this.leagueService.getLeagueFromTrophies(loserNewTrophies),
        loserId
      ),
    ]);

    // Atualiza batalha
    await this.prisma.client.$executeRawUnsafe(
      `UPDATE battles SET status = 'FINISHED', "winnerId" = $1, "finishedAt" = NOW(), "updatedAt" = NOW() WHERE id = $2`,
      winnerId,
      battleId
    );

    const winnerLeague = this.leagueService.getLeagueFromTrophies(winnerNewTrophies);
    const loserLeague = this.leagueService.getLeagueFromTrophies(loserNewTrophies);

    // Buscar winStreak atualizado do vencedor
    const winnerUser = await this.prisma.client.user.findUnique({
      where: { id: winnerId },
      select: { winStreak: true },
    });

    // Verificar conquistas de batalha (assíncrono, não bloqueia)
    this.achievementsService.checkBattleAchievements(winnerId, {
      won: true,
      winStreak: winnerUser?.winStreak || 0,
      opponentId: loserId,
    }).catch(err => console.error('Erro ao verificar conquistas do vencedor:', err));

    this.achievementsService.checkBattleAchievements(loserId, {
      won: false,
      opponentId: winnerId,
    }).catch(err => console.error('Erro ao verificar conquistas do perdedor:', err));

    // Verificar conquistas de marcos (troféus podem ter mudado)
    this.achievementsService.checkMilestoneAchievements(winnerId).catch(err => console.error('Erro ao verificar conquistas:', err));
    this.achievementsService.checkMilestoneAchievements(loserId).catch(err => console.error('Erro ao verificar conquistas:', err));

    return {
      battleId: battle.id,
      winnerId,
      loserId,
      p1Score: battle.p1Score,
      p2Score: battle.p2Score,
      p1TrophyChange: battle.player1Id === winnerId ? winnerChange : loserChange,
      p2TrophyChange: battle.player2Id === winnerId ? winnerChange : loserChange,
      p1NewTrophies: battle.player1Id === winnerId ? winnerNewTrophies : loserNewTrophies,
      p2NewTrophies: battle.player2Id === winnerId ? winnerNewTrophies : loserNewTrophies,
      p1NewLeague: battle.player1Id === winnerId ? winnerLeague : loserLeague,
      p2NewLeague: battle.player2Id === winnerId ? winnerLeague : loserLeague,
      invalidated,
      reason,
    };
  }

  /**
   * Formata a resposta da batalha
   */
  private formatBattleResponse(battle: any): BattleResponseDto {
    return {
      id: battle.id,
      player1Id: battle.player1Id,
      player2Id: battle.player2Id || '',
      status: battle.status,
      mode: battle.mode,
      player1: battle.player1_data ? {
        id: battle.player1_data.id,
        username: battle.player1_data.username,
        name: battle.player1_data.name,
        color: battle.player1_data.color,
        photoUrl: battle.player1_data.photoUrl,
        trophies: battle.player1_data.trophies,
        league: battle.player1_data.league,
      } : undefined,
      player2: battle.player2_data ? {
        id: battle.player2_data.id,
        username: battle.player2_data.username,
        name: battle.player2_data.name,
        color: battle.player2_data.color,
        photoUrl: battle.player2_data.photoUrl,
        trophies: battle.player2_data.trophies,
        league: battle.player2_data.league,
      } : undefined,
      p1Score: battle.p1Score,
      p2Score: battle.p2Score,
      winnerId: battle.winnerId,
      createdAt: battle.createdAt,
      finishedAt: battle.finishedAt,
    };
  }

  /**
   * Cancela uma batalha (sair da fila)
   */
  async cancelBattle(userId: string, battleId: string): Promise<void> {
    const battles = await this.prisma.client.$queryRawUnsafe<any[]>(
      `SELECT * FROM battles WHERE id = $1`,
      battleId
    );

    if (battles.length === 0) {
      throw new NotFoundException('Batalha não encontrada');
    }

    const battle = battles[0];

    if (battle.player1Id !== userId && battle.player2Id !== userId) {
      throw new ForbiddenException('Você não faz parte desta batalha');
    }

    if (battle.status === 'FINISHED') {
      throw new BadRequestException('Batalha já finalizada');
    }

    await this.prisma.client.$executeRawUnsafe(
      `UPDATE battles SET status = 'CANCELLED', "updatedAt" = NOW() WHERE id = $1`,
      battleId
    );
  }

  /**
   * Busca batalhas do usuário
   */
  async getUserBattles(userId: string, limit: number = 20, offset: number = 0) {
    const battles = await this.prisma.client.$queryRawUnsafe<any[]>(
      `SELECT 
        b.*,
        json_build_object(
          'id', p1.id, 'username', p1.username, 'name', p1.name,
          'color', p1.color, 'photoUrl', p1."photoUrl"
        ) as player1_data,
        json_build_object(
          'id', p2.id, 'username', p2.username, 'name', p2.name,
          'color', p2.color, 'photoUrl', p2."photoUrl"
        ) as player2_data
       FROM battles b
       INNER JOIN users p1 ON b."player1Id" = p1.id
       INNER JOIN users p2 ON b."player2Id" = p2.id
       WHERE (b."player1Id" = $1 OR b."player2Id" = $1)
         AND b.status = 'FINISHED'
       ORDER BY b."finishedAt" DESC
       LIMIT $2 OFFSET $3`,
      userId,
      limit,
      offset
    );

    return battles.map(battle => this.formatBattleResponse(battle));
  }
}
