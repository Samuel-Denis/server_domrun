/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Helpers reutilizáveis de GIS (GeoJSON/WKT/validação/simplificação).
 *
 * Objetivo: centralizar conversões e validações para evitar lógica duplicada
 * em Controllers/Services/Repositories.
 */

export type BoundaryPoint = {
    latitude: number;
    longitude: number;
    /** ISO timestamp opcional (alguns fluxos geram/consomem isso no app) */
    timestamp?: string;
  };
  
  export type GeoJsonLineString = {
    type: 'LineString';
    coordinates: Array<[number, number]>; // [lng, lat]
  };
  
  export type GeoJsonPolygon = {
    type: 'Polygon';
    coordinates: Array<Array<[number, number]>>; // [ [ [lng,lat], ... ] ]
  };
  
export type GeoJsonGeometry = GeoJsonLineString | GeoJsonPolygon;

  function assertFiniteNumber(value: unknown, message: string): asserts value is number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(message);
    }
  }
  
  export function isValidLongitude(lng: number): boolean {
    return lng >= -180 && lng <= 180;
  }
  
  export function isValidLatitude(lat: number): boolean {
    return lat >= -90 && lat <= 90;
  }
  
  export function validateGeoJsonLineString(input: unknown): asserts input is GeoJsonLineString {
    if (!input || typeof input !== 'object') {
      throw new Error('GeoJSON inválido: esperado um objeto');
    }
  
    const obj = input as any;
    if (obj.type !== 'LineString') {
      throw new Error('GeoJSON inválido: esperado type="LineString"');
    }
    if (!Array.isArray(obj.coordinates) || obj.coordinates.length < 2) {
      throw new Error('GeoJSON inválido: coordinates deve ser um array com pelo menos 2 pontos');
    }
  
    for (const coord of obj.coordinates) {
      if (!Array.isArray(coord) || coord.length !== 2) {
        throw new Error('GeoJSON inválido: cada coordinate deve ser [lng, lat]');
      }
      const [lng, lat] = coord;
      assertFiniteNumber(lng, 'GeoJSON inválido: longitude deve ser número finito');
      assertFiniteNumber(lat, 'GeoJSON inválido: latitude deve ser número finito');
      if (!isValidLongitude(lng) || !isValidLatitude(lat)) {
        throw new Error('GeoJSON inválido: coordenadas fora do range permitido');
      }
    }
  }
  
  export function validateGeoJsonPolygon(input: unknown): asserts input is GeoJsonPolygon {
    if (!input || typeof input !== 'object') {
      throw new Error('GeoJSON inválido: esperado um objeto');
    }
  
    const obj = input as any;
    if (obj.type !== 'Polygon') {
      throw new Error('GeoJSON inválido: esperado type="Polygon"');
    }
    if (!Array.isArray(obj.coordinates) || obj.coordinates.length < 1) {
      throw new Error('GeoJSON inválido: coordinates deve ser um array com pelo menos 1 anel');
    }
  
    const ring = obj.coordinates[0];
    if (!Array.isArray(ring) || ring.length < 4) {
      throw new Error('GeoJSON inválido: anel externo deve ter pelo menos 4 pontos (fechado)');
    }
  
    for (const coord of ring) {
      if (!Array.isArray(coord) || coord.length !== 2) {
        throw new Error('GeoJSON inválido: cada coordinate deve ser [lng, lat]');
      }
      const [lng, lat] = coord;
      assertFiniteNumber(lng, 'GeoJSON inválido: longitude deve ser número finito');
      assertFiniteNumber(lat, 'GeoJSON inválido: latitude deve ser número finito');
      if (!isValidLongitude(lng) || !isValidLatitude(lat)) {
        throw new Error('GeoJSON inválido: coordenadas fora do range permitido');
      }
    }
  }
  
export function validateWktLineString(wkt: string): void {
  const match = wkt.trim().match(/^LINESTRING\s*\((.+)\)$/i);
  if (!match) {
    throw new Error('WKT inválido: esperado LINESTRING(...)');
  }
  const coords = parseWktCoordinatePairs(match[1]);
  if (coords.length < 2) {
    throw new Error('WKT inválido: LINESTRING deve ter pelo menos 2 pontos');
  }
}

