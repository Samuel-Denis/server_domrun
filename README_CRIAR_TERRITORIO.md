# 📍 Como Criar um Território (Área Conquistada)

Este guia explica como enviar os dados para criar uma área conquistada após uma corrida que fechou um circuito.

---

## 🎯 Endpoint

**POST** `/runs`

**URL:** `http://seu-servidor:3000/runs`

**Autenticação:** Requerida (JWT Bearer Token no header)

---

## 📋 Pré-requisitos

1. ✅ Usuário autenticado (fazer login primeiro)
2. ✅ Ter um token JWT válido
3. ✅ Ter coletado pontos GPS durante a corrida
4. ✅ Ter detectado que o circuito foi fechado (usuário retornou próximo ao ponto inicial)

---

## 📦 Estrutura dos Dados

### Campos Obrigatórios

| Campo | Tipo | Descrição | Exemplo |
|-------|------|-----------|---------|
| `userId` | string (UUID) | ID do usuário autenticado | `"e9f912cc-f926-4920-8ad8-f12714877f49"` |
| `userName` | string | Nome de usuário | `"denis.tsx"` |
| `userColor` | string | Cor hexadecimal do usuário | `"#7B2CBF"` |
| `areaName` | string | Nome da área conquistada | `"Parque Central - Sul"` |
| `boundary` | array | Array com TODOS os pontos do caminho corrido | Ver exemplo abaixo |
| `area` | number | Área em metros quadrados | `12500.5` |

### Campos Opcionais

| Campo | Tipo | Descrição | Exemplo |
|-------|------|-----------|---------|
| `capturedAt` | string (ISO 8601) | Data/hora da conquista | `"2026-01-15T10:35:00.000Z"` |
| `distance` | number | Distância percorrida em metros | `2500.0` |
| `duration` | number | Duração em segundos | `900` |
| `averagePace` | number | Ritmo médio em min/km | `6.0` |
| `maxSpeed` | number | Velocidade máxima em km/h | `15.5` |
| `elevationGain` | number | Ganho de elevação em metros | `50` |
| `calories` | number | Calorias queimadas | `180` |

---

## 🔑 Estrutura do Array `boundary`

Cada ponto no array `boundary` deve ter a seguinte estrutura:

```json
{
  "latitude": -21.1800,
  "longitude": -47.8150,
  "timestamp": "2026-01-15T10:30:00.000Z"
}
```

**Importante:**
- O array deve conter **TODOS** os pontos coletados durante a corrida
- Não simplifique ou reduza o número de pontos
- Mínimo de 3 pontos para formar um polígono válido
- O primeiro e último ponto devem ser iguais (polígono fechado), ou o sistema fecha automaticamente

---

## 📨 Exemplo Completo de Requisição

### JSON Completo

```json
{
  "userId": "e9f912cc-f926-4920-8ad8-f12714877f49",
  "userName": "denis.tsx",
  "userColor": "#7B2CBF",
  "areaName": "Parque Central - Sul",
  "boundary": [
    {
      "latitude": -21.1800,
      "longitude": -47.8150,
      "timestamp": "2026-01-15T10:30:00.000Z"
    },
    {
      "latitude": -21.1801,
      "longitude": -47.8149,
      "timestamp": "2026-01-15T10:30:05.000Z"
    },
    {
      "latitude": -21.1802,
      "longitude": -47.8148,
      "timestamp": "2026-01-15T10:30:10.000Z"
    },
    {
      "latitude": -21.1803,
      "longitude": -47.8147,
      "timestamp": "2026-01-15T10:30:15.000Z"
    },
    {
      "latitude": -21.1804,
      "longitude": -47.8148,
      "timestamp": "2026-01-15T10:30:20.000Z"
    },
    {
      "latitude": -21.1803,
      "longitude": -47.8149,
      "timestamp": "2026-01-15T10:30:25.000Z"
    },
    {
      "latitude": -21.1802,
      "longitude": -47.8150,
      "timestamp": "2026-01-15T10:30:30.000Z"
    },
    {
      "latitude": -21.1801,
      "longitude": -47.8150,
      "timestamp": "2026-01-15T10:30:35.000Z"
    },
    {
      "latitude": -21.1800,
      "longitude": -47.8150,
      "timestamp": "2026-01-15T10:30:40.000Z"
    }
  ],
  "capturedAt": "2026-01-15T10:35:00.000Z",
  "area": 12500.5,
  "distance": 2500.0,
  "duration": 900,
  "averagePace": 6.0,
  "maxSpeed": 15.5,
  "elevationGain": 50,
  "calories": 180
}
```

---

## 💻 Exemplos de Código

### 1. Flutter/Dart (HTTP Request)

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

