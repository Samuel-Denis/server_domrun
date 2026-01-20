# 🏃‍♂️ Run Empire - Documentação Completa

## 📖 Índice

1. [Visão Geral](#visão-geral)
2. [Sistema de Autenticação](#sistema-de-autenticação)
3. [Sistema de Usuários e Perfis](#sistema-de-usuários-e-perfis)
4. [Sistema de XP e Níveis](#sistema-de-xp-e-níveis)
5. [Sistema de Corridas](#sistema-de-corridas)
6. [Sistema de Territórios](#sistema-de-territórios)
7. [Sistema de Mapas e PostGIS](#sistema-de-mapas-e-postgis)
8. [Sistema de Batalhas PvP 1v1](#sistema-de-batalhas-pvp-1v1)
9. [Sistema de Batalhas Semanais](#sistema-de-batalhas-semanais)
10. [Sistema de Ranking](#sistema-de-ranking)
11. [API Endpoints](#api-endpoints)

---

## 🎯 Visão Geral

**Run Empire** é uma aplicação gamificada de corrida que combina rastreamento GPS, competição PvP e conquista de territórios. Os usuários podem:

- ✅ Registrar corridas simples (ponto A até ponto B)
- ✅ Conquistar territórios fechando circuitos durante corridas
- ✅ Competir em batalhas PvP 1v1 em tempo real
- ✅ Participar de batalhas semanais em salas com 20 jogadores
- ✅ Ganhar XP e subir de nível
- ✅ Competir por troféus e ligas
- ✅ Visualizar territórios conquistados em mapas interativos

### Stack Tecnológico

- **Backend**: NestJS (TypeScript)
- **Banco de Dados**: PostgreSQL + PostGIS (extensão espacial)
- **ORM**: Prisma
- **Autenticação**: JWT (Access Token + Refresh Token)
- **WebSocket**: Socket.io para eventos em tempo real
- **Geolocalização**: Turf.js para cálculos geográficos

---

## 🔐 Sistema de Autenticação

### 1. Registro de Usuário

**Endpoint**: `POST /auth/register`

Permite criar uma nova conta no sistema.

**Body:**
```json
{
  "username": "corredor123",
  "name": "João Silva",
  "email": "joao@example.com",
  "password": "senhaSegura123"
}
```

**Resposta:**
- Cria o usuário com nível 1, 0 XP, 0 troféus
- Liga inicial: `Bronze III`
- Retorna tokens JWT (access e refresh)

### 2. Login

**Endpoint**: `POST /auth/login`

Autentica o usuário e retorna tokens JWT.

**Body:**
```json
{
  "email": "joao@example.com",
  "password": "senhaSegura123"
}
```

**Resposta:**
```json
{
  "access_token": "eyJhbGc...",
  "refresh_token": "refresh_token_uuid",
  "user": {
    "id": "uuid",
    "username": "corredor123",
    "email": "joao@example.com",
    "level": 1,
    "xp": 0,
    "trophies": 0,
    "league": "Bronze III"
  }
}
```

### 3. Refresh Token

**Endpoint**: `POST /auth/refresh`

Renova o access token usando o refresh token.

**Body:**
```json
{
  "refresh_token": "refresh_token_uuid"
}
```

### 4. Logout

**Endpoint**: `POST /auth/logout`

Invalida o refresh token, encerrando a sessão.

---

## 👤 Sistema de Usuários e Perfis

### Campos do Usuário

Cada usuário possui:

- **Identificação**: `id`, `username`, `email`, `name`
- **Perfil**: `photoUrl`, `biography`, `color` (cor no mapa)
- **Estatísticas**: `level`, `xp`, `trophies`, `league`
- **PvP**: `battleWins`, `battleLosses`, `winStreak`
- **Timestamps**: `createdAt`, `updatedAt`, `lastLogin`

### Endpoints de Perfil

#### Obter Perfil Completo

**Endpoint**: `GET /users/profile/complete`

Retorna todas as informações do usuário autenticado:

```json
{
  "id": "uuid",
  "username": "corredor123",
  "name": "João Silva",
  "email": "joao@example.com",
  "photoUrl": "https://...",
  "biography": "Corredor apaixonado!",
  "color": "#FF0000",
  "level": 15,
  "xp": 450,
  "xpProgress": 0.45,
  "xpForNextLevel": 1000,
  "trophies": 1250,
  "league": "Ouro III",
  "battleWins": 45,
  "battleLosses": 12,
  "winStreak": 3,
  "stats": {
    "totalDistance": 125000,
    "totalRuns": 87,
    "totalTerritories": 12,
    "averagePace": 5.2,
    "longestRun": 15000
  },
  "territories": [...],
  "runs": [...]
}
```

#### Atualizar Perfil

**Endpoint**: `PUT /users/profile`

Permite atualizar nome, biografia, cor e foto de perfil.

**Body (multipart/form-data):**
- `name` (string)
- `biography` (string, opcional)
- `color` (string hex, opcional)
- `photo` (arquivo de imagem, opcional)

#### Estatísticas do Usuário

**Endpoint**: `GET /users/profile/stats`

Retorna estatísticas calculadas:

```json
{
  "totalDistance": 125000,
  "totalRuns": 87,
  "totalTerritories": 12,
  "averagePace": 5.2,
  "longestRun": 15000,
  "totalCalories": 8500,
  "totalElevationGain": 450
}
```

#### Corridas do Usuário

**Endpoint**: `GET /users/profile/runs?limit=20&offset=0`

Lista as corridas do usuário com paginação.

---

## ⭐ Sistema de XP e Níveis

### Como Funciona

- **Nível Máximo**: 99
- **Fórmula de XP**: Para subir do nível `N` para `N+1`, são necessários `N * 100` XP
  - Level 1 → 2: 100 XP
  - Level 2 → 3: 200 XP
  - Level 3 → 4: 300 XP
  - ...
  - Level 98 → 99: 9.800 XP

### Como Ganhar XP

1. **Conquistar Território**: +50 XP base
2. **Completar Conquistas**: XP variável (definido no `cq.json` do frontend)
3. **Multiplicador de Liga**: XP ganho é multiplicado pela liga atual:
   - Bronze: 1.0x
   - Prata: 1.2x
   - Ouro: 1.5x
   - Cristal: 1.8x
   - Mestre: 2.2x

### Campos de XP no Perfil

- **`xp`**: XP total acumulado do usuário
- **`level`**: Nível atual (1-99)
- **`xpProgress`**: Progresso para o próximo nível (0.0 a 1.0)
- **`xpForNextLevel`**: XP necessário para subir de nível

**Exemplo**:
- Usuário nível 5 com 320 XP
- `xpProgress = 320 / 500 = 0.64` (64% para o nível 6)
- `xpForNextLevel = 500`

---

## 🏃 Sistema de Corridas

### Tipos de Corridas

#### 1. Corrida Simples

Corrida de ponto A até ponto B, sem fechar circuito.

**Endpoint**: `POST /runs/simple`

**Body:**
```json
{
  "path": [
    {
      "latitude": -21.1775,
      "longitude": -47.8103,
      "timestamp": "2026-01-16T10:00:00.000Z"
    },
    {
      "latitude": -21.1780,
      "longitude": -47.8105,
      "timestamp": "2026-01-16T10:00:05.000Z"
    }
  ],
  "startTime": "2026-01-16T10:00:00.000Z",
  "endTime": "2026-01-16T10:15:00.000Z",
  "distance": 5000,
  "duration": 900,
  "averagePace": 3.0,
  "maxSpeed": 18.5,
  "elevationGain": 50,
  "calories": 300,
  "caption": "Corrida matinal"
}
```

**Características**:
- Salva apenas o trajeto (não conquista território)
- Não gera XP adicional
- Útil para treinos e corridas livres

#### 2. Corrida com Território (Formato Antigo)

**Endpoint**: `POST /runs`

Este endpoint aceita dois formatos:

**a) Território** (com `boundary`):
- Cria um território conquistado
- Gera +50 XP

**b) Corrida Simples** (com `path`):
- Se o primeiro e último ponto estão a menos de 30m de distância, fecha o circuito e conquista território
- Caso contrário, salva como corrida simples

### Estrutura de Dados

Cada corrida possui:

- **Identificação**: `id`, `userId`, `territoryId` (opcional)
- **Tempo**: `startTime`, `endTime`, `duration` (segundos)
- **Distância**: `distance` (metros)
- **Ritmo**: `averagePace` (min/km)
- **Velocidade**: `maxSpeed` (km/h)
- **Elevação**: `elevationGain` (metros)
- **Calorias**: `calories`
- **Trajeto**: Array de `RunPathPoint` (latitude, longitude, timestamp)

---

## 🗺️ Sistema de Territórios

### O que são Territórios?

Territórios são áreas geográficas conquistadas quando um usuário fecha um circuito durante uma corrida. São armazenados como polígonos no banco de dados usando PostGIS.

### Como Conquistar um Território

1. **Durante a Corrida**: Coletar pontos GPS ao longo do trajeto
2. **Fechar o Circuito**: Primeiro e último ponto devem estar a menos de 30 metros de distância
3. **Enviar para o Backend**: POST `/territories` com o `boundary` (array de pontos)

### Endpoint de Criação

**Endpoint**: `POST /territories`

**Body:**
```json
{
  "userName": "corredor123",
  "userColor": "#FF0000",
  "areaName": "Parque Central - Circuito Completo",
  "boundary": [
    {
      "latitude": -21.1775,
      "longitude": -47.8103,
      "timestamp": "2026-01-16T10:00:00.000Z"
    },
    {
      "latitude": -21.1780,
      "longitude": -47.8105,
      "timestamp": "2026-01-16T10:00:05.000Z"
    }
  ],
  "capturedAt": "2026-01-16T10:15:00.000Z",
  "distance": 2500,
  "duration": 900,
  "averagePace": 6.0,
  "maxSpeed": 15.5,
  "elevationGain": 50,
  "calories": 180
}
```

### Processamento do Território

O backend processa o território da seguinte forma:

1. **Map Matching** (opcional): Se configurado, alinha o trajeto com as ruas
2. **Detecção de Circuito Fechado**: Verifica se primeiro e último ponto estão próximos (< 30m)
3. **Criação do Polígono**: Aplica buffer de 30m na LineString e fecha o polígono
4. **Cálculo de Área**: Calcula área em metros quadrados usando PostGIS
5. **Fusão de Territórios**: Se o usuário já tem territórios próximos, funde automaticamente
6. **Recorte de Territórios Inimigos**: Remove sobreposições com territórios de outros usuários
7. **Adição de XP**: Usuário ganha +50 XP

### Endpoint de Visualização no Mapa

**Endpoint**: `GET /runs/map?bbox=-47.9,-21.2,-47.7,-21.1`

Retorna todos os territórios visíveis em um bounding box em formato GeoJSON:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "territory-uuid",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[...]]
      },
      "properties": {
        "owner": "corredor123",
        "color": "#FF0000",
        "areaName": "Parque Central",
        "userId": "user-uuid",
        "userName": "João Silva",
        "photoUrl": "https://...",
        "capturedAt": "2026-01-16T10:15:00.000Z",
        "areaM2": 12500.5
      }
    }
  ]
}
```

---

## 🌍 Sistema de Mapas e PostGIS

### PostGIS

A aplicação usa a extensão **PostGIS** do PostgreSQL para:

- Armazenar geometrias espaciais (polygons, linestrings)
- Calcular áreas de territórios
- Detectar interseções entre territórios
- Filtrar territórios por bounding box (bbox)

### Operações PostGIS Utilizadas

- **`ST_GeomFromText`**: Converte WKT (Well-Known Text) para geometria
- **`ST_Transform`**: Converte coordenadas entre sistemas de projeção
- **`ST_Buffer`**: Cria buffer ao redor de uma linha (30m)
- **`ST_MakePolygon`**: Fecha um LineString em um polígono
- **`ST_Area`**: Calcula área em metros quadrados
- **`ST_Intersects`**: Detecta sobreposição entre geometrias
- **`ST_Union`**: Funde múltiplas geometrias
- **`ST_Difference`**: Recorta geometrias (remove sobreposições)

### Coordenadas

- **Sistema de Coordenadas**: WGS84 (EPSG:4326) para armazenamento
- **Projeção para Cálculos**: Web Mercator (EPSG:3857) para cálculos de área
- **Formato de Entrada**: Latitude/Longitude em graus decimais

---

## ⚔️ Sistema de Batalhas PvP 1v1

### Visão Geral

Sistema de batalhas em tempo real onde dois jogadores competem simultaneamente para obter o melhor **Battle Score (BS)** baseado em distância e pace.

### Sistema de Ligas

| Liga | Troféus | Multiplicador XP |
|------|---------|------------------|
| Bronze III | 0 - 166 | 1.0x |
| Bronze II | 167 - 333 | 1.0x |
| Bronze I | 334 - 499 | 1.0x |
| Prata III | 500 - 666 | 1.2x |
| Prata II | 667 - 833 | 1.2x |
| Prata I | 834 - 999 | 1.2x |
| Ouro III | 1.000 - 1.333 | 1.5x |
| Ouro II | 1.334 - 1.666 | 1.5x |
| Ouro I | 1.667 - 1.999 | 1.5x |
| Cristal III | 2.000 - 2.333 | 1.8x |
| Cristal II | 2.334 - 2.666 | 1.8x |
| Cristal I | 2.667 - 2.999 | 1.8x |
| Mestre | 3.000+ | 2.2x |

### Battle Score (BS)

O Battle Score é calculado pela fórmula:

```
BS = (0.6 × Distância_Normalizada) + (0.4 × Pace_Normalizado)
```

Onde:
- **Distância_Normalizada**: Distância percorrida normalizada (0-1)
- **Pace_Normalizado**: Ritmo médio normalizado invertido (quanto menor o pace, maior a pontuação)

### Sistema de Troféus (ELO-like)

- **Troféus Iniciais**: 0 (Bronze III)
- **Troféus por Vitória**: 20-50 (baseado na diferença de troféus)
- **Troféus por Derrota**: -10 a -30
- **Win Streak**: Aumenta ganhos em 10% por vitória consecutiva

### Fluxo de Batalha

1. **Entrar na Fila**: `POST /battles/queue`
2. **Matchmaking**: Sistema encontra oponente com troféus similares (±200)
3. **Batalha Iniciada**: WebSocket notifica ambos os jogadores
4. **Correr**: Ambos correm simultaneamente
5. **Submeter Resultado**: `POST /battles/submit`
6. **Finalização Automática**: Quando ambos submetem, sistema calcula vencedor
7. **Atualização de Troféus**: Vencedor ganha, perdedor perde troféus

### Anti-Cheat

Validações aplicadas:

- ✅ **Velocidade Máxima**: 25 km/h (velocidade humana)
- ✅ **GPS Jumps**: Detecta saltos impossíveis entre pontos
- ✅ **Duração Mínima**: Mínimo 5 minutos de corrida

### Endpoints

- `POST /battles/queue` - Entrar na fila
- `POST /battles/submit` - Submeter resultado
- `DELETE /battles/:battleId` - Cancelar batalha
- `GET /battles/history` - Histórico de batalhas

### WebSocket Events

- `battle:found` - Batalha encontrada
- `battle:opponent_submitted` - Oponente submeteu resultado
- `battle:finished` - Batalha finalizada

---

## 📅 Sistema de Batalhas Semanais

### Visão Geral

Sistema competitivo semanal onde **20 jogadores** competem em uma sala durante **7 dias**, completando **5 corridas obrigatórias de 5km cada**.

### Características

- ✅ **Salas de 20 Jogadores**: Matchmaking baseado em liga
- ✅ **Duração**: Segunda 00:00 até Domingo 23:59
- ✅ **5 Corridas Obrigatórias**: Mínimo necessário para pontuar
- ✅ **5km por Corrida**: Distância padrão
- ✅ **Promoção/Rebaixamento**: Top 5 sobem, últimos 5 descem

### Ligas Semanais

| Liga | Descrição |
|------|-----------|
| **Bronze** | Liga inicial |
| **Prata** | Intermediária |
| **Ouro** | Avançada |
| **Aspirante** | Elite |
| **Atleta** | Expert |
| **Pro** | Profissional |
| **Campeão** | Máxima (endgame) |

### Sistema de Pontuação

Cada corrida gera pontos baseados em:

1. **Distância** (40%): Quanto mais próximo de 5km, maior a pontuação
2. **Ritmo Médio** (35%): Quanto menor o pace, maior a pontuação
3. **Regularidade de Ritmo** (15%): Consistência durante a corrida
4. **Consistência Semanal** (10%): Bônus por completar todas as 5 corridas

### Anti-Cheat Avançado

Validações mais rigorosas:

- ✅ **Velocidade Máxima**: 25 km/h
- ✅ **Detecção de Veículo**: Identifica padrões de velocidade de carro/bicicleta
- ✅ **GPS Spikes**: Detecta pontos GPS anômalos
- ✅ **Trajetórias Irreais**: Valida se o trajeto faz sentido geograficamente

### Liga Campeão (Endgame)

Regras especiais:

- **Ganho de Troféus**: Top 3 ganham troféus (+50, +30, +20)
- **Perda de Troféus**: Últimos 3 perdem troféus (-50, -30, -20)
- **Decaimento Diário**: Troféus decaem 2% por dia (mínimo 2000)
- **Proteção de Rebaixamento**: Jogadores com menos de 2000 troféus não podem entrar

### Fluxo Semanal

1. **Segunda 00:00**: Nova semana inicia, salas são criadas
2. **Matchmaking**: Jogadores entram em salas da mesma liga (`POST /weekly-battles/join`)
3. **Corridas**: Jogadores completam 5 corridas de 5km durante a semana
4. **Submissão**: `POST /weekly-battles/runs` após cada corrida
5. **Ranking em Tempo Real**: `GET /weekly-battles/current-room`
6. **Domingo 23:59**: Semana fecha, promoções/rebaixamentos são aplicados

### Endpoints

- `POST /weekly-battles/join` - Entrar em uma sala
- `POST /weekly-battles/runs` - Submeter corrida semanal
- `GET /weekly-battles/current-room` - Sala atual do usuário
- `GET /weekly-battles/rooms/:roomId/ranking` - Ranking da sala
- `GET /weekly-battles/history` - Histórico de salas

### WebSocket Events

- `weekly:joined_room` - Entrou em uma sala
- `weekly:run_submitted` - Corrida submetida
- `weekly:ranking_updated` - Ranking atualizado
- `weekly:week_finished` - Semana finalizada

---

## 🏆 Sistema de Ranking

### Ranking de Troféus

**Endpoint**: `GET /users/ranking/trophies?limit=10`

Retorna os top N jogadores por número de troféus:

```json
{
  "ranking": [
    {
      "position": 1,
      "userId": "uuid",
      "username": "campeao123",
      "name": "Campeão",
      "photoUrl": "https://...",
      "trophies": 3450,
      "league": "Mestre",
      "level": 45,
      "battleWins": 150,
      "battleLosses": 25
    }
  ],
  "total": 1000
}
```

### Ranking de Salas Semanais

**Endpoint**: `GET /weekly-battles/rooms/:roomId/ranking`

Retorna o ranking de uma sala semanal específica com posições, pontos e estatísticas.

---

## 🔌 API Endpoints - Resumo Completo

### Autenticação
- `POST /auth/register` - Registrar usuário
- `POST /auth/login` - Fazer login
- `POST /auth/refresh` - Renovar token
- `POST /auth/logout` - Fazer logout

### Usuários
- `GET /users/profile/complete` - Perfil completo (autenticado)
- `PUT /users/profile` - Atualizar perfil (autenticado)
- `GET /users/profile/stats` - Estatísticas (autenticado)
- `GET /users/profile/runs` - Corridas do usuário (autenticado)
- `GET /users/:id` - Perfil público
- `GET /users/ranking/trophies` - Ranking de troféus

### Corridas
- `POST /runs/simple` - Criar corrida simples
- `POST /runs` - Criar corrida/território (formato antigo)
- `GET /runs/map?bbox=...` - Territórios no mapa (GeoJSON)

### Territórios
- `POST /territories` - Criar território

### Batalhas PvP 1v1
- `POST /battles/queue` - Entrar na fila
- `POST /battles/submit` - Submeter resultado
- `DELETE /battles/:battleId` - Cancelar batalha
- `GET /battles/history` - Histórico de batalhas

### Batalhas Semanais
- `POST /weekly-battles/join` - Entrar em sala semanal
- `POST /weekly-battles/runs` - Submeter corrida semanal
- `GET /weekly-battles/current-room` - Sala atual
- `GET /weekly-battles/rooms/:roomId/ranking` - Ranking da sala
- `GET /weekly-battles/history` - Histórico de salas

---

## 📚 Documentação Adicional

Para mais detalhes, consulte:

- **`README_BATALHAS.md`**: Documentação completa do sistema PvP 1v1
- **`README_BATALHAS_SEMANAIS.md`**: Documentação completa do sistema semanal
- **`API_CAPTURA_TERRITORIO.md`**: Como enviar dados de território do frontend

---

## 🚀 Iniciando o Projeto

### Pré-requisitos

- Node.js 18+
- PostgreSQL 14+ com extensão PostGIS
- npm ou yarn

### Instalação

```bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente (.env)
DATABASE_URL="postgresql://user:password@localhost:5432/runempire"
JWT_SECRET="seu-jwt-secret"
JWT_REFRESH_SECRET="seu-refresh-secret"

# Executar migrações
npx prisma migrate dev

# Gerar Prisma Client
npx prisma generate

# Popular banco com dados de teste (opcional)
npm run seed:completo

# Iniciar servidor
npm run start:dev
```

### Scripts Disponíveis

- `npm run build` - Compilar TypeScript
- `npm run start` - Iniciar em produção
- `npm run start:dev` - Iniciar em desenvolvimento
- `npm run seed` - Popular banco (seed básico)
- `npm run seed:completo` - Popular banco (seed completo)

---

## 📝 Notas Finais

- **Autenticação**: Todas as rotas (exceto `/auth/*`, `/users/:id`, `/users/ranking/trophies`, `/runs/map`) requerem autenticação JWT
- **Validação**: O sistema usa `ValidationPipe` global para validar todos os DTOs
- **WebSockets**: Eventos em tempo real disponíveis para batalhas via Socket.io
- **PostGIS**: Requer extensão PostGIS instalada no PostgreSQL
- **CORS**: Configurado para aceitar requisições do frontend

---

**Desenvolvido com ❤️ para corredores competitivos**
