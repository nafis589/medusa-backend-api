export interface TogoRegion {
  id: string;
  name: string;
  capital: string;
  center: { lat: number; lng: number };
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  cities: string[];
}

export const TOGO_REGIONS: TogoRegion[] = [
  {
    id: 'maritime',
    name: 'Maritime',
    capital: 'Lomé',
    center: { lat: 6.1375, lng: 1.2123 },
    bounds: { minLat: 6.0, maxLat: 6.8, minLng: 0.7, maxLng: 1.8 },
    cities: ['Lomé', 'Aného', 'Tsévié', 'Tabligbo', 'Vogan'],
  },
  {
    id: 'plateaux',
    name: 'Plateaux',
    capital: 'Atakpamé',
    center: { lat: 7.5333, lng: 1.1333 },
    bounds: { minLat: 6.8, maxLat: 8.0, minLng: 0.5, maxLng: 1.8 },
    cities: ['Atakpamé', 'Kpalimé', 'Badou', 'Notsé', 'Amlamé'],
  },
  {
    id: 'centrale',
    name: 'Centrale',
    capital: 'Sokodé',
    center: { lat: 8.9833, lng: 1.1333 },
    bounds: { minLat: 8.0, maxLat: 9.5, minLng: 0.6, maxLng: 1.9 },
    cities: ['Sokodé', 'Tchamba', 'Sotouboua', 'Blitta'],
  },
  {
    id: 'kara',
    name: 'Kara',
    capital: 'Kara',
    center: { lat: 9.5511, lng: 1.1861 },
    bounds: { minLat: 9.5, maxLat: 10.4, minLng: 0.5, maxLng: 1.9 },
    cities: ['Kara', 'Bassar', 'Niamtougou', 'Bafilo'],
  },
  {
    id: 'savanes',
    name: 'Savanes',
    capital: 'Dapaong',
    center: { lat: 10.8667, lng: 0.2 },
    bounds: { minLat: 10.4, maxLat: 11.15, minLng: -0.15, maxLng: 1.9 },
    cities: ['Dapaong', 'Cinkassé', 'Mandouri'],
  },
];

export const TOGO_BOUNDS = {
  minLat: 6.0,
  maxLat: 11.15,
  minLng: -0.15,
  maxLng: 1.9,
};
