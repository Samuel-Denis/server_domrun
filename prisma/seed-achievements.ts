import { PrismaClient, AchievementCategory, AchievementRarity } from '@prisma/client';
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
 * Seed de conquistas iniciais do sistema
 *
 * Este script popula o catálogo de conquistas (Achievement) com as conquistas
 * padrão do jogo, permitindo que sejam ativadas/desativadas dinamicamente.
 */
async function main() {
    console.log('🌱 Iniciando seed de conquistas...\n');

    // Conquistas de corridas (RUN)
    const runAchievements = [
        {
            code: 'FIRST_RUN',
            title: 'Primeiros Passos',
            description: 'Complete sua primeira corrida',
            category: AchievementCategory.RUN,
            rarity: AchievementRarity.COMMON,
            iconAsset: 'achievements/first_run.png',
            isActive: true,
            isHidden: false,
            criteriaJson: { runs: 1 },
            rewardJson: { xp: 100 },
            seasonNumber: null,
        },
        {
            code: 'RUN_10',
            title: 'Corredor Iniciante',
            description: 'Complete 10 corridas',
            category: AchievementCategory.RUN,
            rarity: AchievementRarity.COMMON,
            iconAsset: 'achievements/run_10.png',
            isActive: true,
            isHidden: false,
            criteriaJson: { runs: 10 },
            rewardJson: { xp: 200, },
            seasonNumber: null,
        },
        {
            code: 'RUN_50',
            title: 'Corredor Experiente',
            description: 'Complete 50 corridas',
            category: AchievementCategory.RUN,
            rarity: AchievementRarity.RARE,
            iconAsset: 'achievements/run_50.png',
            isActive: true,
            isHidden: false,
            criteriaJson: { runs: 50 },
            rewardJson: { xp: 500, },
            seasonNumber: null,
        },
        {
            code: 'RUN_100',
            title: 'Maratonista',
            description: 'Complete 100 corridas',
            category: AchievementCategory.RUN,
            rarity: AchievementRarity.EPIC,
            iconAsset: 'achievements/run_100.png',
            isActive: true,
            isHidden: false,
            criteriaJson: { runs: 100 },
            rewardJson: { xp: 1000, },
            seasonNumber: null,
        },
        {
            code: 'DISTANCE_10KM',
            title: 'Distância Curta',
            description: 'Corra 10 km no total',
            category: AchievementCategory.RUN,
            rarity: AchievementRarity.COMMON,
            iconAsset: 'achievements/distance_10km.png',
            isActive: true,
            isHidden: false,
            criteriaJson: { distanceKm: 10 },
            rewardJson: { xp: 150, },
            seasonNumber: null,
        },
        {
            code: 'DISTANCE_100KM',
            title: 'Centenário',
            description: 'Corra 100 km no total',
            category: AchievementCategory.RUN,
            rarity: AchievementRarity.RARE,
            iconAsset: 'achievements/distance_100km.png',
            isActive: true,
            isHidden: false,
            criteriaJson: { distanceKm: 100 },
            rewardJson: { xp: 800, },
            seasonNumber: null,
        },
        {
            code: 'LONG_RUN_5KM',
            title: 'Corrida Longa',
            description: 'Complete uma corrida de 5 km ou mais',
            category: AchievementCategory.RUN,
            rarity: AchievementRarity.COMMON,
            iconAsset: 'achievements/long_run_5km.png',
            isActive: true,
            isHidden: false,
            criteriaJson: { singleRunDistanceKm: 5 },
            rewardJson: { xp: 200, },
            seasonNumber: null,
        },
        {
            code: 'STREAK_7',
            title: 'Semana de Fogo',
            description: 'Corra 7 dias consecutivos',
            category: AchievementCategory.RUN,
            rarity: AchievementRarity.RARE,
            iconAsset: 'achievements/streak_7.png',
            isActive: true,
            isHidden: false,
            criteriaJson: { consecutiveDays: 7 },
            rewardJson: { xp: 400, },
            seasonNumber: null,
        },

        // ==========================
        // NOVAS (RUN) — Criativas
        // ==========================
        {
            code: 'PACE_CONSISTENT_5',
            title: 'Ritmo de Relógio',
            description: 'Complete uma corrida com variação de pace inferior a 5%',
            category: AchievementCategory.RUN,
            rarity: AchievementRarity.RARE,
            iconAsset: 'achievements/pace_consistent_5.png',
            isActive: true,
            isHidden: false,
            criteriaJson: { paceVariationPercent: 5 },
            rewardJson: { xp: 400, },
            seasonNumber: null,
        },
        {
            code: 'EARLY_BIRD',
            title: 'Madrugador',
            description: 'Complete uma corrida entre 5h e 6h da manhã',
            category: AchievementCategory.RUN,
            rarity: AchievementRarity.COMMON,
            iconAsset: 'achievements/early_bird.png',
            isActive: true,
            isHidden: false,
            criteriaJson: { startHourBetween: [5, 6] },
            rewardJson: { xp: 150, },
            seasonNumber: null,
        },
        {
            code: 'WEEKLY_DISCIPLINE',
            title: 'Disciplina Semanal',
            description: 'Complete 5 corridas em dias diferentes na mesma semana',
            category: AchievementCategory.RUN,
            rarity: AchievementRarity.RARE,
            iconAsset: 'achievements/weekly_discipline.png',
            isActive: true,
            isHidden: false,
            criteriaJson: { runsInWeek: 5, differentDays: true },
            rewardJson: { xp: 500, },
            seasonNumber: null,
        },
        {
            code: 'LAST_HOUR_RUN',
            title: 'No Apagar das Luzes',
            description: 'Complete uma corrida válida na última hora antes do fechamento da semana',
            category: AchievementCategory.RUN,
            rarity: AchievementRarity.EPIC,
            iconAsset: 'achievements/last_hour_run.png',
            isActive: true,
            isHidden: false,
            criteriaJson: { lastHourOfWeek: true },
            rewardJson: { xp: 600, },
            seasonNumber: null,
        },
    ];

    // Conquistas de territórios (TERRITORY)
    const territoryAchievements = [
        {
            code: 'FIRST_TERRITORY',
            title: 'Explorador',
            description: 'Capture seu primeiro território',
            category: AchievementCategory.TERRITORY,
            rarity: AchievementRarity.COMMON,
            iconAsset: 'achievements/first_territory.png',
            isActive: true,
            isHidden: false,
            criteriaJson: { territories: 1 },
            rewardJson: { xp: 150, },
            seasonNumber: null,
        },
        {
            code: 'TERRITORY_10',
            title: 'Conquistador',
            description: 'Capture 10 territórios',
            category: AchievementCategory.TERRITORY,
            rarity: AchievementRarity.RARE,
            iconAsset: 'achievements/territory_10.png',
            isActive: true,
            isHidden: false,
            criteriaJson: { territories: 10 },
            rewardJson: { xp: 600, },
            seasonNumber: null,
        },
        {
            code: 'TERRITORY_AREA_1000',
            title: 'Domínio Territorial',
            description: 'Acumule 1000 m² de territórios conquistados',
            category: AchievementCategory.TERRITORY,
            rarity: AchievementRarity.EPIC,
            iconAsset: 'achievements/territory_area_1000.png',
            isActive: true,
            isHidden: false,
            criteriaJson: { totalAreaM2: 1000 },
            rewardJson: { xp: 800, },
            seasonNumber: null,
        },

        // ==========================
        // NOVAS (TERRITORY) — Criativas
        // ==========================
        {
            code: 'NEW_CITY_TERRITORY',
            title: 'Explorador Urbano',
            description: 'Capture territórios em 3 cidades diferentes',
            category: AchievementCategory.TERRITORY,
            rarity: AchievementRarity.RARE,
            iconAsset: 'achievements/new_city_territory.png',
            isActive: true,
            isHidden: false,
            criteriaJson: { uniqueCities: 3 },
            rewardJson: { xp: 500, },
            seasonNumber: null,
        },
        {
            code: 'TERRITORY_CHAIN',
            title: 'Linha de Domínio',
            description: 'Capture 5 territórios adjacentes sem perder nenhum',
            category: AchievementCategory.TERRITORY,
            rarity: AchievementRarity.EPIC,
            iconAsset: 'achievements/territory_chain.png',
            isActive: true,
            isHidden: false,
            criteriaJson: { adjacentTerritories: 5 },
            rewardJson: { xp: 700, },
            seasonNumber: null,
        },
        {
            code: 'TERRITORY_STEAL',
            title: 'Golpe Estratégico',
            description: 'Capture um território que pertencia a outro jogador',
            category: AchievementCategory.TERRITORY,
            rarity: AchievementRarity.RARE,
            iconAsset: 'achievements/territory_steal.png',
            isActive: true,
            isHidden: false,
            criteriaJson: { territorySteal: 1 },
            rewardJson: { xp: 400, },
            seasonNumber: null,
        },
    ];

    // Conquistas sociais (SOCIAL)
    const socialAchievements = [
        {
            code: 'FIRST_BATTLE',
            title: 'Primeiro Combate',
            description: 'Participe da sua primeira batalha PvP',
            category: AchievementCategory.SOCIAL,
            rarity: AchievementRarity.COMMON,
            iconAsset: 'achievements/first_battle.png',
            isActive: true,
            isHidden: false,
            criteriaJson: { battles: 1 },
            rewardJson: { xp: 100, },
            seasonNumber: null,
        },
        {
            code: 'BATTLE_WIN_10',
            title: 'Vencedor',
            description: 'Vença 10 batalhas PvP',
            category: AchievementCategory.SOCIAL,
            rarity: AchievementRarity.RARE,
            iconAsset: 'achievements/battle_win_10.png',
            isActive: true,
            isHidden: false,
            criteriaJson: { battleWins: 10 },
            rewardJson: { xp: 500, },
            seasonNumber: null,
        },
        {
            code: 'WIN_STREAK_5',
            title: 'Sequência de Vitórias',
            description: 'Conquiste 5 vitórias consecutivas',
            category: AchievementCategory.SOCIAL,
            rarity: AchievementRarity.EPIC,
            iconAsset: 'achievements/win_streak_5.png',
            isActive: true,
            isHidden: false,
            criteriaJson: { winStreak: 5 },
            rewardJson: { xp: 600, },
            seasonNumber: null,
        },

        // ==========================
        // NOVAS (SOCIAL) — Criativas
        // ==========================
        {
            code: 'RIVAL_WIN_3',
            title: 'Rivalidade Acirrada',
            description: 'Vença o mesmo jogador 3 vezes',
            category: AchievementCategory.SOCIAL,
            rarity: AchievementRarity.EPIC,
            iconAsset: 'achievements/rival_win_3.png',
            isActive: true,
            isHidden: false,
            criteriaJson: { winsAgainstSameUser: 3 },
            rewardJson: { xp: 600, },
            seasonNumber: null,
        },
        {
            code: 'COMEBACK_WIN',
            title: 'Virada Épica',
            description: 'Vença uma batalha após estar em desvantagem',
            category: AchievementCategory.SOCIAL,
            rarity: AchievementRarity.LEGENDARY,
            iconAsset: 'achievements/comeback_win.png',
            isActive: true,
            isHidden: false,
            criteriaJson: { comebackWin: true },
            rewardJson: { xp: 1200, },
            seasonNumber: null,
        },
        {
            code: 'FRIENDLY_RIVAL',
            title: 'Rival Amigável',
            description: 'Adicione como amigo um jogador após uma batalha',
            category: AchievementCategory.SOCIAL,
            rarity: AchievementRarity.COMMON,
            iconAsset: 'achievements/friendly_rival.png',
            isActive: true,
            isHidden: false,
            criteriaJson: { friendAfterBattle: 1 },
            rewardJson: { xp: 200, },
            seasonNumber: null,
        },
    ];

    // Conquistas de ligas (LEAGUE)
    const leagueAchievements = [
        {
            code: 'LEAGUE_PROMOTION',
            title: 'Ascensão',
            description: 'Seja promovido para uma liga superior',
            category: AchievementCategory.LEAGUE,
            rarity: AchievementRarity.RARE,
            iconAsset: 'achievements/league_promotion.png',
            isActive: true,
            isHidden: false,
            criteriaJson: { promotions: 1 },
            rewardJson: { xp: 300, },
            seasonNumber: null,
        },
        {
            code: 'WEEKLY_TOP_4',
            title: 'Top da Semana',
            description: 'Termine entre os 4 primeiros em uma sala semanal',
            category: AchievementCategory.LEAGUE,
            rarity: AchievementRarity.EPIC,
            iconAsset: 'achievements/weekly_top_4.png',
            isActive: true,
            isHidden: false,
            criteriaJson: { weeklyTop4: 1 },
            rewardJson: { xp: 500, },
            seasonNumber: null,
        },

        // ==========================
        // NOVAS (LEAGUE) — Criativas
        // ==========================
        {
            code: 'PERFECT_WEEK',
            title: 'Semana Perfeita',
            description: 'Complete 5 corridas válidas e termine no Top 4 da sala',
            category: AchievementCategory.LEAGUE,
            rarity: AchievementRarity.EPIC,
            iconAsset: 'achievements/perfect_week.png',
            isActive: true,
            isHidden: false,
            criteriaJson: { top4: true, validRuns: 5 },
            rewardJson: { xp: 800, },
            seasonNumber: null,
        },
        {
            code: 'AVOID_RELEGATION',
            title: 'Sobrevivente',
            description: 'Permaneça na liga por menos de 50 pontos da zona de rebaixamento',
            category: AchievementCategory.LEAGUE,
            rarity: AchievementRarity.RARE,
            iconAsset: 'achievements/avoid_relegation.png',
            isActive: true,
            isHidden: false,
            criteriaJson: { avoidedRelegationByPoints: 50 },
            rewardJson: { xp: 500, },
            seasonNumber: null,
        },
    ];

    // Conquistas de marcos (MILESTONE)
    const milestoneAchievements = [
        {
            code: 'LEVEL_10',
            title: 'Nível 10',
            description: 'Alcance o nível 10',
            category: AchievementCategory.MILESTONE,
            rarity: AchievementRarity.COMMON,
            iconAsset: 'achievements/level_10.png',
            isActive: true,
            isHidden: false,
            criteriaJson: { level: 10 },
            rewardJson: { xp: 200, },
            seasonNumber: null,
        },
        {
            code: 'LEVEL_25',
            title: 'Nível 25',
            description: 'Alcance o nível 25',
            category: AchievementCategory.MILESTONE,
            rarity: AchievementRarity.RARE,
            iconAsset: 'achievements/level_25.png',
            isActive: true,
            isHidden: false,
            criteriaJson: { level: 25 },
            rewardJson: { xp: 500, },
            seasonNumber: null,
        },
        {
            code: 'LEVEL_50',
            title: 'Nível 50',
            description: 'Alcance o nível 50',
            category: AchievementCategory.MILESTONE,
            rarity: AchievementRarity.EPIC,
            iconAsset: 'achievements/level_50.png',
            isActive: true,
            isHidden: false,
            criteriaJson: { level: 50 },
            rewardJson: { xp: 1000, },
            seasonNumber: null,
        },
        {
            code: 'TROPHIES_1000',
            title: 'Colecionador de Troféus',
            description: 'Acumule 1000 troféus',
            category: AchievementCategory.MILESTONE,
            rarity: AchievementRarity.LEGENDARY,
            iconAsset: 'achievements/trophies_1000.png',
            isActive: true,
            isHidden: false,
            criteriaJson: { trophies: 1000 },
            rewardJson: { xp: 1500 },
            seasonNumber: null,
        },

        // ==========================
        // NOVAS (MILESTONE) — Criativas
        // ==========================
        {
            code: 'STREAK_30',
            title: 'Imparável',
            description: 'Corra 30 dias consecutivos',
            category: AchievementCategory.MILESTONE,
            rarity: AchievementRarity.LEGENDARY,
            iconAsset: 'achievements/streak_30.png',
            isActive: true,
            isHidden: false,
            criteriaJson: { consecutiveDays: 30 },
            rewardJson: { xp: 2000, },
            seasonNumber: null,
        },
        {
            code: 'ALL_ROUNDER',
            title: 'Atleta Completo',
            description: 'Desbloqueie ao menos uma conquista de cada categoria',
            category: AchievementCategory.MILESTONE,
            rarity: AchievementRarity.LEGENDARY,
            iconAsset: 'achievements/all_rounder.png',
            isActive: true,
            isHidden: false,
            criteriaJson: { categoriesCompleted: ['RUN', 'TERRITORY', 'SOCIAL', 'LEAGUE'] },
            rewardJson: { xp: 2500, },
            seasonNumber: null,
        },
    ];

    // Conquista secreta (exemplo)
    const secretAchievement = {
        code: 'SECRET_UNLOCKED',
        title: '???',
        description: 'Conquista secreta',
        category: AchievementCategory.MILESTONE,
        rarity: AchievementRarity.LEGENDARY,
        iconAsset: 'achievements/secret.png',
        isActive: true,
        isHidden: true, // Secreta!
        criteriaJson: { secretCondition: true },
        rewardJson: { xp: 2000, },
        seasonNumber: null,
    };

    // ==========================
    // NOVAS SECRETAS — Criativas
    // ==========================
    const secretAchievements = [
        {
            code: 'SILENT_GRIND',
            title: '???',
            description: 'Conquista secreta',
            category: AchievementCategory.MILESTONE,
            rarity: AchievementRarity.LEGENDARY,
            iconAsset: 'achievements/silent_grind.png',
            isActive: true,
            isHidden: true,
            criteriaJson: { noSocialInteractionRuns: 50 },
            rewardJson: { xp: 3000, trophies: 500 },
            seasonNumber: null,
        },
        {
            code: 'CHAMPION_SURVIVOR',
            title: '???',
            description: 'Conquista secreta',
            category: AchievementCategory.LEAGUE,
            rarity: AchievementRarity.LEGENDARY,
            iconAsset: 'achievements/champion_survivor.png',
            isActive: true,
            isHidden: true,
            criteriaJson: { weeksInChampion: 4 },
            rewardJson: { xp: 4000, trophies: 600 },
            seasonNumber: null,
        },
    ];

    const allAchievements = [
        ...runAchievements,
        ...territoryAchievements,
        ...socialAchievements,
        ...leagueAchievements,
        ...milestoneAchievements,
        secretAchievement,
        ...secretAchievements,
    ];

    console.log(`📋 Total de conquistas a criar: ${allAchievements.length}\n`);

    let created = 0;
    let skipped = 0;

    for (const achievementData of allAchievements) {
        try {
            // Verificar se já existe
            const existing = await prisma.achievement.findUnique({
                where: { code: achievementData.code },
            });

            if (existing) {
                console.log(`⏭️  Conquista "${achievementData.code}" já existe, pulando...`);
                skipped++;
                continue;
            }

            // Criar conquista
            await prisma.achievement.create({
                data: achievementData,
            });

            console.log(`✅ Criada: ${achievementData.code} - ${achievementData.title}`);
            created++;
        } catch (error: any) {
            console.error(`❌ Erro ao criar "${achievementData.code}":`, error.message);
        }
    }

    console.log(`\n✅ Seed de conquistas concluído!`);
    console.log(`   - Criadas: ${created}`);
    console.log(`   - Já existiam: ${skipped}`);
    console.log(`   - Total: ${allAchievements.length}\n`);
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
