import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as turf from '@turf/turf';

/**
 * Repository responsável por todas as operações de banco de dados relacionadas a corridas e territórios.
 * Utiliza Prisma para operações básicas e SQL raw para operações PostGIS complexas.
 */
@Injectable()
export class RunsRepository {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Salva uma corrida simples (sem território)
     * 
     * Usado quando o usuário faz uma corrida de ponto A até ponto B sem fechar um polígono.
     * Este tipo de corrida não conquista território e não gera XP adicional.
     * 
     * @param data - Dados da corrida incluindo trajeto, tempo, distância, ritmo, etc.
     * @returns Objeto com informações da corrida criada (sem território associado)
     */
    async saveSimpleRun(data: {
        userId: string;
        path: Array<{ latitude: number; longitude: number; timestamp?: string }>;
        startTime: Date;
        endTime?: Date;
        distance?: number;
        duration?: number;
        averagePace?: number;
        maxSpeed?: number;
        elevationGain?: number;
        calories?: number;
        caption?: string;
    }) {
        // Usa transação para garantir atomicidade (tudo ou nada)
        return this.prisma.client.$transaction(async (tx) => {
            // ===== CALCULAR DISTÂNCIA =====
            // Se não fornecida, calcula somando a distância entre cada par de pontos consecutivos
            let distance = data.distance;
            if (!distance && data.path.length > 1) {
                distance = 0;
                // Itera sobre todos os pontos do trajeto, calculando distância entre pontos adjacentes
                for (let i = 0; i < data.path.length - 1; i++) {
                    // Cria pontos Turf.js para cálculo de distância geodésica (considera curvatura da Terra)
                    const p1 = turf.point([data.path[i].longitude, data.path[i].latitude]);
                    const p2 = turf.point([data.path[i + 1].longitude, data.path[i + 1].latitude]);
                    // Soma a distância em metros
                    distance += turf.distance(p1, p2, { units: 'meters' });
                }
            }

            // ===== CALCULAR DURAÇÃO =====
            // Se não fornecida, calcula baseado na diferença entre timestamp do primeiro e último ponto
            let duration = data.duration;
            if (!duration && data.path.length > 1) {
                const firstPoint = data.path[0];
                const lastPoint = data.path[data.path.length - 1];
                // Usa timestamp dos pontos se disponível, senão usa startTime/endTime do DTO
                const startTimestamp = firstPoint?.timestamp ? new Date(firstPoint.timestamp) : data.startTime;
                const endTimestamp = lastPoint?.timestamp ? new Date(lastPoint.timestamp) : (data.endTime || new Date());
                // Calcula duração em segundos
                duration = Math.floor((endTimestamp.getTime() - startTimestamp.getTime()) / 1000);
            }

            // ===== CALCULAR RITMO MÉDIO =====
            // Se não fornecido, calcula baseado em distância e duração
            // Fórmula: (duração em minutos) / (distância em km) = min/km
            let averagePace = data.averagePace;
            if (!averagePace && distance && distance > 0 && duration && duration > 0) {
                // Converte duração para minutos e distância para km
                averagePace = (duration / 60) / (distance / 1000); // Resultado: min/km
            }

            // ===== DETERMINAR STARTTIME E ENDTIME =====
            // Garante que startTime e endTime estejam sempre definidos
            const startTime = data.startTime;
            const lastPoint = data.path.length > 0 ? data.path[data.path.length - 1] : null;
            // Usa endTime fornecido, ou timestamp do último ponto, ou calcula baseado em startTime + duration
            const endTime = data.endTime || (lastPoint && lastPoint.timestamp
                ? new Date(lastPoint.timestamp)
                : new Date(startTime.getTime() + (duration || 0) * 1000));

            // ===== CRIAR REGISTRO DA CORRIDA NO BANCO =====
            // Cria o registro principal da corrida (tabela 'runs')
            // territoryId é null pois esta é uma corrida simples sem território
            const run = await tx.run.create({
                data: {
                    userId: data.userId,
                    startTime,
                    endTime,
                    distance: distance || 0,
                    duration: duration || 0,
                    averagePace: averagePace || 0,
                    maxSpeed: data.maxSpeed,
                    elevationGain: data.elevationGain,
                    calories: data.calories,
                    territoryId: null, // Sem território

                    caption: data.caption || null,
                },
            });

            // ===== SALVAR PONTOS DO TRAJETO =====
            // Armazena cada ponto GPS do trajeto na tabela 'run_path_points'
            // Isso permite visualizar a rota completa da corrida no mapa
            if (data.path && data.path.length > 0) {
                await tx.runPathPoint.createMany({
                    data: data.path.map((point: any, index: number) => ({
                        runId: run.id, // Vincula o ponto à corrida criada
                        latitude: point.latitude,
                        longitude: point.longitude,
                        // Usa timestamp do ponto se disponível, senão gera timestamp progressivo (1 segundo por ponto)
                        timestamp: point.timestamp ? new Date(point.timestamp) : new Date(startTime.getTime() + (index * 1000)),
                        sequenceOrder: index, // Ordem dos pontos no trajeto (0, 1, 2, ...)
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
     * Este método é mais simples que saveSimpleRun e não calcula valores automaticamente.
     * Usado principalmente para compatibilidade com código antigo.
     * 
     * @param userId - ID do usuário que fez a corrida
     * @param path - Array de pontos GPS do trajeto
     * @param runData - Dados adicionais da corrida (distância, duração, etc.)
     * @returns Objeto Run criado
     */
    async saveRun(userId: string, path: any, runData: any = {}) {
        // ===== CRIAR REGISTRO DA CORRIDA =====
        // Cria corrida com os dados fornecidos (sem validações/cálculos adicionais)
        const run = await this.prisma.client.run.create({
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

        // ===== SALVAR PONTOS DO TRAJETO =====
        // Armazena pontos GPS na tabela run_path_points
        if (path && Array.isArray(path)) {
            await this.prisma.client.runPathPoint.createMany({
                data: path.map((point: any, index: number) => ({
                    runId: run.id,
                    latitude: point.latitude,
                    longitude: point.longitude,
                    // Timestamp do ponto ou timestamp calculado progressivamente
                    timestamp: point.timestamp ? new Date(point.timestamp) : new Date(run.startTime.getTime() + (index * 1000)),
                    sequenceOrder: index, // Ordem dos pontos
                })),
            });
        }

        return run;
    }

    /**
     * Conquista um território criando um polígono a partir de uma corrida que fechou circuito
     * 
     * Este método é usado quando uma corrida simples fecha um circuito (primeiro e último ponto próximos).
     * Cria tanto o território quanto a corrida associada em uma transação atômica.
     * 
     * @param userId - ID do usuário que conquistou o território
     * @param polygonWKT - Polígono em formato WKT (Well-Known Text) já fechado
     * @param path - Array de pontos GPS da corrida original
     * @returns Objeto com run e territoryId criados
     */
    async conquerTerritory(userId: string, polygonWKT: string, path: any) {
        // ===== TRANSAÇÃO ATÔMICA =====
        // Tudo deve ser criado junto: território + corrida + pontos
        return this.prisma.client.$transaction(async (tx) => {
            // ===== CRIAR TERRITÓRIO USANDO POSTGIS =====
            // Usa SQL raw para operações PostGIS complexas
            // O polígono já vem fechado em formato WKT (Well-Known Text)
            const territory = await tx.$queryRawUnsafe(`
                INSERT INTO territories (id, "userId", "userName", "userColor", "areaName", area, geometry, "createdAt", "updatedAt", "capturedAt")
                SELECT 
                    gen_random_uuid(), -- Gera UUID único
                    $1, -- userId fornecido
                    (SELECT name FROM users WHERE id = $1), -- Busca nome do usuário
                    (SELECT color FROM users WHERE id = $1), -- Busca cor do usuário
                    'Território Conquistado', -- Nome padrão
                    -- ST_Area calcula área em metros quadrados (3857 = Web Mercator, unidades em metros)
                    ST_Area(ST_Transform(ST_GeomFromText($2, 4326), 3857)),
                    -- ST_Transform converte de WGS84 (4326) para Web Mercator (3857) para armazenamento
                    ST_Transform(ST_GeomFromText($2, 4326), 3857),
                    NOW(), -- Data de criação
                    NOW(), -- Data de atualização
                    NOW()  -- Data de captura
                RETURNING id, area
            `, userId, polygonWKT) as any[];

            const territoryId = territory[0].id;

            // ===== CALCULAR ESTATÍSTICAS DA CORRIDA =====
            // Determina startTime e endTime baseado nos pontos GPS
            const startTime = path[0]?.timestamp ? new Date(path[0].timestamp) : new Date();
            const endTime = path[path.length - 1]?.timestamp ? new Date(path[path.length - 1].timestamp) : new Date();
            // Calcula distância total somando distâncias entre pontos consecutivos
            const distance = this.calculateDistance(path);
            // Calcula duração em segundos
            const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
            // Calcula ritmo médio: (duração em minutos) / (distância em km) = min/km
            const averagePace = distance > 0 ? (duration / 60) / (distance / 1000) : 0;

            // ===== CRIAR REGISTRO DA CORRIDA =====
            // Cria corrida vinculada ao território conquistado
            const run = await tx.run.create({
                data: {
                    userId,
                    startTime,
                    endTime,
                    distance,
                    duration,
                    averagePace,
                    territoryId, // Vincula a corrida ao território criado
                },
            });

            // ===== SALVAR PONTOS DO TRAJETO =====
            // Armazena cada ponto GPS para visualização da rota
            if (path && Array.isArray(path)) {
                await tx.runPathPoint.createMany({
                    data: path.map((point: any, index: number) => ({
                        runId: run.id,
                        latitude: point.latitude,
                        longitude: point.longitude,
                        timestamp: point.timestamp ? new Date(point.timestamp) : new Date(startTime.getTime() + (index * 1000)),
                        sequenceOrder: index,
                    })),
                });
            }

            return { run, territoryId };
        });
    }

    /**
     * Cria um território completo a partir de um boundary (LineString) fornecido pelo frontend
     * 
     * Este é o método principal para criação de territórios. Ele:
     * 1. Converte o boundary (array de pontos) para LineString WKT
     * 2. Detecta se é circuito fechado (primeiro e último ponto < 30m)
     * 3. Aplica buffer de 10m e fecha o polígono
     * 4. Calcula área usando PostGIS
     * 5. Funde territórios do mesmo usuário próximos
     * 6. Recorta (rouba) áreas de territórios de outros usuários
     * 7. Limpa fragmentos pequenos (< 5m²)
     * 8. Cria a corrida associada e salva os pontos GPS
     * 
     * @param data - Dados do território incluindo boundary, nome, cor, etc.
     * @returns Objeto com informações do território criado incluindo área calculada
     */
    async createTerritoryWithBoundary(data: {
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
        // ===== TRANSAÇÃO ATÔMICA (60s timeout) =====
        // Operações PostGIS podem ser lentas, então aumentamos o timeout
        return this.prisma.client.$transaction(async (tx) => {
            console.log('🛠️  Processando território...');
            console.log(`   📍 ${data.boundary.length} pontos recebidos (LineString)`);

            // ===== PASSO 1: CONVERTER BOUNDARY PARA WKT LINESTRING =====
            // Converte array de pontos [{lat, lng}, ...] para formato WKT: LINESTRING(lng lat, lng lat, ...)
            // IMPORTANTE: Preservar TODOS os pontos na ordem original (eles seguem a rota pelas ruas)
            const lineStringWKT = this.createLineStringWKT(data.boundary);
            console.log('   ✅ LineString WKT criada');

            // ===== PREPARAR DATAS =====
            const capturedAt = data.capturedAt ? new Date(data.capturedAt) : new Date();
            const createdAt = new Date();

            // ===== PASSO 2: DETECTAR CIRCUITO FECHADO =====
            // Verifica se o primeiro e último ponto estão próximos (< 30m)
            // Se estiverem, é um circuito fechado e o polígono será fechado antes de aplicar buffer
            // Se não estiverem, é um rastro aberto (aplica buffer diretamente na LineString)
            const startPoint = data.boundary[0];
            const endPoint = data.boundary[data.boundary.length - 1];
            // Cria pontos Turf.js para cálculo de distância geodésica
            const start = turf.point([startPoint.longitude, startPoint.latitude]);
            const end = turf.point([endPoint.longitude, endPoint.latitude]);
            const distanceBetweenPoints = turf.distance(start, end, { units: 'meters' });

            // Se distância < 30m, considera circuito fechado (tolerância para imprecisão do GPS)
            const isClosedLoop = distanceBetweenPoints <= 30;
            console.log(`   📏 Distância entre primeiro e último ponto: ${distanceBetweenPoints.toFixed(2)}m`);
            console.log(`   🔄 Circuito ${isClosedLoop ? 'FECHADO' : 'ABERTO'} (limite: 30m)`);

            let territoryId: string | null = null;
            let calculatedArea: number = 0;
            let savedTerritory: any;

            try {
                // ===== PASSO 3: CRIAR POLÍGONO BUFFERIZADO E CALCULAR ÁREA =====
                // Esta query complexa faz tudo em uma única operação:
                // 1. Converte LineString WKT para geometria PostGIS
                // 2. Detecta se é circuito fechado e fecha o polígono se necessário
                // 3. Aplica buffer de 10m ao redor da linha/ polígono
                // 4. Calcula área em metros quadrados
                // 5. Valida a geometria (ST_MakeValid) para evitar erros
                // 
                // IMPORTANTE: Usar ST_MakeValid sempre para evitar geometrias inválidas que quebrariam operações futuras
                const territoryResult = await tx.$queryRawUnsafe(`
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
                    -- CTE 1: Converte LineString WKT para geometria PostGIS e transforma para Web Mercator
                    WITH line_geom AS (
                        SELECT ST_MakeValid(
                            ST_Transform(
                                ST_GeomFromText($5, 4326), -- LineString em WGS84 (lat/lng)
                                3857  -- Transforma para Web Mercator (unidades em metros para cálculos precisos)
                            )
                        ) AS geom
                    ),
                    -- CTE 2: Detecta circuito fechado e fecha o polígono se necessário
                    closed_geom AS (
                        SELECT 
                            CASE 
                                -- Se distância entre primeiro e último ponto <= 30m, é circuito fechado
                                -- ST_Distance em Web Mercator já retorna em metros (precisão melhor que WGS84)
                                WHEN ST_Distance(
                                    ST_StartPoint(geom), -- Primeiro ponto da LineString
                                    ST_EndPoint(geom)    -- Último ponto da LineString
                                ) <= 30 THEN
                                    -- FECHA O POLÍGONO: Adiciona o primeiro ponto ao final da LineString
                                    -- ST_AddPoint adiciona ponto, ST_MakePolygon fecha o anel
                                    ST_MakeValid(
                                        ST_MakePolygon(
                                            ST_AddPoint(geom, ST_StartPoint(geom))
                                        )
                                    )
                                ELSE
                                    -- Mantém como LineString (rastro aberto) - buffer será aplicado depois
                                    geom
                            END AS geom
                        FROM line_geom
                    ),
                    -- CTE 3: Aplica buffer de 10m ao redor da linha/ polígono
                    buffered_geom AS (
                        SELECT ST_MakeValid(
                            ST_Transform(
                                ST_Buffer(
                                    (SELECT geom FROM closed_geom), -- Geometria da CTE anterior
                                    10,  -- 10 metros de buffer (expande a linha para criar área)
                                    'endcap=flat join=mitre'  -- endcap=flat: extremidades retas; join=mitre: esquinas vivas
                                ),
                                4326  -- Transforma de volta para WGS84 para armazenamento no banco
                            )
                        ) AS geom
                    )
                    -- SELECT FINAL: Insere território com todos os dados calculados
                    SELECT 
                        gen_random_uuid(), -- Gera UUID único
                        $1, -- userId
                        $2, -- userName
                        $3, -- userColor
                        $4, -- areaName
                        -- Calcula área do polígono bufferizado em METROS QUADRADOS
                        -- Transforma de volta para Web Mercator (3857) para cálculo preciso de área
                        ST_Area(
                            ST_Transform(
                                (SELECT geom FROM buffered_geom),
                                3857 -- Web Mercator para área em m²
                            )
                        ),
                        -- Armazena a geometria final (polígono bufferizado) em WGS84
                        (SELECT geom FROM buffered_geom),
                        $6, -- createdAt
                        $6, -- updatedAt (mesmo valor de createdAt na criação)
                        $7  -- capturedAt
                    RETURNING 
                        id, -- ID do território criado
                        area, -- Área calculada em m²
                        ST_AsGeoJSON(geometry)::json as geometry_geojson -- GeoJSON para retorno ao frontend
                `,
                    data.userId,
                    data.userName,
                    data.userColor,
                    data.areaName,
                    lineStringWKT,
                    createdAt,
                    capturedAt
                ) as any[];

                savedTerritory = territoryResult[0];
                territoryId = savedTerritory.id;
                calculatedArea = parseFloat(savedTerritory.area);

                console.log('✅ Território salvo com sucesso!');
                console.log(`   - ID: ${territoryId}`);
                console.log(`   - Área calculada: ${calculatedArea.toFixed(2)} m²`);
                console.log(`   - Tipo retornado: ${savedTerritory.geometry_geojson.type} (Polígono bufferizado)`);

            } catch (error: any) {
                console.error('❌ Erro ao criar território inicial:', error.message);
                throw new InternalServerErrorException('Erro ao criar território inicial: ' + error.message);
            }

            // ===== PASSO 4: OBTER GEOMETRIA DO TERRITÓRIO PARA OPERAÇÕES SUBSEQUENTES =====
            // Converte a geometria PostGIS de volta para WKT (Well-Known Text) para usar em outras queries
            // Necessário para operações de fusão e recorte que usam ST_GeomFromText
            const newTerritoryWKTResult = await tx.$queryRawUnsafe(`
                SELECT ST_AsText(geometry) as wkt
                FROM territories
                WHERE id = $1
            `, territoryId) as any[];

            if (!newTerritoryWKTResult || newTerritoryWKTResult.length === 0) {
                throw new Error('Não foi possível obter geometria do território criado');
            }

            let currentTerritoryGeometryWKT = newTerritoryWKTResult[0].wkt;

            try {
                // ===== PASSO 4.1: IDENTIFICAR TERRITÓRIOS DO MESMO USUÁRIO PARA FUSÃO =====
                // Busca territórios existentes que intersectam com o novo território
                // Se houver sobreposição, os territórios devem ser fundidos em um único território maior
                // Isso evita fragmentação de territórios do mesmo jogador
                const myTerritories = await tx.$queryRawUnsafe(`
                    SELECT id
                    FROM territories
                    WHERE ST_Intersects(geometry, ST_GeomFromText($1, 4326)) -- Detecta interseção geométrica
                    AND "userId" = $2 -- Apenas territórios do mesmo usuário
                    AND id != $3 -- Exclui o território recém-criado
                `, currentTerritoryGeometryWKT, data.userId, territoryId) as any[];

                // ===== PASSO 4.2: FUSIONAR TERRITÓRIOS DO MESMO USUÁRIO =====
                // Se houver sobreposição, une todos os territórios em um único polígono maior
                // Isso melhora a performance e evita fragmentação visual no mapa
                if (myTerritories && myTerritories.length > 0) {
                    console.log(`   🔗 Encontrados ${myTerritories.length} território(s) do mesmo usuário para fusão`);

                    // Buscar geometrias WKT de todos os territórios antigos que serão fundidos
                    const oldTerritoryIds = myTerritories.map(t => `'${t.id}'`).join(',');
                    const oldGeometries = await tx.$queryRawUnsafe(`
                        SELECT id, ST_AsText(geometry) as wkt
                        FROM territories
                        WHERE id IN (${oldTerritoryIds})
                    `) as any[];

                    // Inicia a geometria de união com o território atual
                    // Itera sobre territórios antigos, unindo um por um
                    let unionGeometry = currentTerritoryGeometryWKT;

                    // Itera sobre cada território antigo, unindo com a geometria acumulada
                    for (const oldTerritory of oldGeometries) {
                        try {
                            // ST_Union une duas geometrias em uma só
                            // ST_Dump separa MultiPolygon em polígonos individuais
                            // Seleciona o maior polígono (caso a união crie múltiplos fragmentos)
                            const unionResult = await tx.$queryRawUnsafe(`
                                WITH unioned AS (
                                    -- Une as duas geometrias em uma só (pode criar MultiPolygon)
                                    SELECT ST_MakeValid(
                                        ST_Union(
                                            ST_GeomFromText($1, 4326), -- Geometria acumulada
                                            ST_GeomFromText($2, 4326)  -- Território antigo a unir
                                        )
                                    ) AS geom
                                ),
                                dumped AS (
                                    -- ST_Dump separa coleções (MultiPolygon) em polígonos individuais
                                    -- ST_CollectionExtract(geom, 3) extrai apenas Polygon (tipo 3)
                                    SELECT (ST_Dump(ST_CollectionExtract(geometria.geom, 3))).geom AS geom
                                    FROM unioned AS geometria
                                ),
                                largest AS (
                                    -- Seleciona o maior polígono (caso haja fragmentos)
                                    -- geography:: para cálculo de área em m² precisa
                                    SELECT geom
                                    FROM dumped
                                    ORDER BY ST_Area(geom::geography) DESC
                                    LIMIT 1
                                )
                                SELECT ST_AsText(geom) as union_wkt
                                FROM largest
                            `, unionGeometry, oldTerritory.wkt) as any[];

                            if (unionResult && unionResult.length > 0 && unionResult[0].union_wkt) {
                                unionGeometry = unionResult[0].union_wkt;
                            }
                        } catch (unionError: any) {
                            console.warn(`   ⚠️ Erro ao unir território ${oldTerritory.id}: ${unionError.message}`);
                        }
                    }

                    // ===== ATUALIZAR TERRITÓRIO COM GEOMETRIA FUNDIDA =====
                    // Garante que o território final seja um Polygon único (não MultiPolygon)
                    // Isso é importante para operações PostGIS futuras e visualização no mapa
                    const updatedResult = await tx.$queryRawUnsafe(`
                        WITH final_geom AS (
                            -- Valida a geometria fundida
                            SELECT ST_MakeValid(ST_GeomFromText($1, 4326)) AS geom
                        ),
                        dumped AS (
                            -- Separa coleções em polígonos individuais (caso seja MultiPolygon)
                            SELECT (ST_Dump(ST_CollectionExtract(geom, 3))).geom AS geom
                            FROM final_geom
                        ),
                        largest AS (
                            -- Seleciona o maior polígono (descarta fragmentos pequenos)
                            SELECT geom
                            FROM dumped
                            ORDER BY ST_Area(geom::geography) DESC -- geography:: para área em m²
                            LIMIT 1
                        )
                        SELECT 
                            ST_AsText(geom) as final_wkt, -- WKT da geometria final
                            ST_Area(geom::geography) as area -- Área recalculada em m²
                        FROM largest
                    `, unionGeometry) as any[];

                    if (updatedResult && updatedResult.length > 0) {
                        await tx.$executeRawUnsafe(`
                            UPDATE territories
                            SET 
                                geometry = ST_GeomFromText($1, 4326),
                                area = $2
                            WHERE id = $3
                        `, updatedResult[0].final_wkt, parseFloat(updatedResult[0].area), territoryId);
                        currentTerritoryGeometryWKT = updatedResult[0].final_wkt; // Atualizar para próxima iteração
                    }

                    // ===== DELETAR TERRITÓRIOS ANTIGOS =====
                    // Remove os territórios que foram fundidos no território atual
                    // Eles não são mais necessários pois foram incorporados
                    for (const oldTerritory of oldGeometries) {
                        try {
                            await tx.territory.delete({ where: { id: oldTerritory.id } });
                        } catch (deleteError: any) {
                            console.warn(`   ⚠️ Erro ao deletar território ${oldTerritory.id}: ${deleteError.message}`);
                        }
                    }

                    console.log(`   ✅ ${myTerritories.length} território(s) fundidos com sucesso`);
                }

                // ===== PASSO 4.3: RECORTAR (ROUBAR) TERRITÓRIOS DE OUTROS USUÁRIOS =====
                // Se o novo território sobrepõe territórios de outros jogadores, a área sobreposta
                // é "roubada" e removida do território inimigo
                // Isso cria competição e estratégia: conquistar territórios grandes pode roubar áreas de outros
                const affectedTerritories = await tx.$queryRawUnsafe(`
                    SELECT id, "userId", "userName", "userColor"
                    FROM territories
                    WHERE ST_Intersects(geometry, ST_GeomFromText($1, 4326)) -- Detecta interseção
                    AND "userId" != $2 -- Apenas territórios de OUTROS usuários (inimigos)
                    AND id != $3 -- Exclui o território atual
                `, currentTerritoryGeometryWKT, data.userId, territoryId) as any[];

                if (affectedTerritories && affectedTerritories.length > 0) {
                    console.log(`   ⚔️ Recortando ${affectedTerritories.length} território(s) de outros usuários...`);

                    // ===== RECORTAR ÁREA SOBREPOSTA DE CADA TERRITÓRIO INIMIGO =====
                    // Para cada território inimigo que intersecta, subtrai a área sobreposta
                    // ST_Difference remove a interseção do território inimigo
                    // IMPORTANTE: Garantir que o resultado seja sempre um Polygon único (não fragmentado)
                    for (const enemyTerritory of affectedTerritories) {
                        try {
                            // Busca geometria WKT do território inimigo
                            const enemyGeometryResult = await tx.$queryRawUnsafe(`
                                SELECT ST_AsText(geometry) as wkt
                                FROM territories
                                WHERE id = $1
                            `, enemyTerritory.id) as any[];

                            if (enemyGeometryResult && enemyGeometryResult.length > 0) {
                                const enemyWKT = enemyGeometryResult[0].wkt;

                                // ===== CALCULAR DIFERENÇA GEOMÉTRICA (PODE GERAR MÚLTIPLOS FRAGMENTOS) =====
                                // ST_Difference subtrai a área sobreposta do território inimigo
                                // Quando um território é cortado ao meio, pode gerar 2 ou mais fragmentos válidos
                                // IMPORTANTE: Buscar TODOS os fragmentos válidos, não apenas o maior
                                const differenceResult = await tx.$queryRawUnsafe(`
                                    WITH diffed AS (
                                        -- ST_Difference subtrai geometria2 de geometria1
                                        -- Resultado: território inimigo sem a área sobreposta (pode ser MultiPolygon)
                                        SELECT ST_MakeValid(
                                            ST_Difference(
                                                ST_MakeValid(ST_GeomFromText($1, 4326)), -- Território inimigo original
                                                ST_GeomFromText($2, 4326) -- Território novo (área a remover)
                                            )
                                        ) AS geom
                                    ),
                                    dumped AS (
                                        -- Separa MultiPolygon em polígonos individuais (ST_Dump)
                                        -- ST_CollectionExtract(geom, 3) extrai apenas Polygon (tipo 3)
                                        SELECT 
                                            (ST_Dump(ST_CollectionExtract(geom, 3))).geom AS geom,
                                            ST_Area((ST_Dump(ST_CollectionExtract(geom, 3))).geom::geography) AS area
                                        FROM diffed
                                    ),
                                    valid_fragments AS (
                                        -- Filtra apenas fragmentos com área >= 5m² (ignora fragmentos insignificantes)
                                        SELECT 
                                            ST_AsText(geom) as diff_wkt,
                                            area
                                        FROM dumped
                                        WHERE area >= 5
                                        ORDER BY area DESC -- Ordena do maior para o menor
                                    )
                                    SELECT diff_wkt, area FROM valid_fragments
                                `, enemyWKT, currentTerritoryGeometryWKT) as any[];

                                // ===== PROCESSAR TODOS OS FRAGMENTOS VÁLIDOS =====
                                if (differenceResult && differenceResult.length > 0) {
                                    // Primeiro fragmento: atualizar o território original (maior fragmento)
                                    const firstFragment = differenceResult[0];
                                    const firstArea = parseFloat(firstFragment.area);

                                    await tx.$executeRawUnsafe(`
                                        UPDATE territories
                                        SET geometry = ST_GeomFromText($1, 4326), -- Nova geometria sem área roubada
                                            area = $2, -- Nova área recalculada
                                            "updatedAt" = NOW() -- Atualiza timestamp
                                        WHERE id = $3
                                    `, firstFragment.diff_wkt, firstArea, enemyTerritory.id);

                                    // Fragmentos restantes: criar novos territórios para cada um
                                    if (differenceResult.length > 1) {
                                        console.log(`   ✂️  Território ${enemyTerritory.id} dividido em ${differenceResult.length} fragmentos. Criando ${differenceResult.length - 1} novo(s) território(s)...`);

                                        for (let i = 1; i < differenceResult.length; i++) {
                                            const fragment = differenceResult[i];
                                            const fragmentArea = parseFloat(fragment.area);

                                            // Criar novo território para o fragmento
                                            await tx.$executeRawUnsafe(`
                                                INSERT INTO territories (
                                                    id, "userId", "userName", "userColor", "areaName", 
                                                    area, geometry, "createdAt", "updatedAt", "capturedAt"
                                                )
                                                VALUES (
                                                    gen_random_uuid(),
                                                    $1, -- userId do território original
                                                    $2, -- userName do território original
                                                    $3, -- userColor do território original
                                                    'Território Conquistado', -- Nome padrão
                                                    $4, -- área do fragmento
                                                    ST_GeomFromText($5, 4326), -- geometria do fragmento
                                                    NOW(),
                                                    NOW(),
                                                    NOW()
                                                )
                                            `,
                                                enemyTerritory.userId,
                                                enemyTerritory.userName || 'Usuário',
                                                enemyTerritory.userColor || '#FF0000',
                                                fragmentArea,
                                                fragment.diff_wkt
                                            );
                                        }

                                        console.log(`   ✅ ${differenceResult.length - 1} fragmento(s) criado(s) com sucesso`);
                                    }
                                } else {
                                    // Se a diferença resultar em geometria vazia/inválida (território totalmente roubado)
                                    // Ou todos os fragmentos forem muito pequenos (< 5m²)
                                    // Remove o território inimigo completamente
                                    await tx.$executeRawUnsafe(`
                                        DELETE FROM territories WHERE id = $1
                                    `, enemyTerritory.id);
                                    console.log(`   🗑️  Território ${enemyTerritory.id} totalmente removido (sem fragmentos válidos)`);
                                }
                            }
                        } catch (diffError: any) {
                            console.warn(`⚠️ Erro ao recortar território ${enemyTerritory.id}:`, diffError.message);
                            // Em caso de erro na diferença, tentar remover o território inimigo se a interseção for total
                            await tx.$executeRawUnsafe(`
                                DELETE FROM territories
                                WHERE id = $1 AND ST_Contains(ST_GeomFromText($2, 4326), ST_GeomFromText($3, 4326))
                            `, enemyTerritory.id, currentTerritoryGeometryWKT, enemyTerritory.wkt);
                        }
                    }
                    console.log(`   ✅ Área roubada de ${affectedTerritories.length} território(s) inimigo(s)`);
                } else {
                    console.log('   ✅ Nenhum território inimigo para recortar.');
                }

                // ===== PASSO 4.4: LIMPEZA DE FRAGMENTOS =====
                // Remove territórios inválidos que podem ter sido criados durante fusão/recorte:
                // - Geometrias vazias (ST_IsEmpty)
                // - Territórios muito pequenos (< 5m²) - insignificantes
                // - Geometrias inválidas (ST_IsValid = false) - causariam erros em operações futuras
                // Isso mantém o banco limpo e evita erros em visualizações do mapa
                const deletedFragments = await tx.$executeRawUnsafe(`
                    DELETE FROM territories
                    WHERE ST_IsEmpty(geometry) -- Geometria vazia
                       OR ST_Area(geometry::geography) < 5 -- Área menor que 5m²
                       OR NOT ST_IsValid(geometry) -- Geometria inválida
                    RETURNING id
                `);
                console.log(`   🧹 ${deletedFragments} fragmento(s) pequeno(s) removido(s)`);

            } catch (geoError: any) {
                console.error('❌ Erro nas operações de roubo/fusão de território:', geoError.message);
                // Reverter a transação ou lidar com o erro de forma apropriada
                throw new InternalServerErrorException('Erro nas operações de território: ' + geoError.message);
            }

            // ===== PASSO 5: CALCULAR DADOS DA CORRIDA =====
            // Calcula estatísticas da corrida se não fornecidas pelo frontend
            const distance = data.distance || this.calculateDistance(data.boundary);
            const duration = data.duration || this.calculateDuration(data.boundary);
            // Ritmo médio: (duração em minutos) / (distância em km) = min/km
            const averagePace = data.averagePace || (distance > 0 ? (duration / 60) / (distance / 1000) : 0);
            const startTime = data.capturedAt ? new Date(data.capturedAt) : new Date();
            // Estima endTime baseado em startTime + duration
            const endTime = new Date(startTime.getTime() + (duration * 1000));

            // ===== PASSO 6: CRIAR REGISTRO DA CORRIDA =====
            // Cria a corrida vinculada ao território conquistado
            // Isso permite ver o histórico de corridas e associar corridas a territórios
            const run = await tx.run.create({
                data: {
                    userId: data.userId,
                    startTime,
                    endTime,
                    distance,
                    duration,
                    averagePace,
                    maxSpeed: data.maxSpeed,
                    elevationGain: data.elevationGain,
                    calories: data.calories,
                    territoryId: territoryId || null,
                },
            });

            // ===== PASSO 7: SALVAR PONTOS GPS DO TRAJETO =====
            // Armazena TODOS os pontos GPS preservando a ordem original
            // Isso permite visualizar a rota completa da corrida no mapa
            // A ordem é importante: os pontos seguem a rota pelas ruas
            if (data.boundary && data.boundary.length > 0) {
                await tx.runPathPoint.createMany({
                    data: data.boundary.map((point: any, index: number) => ({
                        runId: run.id, // Vincula ponto à corrida
                        latitude: point.latitude,
                        longitude: point.longitude,
                        // Usa timestamp do ponto ou gera timestamp progressivo
                        timestamp: point.timestamp ? new Date(point.timestamp) : new Date(startTime.getTime() + (index * 1000)),
                        sequenceOrder: index, // Preserva ordem: 0, 1, 2, ...
                    })),
                });
            }

            // ===== PASSO 8: CONVERTER GEOJSON PARA FORMATO BOUNDARY =====
            // Converte o GeoJSON Polygon retornado do PostGIS de volta para formato boundary
            // (array de {latitude, longitude, timestamp})
            // Isso permite retornar ao frontend no mesmo formato que foi enviado
            const boundaryPoints = this.geoJsonToBoundaryPoints(savedTerritory.geometry_geojson);

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
        }, {
            timeout: 60000, // Timeout de 60 segundos para a transação
        });
    }

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
    private createLineStringWKT(points: Array<{ latitude: number; longitude: number }>): string {
        // Formato WKT: LINESTRING(longitude latitude, longitude latitude, ...)
        // NOTA: WKT usa longitude PRIMEIRO, depois latitude (não latitude, longitude)
        const coordinates = points
            .map((p) => `${p.longitude} ${p.latitude}`) // lng antes de lat no WKT
            .join(', '); // Separa pontos com vírgula

        return `LINESTRING(${coordinates})`;
    }

    /**
     * Converte GeoJSON Polygon para formato boundary (array de pontos)
     * 
     * Após processamento PostGIS, o território é um Polygon bufferizado.
     * Este método extrai o ring externo do polígono e converte de volta para
     * o formato boundary que o frontend espera.
     * 
     * @param geoJson - GeoJSON Polygon retornado do PostGIS (ST_AsGeoJSON)
     * @returns Array de pontos no formato {latitude, longitude, timestamp}
     */
    private geoJsonToBoundaryPoints(geoJson: any): Array<{ latitude: number; longitude: number; timestamp?: string }> {
        // Valida se é um Polygon válido
        if (!geoJson || geoJson.type !== 'Polygon') {
            return [];
        }

        // GeoJSON Polygon structure:
        // {
        //   type: "Polygon",
        //   coordinates: [
        //     [[lng, lat], [lng, lat], ...],  // Ring externo (boundary)
        //     [[lng, lat], ...]                // Holes (não usados aqui)
        //   ]
        // }
        // coordinates[0] é o ring externo (contorno do polígono)
        const coordinates = geoJson.coordinates[0] as number[][];

        // Converte cada coordenada [lng, lat] para {latitude, longitude, timestamp}
        return coordinates.map((coord, index) => ({
            latitude: coord[1], // GeoJSON usa [longitude, latitude] (invertido do formato comum)
            longitude: coord[0],
            timestamp: new Date().toISOString(), // Timestamp aproximado (não preservado do original)
        }));
    }

    /**
     * Busca todos os territórios no banco de dados, opcionalmente filtrando por bounding box
     * 
     * Este método é usado para carregar territórios visíveis no mapa.
     * Quando um bbox (bounding box) é fornecido, retorna apenas territórios que intersectam
     * com a área visível do mapa, melhorando performance.
     * 
     * @param bbox - Opcional: caixa delimitadora {minLng, minLat, maxLng, maxLat}
     *                Se fornecido, retorna apenas territórios que intersectam com essa área
     * @returns Array de territórios com dados do dono e geometria em GeoJSON
     */
    async findAllTerritories(bbox?: { minLng: number; minLat: number; maxLng: number; maxLat: number }) {
        // ===== QUERY BASE =====
        // Busca territórios com JOIN com users para obter dados do dono
        // ST_AsGeoJSON converte geometria PostGIS para GeoJSON (formato padrão web)
        // IMPORTANTE: ST_AsGeoJSON preserva TODOS os pontos sem simplificação
        // Isso garante que o polígono renderizado no mapa seja idêntico ao armazenado
        let query = `
            SELECT 
                t.id,                    -- ID do território
                t."areaName",            -- Nome da área conquistada
                t.area as "areaM2",      -- Área em metros quadrados
                t."capturedAt",          -- Data de conquista
                u.id as "userId",        -- ID do dono
                u.name,                  -- Nome completo do dono
                u.username,              -- Username do dono
                u.color,                 -- Cor do território no mapa
                u."photoUrl",            -- Foto de perfil do dono
                ST_AsGeoJSON(t.geometry)::text as geometry -- Geometria em formato GeoJSON
            FROM territories t
            JOIN users u ON t."userId" = u.id
        `;

        // ===== FILTRO POR BOUNDING BOX (OPCIONAL) =====
        // Se bbox fornecido, filtra territórios que intersectam com a área visível
        // Isso melhora performance: não carrega territórios fora da tela
        if (bbox) {
            // ST_MakeEnvelope cria um retângulo (bounding box) a partir de 4 coordenadas
            // ST_Intersects verifica se o território intersecta com esse retângulo
            query += `
                WHERE ST_Intersects(
                    t.geometry,                    -- Geometria do território
                    ST_MakeEnvelope($1, $2, $3, $4, 4326) -- Bbox: minLng, minLat, maxLng, maxLat
                )
            `;
            query += ` ORDER BY t."capturedAt" DESC`; // Mais recentes primeiro
            const territories = await this.prisma.client.$queryRawUnsafe(
                query,
                bbox.minLng,  // Canto inferior esquerdo (longitude)
                bbox.minLat,  // Canto inferior esquerdo (latitude)
                bbox.maxLng,  // Canto superior direito (longitude)
                bbox.maxLat   // Canto superior direito (latitude)
            );
            return territories;
        } else {
            // Sem bbox: retorna TODOS os territórios (pode ser lento com muitos dados)
            query += ` ORDER BY t."capturedAt" DESC`; // Mais recentes primeiro
            const territories = await this.prisma.client.$queryRawUnsafe(query);
            return territories;
        }
    }

    /**
     * Atualiza URL da imagem do mapa para uma corrida
     * 
     * MÉTODO LEGACY: Atualmente não é usado pois imagens de mapa não são mais salvas.
     * Mantido para compatibilidade com código antigo.
     * 
     * @param runId - ID da corrida
     */
    async updateRunMapImage(runId: string,): Promise<void> {
        // Atualização vazia (método não utilizado atualmente)
        await this.prisma.client.run.update({
            where: { id: runId },
            data: {},
        });
    }

    /**
     * Calcula a distância total de um trajeto somando distâncias entre pontos consecutivos
     * 
     * Usa Turf.js para cálculo de distância geodésica (considera curvatura da Terra).
     * Mais preciso que cálculo de distância euclidiana simples.
     * 
     * @param points - Array de pontos GPS {latitude, longitude}
     * @returns Distância total em metros
     */
    private calculateDistance(points: Array<{ latitude: number; longitude: number }>): number {
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
     * @returns Duração em segundos
     */
    private calculateDuration(points: Array<{ latitude: number; longitude: number; timestamp?: string }>): number {
        // Precisa de pelo menos 2 pontos para calcular duração
        if (points.length < 2) return 0;

        const firstPoint = points[0];
        const lastPoint = points[points.length - 1];

        // Extrai timestamps (em milissegundos) dos pontos
        // Se timestamp não disponível, usa timestamp atual como fallback
        const startTime = firstPoint?.timestamp ? new Date(firstPoint.timestamp).getTime() : new Date().getTime();
        const endTime = lastPoint?.timestamp ? new Date(lastPoint.timestamp).getTime() : new Date().getTime();

        // Calcula diferença em segundos (Math.floor arredonda para baixo)
        return Math.floor((endTime - startTime) / 1000);
    }
}
