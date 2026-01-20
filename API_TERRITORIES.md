# 📍 API de Áreas Conquistadas (Territories)

Esta documentação descreve como o frontend pode receber e usar os dados das áreas conquistadas (territories) do backend.

## 🎯 Endpoints

### POST `/runs` - Criar Território

Cria uma nova área conquistada a partir de uma corrida que fechou um circuito.

**Autenticação:** Requerida (JWT Bearer Token)

**Método:** `POST`

**URL:** `http://seu-servidor:3000/runs`

**Body (JSON):**
```json
{
  "userId": "uuid-do-usuario",
  "userName": "denis.tsx",
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
    {
      "latitude": -21.1870,
      "longitude": -47.7870,
      "timestamp": "2026-01-15T10:30:10.000Z"
    }
    // ... mais pontos na ordem que seguem as ruas
    // IMPORTANTE: LineString NÃO fechada (primeiro ponto ≠ último ponto)
  ],
  "capturedAt": "2026-01-15T10:35:00.000Z",
  "area": 0.0,  // Opcional - será calculado pelo backend após ST_Buffer
  "distance": 2500.0,
  "duration": 900,
  "averagePace": 6.0,
  "maxSpeed": 15.5,
  "elevationGain": 50,
  "calories": 180
}
```

**Campos obrigatórios:**
- `userId`: UUID do usuário (deve corresponder ao usuário autenticado)
- `userName`: Nome de usuário
- `userColor`: Cor hexadecimal do usuário (formato: #RRGGBB)
- `areaName`: Nome da área conquistada
- `boundary`: Array com os pontos do rastro da rua em formato **LineString** (mínimo 2 pontos, **NÃO fechado**)

**Campos opcionais:**
- `capturedAt`: Data/hora da conquista (ISO 8601). Se não fornecido, usa o timestamp atual
- `area`: Área em metros quadrados (será calculado automaticamente pelo backend após ST_Buffer)
- `distance`: Distância percorrida em metros
- `duration`: Duração em segundos
- `averagePace`: Ritmo médio em min/km
- `maxSpeed`: Velocidade máxima em km/h
- `elevationGain`: Ganho de elevação em metros
- `calories`: Calorias queimadas

**Resposta de Sucesso (201):**
```json
{
  "id": "uuid-do-territorio",
  "userId": "uuid-do-usuario",
  "userName": "denis.tsx",
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
  "capturedAt": "2026-01-15T10:35:00.000Z",
  "area": 1250.50,  // Área calculada em m²
  "runId": "uuid-da-corrida"
}
```

**⚠️ IMPORTANTE:**
- O `boundary` enviado é uma **LineString** (rastro da rua), **NÃO** um polígono fechado
- Os pontos **NÃO** devem ser fechados (primeiro ponto ≠ último ponto)
- A ordem dos pontos é **crítica** - eles seguem a rota pelas ruas
- O backend aplica **ST_Buffer de 10 metros** para criar a área que "pinta" o asfalto
- O `boundary` retornado é um **Polígono bufferizado** (fechado, com primeiro ponto = último ponto)
- A área é calculada automaticamente pelo PostGIS após o buffer
- Todos os pontos são preservados no banco de dados sem simplificação

**📚 Para mais detalhes, consulte:** `README_RECEBER_TERRITORIOS.md`

---

### GET `/runs/map`

Retorna todas as áreas conquistadas por todos os usuários no formato **GeoJSON FeatureCollection**.

**Autenticação:** Não requerida (endpoint público)

**Método:** `GET`

**URL:** `http://seu-servidor:3000/runs/map`

---

## 📦 Formato de Resposta

### Estrutura GeoJSON FeatureCollection

A resposta segue o padrão [GeoJSON](https://geojson.org/) FeatureCollection:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "uuid-do-territorio",
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [-47.8150, -21.1800],
            [-47.8120, -21.1800],
            [-47.8120, -21.1770],
            [-47.8150, -21.1770],
            [-47.8150, -21.1800]
            // ... TODOS os pontos do caminho corrido preservados
          ]
        ]
      },
      "properties": {
        "owner": "denis.tsx",
        "color": "#7B2CBF",
        "areaName": "Parque Central - Sul"
      }
    }
  ]
}
```

### Campos da Resposta

#### FeatureCollection
- `type` (string): Sempre `"FeatureCollection"`
- `features` (array): Array de objetos Feature

#### Feature (cada área conquistada)
- `type` (string): Sempre `"Feature"`
- `id` (string): UUID único do território
- `geometry` (object): Objeto GeoJSON Polygon
  - `type` (string): Sempre `"Polygon"`
  - `coordinates` (array): Array de arrays de coordenadas
    - Formato: `[[[lng, lat], [lng, lat], ...]]`
    - O primeiro array interno representa o anel exterior do polígono
    - **IMPORTANTE:** O primeiro e último ponto devem ser iguais (polígono fechado)
- `properties` (object): Propriedades do território
  - `owner` (string): Username do dono do território
  - `color` (string): Cor hexadecimal do usuário (ex: `"#7B2CBF"`)
  - `areaName` (string | null): Nome da área conquistada (pode ser null)

---

## 📊 Exemplo de Resposta Completa do GET `/runs/map`

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "e9f912cc-f926-4920-8ad8-f12714877f49",
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [-47.8150, -21.1800],
            [-47.8120, -21.1800],
            [-47.8120, -21.1770],
            [-47.8150, -21.1770],
            [-47.8150, -21.1800]
          ]
        ]
      },
      "properties": {
        "owner": "denis.tsx",
        "color": "#7B2CBF",
        "areaName": "Parque Central - Sul"
      }
    },
    {
      "type": "Feature",
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [-47.8050, -21.1850],
            [-47.8020, -21.1850],
            [-47.8020, -21.1820],
            [-47.8050, -21.1820],
            [-47.8050, -21.1850]
          ]
        ]
      },
      "properties": {
        "owner": "maria_corredora",
        "color": "#FF1493",
        "areaName": "Zona Sul - Bosque Fábio Barreto"
      }
    }
  ]
}
```

