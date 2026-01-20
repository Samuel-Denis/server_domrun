import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class XpService {
  constructor(private prisma: PrismaService) {}

  /**
   * Calcula o XP necessário para subir do nível atual para o próximo nível
   * Fórmula: nível_atual * 100
   * Exemplo: Level 1 → 2: 100 XP, Level 2 → 3: 200 XP, Level 3 → 4: 300 XP
   */
  calculateXpForNextLevel(currentLevel: number): number {
    if (currentLevel >= 99) {
      return 0; // Nível máximo atingido
    }
    return currentLevel * 100;
  }

  /**
   * Calcula o XP total necessário para alcançar um determinado nível
   * Fórmula: 100 * (1 + 2 + ... + (level - 1)) = 100 * (level - 1) * level / 2
   */
  calculateTotalXpForLevel(targetLevel: number): number {
    if (targetLevel <= 1) {
      return 0;
    }
    return (100 * (targetLevel - 1) * targetLevel) / 2;
  }

  /**
   * Adiciona XP ao usuário e atualiza o nível se necessário
   * Retorna informações sobre level up se ocorrer
   */
  async addXp(userId: string, xpGained: number): Promise<{
    newLevel: number;
    newXp: number;
    xpForNextLevel: number;
    leveledUp: boolean;
    previousLevel: number;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { level: true, xp: true },
    });

    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    const previousLevel = user.level;
    let newXp = user.xp + xpGained;
    let newLevel = user.level;
    let leveledUp = false;

    // Verificar se o usuário subiu de nível
    // Nível máximo é 99
    while (newLevel < 99) {
      const xpNeededForNextLevel = this.calculateXpForNextLevel(newLevel);
      
      if (xpNeededForNextLevel === 0) {
        break; // Já está no nível máximo
      }

      if (newXp >= xpNeededForNextLevel) {
        newXp -= xpNeededForNextLevel;
        newLevel++;
        leveledUp = true;
      } else {
        break;
      }
    }

    // Se atingir o nível máximo, zerar o XP excedente
    if (newLevel >= 99) {
      newLevel = 99;
      newXp = Math.min(newXp, 0); // Não pode ter XP negativo
    }

    // Atualizar no banco de dados
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        level: newLevel,
        xp: newXp,
      },
    });

    const xpForNextLevel = this.calculateXpForNextLevel(newLevel);

    return {
      newLevel,
      newXp,
      xpForNextLevel,
      leveledUp,
      previousLevel,
    };
  }

  /**
   * Calcula informações de XP e nível para um usuário
   */
  async getXpInfo(userId: string): Promise<{
    level: number;
    xp: number;
    xpForNextLevel: number;
    xpProgress: number; // 0.0 a 1.0
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { level: true, xp: true },
    });

    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    const xpForNextLevel = this.calculateXpForNextLevel(user.level);
    const xpProgress = xpForNextLevel > 0 ? user.xp / xpForNextLevel : 1.0;

    return {
      level: user.level,
      xp: user.xp,
      xpForNextLevel,
      xpProgress: Math.min(xpProgress, 1.0),
    };
  }
}
