import { PrismaClient } from '@prisma/client';
import type { User } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcrypt';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('❌ DATABASE_URL não está definida no .env');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const DEFAULT_PASSWORD = 'senha123';
const TOTAL_PARTICIPANTS = 20;

function getSaoPauloDate(date: Date = new Date()): Date {
  return new Date(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function generateWeekKey(date: Date = new Date()): string {
  const saoPauloDate = getSaoPauloDate(date);
  const dayOfWeek = saoPauloDate.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(saoPauloDate);
  monday.setDate(saoPauloDate.getDate() + diff);
  monday.setHours(0, 0, 0, 0);

  const year = monday.getFullYear();
  const weekNumber = getISOWeek(monday);
  return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
}

function parseWeekKey(weekKey: string): { seasonNumber: number; weekNumber: number } {
  const [year, week] = weekKey.split('-W');
  const yearNum = Number(year);
  const weekNum = Number(week);
  return {
    seasonNumber: yearNum * 100 + weekNum,
    weekNumber: weekNum,
  };
}

function getCompetitionRange(): { startDate: Date; endDate: Date } {
  const now = getSaoPauloDate();
  const dayOfWeek = now.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);

  const startDate = new Date(monday);
  startDate.setDate(startDate.getDate() + 1); // terça-feira
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(monday);
  endDate.setDate(endDate.getDate() + 6); // domingo
  endDate.setHours(23, 59, 59, 999);

  return { startDate, endDate };
}

function generateDayKey(date: Date = new Date()): string {
  const saoPauloDate = getSaoPauloDate(date);
  const year = saoPauloDate.getFullYear();
  const month = (saoPauloDate.getMonth() + 1).toString().padStart(2, '0');
  const day = saoPauloDate.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function generateRoutePoints(
  center: { lat: number; lng: number },
  count: number,
): Array<{ lat: number; lng: number; timestamp: string }> {
  const points: Array<{ lat: number; lng: number; timestamp: string }> = [];
  const startTime = new Date(Date.now() - 2 * 3600000);

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const radius = 0.001 + Math.random() * 0.0015;
    const lat = center.lat + Math.cos(angle) * radius;
    const lng = center.lng + Math.sin(angle) * radius;
    const timestamp = new Date(startTime.getTime() + i * 5000);
    points.push({ lat, lng, timestamp: timestamp.toISOString() });
  }

  return points;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function upsertUser(params: {
  username: string;
  name: string;
  email: string;
  leagueId: string;
  trophies: number;
}): Promise<User> {
  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  return prisma.user.upsert({
    where: { username: params.username },
    update: {
      name: params.name,
      email: params.email,
      password: hashedPassword,
      leagueId: params.leagueId,
      trophies: params.trophies,
    },
    create: {
      username: params.username,
      name: params.name,
      email: params.email,
      password: hashedPassword,
      color: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`,
      level: randomInt(1, 15),
      xp: randomInt(0, 5000),
      trophies: params.trophies,
      leagueId: params.leagueId,
    },
  });
}

async function main() {
  console.log('🌱 Criando sala semanal fake para testes...\n');

  const league =
    (await prisma.league.findUnique({ where: { code: 'STARTER' } })) ||
    (await prisma.league.findFirst({ where: { isChampion: false }, orderBy: { order: 'asc' } }));

  if (!league) {
    console.log('❌ Nenhuma liga encontrada. Execute primeiro: npm run seed:leagues');
    return;
  }

  const weekKey = generateWeekKey();
  const { seasonNumber, weekNumber } = parseWeekKey(weekKey);
  const competitionRange = getCompetitionRange();

  const existingRooms = await prisma.weeklyRoom.findMany({
    where: { leagueId: league.id, weekKey },
    orderBy: { roomNumber: 'asc' },
  });

  const nextRoomNumber = existingRooms.length > 0
    ? Math.max(...existingRooms.map(r => r.roomNumber)) + 1
    : 1;

  const room = await prisma.weeklyRoom.create({
    data: {
      leagueId: league.id,
      seasonNumber,
      weekNumber,
      weekKey,
      roomNumber: nextRoomNumber,
      startDate: competitionRange.startDate,
      endDate: competitionRange.endDate,
      status: 'IN_PROGRESS',
    },
  });

  console.log(`✅ Sala criada: ${room.id} (Liga ${league.displayName})`);

  const fixedUsers = [
    { username: 'loki', name: 'Loki' },
    { username: 'denis', name: 'Denis' },
  ];

  const randomNames = [
    'Ana', 'Bruno', 'Carla', 'Diego', 'Edu', 'Fernanda', 'Gabi', 'Helena',
    'Igor', 'Julia', 'Kaua', 'Larissa', 'Mateus', 'Nina', 'Otavio', 'Paula',
    'Rafa', 'Sofia', 'Tiago', 'Vitoria', 'Wesley', 'Yara', 'Zeca',
  ];

  const users: User[] = [];

  for (const user of fixedUsers) {
    const created = await upsertUser({
      username: user.username,
      name: user.name,
      email: `${user.username}@example.com`,
      leagueId: league.id,
      trophies: randomInt(0, 200),
    });
    users.push(created);
  }

  const remaining = TOTAL_PARTICIPANTS - users.length;
  for (let i = 0; i < remaining; i++) {
    const name = randomNames[i % randomNames.length];
    const username = `${name.toLowerCase()}_${Date.now()}_${i}`;
    const created = await upsertUser({
      username,
      name,
      email: `${username}@example.com`,
      leagueId: league.id,
      trophies: randomInt(0, 200),
    });
    users.push(created);
  }

  // Limpar participações anteriores desses usuários na semana atual (se existir)
  await prisma.weeklyRun.deleteMany({
    where: {
      participant: {
        userId: { in: users.map(u => u.id) },
        weekKey,
      },
    },
  });
  await prisma.weeklyRoomParticipant.deleteMany({
    where: { userId: { in: users.map(u => u.id) }, weekKey },
  });

  // Criar participantes e corridas
  const participants: Array<{ id: string; totalPoints: number }> = [];

  for (const user of users) {
    const participant = await prisma.weeklyRoomParticipant.create({
      data: {
        roomId: room.id,
        userId: user.id,
        startingLeagueId: league.id,
        weekKey,
        totalPoints: 0,
        consistencyBonus: 0,
        runsValidCount: 0,
      },
    });

    const runsCount = 2;
    let totalPoints = 0;
    let runsValidCount = 0;

    for (let r = 0; r < runsCount; r++) {
      const center = { lat: -21.1774, lng: -47.8102 };
      const pathPoints = generateRoutePoints(center, 25);
      const startTime = new Date(pathPoints[0].timestamp);
      const endTime = new Date(pathPoints[pathPoints.length - 1].timestamp);
      const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
      const distance = randomInt(3000, 8000);
      const averagePace = duration > 0 ? duration / (distance / 1000) : 0;

      const run = await prisma.run.create({
        data: {
          userId: user.id,
          startTime,
          endTime,
          distance,
          duration,
          averagePace,
          maxSpeed: 3 + Math.random() * 3,
          elevationGain: randomInt(5, 80),
          calories: Math.floor(distance * 0.06),
          caption: `Corrida teste ${r + 1}`,
        },
      });

      await prisma.runPathPoint.createMany({
        data: pathPoints.map((point, idx) => ({
          runId: run.id,
          latitude: point.lat,
          longitude: point.lng,
          timestamp: new Date(point.timestamp),
          sequenceOrder: idx,
        })),
      });

      const paceSecKm = Math.floor(averagePace || randomInt(240, 420));
      const paceScore = randomInt(300, 600);
      const distanceScore = randomInt(60, 180);
      const smoothnessScore = randomInt(40, 120);
      const finalScore = paceScore + distanceScore + smoothnessScore;
      const isValid = true;

      await prisma.weeklyRun.create({
        data: {
          participantId: participant.id,
          roomId: room.id,
          runId: run.id,
          distanceMeters: distance,
          durationSeconds: duration,
          paceSecKm,
          paceScore,
          distanceScore,
          smoothnessScore,
          finalScore,
          dayKey: generateDayKey(startTime),
          countedDay: r < 2,
          countedWeek: r < 2,
          isValid,
          invalidReason: null,
          flags: undefined,
          multiplier: 1.0,
          submittedAt: startTime,
        },
      });

      totalPoints += finalScore;
      runsValidCount += 1;
    }

    const updatedParticipant = await prisma.weeklyRoomParticipant.update({
      where: { id: participant.id },
      data: {
        totalPoints,
        runsValidCount,
        consistencyBonus: randomInt(0, league.weeklyConsistencyMaxBonus),
      },
    });

    participants.push({ id: updatedParticipant.id, totalPoints: updatedParticipant.totalPoints });

    await prisma.weeklyEnrollment.upsert({
      where: {
        userId_weekKey: {
          userId: user.id,
          weekKey,
        },
      },
      update: {
        leagueId: league.id,
        seasonNumber,
        weekNumber,
      },
      create: {
        userId: user.id,
        weekKey,
        seasonNumber,
        weekNumber,
        leagueId: league.id,
      },
    });
  }

  // Atualizar posições (top 4 promovidos, bottom 4 rebaixados)
  const sortedParticipants = participants
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .map((p, index) => ({
      ...p,
      position: index + 1,
      promoted: index < 4,
      demoted: index >= Math.max(0, participants.length - 4),
    }));

  for (const participant of sortedParticipants) {
    await prisma.weeklyRoomParticipant.update({
      where: { id: participant.id },
      data: {
        position: participant.position,
        promoted: participant.promoted,
        demoted: participant.demoted,
      },
    });
  }

  console.log('\n✅ Seed finalizado!');
  console.log(`   - Sala: ${room.id}`);
  console.log(`   - Usuários: ${users.length} (inclui "loki" e "denis")`);
  console.log(`   - Semana: ${weekKey}`);
  console.log(`   - Liga: ${league.displayName}`);
  console.log(`   - Senha padrão: ${DEFAULT_PASSWORD}\n`);
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
