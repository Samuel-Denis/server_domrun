import { PrismaClient, AchievementStatus, Prisma } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcrypt';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error('❌ DATABASE_URL não está definida no .env');
}

const pool = new Pool({
    connectionString,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
    adapter,
});

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

/**
 * Gera pontos intermediários entre dois pontos (simulando caminho de corrida)
 */
function generatePointsBetween(
    start: { lat: number; lng: number },
    end: { lat: number; lng: number },
    numPoints: number = 15
): Array<{ lat: number; lng: number; timestamp?: string }> {
    const points: Array<{ lat: number; lng: number; timestamp?: string }> = [];
    const startTime = new Date(Date.now() - 3600000); // 1 hora atrás

    for (let i = 0; i <= numPoints; i++) {
        const t = i / numPoints;
        const lat = start.lat + (end.lat - start.lat) * t;
        const lng = start.lng + (end.lng - start.lng) * t;
        const variation = 0.00002;
        const randomLat = (Math.random() - 0.5) * variation;
        const randomLng = (Math.random() - 0.5) * variation;

        const timestamp = new Date(startTime.getTime() + i * 5000); // 5 segundos entre pontos

        points.push({
            lat: lat + randomLat,
            lng: lng + randomLng,
            timestamp: timestamp.toISOString(),
        });
    }

    return points;
}

/**
 * Cria um trajeto completo com muitos pontos
 */
function createDetailedRoute(
    waypoints: Array<{ lat: number; lng: number }>,
    pointsPerSegment: number = 20
): Array<{ lat: number; lng: number; timestamp?: string }> {
    const route: Array<{ lat: number; lng: number; timestamp?: string }> = [];
    const startTime = new Date(Date.now() - 3600000);

    let pointIndex = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
        const segmentPoints = generatePointsBetween(
            waypoints[i],
            waypoints[i + 1],
            pointsPerSegment
        );

        for (const point of segmentPoints.slice(0, -1)) {
            const timestamp = new Date(startTime.getTime() + pointIndex * 5000);
            route.push({
                ...point,
                timestamp: timestamp.toISOString(),
            });
            pointIndex++;
        }
    }

    // Adicionar último ponto
    const lastPoint = waypoints[waypoints.length - 1];
    const lastTimestamp = new Date(startTime.getTime() + pointIndex * 5000);
    route.push({
        lat: lastPoint.lat,
        lng: lastPoint.lng,
        timestamp: lastTimestamp.toISOString(),
    });

    return route;
}

/**
 * Converte array de pontos em WKT POLYGON (fechado para território)
 */
function pointsToPolygonWKT(points: Array<{ lat: number; lng: number }>): string {
    // Fechar o polígono (último ponto = primeiro)
    const coordinates = points.map(p => `${p.lng} ${p.lat}`).join(', ');
    const firstPoint = points[0];
    return `POLYGON((${coordinates}, ${firstPoint.lng} ${firstPoint.lat}))`;
}

/**
 * Gera weekKey no formato YYYY-Www
 */
function generateWeekKey(date: Date = new Date()): string {
    const saoPauloDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const dayOfWeek = saoPauloDate.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(saoPauloDate);
    monday.setDate(saoPauloDate.getDate() + diff);
    monday.setHours(0, 0, 0, 0);

    const year = monday.getFullYear();
    const weekNumber = getISOWeek(monday);
    return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
}

function getISOWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function parseWeekKey(weekKey: string): { seasonNumber: number; weekNumber: number } {
    const [year, week] = weekKey.split('-W');
    const yearNum = parseInt(year);
    const weekNum = parseInt(week);
    return {
        seasonNumber: yearNum * 100 + weekNum,
        weekNumber: weekNum,
    };
}

/**
 * Gera dayKey no formato YYYY-MM-DD
 */
