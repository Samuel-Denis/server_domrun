import { Injectable } from '@nestjs/common';
import { LeagueService } from './league.service';

/**
 * Serviço para gerenciar troféus e sistema ELO
 * 
 * Ganho de Troféus:
 * - Vitória: + (25 ± diferença de rank)
 * - Derrota: - (15 ± diferença de rank)
 */
@Injectable()
export class TrophyService {
  private readonly BASE_WIN_TROPHIES = 25;
  private readonly BASE_LOSS_TROPHIES = 15;
  private readonly TROPHY_DIFF_FACTOR = 0.1; // 10% da diferença de troféus

  constructor(private readonly leagueService: LeagueService) {}

  /**
   * Calcula a mudança de troféus para ambos os jogadores
   * @param winnerTrophies Troféus do vencedor antes da batalha
   * @param loserTrophies Troféus do perdedor antes da batalha
   * @returns Objeto com mudanças de troféus para ambos
   */
  calculateTrophyChange(winnerTrophies: number, loserTrophies: number): {
    winnerChange: number;
    loserChange: number;
  } {
    const trophyDiff = Math.abs(winnerTrophies - loserTrophies);
    
    // Se o vencedor tinha mais troféus, ganha menos (oponente mais fraco)
    // Se o vencedor tinha menos troféus, ganha mais (oponente mais forte)
    const adjustment = trophyDiff * this.TROPHY_DIFF_FACTOR;
    
    let winnerChange: number;
    let loserChange: number;

    if (winnerTrophies >= loserTrophies) {
      // Vencedor tinha mais ou igual → ganha menos, perdedor perde menos
      winnerChange = this.BASE_WIN_TROPHIES - adjustment;
      loserChange = -(this.BASE_LOSS_TROPHIES - adjustment);
    } else {
      // Vencedor tinha menos → ganha mais, perdedor perde mais
      winnerChange = this.BASE_WIN_TROPHIES + adjustment;
      loserChange = -(this.BASE_LOSS_TROPHIES + adjustment);
    }

    // Garantir que não fica negativo para o perdedor
    if (Math.abs(loserChange) > loserTrophies) {
      loserChange = -loserTrophies; // Não pode ficar negativo
    }

    // Arredondar para inteiro
    return {
      winnerChange: Math.round(winnerChange),
      loserChange: Math.round(loserChange),
    };
  }

  /**
   * Atualiza os troféus dos jogadores e retorna as novas ligas
   * @param winnerId ID do vencedor
   * @param loserId ID do perdedor
   * @param winnerTrophies Troféus atuais do vencedor
   * @param loserTrophies Troféus atuais do perdedor
   * @returns Novos valores de troféus e ligas
   */
  updateTrophies(
    winnerId: string,
    loserId: string,
    winnerTrophies: number,
    loserTrophies: number,
  ): {
    winnerNewTrophies: number;
    loserNewTrophies: number;
    winnerNewLeague: string;
    loserNewLeague: string;
    winnerChange: number;
    loserChange: number;
  } {
    const { winnerChange, loserChange } = this.calculateTrophyChange(
      winnerTrophies,
      loserTrophies,
    );

    const winnerNewTrophies = Math.max(0, winnerTrophies + winnerChange);
    const loserNewTrophies = Math.max(0, loserTrophies + loserChange);

    const winnerNewLeague = this.leagueService.getLeagueFromTrophies(winnerNewTrophies);
    const loserNewLeague = this.leagueService.getLeagueFromTrophies(loserNewTrophies);

    return {
      winnerNewTrophies,
      loserNewTrophies,
      winnerNewLeague,
      loserNewLeague,
      winnerChange,
      loserChange,
    };
  }
}
