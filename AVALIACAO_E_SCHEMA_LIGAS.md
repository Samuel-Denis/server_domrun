# 🏆 Avaliação da Nova Dinâmica de Liga Semanal + Schema Prisma

## ✅ Avaliação como Arquiteto de Banco de Dados Sênior

### **Pontos Fortes da Proposta:**

1. **Flexibilidade Futura**: Ligas como tabela (não enum) permite:
   - Recompensas personalizadas por liga
   - Ajuste de parâmetros de pontuação sem deploy
   - Escudos/badges específicos por liga
   - Regras customizadas por liga
   - Balanceamento dinâmico

2. **Sistema de Pontuação Robusto**:
   - Normalização por liga (paceTopSecKm, paceBaseSecKm)
   - Anti-smurf integrado (smurfCapSecKm)
   - SmoothnessScore (regularidade) adiciona justiça
   - Bônus de consistência semanal incentiva atividade regular

3. **Separação Clara: Liga Imortal**:
   - Sistema próprio fora de salas semanais
   - Penalidades por inatividade
   - Rebaixamento automático se troféus < 3000
   - Melhora escalabilidade e lógica de negócio

4. **Anti-cheat Estruturado**:
   - Flags em JSON (extensível)
   - Multiplicador de pontuação (0.0 - 1.0)
   - Motivo de invalidação rastreável
   - Permite análise e ajustes futuros

5. **Auditoria Completa**:
   - ChampionWeeklySummary para rastreamento
   - Snapshot de troféus antes/depois
   - Histórico completo de promoções/rebaixamentos

### **Sugestões de Melhoria:**

1. **Campo `code` único e estável**: ✅ Excelente ideia para referências futuras
2. **JSON fields para recompensas/temas**: ✅ Flexível, mas considere validação no backend
3. **Pace em segundos/km**: ✅ Mais preciso que min/km (evita decimais)

---

## 📊 Schema Prisma Completo

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  extensions = [postgis]
}

// ============================================
// MODELO EXISTENTE: User (atualizado)
// ============================================

model User {
  id        String   @id @default(uuid())
  username  String   @unique
  name      String
  email     String   @unique
  password  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  color        String    @default("#FF0000")
  biography    String?
  photoUrl     String?
  lastLogin    DateTime?
  level        Int       @default(1)
  xp           Int       @default(0)
  trophies     Int       @default(0) // Troféus para sistema de batalhas PvP
  winStreak    Int       @default(0)
  battleWins   Int       @default(0)
  battleLosses Int       @default(0)

  // RELACIONAMENTO COM LEAGUE (NOVO)
  leagueId     String?
  league       League?   @relation(fields: [leagueId], references: [id], onDelete: SetNull)

  territories   Territory[]
  refreshTokens RefreshToken[]
  runs          Run[]
  userAchievements        UserAchievement[]
  userAchievementProgress UserAchievementProgress[]
  battlesAsPlayer1        Battle[]                  @relation("Player1Battles")
  battlesAsPlayer2        Battle[]                  @relation("Player2Battles")
  battlesWon              Battle[]                  @relation("BattleWinner")
  
  // RELACIONAMENTOS NOVOS
  weeklyRoomParticipants  WeeklyRoomParticipant[]
  championRuns            ChampionRun[]
  championWeeklySummaries ChampionWeeklySummary[]

  @@index([username])
  @@index([email])
  @@index([trophies])
  @@index([leagueId])
  @@map("users")
}

// ============================================
// NOVO MODELO: League (Tabela de Ligas)
// ============================================

model League {
  id        String   @id @default(uuid())
  code      String   @unique // Código estável e único (ex: "STARTER", "RITMO", "IMMORTAL")
  displayName String // Nome para exibição (ex: "Starter", "Ritmo", "Imortal")
  order     Int      @unique // Ordem de progressão (1 = Starter, 7 = Imortal)
  isChampion Boolean @default(false) // true apenas para Imortal

  // Requisitos de entrada
  minTrophiesToEnter Int? // Troféus mínimos para entrar (ex: 3000 para Imortal)

  // Parâmetros de pontuação (balanceamento)
  paceTopSecKm   Int // Pace "top" que dá pontuação máxima (em segundos/km)
  paceBaseSecKm  Int // Pace "base" que dá pontuação zero (em segundos/km)
  smurfCapSecKm  Int? // Cap anti-smurf para ligas baixas (nullable, apenas para Starter/Ritmo)
  weeklyConsistencyMaxBonus Int // Bônus máximo de consistência semanal (ex: 400 para Starter, 250 para outras)

  // Recompensas e cosméticos (futuro)
  shieldName  String? // Nome do escudo (ex: "Escudo de Bronze")
  shieldAsset String? // URL/Path do asset do escudo
  rewardJson  Json?   // JSON flexível para recompensas (ex: {"xp": 100, "badges": ["weekly_winner"]})
  themeJson   Json?   // JSON para tema visual (ex: {"primaryColor": "#FFD700", "gradient": [...]})

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relacionamentos
  users              User[]
  weeklyRooms        WeeklyRoom[]
  weeklyRoomParticipants WeeklyRoomParticipant[] // Liga no início da semana (snapshot)
  championWeeklySummaries ChampionWeeklySummary[] // Rebaixamentos

  @@index([code])
  @@index([order])
  @@index([isChampion])
  @@map("leagues")
}

