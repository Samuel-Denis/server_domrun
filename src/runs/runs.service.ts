import { Injectable, BadRequestException, Inject, forwardRef, Logger } from '@nestjs/common';
import { RunsRepository } from './runs.repository';
import { MapMatchingService } from './map-matching.service';
import { CreateTerritoryDto } from './dto/create-territory.dto';
import { CreateRunDto } from './dto/create-run.dto';
import { XpService } from '../users/xp.service';
import { UploadService } from '../users/upload.service';
import { AchievementsService } from '../users/achievements.service';
import { RunsCalculationService } from './services/runs-calculation.service';
import { TerritoryService } from './services/territory.service';
import { boundaryPointsToPolygonWKT } from '../common/gis/gis.helpers';
import { UsersService } from '../users/users.service';
import * as turf from '@turf/turf';

@Injectable()
export class RunsService {
    private readonly logger = new Logger(RunsService.name);

    constructor(
        private readonly runsRepository: RunsRepository,
        private readonly mapMatchingService: MapMatchingService,
        @Inject(forwardRef(() => XpService))
        private readonly xpService: XpService,
        private readonly uploadService: UploadService,
        @Inject(forwardRef(() => AchievementsService))
        private readonly achievementsService: AchievementsService,
        private readonly runsCalculationService: RunsCalculationService,
        private readonly territoryService: TerritoryService,
        @Inject(forwardRef(() => UsersService))
        private readonly usersService: UsersService,
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

            this.logger.log('🏃 Recebendo corrida simples do frontend');
            this.logger.log(`   - Pontos: ${dto.path.length}`);

            // Processar timestamps
            const startTime = dto.startTime ? new Date(dto.startTime) : new Date();
            const endTime = dto.endTime ? new Date(dto.endTime) : undefined;

            // Calcular estatísticas da corrida
            const runStats = this.runsCalculationService.calculateRunStats(
                dto.path,
                {
                    distance: dto.distance,
                    duration: dto.duration,
                    averagePace: dto.averagePace,
                },
                startTime,
                endTime,
            );

            let calories = dto.calories;
            if (calories === undefined || calories === null) {
                const profile = await this.usersService.getUserHealthProfile(userId);
                calories = this.runsCalculationService.calculateCalories(
                    runStats.distance,
                    runStats.duration,
                    profile ?? undefined,
                );
            }

            // Criar a corrida (dados já calculados)
            const run = await this.runsRepository.saveSimpleRun({
                userId: userId,
                path: dto.path,
                startTime,
                endTime: runStats.calculatedEndTime,
                distance: runStats.distance,
                duration: runStats.duration,
                averagePace: runStats.averagePace,
                maxSpeed: dto.maxSpeed,
                elevationGain: dto.elevationGain,
                calories,
                caption: dto.caption,
            });

            // Verificar conquistas relacionadas a corridas (assíncrono, não bloqueia)
            this.achievementsService.checkRunAchievements(userId, {
                distance: dto.distance,
                duration: dto.duration,
                averagePace: dto.averagePace,
                startTime,
                pathPoints: dto.path,
            }).catch(err => this.logger.error('Erro ao verificar conquistas', err?.stack || err));

            // Verificar conquistas de marcos (nível pode ter mudado após XP ganho)
            this.achievementsService
                .checkMilestoneAchievements(userId)
                .catch(err => this.logger.error('Erro ao verificar conquistas', err?.stack || err));

            return {
                ...run,
            };

        } catch (error: any) {
            this.logger.error('❌ Erro ao criar corrida simples', error?.stack || error);

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

            this.logger.log('📥 Recebendo território do frontend');
            this.logger.log(`   - Tipo: LineString (${dto.boundary.length} pontos)`);
            this.logger.log(`   - Usuário: ${dto.userName}`);
            this.logger.log(`   - Área: ${dto.areaName}`);
            // Aplicar Map Matching para corrigir erros de GPS e alinhar com as ruas
            let correctedBoundary = dto.boundary;

            if (this.mapMatchingService.isAvailable() && dto.boundary.length >= 2) {
                try {
                    this.logger.log('🗺️ Aplicando Map Matching para corrigir trajeto...');
                    // Timeout de 30 segundos para Map Matching
                    const mapMatchingPromise = this.mapMatchingService.matchTrace(dto.boundary, 'walking');
                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Map Matching timeout')), 30000)
                    );

                    correctedBoundary = await Promise.race([mapMatchingPromise, timeoutPromise]) as typeof dto.boundary;
                    this.logger.log(`✅ Trajeto corrigido: ${dto.boundary.length} → ${correctedBoundary.length} pontos`);
                } catch (error: any) {
                    this.logger.warn(`⚠️ Erro ao aplicar Map Matching, usando pontos originais: ${error?.message || error}`);
                    // Continuar com pontos originais em caso de erro ou timeout
                    correctedBoundary = dto.boundary;
                }
            } else {
                if (!this.mapMatchingService.isAvailable()) {
                    this.logger.log('ℹ️ Map Matching não disponível (token não configurado)');
                }
            }

