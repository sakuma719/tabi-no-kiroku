/** Exact host/path allowlist: reject user info, non-HTTPS and look-alike domains. */
export function isGoogleMapsUrl(input: string): boolean {
  try {
    const url = new URL(input);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
    if (['maps.google.com', 'maps.google.co.jp'].includes(url.hostname)) return true;
    if (
      ['google.com', 'www.google.com', 'google.co.jp', 'www.google.co.jp'].includes(url.hostname)
    ) {
      return /^\/maps(?:\/|$)/.test(url.pathname);
    }
    if (url.hostname === 'maps.app.goo.gl') return url.pathname.length > 1;
    return url.hostname === 'goo.gl' && /^\/maps\/.+/.test(url.pathname);
  } catch {
    return false;
  }
}

export function googleMapsUrl(stored: string | undefined, title: string, area: string): string {
  if (stored && isGoogleMapsUrl(stored)) return stored;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${title} ${area}`.trim())}`;
}

// Approximate area centers only. No address/URL geocoding or third-party search requests.
const areaCenters: Record<string, [number, number]> = {
  別府: [33.2846, 131.4912],
  大分: [33.2396, 131.6093],
  由布院: [33.2653, 131.3555],
  湯布院: [33.2653, 131.3555],
  東京: [35.6812, 139.7671],
  京都: [35.0116, 135.7681],
  大阪: [34.6937, 135.5023],
  神戸: [34.6901, 135.1956],
  奈良: [34.6851, 135.8048],
  札幌: [43.0618, 141.3545],
  北海道: [43.0618, 141.3545],
  函館: [41.7687, 140.7288],
  仙台: [38.2682, 140.8694],
  青森: [40.8222, 140.7474],
  金沢: [36.5613, 136.6562],
  長野: [36.6486, 138.1948],
  松本: [36.2381, 137.972],
  名古屋: [35.1815, 136.9066],
  横浜: [35.4437, 139.638],
  鎌倉: [35.3192, 139.5467],
  箱根: [35.2324, 139.1069],
  熱海: [35.095, 139.0717],
  伊豆: [34.9766, 138.9468],
  日光: [36.7199, 139.6982],
  広島: [34.3853, 132.4553],
  岡山: [34.6551, 133.9195],
  高松: [34.3428, 134.0466],
  松山: [33.8392, 132.7657],
  福岡: [33.5904, 130.4017],
  長崎: [32.7503, 129.8779],
  熊本: [32.8031, 130.7079],
  鹿児島: [31.5966, 130.5571],
  宮崎: [31.9077, 131.4202],
  沖縄: [26.2124, 127.6809],
  那覇: [26.2124, 127.6809],
  石垣: [24.3407, 124.1556],
};
export function findAreaCenter(area: string): [number, number] | undefined {
  return Object.entries(areaCenters).find(([name]) => area.includes(name))?.[1];
}
