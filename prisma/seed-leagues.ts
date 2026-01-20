import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';


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

/**
 * Seed das Ligas Esportivas
 * 
 * Cria todas as ligas do sistema com seus parâmetros de balanceamento.
 * Garante que não sejam criadas ligas duplicadas.
 */
async function main() {
    console.log('🏆 Iniciando seed das ligas...');

    const leagues = [
        {
            code: 'STARTER',
            displayName: 'Starter',
            order: 1,
            isChampion: false,
            paceTopSecKm: 300, // 5:00 min/km
            paceBaseSecKm: 600, // 10:00 min/km
            smurfCapSecKm: 240, // 4:00 min/km (anti-smurf)
            weeklyConsistencyMaxBonus: 400,
            minTrophiesToEnter: null,
        },
        {
            code: 'RITMO',
            displayName: 'Ritmo',
            order: 2,
            isChampion: false,
            paceTopSecKm: 270, // 4:30 min/km
            paceBaseSecKm: 540, // 9:00 min/km
            smurfCapSecKm: 210, // 3:30 min/km (anti-smurf)
            weeklyConsistencyMaxBonus: 400,
            minTrophiesToEnter: null,
        },
        {
            code: 'CADENCIA',
            displayName: 'Cadência',
            order: 3,
            isChampion: false,
            paceTopSecKm: 240, // 4:00 min/km
            paceBaseSecKm: 480, // 8:00 min/km
            smurfCapSecKm: null,
            weeklyConsistencyMaxBonus: 250,
            minTrophiesToEnter: null,
        },
        {
            code: 'ENDURANCE',
            displayName: 'Endurance',
            order: 4,
            isChampion: false,
            paceTopSecKm: 210, // 3:30 min/km
            paceBaseSecKm: 420, // 7:00 min/km
            smurfCapSecKm: null,
            weeklyConsistencyMaxBonus: 250,
            minTrophiesToEnter: null,
        },
        {
            code: 'ATLETA',
            displayName: 'Atleta',
            order: 5,
            isChampion: false,
            paceTopSecKm: 180, // 3:00 min/km
            paceBaseSecKm: 360, // 6:00 min/km
            smurfCapSecKm: null,
            weeklyConsistencyMaxBonus: 250,
            minTrophiesToEnter: null,
        },
        {
            code: 'ELITE',
            displayName: 'Elite',
            order: 6,
            isChampion: false,
            paceTopSecKm: 180, // 3:00 min/km
            paceBaseSecKm: 300, // 5:00 min/km
            smurfCapSecKm: null,
            weeklyConsistencyMaxBonus: 250,
            minTrophiesToEnter: null,
        },
        {
            code: 'IMMORTAL',
            displayName: 'Imortal',
            order: 7,
            isChampion: true,
            paceTopSecKm: 180, // 3:00 min/km
            paceBaseSecKm: 240, // 4:00 min/km
            smurfCapSecKm: null,
            weeklyConsistencyMaxBonus: 250,
            minTrophiesToEnter: 3000,
        },
    ];

    for (const leagueData of leagues) {
        try {
            // Upsert: cria se não existe, atualiza se já existe
            const league = await prisma.league.upsert({
                where: { code: leagueData.code },
                update: {
                    displayName: leagueData.displayName,
                    order: leagueData.order,
                    isChampion: leagueData.isChampion,
                    paceTopSecKm: leagueData.paceTopSecKm,
                    paceBaseSecKm: leagueData.paceBaseSecKm,
                    smurfCapSecKm: leagueData.smurfCapSecKm,
                    weeklyConsistencyMaxBonus: leagueData.weeklyConsistencyMaxBonus,
                    minTrophiesToEnter: leagueData.minTrophiesToEnter,
                },
                create: leagueData,
            });

            console.log(`✅ Liga "${league.displayName}" (${league.code}) criada/atualizada`);
        } catch (error: any) {
            console.error(`❌ Erro ao criar liga ${leagueData.code}:`, error.message);
        }
    }

    console.log('✨ Seed das ligas concluído!');
}

main()
    .catch((e) => {
        console.error('❌ Erro no seed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
