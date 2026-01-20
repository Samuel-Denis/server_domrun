import { Injectable, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { RunsRepository } from './runs.repository';
import { MapMatchingService } from './map-matching.service';
import { CreateTerritoryDto } from './dto/create-territory.dto';
import { CreateRunDto } from './dto/create-run.dto';
import { XpService } from '../users/xp.service';
import { UploadService } from '../users/upload.service';
import { AchievementsService } from '../users/achievements.service';
import * as turf from '@turf/turf';

@Injectable()
export class RunsService {
    constructor(
        private readonly runsRepository: RunsRepository,
        private readonly mapMatchingService: MapMatchingService,
        @Inject(forwardRef(() => XpService))
        private readonly xpService: XpService,
        private readonly uploadService: UploadService,
        @Inject(forwardRef(() => AchievementsService))
        private readonly achievementsService: AchievementsService,
    ) { }

    /**
     * Cria uma corrida simples (sem território)
     * Usado quando o usuário quer apenas registrar o trajeto sem dominar área
     */
    async createSimpleRun(userId: string, dto: CreateRunDto) {
        try {
            // Validar path
            if (!dto.path || dto.path.length < 2) {
                throw new BadRequestException('Path deve ter pelo menos 2 pontos');
            }

            console.log('🏃 Recebendo corrida simples do frontend:');
            console.log(`   - Pontos: ${dto.path.length}`);

            // Processar timestamps
            const startTime = dto.startTime ? new Date(dto.startTime) : new Date();
            const endTime = dto.endTime ? new Date(dto.endTime) : undefined;

            // Salvar imagem do mapa se foi fornecida (precisamos criar a corrida primeiro)
            //  let mapImageUrl: string | null = null;

            // Criar a corrida
            const run = await this.runsRepository.saveSimpleRun({
                userId: userId, // Usar userId do token autenticado
                path: dto.path,
                startTime,
                endTime,
                distance: dto.distance,
                duration: dto.duration,
                averagePace: dto.averagePace,
                maxSpeed: dto.maxSpeed,
                elevationGain: dto.elevationGain,
                calories: dto.calories,
                caption: dto.caption,
                // mapImageUrl será atualizado depois se houver imagem
            });

            // Verificar conquistas relacionadas a corridas (assíncrono, não bloqueia)
            this.achievementsService.checkRunAchievements(userId, {
                distance: dto.distance,
                duration: dto.duration,
                averagePace: dto.averagePace,
                startTime,
                pathPoints: dto.path,
            }).catch(err => console.error('Erro ao verificar conquistas:', err));

            // Verificar conquistas de marcos (nível pode ter mudado após XP ganho)
            this.achievementsService.checkMilestoneAchievements(userId).catch(err => console.error('Erro ao verificar conquistas:', err));

            // Salvar imagem do mapa após criar a corrida
            /*  if (mapImage) {
                  try {
                      mapImageUrl = await this.uploadService.saveRunMapImage(mapImage, run.id);
                      console.log(`📸 Imagem do mapa salva: ${mapImageUrl}`);
  
                      // Atualizar a corrida com a URL da imagem
                      await this.runsRepository.updateRunMapImage(run.id, mapImageUrl);
                  } catch (imageError: any) {
                      console.warn('⚠️ Erro ao salvar imagem do mapa:', imageError.message);
                      // Não falhar a criação da corrida se a imagem falhar
                  }
              }*/

            return {
                ...run,
            };

        } catch (error: any) {
            console.error('❌ Erro ao criar corrida simples:', error.message);

            if (error instanceof BadRequestException) {
                throw error;
            }

            throw new BadRequestException(`Erro ao processar corrida: ${error.message || 'Erro desconhecido'}`);
        }
    }

    async createTerritory(userId: string, dto: CreateTerritoryDto) {
        try {
            // Validar boundary (LineString - não fechada, mínimo 2 pontos)
            this.validateBoundary(dto.boundary);

            console.log('📥 Recebendo território do frontend:');
            console.log(`   - Tipo: LineString (${dto.boundary.length} pontos)`);
            console.log(`   - Usuário: ${dto.userName}`);
            console.log(`   - Área: ${dto.areaName}`);
            //  console.log(`   - Imagem do mapa: ${mapImage ? 'Sim' : 'Não'}`);

            // Aplicar Map Matching para corrigir erros de GPS e alinhar com as ruas
            let correctedBoundary = dto.boundary;

            if (this.mapMatchingService.isAvailable() && dto.boundary.length >= 2) {
                try {
                    console.log('🗺️ Aplicando Map Matching para corrigir trajeto...');
                    // Timeout de 30 segundos para Map Matching
                    const mapMatchingPromise = this.mapMatchingService.matchTrace(dto.boundary, 'walking');
                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Map Matching timeout')), 30000)
                    );

                    correctedBoundary = await Promise.race([mapMatchingPromise, timeoutPromise]) as typeof dto.boundary;
                    console.log(`✅ Trajeto corrigido: ${dto.boundary.length} → ${correctedBoundary.length} pontos`);
                } catch (error: any) {
                    console.warn('⚠️ Erro ao aplicar Map Matching, usando pontos originais:', error.message);
                    // Continuar com pontos originais em caso de erro ou timeout
                    correctedBoundary = dto.boundary;
                }
            } else {
                if (!this.mapMatchingService.isAvailable()) {
                    console.log('ℹ️ Map Matching não disponível (token não configurado)');
                }
            }

            // Criar território com os pontos corrigidos
            // Timeout total de 60 segundos para operação completa
            const territoryResult = await Promise.race([
                this.runsRepository.createTerritoryWithBoundary({
                    ...dto,
                    boundary: correctedBoundary, // Usar pontos corrigidos
                    userId,
                }),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new BadRequestException('Timeout ao processar território')), 60000)
                )
            ]) as any;

            // Salvar imagem do mapa se foi fornecida
            // let mapImageUrl: string | null = null;
            /*    if (mapImage && territoryResult.runId) {
                    try {
                        mapImageUrl = await this.uploadService.saveRunMapImage(mapImage, territoryResult.runId);
                        console.log(`📸 Imagem do mapa salva: ${mapImageUrl}`);
    
                        // Atualizar a corrida com a URL da imagem
                        if (mapImageUrl) {
                            await this.runsRepository.updateRunMapImage(territoryResult.runId, mapImageUrl);
                        }
                    } catch (imageError: any) {
                        console.warn('⚠️ Erro ao salvar imagem do mapa:', imageError.message);
                        // Não falhar a criação da corrida se a imagem falhar
                    }
                }*/

            // Adicionar XP por criar território (50 XP base)
            let xpResult: Awaited<ReturnType<typeof this.xpService.addXp>> | null = null;
            try {
                xpResult = await this.xpService.addXp(userId, 50);
                console.log(`✨ ${userId} ganhou 50 XP! Nível: ${xpResult.previousLevel} → ${xpResult.newLevel}`);
            } catch (xpError: any) {
                console.warn('⚠️ Erro ao adicionar XP:', xpError.message);
            }

            // Verificar conquistas relacionadas a territórios (assíncrono, não bloqueia)
            this.achievementsService.checkTerritoryAchievements(userId, {
                area: territoryResult.area,
                stolen: false, // TODO: Detectar se roubou território de outro jogador
            }).catch(err => console.error('Erro ao verificar conquistas de território:', err));

            // Verificar conquistas de marcos (nível pode ter mudado após XP ganho)
            this.achievementsService.checkMilestoneAchievements(userId).catch(err => console.error('Erro ao verificar conquistas:', err));

            // Montar resposta com XP e imagem do mapa
            return {
                ...territoryResult,
                xp: xpResult ? {
                    level: xpResult.newLevel,
                    xp: xpResult.newXp,
                    xpForNextLevel: xpResult.xpForNextLevel,
                    leveledUp: xpResult.leveledUp,
                    previousLevel: xpResult.previousLevel,
                } : null,
            };

        } catch (error: any) {
            console.error('❌ Erro ao criar território:', error.message);

            // Sempre retornar um erro HTTP adequado para o frontend
            if (error instanceof BadRequestException) {
                throw error;
            }

            throw new BadRequestException(`Erro ao processar território: ${error.message || 'Erro desconhecido'}`);
        }
    }

    /**
     * Valida se o boundary é uma LineString válida (não fechada, pelo menos 3 pontos)
     * Conforme documentação, mínimo é 3 pontos, mas aceita 2 para compatibilidade
     */
    private validateBoundary(boundary: CreateTerritoryDto['boundary']): void {
        if (!boundary || boundary.length < 2) {
            throw new BadRequestException('Boundary deve ser uma LineString com pelo menos 2 pontos (recomendado: 3+)');
        }

        // Validar ordem cronológica (opcional, mas recomendado)
        const timestamps = boundary.map(p => new Date(p.timestamp).getTime());
        const isOrdered = timestamps.every((time, i) =>
            i === 0 || time >= timestamps[i - 1]
        );

        if (!isOrdered) {
            console.warn('⚠️ Pontos não estão em ordem cronológica, reordenando...');
            boundary.sort((a, b) =>
                new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );
        }

        // Verificar se está fechado (primeiro e último ponto iguais)
        // NOTA: Se o frontend enviar primeiro e último ponto iguais (circuito fechado),
        // não deve rejeitar, pois o backend vai tratar isso ao detectar distância < 30m
        const firstPoint = boundary[0];
        const lastPoint = boundary[boundary.length - 1];

        const latEqual = Math.abs(firstPoint.latitude - lastPoint.latitude) < 0.00001;
        const lngEqual = Math.abs(firstPoint.longitude - lastPoint.longitude) < 0.00001;

        // Permitir primeiro e último ponto iguais - o backend vai tratar como circuito fechado
        // Não rejeitar aqui, apenas logar informação
        if (latEqual && lngEqual) {
            console.log('ℹ️ Boundary recebido com primeiro e último ponto iguais (circuito fechado)');
        }

        // Validar coordenadas
        for (const point of boundary) {
            if (point.latitude < -90 || point.latitude > 90) {
                throw new BadRequestException(`Latitude inválida: ${point.latitude}`);
            }
            if (point.longitude < -180 || point.longitude > 180) {
                throw new BadRequestException(`Longitude inválida: ${point.longitude}`);
            }
        }
    }

    async processRun(userId: string, path: { latitude: number; longitude: number }[]) {
        if (path.length < 3) throw new BadRequestException('Caminho muito curto');

        // Lógica de Snap-to-Close (30 metros de tolerância)
        const start = turf.point([path[0].longitude, path[0].latitude]);// está pegando o primeiro ponto da corrida no array 
        const end = turf.point([path[path.length - 1].longitude, path[path.length - 1].latitude]); // está pegando o último ponto da corrida no array
        const distance = turf.distance(start, end, { units: 'meters' }); // calcula a distância entre o primeiro e o último ponto em metros

        if (distance > 30) {
            await this.runsRepository.saveRun(userId, path); // salva a corrida sem conquistar território
            return { message: 'Corrida salva, mas não fechou área.', conquered: false };
        }

        // Fecha o polígono para o PostGIS
        const closedPath = [...path, path[0]]; // fecha o polígono adicionando o primeiro ponto ao final
        const wkt = `POLYGON((${closedPath.map(p => `${p.longitude} ${p.latitude}`).join(',')}))`; // converte o caminho fechado para o formato WKT

        await this.runsRepository.conquerTerritory(userId, wkt, path); // conquista o território e salva a corrida
        return { message: 'Território conquistado!', conquered: true };
    }

    async getMapData(bbox?: { minLng: number; minLat: number; maxLng: number; maxLat: number }) {
        const data: any = await this.runsRepository.findAllTerritories(bbox);

        // Formatamos para o padrão GeoJSON preservando TODOS os pontos
        // IMPORTANTE: JSON.parse(t.geometry) já contém todos os pontos preservados pelo ST_AsGeoJSON
        return {
            type: "FeatureCollection",
            features: data.map((t: any) => ({
                type: "Feature",
                id: t.id,
                geometry: JSON.parse(t.geometry), // Preserva TODOS os pontos
                properties: {
                    owner: t.username,
                    color: t.color,
                    areaName: t.areaName || null,
                    userId: t.userId,
                    userName: t.name,
                    username: t.username,
                    photoUrl: t.photoUrl || null,
                    capturedAt: t.capturedAt ? new Date(t.capturedAt).toISOString() : null,
                    areaM2: t.areaM2 ? Number(parseFloat(t.areaM2).toFixed(2)) : null,
                }
            }))
        };
    }
}
