-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateEnum
CREATE TYPE "WeeklyRoomStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'FINISHED', 'CLOSED');

-- CreateEnum
CREATE TYPE "AchievementCategory" AS ENUM ('RUN', 'TERRITORY', 'SOCIAL', 'LEAGUE', 'EVENT', 'MILESTONE');

-- CreateEnum
CREATE TYPE "AchievementRarity" AS ENUM ('COMMON', 'RARE', 'EPIC', 'LEGENDARY');

-- CreateEnum
CREATE TYPE "AchievementStatus" AS ENUM ('LOCKED', 'IN_PROGRESS', 'UNLOCKED', 'CLAIMED');

-- CreateEnum
CREATE TYPE "BattleStatus" AS ENUM ('SEARCHING', 'IN_PROGRESS', 'FINISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FriendshipStatus" AS ENUM ('PENDING', 'ACCEPTED', 'BLOCKED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#FF0000',
    "biography" TEXT,
    "photoUrl" TEXT,
    "lastLogin" TIMESTAMP(3),
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "trophies" INTEGER NOT NULL DEFAULT 0,
    "winStreak" INTEGER NOT NULL DEFAULT 0,
    "battleWins" INTEGER NOT NULL DEFAULT 0,
    "battleLosses" INTEGER NOT NULL DEFAULT 0,
    "leagueId" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leagues" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "isChampion" BOOLEAN NOT NULL DEFAULT false,
    "minTrophiesToEnter" INTEGER,
    "paceTopSecKm" INTEGER NOT NULL,
    "paceBaseSecKm" INTEGER NOT NULL,
    "smurfCapSecKm" INTEGER,
    "weeklyConsistencyMaxBonus" INTEGER NOT NULL,
    "shieldName" TEXT,
    "shieldAsset" TEXT,
    "rewardJson" JSONB,
    "themeJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leagues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_enrollments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekKey" TEXT NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "leagueId" TEXT NOT NULL,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weekly_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_rooms" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "weekKey" TEXT NOT NULL,
    "roomNumber" INTEGER NOT NULL DEFAULT 1,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "WeeklyRoomStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekly_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_room_participants" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startingLeagueId" TEXT NOT NULL,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "consistencyBonus" INTEGER NOT NULL DEFAULT 0,
    "runsValidCount" INTEGER NOT NULL DEFAULT 0,
    "position" INTEGER,
    "promoted" BOOLEAN NOT NULL DEFAULT false,
    "demoted" BOOLEAN NOT NULL DEFAULT false,
    "endingLeagueId" TEXT,
    "processedAt" TIMESTAMP(3),
    "weekKey" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weekly_room_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_runs" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "distanceMeters" INTEGER NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "paceSecKm" INTEGER NOT NULL,
    "paceScore" INTEGER NOT NULL,
    "distanceScore" INTEGER NOT NULL,
    "smoothnessScore" INTEGER NOT NULL,
    "finalScore" INTEGER NOT NULL,
    "dayKey" TEXT NOT NULL,
    "countedDay" BOOLEAN NOT NULL DEFAULT false,
    "countedWeek" BOOLEAN NOT NULL DEFAULT false,
    "isValid" BOOLEAN NOT NULL DEFAULT true,
    "invalidReason" TEXT,
    "flags" JSONB,
    "multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weekly_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "champion_runs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "distanceMeters" INTEGER NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "paceSecKm" INTEGER NOT NULL,
    "finalScore" INTEGER NOT NULL,
    "trophiesEarned" INTEGER NOT NULL DEFAULT 0,
    "isValid" BOOLEAN NOT NULL DEFAULT true,
    "invalidReason" TEXT,
    "flags" JSONB,
    "multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "champion_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "champion_weekly_summaries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "weekKey" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "validRunsCount" INTEGER NOT NULL DEFAULT 0,
    "trophiesEarnedWeek" INTEGER NOT NULL DEFAULT 0,
    "trophiesPenaltyWeek" INTEGER NOT NULL DEFAULT 0,
    "trophiesBefore" INTEGER NOT NULL,
    "trophiesAfter" INTEGER NOT NULL,
    "demoted" BOOLEAN NOT NULL DEFAULT false,
    "demotedToLeagueId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "champion_weekly_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "territories" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT,
    "userColor" TEXT,
    "areaName" TEXT,
    "area" DOUBLE PRECISION,
    "capturedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "geometry" geometry(Polygon, 4326) NOT NULL,

    CONSTRAINT "territories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "runs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "distance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "averagePace" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxSpeed" DOUBLE PRECISION,
    "elevationGain" DOUBLE PRECISION,
    "calories" INTEGER,
    "caption" TEXT,
    "territoryId" TEXT,
    "mapImageUrl" TEXT,
    "mapImageCleanUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "run_path_points" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "sequenceOrder" INTEGER NOT NULL,

    CONSTRAINT "run_path_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievements" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "AchievementCategory" NOT NULL,
    "rarity" "AchievementRarity" NOT NULL,
    "iconAsset" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "criteriaJson" JSONB,
    "rewardJson" JSONB,
    "seasonNumber" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_achievements" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "status" "AchievementStatus" NOT NULL DEFAULT 'LOCKED',
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "currentValue" DOUBLE PRECISION,
    "targetValue" DOUBLE PRECISION,
    "progressText" TEXT,
    "unlockedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_achievement_progress" (
    "id" TEXT NOT NULL,
    "userAchievementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "progressData" JSONB,
    "currentValue" DOUBLE PRECISION,
    "targetValue" DOUBLE PRECISION,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_achievement_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battles" (
    "id" TEXT NOT NULL,
    "player1Id" TEXT NOT NULL,
    "player2Id" TEXT,
    "status" "BattleStatus" NOT NULL DEFAULT 'SEARCHING',
    "winnerId" TEXT,
    "mode" TEXT NOT NULL,
    "p1Score" DOUBLE PRECISION,
    "p2Score" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "battles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "friendship_edges" (
    "id" TEXT NOT NULL,
    "userLowId" TEXT NOT NULL,
    "userHighId" TEXT NOT NULL,
    "initiatedByUserId" TEXT NOT NULL,
    "status" "FriendshipStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "friendship_edges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_username_idx" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_trophies_idx" ON "users"("trophies");

-- CreateIndex
CREATE INDEX "users_leagueId_idx" ON "users"("leagueId");

-- CreateIndex
CREATE UNIQUE INDEX "leagues_code_key" ON "leagues"("code");

-- CreateIndex
CREATE UNIQUE INDEX "leagues_order_key" ON "leagues"("order");

-- CreateIndex
CREATE INDEX "leagues_code_idx" ON "leagues"("code");

-- CreateIndex
CREATE INDEX "leagues_order_idx" ON "leagues"("order");

-- CreateIndex
CREATE INDEX "leagues_isChampion_idx" ON "leagues"("isChampion");

-- CreateIndex
CREATE INDEX "weekly_enrollments_weekKey_idx" ON "weekly_enrollments"("weekKey");

-- CreateIndex
CREATE INDEX "weekly_enrollments_userId_idx" ON "weekly_enrollments"("userId");

-- CreateIndex
CREATE INDEX "weekly_enrollments_leagueId_idx" ON "weekly_enrollments"("leagueId");

-- CreateIndex
CREATE INDEX "weekly_enrollments_enrolledAt_idx" ON "weekly_enrollments"("enrolledAt");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_enrollments_userId_weekKey_key" ON "weekly_enrollments"("userId", "weekKey");

-- CreateIndex
CREATE INDEX "weekly_rooms_leagueId_seasonNumber_weekNumber_idx" ON "weekly_rooms"("leagueId", "seasonNumber", "weekNumber");

-- CreateIndex
CREATE INDEX "weekly_rooms_weekKey_idx" ON "weekly_rooms"("weekKey");

-- CreateIndex
CREATE INDEX "weekly_rooms_leagueId_status_idx" ON "weekly_rooms"("leagueId", "status");

-- CreateIndex
CREATE INDEX "weekly_rooms_startDate_idx" ON "weekly_rooms"("startDate");

-- CreateIndex
CREATE INDEX "weekly_rooms_endDate_idx" ON "weekly_rooms"("endDate");

-- CreateIndex
CREATE INDEX "weekly_rooms_status_idx" ON "weekly_rooms"("status");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_rooms_leagueId_seasonNumber_weekNumber_roomNumber_key" ON "weekly_rooms"("leagueId", "seasonNumber", "weekNumber", "roomNumber");

-- CreateIndex
CREATE INDEX "weekly_room_participants_roomId_idx" ON "weekly_room_participants"("roomId");

-- CreateIndex
CREATE INDEX "weekly_room_participants_userId_idx" ON "weekly_room_participants"("userId");

-- CreateIndex
CREATE INDEX "weekly_room_participants_weekKey_idx" ON "weekly_room_participants"("weekKey");

-- CreateIndex
CREATE INDEX "weekly_room_participants_roomId_totalPoints_idx" ON "weekly_room_participants"("roomId", "totalPoints" DESC);

-- CreateIndex
CREATE INDEX "weekly_room_participants_startingLeagueId_idx" ON "weekly_room_participants"("startingLeagueId");

-- CreateIndex
CREATE INDEX "weekly_room_participants_endingLeagueId_idx" ON "weekly_room_participants"("endingLeagueId");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_room_participants_roomId_userId_key" ON "weekly_room_participants"("roomId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_room_participants_userId_weekKey_key" ON "weekly_room_participants"("userId", "weekKey");

-- CreateIndex
CREATE INDEX "weekly_runs_participantId_idx" ON "weekly_runs"("participantId");

-- CreateIndex
CREATE INDEX "weekly_runs_participantId_dayKey_idx" ON "weekly_runs"("participantId", "dayKey");

-- CreateIndex
CREATE INDEX "weekly_runs_roomId_idx" ON "weekly_runs"("roomId");

-- CreateIndex
CREATE INDEX "weekly_runs_runId_idx" ON "weekly_runs"("runId");

-- CreateIndex
CREATE INDEX "weekly_runs_submittedAt_idx" ON "weekly_runs"("submittedAt");

-- CreateIndex
CREATE INDEX "weekly_runs_isValid_idx" ON "weekly_runs"("isValid");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_runs_roomId_runId_key" ON "weekly_runs"("roomId", "runId");

-- CreateIndex
CREATE INDEX "champion_runs_userId_idx" ON "champion_runs"("userId");

-- CreateIndex
CREATE INDEX "champion_runs_runId_idx" ON "champion_runs"("runId");

-- CreateIndex
CREATE INDEX "champion_runs_submittedAt_idx" ON "champion_runs"("submittedAt");

-- CreateIndex
CREATE INDEX "champion_runs_isValid_idx" ON "champion_runs"("isValid");

-- CreateIndex
CREATE UNIQUE INDEX "champion_runs_userId_runId_key" ON "champion_runs"("userId", "runId");

-- CreateIndex
CREATE INDEX "champion_weekly_summaries_userId_idx" ON "champion_weekly_summaries"("userId");

-- CreateIndex
CREATE INDEX "champion_weekly_summaries_weekKey_idx" ON "champion_weekly_summaries"("weekKey");

-- CreateIndex
CREATE INDEX "champion_weekly_summaries_seasonNumber_weekNumber_idx" ON "champion_weekly_summaries"("seasonNumber", "weekNumber");

-- CreateIndex
CREATE INDEX "champion_weekly_summaries_weekStart_idx" ON "champion_weekly_summaries"("weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "champion_weekly_summaries_userId_seasonNumber_weekNumber_key" ON "champion_weekly_summaries"("userId", "seasonNumber", "weekNumber");

-- CreateIndex
CREATE INDEX "territory_geometry_idx" ON "territories" USING GIST ("geometry");

-- CreateIndex
CREATE INDEX "territories_userId_idx" ON "territories"("userId");

-- CreateIndex
CREATE INDEX "territories_capturedAt_idx" ON "territories"("capturedAt");

-- CreateIndex
CREATE INDEX "runs_userId_idx" ON "runs"("userId");

-- CreateIndex
CREATE INDEX "runs_startTime_idx" ON "runs"("startTime");

-- CreateIndex
CREATE INDEX "runs_territoryId_idx" ON "runs"("territoryId");

-- CreateIndex
CREATE INDEX "run_path_points_runId_idx" ON "run_path_points"("runId");

-- CreateIndex
CREATE INDEX "run_path_points_runId_sequenceOrder_idx" ON "run_path_points"("runId", "sequenceOrder");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "achievements_code_key" ON "achievements"("code");

-- CreateIndex
CREATE INDEX "achievements_code_idx" ON "achievements"("code");

-- CreateIndex
CREATE INDEX "achievements_category_idx" ON "achievements"("category");

-- CreateIndex
CREATE INDEX "achievements_rarity_idx" ON "achievements"("rarity");

-- CreateIndex
CREATE INDEX "achievements_isActive_idx" ON "achievements"("isActive");

-- CreateIndex
CREATE INDEX "achievements_isHidden_idx" ON "achievements"("isHidden");

-- CreateIndex
CREATE INDEX "achievements_seasonNumber_idx" ON "achievements"("seasonNumber");

-- CreateIndex
CREATE INDEX "achievements_createdAt_idx" ON "achievements"("createdAt");

-- CreateIndex
CREATE INDEX "user_achievements_userId_idx" ON "user_achievements"("userId");

-- CreateIndex
CREATE INDEX "user_achievements_achievementId_idx" ON "user_achievements"("achievementId");

-- CreateIndex
CREATE INDEX "user_achievements_userId_status_idx" ON "user_achievements"("userId", "status");

-- CreateIndex
CREATE INDEX "user_achievements_status_idx" ON "user_achievements"("status");

-- CreateIndex
CREATE INDEX "user_achievements_unlockedAt_idx" ON "user_achievements"("unlockedAt");

-- CreateIndex
CREATE INDEX "user_achievements_claimedAt_idx" ON "user_achievements"("claimedAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_achievements_userId_achievementId_key" ON "user_achievements"("userId", "achievementId");

-- CreateIndex
CREATE INDEX "user_achievement_progress_userAchievementId_idx" ON "user_achievement_progress"("userAchievementId");

-- CreateIndex
CREATE INDEX "user_achievement_progress_userId_idx" ON "user_achievement_progress"("userId");

-- CreateIndex
CREATE INDEX "user_achievement_progress_lastUpdated_idx" ON "user_achievement_progress"("lastUpdated");

-- CreateIndex
CREATE INDEX "battles_player1Id_idx" ON "battles"("player1Id");

-- CreateIndex
CREATE INDEX "battles_player2Id_idx" ON "battles"("player2Id");

-- CreateIndex
CREATE INDEX "battles_status_idx" ON "battles"("status");

-- CreateIndex
CREATE INDEX "battles_winnerId_idx" ON "battles"("winnerId");

-- CreateIndex
CREATE INDEX "friendship_edges_userLowId_status_idx" ON "friendship_edges"("userLowId", "status");

-- CreateIndex
CREATE INDEX "friendship_edges_userHighId_status_idx" ON "friendship_edges"("userHighId", "status");

-- CreateIndex
CREATE INDEX "friendship_edges_initiatedByUserId_idx" ON "friendship_edges"("initiatedByUserId");

-- CreateIndex
CREATE INDEX "friendship_edges_status_idx" ON "friendship_edges"("status");

-- CreateIndex
CREATE UNIQUE INDEX "friendship_edges_userLowId_userHighId_key" ON "friendship_edges"("userLowId", "userHighId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "leagues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_enrollments" ADD CONSTRAINT "weekly_enrollments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_enrollments" ADD CONSTRAINT "weekly_enrollments_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "leagues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_rooms" ADD CONSTRAINT "weekly_rooms_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_room_participants" ADD CONSTRAINT "weekly_room_participants_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "weekly_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_room_participants" ADD CONSTRAINT "weekly_room_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_room_participants" ADD CONSTRAINT "weekly_room_participants_startingLeagueId_fkey" FOREIGN KEY ("startingLeagueId") REFERENCES "leagues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_room_participants" ADD CONSTRAINT "weekly_room_participants_endingLeagueId_fkey" FOREIGN KEY ("endingLeagueId") REFERENCES "leagues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_runs" ADD CONSTRAINT "weekly_runs_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "weekly_room_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_runs" ADD CONSTRAINT "weekly_runs_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "weekly_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "champion_runs" ADD CONSTRAINT "champion_runs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "champion_weekly_summaries" ADD CONSTRAINT "champion_weekly_summaries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "champion_weekly_summaries" ADD CONSTRAINT "champion_weekly_summaries_demotedToLeagueId_fkey" FOREIGN KEY ("demotedToLeagueId") REFERENCES "leagues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "territories" ADD CONSTRAINT "territories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "territories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_path_points" ADD CONSTRAINT "run_path_points_runId_fkey" FOREIGN KEY ("runId") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "achievements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievement_progress" ADD CONSTRAINT "user_achievement_progress_userAchievementId_fkey" FOREIGN KEY ("userAchievementId") REFERENCES "user_achievements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievement_progress" ADD CONSTRAINT "user_achievement_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battles" ADD CONSTRAINT "battles_player1Id_fkey" FOREIGN KEY ("player1Id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battles" ADD CONSTRAINT "battles_player2Id_fkey" FOREIGN KEY ("player2Id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battles" ADD CONSTRAINT "battles_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friendship_edges" ADD CONSTRAINT "friendship_edges_userLowId_fkey" FOREIGN KEY ("userLowId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friendship_edges" ADD CONSTRAINT "friendship_edges_userHighId_fkey" FOREIGN KEY ("userHighId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friendship_edges" ADD CONSTRAINT "friendship_edges_initiatedByUserId_fkey" FOREIGN KEY ("initiatedByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
