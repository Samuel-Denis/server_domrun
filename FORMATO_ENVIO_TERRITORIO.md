# 📤 Formato de Envio - Captura de Território

## ⚠️ PROBLEMA IDENTIFICADO

O backend está recebendo `body` vazio (`body keys: []`), o que significa que o **ValidationPipe global está removendo todos os campos** antes de chegar no controller.

## ✅ SOLUÇÃO IMPLEMENTADA

Ajustei o ValidationPipe global para aceitar campos extras (`forbidNonWhitelisted: false`) e adicionei conversão automática de GeoJSON.

## 📋 COMO ENVIAR (FORMATO CORRETO)

### Endpoint

```
POST http://192.168.0.102:3000/api/territories
Headers:
  Content-Type: application/json
  Authorization: Bearer {seu-token-jwt}
```

### ✅ Formato 1: GeoJSON (Funciona agora - Será convertido automaticamente)

```json
{
  "userName": "Flash",
  "userColor": "#00838F",
  "areaName": "Centro de Ribeirão Preto",
  "boundary": {
    "type": "LineString",
    "coordinates": [
      [-47.770842, -21.13064],
      [-47.770703, -21.130364],
      [-47.770703, -21.130364]
    ]
  },
  "capturedAt": "2026-01-16T00:52:43.411Z"
}
```

**Nota**: Se usar GeoJSON, os `timestamps` serão gerados automaticamente pelo backend.

### ✅ Formato 2: Array de Objetos (Recomendado)

```json
{
  "userName": "Flash",
  "userColor": "#00838F",
  "areaName": "Centro de Ribeirão Preto",
  "boundary": [
    {
      "latitude": -21.13064,
      "longitude": -47.770842,
      "timestamp": "2026-01-16T00:52:43.411Z"
    },
    {
      "latitude": -21.130364,
      "longitude": -47.770703,
      "timestamp": "2026-01-16T00:52:44.411Z"
    }
  ],
  "capturedAt": "2026-01-16T00:52:43.411Z"
}
```

## 🔍 Campos Obrigatórios

- ✅ `userName`: string
- ✅ `userColor`: string no formato `#RRGGBB` (ex: `#00838F`)
- ✅ `areaName`: string
- ✅ `boundary`: 
  - GeoJSON: `{type: "LineString", coordinates: [[lng, lat], ...]}`
  - OU Array: `[{latitude, longitude, timestamp}, ...]`
- ✅ `capturedAt`: string ISO 8601 (ex: `"2026-01-16T00:52:43.411Z"`)

## 🚫 Campos que NÃO devem ser enviados

- ❌ `userId` - O backend usa o userId do token JWT automaticamente
- ❌ `id` - O backend gera o UUID automaticamente

## 🐛 Debug

Se ainda estiver dando erro, os logs do servidor vão mostrar:

```
📥 [TerritoriesController] Body RAW recebido:
   - body keys: [...]
   - boundary existe?: true/false
   - boundary type: object/array
```

**Se `body keys` estiver vazio (`[]`), significa que o ValidationPipe global ainda está removendo campos.**

## 💡 Teste Rápido com cURL

```bash
curl -X POST http://192.168.0.102:3000/api/territories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer seu-token-aqui" \
  -d '{
    "userName": "Teste",
    "userColor": "#FF0000",
    "areaName": "Teste",
    "boundary": {
      "type": "LineString",
      "coordinates": [[-47.770842, -21.13064], [-47.770703, -21.130364]]
    },
    "capturedAt": "2026-01-16T00:52:43.411Z"
  }'
```

---

**Se o problema persistir**, me envie os logs do servidor que mostram o `Body RAW recebido`.
