# Guia Front-end — Batalhas Semanais

Este documento reúne as rotas relacionadas a **batalhas semanais** e **ligas**, com seus formatos de requisição e resposta, para implementação do front-end.

## Autenticação

As rotas de `weekly-battles` exigem **JWT**.

- Header: `Authorization: Bearer <token>`
- Datas retornadas seguem o padrão ISO 8601.

## Janela de tempo

- **Inscrições**: apenas **segunda-feira** (00:00–23:59).
- **Período competitivo**: **terça 00:00 → domingo 23:59**.

---

## Rotas — Weekly Battles

### 1) GET `/weekly-battles/current-room`
Retorna a sala semanal atual do usuário.

**Auth:** obrigatório

**Resposta (quando não está em sala):**
```json
{
  "message": "Você não está em uma sala semanal ativa",
  "room": null
}
```

**Resposta (quando está em sala):**
```json
{
  "id": "room_id",
  "leagueId": "league_id",
  "league": {
    "id": "league_id",
    "code": "STARTER",
    "displayName": "Starter",
    "order": 1,
    "isChampion": false,
    "minTrophiesToEnter": null,
    "paceTopSecKm": 270,
    "paceBaseSecKm": 480,
    "smurfCapSecKm": 230,
    "weeklyConsistencyMaxBonus": 400,
    "createdAt": "2026-01-20T10:00:00.000Z",
    "updatedAt": "2026-01-20T10:00:00.000Z"
  },
  "seasonNumber": 1,
  "weekNumber": 3,
  "weekKey": "2026-W03",
  "roomNumber": 1,
  "startDate": "2026-01-20T00:00:00.000Z",
  "endDate": "2026-01-26T23:59:59.999Z",
  "status": "OPEN",
  "createdAt": "2026-01-20T00:00:00.000Z",
  "updatedAt": "2026-01-20T00:00:00.000Z",
  "participantsCount": 20,
  "userParticipant": {
    "id": "participant_id",
    "totalPoints": 1240,
    "runsValidCount": 4,
    "position": 2
  }
}
```

---

### 2) GET `/weekly-battles/rooms/:roomId/ranking`
Retorna o ranking completo da sala.

**Auth:** obrigatório  
**Params:** `roomId` (UUID)

**Resposta:**
```json
{
  "roomId": "room_id",
  "league": {
    "code": "STARTER",
    "displayName": "Starter"
  },
  "weekKey": "2026-W03",
  "rankings": [
    {
      "position": 1,
      "userId": "user_id_1",
      "userName": "João",
      "userPhotoUrl": "https://...",
      "totalPoints": 1650,
      "consistencyBonus": 120,
      "runsValidCount": 5,
      "promoted": true,
      "demoted": false
    }
  ]
}
```

---

### 3) POST `/weekly-battles/runs`
Submete uma corrida para a sala semanal do usuário.

**Auth:** obrigatório  
**Body:**
```json
{
  "runId": "uuid-da-run"
}
```

**Resposta (201):** retorna o registro criado em `weekly_runs`:
```json
{
  "id": "weekly_run_id",
  "participantId": "participant_id",
  "roomId": "room_id",
  "runId": "run_id",
  "distanceMeters": 5200,
  "durationSeconds": 1650,
  "paceSecKm": 317,
  "paceScore": 520,
  "distanceScore": 140,
  "smoothnessScore": 85,
  "finalScore": 745,
  "dayKey": "2026-01-20",
  "countedDay": false,
  "countedWeek": false,
  "isValid": true,
  "invalidReason": null,
  "flags": [],
  "multiplier": 1,
  "submittedAt": "2026-01-20T14:12:30.000Z"
}
```

**Erros comuns:**
- `400` fora do período competitivo.
- `400` usuário sem sala ativa.
- `404` corrida não encontrada.
- `400` corrida não pertence ao usuário.
- `400` corrida já submetida.

---

### 4) GET `/weekly-battles/runs`
Lista as corridas submetidas pelo usuário na sala atual.

**Auth:** obrigatório

**Resposta:**
```json
[
  {
    "id": "weekly_run_id",
    "participantId": "participant_id",
    "roomId": "room_id",
    "runId": "run_id",
    "distanceMeters": 5200,
    "durationSeconds": 1650,
    "paceSecKm": 317,
    "paceScore": 520,
    "distanceScore": 140,
    "smoothnessScore": 85,
    "finalScore": 745,
    "dayKey": "2026-01-20",
    "countedDay": true,
    "countedWeek": true,
    "isValid": true,
    "invalidReason": null,
    "flags": [],
    "multiplier": 1,
    "submittedAt": "2026-01-20T14:12:30.000Z",
    "room": {
      "id": "room_id",
      "leagueId": "league_id",
      "seasonNumber": 1,
      "weekNumber": 3,
      "weekKey": "2026-W03",
      "roomNumber": 1,
      "startDate": "2026-01-20T00:00:00.000Z",
      "endDate": "2026-01-26T23:59:59.999Z",
      "status": "OPEN",
      "createdAt": "2026-01-20T00:00:00.000Z",
      "updatedAt": "2026-01-20T00:00:00.000Z",
      "league": {
        "id": "league_id",
        "code": "STARTER",
        "displayName": "Starter",
        "order": 1,
        "isChampion": false,
        "minTrophiesToEnter": null,
        "paceTopSecKm": 270,
        "paceBaseSecKm": 480,
        "smurfCapSecKm": 230,
        "weeklyConsistencyMaxBonus": 400,
        "createdAt": "2026-01-20T10:00:00.000Z",
        "updatedAt": "2026-01-20T10:00:00.000Z"
      }
    }
  }
]
```