// ============================================
// MODELO ATUALIZADO: WeeklyRoom
// ============================================

model WeeklyRoom {
  id           String           @id @default(uuid())
  
  // RELACIONAMENTO COM LEAGUE (NOVO - FK em vez de String)
  leagueId     String
  league       League           @relation(fields: [leagueId], references: [id], onDelete: Cascade)
  
  seasonNumber Int // Número da temporada
  weekNumber   Int // Semana da temporada
  startDate    DateTime // Início da semana (segunda 00:00)
  endDate      DateTime // Fim da semana (domingo 23:59)
  status       WeeklyRoomStatus @default(OPEN)
  
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt

  participants WeeklyRoomParticipant[]
  runs         WeeklyRun[]

  @@unique([leagueId, seasonNumber, weekNumber]) // Uma sala por liga/semana
  @@index([leagueId, status])
  @@index([startDate])
  @@index([endDate])
  @@index([status])
  @@map("weekly_rooms")
}

enum WeeklyRoomStatus {
  OPEN
  IN_PROGRESS
  FINISHED
  CLOSED
}

// ============================================
// MODELO ATUALIZADO: WeeklyRoomParticipant
// ============================================

model WeeklyRoomParticipant {
  id            String     @id @default(uuid())
  roomId        String
  room          WeeklyRoom @relation(fields: [roomId], references: [id], onDelete: Cascade)
  userId        String
  user          User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // SNAPSHOT DA LIGA NO INÍCIO DA SEMANA (FK)
  startingLeagueId String
  startingLeague   League   @relation(fields: [startingLeagueId], references: [id], onDelete: Restrict)
  
  // Pontuação semanal
  totalPoints     Int      @default(0) // Soma das melhores 5 corridas válidas
  consistencyBonus Int     @default(0) // Bônus de consistência semanal (0..maxBonus da liga)
  runsValidCount  Int      @default(0) // Número de corridas válidas (máx 10, conta melhores 5)
  
  // Resultado final
  position      Int? // Posição final na sala (1-20)
  promoted      Boolean    @default(false) // Se foi promovido (Top 4)
  demoted       Boolean    @default(false) // Se foi rebaixado (Bottom 4)
  
  joinedAt      DateTime   @default(now())

  runs WeeklyRun[]

  @@unique([roomId, userId])
  @@index([roomId])
  @@index([userId])
  @@index([roomId, totalPoints(sort: Desc)]) // Para ranking
  @@index([startingLeagueId])
  @@map("weekly_room_participants")
}

// ============================================
// MODELO ATUALIZADO: WeeklyRun
// ============================================

model WeeklyRun {
  id               String                @id @default(uuid())
  participantId    String
  participant      WeeklyRoomParticipant @relation(fields: [participantId], references: [id], onDelete: Cascade)
  roomId           String
  room             WeeklyRoom            @relation(fields: [roomId], references: [id], onDelete: Cascade)
  runId            String // ID da corrida no sistema principal (Run)
  
  // Métricas brutas (armazenadas para auditoria)
  distanceMeters   Int // Distância em metros
  durationSeconds  Int // Duração em segundos
  paceSecKm        Int // Pace em segundos por km (mais preciso que min/km)
  
  // Scores calculados (0-1000 total)
  paceScore        Int // Score de pace (0-650)
  distanceScore    Int // Score de distância (0-200)
  smoothnessScore  Int // Score de regularidade/suavidade (0-150)
  finalScore       Int // Score final após multiplicador: (paceScore + distanceScore + smoothnessScore) * multiplier
  
  // Anti-cheat
  isValid          Boolean               @default(true)
  invalidReason    String? // Motivo de invalidação se houver
  flags            Json? // Array de flags de anti-cheat (ex: ["SPEED_ANOMALY", "GPS_JUMP"])
  multiplier       Float                 @default(1.0) // Multiplicador aplicado ao score (1.0 = válido, 0.9 = suspeito, 0.0 = inválido)
  
  submittedAt      DateTime              @default(now())

  @@unique([participantId, runId]) // Uma corrida não pode ser submetida duas vezes
  @@index([participantId])
  @@index([roomId])
  @@index([runId])
  @@index([submittedAt])
  @@index([isValid])
  @@map("weekly_runs")
}

