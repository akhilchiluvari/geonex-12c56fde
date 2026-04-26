// Lightweight city catalog used for geo-lock simulation.
export interface City {
  name: string;
  country: string;
  lat: number;
  lng: number;
}

export const CITIES: City[] = [
  { name: "Hyderabad", country: "IN", lat: 17.385, lng: 78.4867 },
  { name: "Bangalore", country: "IN", lat: 12.9716, lng: 77.5946 },
  { name: "Mumbai", country: "IN", lat: 19.076, lng: 72.8777 },
  { name: "Delhi", country: "IN", lat: 28.6139, lng: 77.209 },
  { name: "Chennai", country: "IN", lat: 13.0827, lng: 80.2707 },
  { name: "Pune", country: "IN", lat: 18.5204, lng: 73.8567 },
  { name: "Kolkata", country: "IN", lat: 22.5726, lng: 88.3639 },
  { name: "Singapore", country: "SG", lat: 1.3521, lng: 103.8198 },
  { name: "Dubai", country: "AE", lat: 25.2048, lng: 55.2708 },
  { name: "London", country: "GB", lat: 51.5074, lng: -0.1278 },
  { name: "New York", country: "US", lat: 40.7128, lng: -74.006 },
  { name: "San Francisco", country: "US", lat: 37.7749, lng: -122.4194 },
  { name: "Tokyo", country: "JP", lat: 35.6762, lng: 139.6503 },
  { name: "Lagos", country: "NG", lat: 6.5244, lng: 3.3792 },
  { name: "Moscow", country: "RU", lat: 55.7558, lng: 37.6173 },
];

export function findCity(name: string): City | undefined {
  return CITIES.find((c) => c.name.toLowerCase() === name.toLowerCase());
}

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
