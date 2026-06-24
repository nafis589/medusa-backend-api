import { generateSlug } from '../slug';

describe('slugify utility', () => {
  it('should convert accents and special characters to standard slugs', () => {
    expect(generateSlug('Bijoux & Montres')).toBe('bijoux-montres');
    expect(generateSlug('Femme & Vêtements')).toBe('femme-vetements');
  });

  it('should trim and collapse spaces', () => {
    expect(generateSlug('   Hello    World   ')).toBe('hello-world');
  });

  it('should handle alphanumeric and hyphens correctly', () => {
    expect(generateSlug('shoes-and-bags-2026')).toBe('shoes-and-bags-2026');
  });
});
