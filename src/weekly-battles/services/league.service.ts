import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Serviço para gerenciar ligas
 */
@Injectable()
export class LeagueService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Busca todas as ligas ordenadas
   */
  async findAll(): Promise<any[]> {
    return this.prisma.client.league.findMany({
      orderBy: { order: 'asc' },
    });
  }

  /**
   * Busca liga por código
   */
  async findByCode(code: string): Promise<any | null> {
    return this.prisma.client.league.findUnique({
      where: { code },
    });
  }

  /**
   * Busca liga por ID
   */
  async findById(id: string): Promise<any | null> {
    return this.prisma.client.league.findUnique({
      where: { id },
    });
  }

  /**
   * Busca liga do usuário baseado em troféus
   * Usado para determinar liga inicial ou após mudanças
   */
  async getLeagueByTrophies(trophies: number): Promise<any | null> {
    // Liga Imortal requer 3000+ troféus
    if (trophies >= 3000) {
      return this.findByCode('IMMORTAL');
    }

    // Buscar ligas em ordem decrescente (do mais alto para o mais baixo)
    const leagues = await this.prisma.client.league.findMany({
      where: { isChampion: false },
      orderBy: { order: 'desc' },
    });

    // Retornar a primeira liga encontrada (sempre há Starter como fallback)
    return leagues[0] || this.findByCode('STARTER');
  }

  /**
   * Retorna a liga anterior (para rebaixamento)
   */
  async getPreviousLeague(leagueId: string): Promise<any | null> {
    const currentLeague = await this.findById(leagueId);
    if (!currentLeague) {
      return null;
    }

    // Se já está na liga mais baixa (Starter), retorna ela mesma
    if (currentLeague.order === 1) {
      return currentLeague;
    }

    return this.prisma.client.league.findFirst({
      where: { order: currentLeague.order - 1, isChampion: false },
    });
  }

  /**
   * Retorna a próxima liga (para promoção)
   */
  async getNextLeague(leagueId: string): Promise<any | null> {
    const currentLeague = await this.findById(leagueId);
    if (!currentLeague || currentLeague.isChampion) {
      return null; // Imortal não tem próxima liga
    }

    return this.prisma.client.league.findFirst({
      where: { order: currentLeague.order + 1, isChampion: false },
    });
  }
}
