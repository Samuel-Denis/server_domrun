# 🎮 Sistema de Batalhas PvP Semanais - Run Empire

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Arquitetura do Sistema](#arquitetura-do-sistema)
- [Sistema de Salas Semanais](#sistema-de-salas-semanais)
- [Sistema de Ligas](#sistema-de-ligas)
- [Sistema de Pontuação](#sistema-de-pontuação)
- [Regras e Validações](#regras-e-validações)
- [Anti-Cheat Avançado](#anti-cheat-avançado)
- [Liga Campeão (Endgame)](#liga-campeão-endgame)
- [Fluxo Semanal](#fluxo-semanal)
- [API REST](#api-rest)
- [WebSocket Events](#websocket-events)

---

## 🎯 Visão Geral

O Sistema de Batalhas PvP Semanais é um modo competitivo onde **20 jogadores competem em uma sala durante 1 semana**, completando **5 corridas obrigatórias de 5km cada**. Ao final da semana, os resultados determinam promoção, permanência ou rebaixamento de liga.

### Características Principais

- ✅ **Competição Semanal**: Cada sala dura 7 dias
- ✅ **20 Jogadores por Sala**: Matchmaking baseado em liga
- ✅ **5 Corridas Obrigatórias**: Mínimo necessário para pontuar
- ✅ **5km por Corrida**: Distância padrão
- ✅ **Promoção/Rebaixamento**: Top 5 sobem, últimos 5 descem

---

## 🏗️ Arquitetura do Sistema

### Separação de Código

Este sistema é **completamente separado** do sistema de batalhas 1v1 atual:

```
src/
├── battles/              # Sistema 1v1 atual (mantido)
└── weekly-battles/       # NOVO: Sistema semanal
    ├── weekly-battles.module.ts
    ├── weekly-battles.controller.ts
    ├── services/
    │   ├── weekly-room.service.ts      # Gerenciamento de salas
    │   ├── weekly-matchmaking.service.ts # Matchmaking por liga
    │   ├── weekly-score.service.ts     # Cálculo de pontuação
    │   ├── weekly-anti-cheat.service.ts # Anti-cheat avançado
    │   ├── weekly-league.service.ts    # Gerenciamento de ligas semanais
    │   └── champion-league.service.ts  # Sistema especial da liga Campeão
    ├── dto/
    │   ├── create-weekly-run.dto.ts
    │   ├── weekly-room-response.dto.ts
    │   └── weekly-ranking.dto.ts
    ├── gateway/
    │   └── weekly-battle.gateway.ts    # WebSocket para eventos em tempo real
    └── entities/
        └── weekly-run.entity.ts
```

---

## 🏛️ Sistema de Salas Semanais

### Estrutura de Dados

#### WeeklyRoom (Sala Semanal)

```typescript
{
  id: string;
  league: string;           // Liga da sala (Bronze, Prata, etc.)
  seasonNumber: number;     // Número da temporada
  weekNumber: number;       // Semana da temporada
  startDate: DateTime;      // Início da semana (segunda 00:00)
  endDate: DateTime;        // Fim da semana (domingo 23:59)
  status: 'OPEN' | 'IN_PROGRESS' | 'FINISHED' | 'CLOSED';
  createdAt: DateTime;
  updatedAt: DateTime;
}
```

#### WeeklyRoomParticipant (Participante)

```typescript
{
  id: string;
  roomId: string;
  userId: string;
  currentLeague: string;    // Liga no início da semana
  totalPoints: number;      // Pontos acumulados
  runsCompleted: number;    // Corridas válidas completadas
  position: number;         // Posição final na sala
  promoted: boolean;        // Se foi promovido
  demoted: boolean;         // Se foi rebaixado
  joinedAt: DateTime;
}
```

#### WeeklyRun (Corrida Semanal)

```typescript
{
  id: string;
  participantId: string;
  runId: string;            // ID da corrida no sistema principal
  roomId: string;
  distance: number;         // em metros
  duration: number;         // em segundos
  averagePace: number;      // em min/km
  paceRegularity: number;   // Score de regularidade (0-1)
  points: number;           // Pontos desta corrida
  isValid: boolean;         // Se passou no anti-cheat
  validationReason?: string;
  submittedAt: DateTime;
}
```

### Ciclo de Vida da Sala

1. **Criação**: Segunda-feira 00:00 - Sistema cria salas para cada liga
2. **Matchmaking**: Até 20 jogadores são colocados por sala (por liga)
3. **Execução**: Jogadores têm 7 dias para completar 5 corridas
4. **Encerramento**: Domingo 23:59 - Sistema processa resultados
5. **Processamento**: Segunda-feira 00:00-01:00 - Promoção/rebaixamento

---

## 🏅 Sistema de Ligas

### Estrutura de Ligas

| Liga | Descrição | Troféus ao Chegar |
|------|-----------|-------------------|
| **Bronze** | Liga inicial | 0 |
| **Prata** | Primeira progressão | 500 |
| **Ouro** | Liga intermediária | 1000 |
| **Aspirante** | Liga avançada | 2000 |
| **Atleta** | Liga experiente | 2500 |
| **Pro** | Liga profissional | 2750 |
| **Campeão** | Liga máxima (endgame) | 3000+ |

### Regras de Promoção/Rebaixamento

**Em cada sala de 20 jogadores:**

- 🟢 **Top 5 (1º-5º)**: Promovidos para liga superior
- 🟡 **Meio (6º-15º)**: Permanencem na mesma liga
- 🔴 **Últimos (16º-20º)**: Rebaixados para liga inferior

**Exceções:**
- Bronze: Não rebaixa (últimos 5 apenas não ganham troféus)
- Campeão: Sistema especial (ver seção específica)

---

## 🧮 Sistema de Pontuação

### Fórmula de Pontuação por Corrida

Cada corrida válida gera **Battle Points (BP)** calculados pela seguinte fórmula:

```
BP = (Distância_Score × 0.30) + 
     (Pace_Score × 0.40) + 
     (Regularidade_Score × 0.20) + 
     (Constância_Score × 0.10)
```

### Componentes Detalhados

#### 1. Distância Score (30% do total)

```
Distância_Minima = 5000 metros (5km)
Distância_Score = min(Distância / Distância_Minima, 1.5) × 1000

Exemplos:
- 5.0 km → 1000 pontos
- 5.5 km → 1100 pontos
- 7.5 km → 1500 pontos (máximo)
```

#### 2. Pace Score (40% do total)

```
Pace_Min_Segundos = 180 (3:00 min/km) - Máximo humano
Pace_Max_Segundos = 720 (12:00 min/km) - Mínimo aceitável

Se Pace < Pace_Min → INVALIDADO (anti-cheat)
Se Pace > Pace_Max → 0 pontos

Pace_Score = ((720 - Pace_Segundos) / (720 - 240)) × 1000

Exemplos:
- 3:00 min/km (180s) → 1000 pontos (máximo)
- 4:30 min/km (270s) → ~750 pontos
- 6:00 min/km (360s) → ~500 pontos
- 8:00 min/km (480s) → ~250 pontos
- 12:00 min/km (720s) → 0 pontos
```

#### 3. Regularidade Score (20% do total)

Mede a consistência do ritmo durante a corrida.

```
Variância_Pace = Desvio padrão dos paces entre segmentos de 500m
Pace_Médio = Média dos paces

Coeficiente_Variação = Variância_Pace / Pace_Médio

Regularidade_Score = max(0, (1 - Coeficiente_Variação) × 1000)

Exemplos:
- Ritmo muito constante (CV < 0.05) → 950-1000 pontos
- Ritmo razoável (CV 0.05-0.15) → 700-950 pontos
- Ritmo irregular (CV > 0.20) → 0-500 pontos
```

**Cálculo de Segmentos:**
- Divide a corrida em segmentos de 500m
- Calcula pace de cada segmento
- Calcula desvio padrão entre segmentos

#### 4. Constância Semanal Score (10% do total)

Bônus por completar corridas consistentemente ao longo da semana.

```
Corridas_Completadas = Número de corridas válidas até agora
Dias_Da_Semana = Dias desde início da sala

Ideal = 5 corridas distribuídas em 5 dias diferentes

Constância_Score = (Corridas_Completadas / 5) × 
                   (1 - Penalidade_Atraso) × 
                   1000

Penalidade_Atraso:
- Se todas as corridas no mesmo dia → -30%
- Se corridas concentradas em 2 dias → -15%
- Se corridas bem distribuídas → 0%
```

### Pontuação Total da Semana

```
Total_Points = Σ(BP_i) para i = 1 até 5

Requisito Mínimo: 5 corridas válidas para entrar no ranking
```

### Ranking Final

Ordenação:
1. **Total_Points** (decrescente)
2. Em caso de empate: **Pace médio** (menor é melhor)
3. Em caso de empate: **Distância total** (maior é melhor)
4. Em caso de empate: **Tempo de submissão** (primeiro é melhor)

---

## ✅ Regras e Validações

### Requisitos Mínimos por Corrida

1. **Distância Mínima**: 4.5km (90% de 5km)
   - Corridas abaixo disso não contam

2. **Pace Válido**: Entre 3:00 e 12:00 min/km
   - Abaixo de 3:00 → Suspeito (veículo/bike)
   - Acima de 12:00 → Muito lento (caminhada)

3. **GPS Contínuo**: Máximo 30 segundos sem sinal
   - Gaps maiores invalidam a corrida

4. **Duração Mínima**: 15 minutos
   - Corridas muito rápidas são suspeitas

5. **Velocidade Máxima Sustentada**: 25 km/h
   - Velocidades acima disso por mais de 1 minuto invalidam

### Regras da Semana

- ✅ **Mínimo**: 5 corridas válidas para pontuar
- ✅ **Máximo**: 10 corridas válidas contam (melhores 5)
- ✅ **Prazo**: Corridas devem ser completadas antes de domingo 23:59
- ✅ **Distribuição**: Recomendado fazer corridas em dias diferentes

---

## 🛡️ Anti-Cheat Avançado

### Validações por Camada

#### Camada 1: Validação de Velocidade

```typescript
// Detecção de picos de velocidade
for (cada segmento de 30 segundos) {
  velocidade_media = distancia / tempo
  
  if (velocidade_media > 25 km/h) {
    contador_picos++
  }
}

if (contador_picos > 3) {
  INVALIDADO: "Múltiplos picos de velocidade incompatíveis com corrida"
}
```

#### Camada 2: Detecção de Veículos/Bicicleta

```typescript
// Análise de padrão de movimento
velocidade_media_total = distancia_total / tempo_total

if (velocidade_media_total > 20 km/h && 
    variância_velocidade < 5) {
  INVALIDADO: "Padrão de movimento indica uso de veículo"
}

// Detecção de velocidades constantes (característica de veículos)
if (80% dos segmentos têm velocidade entre 15-25 km/h com variação < 2 km/h) {
  INVALIDADO: "Velocidade muito constante - possível bike"
}
```

#### Camada 3: Análise de GPS

```typescript
// Detecção de saltos de GPS
for (cada ponto GPS) {
  distancia_ponto_anterior = calcular_distancia(ponto_atual, ponto_anterior)
  tempo_entre_pontos = timestamp_atual - timestamp_anterior
  
  velocidade_necessaria = distancia_ponto_anterior / tempo_entre_pontos
  
  if (velocidade_necessaria > 50 km/h) {
    contador_saltos++
  }
}

if (contador_saltos > 5) {
  INVALIDADO: "Múltiplos saltos de GPS detectados"
}
```

#### Camada 4: Detecção de Trajetórias Irreais

```typescript
// Verifica se a trajetória faz sentido geograficamente
curvatura_total = calcular_curvatura(path)

if (curvatura_total > limite && velocidade > 15 km/h) {
  INVALIDADO: "Trajetória com curvas muito acentuadas para velocidade"
}

// Verifica se cortou caminhos (atravessou prédios, rios, etc.)
if (path cruza áreas_restritas && velocidade_alta) {
  INVALIDADO: "Trajetória passa por áreas restritas"
}
```

### Sistema de Penalidades Progressivas

| Ocorrência | Penalidade |
|------------|------------|
| 1ª corrida invalidada | Aviso (corrida não conta) |
| 2ª corrida invalidada | -10% nos pontos da próxima corrida válida |
| 3ª corrida invalidada | -25% nos pontos da próxima corrida válida |
| 4ª corrida invalidada | Desqualificado da semana atual |
| 5+ corridas invalidadas | Ban temporário de 2 semanas |

---

## 👑 Liga Campeão (Endgame)

### Sistema Especial

Ao chegar na liga **Campeão**, o sistema muda completamente:

#### Ao Promover para Campeão

- ✅ Recebe **3000 troféus** imediatamente
- ✅ Entra no sistema de **manutenção de troféus**
- ✅ Corridas passam a gerar **troféus** em vez de apenas pontos

### Sistema de Troféus na Campeão

#### Ganho de Troféus por Corrida

```
Troféus_Base = 50 (por corrida válida)
Bonus_Performance = (BP / 1000) × 10
Bonus_Consistência = (Constância_Score / 1000) × 10

Troféus_Ganhos = Troféus_Base + Bonus_Performance + Bonus_Consistência

Máximo por corrida: 100 troféus
```

#### Perda de Troféus Diária

```
Se não completar corrida no dia:
  Troféus_Perdidos = 75

Se completar corrida no dia:
  Troféus_Perdidos = 0

Aplicado diariamente às 23:59
```

#### Requisito de Manutenção

- ✅ Ao final da semana: Jogador deve ter **≥ 3000 troféus**
- ❌ Se tiver **< 3000 troféus**: Rebaixado automaticamente para **Pro**
- 🏆 Se tiver **≥ 3000 troféus**: Permanece em **Campeão**

### Ranking na Campeão

As salas da Campeão funcionam normalmente (20 jogadores), mas:

- **Top 5**: Permanecem na Campeão (mas precisam manter ≥ 3000 troféus)
- **Meio 10**: Permanecem na Campeão (mas precisam manter ≥ 3000 troféus)
- **Últimos 5**: Rebaixados para Pro (independente dos troféus)

### Mecânica Especial

- **Corridas extras contam**: Todas as corridas válidas geram troféus
- **Frequência é crucial**: Não correr = perder troféus
- **Performance importa**: Corridas melhores = mais troféus

---

## 📅 Fluxo Semanal

### Segunda-feira (00:00)

1. **Encerramento da Semana Anterior**
   - Sistema processa todas as salas finalizadas
   - Calcula rankings finais
   - Aplica promoções/rebaixamentos
   - Atualiza ligas dos jogadores

2. **Criação de Novas Salas**
   - Para cada liga ativa, cria salas novas
   - Associa jogadores às salas baseado em liga atual

3. **Matchmaking**
   - Distribui até 20 jogadores por sala
   - Se mais de 20 em uma liga, cria múltiplas salas

### Segunda a Domingo

- Jogadores completam corridas
- Pontos são calculados em tempo real
- Rankings são atualizados a cada corrida submetida
- Notificações via WebSocket para mudanças de posição

### Domingo (23:59)

- **Deadline final**: Última chance de submeter corridas
- Sistema bloqueia novas submissões

### Segunda-feira (00:00-01:00)

- **Processamento em Lote**:
  - Valida todas as corridas submetidas
  - Aplica anti-cheat final
  - Calcula rankings finais
  - Processa promoções/rebaixamentos
  - Envia notificações aos jogadores

---

## 🔌 API REST

### Endpoints

#### 1. Entrar em uma Sala

```http
POST /weekly-battles/join
Authorization: Bearer {token}
```

**Resposta:**
```json
{
  "roomId": "uuid",
  "league": "Bronze",
  "startDate": "2025-01-20T00:00:00Z",
  "endDate": "2025-01-26T23:59:59Z",
  "participants": 15,
  "maxParticipants": 20,
  "currentRanking": [...]
}
```

#### 2. Submeter Corrida Semanal

```http
POST /weekly-battles/runs
Authorization: Bearer {token}
Content-Type: application/json

{
  "roomId": "uuid",
  "runId": "uuid",  // ID da corrida já salva no sistema
  "distance": 5200,
  "duration": 1800,
  "averagePace": 5.77,
  "path": [...]
}
```

**Resposta:**
```json
{
  "weeklyRunId": "uuid",
  "points": 1250,
  "isValid": true,
  "currentPosition": 8,
  "totalPoints": 5250,
  "runsCompleted": 4
}
```

#### 3. Ver Ranking da Sala

```http
GET /weekly-battles/rooms/:roomId/ranking
Authorization: Bearer {token}
```

**Resposta:**
```json
{
  "roomId": "uuid",
  "league": "Bronze",
  "totalParticipants": 20,
  "ranking": [
    {
      "position": 1,
      "userId": "uuid",
      "username": "runner123",
      "name": "João",
      "totalPoints": 8250,
      "runsCompleted": 5,
      "averagePace": 4.5
    },
    ...
  ],
  "myPosition": 8
}
```

#### 4. Ver Minha Sala Atual

```http
GET /weekly-battles/current-room
Authorization: Bearer {token}
```

#### 5. Histórico de Salas

```http
GET /weekly-battles/history
Authorization: Bearer {token}
Query: ?limit=10&offset=0
```

---

## 📡 WebSocket Events

### Namespace: `/weekly-battles`

#### Eventos do Cliente

```typescript
// Entrar na sala
socket.emit('join-room', { roomId: string });

// Sair da sala
socket.emit('leave-room', { roomId: string });
```

#### Eventos do Servidor

```typescript
// Ranking atualizado
socket.on('ranking-updated', (data: {
  roomId: string;
  ranking: RankingEntry[];
  timestamp: Date;
}));

// Nova corrida submetida
socket.on('run-submitted', (data: {
  roomId: string;
  participantId: string;
  points: number;
  newPosition: number;
}));

// Corrida invalidada (anti-cheat)
socket.on('run-invalidated', (data: {
  roomId: string;
  participantId: string;
  reason: string;
}));

// Semana finalizada
socket.on('week-finished', (data: {
  roomId: string;
  finalRanking: RankingEntry[];
  promoted: string[];
  demoted: string[];
}));
```

---

## 🎯 Balanceamento e Considerações

### Pontos de Atenção

1. **Matchmaking Justo**: Garantir que jogadores da mesma liga competem juntos
2. **Anti-Cheat Robusto**: Múltiplas camadas de validação
3. **Engajamento Semanal**: 5 corridas distribuídas ao longo da semana
4. **Progressão Significativa**: Promoção/rebaixamento visível e importante
5. **Liga Campeão Desafiadora**: Manutenção ativa necessária

### Métricas de Sucesso

- **Taxa de Conclusão**: % de jogadores que completam 5 corridas
- **Distribuição de Ligas**: Manter distribuição saudável
- **Taxa de Validação**: % de corridas que passam no anti-cheat
- **Engajamento Semanal**: Jogadores ativos por semana

---

## 🔄 Próximos Passos de Implementação

1. ✅ Documentação completa
2. ⏳ Schema do banco de dados
3. ⏳ Serviços principais
4. ⏳ API REST
5. ⏳ WebSocket Gateway
6. ⏳ Testes unitários e de integração
7. ⏳ Deploy e monitoramento

---

**Versão**: 1.0.0  
**Última Atualização**: 2025-01-15  
**Autor**: Sistema Run Empire
