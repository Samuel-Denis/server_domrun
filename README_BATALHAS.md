# 🏆 Sistema de Batalhas PvP e Ligas

Este documento explica como funciona o sistema de batalhas PvP (Player vs Player) e o sistema de ligas do Run Empire.

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Sistema de Ligas](#sistema-de-ligas)
- [Sistema de Batalhas](#sistema-de-batalhas)
- [Battle Score (BS)](#battle-score-bs)
- [Sistema de Troféus/ELO](#sistema-de-troféuselo)
- [Validação Anti-Cheat](#validação-anti-cheat)
- [API REST](#api-rest)
- [WebSocket](#websocket)
- [Fluxo Completo](#fluxo-completo)

---

## 🎯 Visão Geral

O sistema de batalhas permite que jogadores compitam em corridas em tempo real. Os jogadores competem para obter o melhor **Battle Score (BS)** baseado na distância percorrida e no pace médio. O vencedor ganha troféus e sobe de liga, enquanto o perdedor perde troféus (mas pode manter a liga se tiver troféus suficientes).

---

## 🏅 Sistema de Ligas

O sistema de ligas classifica os jogadores baseado no número de troféus que possuem. Cada liga tem um multiplicador de XP que aumenta conforme você sobe.

### Ligas Disponíveis

| Liga | Troféus | Multiplicador XP | Descrição |
|------|---------|------------------|-----------|
| **Bronze III** | 0 - 166 | 1.0x | Liga inicial |
| **Bronze II** | 167 - 333 | 1.0x | |
| **Bronze I** | 334 - 499 | 1.0x | |
| **Prata III** | 500 - 666 | 1.2x | |
| **Prata II** | 667 - 833 | 1.2x | |
| **Prata I** | 834 - 999 | 1.2x | |
| **Ouro III** | 1.000 - 1.333 | 1.5x | |
| **Ouro II** | 1.334 - 1.666 | 1.5x | |
| **Ouro I** | 1.667 - 1.999 | 1.5x | |
| **Cristal III** | 2.000 - 2.333 | 1.8x | |
| **Cristal II** | 2.334 - 2.666 | 1.8x | |
| **Cristal I** | 2.667 - 2.999 | 1.8x | |
| **Mestre** | 3.000+ | 2.2x | Liga máxima |

### Como Funciona

- **Troféus Iniciais**: Todos os jogadores começam com 0 troféus (Bronze III)
- **Progressão**: Ao ganhar batalhas, você ganha troféus e pode subir de liga
- **Regressão**: Ao perder batalhas, você perde troféus e pode descer de liga
- **Multiplicador XP**: Quanto maior a liga, maior o bônus de XP nas corridas

---

## ⚔️ Sistema de Batalhas

### Tipos de Batalha

Atualmente, o sistema suporta dois modos:

- **`timed`**: Batalha por tempo (ex: 15 minutos)
- **`distance`**: Batalha por distância (ex: 5km)

### Estados da Batalha

1. **`SEARCHING`**: Procurando oponente
2. **`IN_PROGRESS`**: Batalha em andamento
3. **`FINISHED`**: Batalha finalizada
4. **`CANCELLED`**: Batalha cancelada

### Matchmaking

- O sistema encontra oponentes com diferença máxima de **±200 troféus**
- Prioriza jogadores que entraram primeiro na fila
- Match automático quando encontra um oponente compatível

---

## 📊 Battle Score (BS)

O Battle Score é calculado usando uma fórmula que combina **distância percorrida** e **pace médio**.

### Fórmula

```
BS = (Distância_Metros × 0.6) + ((720 - Pace_Segundos)/(720 - 240) × 1000 × 0.4)
```

### Componentes

- **Distância (60% do score)**: Metros percorridos multiplicados por 0.6
- **Pace (40% do score)**: Baseado no pace médio em segundos/km

### Pace Score

| Pace | Pontuação |
|------|-----------|
| ≤ 4:00 min/km (240s) | 1000 pontos (máximo) |
| 4:01 - 11:59 min/km | Interpolado linearmente |
| ≥ 12:00 min/km (720s) | 0 pontos (mínimo) |

### Exemplos

#### Exemplo 1: Corrida Rápida
- Distância: 5.000m
- Pace: 4:30 min/km (270 segundos)

```
Distância Score = 5.000 × 0.6 = 3.000
Pace Ratio = (720 - 270) / (720 - 240) = 450 / 480 = 0.9375
Pace Score = 0.9375 × 1000 = 937.5
Pace Component = 937.5 × 0.4 = 375

Battle Score = 3.000 + 375 = 3.375 pontos
```

#### Exemplo 2: Corrida Longa
- Distância: 10.000m
- Pace: 5:00 min/km (300 segundos)

```
Distância Score = 10.000 × 0.6 = 6.000
Pace Ratio = (720 - 300) / (720 - 240) = 420 / 480 = 0.875
Pace Score = 0.875 × 1000 = 875
Pace Component = 875 × 0.4 = 350

Battle Score = 6.000 + 350 = 6.350 pontos
```

---

## 🏆 Sistema de Troféus/ELO

### Ganho de Troféus

O sistema de troféus funciona como um sistema ELO adaptativo:

#### Vitória
- **Base**: +25 troféus
- **Ajuste**: ±(diferença de troféus × 0.1)
  - Se você vencer alguém com **menos** troféus: ganha menos
  - Se você vencer alguém com **mais** troféus: ganha mais

#### Derrota
- **Base**: -15 troféus
- **Ajuste**: ±(diferença de troféus × 0.1)
  - Se você perder para alguém com **menos** troféus: perde mais
  - Se você perder para alguém com **mais** troféus: perde menos

### Exemplos

#### Exemplo 1: Vitória contra jogador mais fraco
- Você: 800 troféus
- Oponente: 600 troféus
- Diferença: 200 troféus

```
Troféus ganhos = 25 - (200 × 0.1) = 25 - 20 = +5 troféus
Novo total: 805 troféus
```

#### Exemplo 2: Vitória contra jogador mais forte
- Você: 600 troféus
- Oponente: 800 troféus
- Diferença: 200 troféus

```
Troféus ganhos = 25 + (200 × 0.1) = 25 + 20 = +45 troféus
Novo total: 645 troféus
```

#### Exemplo 3: Derrota
- Você: 800 troféus
- Oponente: 600 troféus
- Diferença: 200 troféus

```
Troféus perdidos = 15 + (200 × 0.1) = 15 + 20 = -35 troféus
Novo total: 765 troféus (mínimo 0)
```

### Win Streak

- **Vitória**: Incrementa o contador de vitórias consecutivas
- **Derrota**: Reseta o contador para 0
- *(Pode ser usado futuramente para bônus ou recompensas especiais)*

---

## 🛡️ Validação Anti-Cheat

O sistema possui três camadas de validação anti-cheat:

### 1. Velocidade Humana
- **Limite**: Pace médio < 2:30 min/km (150 segundos/km)
- **Ação**: Se o pace for muito rápido, a corrida é marcada como suspeita
- **Motivo**: Possível uso de bicicleta ou veículo

### 2. GPS Jump (Fake GPS)
- **Limite**: Distância > 100m em ≤ 5 segundos
- **Ação**: Detecta saltos suspeitos no trajeto GPS
- **Motivo**: Possível uso de aplicativo Fake GPS

### 3. Tempo Mínimo
- **Limite**: Batalhas < 3 minutos (180 segundos)
- **Ação**: Corridas muito curtas não dão troféus
- **Motivo**: Previne abuso com corridas falsas

### Consequências

Se uma corrida for detectada como inválida:
- ❌ Não há ganho/perda de troféus
- ❌ O oponente válido ganha automaticamente (se aplicável)
- ✅ O resultado fica registrado no histórico

---

## 🔌 API REST

### Autenticação

Todas as rotas requerem autenticação JWT. Inclua o token no header:

```
Authorization: Bearer <seu-token-jwt>
```

### Endpoints

#### 1. Entrar na Fila de Matchmaking

```http
POST /battles/queue
Content-Type: application/json

{
  "mode": "timed" | "distance",
  "modeValue": "15"  // Opcional: ex: "15" para 15 minutos ou "5" para 5km
}
```

**Resposta (200 OK)**:
```json
{
  "id": "battle-uuid",
  "player1Id": "user-uuid",
  "player2Id": "user-uuid" | null,
  "status": "SEARCHING" | "IN_PROGRESS",
  "mode": "timed",
  "player1": {
    "id": "user-uuid",
    "username": "runner123",
    "name": "João Silva",
    "color": "#FF5733",
    "photoUrl": "/uploads/profiles/...",
    "trophies": 850,
    "league": "Prata II"
  },
  "player2": { ... } | null,
  "p1Score": null,
  "p2Score": null,
  "createdAt": "2026-01-13T20:00:00.000Z"
}
```

#### 2. Submeter Resultado da Batalha

```http
POST /battles/submit
Content-Type: application/json

{
  "battleId": "battle-uuid",
  "distance": 5000,  // metros
  "duration": 1200,  // segundos
  "averagePace": 4.5,  // min/km
  "maxSpeed": 15.5,  // km/h (opcional)
  "elevationGain": 50,  // metros (opcional)
  "calories": 350,  // (opcional)
  "path": [
    {
      "latitude": -21.1775,
      "longitude": -47.8103,
      "timestamp": "2026-01-13T20:00:00.000Z"
    },
    // ... mais pontos GPS
  ]
}
```

**Resposta (200 OK)** - Aguardando oponente:
```json
{
  "battleId": "battle-uuid",
  "winnerId": "",
  "loserId": "",
  "p1Score": 3375.50,
  "p2Score": 0,
  "p1TrophyChange": 0,
  "p2TrophyChange": 0,
  "p1NewTrophies": 850,
  "p2NewTrophies": 750,
  "invalidated": false
}
```

**Resposta (200 OK)** - Batalha finalizada:
```json
{
  "battleId": "battle-uuid",
  "winnerId": "user-uuid",
  "loserId": "user-uuid",
  "p1Score": 3375.50,
  "p2Score": 2850.25,
  "p1TrophyChange": 25,
  "p2TrophyChange": -15,
  "p1NewTrophies": 875,
  "p2NewTrophies": 735,
  "p1NewLeague": "Prata II",
  "p2NewLeague": "Prata I",
  "invalidated": false
}
```

#### 3. Cancelar Batalha

```http
DELETE /battles/:battleId
```

**Resposta (204 No Content)**: Batalha cancelada

#### 4. Histórico de Batalhas

```http
GET /battles/history?limit=20&offset=0
```

**Resposta (200 OK)**:
```json
[
  {
    "id": "battle-uuid",
    "player1Id": "user-uuid",
    "player2Id": "user-uuid",
    "status": "FINISHED",
    "mode": "timed",
    "player1": { ... },
    "player2": { ... },
    "p1Score": 3375.50,
    "p2Score": 2850.25,
    "winnerId": "user-uuid",
    "createdAt": "2026-01-13T20:00:00.000Z",
    "finishedAt": "2026-01-13T20:15:00.000Z"
  },
  // ... mais batalhas
]
```

---

## 🌐 WebSocket

O WebSocket permite notificações em tempo real durante o matchmaking e as batalhas.

### Conexão

```javascript
const socket = io('http://localhost:3000/battles', {
  auth: {
    token: 'seu-jwt-token'
  }
});
```

### Eventos do Cliente → Servidor

#### `join_queue`
Entra na fila de matchmaking.

```javascript
socket.emit('join_queue', {
  mode: 'timed' // ou 'distance'
});
```

#### `leave_queue`
Sai da fila de matchmaking.

```javascript
socket.emit('leave_queue');
```

### Eventos do Servidor → Cliente

#### `searching`
Ainda procurando oponente.

```javascript
socket.on('searching', (data) => {
  console.log('Procurando oponente...', data);
  // {
  //   battleId: 'battle-uuid',
  //   status: 'SEARCHING'
  // }
});
```

#### `match_found`
Match encontrado! Batalha iniciada.

```javascript
socket.on('match_found', (data) => {
  console.log('Oponente encontrado!', data);
  // {
  //   battleId: 'battle-uuid',
  //   opponent: {
  //     id: 'user-uuid',
  //     username: 'runner123',
  //     name: 'João Silva',
  //     color: '#FF5733',
  //     photoUrl: '/uploads/profiles/...',
  //     trophies: 850,
  //     league: 'Prata II'
  //   },
  //   mode: 'timed'
  // }
});
```

#### `error`
Erro ocorrido.

```javascript
socket.on('error', (error) => {
  console.error('Erro:', error.message);
});
```

---

## 🔄 Fluxo Completo

### 1. Entrar na Fila

```
Jogador A → POST /battles/queue → Status: SEARCHING
Jogador B → POST /battles/queue → Match encontrado → Status: IN_PROGRESS
```

### 2. Executar a Corrida

Ambos os jogadores executam suas corridas no app móvel.

### 3. Submeter Resultados

```
Jogador A → POST /battles/submit → Score: 3.375
Jogador B → POST /battles/submit → Score: 2.850
```

### 4. Sistema Finaliza a Batalha

- Compara os Battle Scores
- Jogador A vence (3.375 > 2.850)
- Calcula mudanças de troféus
- Atualiza ligas dos jogadores
- Status: FINISHED

### 5. Resultado

```json
{
  "winnerId": "player-a-uuid",
  "p1TrophyChange": 25,
  "p2TrophyChange": -15,
  "p1NewLeague": "Prata II",
  "p2NewLeague": "Prata I"
}
```

---

## 📝 Notas Importantes

1. **Tempo Mínimo**: Batalhas com menos de 3 minutos não dão troféus
2. **Anti-Cheat**: Corridas inválidas são detectadas automaticamente
3. **Matchmaking**: Diferença máxima de ±200 troféus entre oponentes
4. **Ligas**: Atualizadas automaticamente após cada batalha
5. **Win Streak**: Incrementado a cada vitória, resetado na derrota

---

## 🧪 Exemplos de Uso

### Exemplo Completo (JavaScript/TypeScript)

```typescript
// 1. Entrar na fila
const response = await fetch('http://localhost:3000/battles/queue', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    mode: 'timed',
    modeValue: '15'
  })
});

const battle = await response.json();
console.log('Batalha criada:', battle);

// 2. Executar corrida (no app móvel)
// ...

// 3. Submeter resultado
const submitResponse = await fetch('http://localhost:3000/battles/submit', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    battleId: battle.id,
    distance: 5000,
    duration: 1200,
    averagePace: 4.5,
    path: [
      { latitude: -21.1775, longitude: -47.8103, timestamp: '2026-01-13T20:00:00.000Z' },
      // ... mais pontos
    ]
  })
});

const result = await submitResponse.json();
console.log('Resultado:', result);
```

---

## 🔗 Arquivos Relacionados

- `src/battles/battles.controller.ts` - Controller REST
- `src/battles/battles.module.ts` - Módulo NestJS
- `src/battles/services/battle.service.ts` - Lógica de negócio
- `src/battles/services/battle-score.service.ts` - Cálculo de Battle Score
- `src/battles/services/trophy.service.ts` - Sistema de troféus
- `src/battles/services/league.service.ts` - Sistema de ligas
- `src/battles/services/anti-cheat.service.ts` - Validação anti-cheat
- `src/battles/gateway/battle.gateway.ts` - WebSocket Gateway

---

**Desenvolvido para DomRun** 🏃‍♂️💨