            const runStatsForCalories = this.runsCalculationService.calculateRunStats(
                correctedBoundary,
                {
                    distance: dto.distance,
                    duration: dto.duration,
                    averagePace: dto.averagePace,
                },
                new Date(dto.capturedAt || Date.now()),
            );

            let calories = dto.calories;
            if (calories === undefined || calories === null) {
                const profile = await this.usersService.getUserHealthProfile(userId);
                calories = this.runsCalculationService.calculateCalories(
                    runStatsForCalories.distance,
                    runStatsForCalories.duration,
                    profile ?? undefined,
                );
            }

            // Criar território com os pontos corrigidos
            // Timeout total de 60 segundos para operação completa
            const territoryResult = await Promise.race([
                this.territoryService.createTerritory({
                    ...dto,
                    boundary: correctedBoundary, // Usar pontos corrigidos
                    userId,
                    calories,
                }),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new BadRequestException('Timeout ao processar território')), 60000)
                )
            ]) as any;

            // Adicionar XP por criar território (50 XP base)
            let xpResult: Awaited<ReturnType<typeof this.xpService.addXp>> | null = null;
            try {
                xpResult = await this.xpService.addXp(userId, 50);
                this.logger.log(`✨ ${userId} ganhou 50 XP! Nível: ${xpResult.previousLevel} → ${xpResult.newLevel}`);
            } catch (xpError: any) {
                this.logger.warn(`⚠️ Erro ao adicionar XP: ${xpError?.message || xpError}`);
            }

            // Verificar conquistas relacionadas a territórios (assíncrono, não bloqueia)
            this.achievementsService.checkTerritoryAchievements(userId, {
                area: territoryResult.area,
                stolen: false, // TODO: Detectar se roubou território de outro jogador
            }).catch(err => this.logger.error('Erro ao verificar conquistas de território', err?.stack || err));

            // Verificar conquistas de marcos (nível pode ter mudado após XP ganho)
            this.achievementsService
                .checkMilestoneAchievements(userId)
                .catch(err => this.logger.error('Erro ao verificar conquistas', err?.stack || err));

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
            this.logger.error('❌ Erro ao criar território', error?.stack || error);

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
            this.logger.warn('⚠️ Pontos não estão em ordem cronológica, reordenando...');
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
            this.logger.log('ℹ️ Boundary recebido com primeiro e último ponto iguais (circuito fechado)');
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
        const start = turf.point([path[0].longitude, path[0].latitude]);
        const end = turf.point([path[path.length - 1].longitude, path[path.length - 1].latitude]);
        const distance = turf.distance(start, end, { units: 'meters' });

        if (distance > 30) {
            // Calcular estatísticas da corrida
            const startTime = new Date();
            const runStats = this.runsCalculationService.calculateRunStats(
                path,
                {},
                startTime,
            );

            const profile = await this.usersService.getUserHealthProfile(userId);
            const calories = this.runsCalculationService.calculateCalories(
                runStats.distance,
                runStats.duration,
                profile ?? undefined,
            );

            // Salvar corrida sem conquistar território
            await this.runsRepository.saveRun(userId, path, {
                startTime,
                endTime: runStats.calculatedEndTime,
                distance: runStats.distance,
                duration: runStats.duration,
                averagePace: runStats.averagePace,
                calories,
            });

            return { message: 'Corrida salva, mas não fechou área.', conquered: false };
        }

        // Fecha o polígono para o PostGIS usando helper GIS
        const wkt = boundaryPointsToPolygonWKT(path);

        // Calcular estatísticas da corrida
        const startTime = new Date();
        const runStats = this.runsCalculationService.calculateRunStats(
            path,
            {},
            startTime,
        );

        const profile = await this.usersService.getUserHealthProfile(userId);
        const calories = this.runsCalculationService.calculateCalories(
            runStats.distance,
            runStats.duration,
            profile ?? undefined,
        );

        // Conquistar território e salvar a corrida
        await this.runsRepository.conquerTerritory(userId, wkt, path, {
            startTime,
            endTime: runStats.calculatedEndTime,
            distance: runStats.distance,
            duration: runStats.duration,
            averagePace: runStats.averagePace,
            calories,
        });

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
