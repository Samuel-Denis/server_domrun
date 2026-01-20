import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

interface MapMatchingPoint {
    latitude: number;
    longitude: number;
    timestamp: string; // Obrigatório conforme DTO
}

interface MapboxMatchResponse {
    code: string;
    matchings: Array<{
        confidence: number;
        geometry: {
            coordinates: Array<[number, number]>; // [lng, lat]
            type: string;
        };
        legs: Array<{
            duration: number;
            distance: number;
            steps: Array<any>;
        }>;
    }>;
    tracepoints: Array<{
        matchings_index: number;
        waypoint_index: number;
        alternatives_count: number;
        location: [number, number];
        name?: string;
        distance?: number;
    } | null>;
}

@Injectable()
export class MapMatchingService {
    private readonly logger = new Logger(MapMatchingService.name);
    private readonly mapboxToken: string;
    private readonly baseUrl = 'https://api.mapbox.com';

    constructor() {
        // Obter token do Mapbox das variáveis de ambiente
        this.mapboxToken = process.env.MAPBOX_ACCESS_TOKEN || '';

        if (!this.mapboxToken) {
            this.logger.warn('⚠️ MAPBOX_ACCESS_TOKEN não configurado. Map Matching será desabilitado.');
        }
    }

    /**
     * Aplica Map Matching nos pontos do trajeto para corrigir erros de GPS
     * e alinhar os pontos com as ruas reais
     * 
     * @param points Array de pontos GPS do trajeto
     * @param profile Perfil de transporte (walking, cycling, driving) - padrão: walking
     * @returns Array de pontos corrigidos alinhados às ruas
     */
    async matchTrace(
        points: MapMatchingPoint[],
        profile: 'walking' | 'cycling' | 'driving' = 'walking'
    ): Promise<MapMatchingPoint[]> {
        // Se não houver token, retorna os pontos originais
        if (!this.mapboxToken) {
            this.logger.warn('Map Matching desabilitado - retornando pontos originais');
            return points;
        }

        // Verificar se há pontos suficientes
        if (!points || points.length < 2) {
            this.logger.warn('Poucos pontos para Map Matching - retornando pontos originais');
            return points;
        }

        try {
            this.logger.log(`🔍 Aplicando Map Matching em ${points.length} pontos...`);

            // Preparar pontos para a API do Mapbox
            // Formato esperado: coordenadas separadas por ; e timestamps opcionais
            const coordinates = points
                .map((point) => `${point.longitude},${point.latitude}`)
                .join(';');

            // Preparar timestamps se disponíveis
            let timestamps: string | undefined;
            if (points[0]?.timestamp) {
                timestamps = points
                    .map((point, index) => {
                        if (point.timestamp) {
                            const date = new Date(point.timestamp);
                            return Math.floor(date.getTime() / 1000); // Unix timestamp
                        }
                        // Se não tiver timestamp, usar timestamp relativo estimado
                        return index * 5; // Assumir 5 segundos entre pontos
                    })
                    .join(';');
            }

            // Construir URL da API
            // Endpoint: /matching/v5/{profile}/{coordinates}
            const url = `/matching/v5/mapbox/${profile}/${coordinates}`;

            const params: Record<string, string> = {
                access_token: this.mapboxToken,
                geometries: 'geojson', // Retornar em formato GeoJSON
                steps: 'true', // Incluir steps (passos) para melhor precisão
                overview: 'full', // Retornar geometria completa
            };

            // Adicionar timestamps se disponíveis (melhora a precisão)
            if (timestamps) {
                params.timestamps = timestamps;
            }

            // Fazer requisição à API do Mapbox
            const response = await axios.get<MapboxMatchResponse>(`${this.baseUrl}${url}`, { params });

            if (!response.data || !response.data.matchings || response.data.matchings.length === 0) {
                this.logger.warn('❌ Map Matching não retornou resultados - usando pontos originais');
                return points;
            }

            // Pegar o melhor matching (primeiro, geralmente o mais confiável)
            const bestMatching = response.data.matchings[0];
            const confidence = bestMatching.confidence;

            this.logger.log(`✅ Map Matching concluído - Confiança: ${(confidence * 100).toFixed(1)}%`);

            // Se a confiança for muito baixa (< 0.3), usar pontos originais
            if (confidence < 0.3) {
                this.logger.warn(`⚠️ Confiança baixa (${(confidence * 100).toFixed(1)}%) - usando pontos originais`);
                return points;
            }

            // Extrair pontos corrigidos da geometria
            const matchedCoordinates = bestMatching.geometry.coordinates;
            const matchedPoints: MapMatchingPoint[] = matchedCoordinates.map((coord, index) => {
                const [longitude, latitude] = coord;

                // Preservar timestamp original se disponível (interpolação)
                // Sempre retorna timestamp (interpola se necessário)
                const firstTimestamp = points[0]?.timestamp || new Date().toISOString();
                const lastTimestamp = points[points.length - 1]?.timestamp || new Date().toISOString();

                const startTime = new Date(firstTimestamp).getTime();
                const endTime = new Date(lastTimestamp).getTime();
                const ratio = matchedCoordinates.length > 1 ? index / (matchedCoordinates.length - 1) : 0;
                const interpolatedTime = new Date(startTime + (endTime - startTime) * ratio);
                const timestamp = interpolatedTime.toISOString();

                return {
                    latitude,
                    longitude,
                    timestamp, // Sempre definido
                };
            });

            this.logger.log(`📍 ${points.length} pontos originais → ${matchedPoints.length} pontos corrigidos`);

            return matchedPoints;

        } catch (error: any) {
            this.logger.error('❌ Erro ao aplicar Map Matching:', error.message);

            // Em caso de erro, retornar pontos originais (não quebrar o fluxo)
            if (error.response) {
                this.logger.error(`Status: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
            }

            return points;
        }
    }

    /**
     * Verifica se o Map Matching está disponível (token configurado)
     */
    isAvailable(): boolean {
        return !!this.mapboxToken;
    }
}
