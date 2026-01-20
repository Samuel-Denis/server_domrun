# 📋 Guia: Como Receber Territórios no Backend

Este documento explica como receber e processar os dados de territórios enviados pelo frontend Flutter.

## 📥 Formato dos Dados Recebidos

O frontend envia um JSON com a seguinte estrutura:

```json
{
  "id": "",
  "userId": "uuid-do-usuario",
  "userName": "nome.usuario",
  "userColor": "#7B2CBF",
  "areaName": "Jardim Paulista - Circuito Completo",
  "boundary": [
    {
      "latitude": -21.1914,
      "longitude": -47.7874,
      "timestamp": "2026-01-15T10:30:00.000Z"
    },
    {
      "latitude": -21.1882,
      "longitude": -47.7895,
      "timestamp": "2026-01-15T10:30:05.000Z"
    },
    // ... mais pontos na ordem que seguem as ruas
  ],
  "capturedAt": "2026-01-15T10:30:20.000Z",
  "area": 0.0  // Opcional - será calculado pelo backend após ST_Buffer
}
```

## ⚠️ IMPORTANTE

- **`boundary`** é uma **LineString** (rastro da rua), **NÃO** um polígono fechado
- Os pontos **NÃO** devem ser fechados (primeiro ponto ≠ último ponto)
- A ordem dos pontos é **crítica** - eles seguem a rota pelas ruas
- O backend aplica **ST_Buffer** de 10 metros para criar a área que "pinta" o asfalto
- O campo `area` é **opcional** - será calculado automaticamente pelo PostGIS

---

## 🔧 Implementação no Backend (NestJS + PostGIS)

### 1. DTO (Data Transfer Object)

O DTO está em `src/runs/dto/create-territory.dto.ts`:

```typescript
export class CreateTerritoryDto {
  id?: string;
  userId: string;
  userName: string;
  userColor: string;
  areaName: string;
  boundary: PositionPointDto[];  // LineString (não fechada)
  capturedAt?: string;
  area?: number;  // Opcional - será calculado após ST_Buffer
  
  // Dados opcionais da corrida
  distance?: number;
  duration?: number;
  averagePace?: number;
  maxSpeed?: number;
  elevationGain?: number;
  calories?: number;
}

export class PositionPointDto {
  latitude: number;
  longitude: number;
  timestamp?: string;
}
```

### 2. Controller (Endpoint)

O endpoint está em `src/runs/runs.controller.ts`:

```typescript
@Controller('runs')
export class RunsController {
  @UseGuards(JwtAuthGuard)
  @Post()
  async createRun(@CurrentUser() user: any, @Body() body: CreateTerritoryDto) {
    if (body.boundary && body.boundary.length > 0) {
      return this.runsService.createTerritory(user.id, body);
    }
    // ... compatibilidade com formato antigo
  }
}
```

### 3. Service (Lógica de Negócio)

O service está em `src/runs/runs.service.ts` e faz as seguintes validações:

1. **Validação de LineString**: Verifica se tem pelo menos 2 pontos e que não está fechada
2. **Validação de coordenadas**: Latitude entre -90 e 90, Longitude entre -180 e 180
3. **Validação de usuário**: Verifica se o userId corresponde ao usuário autenticado

```typescript
async createTerritory(userId: string, dto: CreateTerritoryDto) {
  // Valida boundary (LineString - não fechada, mínimo 2 pontos)
  this.validateBoundary(dto.boundary);
  
  // Valida userId
  if (dto.userId !== userId) {
    throw new BadRequestException('userId não corresponde ao usuário autenticado');
  }
  
  // Cria território aplicando ST_Buffer de 10m
  return this.runsRepository.createTerritoryWithBoundary({
    ...dto,
    userId,
  });
}
```

### 4. Repository (PostGIS Operations)

O repository está em `src/runs/runs.repository.ts` e implementa:

#### 4.1. Conversão para LineString WKT

