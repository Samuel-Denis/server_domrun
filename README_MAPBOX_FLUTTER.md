# 🗺️ Guia: Desenhar Territórios no Mapbox com Flutter

Este guia explica como receber dados de territórios do backend e desenhá-los no Mapbox Flutter, garantindo que sejam renderizados sobre as vias de tráfego mas não sobre edifícios.

## 📋 Índice

1. [Requisitos](#requisitos)
2. [Configuração do Mapbox](#configuração-do-mapbox)
3. [Estrutura de Dados](#estrutura-de-dados)
4. [Recebendo Dados da API](#recebendo-dados-da-api)
5. [Desenhando Territórios no Mapa](#desenhando-territórios-no-mapa)
6. [Layer Hierarchy (Ordem de Renderização)](#layer-hierarchy-ordem-de-renderização)
7. [Exemplo Completo](#exemplo-completo)
8. [Otimizações](#otimizações)

---

## 🔧 Requisitos

### Dependências do Flutter

Adicione ao seu `pubspec.yaml`:

```yaml
dependencies:
  flutter:
    sdk: flutter
  
  # Mapbox Flutter SDK
  mapbox_maps_flutter: ^1.0.0
  
  # HTTP para chamadas à API
  http: ^1.1.0
  
  # JSON serialization
  json_annotation: ^4.8.1
  
dev_dependencies:
  json_serializable: ^6.7.1
  build_runner: ^2.4.6
```

### Instalação

```bash
flutter pub get
```

### Token do Mapbox

1. Crie uma conta em [mapbox.com](https://www.mapbox.com)
2. Obtenha seu **Access Token** público
3. Adicione no código (veja [Configuração](#configuração-do-mapbox))

---

## 🗺️ Configuração do Mapbox

### 1. Inicializar o Mapbox

```dart
import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart';

class MapScreen extends StatefulWidget {
  @override
  _MapScreenState createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  MapboxMap? mapboxMap;
  
  @override
  void initState() {
    super.initState();
    // IMPORTANTE: Substitua 'YOUR_MAPBOX_ACCESS_TOKEN' pelo seu token
    MapboxOptions.setAccessToken('YOUR_MAPBOX_ACCESS_TOKEN');
  }
  
  void onMapCreated(MapboxMap mapboxMap) {
    this.mapboxMap = mapboxMap;
    
    // Carregar territórios após o mapa estar pronto
    loadTerritories();
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: MapWidget(
        onMapCreated: onMapCreated,
        cameraOptions: CameraOptions(
          center: Point(
            coordinates: Position(-47.8103, -21.1775), // Ribeirão Preto
          ),
          zoom: 13.0,
        ),
      ),
    );
  }
}
```

---

## 📊 Estrutura de Dados

### Modelo de Território

```dart
// lib/models/territory.dart

import 'package:json_annotation/json_annotation.dart';

part 'territory.g.dart';

@JsonSerializable()
class Territory {
  final String id;
  final String userId;
  final String userName;
  final String userColor;
  final String areaName;
  final List<BoundaryPoint> boundary;
  final DateTime capturedAt;
  final double area;
  final String? runId;

  Territory({
    required this.id,
    required this.userId,
    required this.userName,
    required this.userColor,
    required this.areaName,
    required this.boundary,
    required this.capturedAt,
    required this.area,
    this.runId,
  });

  factory Territory.fromJson(Map<String, dynamic> json) =>
      _$TerritoryFromJson(json);
  
  Map<String, dynamic> toJson() => _$TerritoryToJson(this);
}

@JsonSerializable()
class BoundaryPoint {
  final double latitude;
  final double longitude;
  final DateTime? timestamp;

  BoundaryPoint({
    required this.latitude,
    required this.longitude,
    this.timestamp,
  });

  factory BoundaryPoint.fromJson(Map<String, dynamic> json) =>
      _$BoundaryPointFromJson(json);
  
  Map<String, dynamic> toJson() => _$BoundaryPointToJson(this);
}
```

Execute para gerar o código:

```bash
flutter pub run build_runner build
```

### Resposta da API GET /runs/map

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
            [-47.7874, -21.1914],
            [-47.7895, -21.1882],
            // ... mais pontos
            [-47.7874, -21.1914]  // Primeiro e último iguais (fechado)
          ]
        ]
      },
      "properties": {
        "owner": "denis.tsx",
        "color": "#7B2CBF",
        "areaName": "Jardim Paulista - Circuito Completo"
      }
    }
  ]
}
```

---

## 📡 Recebendo Dados da API

### Service para Buscar Territórios

```dart
// lib/services/territory_service.dart

import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/territory.dart';

class TerritoryService {
  final String baseUrl;
  
  TerritoryService({this.baseUrl = 'http://192.168.0.101:3000'});
  
  /// Busca todos os territórios do mapa
  Future<Map<String, dynamic>> getMapTerritories() async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/runs/map'),
        headers: {
          'Content-Type': 'application/json',
        },
      );
      
      if (response.statusCode == 200) {
        return json.decode(response.body) as Map<String, dynamic>;
      } else {
        throw Exception('Erro ao buscar territórios: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Erro ao conectar com o servidor: $e');
    }
  }
  
  /// Converte GeoJSON FeatureCollection para lista de territórios
  List<Map<String, dynamic>> parseTerritories(Map<String, dynamic> geoJson) {
    if (geoJson['type'] != 'FeatureCollection') {
      throw Exception('Formato GeoJSON inválido');
    }
    
    final features = geoJson['features'] as List;
    return features.map((feature) => {
      'id': feature['id'] as String,
      'geometry': feature['geometry'] as Map<String, dynamic>,
      'properties': feature['properties'] as Map<String, dynamic>,
    }).toList();
  }
}
```

---

## 🎨 Desenhando Territórios no Mapa

### Classe Principal para Gerenciar Territórios

```dart
// lib/widgets/territory_layer.dart

import 'dart:convert';
import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart';
import '../services/territory_service.dart';

class TerritoryLayerManager {
  final MapboxMap mapboxMap;
  final TerritoryService territoryService;
  
  // IDs das layers criadas para poder removê-las depois
  final List<String> layerIds = [];
  final List<String> sourceIds = [];
  
  TerritoryLayerManager({
    required this.mapboxMap,
    required this.territoryService,
  });
  
  /// Carrega e desenha todos os territórios no mapa
  Future<void> loadAndDrawTerritories() async {
    try {
      // 1. Buscar dados da API
      final geoJsonData = await territoryService.getMapTerritories();
      final territories = territoryService.parseTerritories(geoJsonData);
      
      // 2. Criar source GeoJSON
      final sourceId = 'territories-source';
      sourceIds.add(sourceId);
      
      // Converter para GeoJSON format
      final geoJsonSource = GeoJSONSource(
        data: json.encode(geoJsonData),
      );
      
      // 3. Adicionar source ao mapa
      await mapboxMap.style.addSource(
        sourceId,
        geoJsonSource,
      );
      
      // 4. Criar layer de preenchimento (fill) - PRECISA ESTAR ACIMA DAS RUAS MAS ABAIXO DOS EDIFÍCIOS
      await _addTerritoryFillLayer(sourceId);
      
      // 5. Criar layer de contorno (line) para bordas visíveis
      await _addTerritoryLineLayer(sourceId);
      
      print('✅ Territórios carregados: ${territories.length}');
    } catch (e) {
      print('❌ Erro ao carregar territórios: $e');
    }
  }
  
  /// Adiciona layer de preenchimento com transparência
  Future<void> _addTerritoryFillLayer(String sourceId) async {
    final layerId = 'territories-fill';
    layerIds.add(layerId);
    
    final fillLayer = FillLayer(
      id: layerId,
      sourceId: sourceId,
    );
    
    // Configurar propriedades de estilo
    fillLayer.fillColor = [
      Expression.get('userColor'), // Usa a cor do usuário do GeoJSON
    ];
    
    fillLayer.fillOpacity = 0.5; // 50% de transparência para ver as ruas
    
    // IMPORTANTE: Adicionar layer em uma posição específica na hierarquia
    // Vamos adicionar após 'road-label' mas antes de 'building'
    await mapboxMap.style.addLayer(
      fillLayer,
      layerPosition: LayerPosition(
        above: 'road-label', // Acima dos labels de rua
        below: 'building',   // Abaixo dos edifícios
      ),
    );
  }
  
  /// Adiciona layer de contorno
  Future<void> _addTerritoryLineLayer(String sourceId) async {
    final layerId = 'territories-line';
    layerIds.add(layerId);
    
    final lineLayer = LineLayer(
      id: layerId,
      sourceId: sourceId,
    );
    
    // Cor da linha (um pouco mais escura que o preenchimento)
    lineLayer.lineColor = [
      Expression.get('userColor'),
    ];
    
    lineLayer.lineWidth = 2.0;
    lineLayer.lineOpacity = 0.8;
    
    // Adicionar logo acima da layer de preenchimento
    await mapboxMap.style.addLayer(
      lineLayer,
      layerPosition: LayerPosition(
        above: 'territories-fill',
      ),
    );
  }
  
  /// Remove todas as layers e sources (útil para limpar ao sair)
  Future<void> clearTerritories() async {
    for (final layerId in layerIds) {
      try {
        await mapboxMap.style.removeLayer(layerId);
      } catch (e) {
        print('Aviso: Não foi possível remover layer $layerId: $e');
      }
    }
    
    for (final sourceId in sourceIds) {
      try {
        await mapboxMap.style.removeSource(sourceId);
      } catch (e) {
        print('Aviso: Não foi possível remover source $sourceId: $e');
      }
    }
    
    layerIds.clear();
    sourceIds.clear();
  }
}
```

---

## 🎯 Layer Hierarchy (Ordem de Renderização)

Para garantir que os territórios apareçam **sobre as vias mas abaixo dos edifícios**, você precisa adicionar as layers na ordem correta:

### Hierarquia Correta do Mapbox

```
1. water (água)
2. landuse (uso do solo)
3. hillshade (sombra do relevo)
4. contour (curvas de nível)
5. road (ruas) ⬅️ AQUI devem aparecer as vias
6. road-label (rótulos de rua)
7. 🟣 TERRITORIES-FILL ⬅️ ADICIONAR AQUI
8. 🟣 TERRITORIES-LINE ⬅️ ADICIONAR AQUI
9. building (edifícios) ⬅️ ACIMA dos territórios
10. building-label (rótulos de edifícios)
```

### Como Descobrir as Layers Existentes

```dart
Future<void> listAllLayers() async {
  final style = mapboxMap.style;
  
  // Listar todas as layers do estilo atual
  final layers = await style.getAllLayerIds();
  
  for (final layerId in layers) {
    print('Layer: $layerId');
  }
}
```

### Adicionar em Posição Específica (Método Alternativo)

Se você souber os IDs exatos das layers:

```dart
await mapboxMap.style.addLayer(
  fillLayer,
  layerPosition: LayerPosition(
    above: 'road-label', // Nome exato da layer de labels de rua
  ),
);

// OU

await mapboxMap.style.addLayer(
  fillLayer,
  layerPosition: LayerPosition(
    below: 'building', // Nome exato da layer de edifícios
  ),
);
```

---

## 📱 Exemplo Completo

### Tela Principal do Mapa

```dart
// lib/screens/map_screen.dart

import 'package:flutter/material.dart';
import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart';
import '../widgets/territory_layer.dart';
import '../services/territory_service.dart';

class MapScreen extends StatefulWidget {
  @override
  _MapScreenState createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  MapboxMap? mapboxMap;
  TerritoryLayerManager? territoryManager;
  bool territoriesLoaded = false;
  
  @override
  void initState() {
    super.initState();
    // Configure seu token do Mapbox
    MapboxOptions.setAccessToken('YOUR_MAPBOX_ACCESS_TOKEN');
  }
  
  void onMapCreated(MapboxMap mapboxMap) async {
    this.mapboxMap = mapboxMap;
    
    // Aguardar o estilo carregar completamente
    await mapboxMap.style.mapboxStyleLoaded;
    
    // Inicializar gerenciador de territórios
    territoryManager = TerritoryLayerManager(
      mapboxMap: mapboxMap,
      territoryService: TerritoryService(),
    );
    
    // Carregar territórios
    await territoryManager!.loadAndDrawTerritories();
    
    setState(() {
      territoriesLoaded = true;
    });
  }
  
  Future<void> refreshTerritories() async {
    if (territoryManager != null) {
      // Limpar territórios antigos
      await territoryManager!.clearTerritories();
      
      // Recarregar
      await territoryManager!.loadAndDrawTerritories();
      
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Territórios atualizados!')),
      );
    }
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Territórios Conquistados'),
        actions: [
          IconButton(
            icon: Icon(Icons.refresh),
            onPressed: refreshTerritories,
            tooltip: 'Atualizar territórios',
          ),
        ],
      ),
      body: Stack(
        children: [
          // Mapa
          MapWidget(
            onMapCreated: onMapCreated,
            cameraOptions: CameraOptions(
              center: Point(
                coordinates: Position(-47.8103, -21.1775), // Ribeirão Preto
              ),
              zoom: 13.0,
            ),
          ),
          
          // Indicador de carregamento
          if (!territoriesLoaded)
            Center(
              child: CircularProgressIndicator(),
            ),
        ],
      ),
    );
  }
  
  @override
  void dispose() {
    territoryManager?.clearTerritories();
    super.dispose();
  }
}
```

---

## ⚡ Otimizações

### 1. Cache de Territórios

```dart
class TerritoryCache {
  static Map<String, dynamic>? cachedGeoJson;
  static DateTime? lastUpdate;
  static const Duration cacheDuration = Duration(minutes: 5);
  
