import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Service responsável por operações PostGIS complexas de processamento de territórios.
 * 
 * Contém lógica de negócio para:
 * - Fusão de territórios do mesmo usuário
 * - Recorte de territórios de outros usuários
 * - Limpeza de fragmentos pequenos
 */
@Injectable()
export class TerritoryProcessingService {
  private readonly logger = new Logger(TerritoryProcessingService.name);

  /**
   * Identifica territórios do mesmo usuário que devem ser fundidos
   * 
   * @param tx - Prisma transaction client
   * @param userId - ID do usuário
   * @param territoryId - ID do território atual
   * @param territoryWKT - Geometria WKT do território atual
   * @returns Array de IDs dos territórios a serem fundidos
   */
  async findTerritoriesToMerge(
    tx: Prisma.TransactionClient,
    userId: string,
    territoryId: string,
    territoryWKT: string,
  ): Promise<Array<{ id: string }>> {
    const myTerritories = await tx.$queryRaw(Prisma.sql`
      SELECT id
      FROM territories
      WHERE ST_Intersects(geometry, ST_GeomFromText(${territoryWKT}::text, 4326))
      AND "userId" = ${userId}::uuid
      AND id != ${territoryId}::uuid
    `) as any[];

    return myTerritories || [];
  }

  /**
   * Funde territórios do mesmo usuário em um único território maior
   * 
   * @param tx - Prisma transaction client
   * @param territoryId - ID do território principal (que será atualizado)
   * @param territoryWKT - Geometria WKT inicial do território
   * @param territoriesToMerge - Array de IDs dos territórios a serem fundidos
   * @returns Nova geometria WKT do território fundido e área recalculada
   */
  async mergeTerritories(
    tx: Prisma.TransactionClient,
    territoryId: string,
    territoryWKT: string,
    territoriesToMerge: Array<{ id: string }>,
  ): Promise<{ finalWKT: string; area: number } | null> {
    if (!territoriesToMerge || territoriesToMerge.length === 0) {
      return null;
    }

    // Buscar geometrias WKT de todos os territórios antigos que serão fundidos
    const oldTerritoryIds = territoriesToMerge.map(t => t.id);
    const oldGeometries = oldTerritoryIds.length > 0
      ? await tx.$queryRaw(Prisma.sql`
          SELECT id, ST_AsText(geometry) as wkt
          FROM territories
          WHERE id = ANY(${oldTerritoryIds}::uuid[])
        `) as any[]
      : [];

    // Inicia a geometria de união com o território atual
    let unionGeometry = territoryWKT;

    // Itera sobre cada território antigo, unindo com a geometria acumulada
    for (const oldTerritory of oldGeometries) {
      try {
        const unionResult = await tx.$queryRaw(Prisma.sql`
          WITH unioned AS (
            SELECT ST_MakeValid(
              ST_Union(
                ST_GeomFromText(${unionGeometry}::text, 4326),
                ST_GeomFromText(${oldTerritory.wkt}::text, 4326)
              )
            ) AS geom
          ),
          dumped AS (
            SELECT (ST_Dump(ST_CollectionExtract(geometria.geom, 3))).geom AS geom
            FROM unioned AS geometria
          ),
          largest AS (
            SELECT geom
            FROM dumped
            ORDER BY ST_Area(geom::geography) DESC
            LIMIT 1
          )
          SELECT ST_AsText(geom) as union_wkt
          FROM largest
        `) as any[];

        if (unionResult && unionResult.length > 0 && unionResult[0].union_wkt) {
          unionGeometry = unionResult[0].union_wkt;
        }
      } catch (unionError: any) {
        this.logger.warn(`⚠️ Erro ao unir território ${oldTerritory.id}: ${unionError.message}`);
      }
    }

    // Calcular geometria final e área
    const updatedResult = await tx.$queryRaw(Prisma.sql`
      WITH final_geom AS (
        SELECT ST_MakeValid(ST_GeomFromText(${unionGeometry}::text, 4326)) AS geom
      ),
      dumped AS (
        SELECT (ST_Dump(ST_CollectionExtract(geom, 3))).geom AS geom
        FROM final_geom
      ),
      largest AS (
        SELECT geom
        FROM dumped
        ORDER BY ST_Area(geom::geography) DESC
        LIMIT 1
      )
      SELECT 
        ST_AsText(geom) as final_wkt,
        ST_Area(geom::geography) as area
      FROM largest
    `) as any[];

    if (updatedResult && updatedResult.length > 0) {
      // Atualizar território principal
      await tx.$executeRaw(Prisma.sql`
        UPDATE territories
        SET 
          geometry = ST_GeomFromText(${updatedResult[0].final_wkt}::text, 4326),
          area = ${parseFloat(updatedResult[0].area)},
          "updatedAt" = NOW()
        WHERE id = ${territoryId}::uuid
      `);

      // Deletar territórios antigos
      for (const oldTerritory of oldGeometries) {
        try {
          await tx.territory.delete({ where: { id: oldTerritory.id } });
        } catch (deleteError: any) {
          this.logger.warn(`⚠️ Erro ao deletar território ${oldTerritory.id}: ${deleteError.message}`);
        }
      }

      return {
        finalWKT: updatedResult[0].final_wkt,
        area: parseFloat(updatedResult[0].area),
      };
    }

    return null;
  }