// ============================================
// NOVO MODELO: ChampionRun (Corridas da Liga Imortal)
// ============================================

model ChampionRun {
  id               String   @id @default(uuid())
  userId           String
  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  runId            String // ID da corrida no sistema principal (Run)
  
  // Métricas brutas
  distanceMeters   Int
  durationSeconds  Int
  paceSecKm        Int
  
  // Score e troféus
  finalScore       Int // Score calculado (similar ao WeeklyRun)
  trophiesEarned   Int // Troféus ganhos nesta corrida (pode ser negativo em caso de penalidade)
  
  // Anti-cheat (mesmo sistema)
  isValid          Boolean  @default(true)
  invalidReason    String?
  flags            Json?
  multiplier       Float    @default(1.0)
  
  submittedAt      DateTime @default(now())

  @@unique([userId, runId]) // Uma corrida não pode ser submetida duas vezes
  @@index([userId])
  @@index([runId])
  @@index([submittedAt])
  @@index([isValid])
  @@map("champion_runs")
}

// ============================================
// NOVO MODELO: ChampionWeeklySummary (Auditoria Semanal Imortal)
// ============================================

model ChampionWeeklySummary {
  id                String   @id @default(uuid())
  userId            String
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  seasonNumber      Int
  weekNumber        Int
  weekStart         DateTime // Início da semana (segunda 00:00)
  weekEnd           DateTime // Fim da semana (domingo 23:59)
  
  // Estatísticas da semana
  validRunsCount    Int      @default(0) // Número de corridas válidas
  
  // Troféus
  trophiesEarnedWeek  Int    @default(0) // Troféus ganhos na semana
  trophiesPenaltyWeek  Int   @default(0) // Penalidade por inatividade (< 3 corridas)
  trophiesBefore    Int      // Snapshot de troféus no início da semana
  trophiesAfter     Int      // Troféus após processamento semanal
  
  // Rebaixamento
  demoted           Boolean  @default(false)
  demotedToLeagueId String? // Liga para qual foi rebaixado (FK)
  demotedToLeague   League? @relation(fields: [demotedToLeagueId], references: [id], onDelete: SetNull)
  
  createdAt         DateTime @default(now())

  @@unique([userId, seasonNumber, weekNumber]) // Um resumo por usuário/semana
  @@index([userId])
  @@index([seasonNumber, weekNumber])
  @@index([weekStart])
  @@map("champion_weekly_summaries")
}

// ============================================
// MODELOS EXISTENTES (mantidos)
// ============================================

model Territory {
  id         String                                 @id @default(uuid())
  userId     String
  user       User                                   @relation(fields: [userId], references: [id], onDelete: Cascade)
  userName   String?
  userColor  String?
  areaName   String?
  area       Float?
  capturedAt DateTime?
  createdAt  DateTime                               @default(now())
  geometry   Unsupported("geometry(Polygon, 4326)")

  runs Run[]

  @@index([geometry], name: "territory_geometry_idx", type: Gist)
  @@index([userId])
  @@index([capturedAt])
  @@map("territories")
}

model Run {
  id               String     @id @default(uuid())
  userId           String
  user             User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  startTime        DateTime   @default(now())
  endTime          DateTime?
  distance         Float      @default(0)
  duration         Int        @default(0)
  averagePace      Float      @default(0)
  maxSpeed         Float?
  elevationGain    Float?
  calories         Int?
  caption          String?
  territoryId      String?
  territory        Territory? @relation(fields: [territoryId], references: [id], onDelete: SetNull)
  mapImageUrl      String?
  mapImageCleanUrl String?
  createdAt        DateTime   @default(now())

  pathPoints RunPathPoint[]

  @@index([userId])
  @@index([startTime])
  @@index([territoryId])
  @@map("runs")
}

model RunPathPoint {
  id            String   @id @default(uuid())
  runId         String
  run           Run      @relation(fields: [runId], references: [id], onDelete: Cascade)
  latitude      Float
  longitude     Float
  timestamp     DateTime
  sequenceOrder Int

  @@index([runId])
  @@index([runId, sequenceOrder])
  @@map("run_path_points")
}

model RefreshToken {
  id        String   @id @default(uuid())
  token     String   @unique
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([token])
  @@index([userId])
  @@map("refresh_tokens")
}