```typescript
private createLineStringWKT(points: Array<{ latitude: number; longitude: number }>): string {
  const coordinates = points
    .map((p) => `${p.longitude} ${p.latitude}`)
    .join(', ');
  
  return `LINESTRING(${coordinates})`;
}
```

#### 4.2. Aplicação de ST_Buffer e Cálculo de Área

```sql
-- Cria o polígono bufferizado de 10 metros
ST_Transform(
  ST_Buffer(
    ST_Transform(
      ST_GeomFromText($5, 4326),  -- LineString em WGS84
      3857  -- Transforma para Web Mercator (metros)
    ),
    10  -- 10 metros de buffer
  ),
  4326  -- Transforma de volta para WGS84
)

-- Calcula a área em metros quadrados
ST_Area(
  ST_Transform(
    ST_Buffer(
      ST_Transform(ST_GeomFromText($5, 4326), 3857),
      10
    ),
    3857
  )
)
```

#### 4.3. Corte de Territórios Sobrepostos

Após criar o novo território, o sistema automaticamente:
- Corta partes de territórios de outros usuários que se sobrepõem
- Remove pedaços muito pequenos (menores que 5m²)

#### 4.4. Conversão de GeoJSON para Boundary

O polígono bufferizado retornado pelo PostGIS é convertido de volta para o formato boundary:

```typescript
private geoJsonToBoundaryPoints(geoJson: any): Array<{ latitude: number; longitude: number; timestamp?: string }> {
  if (!geoJson || geoJson.type !== 'Polygon') {
    return [];
  }

  // Extrai o ring externo do polígono
  const coordinates = geoJson.coordinates[0] as number[][];
  
  return coordinates.map((coord) => ({
    latitude: coord[1],  // GeoJSON usa [lng, lat]
    longitude: coord[0],
    timestamp: new Date().toISOString(),
  }));
}
```

---

## 📊 Exemplo SQL Direto (para testes)

Se você quiser testar diretamente no PostgreSQL:

```sql
-- 1. Receber os pontos como LineString
WITH linestring_data AS (
  SELECT ST_GeomFromText(
    'LINESTRING(-47.7874 -21.1914, -47.7895 -21.1882, -47.7870 -21.1870, -47.7858 -21.1902)',
    4326
  ) AS line
)
-- 2. Aplicar ST_Buffer de 10 metros e calcular área
SELECT 
  ST_AsGeoJSON(
    ST_Transform(
      ST_Buffer(
        ST_Transform(line, 3857),  -- Transforma para Web Mercator (metros)
        10  -- 10 metros de buffer
      ),
      4326  -- Transforma de volta para WGS84
    )
  )::json AS bufferized_polygon,
  -- 3. Calcular a área em metros quadrados
  ST_Area(
    ST_Transform(
      ST_Buffer(
        ST_Transform(line, 3857),
        10
      ),
      3857
    )
  ) AS area_m2
FROM linestring_data;
```

---

## 🗄️ Schema do Banco de Dados

O schema já está configurado em `prisma/schema.prisma`:

```prisma
model Territory {
  id         String   @id @default(uuid())
  userId     String
  userName   String?
  userColor  String?
  areaName   String?
  area       Float?   // Área em metros quadrados
  capturedAt DateTime? @default(now())
  createdAt  DateTime  @default(now())
  geometry   Unsupported("geometry(Polygon, 4326)")  // Polígono bufferizado
  
  @@index([geometry], type: Gist)
  @@index([userId])
}
```

**Importante**: A coluna `geometry` armazena um **POLYGON** (resultado do ST_Buffer), não uma LineString.

---

## 🔍 Validações Implementadas

O backend valida automaticamente:

1. **Número mínimo de pontos**: Pelo menos 2 pontos para formar uma LineString
2. **LineString não fechada**: O primeiro e último ponto devem ser diferentes
3. **Coordenadas válidas**: 
   - Latitude: -90 a 90
   - Longitude: -180 a 180
