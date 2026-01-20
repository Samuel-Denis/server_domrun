# 🏆 Sistema de Conquistas Dinâmico

## 📋 Visão Geral

O sistema de conquistas foi refatorado para ser **dinâmico e baseado em banco de dados**, permitindo:

- ✅ Ativar/desativar conquistas sem novo deploy
- ✅ Criar conquistas sazonais/eventos
- ✅ Ajustar requisitos e recompensas via banco
- ✅ Suportar UI dinâmica no app
- ✅ Manter histórico e progresso por usuário

---

## 🗄️ Estrutura do Banco de Dados

### 1️⃣ Tabela `Achievement` (Catálogo)

Tabela central que armazena todas as conquistas disponíveis no jogo.

**Campos principais:**
- `id` - UUID (PK)
- `code` - String única e estável (ex: "FIRST_RUN", "CAPTURE_10_TERRITORIES")
- `title` - Nome da conquista (ex: "Primeiros Passos")
- `description` - Descrição da conquista
- `category` - Enum: RUN, TERRITORY, SOCIAL, LEAGUE, EVENT, MILESTONE
- `rarity` - Enum: COMMON, RARE, EPIC, LEGENDARY
- `iconAsset` - URL/path do ícone
- `isActive` - Boolean (ativa/desativada)
- `isHidden` - Boolean (conquistas secretas)
- `criteriaJson` - JSON com requisitos (ex: `{ "runs": 10 }`)
- `rewardJson` - JSON com recompensas (ex: `{ "xp": 200, "trophies": 50 }`)
- `seasonNumber` - Int? (nullable para temporadas)

**Índices:**
- `code` (unique)
- `category`
- `rarity`
- `isActive`
- `isHidden`
- `seasonNumber`

---

### 2️⃣ Tabela `UserAchievement` (Estado por Usuário)

Representa o estado de uma conquista para um usuário específico.

**Campos principais:**
- `id` - UUID (PK)
- `userId` - FK para User
- `achievementId` - FK para Achievement
- `status` - Enum: LOCKED, IN_PROGRESS, UNLOCKED, CLAIMED
- `progress` - Float (0.0 a 1.0)
- `currentValue` - Float? (valor atual)
- `targetValue` - Float? (valor alvo)
- `progressText` - String? (ex: "5/10 corridas")
- `unlockedAt` - DateTime? (quando desbloqueou)
- `claimedAt` - DateTime? (quando reclamou recompensa)

**Constraints:**
- `@@unique([userId, achievementId])` - Um registro por usuário/conquista

**Índices:**
- `userId`
- `achievementId`
- `userId, status`
- `status`
- `unlockedAt`
- `claimedAt`

---

### 3️⃣ Tabela `UserAchievementProgress` (Progresso Detalhado)

Armazena progresso detalhado para conquistas complexas e auditoria.

**Campos principais:**
- `id` - UUID (PK)
- `userAchievementId` - FK para UserAchievement
- `userId` - FK para User (facilita queries)
- `progressData` - Json? (dados complexos, ex: `{ "totalDistance": 75.5, "cities": 3 }`)
- `currentValue` - Float?
- `targetValue` - Float?
- `lastUpdated` - DateTime
- `createdAt` - DateTime
- `updatedAt` - DateTime

**Nota:** Permite múltiplos registros por `UserAchievement` para histórico detalhado.

**Índices:**
- `userAchievementId`
- `userId`
- `lastUpdated`

---

## 🎯 Enums

### `AchievementCategory`
- `RUN` - Conquistas de corridas
- `TERRITORY` - Conquistas de territórios
- `SOCIAL` - Conquistas sociais (amigos, batalhas)
- `LEAGUE` - Conquistas de ligas
- `EVENT` - Conquistas de eventos especiais
- `MILESTONE` - Marcos gerais (level, XP, etc)

### `AchievementRarity`
- `COMMON` - Comuns
- `RARE` - Raras
- `EPIC` - Épicas
- `LEGENDARY` - Lendárias

### `AchievementStatus`
- `LOCKED` - Ainda não iniciada
- `IN_PROGRESS` - Em progresso
- `UNLOCKED` - Desbloqueada (recompensa não reclamada)
- `CLAIMED` - Recompensa reclamada

---

## 📦 Seed de Conquistas

### Executar seed:

```bash
npm run seed:achievements
```

### Conquistas criadas:

#### 🏃 Corridas (RUN)
- `FIRST_RUN` - Primeira corrida
- `RUN_10` - 10 corridas
- `RUN_50` - 50 corridas
- `RUN_100` - 100 corridas
- `DISTANCE_10KM` - 10 km totais
- `DISTANCE_100KM` - 100 km totais
- `LONG_RUN_5KM` - Corrida de 5 km ou mais
- `STREAK_7` - 7 dias consecutivos