Future<Map<String, dynamic>> createTerritory({
  required String userId,
  required String userName,
  required String userColor,
  required String areaName,
  required List<PositionPoint> boundary,
  required double area,
  String? capturedAt,
  double? distance,
  int? duration,
  double? averagePace,
  double? maxSpeed,
  double? elevationGain,
  int? calories,
  required String authToken,
}) async {
  final url = Uri.parse('http://192.168.0.101:3000/runs');
  
  // Converter boundary para JSON
  final boundaryJson = boundary.map((point) => {
    'latitude': point.latitude,
    'longitude': point.longitude,
    'timestamp': point.timestamp.toIso8601String(),
  }).toList();
  
  final body = {
    'userId': userId,
    'userName': userName,
    'userColor': userColor,
    'areaName': areaName,
    'boundary': boundaryJson,
    'area': area,
    if (capturedAt != null) 'capturedAt': capturedAt,
    if (distance != null) 'distance': distance,
    if (duration != null) 'duration': duration,
    if (averagePace != null) 'averagePace': averagePace,
    if (maxSpeed != null) 'maxSpeed': maxSpeed,
    if (elevationGain != null) 'elevationGain': elevationGain,
    if (calories != null) 'calories': calories,
  };
  
  final response = await http.post(
    url,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $authToken',
    },
    body: jsonEncode(body),
  );
  
  if (response.statusCode == 201) {
    return jsonDecode(response.body);
  } else {
    throw Exception('Erro ao criar território: ${response.statusCode} - ${response.body}');
  }
}

// Exemplo de uso
final result = await createTerritory(
  userId: currentUser.id,
  userName: currentUser.username,
  userColor: currentUser.color,
  areaName: 'Parque Central',
  boundary: currentRunPath, // Lista com todos os pontos coletados
  area: calculatedArea,
  capturedAt: DateTime.now().toIso8601String(),
  distance: runStats.distance,
  duration: runStats.duration,
  averagePace: runStats.averagePace,
  authToken: authToken,
);

if (result['conquered'] == true) {
  print('Território conquistado! ID: ${result['territoryId']}');
}
```

### 2. JavaScript/TypeScript (Fetch API)

```javascript
async function createTerritory(data, authToken) {
  const response = await fetch('http://192.168.0.101:3000/runs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Erro ao criar território: ${error.message || response.statusText}`);
  }

  return await response.json();
}

// Exemplo de uso
const territoryData = {
  userId: currentUser.id,
  userName: currentUser.username,
  userColor: currentUser.color,
  areaName: 'Parque Central - Sul',
  boundary: currentRunPath.map(point => ({
    latitude: point.latitude,
    longitude: point.longitude,
    timestamp: point.timestamp.toISOString(),
  })),
  area: calculatedArea,
  capturedAt: new Date().toISOString(),
  distance: runStats.distance,
  duration: runStats.duration,
  averagePace: runStats.averagePace,
  maxSpeed: runStats.maxSpeed,
  elevationGain: runStats.elevationGain,
  calories: runStats.calories,
};

try {
  const result = await createTerritory(territoryData, authToken);
  if (result.conquered) {
    console.log('Território conquistado!', result.territoryId);
  }
} catch (error) {
  console.error('Erro:', error.message);
}
```

### 3. React Native (Axios)

```javascript
import axios from 'axios';

const createTerritory = async (territoryData, authToken) => {
  try {
    const response = await axios.post(
      'http://192.168.0.101:3000/runs',
      territoryData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error('Erro ao criar território:', error.response?.data || error.message);
    throw error;
  }
};

// Exemplo de uso
const territoryData = {
  userId: user.id,
  userName: user.username,
  userColor: user.color,
  areaName: 'Parque Central',
  boundary: runPath.map(p => ({
    latitude: p.latitude,
    longitude: p.longitude,
    timestamp: p.timestamp,
  })),
  area: calculateArea(runPath),
  capturedAt: new Date().toISOString(),
  distance: runStats.distance,
  duration: runStats.duration,
  averagePace: runStats.averagePace,
};

const result = await createTerritory(territoryData, authToken);
```

### 4. cURL (Terminal)

```bash
curl -X POST http://192.168.0.101:3000/runs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -d '{
    "userId": "e9f912cc-f926-4920-8ad8-f12714877f49",
    "userName": "denis.tsx",
    "userColor": "#7B2CBF",
    "areaName": "Parque Central",
    "boundary": [
      {
        "latitude": -21.1800,
        "longitude": -47.8150,
        "timestamp": "2026-01-15T10:30:00.000Z"
      },
      {
        "latitude": -21.1801,
        "longitude": -47.8149,
        "timestamp": "2026-01-15T10:30:05.000Z"
      },
      {
        "latitude": -21.1800,
        "longitude": -47.8150,
        "timestamp": "2026-01-15T10:30:10.000Z"
      }
    ],
    "area": 12500.5,
    "distance": 2500.0,
    "duration": 900,
    "averagePace": 6.0
  }'
```

---

## ✅ Resposta de Sucesso

**Status Code:** `201 Created`

```json
{
  "message": "Território conquistado!",
  "conquered": true,
  "territoryId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "runId": "b2c3d4e5-f6a7-8901-bcde-f12345678901"
}
```

---

## ❌ Respostas de Erro

### 400 Bad Request - Dados Inválidos

```json
{
  "statusCode": 400,
  "message": [
    "boundary deve ser um array",
    "areaName não pode estar vazio"
  ],
  "error": "Bad Request"
}
```

### 400 Bad Request - Boundary Muito Curto

```json
{
  "statusCode": 400,
  "message": "Boundary deve conter pelo menos 3 pontos",
  "error": "Bad Request"
}
```

### 401 Unauthorized - Token Inválido

```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

