# 📍 Como Enviar Captura de Território - Frontend para Backend

## 🎯 Endpoint

```
POST /api/territories
```

**OU** (para compatibilidade):

```
POST /api/runs
```

Ambos aceitam o mesmo formato.

---

## 🔐 Autenticação

**Obrigatório**: Token JWT no header:

```
Authorization: Bearer {seu-token-jwt}
```

---

## 📦 Formato do JSON

### ⚠️ IMPORTANTE: O backend aceita DOIS formatos para `boundary`

### **Formato 1: Array de Objetos (Recomendado)**

```json
{
  "id": "",  // Opcional - string vazia ou omitir (backend gera UUID)
  "userName": "João Silva",
  "userColor": "#FF0000",  // Formato hexadecimal: #RRGGBB
  "areaName": "Centro de Ribeirão Preto",
  "boundary": [
    {
      "latitude": -21.1775,
      "longitude": -47.8103,
      "timestamp": "2025-01-16T10:30:00.000Z"
    },
    {
      "latitude": -21.1776,
      "longitude": -47.8104,
      "timestamp": "2025-01-16T10:30:05.000Z"
    },
    {
      "latitude": -21.1777,
      "longitude": -47.8105,
      "timestamp": "2025-01-16T10:30:10.000Z"
    }
    // ... mais pontos (mínimo 2, recomendado 100+)
  ],
  "capturedAt": "2025-01-16T10:30:00.000Z",
  "distance": 5000,  // Opcional - em metros
  "duration": 1800,  // Opcional - em segundos
  "averagePace": 6.0,  // Opcional - em min/km
  "maxSpeed": 12.5,  // Opcional - em km/h
  "elevationGain": 50,  // Opcional - em metros
  "calories": 250  // Opcional
}
```

### **Formato 2: GeoJSON (Aceito - Será Convertido Automaticamente)**

```json
{
  "userName": "João Silva",
  "userColor": "#FF0000",
  "areaName": "Centro de Ribeirão Preto",
  "boundary": {
    "type": "LineString",
    "coordinates": [
      [-47.8103, -21.1775],  // [longitude, latitude] - ORDEM IMPORTANTE!
      [-47.8104, -21.1776],
      [-47.8105, -21.1777]
      // ... mais coordenadas
    ]
  },
  "capturedAt": "2025-01-16T10:30:00.000Z"
}
```

**Nota**: Se usar formato GeoJSON, os `timestamps` serão gerados automaticamente pelo backend baseado no `capturedAt`.

### Campos Obrigatórios

- ✅ `userName`: Nome do usuário (string)
- ✅ `userColor`: Cor do usuário no formato `#RRGGBB` (ex: `#FF0000`)
- ✅ `areaName`: Nome da área/território (string)
- ✅ `boundary`: Array com **pelo menos 2 pontos**, cada ponto com:
  - `latitude` (number, -90 a 90)
  - `longitude` (number, -180 a 180)
  - `timestamp` (string ISO 8601, obrigatório)
- ✅ `capturedAt`: Data/hora da captura (string ISO 8601)

### Campos Opcionais

- `id`: String vazia ou omitir
- `area`: Área em m² (calculado automaticamente pelo backend)
- `distance`: Distância em metros
- `duration`: Duração em segundos
- `averagePace`: Ritmo médio em min/km
- `maxSpeed`: Velocidade máxima em km/h
- `elevationGain`: Ganho de elevação em metros
- `calories`: Calorias queimadas

---

## 💻 Exemplos de Código

### JavaScript/TypeScript (Fetch API)

```javascript
async function salvarTerritorio(territorioData) {
  const token = 'seu-token-jwt-aqui';
  
  const response = await fetch('http://localhost:3000/api/territories', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      userName: 'João Silva',
      userColor: '#FF0000',
      areaName: 'Centro de Ribeirão Preto',
      boundary: [
        {
          latitude: -21.1775,
          longitude: -47.8103,
          timestamp: new Date().toISOString()
        },
        {
          latitude: -21.1776,
          longitude: -47.8104,
          timestamp: new Date().toISOString()
        },
        // ... mais pontos
      ],
      capturedAt: new Date().toISOString()
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Erro ao salvar território');
  }

  return await response.json();
}
```

### Flutter/Dart

```dart
import 'package:http/http.dart' as http;
import 'dart:convert';

Future<Map<String, dynamic>> salvarTerritorio({
  required String token,
  required String userName,
  required String userColor,
  required String areaName,
  required List<Map<String, dynamic>> boundary,
}) async {
  final url = Uri.parse('http://localhost:3000/api/territories');
  
  final body = {
    'userName': userName,
    'userColor': userColor,
    'areaName': areaName,
    'boundary': boundary,
    'capturedAt': DateTime.now().toIso8601String(),
  };

  final response = await http.post(
    url,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    },
    body: json.encode(body),
  );

  if (response.statusCode != 201) {
    final error = json.decode(response.body);
    throw Exception(error['message'] ?? 'Erro ao salvar território');
  }

  return json.decode(response.body);
}

// Exemplo de uso:
final boundary = [
  {
    'latitude': -21.1775,
    'longitude': -47.8103,
    'timestamp': DateTime.now().toIso8601String(),
  },
  {
    'latitude': -21.1776,
    'longitude': -47.8104,
    'timestamp': DateTime.now().toIso8601String(),
  },
  // ... mais pontos
];

await salvarTerritorio(
  token: 'seu-token',
  userName: 'João Silva',
  userColor: '#FF0000',
  areaName: 'Centro de Ribeirão Preto',
  boundary: boundary,
);
```

