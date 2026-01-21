import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { RunsRepository } from '../runs.repository';
import { TerritoryCalculationService } from './territory-calculation.service';
import { TerritoryProcessingService } from './territory-processing.service';

/**
 * Service responsável por orquestrar a criação e processamento de territórios.
 * 
 * Coordena:
 * - Cálculos de estatísticas da corrida
 * - Conversão de boundary para WKT
 * - Criação inicial do território
 * - Fusão de territórios do mesmo usuário
 * - Recorte de territórios de outros usuários
 * - Limpeza de fragmentos
 */
@Injectable()
export class TerritoryService {
  private readonly logger = new Logger(TerritoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly runsRepository: RunsRepository,
    private readonly territoryCalculationService: TerritoryCalculationService,
    private readonly territoryProcessingService: TerritoryProcessingService,
  ) {}

  /**
   * Cria um território completo a partir de um boundary
   * 
   * Processa o boundary, cria o território inicial, funde territórios próximos,
   * recorta territórios inimigos e limpa fragmentos.
   * 
   * @param data - Dados do território
   * @returns Objeto com informações do território criado
   */
  async createTerritory(data: {
    userId: string;
    userName: string;
    userColor: string;
    areaName: string;
    boundary: Array<{ latitude: number; longitude: number; timestamp?: string }>;
    area?: number;
    capturedAt?: string;
    distance?: number;
    duration?: number;
    averagePace?: number;
    maxSpeed?: number;
    elevationGain?: number;
    calories?: number;
  }) {
    // Transação atômica (60s timeout)
    return this.prisma.$transaction(
      async (tx) => {
        this.logger.debug('🛠️  Processando território');
        this.logger.debug(`   📍 ${data.boundary.length} pontos recebidos (LineString)`);

        // ===== PASSO 1: CONVERTER BOUNDARY PARA WKT =====
        const lineStringWKT = this.territoryCalculationService.createLineStringWKT(data.boundary);
        this.logger.debug('   ✅ LineString WKT criada');

        // ===== PASSO 2: DETECTAR CIRCUITO FECHADO =====
        const isClosedLoop = this.territoryCalculationService.isClosedLoop(data.boundary);
        const distanceBetweenPoints = this.territoryCalculationService.getDistanceBetweenEndpoints(
          data.boundary,
        );
        this.logger.debug(`   📏 Distância entre primeiro e último ponto: ${distanceBetweenPoints.toFixed(2)}m`);
        this.logger.debug(`   🔄 Circuito ${isClosedLoop ? 'FECHADO' : 'ABERTO'} (limite: 30m)`);

        // ===== PASSO 3: PREPARAR DATAS =====
        const capturedAt = data.capturedAt ? new Date(data.capturedAt) : new Date();

        // ===== PASSO 4: CRIAR TERRITÓRIO INICIAL =====
        const territoryResult = await this.runsRepository.createTerritory({
          userId: data.userId,
          userName: data.userName,
          userColor: data.userColor,
          areaName: data.areaName,
          lineStringWKT,
          isClosedLoop,
          capturedAt,
        });

        const territoryId = territoryResult.id;
        let calculatedArea = territoryResult.area;
        let currentTerritoryWKT: string;

        this.logger.debug('✅ Território salvo com sucesso');
        this.logger.debug(`   - ID: ${territoryId}`);
        this.logger.debug(`   - Área calculada: ${calculatedArea.toFixed(2)} m²`);

        // ===== PASSO 5: OBTER GEOMETRIA WKT PARA PROCESSAMENTO =====
        currentTerritoryWKT = await this.runsRepository.getTerritoryWKT(territoryId, tx);

        // ===== PASSO 6: FUSIONAR TERRITÓRIOS DO MESMO USUÁRIO =====
        try {
          const territoriesToMerge = await this.territoryProcessingService.findTerritoriesToMerge(
            tx,
            data.userId,
            territoryId,
            currentTerritoryWKT,
          );

          if (territoriesToMerge.length > 0) {
            this.logger.debug(`   🔗 Encontrados ${territoriesToMerge.length} território(s) do mesmo usuário para fusão`);

            const mergeResult = await this.territoryProcessingService.mergeTerritories(
              tx,
              territoryId,
              currentTerritoryWKT,
              territoriesToMerge,
            );

            if (mergeResult) {
              currentTerritoryWKT = mergeResult.finalWKT;
              calculatedArea = mergeResult.area;
              this.logger.debug(`   ✅ ${territoriesToMerge.length} território(s) fundidos com sucesso`);
            }
          }
        } catch (mergeError: any) {
          this.logger.warn(`⚠️ Erro na fusão de territórios: ${mergeError.message}`);
        }

        // ===== PASSO 7: RECORTAR TERRITÓRIOS DE OUTROS USUÁRIOS =====
        try {
          const enemyTerritories = await this.territoryProcessingService.findEnemyTerritoriesToCut(
            tx,
            data.userId,
            territoryId,
            currentTerritoryWKT,
          );

          if (enemyTerritories.length > 0) {
            this.logger.debug(`   ⚔️ Recortando ${enemyTerritories.length} território(s) de outros usuários...`);

            for (const enemyTerritory of enemyTerritories) {
              try {
                const fragmentsCount = await this.territoryProcessingService.cutEnemyTerritory(
                  tx,
                  enemyTerritory,
                  currentTerritoryWKT,
                );

                if (fragmentsCount > 1) {
                  this.logger.debug(
                    `   ✂️  Território ${enemyTerritory.id} dividido em ${fragmentsCount} fragmentos`,
                  );
                }
              } catch (cutError: any) {
                this.logger.warn(`⚠️ Erro ao recortar território ${enemyTerritory.id}: ${cutError.message}`);
              }
            }

            this.logger.debug(`   ✅ Área roubada de ${enemyTerritories.length} território(s) inimigo(s)`);
          } else {
            this.logger.debug('   ✅ Nenhum território inimigo para recortar.');
          }
        } catch (cutError: any) {
          this.logger.warn(`⚠️ Erro no recorte de territórios: ${cutError.message}`);
        }

        // ===== PASSO 8: LIMPEZA DE FRAGMENTOS =====
        try {
          const deletedCount = await this.territoryProcessingService.cleanupFragments(tx);
          if (deletedCount > 0) {
            this.logger.debug(`   🧹 ${deletedCount} fragmento(s) pequeno(s) removido(s)`);
          }
        } catch (cleanupError: any) {
          this.logger.warn(`⚠️ Erro na limpeza de fragmentos: ${cleanupError.message}`);
        }

        // ===== PASSO 9: CALCULAR DADOS DA CORRIDA =====
        const runStats = this.territoryCalculationService.calculateTerritoryRunStats(
          data.boundary,
          {
            distance: data.distance,
            duration: data.duration,
            averagePace: data.averagePace,
          },
          capturedAt,
        );

        // ===== PASSO 10: CRIAR REGISTRO DA CORRIDA =====
        const run = await this.runsRepository.createRunWithTerritory(
          {
            userId: data.userId,
            path: data.boundary,
            startTime: runStats.startTime,
            endTime: runStats.endTime,
            distance: runStats.distance,
            duration: runStats.duration,
            averagePace: runStats.averagePace,
            maxSpeed: data.maxSpeed,
            elevationGain: data.elevationGain,
            calories: data.calories,
          },
          territoryId,
          tx,
        );

        // ===== PASSO 11: OBTER GEOJSON FINAL =====
        const finalTerritory = await tx.$queryRaw<any[]>(Prisma.sql`
          SELECT ST_AsGeoJSON(geometry)::json as geometry_geojson
          FROM territories
          WHERE id = ${territoryId}::uuid
        `);

        const boundaryPoints = this.territoryCalculationService.geoJsonToBoundaryPoints(
          finalTerritory[0].geometry_geojson,
        );

        return {
          id: territoryId,
          userId: data.userId,
          userName: data.userName,
          userColor: data.userColor,
          areaName: data.areaName,
          boundary: boundaryPoints,
          capturedAt: capturedAt.toISOString(),
          area: calculatedArea,
          runId: run.id,
        };
      },
      {
        timeout: 60000, // Timeout de 60 segundos
      },
    );
  }
}
