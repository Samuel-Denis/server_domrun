import { Injectable } from '@nestjs/common';
import * as turf from '@turf/turf';
import { boundaryPointsToLineStringWKT, geoJsonPolygonToBoundaryPoints } from '../../common/gis/gis.helpers';

/**
 * Service responsável por cálculos e transformações relacionadas a territórios.
 * 
 * Contém apenas lógica de cálculo e transformação de dados, sem acesso ao banco.
 */
@Injectable()
export class TerritoryCalculationService {
  /**
   * Converte array de pontos GPS para formato WKT LineString
   * 
   * WKT (Well-Known Text) é um formato padrão para representar geometrias.
   * LineString representa uma sequência de pontos conectados (linha).
   * 
   * @param points - Array de pontos com latitude e longitude
   * @returns String WKT no formato: LINESTRING(lng lat, lng lat, ...)
   * 
   * IMPORTANTE: Mantém a ordem dos pontos (eles seguem a rota pelas ruas)
   * A ordem é crucial: alterá-la mudaria completamente o trajeto
   */
  createLineStringWKT(points: Array<{ latitude: number; longitude: number }>): string {
    return boundaryPointsToLineStringWKT(points);
  }

  /**
   * Detecta se um boundary forma um circuito fechado
   * 
   * Um circuito fechado é quando o primeiro e último ponto estão próximos
   * (distância <= 30m, tolerância para imprecisão do GPS).
   * 
   * @param boundary - Array de pontos GPS do boundary
   * @returns true se é circuito fechado, false caso contrário
   */
  isClosedLoop(boundary: Array<{ latitude: number; longitude: number }>): boolean {
    if (boundary.length < 2) return false;

    const startPoint = boundary[0];
    const endPoint = boundary[boundary.length - 1];

    // Cria pontos Turf.js para cálculo de distância geodésica
    const start = turf.point([startPoint.longitude, startPoint.latitude]);
    const end = turf.point([endPoint.longitude, endPoint.latitude]);
    const distanceBetweenPoints = turf.distance(start, end, { units: 'meters' });

    // Se distância < 30m, considera circuito fechado (tolerância para imprecisão do GPS)
    return distanceBetweenPoints <= 30;
  }

  /**
   * Calcula a distância entre o primeiro e último ponto de um boundary
   * 
   * @param boundary - Array de pontos GPS do boundary
   * @returns Distância em metros
   */
  getDistanceBetweenEndpoints(boundary: Array<{ latitude: number; longitude: number }>): number {
    if (boundary.length < 2) return 0;

    const startPoint = boundary[0];
    const endPoint = boundary[boundary.length - 1];

    const start = turf.point([startPoint.longitude, startPoint.latitude]);
    const end = turf.point([endPoint.longitude, endPoint.latitude]);

    return turf.distance(start, end, { units: 'meters' });
  }

  /**
   * Converte GeoJSON Polygon para formato boundary (array de pontos)
   * 
   * Após processamento PostGIS, o território é um Polygon bufferizado.
   * Este método extrai o ring externo do polígono e converte de volta para
   * o formato boundary que o frontend espera.
   * 
   * @param geoJson - GeoJSON Polygon retornado do PostGIS (ST_AsGeoJSON)
   * @returns Array de pontos no formato {latitude, longitude} (sem timestamps fake)
   */
  geoJsonToBoundaryPoints(
    geoJson: any,
  ): Array<{ latitude: number; longitude: number; timestamp?: string }> {
    try {
      return geoJsonPolygonToBoundaryPoints(geoJson);
    } catch {
      return [];
    }
  }

  /**
   * Calcula estatísticas de corrida a partir de um boundary
   * 
   * Usa os pontos do boundary para calcular distância, duração e ritmo.
   * 
   * @param boundary - Array de pontos GPS do boundary
   * @param providedData - Dados já fornecidos (distância, duração, pace)
   * @param capturedAt - Data de captura (usada como startTime)
   * @returns Objeto com distância, duração, averagePace e timestamps calculados
   */
  calculateTerritoryRunStats(
    boundary: Array<{ latitude: number; longitude: number; timestamp?: string }>,
    providedData: {
      distance?: number;
      duration?: number;
      averagePace?: number;
    },
    capturedAt?: Date,
  ): {
    distance: number;
    duration: number;
    averagePace: number;
    startTime: Date;
    endTime: Date;
  } {
    const startTime = capturedAt || new Date();

    // Calcular distância se não fornecida
    let distance = providedData.distance;
    if (!distance) {
      let totalDistance = 0;
      if (boundary.length > 1) {
        for (let i = 0; i < boundary.length - 1; i++) {
          const p1 = turf.point([boundary[i].longitude, boundary[i].latitude]);
          const p2 = turf.point([boundary[i + 1].longitude, boundary[i + 1].latitude]);
          totalDistance += turf.distance(p1, p2, { units: 'meters' });
        }
      }
      distance = totalDistance;
    }

    // Calcular duração se não fornecida
    let duration = providedData.duration;
    if (!duration && boundary.length > 1) {
      const firstPoint = boundary[0];
      const lastPoint = boundary[boundary.length - 1];
      const startTimestamp = firstPoint?.timestamp ? new Date(firstPoint.timestamp) : startTime;
      const endTimestamp = lastPoint?.timestamp ? new Date(lastPoint.timestamp) : new Date();
      duration = Math.floor((endTimestamp.getTime() - startTimestamp.getTime()) / 1000);
    }

    // Calcular ritmo médio se não fornecido
    let averagePace = providedData.averagePace;
    if (!averagePace && distance && distance > 0 && duration && duration > 0) {
      averagePace = (duration / 60) / (distance / 1000); // Resultado: min/km
    }

    // Estima endTime baseado em startTime + duration
    const endTime = new Date(startTime.getTime() + (duration || 0) * 1000);

    return {
      distance: distance || 0,
      duration: duration || 0,
      averagePace: averagePace || 0,
      startTime,
      endTime,
    };
  }
}
