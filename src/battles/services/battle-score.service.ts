import { Injectable } from '@nestjs/common';

/**
 * Serviço para calcular o Battle Score (BS)
 * 
 * Fórmula: BS = (Distância_Metros × 0.6) + ((720 - Pace_Segundos)/(720 - 240) × 1000 × 0.4)
 * 
 * - Distância (D): 60% da nota
 * - Pace (P): 40% da nota
 * - Pace alvo (mínimo para pontuação cheia): 4:00 min/km (240 segundos)
 * - Pace limite (caminhada/mínimo): 12:00 min/km (720 segundos)
 */
@Injectable()
export class BattleScoreService {
  private readonly DISTANCE_WEIGHT = 0.6;
  private readonly PACE_WEIGHT = 0.4;
  private readonly MIN_PACE_SECONDS = 240; // 4:00 min/km
  private readonly MAX_PACE_SECONDS = 720; // 12:00 min/km
  private readonly MAX_PACE_SCORE = 1000; // Pontuação máxima para pace

  /**
   * Calcula o Battle Score baseado na distância e pace
   * @param distance Metros percorridos
   * @param averagePace Pace médio em min/km
   * @returns Battle Score (número decimal)
   */
  calculateBattleScore(distance: number, averagePace: number): number {
    // Converte pace de min/km para segundos/km
    const paceSeconds = averagePace * 60;

    // Componente de distância (60% da nota)
    const distanceScore = distance * this.DISTANCE_WEIGHT;

    // Componente de pace (40% da nota)
    let paceScore = 0;
    
    if (paceSeconds <= this.MIN_PACE_SECONDS) {
      // Pace melhor ou igual a 4:00 min/km → pontuação máxima
      paceScore = this.MAX_PACE_SCORE;
    } else if (paceSeconds >= this.MAX_PACE_SECONDS) {
      // Pace pior ou igual a 12:00 min/km → pontuação zero
      paceScore = 0;
    } else {
      // Interpolação linear entre MIN_PACE e MAX_PACE
      const paceRatio = (this.MAX_PACE_SECONDS - paceSeconds) / (this.MAX_PACE_SECONDS - this.MIN_PACE_SECONDS);
      paceScore = paceRatio * this.MAX_PACE_SCORE;
    }

    const paceComponent = paceScore * this.PACE_WEIGHT;

    // Battle Score final
    const battleScore = distanceScore + paceComponent;

    return Math.round(battleScore * 100) / 100; // Arredonda para 2 casas decimais
  }

  /**
   * Converte pace de min/km para segundos/km
   */
  private paceToSeconds(pace: number): number {
    return pace * 60;
  }
}
