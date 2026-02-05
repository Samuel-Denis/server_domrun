import { Injectable } from '@nestjs/common';
import * as turf from '@turf/turf';

/**
 * Service responsável por cálculos relacionados a corridas.
 * 
 * Contém apenas lógica de cálculo e transformação de dados, sem acesso ao banco.
 */
@Injectable()
export class RunsCalculationService {
  /**
   * Calcula a distância total de um trajeto somando distâncias entre pontos consecutivos
   * 
   * Usa Turf.js para cálculo de distância geodésica (considera curvatura da Terra).
   * Mais preciso que cálculo de distância euclidiana simples.
   * 
   * @param points - Array de pontos GPS {latitude, longitude}
   * @returns Distância total em metros
   */
  calculateDistance(points: Array<{ latitude: number; longitude: number }>): number {
    // Precisa de pelo menos 2 pontos para calcular distância
    if (points.length < 2) return 0;

    let totalDistance = 0;
    // Itera sobre pares de pontos consecutivos
    for (let i = 0; i < points.length - 1; i++) {
      // Cria pontos Turf.js: [longitude, latitude] (ordem do Turf)
      const p1 = turf.point([points[i].longitude, points[i].latitude]);
      const p2 = turf.point([points[i + 1].longitude, points[i + 1].latitude]);
      // turf.distance calcula distância geodésica (considera forma esférica da Terra)
      // units: 'meters' retorna resultado em metros
      totalDistance += turf.distance(p1, p2, { units: 'meters' });
    }
    return totalDistance;
  }

  /**
   * Calcula a duração de um trajeto baseado nos timestamps dos pontos
   * 
   * Usa timestamp do primeiro e último ponto para calcular duração total.
   * Se timestamps não estiverem disponíveis, retorna 0.
   * 
   * @param points - Array de pontos GPS com timestamps opcionais
   * @param startTime - Timestamp inicial (fallback se não houver nos pontos)
   * @param endTime - Timestamp final (fallback se não houver nos pontos)
   * @returns Duração em segundos
   */
  calculateDuration(
    points: Array<{ latitude: number; longitude: number; timestamp?: string }>,
    startTime?: Date,
    endTime?: Date,
  ): number {
    // Precisa de pelo menos 2 pontos para calcular duração
    if (points.length < 2) return 0;

    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];

    // Extrai timestamps (em milissegundos) dos pontos
    // Se timestamp não disponível, usa startTime/endTime fornecido ou timestamp atual como fallback
    const startTimestamp = firstPoint?.timestamp
      ? new Date(firstPoint.timestamp)
      : (startTime || new Date());
    const endTimestamp = lastPoint?.timestamp
      ? new Date(lastPoint.timestamp)
      : (endTime || new Date());

    // Calcula diferença em segundos (Math.floor arredonda para baixo)
    return Math.floor((endTimestamp.getTime() - startTimestamp.getTime()) / 1000);
  }

  /**
   * Calcula o ritmo médio de uma corrida
   * 
   * Fórmula: (duração em minutos) / (distância em km) = min/km
   * 
   * @param distance - Distância em metros
   * @param duration - Duração em segundos
   * @returns Ritmo médio em min/km, ou 0 se distância ou duração forem inválidas
   */
  calculateAveragePace(distance: number, duration: number): number {
    if (!distance || distance <= 0 || !duration || duration <= 0) {
      return 0;
    }
    // Converte duração para minutos e distância para km
    return (duration / 60) / (distance / 1000); // Resultado: min/km
  }

  /**
   * Calcula calorias estimadas usando MET (baseado em velocidade média).
   * Requer dados do usuário (peso/altura/idade). Se faltar, retorna undefined.
   */
  calculateCalories(
    distanceMeters: number,
    durationSeconds: number,
    userProfile?: { weightKg?: number | null; heightCm?: number | null; age?: number | null },
  ): number | undefined {
    if (!userProfile?.weightKg || !userProfile?.heightCm || !userProfile?.age) {
      return undefined;
    }
    if (!distanceMeters || !durationSeconds || distanceMeters <= 0 || durationSeconds <= 0) {
      return undefined;
    }

    const hours = durationSeconds / 3600;
    const speedKmh = (distanceMeters / 1000) / hours;
    const met = this.getRunningMet(speedKmh);
    const calories = met * userProfile.weightKg * hours;
    return Math.round(calories);
  }

  private getRunningMet(speedKmh: number): number {
    if (speedKmh < 8) return 8.3;
    if (speedKmh < 9.7) return 9.8;
    if (speedKmh < 11.3) return 11.0;
    if (speedKmh < 12.9) return 11.8;
    return 12.8;
  }

  /**
   * Calcula todos os dados de uma corrida simples
   * 
   * Calcula distância, duração e ritmo médio baseado nos pontos GPS fornecidos.
   * Valores já fornecidos são preservados (não recalculados).
   * 
   * @param path - Array de pontos GPS do trajeto
   * @param providedData - Dados já fornecidos (distância, duração, pace)
   * @param startTime - Timestamp inicial da corrida
   * @param endTime - Timestamp final da corrida (opcional)
   * @returns Objeto com distância, duração e averagePace calculados
   */
  calculateRunStats(
    path: Array<{ latitude: number; longitude: number; timestamp?: string }>,
    providedData: {
      distance?: number;
      duration?: number;
      averagePace?: number;
    },
    startTime: Date,
    endTime?: Date,
  ): {
    distance: number;
    duration: number;
    averagePace: number;
    calculatedEndTime: Date;
  } {
    // Calcular distância se não fornecida
    let distance = providedData.distance;
    if (!distance && path.length > 1) {
      distance = this.calculateDistance(path);
    }

    // Calcular duração se não fornecida
    let duration = providedData.duration;
    if (!duration && path.length > 1) {
      duration = this.calculateDuration(path, startTime, endTime);
    }

    // Calcular ritmo médio se não fornecido
    let averagePace = providedData.averagePace;
    if (!averagePace && distance && distance > 0 && duration && duration > 0) {
      averagePace = this.calculateAveragePace(distance, duration);
    }

    // Determinar endTime
    const lastPoint = path.length > 0 ? path[path.length - 1] : null;
    const calculatedEndTime =
      endTime ||
      (lastPoint && lastPoint.timestamp
        ? new Date(lastPoint.timestamp)
        : new Date(startTime.getTime() + (duration || 0) * 1000));

    return {
      distance: distance || 0,
      duration: duration || 0,
      averagePace: averagePace || 0,
      calculatedEndTime,
    };
  }
}
