import { PrismaClient, AchievementStatus } from '@prisma/client';
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

// Função para gerar pontos intermediários entre dois pontos
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

// Criar um trajeto completo com muitos pontos
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

// Rota de exemplo em Ribeirão Preto
const ribeiraoRoute = [
    { lat: -21.1774, lng: -47.8102 },  // Centro
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
];

async function main() {
    console.log('🌱 Iniciando seed do usuário admin...\n');

    // Buscar todas as ligas
    const leagues = await prisma.league.findMany({
        orderBy: { order: 'asc' },
    });

    if (leagues.length === 0) {
        console.log('❌ Nenhuma liga encontrada. Execute primeiro: npm run seed:leagues');
        return;
    }

    // Verificar se o usuário admin já existe
    const existingAdmin = await prisma.user.findUnique({
        where: { username: 'admin' },
    });

    if (existingAdmin) {
        console.log('⚠️  Usuário admin já existe. Deletando dados relacionados...');

        // Limpar dados relacionados
        await prisma.friendshipEdge.deleteMany({
            where: {
                OR: [
                    { userLowId: existingAdmin.id },
                    { userHighId: existingAdmin.id },
                ],
            },
        });
        await prisma.userAchievementProgress.deleteMany({
            where: { userId: existingAdmin.id },
        });
        await prisma.userAchievement.deleteMany({
            where: { userId: existingAdmin.id },
        });
        await prisma.championWeeklySummary.deleteMany({
            where: { userId: existingAdmin.id },
        });
        await prisma.championRun.deleteMany({
            where: { userId: existingAdmin.id },
        });
        await prisma.weeklyRun.deleteMany({
            where: { participant: { userId: existingAdmin.id } },
        });
        await prisma.weeklyRoomParticipant.deleteMany({
            where: { userId: existingAdmin.id },
        });
        await prisma.weeklyEnrollment.deleteMany({
            where: { userId: existingAdmin.id },
        });
        await prisma.battle.deleteMany({
            where: {
                OR: [
                    { player1Id: existingAdmin.id },
                    { player2Id: existingAdmin.id },
                ],
            },
        });
        await prisma.runPathPoint.deleteMany({
            where: { run: { userId: existingAdmin.id } },
        });
        await prisma.run.deleteMany({
            where: { userId: existingAdmin.id },
        });
        await prisma.territory.deleteMany({
            where: { userId: existingAdmin.id },
        });
        await prisma.refreshToken.deleteMany({
            where: { userId: existingAdmin.id },
        });

        // Deletar o usuário
        await prisma.user.delete({
            where: { id: existingAdmin.id },
        });

        console.log('✅ Dados do admin antigo removidos.\n');
    }

    // Selecionar uma liga (por padrão, vamos usar a primeira não-Imortal, ou Elite se disponível)
    let selectedLeague = leagues.find(l => l.code === 'ELITE');
    if (!selectedLeague) {
        selectedLeague = leagues.find(l => !l.isChampion && l.order >= 3);
    }
    if (!selectedLeague) {
        selectedLeague = leagues[0];
    }

    console.log(`📝 Criando usuário admin na liga: ${selectedLeague.displayName}...`);

    const hashedPassword = await bcrypt.hash('admin123', 10);

    // Calcular troféus baseado na liga
    let trophies = 0;
    const leagueIndex = leagues.findIndex(l => l.id === selectedLeague.id);
    if (leagueIndex === 0) trophies = Math.floor(Math.random() * 100);
    else if (leagueIndex === 1) trophies = 100 + Math.floor(Math.random() * 200);
    else if (leagueIndex === 2) trophies = 300 + Math.floor(Math.random() * 300);
    else if (leagueIndex === 3) trophies = 600 + Math.floor(Math.random() * 400);
    else if (leagueIndex === 4) trophies = 1000 + Math.floor(Math.random() * 500);
    else if (leagueIndex === 5) trophies = 1500 + Math.floor(Math.random() * 1000);
    else trophies = 3000 + Math.floor(Math.random() * 2000);

    // Criar usuário admin
    const admin = await prisma.user.create({
        data: {
            username: 'admin',
            name: 'Administrador',
            email: 'admin@example.com',
            password: hashedPassword,
            color: '#FF6B35',
            biography: 'Administrador do sistema. Corredor apaixonado por desafios e competições!',
            lastLogin: new Date(),
            level: 25,
            xp: 15000,
            trophies,
            winStreak: 5,
            battleWins: 42,
            battleLosses: 18,
            leagueId: selectedLeague.id,
        },
    });

    console.log(`✅ Usuário admin criado!`);
    console.log(`   - Nome: ${admin.name}`);
    console.log(`   - Username: ${admin.username}`);
    console.log(`   - Email: ${admin.email}`);
    console.log(`   - Senha: admin123`);
    console.log(`   - Liga: ${selectedLeague.displayName}`);
    console.log(`   - Troféus: ${admin.trophies}`);
    console.log(`   - Level: ${admin.level}`);
    console.log(`   - XP: ${admin.xp}\n`);

    // Criar UMA corrida simples (sem território)
    console.log('🏃 Criando corrida simples...');

    const pathPoints = createDetailedRoute(ribeiraoRoute, 20);
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
    const maxSpeed = 3.5 + Math.random() * 2; // m/s (velocidade realista)
    const elevationGain = Math.floor(Math.random() * 50);
    const calories = Math.floor(distance * 0.06); // ~60 cal/km

    const run = await prisma.run.create({
        data: {
            userId: admin.id,
            startTime,
            endTime,
            distance,
            duration,
            averagePace,
            maxSpeed,
            elevationGain,
            calories,
            caption: 'Minha primeira corrida!',
            territoryId: null, // Sem território
        },
    });

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

    console.log(`✅ Corrida criada!`);
    console.log(`   - Distância: ${(distance / 1000).toFixed(2)} km`);
    console.log(`   - Duração: ${Math.floor(duration / 60)} min ${duration % 60} s`);
    console.log(`   - Pace médio: ${Math.floor(averagePace / 60)}:${(averagePace % 60).toString().padStart(2, '0')} min/km`);
    console.log(`   - Velocidade máxima: ${(maxSpeed * 3.6).toFixed(2)} km/h`);
    console.log(`   - Pontos GPS: ${pathPoints.length}\n`);

    // Criar alguns achievements
    console.log('🏆 Criando achievements...');
    const achievementIds = ['first_run', 'first_territory', '10_runs', 'first_battle', '10_wins', 'level_10', 'level_20'];

    for (const achievementId of achievementIds) {
        const isCompleted = achievementId === 'first_run' || achievementId === 'level_10' || achievementId === 'level_20';

        await prisma.userAchievement.create({
            data: {
                userId: admin.id,
                achievementId,
                status: isCompleted ? AchievementStatus.CLAIMED : AchievementStatus.LOCKED,
                progress: isCompleted ? 1.0 : 0.0,
                progressText: isCompleted ? 'Concluído!' : null,
                unlockedAt: isCompleted ? new Date(Date.now() - Math.random() * 30 * 24 * 3600000) : null,
                claimedAt: isCompleted ? new Date(Date.now() - Math.random() * 30 * 24 * 3600000) : null,
            },
        });
    }
    console.log('✅ Achievements criados!\n');

    console.log('✅ Seed do admin concluído!');
    console.log('\n📋 Resumo do perfil:');
    console.log(`   - Username: admin`);
    console.log(`   - Senha: admin123`);
    console.log(`   - Liga: ${selectedLeague.displayName}`);
    console.log(`   - Troféus: ${admin.trophies}`);
    console.log(`   - Level: ${admin.level}`);
    console.log(`   - XP: ${admin.xp}`);
    console.log(`   - Vitórias: ${admin.battleWins}`);
    console.log(`   - Derrotas: ${admin.battleLosses}`);
    console.log(`   - Sequência de vitórias: ${admin.winStreak}`);
    console.log(`   - Corridas: 1 (sem território)\n`);
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