---

## 📤 Enviar Território Conquistado (Flutter/React Native)

### Exemplo com Fetch/HTTP

```javascript
const createTerritory = async (boundary, areaName, area, stats) => {
  const token = await getAuthToken(); // Obter token JWT
  
  const response = await fetch('http://192.168.0.101:3000/runs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      userId: currentUser.id,
      userName: currentUser.username,
      userColor: currentUser.color,
      areaName: areaName,
      boundary: boundary, // Array com TODOS os pontos
      area: area, // Área em m²
      capturedAt: new Date().toISOString(),
      distance: stats.distance,
      duration: stats.duration,
      averagePace: stats.averagePace,
      maxSpeed: stats.maxSpeed,
      elevationGain: stats.elevationGain,
      calories: stats.calories,
    }),
  });

  const result = await response.json();
  if (result.conquered) {
    console.log('Território conquistado!', result.territoryId);
  }
};
```

---

## 🗺️ Como Usar no Frontend

### 1. React Native / Expo (usando react-native-maps)

```javascript
import React, { useEffect, useState } from 'react';
import MapView, { Polygon } from 'react-native-maps';

const MapScreen = () => {
  const [territories, setTerritories] = useState(null);

  useEffect(() => {
    fetchTerritories();
  }, []);

  const fetchTerritories = async () => {
    try {
      const response = await fetch('http://192.168.0.101:3000/runs/map');
      const data = await response.json();
      setTerritories(data);
    } catch (error) {
      console.error('Erro ao buscar territories:', error);
    }
  };

  return (
    <MapView
      style={{ flex: 1 }}
      initialRegion={{
        latitude: -21.1775,  // Centro de Ribeirão Preto
        longitude: -47.8103,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }}
    >
      {territories?.features.map((feature) => (
        <Polygon
          key={feature.id}
          coordinates={feature.geometry.coordinates[0].map(([lng, lat]) => ({
            latitude: lat,
            longitude: lng,
          }))}
          strokeColor={feature.properties.color}
          fillColor={`${feature.properties.color}80`} // 50% de opacidade
          strokeWidth={2}
        />
      ))}
    </MapView>
  );
};
```

### 2. React Web (usando Leaflet)

```javascript
import { useEffect } from 'react';
import { MapContainer, TileLayer, Polygon } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const MapComponent = () => {
  const [territories, setTerritories] = useState(null);

  useEffect(() => {
    fetch('http://192.168.0.101:3000/runs/map')
      .then(res => res.json())
      .then(data => setTerritories(data))
      .catch(console.error);
  }, []);

  return (
    <MapContainer
      center={[-21.1775, -47.8103]}
      zoom={13}
      style={{ height: '100vh', width: '100%' }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      {territories?.features.map((feature) => (
        <Polygon
          key={feature.id}
          positions={feature.geometry.coordinates[0].map(([lng, lat]) => [lat, lng])}
          pathOptions={{
            color: feature.properties.color,
            fillColor: feature.properties.color,
            fillOpacity: 0.4,
            weight: 2,
          }}
        >
          <Popup>
            Dono: {feature.properties.owner}
          </Popup>
        </Polygon>
      ))}
    </MapContainer>
  );
};
```

### 3. React Web (usando Mapbox GL)