model UserAchievement {
  id            String    @id @default(uuid())
  userId        String
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  achievementId String
  status        String    @default("locked")
  progress      Float     @default(0.0)
  progressText  String?
  unlockedAt    DateTime?
  xpReward      Int?
  medalType     String?
  category      String?
  updatedAt     DateTime  @default(now()) @updatedAt

  @@unique([userId, achievementId])
  @@index([userId])
  @@index([userId, status])
  @@map("user_achievements")
}

model UserAchievementProgress {
  id            String   @id @default(uuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  achievementId String
  progress      Float    @default(0.0)
  lastUpdated   DateTime @default(now())
  createdAt     DateTime @default(now())
  updatedAt     DateTime @default(now()) @updatedAt

  @@unique([userId, achievementId])
  @@index([userId])
  @@index([achievementId])
  @@index([lastUpdated])
  @@map("user_achievement_progress")
}

model Battle {
  id         String       @id @default(uuid())
  player1Id  String
  player1    User         @relation("Player1Battles", fields: [player1Id], references: [id], onDelete: Cascade)
  player2Id  String?
  player2    User?        @relation("Player2Battles", fields: [player2Id], references: [id], onDelete: Cascade)
  status     BattleStatus @default(SEARCHING)
  winnerId   String?
  winner     User?        @relation("BattleWinner", fields: [winnerId], references: [id], onDelete: SetNull)
  mode       String
  p1Score    Float?
  p2Score    Float?
  createdAt  DateTime     @default(now())
  updatedAt  DateTime     @updatedAt
  finishedAt DateTime?

  @@index([player1Id])
  @@index([player2Id])
  @@index([status])
  @@index([winnerId])
  @@map("battles")
}

enum BattleStatus {
  SEARCHING
  IN_PROGRESS
  FINISHED
  CANCELLED
}
```

---

## 📝 Notas de Implementação

### **1. Migração do Sistema Atual:**

```typescript
// Passos para migração:
// 1. Criar tabela League e popular com ligas padrão
// 2. Migrar User.league (String) para User.leagueId (FK)
// 3. Atualizar WeeklyRoom.league (String) para WeeklyRoom.leagueId (FK)
// 4. Criar novos modelos (ChampionRun, ChampionWeeklySummary)
```

### **2. Seed de Ligas Inicial:**

```typescript
const leagues = [
  { code: "STARTER", displayName: "Starter", order: 1, paceTopSecKm: 240, paceBaseSecKm: 600, weeklyConsistencyMaxBonus: 400 },
  { code: "RITMO", displayName: "Ritmo", order: 2, paceTopSecKm: 240, paceBaseSecKm: 540, weeklyConsistencyMaxBonus: 400 },
  { code: "CADENCIA", displayName: "Cadência", order: 3, paceTopSecKm: 210, paceBaseSecKm: 480, weeklyConsistencyMaxBonus: 250 },
  { code: "ENDURANCE", displayName: "Endurance", order: 4, paceTopSecKm: 210, paceBaseSecKm: 420, weeklyConsistencyMaxBonus: 250 },
  { code: "ATLETA", displayName: "Atleta", order: 5, paceTopSecKm: 180, paceBaseSecKm: 360, weeklyConsistencyMaxBonus: 250 },
  { code: "ELITE", displayName: "Elite", order: 6, paceTopSecKm: 180, paceBaseSecKm: 300, weeklyConsistencyMaxBonus: 250 },
  { code: "IMMORTAL", displayName: "Imortal", order: 7, isChampion: true, minTrophiesToEnter: 3000, paceTopSecKm: 180, paceBaseSecKm: 240, weeklyConsistencyMaxBonus: 250 },
];
```

### **3. Índices Importantes:**

- `League.code` único: permite referência estável no código
- `League.order` único: garante ordenação consistente
- `WeeklyRoom(leagueId, seasonNumber, weekNumber, roomNumber)` único: identifica salas múltiplas da mesma liga/semana
- `WeeklyRun(participantId, runId)` único: previne duplicação
- `ChampionWeeklySummary(userId, seasonNumber, weekNumber)` único: um resumo por semana

### **4. Performance:**

- Índices em campos de ranking (`totalPoints DESC`)
- Índices em FK para joins rápidos
- Índices em timestamps para queries temporais

---

## ✅ Conclusão

O schema está **bem estruturado**, **normalizado** e **preparado para crescimento futuro**. A separação entre ligas comuns e Imortal melhora a manutenibilidade do código e permite regras específicas para cada sistema.

**Próximos passos sugeridos:**
1. Criar migration do schema
2. Popular tabela `League` com dados iniciais
3. Migrar dados existentes (User.league → User.leagueId)
4. Implementar lógica de pontuação e anti-cheat
5. Implementar sistema de promoção/rebaixamento