4. **Usuário autenticado**: Verifica se o userId corresponde ao usuário logado

---

## 📤 Formato de Resposta ao Frontend

O backend retorna:

```json
{
  "id": "uuid-gerado-pelo-backend",
  "userId": "uuid-do-usuario",
  "userName": "nome.usuario",
  "userColor": "#7B2CBF",
  "areaName": "Jardim Paulista - Circuito Completo",
  "boundary": [
    {
      "latitude": -21.1914,
      "longitude": -47.7874,
      "timestamp": "2026-01-15T10:30:00.000Z"
    },
    // ... pontos do polígono bufferizado (JÁ FECHADO)
  ],
  "capturedAt": "2026-01-15T10:30:20.000Z",
  "area": 1250.50,  // Área real calculada em m²
  "runId": "uuid-da-corrida-associada"
}
```

**Importante**: 
- O `boundary` retornado agora é um **Polígono** (fechado, com primeiro ponto = último ponto)
- É o resultado do `ST_Buffer(10m)` aplicado na LineString original
- A `area` é calculada automaticamente do polígono bufferizado

---

## 🎯 Resumo do Fluxo

1. **Frontend** envia LineString (rastro da rua, não fechado) via `POST /runs`
2. **Backend** valida a LineString (mínimo 2 pontos, não fechada, coordenadas válidas)
3. **Backend** converte para LineString WKT
4. **PostGIS** aplica `ST_Buffer(10m)` criando um polígono
5. **PostGIS** calcula `ST_Area` do polígono bufferizado
6. **Backend** salva o polígono no banco (coluna `geometry`)
7. **Backend** corta territórios sobrepostos de outros usuários
8. **Backend** cria a corrida associada
9. **Backend** retorna o polígono bufferizado ao frontend
10. **Frontend** desenha o polígono no mapa como "pintura" do asfalto

---

## 📝 Endpoint da API

### POST /runs

**Autenticação**: Requerida (JWT Token)

**Body**:
```json
{
  "userId": "uuid-do-usuario",
  "userName": "nome.usuario",
  "userColor": "#7B2CBF",
  "areaName": "Nome da Área",
  "boundary": [
    {
      "latitude": -21.1914,
      "longitude": -47.7874,
      "timestamp": "2026-01-15T10:30:00.000Z"
    }
  ],
  "capturedAt": "2026-01-15T10:30:20.000Z",
  "distance": 1500.0,  // Opcional
  "duration": 420,     // Opcional (segundos)
  "averagePace": 4.5   // Opcional (min/km)
}
```

**Resposta (200)**:
```json
{
  "id": "uuid",
  "userId": "uuid",
  "userName": "nome.usuario",
  "userColor": "#7B2CBF",
  "areaName": "Nome da Área",
  "boundary": [...],  // Polígono bufferizado (fechado)
  "capturedAt": "2026-01-15T10:30:20.000Z",
  "area": 1250.50,
  "runId": "uuid"
}
```

**Erros**:
- `400 Bad Request`: Boundary inválido (menos de 2 pontos, fechado, coordenadas inválidas)
- `401 Unauthorized`: Token JWT inválido ou ausente
- `400 Bad Request`: userId não corresponde ao usuário autenticado

---

## 🔧 Logs do Sistema

O backend gera logs detalhados para debugging:

```
📥 Recebendo território do frontend:
   - Tipo: LineString (45 pontos)
   - Usuário: denis.tsx
   - Área: Jardim Paulista - Circuito Completo

🛠️  Processando território...
   📍 45 pontos recebidos (LineString)
   ✅ LineString WKT criada

✅ Território salvo com sucesso!
   - ID: 123e4567-e89b-12d3-a456-426614174000
   - Área calculada: 1250.50 m²
   - Tipo retornado: Polygon (Polígono bufferizado)
```

---

**Última atualização**: Janeiro 2025  
**Versão**: 2.0  
**Backend**: NestJS + Prisma + PostGIS