  static bool isValid() {
    if (cachedGeoJson == null || lastUpdate == null) return false;
    return DateTime.now().difference(lastUpdate!) < cacheDuration;
  }
  
  static void setCache(Map<String, dynamic> geoJson) {
    cachedGeoJson = geoJson;
    lastUpdate = DateTime.now();
  }
}
```

### 2. Simplificação de Geometria (Opcional)

Se o mapa estiver lento com muitos pontos:

```dart
import 'package:turf/turf.dart' as turf;

/// Simplifica polígono mantendo precisão visual
List<List<double>> simplifyPolygon(List<List<double>> coordinates, double tolerance) {
  final polygon = turf.Polygon(coordinates: [coordinates]);
  final simplified = turf.simplify(polygon, tolerance: tolerance);
  return simplified.coordinates[0] as List<List<double>>;
}
```

### 3. Clustering para Muitos Territórios

Se houver centenas de territórios, considere clustering:

```dart
final clusterOptions = ClusterOptions(
  radius: 50,
  maxZoom: 14,
);
```

---

## 🐛 Troubleshooting

### Problema: Territórios não aparecem

**Soluções:**
1. Verifique se o token do Mapbox está correto
2. Verifique se a API está retornando dados: `GET /runs/map`
3. Verifique o console para erros de parsing
4. Aguarde o estilo do mapa carregar antes de adicionar layers

### Problema: Territórios aparecem sobre edifícios

**Solução:**
Ajuste a `LayerPosition` para colocar abaixo de `building`:

```dart
layerPosition: LayerPosition(
  above: 'road-label',
  below: 'building', // Adicione este parâmetro
),
```

### Problema: Territórios não aparecem sobre as ruas

**Solução:**
Coloque acima de `road` ou `road-label`:

```dart
layerPosition: LayerPosition(
  above: 'road-label', // Garante que está acima das ruas
),
```

### Problema: Performance ruim com muitos territórios

**Soluções:**
1. Use simplificação de geometria
2. Implemente clustering
3. Use `setPaintProperty` para animações mais leves
4. Limite a quantidade de territórios exibidos por zoom level

---

## 📚 Recursos Adicionais

- [Mapbox Flutter SDK Documentation](https://docs.mapbox.com/flutter/maps/guides/)
- [Mapbox Style Specification](https://docs.mapbox.com/mapbox-gl-js/style-spec/)
- [GeoJSON Specification](https://geojson.org/)
- [Flutter HTTP Package](https://pub.dev/packages/http)

---

## ✅ Checklist de Implementação

- [ ] Configurar token do Mapbox
- [ ] Instalar dependências (`mapbox_maps_flutter`, `http`)
- [ ] Criar modelos de dados (`Territory`, `BoundaryPoint`)
- [ ] Implementar `TerritoryService`
- [ ] Implementar `TerritoryLayerManager`
- [ ] Adicionar layers na ordem correta (acima de `road-label`, abaixo de `building`)
- [ ] Testar com dados reais da API
- [ ] Implementar refresh/atualização
- [ ] Testar performance com muitos territórios
- [ ] Implementar cache (opcional)

---

**Última atualização**: Janeiro 2025  
**Versão**: 1.0  
**Flutter**: Compatível com Flutter 3.0+  
**Mapbox SDK**: 1.0.0+