#### 🗺️ Territórios (TERRITORY)
- `FIRST_TERRITORY` - Primeiro território
- `TERRITORY_10` - 10 territórios
- `TERRITORY_AREA_1000` - 1000 m² totais

#### 👥 Sociais (SOCIAL)
- `FIRST_BATTLE` - Primeira batalha
- `BATTLE_WIN_10` - 10 vitórias
- `WIN_STREAK_5` - 5 vitórias consecutivas

#### 🏆 Ligas (LEAGUE)
- `LEAGUE_PROMOTION` - Promoção de liga
- `WEEKLY_TOP_4` - Top 4 na semana

#### 🎯 Marcos (MILESTONE)
- `LEVEL_10` - Nível 10
- `LEVEL_25` - Nível 25
- `LEVEL_50` - Nível 50
- `TROPHIES_1000` - 1000 troféus
- `SECRET_UNLOCKED` - Conquista secreta

---

## 🔄 Migração de Dados Existentes

**⚠️ IMPORTANTE:** Antes de executar a migration, você precisará:

1. **Criar a tabela `Achievement`** e popular com conquistas básicas
2. **Migrar dados existentes** de `UserAchievement.achievementId` (String) para FK `Achievement.id`
3. **Ajustar `UserAchievementProgress`** para referenciar `UserAchievement` ao invés de `achievementId` direto

**Exemplo de migration de dados:**

```sql
-- 1. Migrar achievementId (String) para FK Achievement.id
-- (assumindo que achievementId antigo corresponde ao code de Achievement)

UPDATE user_achievements ua
SET achievement_id = (
    SELECT a.id 
    FROM achievements a 
    WHERE a.code = ua.achievement_id
)
WHERE EXISTS (
    SELECT 1 
    FROM achievements a 
    WHERE a.code = ua.achievement_id
);
```

---

## 💡 Como Usar

### 1. Criar Nova Conquista

```typescript
await prisma.achievement.create({
  data: {
    code: 'NEW_ACHIEVEMENT',
    title: 'Nova Conquista',
    description: 'Descrição da conquista',
    category: 'RUN',
    rarity: 'COMMON',
    isActive: true,
    isHidden: false,
    criteriaJson: { runs: 20 },
    rewardJson: { xp: 300, trophies: 40 },
  },
});
```

### 2. Ativar/Desativar Conquista

```typescript
await prisma.achievement.update({
  where: { code: 'FIRST_RUN' },
  data: { isActive: false },
});
```

### 3. Buscar Conquistas Ativas

```typescript
const activeAchievements = await prisma.achievement.findMany({
  where: { isActive: true, isHidden: false },
  orderBy: { createdAt: 'asc' },
});
```

### 4. Verificar Progresso do Usuário

```typescript
const userAchievements = await prisma.userAchievement.findMany({
  where: { userId },
  include: {
    achievement: true,
    progressDetails: {
      orderBy: { lastUpdated: 'desc' },
      take: 1,
    },
  },
});
```

---

## 🎨 Arquitetura

### Catálogo no Banco
- ✅ Conquistas definidas no banco (`Achievement`)
- ✅ Configurações flexíveis (criteriaJson, rewardJson)
- ✅ Ativação/desativação dinâmica

### Cálculo no Código
- ✅ Progresso calculado no backend
- ✅ Validação de critérios em tempo real
- ✅ Atualização de `UserAchievement.status`

### Fluxo de Desbloqueio

1. **Evento no jogo** (corrida, território, etc)
2. **Backend calcula progresso** baseado em `Achievement.criteriaJson`
3. **Atualiza `UserAchievement.progress`**
4. **Muda status** para `IN_PROGRESS` ou `UNLOCKED`
5. **Quando desbloqueado**, usuário pode reclamar recompensa
6. **Ao reclamar**, status muda para `CLAIMED` e recompensas são aplicadas

---

## 📝 Notas Importantes

- ✅ **Compatibilidade:** Sistema mantém compatibilidade com dados existentes
- ✅ **Flexibilidade:** JSON permite critérios e recompensas complexas
- ✅ **Auditoria:** `UserAchievementProgress` permite rastreamento detalhado
- ✅ **Performance:** Índices otimizados para queries comuns
- ✅ **Segurança:** FKs com `onDelete: Restrict` protegem integridade

---

## 🚀 Próximos Passos

1. **Criar migration** para migrar dados existentes
2. **Implementar serviços** para cálculo de progresso
3. **Atualizar endpoints** para retornar conquistas dinamicamente
4. **Criar jobs** para processar conquistas em batch
5. **Adicionar notificações** quando conquistas são desbloqueadas
