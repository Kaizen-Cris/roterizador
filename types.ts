
export type LatLng = [number, number];

export type PolygonPoint = { lat: number; lng: number } | LatLng;

export enum DeliveryDay {
  MONDAY = 'Segunda-feira',
  TUESDAY = 'Terça-feira',
  WEDNESDAY = 'Quarta-feira',
  THURSDAY = 'Quinta-feira',
  FRIDAY = 'Sexta-feira',
  REMOTE = 'Região Distante',
  OUT_OF_BOUNDS = 'Fora da área de cobertura'
}

export interface DeliveryMatch {
  day: DeliveryDay | string;
  zoneId: string;
  driverName: string;
  color: string;
}

export interface DeliveryZone {
  id: string;
  name: DeliveryDay;
  color: string;
  polygon: PolygonPoint[];
}

export interface SearchResult {
  address: string;
  coordinates: LatLng;
  matches: DeliveryMatch[];
}
