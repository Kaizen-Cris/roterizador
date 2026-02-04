
import { LatLng, PolygonPoint } from '../types';

/**
 * Algoritmo de Ray-casting para determinar se um ponto está dentro de um polígono.
 * Suporta pontos no formato [lat, lng] ou {lat, lng}.
 */
export function isPointInPolygon(point: LatLng, polygon: PolygonPoint[]): boolean {
  const [lat, lng] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i];
    const pj = polygon[j];

    // Normaliza o acesso às coordenadas (suporta array ou objeto)
    const xi = Array.isArray(pi) ? pi[0] : pi.lat;
    const yi = Array.isArray(pi) ? pi[1] : pi.lng;
    const xj = Array.isArray(pj) ? pj[0] : pj.lat;
    const yj = Array.isArray(pj) ? pj[1] : pj.lng;

    const intersect = ((yi > lng) !== (yj > lng)) &&
      (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
    
    if (intersect) inside = !inside;
  }

  return inside;
}