export function validateWktPolygon(wkt: string): void {
  const match = wkt.trim().match(/^POLYGON\s*\(\(\s*(.+)\s*\)\)$/i);
  if (!match) {
    throw new Error('WKT inválido: esperado POLYGON((...))');
  }
  const coords = parseWktCoordinatePairs(match[1]);
  if (coords.length < 4) {
    throw new Error('WKT inválido: POLYGON deve ter pelo menos 4 pontos (fechado)');
  }
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    throw new Error('WKT inválido: POLYGON deve estar fechado (primeiro e último iguais)');
  }
}

  /**
   * Converte GeoJSON LineString -> BoundaryPoint[]
   * - Mantém compatibilidade com o formato atual do backend (latitude/longitude + timestamp opcional).
   * - Se `capturedAt` for passado, os timestamps são gerados a partir dele, com incremento de 1s.
   */
  export function geoJsonLineStringToBoundaryPoints(
    geoJson: unknown,
    opts?: { capturedAt?: string; generateTimestamps?: boolean },
  ): BoundaryPoint[] {
    validateGeoJsonLineString(geoJson);
  
    const baseTime = opts?.capturedAt ? new Date(opts.capturedAt) : new Date();
    const generateTimestamps = opts?.generateTimestamps ?? true;
  
    return geoJson.coordinates.map(([longitude, latitude], index) => {
      const point: BoundaryPoint = { latitude, longitude };
      if (generateTimestamps) {
        point.timestamp = new Date(baseTime.getTime() + index * 1000).toISOString();
      }
      return point;
    });
  }
  
/**
 * Converte GeoJSON LineString -> WKT LineString
 */
export function geoJsonLineStringToWKT(geoJson: unknown): string {
  validateGeoJsonLineString(geoJson);
  const parts = geoJson.coordinates.map(([longitude, latitude]) => `${longitude} ${latitude}`);
  return `LINESTRING(${parts.join(', ')})`;
}

  /**
   * Converte BoundaryPoint[] -> WKT LineString (EPSG:4326)
   * Ex: LINESTRING(lng lat, lng lat, ...)
   */
  export function boundaryPointsToLineStringWKT(points: BoundaryPoint[]): string {
    if (!Array.isArray(points) || points.length < 2) {
      throw new Error('Boundary inválido: esperado ao menos 2 pontos');
    }
  
    const parts = points.map((p) => {
      assertFiniteNumber(p.longitude, 'Boundary inválido: longitude deve ser número finito');
      assertFiniteNumber(p.latitude, 'Boundary inválido: latitude deve ser número finito');
      if (!isValidLongitude(p.longitude) || !isValidLatitude(p.latitude)) {
        throw new Error('Boundary inválido: coordenadas fora do range permitido');
      }
      return `${p.longitude} ${p.latitude}`;
    });
  
    return `LINESTRING(${parts.join(', ')})`;
  }
  
/**
 * Converte WKT LineString -> GeoJSON LineString
 */
export function wktLineStringToGeoJson(wkt: string): GeoJsonLineString {
  const match = wkt.trim().match(/^LINESTRING\s*\((.+)\)$/i);
  if (!match) {
    throw new Error('WKT inválido: esperado LINESTRING(...)');
  }
  const coordinates = parseWktCoordinatePairs(match[1]);
  if (coordinates.length < 2) {
    throw new Error('WKT inválido: LINESTRING deve ter pelo menos 2 pontos');
  }
  return { type: 'LineString', coordinates };
}

  /**
   * Converte GeoJSON Polygon -> lista de pontos do anel externo (BoundaryPoint[])
   * Útil quando o PostGIS retorna Polygon para renderização no frontend.
   */
  export function geoJsonPolygonToBoundaryPoints(geoJson: unknown): BoundaryPoint[] {
    validateGeoJsonPolygon(geoJson);
    const ring = geoJson.coordinates[0];
    return ring.map(([longitude, latitude]) => ({ latitude, longitude }));
  }
  