### React Native (com axios)

```javascript
import axios from 'axios';

async function salvarTerritorio(territorioData, token) {
  try {
    const response = await axios.post(
      'http://localhost:3000/api/territories',
      {
        userName: territorioData.userName,
        userColor: territorioData.userColor,
        areaName: territorioData.areaName,
        boundary: territorioData.boundary.map(point => ({
          latitude: point.latitude,
          longitude: point.longitude,
          timestamp: point.timestamp.toISOString(),
        })),
        capturedAt: new Date().toISOString(),
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      }
    );
    
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(error.response.data.message || 'Erro ao salvar território');
    }
    throw error;
  }
}
```

---

## ✅ Validações Importantes

### 1. Boundary (Array de Pontos)

- **Mínimo**: 2 pontos
- **Recomendado**: 100+ pontos para melhor precisão
- Cada ponto **DEVE** ter:
  - `latitude`: número entre -90 e 90
  - `longitude`: número entre -180 e 180
  - `timestamp`: string ISO 8601 (ex: `"2025-01-16T10:30:00.000Z"`)

### 2. userColor

- **Formato obrigatório**: `#RRGGBB` (6 dígitos hexadecimais)
- ✅ Válido: `#FF0000`, `#00FF00`, `#0000FF`
- ❌ Inválido: `FF0000`, `#FF0`, `red`

### 3. Timestamps

- **Formato**: ISO 8601
- Exemplo: `"2025-01-16T10:30:00.000Z"`
- Pode usar: `new Date().toISOString()` (JavaScript)
- Pode usar: `DateTime.now().toIso8601String()` (Dart)

---

## 📝 Exemplo Completo com Todos os Dados

```json
{
  "userName": "João Silva",
  "userColor": "#FF0000",
  "areaName": "Centro - Ribeirão Preto",
  "boundary": [
    {
      "latitude": -21.1775,
      "longitude": -47.8103,
      "timestamp": "2025-01-16T10:30:00.000Z"
    },
    {
      "latitude": -21.1776,
      "longitude": -47.8104,
      "timestamp": "2025-01-16T10:30:05.000Z"
    },
    {
      "latitude": -21.1777,
      "longitude": -47.8105,
      "timestamp": "2025-01-16T10:30:10.000Z"
    },
    {
      "latitude": -21.1778,
      "longitude": -47.8106,
      "timestamp": "2025-01-16T10:30:15.000Z"
    }
  ],
  "capturedAt": "2025-01-16T10:30:00.000Z",
  "distance": 5000,
  "duration": 1800,
  "averagePace": 6.0,
  "maxSpeed": 12.5,
  "elevationGain": 50,
  "calories": 250
}
```

---

## 🚨 Erros Comuns e Soluções

### Erro: `"Formato inválido: forneça 'boundary' (LineString) ou 'path' (corrida simples)"`

**Causa**: O campo `boundary` está vazio, nulo ou não foi enviado.

**Solução**: Garanta que `boundary` seja um array com pelo menos 2 pontos.

### Erro: `"userColor deve estar no formato hexadecimal válido"`

**Causa**: `userColor` não está no formato `#RRGGBB`.

**Solução**: Use sempre o formato `#FF0000` (com `#` e 6 dígitos hexadecimais).

### Erro: `"Boundary deve ser uma LineString com pelo menos 2 pontos"`

**Causa**: O array `boundary` tem menos de 2 pontos.

**Solução**: Envie pelo menos 2 pontos no array `boundary`.

### Erro: `"Latitude inválida"` ou `"Longitude inválida"`

**Causa**: Coordenadas fora dos limites válidos.

**Solução**: 
- Latitude: entre -90 e 90
- Longitude: entre -180 e 180

### Erro: `401 Unauthorized`

**Causa**: Token JWT inválido, expirado ou não enviado.

**Solução**: 
- Verifique se está enviando o header `Authorization: Bearer {token}`
- Verifique se o token está válido e não expirou
- Faça login novamente para obter um novo token

---

## 📊 Resposta de Sucesso

```json
{
  "id": "uuid-do-territorio",
  "territoryId": "uuid-do-territorio",
  "runId": "uuid-da-corrida",
  "area": 125000.5,
  "userId": "uuid-do-usuario",
  "xp": {
    "level": 5,
    "xp": 150,
    "xpForNextLevel": 500,
    "leveledUp": false,
    "previousLevel": 5
  }
}
```

---

## 🔍 Testando com cURL

```bash
curl -X POST http://localhost:3000/api/territories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer seu-token-jwt" \
  -d '{
    "userName": "João Silva",
    "userColor": "#FF0000",
    "areaName": "Centro de Ribeirão Preto",
    "boundary": [
      {
        "latitude": -21.1775,
        "longitude": -47.8103,
        "timestamp": "2025-01-16T10:30:00.000Z"
      },
      {
        "latitude": -21.1776,
        "longitude": -47.8104,
        "timestamp": "2025-01-16T10:30:05.000Z"
      }
    ],
    "capturedAt": "2025-01-16T10:30:00.000Z"
  }'
```

---

## 📌 Notas Importantes

1. **Não precisa enviar fotos/imagens** - O sistema não salva mais imagens
2. **O backend aplica Map Matching** automaticamente (se configurado) para corrigir o GPS
3. **O território é criado como POLYGON** fechado usando `ST_Buffer` de 15 metros
4. **A área é calculada automaticamente** pelo backend em metros quadrados
5. **O usuário ganha 50 XP** automaticamente por criar um território

---

**Pronto!** Com essas informações você consegue enviar capturas de território do frontend para o backend. 🎉