---

### 5) POST `/weekly-battles/champion/runs`
Submete uma corrida para a **Liga Imortal**.

**Auth:** obrigatório  
**Body:**
```json
{
  "runId": "uuid-da-run"
}
```

**Resposta (201):** retorna o registro criado em `champion_runs`:
```json
{
  "id": "champion_run_id",
  "userId": "user_id",
  "runId": "run_id",
  "distanceMeters": 5200,
  "durationSeconds": 1650,
  "paceSecKm": 317,
  "finalScore": 745,
  "trophiesEarned": 30,
  "isValid": true,
  "invalidReason": null,
  "flags": [],
  "multiplier": 1,
  "submittedAt": "2026-01-20T14:12:30.000Z"
}
```

**Erros comuns:**
- `400` fora do período competitivo.
- `400` usuário não é da Liga Imortal.
- `404` corrida não encontrada.
- `400` corrida não pertence ao usuário.
- `400` corrida já submetida.

---

### 6) POST `/weekly-battles/enroll`
Inscreve o usuário para a **próxima semana**.

**Auth:** obrigatório  
**Resposta (201):**
```json
{
  "id": "enrollment_id",
  "userId": "user_id",
  "weekKey": "2026-W04",
  "seasonNumber": 1,
  "weekNumber": 4,
  "leagueId": "league_id",
  "enrolledAt": "2026-01-20T09:00:00.000Z",
  "league": {
    "code": "STARTER",
    "displayName": "Starter"
  }
}
```

**Erros comuns:**
- `400` fora do período de inscrição (segunda).
- `404` usuário não encontrado.
- `400` usuário sem liga ou liga Imortal.
- `400` já inscrito.

---

### 7) DELETE `/weekly-battles/enroll`
Cancela inscrição do usuário para a próxima semana.

**Auth:** obrigatório  
**Resposta:** `204 No Content`

**Erros comuns:**
- `400` fora do período de inscrição (segunda).
- `404` inscrição não encontrada.

---

### 8) GET `/weekly-battles/enrollments`
Lista inscrições do usuário.

**Auth:** obrigatório  
**Resposta:**
```json
[
  {
    "id": "enrollment_id",
    "userId": "user_id",
    "weekKey": "2026-W04",
    "seasonNumber": 1,
    "weekNumber": 4,
    "leagueId": "league_id",
    "enrolledAt": "2026-01-20T09:00:00.000Z",
    "league": {
      "code": "STARTER",
      "displayName": "Starter"
    }
  }
]
```

---

## Rotas — Ligas

### 9) GET `/leagues`
Lista todas as ligas ordenadas.

**Auth:** não obrigatório  
**Resposta:**
```json
[
  {
    "id": "league_id",
    "code": "STARTER",
    "displayName": "Starter",
    "order": 1,
    "isChampion": false,
    "minTrophiesToEnter": null,
    "paceTopSecKm": 270,
    "paceBaseSecKm": 480,
    "smurfCapSecKm": 230,
    "weeklyConsistencyMaxBonus": 400,
    "createdAt": "2026-01-20T10:00:00.000Z",
    "updatedAt": "2026-01-20T10:00:00.000Z"
  }
]
```

---

### 10) GET `/leagues/:code`
Retorna uma liga por código.

**Auth:** não obrigatório  
**Params:** `code` (ex.: `STARTER`, `ELITE`, `IMMORTAL`)

**Resposta:**
```json
{
  "id": "league_id",
  "code": "STARTER",
  "displayName": "Starter",
  "order": 1,
  "isChampion": false,
  "minTrophiesToEnter": null,
  "paceTopSecKm": 270,
  "paceBaseSecKm": 480,
  "smurfCapSecKm": 230,
  "weeklyConsistencyMaxBonus": 400,
  "createdAt": "2026-01-20T10:00:00.000Z",
  "updatedAt": "2026-01-20T10:00:00.000Z"
}
```

---

## Observações rápidas para UI

- `current-room` é a principal fonte para tela da semana (liga atual, semana, status e posição do usuário).
- `ranking` usa `position`, `promoted`, `demoted` para badges de subida/queda.
- `weekly-runs` traz os scores por corrida e flags de anti-cheat.
- `weeklyConsistencyMaxBonus` define o teto do bônus de consistência.
