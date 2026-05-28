// Haversine distance (km) between two [lng, lat] points
export function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ETA in minutes, average 60 km/h with urban factor 0.75
export function etaMinutes(km: number, avgKmh = 60): number {
  if (km <= 0) return 0;
  return Math.max(1, Math.round((km / avgKmh) * 60 * 1.15));
}
