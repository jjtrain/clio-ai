import { db } from "@/lib/db";

// Known courthouse coordinates for geocoding
const KNOWN_LOCATIONS: Record<string, { lat: number; lng: number }> = {
  "nassau county supreme court": { lat: 40.7488, lng: -73.6393 },
  "nassau county family court": { lat: 40.7577, lng: -73.5626 },
  "queens county supreme court": { lat: 40.7024, lng: -73.8079 },
  "queens county family court": { lat: 40.7050, lng: -73.8015 },
  "kings county supreme court": { lat: 40.6916, lng: -73.9907 },
  "edny brooklyn": { lat: 40.6963, lng: -73.9905 },
  "edny central islip": { lat: 40.7890, lng: -73.1935 },
  "sdny": { lat: 40.7119, lng: -74.0008 },
  "60 centre street": { lat: 40.7141, lng: -74.0013 },
  "suffolk county supreme court": { lat: 40.9170, lng: -72.6618 },
  "mineola": { lat: 40.7488, lng: -73.6393 },
  "manhattan": { lat: 40.7580, lng: -73.9855 },
  "brooklyn": { lat: 40.6782, lng: -73.9442 },
  "new york": { lat: 40.7128, lng: -74.0060 },
  "office": { lat: 40.7488, lng: -73.6393 }, // Default to Mineola office
};

export function geocodeAddress(address: string): { lat: number; lng: number } | null {
  if (!address) return null;
  const lower = address.toLowerCase();
  for (const [key, coords] of Object.entries(KNOWN_LOCATIONS)) {
    if (lower.includes(key)) return coords;
  }
  // Fallback: check for NY city names
  if (lower.includes("broadway") || lower.includes("ny 10")) return { lat: 40.7580, lng: -73.9855 };
  if (lower.includes("jamaica")) return { lat: 40.7024, lng: -73.8079 };
  return null;
}

export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function calculateTravelTime(from: { lat: number; lng: number }, to: { lat: number; lng: number }, mode: string): { durationMinutes: number; distanceMeters: number } {
  const straightLine = calculateDistance(from.lat, from.lng, to.lat, to.lng);
  const configs: Record<string, { multiplier: number; speedMph: number }> = {
    driving: { multiplier: 1.4, speedMph: straightLine > 30000 ? 45 : 25 },
    transit: { multiplier: 1.6, speedMph: 20 },
    walking: { multiplier: 1.2, speedMph: 3 },
  };
  const config = configs[mode] || configs.driving;
  const roadDistance = straightLine * config.multiplier;
  const speedMps = config.speedMph * 0.44704;
  const seconds = roadDistance / speedMps;
  return { durationMinutes: Math.max(5, Math.round(seconds / 60)), distanceMeters: Math.round(roadDistance) };
}

export interface TravelAnalysis {
  fromEvent: any;
  toEvent: any;
  travelMinutes: number;
  distanceMeters: number;
  gapMinutes: number;
  bufferMinutes: number;
  status: "ok" | "tight" | "conflict";
  departBy: Date;
  travelMode: string;
  summary: string;
}

export function analyzeDaySchedule(events: any[], preferences: { defaultMode: string; bufferMinutes: number; alertThreshold: number; officeLatitude?: number | null; officeLongitude?: number | null }): TravelAnalysis[] {
  const sorted = [...events].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  const results: TravelAnalysis[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const fromEvent = sorted[i];
    const toEvent = sorted[i + 1];
    const fromCoords = fromEvent.latitude && fromEvent.longitude ? { lat: fromEvent.latitude, lng: fromEvent.longitude } : geocodeAddress(fromEvent.location || fromEvent.address || "");
    const toCoords = toEvent.latitude && toEvent.longitude ? { lat: toEvent.latitude, lng: toEvent.longitude } : geocodeAddress(toEvent.location || toEvent.address || "");

    if (!fromCoords || !toCoords) {
      results.push({ fromEvent, toEvent, travelMinutes: 0, distanceMeters: 0, gapMinutes: Math.round((new Date(toEvent.startTime).getTime() - new Date(fromEvent.endTime).getTime()) / 60000), bufferMinutes: preferences.bufferMinutes, status: "ok", departBy: new Date(fromEvent.endTime), travelMode: preferences.defaultMode, summary: "Location unknown" });
      continue;
    }

    const travel = calculateTravelTime(fromCoords, toCoords, preferences.defaultMode);
    const gapMinutes = Math.round((new Date(toEvent.startTime).getTime() - new Date(fromEvent.endTime).getTime()) / 60000);
    const totalNeeded = travel.durationMinutes + preferences.bufferMinutes;
    const status = gapMinutes >= totalNeeded ? "ok" : gapMinutes >= travel.durationMinutes ? "tight" : "conflict";
    const departBy = new Date(new Date(toEvent.startTime).getTime() - (travel.durationMinutes + preferences.bufferMinutes) * 60000);
    const miles = Math.round(travel.distanceMeters / 1609.34 * 10) / 10;
    const departTime = departBy.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    const modeIcon = preferences.defaultMode === "driving" ? "🚗" : preferences.defaultMode === "transit" ? "🚇" : "🚶";
    const summary = `${modeIcon} ${travel.durationMinutes} min ${preferences.defaultMode} · ${miles} mi · Depart by ${departTime}`;

    results.push({ fromEvent, toEvent, travelMinutes: travel.durationMinutes, distanceMeters: travel.distanceMeters, gapMinutes, bufferMinutes: preferences.bufferMinutes, status, departBy, travelMode: preferences.defaultMode, summary });
  }
  return results;
}

export function detectConflicts(analyses: TravelAnalysis[]): TravelAnalysis[] {
  return analyses.filter(a => a.status === "conflict");
}

export function suggestDepartureTime(travelMinutes: number, bufferMinutes: number, nextEventStart: Date): Date {
  return new Date(nextEventStart.getTime() - (travelMinutes + bufferMinutes) * 60000);
}

export function formatTravelSummary(analysis: TravelAnalysis): string {
  return analysis.summary;
}

export function getSampleEvents(date: Date) {
  const d = (h: number, m: number) => { const dt = new Date(date); dt.setHours(h, m, 0, 0); return dt; };
  return [
    { id: "sample-1", title: "Smith v. Jones — Motion Hearing", startTime: d(9, 0), endTime: d(10, 0), location: "Nassau County Supreme Court, 100 Supreme Court Dr, Mineola, NY", eventType: "court_hearing", latitude: 40.7488, longitude: -73.6393, color: "#EF4444" },
    { id: "sample-2", title: "Client Meeting — Rodriguez Estate", startTime: d(11, 30), endTime: d(12, 30), location: "Office", eventType: "meeting", latitude: 40.7488, longitude: -73.6393, color: "#3B82F6" },
    { id: "sample-3", title: "Deposition — Dr. Williams", startTime: d(14, 0), endTime: d(15, 30), location: "225 Broadway, Suite 1200, New York, NY", eventType: "deposition", latitude: 40.7128, longitude: -74.0060, color: "#F97316" },
    { id: "sample-4", title: "Call with Insurance Adjuster", startTime: d(16, 30), endTime: d(17, 0), location: "Office", eventType: "appointment", latitude: 40.7488, longitude: -73.6393, color: "#8B5CF6" },
  ];
}