/**
 * Converte GeoJSON Polygon -> WKT Polygon (fecha o anel se necessário)
 */
export function geoJsonPolygonToWKT(geoJson: unknown): string {
  validateGeoJsonPolygon(geoJson);
  const ring = closePolygonRing(geoJson.coordinates[0]);
  const parts = ring.map(([longitude, latitude]) => `${longitude} ${latitude}`);
  return `POLYGON((${parts.join(', ')}))`;
}

/**
 * Converte WKT Polygon -> GeoJSON Polygon
 */
export function wktPolygonToGeoJson(wkt: string): GeoJsonPolygon {
  const match = wkt.trim().match(/^POLYGON\s*\(\(\s*(.+)\s*\)\)$/i);
  if (!match) {
    throw new Error('WKT inválido: esperado POLYGON((...))');
  }
  const ring = parseWktCoordinatePairs(match[1]);
  if (ring.length < 4) {
    throw new Error('WKT inválido: POLYGON deve ter pelo menos 4 pontos (fechado)');
  }
  const closedRing = closePolygonRing(ring);
  return { type: 'Polygon', coordinates: [closedRing] };
}

/**
 * Simplifica GeoJSON LineString por distância mínima entre pontos.
 */
export function simplifyGeoJsonLineStringByDistance(
  geoJson: unknown,
  minDistanceMeters = 5,
): GeoJsonLineString {
  validateGeoJsonLineString(geoJson);
  const asBoundary = geoJson.coordinates.map(([longitude, latitude]) => ({ latitude, longitude }));
  const simplified = simplifyBoundaryPointsByDistance(asBoundary, minDistanceMeters);
  return {
    type: 'LineString',
    coordinates: simplified.map((p) => [p.longitude, p.latitude]),
  };
}

  /**
   * Simplificação simples por distância mínima entre pontos (Haversine), sem dependências.
   * - Remove pontos muito próximos para reduzir payload e custo de processamento.
   * - Não substitui ST_Simplify no banco, mas ajuda em fluxos com muitos pontos.
   */
  export function simplifyBoundaryPointsByDistance(
    points: BoundaryPoint[],
    minDistanceMeters = 5,
  ): BoundaryPoint[] {
    if (!Array.isArray(points) || points.length <= 2) return points;
    if (minDistanceMeters <= 0) return points;
  
    const simplified: BoundaryPoint[] = [points[0]];
    let lastKept = points[0];
  
    for (let i = 1; i < points.length - 1; i++) {
      const p = points[i];
      const d = haversineMeters(lastKept.latitude, lastKept.longitude, p.latitude, p.longitude);
      if (d >= minDistanceMeters) {
        simplified.push(p);
        lastKept = p;
      }
    }
  
    // manter o último ponto
    simplified.push(points[points.length - 1]);
    return simplified;
  }
  
  function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // metros
    const toRad = (x: number) => (x * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

function parseWktCoordinatePairs(raw: string): Array<[number, number]> {
  const parts = raw
    .trim()
    .split(',')
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  const coordinates: Array<[number, number]> = [];
  for (const part of parts) {
    const [lngRaw, latRaw, extra] = part.split(/\s+/);
    if (!lngRaw || !latRaw || extra) {
      throw new Error('WKT inválido: coordenadas devem ser "lng lat"');
    }
    const lng = Number(lngRaw);
    const lat = Number(latRaw);
    assertFiniteNumber(lng, 'WKT inválido: longitude deve ser número finito');
    assertFiniteNumber(lat, 'WKT inválido: latitude deve ser número finito');
    if (!isValidLongitude(lng) || !isValidLatitude(lat)) {
      throw new Error('WKT inválido: coordenadas fora do range permitido');
    }
    coordinates.push([lng, lat]);
  }

  return coordinates;
}

function closePolygonRing(ring: Array<[number, number]>): Array<[number, number]> {
  if (ring.length === 0) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) {
    return ring;
  }
  return [...ring, [first[0], first[1]]];
}
  