```javascript
import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const MapComponent = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);

  useEffect(() => {
    if (map.current) return; // Inicializar apenas uma vez

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [-47.8103, -21.1775],
      zoom: 13,
    });

    // Carregar territories quando o mapa estiver pronto
    map.current.on('load', async () => {
      const response = await fetch('http://192.168.0.101:3000/runs/map');
      const data = await response.json();

      // Adicionar source
      map.current.addSource('territories', {
        type: 'geojson',
        data: data,
      });

      // Adicionar layer
      map.current.addLayer({
        id: 'territories-fill',
        type: 'fill',
        source: 'territories',
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': 0.4,
        },
      });

      map.current.addLayer({
        id: 'territories-stroke',
        type: 'line',
        source: 'territories',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 2,
        },
      });
    });
  }, []);

  return <div ref={mapContainer} style={{ width: '100%', height: '100vh' }} />;
};
```

---

## 📝 Observações Importantes

### ⚠️ Preservação de Pontos (CRÍTICO)

**IMPORTANTE:** O sistema preserva **TODOS** os pontos do caminho corrido sem simplificação:

- ✅ Todos os pontos enviados no array `boundary` são salvos no banco
- ✅ Todos os pontos são retornados no GeoJSON do endpoint `/runs/map`
- ✅ O número de pontos enviados = número de pontos retornados
- ✅ **NÃO** há uso de `ST_Simplify()` ou qualquer função que reduza pontos
- ✅ O formato do polígono no mapa será **exatamente** o formato do quarteirão corrido

**Validação:**
- O primeiro e último ponto devem ser iguais (polígono fechado)
- Se não estiver fechado, o sistema fecha automaticamente
- Mínimo de 3 pontos para formar um polígono válido

### 1. Formato de Coordenadas
- **GeoJSON usa [longitude, latitude]** (e não latitude, longitude)
- Ao converter para mapas que usam [lat, lng], é necessário inverter a ordem

### 2. Sistema de Coordenação
- Todas as coordenadas estão em **WGS84 (EPSG:4326)**
- Compatível com a maioria das bibliotecas de mapas

### 3. Polígonos Fechados
- O primeiro e último ponto do polígono são sempre iguais
- Isso garante que o polígono está fechado corretamente

### 4. Cores
- As cores vêm no formato hexadecimal (ex: `#7B2CBF`)
- Você pode adicionar transparência usando o formato RGBA ou adicionando `80` ao final para 50% de opacidade

### 5. Performance
- O endpoint retorna **todas** as áreas conquistadas
- Para mapas com muitos territórios, considere implementar paginação ou clustering no futuro

---

## 🔗 Outros Endpoints Relacionados

### GET `/users/profile/stats`
Retorna estatísticas do usuário, incluindo a área total conquistada em km²:

```json
{
  "totalDistance": 450.0,
  "territoryPercentage": 0.3030,  // Área total em km²
  "trophies": 12,
  "totalRuns": 45,
  "totalTerritories": 10,
  "averagePace": 5.5,
  "totalTime": 25200,
  "longestRun": 12.5,
  "currentStreak": 7
}
```

### GET `/users/profile/complete`
Retorna o perfil completo do usuário, mas **não inclui os territories** diretamente. Para visualizar no mapa, use o endpoint `/runs/map`.

---

## 🧪 Testando a API

### Usando cURL

```bash
curl -X GET http://192.168.0.101:3000/runs/map
```

### Usando JavaScript/TypeScript

```javascript
const response = await fetch('http://192.168.0.101:3000/runs/map');
const territories = await response.json();
console.log('Total de territories:', territories.features.length);
```

---

## 🐛 Tratamento de Erros

### Erro 500 (Internal Server Error)
- Verifique se o banco de dados está conectado
- Verifique se a extensão PostGIS está instalada no PostgreSQL

### Resposta vazia
- Se `features` estiver vazio, significa que não há territories no banco
- Execute o seed: `npm run seed:ribeirao` para criar territories de teste

---

## 📚 Recursos Úteis

- [GeoJSON Specification](https://geojson.org/)
- [PostGIS Documentation](https://postgis.net/documentation/)
- [React Native Maps](https://github.com/react-native-maps/react-native-maps)
- [Leaflet](https://leafletjs.com/)
- [Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/)

---

## 💡 Dicas para Implementação

1. **Cache**: Considere cachear os dados dos territories localmente, pois eles não mudam com frequência
2. **Atualização**: Implemente polling ou WebSockets se precisar de atualizações em tempo real
3. **Filtros**: Para mostrar apenas territories de um usuário específico, filtre pelo `properties.owner` no frontend
4. **Zoom**: Ajuste o zoom inicial do mapa baseado na área coberta pelos territories
5. **Legenda**: Adicione uma legenda mostrando as cores de cada usuário

---

**Última atualização:** Janeiro 2025
