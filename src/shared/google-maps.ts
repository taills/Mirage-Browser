export interface Coordinates {
  latitude: number;
  longitude: number;
  name?: string;
}

/** Extract coordinates from common Google Maps URLs (place marker, viewport, or query). */
export function parseGoogleMapsUrl(input: string): Coordinates | null {
  let text = input.trim();
  if (!text) return null;
  try {
    const url = new URL(text);
    const host = url.hostname.toLowerCase();
    if (!(host === 'maps.google.com' || host.endsWith('.google.com') || host === 'google.com')) return null;
    text = `${decodeURIComponent(url.pathname)} ${decodeURIComponent(url.search)} ${decodeURIComponent(url.hash)}`;
  } catch {
    return null;
  }

  const placeMatch = text.match(/\/maps\/place\/([^/]+)\/@/i);
  const name = placeMatch ? placeMatch[1].replace(/\+/g, ' ').trim() : undefined;

  const patterns = [
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
    /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)(?:[,/]|$)/,
    /(?:[?&](?:q|query|ll|center)=)(-?\d+(?:\.\d+)?)(?:%2C|,)\s*(-?\d+(?:\.\d+)?)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const latitude = Number(match[1]);
    const longitude = Number(match[2]);
    if (Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180) {
      return { latitude, longitude, ...(name ? { name } : {}) };
    }
  }
  return null;
}