### 400 Bad Request - userId Não Corresponde

```json
{
  "statusCode": 400,
  "message": "userId não corresponde ao usuário autenticado",
  "error": "Bad Request"
}
```

---

## 🔍 Validações e Regras

1. **Polígono Fechado:**
   - O primeiro e último ponto do `boundary` devem ser iguais
   - Se não estiverem, o sistema fecha automaticamente

2. **Mínimo de Pontos:**
   - Pelo menos 3 pontos são necessários para formar um polígono válido

3. **Preservação de Pontos:**
   - Todos os pontos enviados são preservados no banco de dados
   - Não há simplificação ou redução de pontos

4. **userId:**
   - Deve corresponder ao usuário autenticado (extraído do token JWT)

5. **Área:**
   - Se não fornecida, será calculada automaticamente pelo PostGIS
   - Recomendado enviar a área calculada no frontend para validação

---

## 📝 Checklist Antes de Enviar

- [ ] Usuário está autenticado e tem token JWT válido
- [ ] Token está incluído no header `Authorization: Bearer <token>`
- [ ] `boundary` contém todos os pontos coletados durante a corrida
- [ ] `boundary` tem pelo menos 3 pontos
- [ ] Primeiro e último ponto são iguais (ou serão corrigidos automaticamente)
- [ ] `userId` corresponde ao usuário autenticado
- [ ] `areaName` está preenchido
- [ ] `userColor` está no formato hexadecimal (#RRGGBB)
- [ ] `area` está em metros quadrados
- [ ] Timestamps estão no formato ISO 8601

---

## 💡 Dicas Importantes

### 1. Coleta de Pontos GPS

Durante a corrida, colete pontos GPS regularmente:

```dart
// Flutter exemplo
final positionStream = Geolocator.getPositionStream(
  locationSettings: LocationSettings(
    distanceFilter: 2, // Coletar ponto a cada 2 metros
    accuracy: LocationAccuracy.high,
  ),
);

positionStream.listen((Position position) {
  currentRunPath.add(PositionPoint(
    latitude: position.latitude,
    longitude: position.longitude,
    timestamp: DateTime.now(),
  ));
});
```

### 2. Detecção de Circuito Fechado

Verifique se o usuário retornou próximo ao ponto inicial:

```dart
bool isCircuitClosed(PositionPoint start, PositionPoint current, double threshold = 50.0) {
  final distance = calculateDistance(
    start.latitude, start.longitude,
    current.latitude, current.longitude,
  );
  return distance <= threshold; // 50 metros de tolerância
}
```

### 3. Preparação do Boundary

Garanta que o boundary está fechado:

```dart
void prepareBoundary(List<PositionPoint> path) {
  if (path.isEmpty) return;
  
  final first = path.first;
  final last = path.last;
  
  // Se não estiver fechado, adicionar o primeiro ponto ao final
  if (first.latitude != last.latitude || first.longitude != last.longitude) {
    path.add(PositionPoint(
      latitude: first.latitude,
      longitude: first.longitude,
      timestamp: DateTime.now(),
    ));
  }
}
```

### 4. Cálculo de Área

Calcule a área aproximada no frontend (o backend valida com PostGIS):

```dart
double calculateArea(List<PositionPoint> boundary) {
  // Usar fórmula de Shoelace ou biblioteca geoespacial
  // Exemplo simplificado:
  double area = 0.0;
  for (int i = 0; i < boundary.length - 1; i++) {
    area += boundary[i].longitude * boundary[i + 1].latitude;
    area -= boundary[i].latitude * boundary[i + 1].longitude;
  }
  return (area.abs() / 2) * 111000 * 111000; // Converter para m²
}
```

---

## 🧪 Testando a API

### Usando Postman ou Insomnia

1. Configure o método: `POST`
2. URL: `http://192.168.0.101:3000/runs`
3. Headers:
   - `Content-Type: application/json`
   - `Authorization: Bearer SEU_TOKEN`
4. Body (raw JSON): Cole o exemplo JSON completo acima
5. Envie a requisição

### Verificando o Resultado

Após criar o território, você pode verificar no mapa:

```
GET http://192.168.0.101:3000/runs/map
```

O território criado deve aparecer na resposta GeoJSON.

---

## 📚 Documentação Relacionada

- [API_TERRITORIES.md](./API_TERRITORIES.md) - Documentação completa da API de territories
- Endpoint GET `/runs/map` - Ver todos os territories no mapa

---

## ⚠️ Observações Finais

1. **Todos os pontos são preservados:** Não há simplificação dos dados
2. **Formato exato:** O polígono no mapa será exatamente como o caminho corrido
3. **Sobreposição:** Se o território se sobrepor a territórios de outros usuários, eles serão cortados automaticamente
4. **Performance:** Para corridas muito longas com muitos pontos (1000+), considere validar o tamanho máximo no frontend

---

**Última atualização:** Janeiro 2025