function generateDayKey(date: Date = new Date()): string {
    const saoPauloDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const year = saoPauloDate.getFullYear();
    const month = (saoPauloDate.getMonth() + 1).toString().padStart(2, '0');
    const day = saoPauloDate.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// ============================================
// DADOS DE RIBEIRÃO PRETO
// ============================================

const ribeiraoRoutes = [
    {
        name: 'Jardim Paulista (Circuito)',
        waypoints: [
            { lat: -21.1914, lng: -47.7874 },
            { lat: -21.1905, lng: -47.7880 },
            { lat: -21.1898, lng: -47.7890 },
            { lat: -21.1890, lng: -47.7895 },
            { lat: -21.1882, lng: -47.7895 },
            { lat: -21.1875, lng: -47.7888 },
            { lat: -21.1870, lng: -47.7880 },
            { lat: -21.1865, lng: -47.7870 },
            { lat: -21.1868, lng: -47.7860 },
            { lat: -21.1875, lng: -47.7858 },
            { lat: -21.1885, lng: -47.7862 },
            { lat: -21.1895, lng: -47.7868 },
            { lat: -21.1905, lng: -47.7872 },
            { lat: -21.1912, lng: -47.7873 },
        ],
    },
    {
        name: 'Centro (Praça XV)',
        waypoints: [
            { lat: -21.1774, lng: -47.8102 },
            { lat: -21.1765, lng: -47.8110 },
            { lat: -21.1758, lng: -47.8118 },
            { lat: -21.1752, lng: -47.8125 },
            { lat: -21.1748, lng: -47.8132 },
            { lat: -21.1745, lng: -47.8140 },
            { lat: -21.1743, lng: -47.8148 },
            { lat: -21.1745, lng: -47.8155 },
            { lat: -21.1748, lng: -47.8162 },
            { lat: -21.1752, lng: -47.8168 },
            { lat: -21.1758, lng: -47.8173 },
            { lat: -21.1765, lng: -47.8176 },
            { lat: -21.1772, lng: -47.8177 },
            { lat: -21.1778, lng: -47.8175 },
            { lat: -21.1783, lng: -47.8171 },
            { lat: -21.1787, lng: -47.8165 },
            { lat: -21.1789, lng: -47.8158 },
            { lat: -21.1789, lng: -47.8150 },
            { lat: -21.1787, lng: -47.8142 },
            { lat: -21.1783, lng: -47.8135 },
            { lat: -21.1778, lng: -47.8129 },
            { lat: -21.1774, lng: -47.8102 },
        ],
    },
    {
        name: 'Campos Elíseos',
        waypoints: [
            { lat: -21.1850, lng: -47.7950 },
            { lat: -21.1840, lng: -47.7960 },
            { lat: -21.1830, lng: -47.7970 },
            { lat: -21.1820, lng: -47.7975 },
            { lat: -21.1810, lng: -47.7978 },
            { lat: -21.1800, lng: -47.7975 },
            { lat: -21.1790, lng: -47.7970 },
            { lat: -21.1780, lng: -47.7965 },
            { lat: -21.1775, lng: -47.7955 },
            { lat: -21.1778, lng: -47.7945 },
            { lat: -21.1785, lng: -47.7935 },
            { lat: -21.1795, lng: -47.7930 },
            { lat: -21.1805, lng: -47.7932 },
            { lat: -21.1815, lng: -47.7938 },
            { lat: -21.1825, lng: -47.7945 },
            { lat: -21.1835, lng: -47.7950 },
            { lat: -21.1845, lng: -47.7952 },
        ],
    },
];

const nomes = [
    'João Silva', 'Maria Santos', 'Pedro Oliveira', 'Ana Costa', 'Carlos Pereira',
    'Juliana Rodrigues', 'Fernando Alves', 'Patricia Lima', 'Ricardo Souza', 'Amanda Ferreira',
    'Bruno Carvalho', 'Cristina Martins', 'Diego Barbosa', 'Eduarda Ribeiro', 'Felipe Gomes',
    'Gabriela Dias', 'Henrique Araujo', 'Isabela Campos', 'Lucas Mendes', 'Mariana Teixeira',
    'Nicolas Rocha', 'Olivia Nunes', 'Paulo Castro', 'Raquel Freitas', 'Samuel Cardoso',
    'Tatiana Monteiro', 'Vitor Correia', 'Yasmin Azevedo', 'Thiago Ramos', 'Vanessa Moura',
    'Wagner Pires', 'Beatriz Cunha', 'Daniel Machado', 'Elena Rezende', 'Fábio Guimarães',
    'Helena Moreira', 'Igor Farias', 'Julia Coelho', 'Kleber Lopes', 'Larissa Viana',
];

// ============================================
// SEED PRINCIPAL
// ============================================

async function main() {
    console.log('🌱 Iniciando seed completo de usuários...\n');

    // Buscar todas as ligas
    const leagues = await prisma.league.findMany({
        orderBy: { order: 'asc' },
    });

    if (leagues.length === 0) {
        console.log('❌ Nenhuma liga encontrada. Execute primeiro: npm run seed:leagues');
        return;
    }

    // Limpar dados existentes (opcional - descomente se quiser limpar tudo antes)
    console.log('🧹 Limpando dados existentes...');
    await prisma.friendshipEdge.deleteMany();
    await prisma.userAchievementProgress.deleteMany();
    await prisma.userAchievement.deleteMany();
    await prisma.championWeeklySummary.deleteMany();
    await prisma.championRun.deleteMany();
    await prisma.weeklyRun.deleteMany();
    await prisma.weeklyRoomParticipant.deleteMany();
    await prisma.weeklyRoom.deleteMany();
    await prisma.weeklyEnrollment.deleteMany();
    await prisma.battle.deleteMany();
    await prisma.runPathPoint.deleteMany();
    await prisma.run.deleteMany();
    await prisma.territory.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
    console.log('✅ Dados limpos!\n');

    const users: Array<any> = [];
    const totalUsers = 40;

    // Criar usuários
    console.log(`📝 Criando ${totalUsers} usuários...`);
    for (let i = 0; i < totalUsers; i++) {
        const nome = nomes[i % nomes.length];
        const username = `${nome.toLowerCase().replace(/\s+/g, '')}${i + 1}`;
        const email = `${username}${Date.now()}${i}@example.com`; // Adiciona timestamp para garantir unicidade
        const hashedPassword = await bcrypt.hash('senha123', 10);

        // Distribuir usuários pelas ligas (mais nas ligas iniciais)
        let leagueIndex;
        if (i < 10) leagueIndex = 0; // Starter
        else if (i < 18) leagueIndex = 1; // Ritmo
        else if (i < 24) leagueIndex = 2; // Cadência
        else if (i < 30) leagueIndex = 3; // Endurance
        else if (i < 35) leagueIndex = 4; // Atleta
        else if (i < 38) leagueIndex = 5; // Elite
        else leagueIndex = 6; // Imortal

        const selectedLeague = leagues[leagueIndex];

        // Calcular troféus baseado na liga
        let trophies = 0;
        if (leagueIndex === 0) trophies = Math.floor(Math.random() * 100);
        else if (leagueIndex === 1) trophies = 100 + Math.floor(Math.random() * 200);
        else if (leagueIndex === 2) trophies = 300 + Math.floor(Math.random() * 300);
        else if (leagueIndex === 3) trophies = 600 + Math.floor(Math.random() * 400);
        else if (leagueIndex === 4) trophies = 1000 + Math.floor(Math.random() * 500);
        else if (leagueIndex === 5) trophies = 1500 + Math.floor(Math.random() * 1000);
        else trophies = 3000 + Math.floor(Math.random() * 2000); // Imortal

        const user = await prisma.user.create({
            data: {
                username,
                name: nome,
                email,
                password: hashedPassword,
                color: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`,
                biography: i % 3 === 0 ? `Corredor apaixonado desde ${2020 + Math.floor(Math.random() * 4)}. Sempre em busca de novos desafios!` : null,
                lastLogin: new Date(Date.now() - Math.random() * 7 * 24 * 3600000), // Últimos 7 dias
                level: 1 + Math.floor(Math.random() * 30),
                xp: Math.floor(Math.random() * 10000),
                trophies,
                winStreak: Math.floor(Math.random() * 10),
                battleWins: Math.floor(Math.random() * 50),
                battleLosses: Math.floor(Math.random() * 30),
                leagueId: selectedLeague.id,
            },
        });

        users.push({ ...user, leagueIndex, league: selectedLeague });
        console.log(`  ✓ ${user.name} (${selectedLeague.displayName})`);
    }

    console.log(`\n✅ ${users.length} usuários criados!\n`);

    // Criar territórios, corridas e dados relacionados
    for (const userData of users) {
        console.log(`🏃 Processando ${userData.name}...`);

        // Array para armazenar IDs das corridas criadas
        const runIds: string[] = [];

        // 1. Criar territórios conquistados (2-5 por usuário)
        const numTerritories = 2 + Math.floor(Math.random() * 4);
        for (let t = 0; t < numTerritories; t++) {
            const route = ribeiraoRoutes[t % ribeiraoRoutes.length];
            const boundaryPoints = createDetailedRoute(route.waypoints, 15);

            // Converter para WKT POLYGON
            const boundaryWKT = pointsToPolygonWKT(boundaryPoints.map(p => ({ lat: p.lat, lng: p.lng })));

            // Calcular área usando PostGIS
            const areaResult = await prisma.$queryRaw<Array<{ area: number }>>(
                Prisma.sql`SELECT ST_Area(ST_Transform(ST_GeomFromText(${boundaryWKT}, 4326), 3857)) as area`
            );
            const area = areaResult[0]?.area || 0;

            const capturedAt = new Date(Date.now() - Math.random() * 90 * 24 * 3600000); // Últimos 90 dias

            await prisma.$executeRaw(
                Prisma.sql`INSERT INTO territories (id, "userId", "userName", "userColor", "areaName", area, "capturedAt", geometry, "createdAt", "updatedAt")
                 VALUES (gen_random_uuid(), ${userData.id}, ${userData.name}, ${userData.color}, ${route.name}, ${area}, ${capturedAt}, ST_GeomFromText(${boundaryWKT}, 4326), NOW(), NOW())`
            );
        }

        // 2. Criar corridas simples (3-10 por usuário, pelo menos metade sendo territórios)
        const numRuns = 3 + Math.floor(Math.random() * 8);

        for (let r = 0; r < numRuns; r++) {
            const route = ribeiraoRoutes[r % ribeiraoRoutes.length];
            const pathPoints = createDetailedRoute(route.waypoints, 20);

            const startTime = new Date(pathPoints[0].timestamp!);
            const endTime = new Date(pathPoints[pathPoints.length - 1].timestamp!);
            const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

            // Calcular distância total (aproximada)
            let totalDistance = 0;
            for (let i = 0; i < pathPoints.length - 1; i++) {
                const lat1 = pathPoints[i].lat;
                const lng1 = pathPoints[i].lng;
                const lat2 = pathPoints[i + 1].lat;
                const lng2 = pathPoints[i + 1].lng;
                const R = 6371000; // Raio da Terra em metros
                const dLat = (lat2 - lat1) * Math.PI / 180;
                const dLng = (lng2 - lng1) * Math.PI / 180;
                const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                    Math.sin(dLng / 2) * Math.sin(dLng / 2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                totalDistance += R * c;
            }

            const distance = Math.round(totalDistance);
            const averagePace = duration > 0 ? (duration / (distance / 1000)) : 0; // segundos por km
            const maxSpeed = 3 + Math.random() * 4; // m/s
            const elevationGain = Math.floor(Math.random() * 100);
            const calories = Math.floor(distance * 0.06); // ~60 cal/km

            const isTerritory = r < numRuns / 2; // Primeira metade são territórios

            // Buscar território do usuário se for corrida de território
            let territoryId: string | null = null;
            if (isTerritory) {
                const territories = await prisma.territory.findMany({
                    where: { userId: userData.id },
                    take: 1,
                });
                territoryId = territories[0]?.id || null;
            }

            const run = await prisma.run.create({
                data: {
                    userId: userData.id,
                    startTime,
                    endTime,
                    distance,
                    duration,
                    averagePace,
                    maxSpeed,
                    elevationGain,
                    calories,
                    territoryId: territoryId || undefined,
                    caption: r % 3 === 0 ? `Corrida ${r + 1} em ${route.name}` : null,
                },
            });

            runIds.push(run.id);

            // Criar pontos do trajeto
            await prisma.runPathPoint.createMany({
                data: pathPoints.map((point, idx) => ({
                    runId: run.id,
                    latitude: point.lat,
                    longitude: point.lng,
                    timestamp: new Date(point.timestamp!),
                    sequenceOrder: idx,
                })),
            });
        }

        console.log(`  ✓ ${numTerritories} territórios, ${numRuns} corridas criadas`);

        // 3. Criar batalhas PvP (1v1) - algumas vitórias, algumas derrotas
        const numBattles = Math.floor(Math.random() * 5) + 2;
        const otherUsers = users.filter(u => u.id !== userData.id);

        for (let b = 0; b < numBattles; b++) {
            const opponent = otherUsers[Math.floor(Math.random() * otherUsers.length)];
            const userWon = Math.random() > 0.4; // 60% de chance de vitória

            const battleStartTime = new Date(Date.now() - Math.random() * 30 * 24 * 3600000);
            const battleEndTime = new Date(battleStartTime.getTime() + 3600000); // 1 hora depois

            const battle = await prisma.battle.create({
                data: {
                    player1Id: userData.id,
                    player2Id: opponent.id,
                    status: 'FINISHED',
                    winnerId: userWon ? userData.id : opponent.id,
                    mode: 'RACE',
                    p1Score: Math.floor(Math.random() * 1000),
                    p2Score: Math.floor(Math.random() * 1000),
                    finishedAt: battleEndTime,
                },
            });
        }

        // 4. Criar inscrições semanais e participações (para usuários não-Imortal)
        if (!userData.league.isChampion) {
            // Inscrições para últimas 4 semanas
            for (let weekOffset = 0; weekOffset < 4; weekOffset++) {
                const weekDate = new Date();
                weekDate.setDate(weekDate.getDate() - (weekOffset * 7));
                const weekKey = generateWeekKey(weekDate);
                const { seasonNumber, weekNumber } = parseWeekKey(weekKey);

                // Inscrição
                await prisma.weeklyEnrollment.create({
                    data: {
                        userId: userData.id,
                        weekKey,
                        seasonNumber,
                        weekNumber,
                        leagueId: userData.leagueId!,
                        enrolledAt: new Date(Date.now() - (weekOffset * 7 * 24 * 3600000)),
                    },
                });

                // Criar ou buscar sala semanal
                const weekStartDate = new Date(weekDate);
                weekStartDate.setDate(weekStartDate.getDate() - (weekStartDate.getDay() === 0 ? 6 : weekStartDate.getDay() - 1));
                weekStartDate.setHours(0, 0, 0, 0);

                const weekEndDate = new Date(weekStartDate);
                weekEndDate.setDate(weekEndDate.getDate() + 6);
                weekEndDate.setHours(23, 59, 59, 999);

                // Buscar salas existentes desta liga/semana
                const existingRooms = await prisma.weeklyRoom.findMany({
                    where: {
                        leagueId: userData.leagueId!,
                        weekKey,
                    },
                });

                // Encontrar sala com menos de 20 participantes ou criar nova
                let room: any = null;
                for (const existingRoom of existingRooms) {
                    const count = await prisma.weeklyRoomParticipant.count({
                        where: { roomId: existingRoom.id },
                    });
                    if (count < 20) {
                        room = existingRoom;
                        break;
                    }
                }

                if (!room) {
                    const roomNumber = existingRooms.length + 1;

                    room = await prisma.weeklyRoom.create({
                        data: {
                            leagueId: userData.leagueId!,
                            seasonNumber,
                            weekNumber,
                            weekKey,
                            roomNumber,
                            startDate: weekStartDate,
                            endDate: weekEndDate,
                            status: weekOffset === 0 ? 'IN_PROGRESS' : 'FINISHED',
                        },
                    });
                }

                if (!room) {
                    console.log(`  ⚠️  Não foi possível criar sala para ${userData.name}`);
                    continue;
                }

                // Criar participante
                const participant = await prisma.weeklyRoomParticipant.create({
                    data: {
                        roomId: room.id,
                        userId: userData.id,
                        startingLeagueId: userData.leagueId!,
                        weekKey: room.weekKey, // Copiar weekKey do WeeklyRoom (obrigatório)
                        totalPoints: Math.floor(Math.random() * 5000),
                        consistencyBonus: Math.floor(Math.random() * 400),
                        runsValidCount: Math.floor(Math.random() * 10) + 1,
                        position: Math.floor(Math.random() * 20) + 1,
                        promoted: false,
                        demoted: false,
                    },
                });

                // Criar corridas semanais (2-8 por participante)
                // IMPORTANTE: Cada runId só pode ser usado UMA VEZ em WeeklyRun (constraint @@unique([runId]))
                // Por isso, criamos corridas específicas para cada semana
                const numWeeklyRuns = 2 + Math.floor(Math.random() * 7);
                const runsForThisWeek: string[] = [];

                // Criar novas corridas específicas para esta semana
                for (let wr = 0; wr < numWeeklyRuns; wr++) {
                    const route = ribeiraoRoutes[(weekOffset * numWeeklyRuns + wr) % ribeiraoRoutes.length];
                    const pathPoints = createDetailedRoute(route.waypoints, 20);

                    // Ajustar timestamps para estar dentro do período competitivo da semana (terça a domingo)
                    const weekStart = new Date(weekStartDate);
                    weekStart.setDate(weekStart.getDate() + 1); // Terça-feira (início do período competitivo)
                    const runTime = new Date(weekStart.getTime() + (wr * 24 * 3600000)); // Distribuir ao longo da semana

                    const startTime = new Date(runTime);
                    const endTime = new Date(runTime.getTime() + 1800000); // 30 minutos depois
                    const duration = 1800;

                    // Calcular distância
                    let totalDistance = 0;
                    for (let i = 0; i < pathPoints.length - 1; i++) {
                        const lat1 = pathPoints[i].lat;
                        const lng1 = pathPoints[i].lng;
                        const lat2 = pathPoints[i + 1].lat;
                        const lng2 = pathPoints[i + 1].lng;
                        const R = 6371000;
                        const dLat = (lat2 - lat1) * Math.PI / 180;
                        const dLng = (lng2 - lng1) * Math.PI / 180;
                        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                            Math.sin(dLng / 2) * Math.sin(dLng / 2);
                        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                        totalDistance += R * c;
                    }

                    const distance = Math.round(totalDistance);
                    const averagePace = duration > 0 ? (duration / (distance / 1000)) : 0;

                    const run = await prisma.run.create({
                        data: {
                            userId: userData.id,
                            startTime,
                            endTime,
                            distance,
                            duration,
                            averagePace,
                            maxSpeed: 3 + Math.random() * 4,
                            elevationGain: Math.floor(Math.random() * 100),
                            calories: Math.floor(distance * 0.06),
                            caption: `Corrida semanal ${wr + 1} - Semana ${weekOffset + 1}`,
                        },
                    });

                    // Criar pontos do trajeto
                    await prisma.runPathPoint.createMany({
                        data: pathPoints.map((point, idx) => ({
                            runId: run.id,
                            latitude: point.lat,
                            longitude: point.lng,
                            timestamp: new Date(startTime.getTime() + idx * 5000),
                            sequenceOrder: idx,
                        })),
                    });

                    runsForThisWeek.push(run.id);
                }

                for (let wr = 0; wr < runsForThisWeek.length; wr++) {
                    const runId = runsForThisWeek[wr];
                    const run = await prisma.run.findUnique({
                        where: { id: runId },
                    });

                    if (!run) continue;

                    const dayKey = generateDayKey(new Date(run.startTime));
                    const paceSecKm = run.averagePace || Math.floor(240 + Math.random() * 120); // 4-6 min/km
                    const paceScore = Math.floor(Math.random() * 650);
                    const distanceScore = Math.floor(Math.random() * 200);
                    const smoothnessScore = Math.floor(Math.random() * 150);
                    const finalScore = Math.floor((paceScore + distanceScore + smoothnessScore) * (0.9 + Math.random() * 0.1));
                    const isValid = Math.random() > 0.1; // 90% válidas

                    await prisma.weeklyRun.create({
                        data: {
                            participantId: participant.id,
                            roomId: room.id,
                            runId,
                            distanceMeters: run.distance,
                            durationSeconds: run.duration,
                            paceSecKm,
                            paceScore,
                            distanceScore,
                            smoothnessScore,
                            finalScore,
                            dayKey,
                            countedDay: wr < 2, // Top 2 do dia
                            countedWeek: wr < 5, // Top 5 da semana
                            isValid,
                            invalidReason: isValid ? null : 'Velocidade suspeita',
                            flags: isValid ? undefined : ['SPEED_ANOMALY'],
                            multiplier: isValid ? 1.0 : 0.75,
                            submittedAt: new Date(run.startTime),
                        },
                    });
                }
            }
        } else {
            // Usuário Imortal - criar ChampionRuns
            const numChampionRuns = 5 + Math.floor(Math.random() * 10);
            const championRunIds = runIds.slice(0, Math.min(numChampionRuns, runIds.length));

            for (let cr = 0; cr < championRunIds.length; cr++) {
                const runId = championRunIds[cr];
                const run = await prisma.run.findUnique({
                    where: { id: runId },
                });

                if (!run) continue;

                const paceSecKm = run.averagePace || Math.floor(200 + Math.random() * 100); // 3.3-5 min/km
                const paceScore = Math.floor(Math.random() * 650);
                const distanceScore = Math.floor(Math.random() * 200);
                const smoothnessScore = Math.floor(Math.random() * 150);
                const finalScore = Math.floor((paceScore + distanceScore + smoothnessScore) * (0.9 + Math.random() * 0.1));
                const trophiesEarned = Math.max(10, Math.min(60, Math.floor(finalScore / 25)));
                const isValid = Math.random() > 0.1;

                await prisma.championRun.create({
                    data: {
                        userId: userData.id,
                        runId,
                        distanceMeters: run.distance,
                        durationSeconds: run.duration,
                        paceSecKm,
                        finalScore,
                        trophiesEarned,
                        isValid,
                        invalidReason: isValid ? null : 'GPS irregular',
                        flags: isValid ? undefined : ['GPS_JUMP'],
                        multiplier: isValid ? 1.0 : 0.8,
                        submittedAt: new Date(run.startTime),
                    },
                });
            }

            // Criar ChampionWeeklySummary para últimas semanas
            for (let weekOffset = 0; weekOffset < 4; weekOffset++) {
                const weekDate = new Date();
                weekDate.setDate(weekDate.getDate() - (weekOffset * 7));
                const weekKey = generateWeekKey(weekDate);
                const { seasonNumber, weekNumber } = parseWeekKey(weekKey);

                const weekStartDate = new Date(weekDate);
                weekStartDate.setDate(weekStartDate.getDate() - (weekStartDate.getDay() === 0 ? 6 : weekStartDate.getDay() - 1));
                weekStartDate.setHours(0, 0, 0, 0);

                const weekEndDate = new Date(weekStartDate);
                weekEndDate.setDate(weekEndDate.getDate() + 6);
                weekEndDate.setHours(23, 59, 59, 999);

                const validRunsCount = 3 + Math.floor(Math.random() * 7);
                const trophiesEarnedWeek = validRunsCount * (20 + Math.floor(Math.random() * 40));
                const trophiesPenaltyWeek = validRunsCount < 3 ? 50 : 0;
                const trophiesBefore = userData.trophies;
                const trophiesAfter = Math.max(0, trophiesBefore + trophiesEarnedWeek - trophiesPenaltyWeek);

                await prisma.championWeeklySummary.create({
                    data: {
                        userId: userData.id,
                        seasonNumber,
                        weekNumber,
                        weekKey,
                        weekStart: weekStartDate,
                        weekEnd: weekEndDate,
                        validRunsCount,
                        trophiesEarnedWeek,
                        trophiesPenaltyWeek,
                        trophiesBefore,
                        trophiesAfter,
                        demoted: false,
                        demotedToLeagueId: null,
                    },
                });
            }
        }

        // 5. Criar UserAchievements e Progress (alguns completados, alguns em progresso)
        const achievementCodes = ['FIRST_RUN', 'FIRST_TERRITORY', 'RUN_10', 'RUN_50', 'RUN_100', 'FIRST_BATTLE', 'BATTLE_WIN_10', 'LEVEL_10', 'LEVEL_20'];

        for (let a = 0; a < achievementCodes.length; a++) {
            const achievementCode = achievementCodes[a];

            // Buscar achievement pelo code para obter o id
            const achievement = await prisma.achievement.findUnique({
                where: { code: achievementCode },
                select: { id: true },
            });

            // Se a conquista não existir, pular
            if (!achievement) {
                console.log(`  ⚠️  Conquista "${achievementCode}" não encontrada, pulando...`);
                continue;
            }

            const isCompleted = Math.random() > 0.5;

            const userAchievement = await prisma.userAchievement.create({
                data: {
                    userId: userData.id,
                    achievementId: achievement.id, // Usar o id (UUID) da Achievement, não o code
                    status: isCompleted ? AchievementStatus.CLAIMED : AchievementStatus.IN_PROGRESS,
                    progress: isCompleted ? 1.0 : Math.floor(Math.random() * 90) / 100,
                    progressText: isCompleted ? 'Concluído!' : `${Math.floor(Math.random() * 90)}%`,
                    unlockedAt: isCompleted ? new Date(Date.now() - Math.random() * 30 * 24 * 3600000) : null,
                    claimedAt: isCompleted ? new Date(Date.now() - Math.random() * 30 * 24 * 3600000) : null,
                },
            });

            // Progresso adicional
            if (!isCompleted) {
                await prisma.userAchievementProgress.create({
                    data: {
                        userAchievementId: userAchievement.id,
                        userId: userData.id,
                        currentValue: Math.floor(Math.random() * 90),
                        lastUpdated: new Date(),
                    },
                });
            }
        }

        // 6. Criar amizades (FriendshipEdges)
        const numFriendships = Math.floor(Math.random() * 5);
        const friendCandidates = users.filter((u: any) => u.id !== userData.id && Math.random() > 0.7);

        for (let f = 0; f < Math.min(numFriendships, friendCandidates.length); f++) {
            const friend = friendCandidates[f];
            const lowId = userData.id < friend.id ? userData.id : friend.id;
            const highId = userData.id > friend.id ? userData.id : friend.id;

            // Verificar se já existe
            const exists = await prisma.friendshipEdge.findFirst({
                where: {
                    OR: [
                        {
                            userLowId: lowId,
                            userHighId: highId,
                        },
                        {
                            userLowId: highId,
                            userHighId: lowId,
                        },
                    ],
                },
            });

            if (!exists) {
                await prisma.friendshipEdge.create({
                    data: {
                        userLowId: lowId,
                        userHighId: highId,
                        initiatedByUserId: userData.id,
                        status: Math.random() > 0.3 ? 'ACCEPTED' : 'PENDING',
                        createdAt: new Date(Date.now() - Math.random() * 60 * 24 * 3600000),
                    },
                });
            }
        }

        console.log(`  ✓ Batalhas, inscrições, achievements e amizades criadas`);
    }

    console.log(`\n✅ Seed completo finalizado!`);
    console.log(`\n📊 Resumo:`);
    console.log(`   - ${users.length} usuários criados`);
    console.log(`   - Distribuídos por ${leagues.length} ligas`);
    console.log(`   - Cada usuário tem: territórios, corridas, batalhas, inscrições semanais e achievements\n`);
}

main()
    .catch((e) => {
        console.error('❌ Erro no seed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
