import { calculateDistance } from '../haversine';
import { TOGO_BOUNDS, TOGO_REGIONS } from '../togo-regions';

describe('calculateDistance', () => {
  it('returns 0 for identical coordinates', () => {
    expect(calculateDistance(6.1375, 1.2123, 6.1375, 1.2123)).toBe(0);
  });

  it('returns distance rounded to 1 decimal place', () => {
    const distance = calculateDistance(6.1375, 1.2123, 9.5511, 1.1861);
    expect(distance).toBe(Math.round(distance * 10) / 10);
    expect(distance).toBeGreaterThan(0);
  });

  it('calculates a plausible distance between Lomé and Kara', () => {
    const lome = TOGO_REGIONS.find((r) => r.id === 'maritime')!.center;
    const kara = TOGO_REGIONS.find((r) => r.id === 'kara')!.center;
    const distance = calculateDistance(lome.lat, lome.lng, kara.lat, kara.lng);
    expect(distance).toBeGreaterThan(300);
    expect(distance).toBeLessThan(500);
  });
});

describe('togo-regions', () => {
  it('exports 5 official regions', () => {
    expect(TOGO_REGIONS).toHaveLength(5);
    expect(TOGO_REGIONS.map((r) => r.id)).toEqual([
      'maritime',
      'plateaux',
      'centrale',
      'kara',
      'savanes',
    ]);
  });

  it('exports global Togo bounding box', () => {
    expect(TOGO_BOUNDS).toEqual({
      minLat: 6.0,
      maxLat: 11.15,
      minLng: -0.15,
      maxLng: 1.9,
    });
  });
});
