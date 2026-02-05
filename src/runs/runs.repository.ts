import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

/**
 * Repository responsável APENAS por operações de persistência (CRUD) no banco de dados.
 * 
 * NÃO contém:
 * - Cálculos (distância, duração, pace) → RunsCalculationService
 * - Transformações (WKT, GeoJSON) → TerritoryCalculationService
 * - Regras de negócio (fusão, recorte) → TerritoryProcessingService
 * 
 * Utiliza Prisma para operações básicas e SQL raw para operações PostGIS complexas.
 */
@Injectable()
export class RunsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Salva uma corrida simples no banco de dados
   * 
   * IMPORTANTE: Todos os cálculos (distância, duração, pace) devem ser feitos ANTES
   * de chamar este método, usando RunsCalculationService.
   * 
   * @param data - Dados da corrida já calculados
   * @returns Objeto com informações da corrida criada
   */
  async saveSimpleRun(data: {
    userId: string;
    path: Array<{ latitude: number; longitude: number; timestamp?: string }>;
    startTime: Date;
    endTime: Date;
    distance: number;
    duration: number;
    averagePace: number;
    maxSpeed?: number;
    elevationGain?: number;
    calories?: number;
    caption?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      // Criar registro da corrida
      const run = await tx.run.create({
        data: {
          userId: data.userId,
          startTime: data.startTime,
          endTime: data.endTime,
          distance: data.distance,
          duration: data.duration,
          averagePace: data.averagePace,
          maxSpeed: data.maxSpeed,
          elevationGain: data.elevationGain,
          calories: data.calories,
          territoryId: null,
          caption: data.caption || null,
        },
      });

      // Salvar pontos do trajeto
      if (data.path && data.path.length > 0) {
        await tx.runPathPoint.createMany({
          data: data.path.map((point: any, index: number) => ({
            runId: run.id,
            latitude: point.latitude,
            longitude: point.longitude,
            timestamp: point.timestamp
              ? new Date(point.timestamp)
              : new Date(data.startTime.getTime() + index * 1000),
            sequenceOrder: index,
          })),
        });
      }

      return {
        id: run.id,
        userId: run.userId,
        startTime: run.startTime,
        endTime: run.endTime,
        distance: run.distance,
        duration: run.duration,
        averagePace: run.averagePace,
        maxSpeed: run.maxSpeed,
        elevationGain: run.elevationGain,
        calories: run.calories,
      };
    });
  }

  /**
   * Salva uma corrida genérica (método legacy/compatibilidade)
   * 
   * @param userId - ID do usuário
   * @param path - Array de pontos GPS do trajeto
   * @param runData - Dados da corrida
   * @returns Objeto Run criado
   */
  async saveRun(userId: string, path: any, runData: any = {}) {
    const run = await this.prisma.run.create({
      data: {
        userId,
        startTime: runData.startTime || new Date(),
        endTime: runData.endTime,
        distance: runData.distance || 0,
        duration: runData.duration || 0,
        averagePace: runData.averagePace || 0,
        maxSpeed: runData.maxSpeed,
        elevationGain: runData.elevationGain,
        calories: runData.calories,
        territoryId: runData.territoryId,
      },
    });

    // Salvar pontos do trajeto
    if (path && Array.isArray(path)) {
      await this.prisma.runPathPoint.createMany({
        data: path.map((point: any, index: number) => ({
          runId: run.id,
          latitude: point.latitude,
          longitude: point.longitude,
          timestamp: point.timestamp
            ? new Date(point.timestamp)
            : new Date(run.startTime.getTime() + index * 1000),
          sequenceOrder: index,
        })),
      });
    }

    return run;
  }

  /**
   * Cria um território no banco usando PostGIS
   * 
   * IMPORTANTE: A geometria WKT já deve estar processada (buffer aplicado, polígono fechado).
   * Este método apenas insere no banco, não faz processamento.
   * 
   * @param data - Dados do território incluindo geometria WKT já processada
   * @returns Dados do território criado incluindo ID, área e GeoJSON
   */
  async createTerritory(data: {
    userId: string;
    userName: string;
    userColor: string;
    areaName: string;
    lineStringWKT: string;
    isClosedLoop: boolean;
    capturedAt: Date;
  }): Promise<{
    id: string;
    area: number;
    geometryGeoJson: any;
  }> {
    const createdAt = new Date();

    const territoryResult = await this.prisma.$queryRaw(Prisma.sql`
      INSERT INTO territories (
        "id", 
        "userId", 
        "userName", 
        "userColor", 
        "areaName", 
        "area", 
        "geometry", 
        "createdAt", 
        "updatedAt",
        "capturedAt"
      )
      WITH line_geom AS (
        SELECT ST_MakeValid(
          ST_Transform(
            ST_GeomFromText(${data.lineStringWKT}::text, 4326),
            3857
          )
        ) AS geom
      ),
      closed_geom AS (
        SELECT 
          CASE 
            WHEN ${data.isClosedLoop} THEN
              ST_MakeValid(
                ST_MakePolygon(
                  ST_AddPoint(geom, ST_StartPoint(geom))
                )
              )
            ELSE
              geom
          END AS geom
        FROM line_geom
      ),
      buffered_geom AS (
        SELECT ST_MakeValid(
          ST_Transform(
            ST_Buffer(
              (SELECT geom FROM closed_geom),
              10,
              'endcap=flat join=mitre'
            ),
            4326
          )
        ) AS geom
      )
      SELECT 
        gen_random_uuid(),
        ${data.userId}::uuid,
        ${data.userName},
        ${data.userColor},
        ${data.areaName || 'Território Conquistado'},
        ST_Area(
          ST_Transform(
            (SELECT geom FROM buffered_geom),
            3857
          )
        ),
        (SELECT geom FROM buffered_geom),
        ${createdAt},
        ${createdAt},
        ${data.capturedAt}
      RETURNING 
        id,
        area,
        ST_AsGeoJSON(geometry)::json as geometry_geojson
    `) as any[];

    return {
      id: territoryResult[0].id,
      area: parseFloat(territoryResult[0].area),
      geometryGeoJson: territoryResult[0].geometry_geojson,
    };
  }

  /**
   * Obtém a geometria WKT de um território
   * 
   * @param territoryId - ID do território
   * @param tx - Transaction client (opcional)
   * @returns WKT da geometria do território
   */
  async getTerritoryWKT(
    territoryId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<string> {
    const client = tx || this.prisma;
    const result = await client.$queryRaw(Prisma.sql`
      SELECT ST_AsText(geometry) as wkt
      FROM territories
      WHERE id = ${territoryId}::uuid
    `) as any[];

    if (!result || result.length === 0) {
      throw new Error(`Território ${territoryId} não encontrado`);
    }

    return result[0].wkt;
  }

  /**
   * Atualiza a geometria e área de um território
   * 
   * @param territoryId - ID do território
   * @param wkt - Nova geometria WKT
   * @param tx - Transaction client (opcional)
   */
  async updateTerritoryGeometry(
    territoryId: string,
    wkt: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx || this.prisma;
    await client.$executeRaw(Prisma.sql`
      UPDATE territories
      SET 
        geometry = ST_GeomFromText(${wkt}::text, 4326),
        area = ST_Area(ST_Transform(ST_GeomFromText(${wkt}::text, 4326), 3857)),
        "updatedAt" = NOW()
      WHERE id = ${territoryId}::uuid
    `);
  }

  /**
   * Conquista um território criando um polígono simples
   * 
   * IMPORTANTE: O polígono WKT já deve estar fechado e processado.
   * Este método apenas cria o território e a corrida associada.
   * 
   * @param userId - ID do usuário
   * @param polygonWKT - Polígono WKT já fechado
   * @param path - Array de pontos GPS da corrida
   * @param runData - Dados da corrida já calculados
   * @returns Objeto com run e territoryId criados
   */
  async conquerTerritory(
    userId: string,
    polygonWKT: string,
    path: any,
    runData: {
      startTime: Date;
      endTime: Date;
      distance: number;
      duration: number;
      averagePace: number;
      calories?: number;
    },
  ) {
      return this.prisma.$transaction(async (tx) => {
      // Criar território
      const territory = await tx.$queryRaw(Prisma.sql`
        INSERT INTO territories (id, "userId", "userName", "userColor", "areaName", area, geometry, "createdAt", "updatedAt", "capturedAt")
        SELECT 
          gen_random_uuid(),
          ${userId}::uuid,
          (SELECT name FROM users WHERE id = ${userId}::uuid),
          (SELECT color FROM users WHERE id = ${userId}::uuid),
          'Território Conquistado',
          ST_Area(ST_Transform(ST_GeomFromText(${polygonWKT}::text, 4326), 3857)),
          ST_Transform(ST_GeomFromText(${polygonWKT}::text, 4326), 3857),
          NOW(),
          NOW(),
          NOW()
        RETURNING id, area
      `) as any[];

      const territoryId = territory[0].id;

      // Criar corrida
      const run = await tx.run.create({
        data: {
          userId,
          startTime: runData.startTime,
          endTime: runData.endTime,
          distance: runData.distance,
          duration: runData.duration,
          averagePace: runData.averagePace,
          calories: runData.calories,
          territoryId,
        },
      });

      // Salvar pontos do trajeto
      if (path && Array.isArray(path)) {
        await tx.runPathPoint.createMany({
          data: path.map((point: any, index: number) => ({
            runId: run.id,
            latitude: point.latitude,
            longitude: point.longitude,
            timestamp: point.timestamp
              ? new Date(point.timestamp)
              : new Date(runData.startTime.getTime() + index * 1000),
            sequenceOrder: index,
          })),
        });
      }

      return { run, territoryId };
    });
  }

  /**
   * Busca todos os territórios no banco de dados, opcionalmente filtrando por bounding box
   * 
   * @param bbox - Opcional: caixa delimitadora {minLng, minLat, maxLng, maxLat}
   * @returns Array de territórios com dados do dono e geometria em GeoJSON
   */
  async findAllTerritories(bbox?: {
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
  }) {
    const query = Prisma.sql`
      SELECT 
        t.id,
        t."areaName",
        t.area as "areaM2",
        t."capturedAt",
        u.id as "userId",
        u.name,
        u.username,
        u.color,
        u."photoUrl",
        ST_AsGeoJSON(t.geometry)::text as geometry
      FROM territories t
      JOIN users u ON t."userId" = u.id
    `;

    if (bbox) {
      const territories = await this.prisma.$queryRaw(Prisma.sql`
        ${query}
        WHERE ST_Intersects(
          t.geometry,
          ST_MakeEnvelope(${bbox.minLng}, ${bbox.minLat}, ${bbox.maxLng}, ${bbox.maxLat}, 4326)
        )
        ORDER BY t."capturedAt" DESC
      `);
      return territories;
    } else {
      const territories = await this.prisma.$queryRaw(Prisma.sql`
        ${query}
        ORDER BY t."capturedAt" DESC
      `);
      return territories;
    }
  }

  /**
   * Cria uma corrida vinculada a um território
   * 
   * @param data - Dados da corrida já calculados
   * @param territoryId - ID do território
   * @param tx - Transaction client (opcional)
   * @returns Objeto Run criado
   */
  async createRunWithTerritory(
    data: {
      userId: string;
      path: Array<{ latitude: number; longitude: number; timestamp?: string }>;
      startTime: Date;
      endTime: Date;
      distance: number;
      duration: number;
      averagePace: number;
      maxSpeed?: number;
      elevationGain?: number;
      calories?: number;
    },
    territoryId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx || this.prisma;

    const run = await client.run.create({
      data: {
        userId: data.userId,
        startTime: data.startTime,
        endTime: data.endTime,
        distance: data.distance,
        duration: data.duration,
        averagePace: data.averagePace,
        maxSpeed: data.maxSpeed,
        elevationGain: data.elevationGain,
        calories: data.calories,
        territoryId,
      },
    });

    // Salvar pontos do trajeto
    if (data.path && data.path.length > 0) {
      await client.runPathPoint.createMany({
        data: data.path.map((point: any, index: number) => ({
          runId: run.id,
          latitude: point.latitude,
          longitude: point.longitude,
          timestamp: point.timestamp
            ? new Date(point.timestamp)
            : new Date(data.startTime.getTime() + index * 1000),
          sequenceOrder: index,
        })),
      });
    }

    return run;
  }
}
