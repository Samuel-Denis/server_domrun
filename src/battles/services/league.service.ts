import { Injectable } from '@nestjs/common';

export interface LeagueInfo {
  name: string;
  minTrophies: number;
  maxTrophies: number;
  xpMultiplier: number;
}

/**
 * Serviço para gerenciar ligas
 * 
 * Ligas:
 * - Bronze (I, II, III): 0 - 499 troféus (1.0x XP)
 * - Prata (I, II, III): 500 - 999 troféus (1.2x XP)
 * - Ouro (I, II, III): 1.000 - 1.999 troféus (1.5x XP)
 * - Cristal (I, II, III): 2.000 - 2.999 troféus (1.8x XP)
 * - Mestre: 3.000+ troféus (2.2x XP)
 */
@Injectable()
export class LeagueService {
  private readonly LEAGUES: LeagueInfo[] = [
    // Bronze
    { name: 'Bronze III', minTrophies: 0, maxTrophies: 166, xpMultiplier: 1.0 },
    { name: 'Bronze II', minTrophies: 167, maxTrophies: 333, xpMultiplier: 1.0 },
    { name: 'Bronze I', minTrophies: 334, maxTrophies: 499, xpMultiplier: 1.0 },
    // Prata
    { name: 'Prata III', minTrophies: 500, maxTrophies: 666, xpMultiplier: 1.2 },
    { name: 'Prata II', minTrophies: 667, maxTrophies: 833, xpMultiplier: 1.2 },
    { name: 'Prata I', minTrophies: 834, maxTrophies: 999, xpMultiplier: 1.2 },
    // Ouro
    { name: 'Ouro III', minTrophies: 1000, maxTrophies: 1333, xpMultiplier: 1.5 },
    { name: 'Ouro II', minTrophies: 1334, maxTrophies: 1666, xpMultiplier: 1.5 },
    { name: 'Ouro I', minTrophies: 1667, maxTrophies: 1999, xpMultiplier: 1.5 },
    // Cristal
    { name: 'Cristal III', minTrophies: 2000, maxTrophies: 2333, xpMultiplier: 1.8 },
    { name: 'Cristal II', minTrophies: 2334, maxTrophies: 2666, xpMultiplier: 1.8 },
    { name: 'Cristal I', minTrophies: 2667, maxTrophies: 2999, xpMultiplier: 1.8 },
    // Mestre
    { name: 'Mestre', minTrophies: 3000, maxTrophies: Infinity, xpMultiplier: 2.2 },
  ];

  /**
   * Retorna a liga baseada no número de troféus
   */
  getLeagueFromTrophies(trophies: number): string {
    const league = this.LEAGUES.find(
      (l) => trophies >= l.minTrophies && trophies <= l.maxTrophies,
    );

    return league ? league.name : 'Bronze III';
  }

  /**
   * Retorna informações completas da liga
   */
  getLeagueInfo(trophies: number): LeagueInfo {
    const league = this.LEAGUES.find(
      (l) => trophies >= l.minTrophies && trophies <= l.maxTrophies,
    );

    return league || this.LEAGUES[0]; // Bronze III como padrão
  }

  /**
   * Retorna o multiplicador de XP para uma quantidade de troféus
   */
  getXpMultiplier(trophies: number): number {
    const league = this.getLeagueInfo(trophies);
    return league.xpMultiplier;
  }

  /**
   * Retorna todas as ligas (útil para frontend)
   */
  getAllLeagues(): LeagueInfo[] {
    return this.LEAGUES;
  }
}