  /**
   * Identifica territórios de outros usuários que serão recortados
   * 
   * @param tx - Prisma transaction client
   * @param userId - ID do usuário atual
   * @param territoryId - ID do território atual
   * @param territoryWKT - Geometria WKT do território atual
   * @returns Array de territórios inimigos que serão recortados
   */
  async findEnemyTerritoriesToCut(
    tx: Prisma.TransactionClient,
    userId: string,
    territoryId: string,
    territoryWKT: string,
  ): Promise<Array<{ id: string; userId: string; userName: string; userColor: string }>> {
    const affectedTerritories = await tx.$queryRaw(Prisma.sql`
      SELECT id, "userId", "userName", "userColor"
      FROM territories
      WHERE ST_Intersects(geometry, ST_GeomFromText(${territoryWKT}::text, 4326))
      AND "userId" != ${userId}::uuid
      AND id != ${territoryId}::uuid
    `) as any[];

    return affectedTerritories || [];
  }

  /**
   * Recorta (rouba) área de territórios de outros usuários
   * 
   * @param tx - Prisma transaction client
   * @param enemyTerritory - Território inimigo a ser recortado
   * @param newTerritoryWKT - Geometria WKT do novo território (área a remover)
   * @returns Número de fragmentos criados (incluindo o atualizado)
   */
  async cutEnemyTerritory(
    tx: Prisma.TransactionClient,
    enemyTerritory: { id: string; userId: string; userName: string; userColor: string },
    newTerritoryWKT: string,
  ): Promise<number> {
    // Busca geometria WKT do território inimigo
    const enemyGeometryResult = await tx.$queryRaw(Prisma.sql`
      SELECT ST_AsText(geometry) as wkt
      FROM territories
      WHERE id = ${enemyTerritory.id}::uuid
    `) as any[];

    if (!enemyGeometryResult || enemyGeometryResult.length === 0) {
      return 0;
    }

    const enemyWKT = enemyGeometryResult[0].wkt;

    // Calcular diferença geométrica (pode gerar múltiplos fragmentos)
    const differenceResult = await tx.$queryRaw(Prisma.sql`
      WITH diffed AS (
        SELECT ST_MakeValid(
          ST_Difference(
            ST_MakeValid(ST_GeomFromText(${enemyWKT}::text, 4326)),
            ST_GeomFromText(${newTerritoryWKT}::text, 4326)
          )
        ) AS geom
      ),
      dumped AS (
        SELECT 
          (ST_Dump(ST_CollectionExtract(geom, 3))).geom AS geom,
          ST_Area((ST_Dump(ST_CollectionExtract(geom, 3))).geom::geography) AS area
        FROM diffed
      ),
      valid_fragments AS (
        SELECT 
          ST_AsText(geom) as diff_wkt,
          area
        FROM dumped
        WHERE area >= 5
        ORDER BY area DESC
      )
      SELECT diff_wkt, area FROM valid_fragments
    `) as any[];

    // Processar todos os fragmentos válidos
    if (differenceResult && differenceResult.length > 0) {
      // Primeiro fragmento: atualizar o território original
      const firstFragment = differenceResult[0];
      const firstArea = parseFloat(firstFragment.area);

      await tx.$executeRaw(Prisma.sql`
        UPDATE territories
        SET 
          geometry = ST_GeomFromText(${firstFragment.diff_wkt}::text, 4326),
          area = ${firstArea},
          "updatedAt" = NOW()
        WHERE id = ${enemyTerritory.id}::uuid
      `);

      // Fragmentos restantes: criar novos territórios
      if (differenceResult.length > 1) {
        for (let i = 1; i < differenceResult.length; i++) {
          const fragment = differenceResult[i];
          const fragmentArea = parseFloat(fragment.area);

          await tx.$executeRaw(Prisma.sql`
            INSERT INTO territories (
              id, "userId", "userName", "userColor", "areaName", 
              area, geometry, "createdAt", "updatedAt", "capturedAt"
            )
            VALUES (
              gen_random_uuid(),
              ${enemyTerritory.userId}::uuid,
              ${enemyTerritory.userName || 'Usuário'},
              ${enemyTerritory.userColor || '#FF0000'},
              'Território Conquistado',
              ${fragmentArea},
              ST_GeomFromText(${fragment.diff_wkt}::text, 4326),
              NOW(),
              NOW(),
              NOW()
            )
          `);
        }
      }

      return differenceResult.length;
    } else {
      // Território totalmente roubado ou sem fragmentos válidos
      await tx.$executeRaw(Prisma.sql`
        DELETE FROM territories WHERE id = ${enemyTerritory.id}::uuid
      `);
      return 0;
    }
  }

  /**
   * Limpa fragmentos inválidos e pequenos
   * 
   * Remove territórios com:
   * - Geometrias vazias
   * - Área menor que 5m²
   * - Geometrias inválidas
   * 
   * @param tx - Prisma transaction client
   * @returns Número de fragmentos removidos
   */
  async cleanupFragments(tx: Prisma.TransactionClient): Promise<number> {
    const deletedFragments = await tx.$executeRaw(Prisma.sql`
      DELETE FROM territories
      WHERE ST_IsEmpty(geometry)
         OR ST_Area(geometry::geography) < 5
         OR NOT ST_IsValid(geometry)
      RETURNING id
    `);

    return deletedFragments as number;
  }
}
