import { Injectable } from '@nestjs/common';
import type { Run } from '@prisma/client';

/**
 * Serviço de anti-cheat para corridas semanais
 */
@Injectable()
export class WeeklyAntiCheatService {
  /**
   * Valida uma corrida e retorna flags + multiplicador
   */
  async validateRun(run: Run, pathPoints: any[]): Promise<{
    isValid: boolean;
    flags: string[];
    multiplier: number;
    invalidReason?: string;
  }> {
    const flags: string[] = [];
    let multiplier = 1.0;

    // 1. Validar velocidade máxima (anti-veículo)
    const maxSpeed = run.maxSpeed || 0;
    const MAX_HUMAN_SPEED_KMH = 25; // ~6:40 min/km (velocidade de elite)
    
    if (maxSpeed > MAX_HUMAN_SPEED_KMH) {
      flags.push('SPEED_ANOMALY');
      multiplier = 0; // Invalida a corrida
      return {
        isValid: false,
        flags,
        multiplier,
        invalidReason: `Velocidade máxima muito alta: ${maxSpeed.toFixed(2)} km/h (máx humano: ${MAX_HUMAN_SPEED_KMH} km/h)`,
      };
    }

    // 2. Validar velocidade média (anti-bicicleta)
    const distanceKm = run.distance / 1000;
    const durationHours = run.duration / 3600;
    const avgSpeedKmh = distanceKm / durationHours;

    if (avgSpeedKmh > 20) { // ~3:00 min/km (muito rápido para corrida sustentada)
      flags.push('AVERAGE_SPEED_ANOMALY');
      multiplier *= 0.75; // Penaliza mas não invalida
    }

    // 3. Validar saltos de GPS (distâncias irreais entre pontos consecutivos)
    let gpsJumps = 0;
    for (let i = 1; i < pathPoints.length; i++) {
      const prev = pathPoints[i - 1];
      const curr = pathPoints[i];
      
      const distance = this.calculateDistance(
        prev.latitude,
        prev.longitude,
        curr.latitude,
        curr.longitude
      );
      const timeDiff = (new Date(curr.timestamp).getTime() - 
                       new Date(prev.timestamp).getTime()) / 1000;

      // Se distância > 100m em menos de 5 segundos, é um salto suspeito
      if (distance > 100 && timeDiff < 5) {
        gpsJumps++;
      }
    }

    if (gpsJumps > pathPoints.length * 0.1) { // Mais de 10% dos pontos com saltos
      flags.push('GPS_JUMP');
      multiplier *= 0.9;
    }

    // 4. Validar duração mínima (anti-truque rápido)
    const MIN_DURATION_SECONDS = 900; // 15 minutos mínimo
    
    if (run.duration < MIN_DURATION_SECONDS) {
      flags.push('MIN_DURATION');
      multiplier = 0;
      return {
        isValid: false,
        flags,
        multiplier,
        invalidReason: `Duração muito curta: ${run.duration}s (mínimo: ${MIN_DURATION_SECONDS}s)`,
      };
    }

    // 5. Validar trajetória realista (distância total vs distância acumulada dos pontos)
    const totalPointDistance = this.calculateTotalPointDistance(pathPoints);
    const ratio = run.distance / totalPointDistance;

    if (ratio < 0.7 || ratio > 1.3) { // Diferença > 30%
      flags.push('TRAJECTORY_ANOMALY');
      multiplier *= 0.85;
    }

    return {
      isValid: multiplier > 0,
      flags,
      multiplier,
    };
  }

  /**
   * Calcula distância entre dois pontos (Haversine, em metros)
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Calcula distância total acumulada dos pontos do trajeto
   */
  private calculateTotalPointDistance(pathPoints: any[]): number {
    let total = 0;
    for (let i = 1; i < pathPoints.length; i++) {
      const prev = pathPoints[i - 1];
      const curr = pathPoints[i];
      total += this.calculateDistance(
        prev.latitude,
        prev.longitude,
        curr.latitude,
        curr.longitude
      );
    }
    return total;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}
