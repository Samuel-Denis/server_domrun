import { Injectable } from '@nestjs/common';
import * as turf from '@turf/turf';

export interface AntiCheatResult {
  isValid: boolean;
  isSuspicious: boolean;
  reason?: string;
  warnings: string[];
}

/**
 * Serviço para validação anti-cheat
 * 
 * Regras:
 * 1. Velocidade Humana: Pace médio < 2:30 min/km = suspeito (bike/carro)
 * 2. GPS Jump: Distância > 100m em 5 segundos = descartar trecho (Fake GPS)
 * 3. Tempo Mínimo: Batalhas < 3 minutos = sem troféus
 */
@Injectable()
export class AntiCheatService {
  private readonly MIN_PACE_MIN_PER_KM = 2.5; // 2:30 min/km (limite humano)
  private readonly MIN_PACE_SECONDS = 2.5 * 60; // 150 segundos
  private readonly GPS_JUMP_THRESHOLD_METERS = 100; // 100 metros
  private readonly GPS_JUMP_TIME_THRESHOLD_MS = 5000; // 5 segundos
  private readonly MIN_BATTLE_DURATION_SECONDS = 180; // 3 minutos

  /**
   * Valida uma corrida completa
   */
  validateRun(
    distance: number,
    duration: number,
    averagePace: number,
    path: Array<{ latitude: number; longitude: number; timestamp: string }>,
  ): AntiCheatResult {
    const warnings: string[] = [];
    let isSuspicious = false;
    let reason: string | undefined;

    // 1. Validação de tempo mínimo
    if (duration < this.MIN_BATTLE_DURATION_SECONDS) {
      return {
        isValid: false,
        isSuspicious: false,
        reason: `Tempo mínimo de ${this.MIN_BATTLE_DURATION_SECONDS / 60} minutos não foi atingido`,
        warnings: [],
      };
    }

    // 2. Validação de velocidade humana (pace muito rápido = bike/carro)
    if (averagePace < this.MIN_PACE_MIN_PER_KM) {
      isSuspicious = true;
      reason = `Pace médio de ${averagePace.toFixed(2)} min/km é suspeito (limite humano: ${this.MIN_PACE_MIN_PER_KM} min/km)`;
      warnings.push('Velocidade suspeita detectada - possível uso de veículo');
    }

    // 3. Validação de GPS Jump (pontos muito distantes em pouco tempo = Fake GPS)
    const gpsJumpResult = this.detectGpsJumps(path);
    if (gpsJumpResult.hasJumps) {
      isSuspicious = true;
      if (!reason) {
        reason = `Detectados ${gpsJumpResult.jumpCount} salto(s) de GPS (possível Fake GPS)`;
      }
      warnings.push(`Detectados ${gpsJumpResult.jumpCount} salto(s) de GPS suspeito(s)`);
    }

    // Se for suspeito, invalida a corrida
    if (isSuspicious) {
      return {
        isValid: false,
        isSuspicious: true,
        reason,
        warnings,
      };
    }

    return {
      isValid: true,
      isSuspicious: false,
      warnings,
    };
  }

  /**
   * Detecta saltos de GPS no trajeto
   */
  private detectGpsJumps(
    path: Array<{ latitude: number; longitude: number; timestamp: string }>,
  ): { hasJumps: boolean; jumpCount: number } {
    if (path.length < 2) {
      return { hasJumps: false, jumpCount: 0 };
    }

    let jumpCount = 0;

    for (let i = 1; i < path.length; i++) {
      const prevPoint = path[i - 1];
      const currPoint = path[i];

      const prevTimestamp = new Date(prevPoint.timestamp).getTime();
      const currTimestamp = new Date(currPoint.timestamp).getTime();
      const timeDiff = currTimestamp - prevTimestamp;

      // Só verifica se o intervalo de tempo for <= 5 segundos
      if (timeDiff > 0 && timeDiff <= this.GPS_JUMP_TIME_THRESHOLD_MS) {
        // Calcula distância entre os dois pontos
        const point1 = turf.point([prevPoint.longitude, prevPoint.latitude]);
        const point2 = turf.point([currPoint.longitude, currPoint.latitude]);
        const distance = turf.distance(point1, point2, { units: 'meters' });

        // Se a distância for > 100m em <= 5s, é um salto suspeito
        if (distance > this.GPS_JUMP_THRESHOLD_METERS) {
          jumpCount++;
        }
      }
    }

    return {
      hasJumps: jumpCount > 0,
      jumpCount,
    };
  }

  /**
   * Valida apenas o tempo mínimo (para verificar se pode dar troféus)
   */
  validateMinimumDuration(duration: number): boolean {
    return duration >= this.MIN_BATTLE_DURATION_SECONDS;
  }
}
