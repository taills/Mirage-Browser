import { describe, expect, it } from 'vitest';
import { parseGoogleMapsUrl } from './google-maps';

describe('parseGoogleMapsUrl', () => {
  it('extracts the place coordinates from a Google Maps place URL', () => {
    const url = 'https://www.google.com/maps/place/%E8%8B%B1%E5%9B%BD%E4%BC%A6%E6%95%A6/@51.47,-0.45,135m/data=!3d51.5072178!4d-0.1275862';
    expect(parseGoogleMapsUrl(url)).toEqual({ latitude: 51.5072178, longitude: -0.1275862, name: '英国伦敦' });
  });

  it('supports viewport and query coordinates', () => {
    expect(parseGoogleMapsUrl('https://www.google.com/maps/@35.6,139.7,12z')).toEqual({ latitude: 35.6, longitude: 139.7 });
    expect(parseGoogleMapsUrl('https://www.google.com/maps?q=35.6,139.7')).toEqual({ latitude: 35.6, longitude: 139.7 });
  });

  it('rejects unrelated URLs and out-of-range coordinates', () => {
    expect(parseGoogleMapsUrl('https://example.com/@35.6,139.7')).toBeNull();
    expect(parseGoogleMapsUrl('https://www.google.com/maps/@95,139.7,12z')).toBeNull();
  });
});
