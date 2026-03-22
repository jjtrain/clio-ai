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
  "100 supreme court dr": { lat: 40.7488, lng: -73.6393 },
  "225 broadway": { lat: 40.7128, lng: -74.0060 },
};

// Known geofence zones for courts (from court check-in system)
const KNOWN_GEOFENCES: Record<string, { geofenceId: string; radius: number; courtName: string; lat: number; lng: number }> = {
  "nassau county supreme court": { geofenceId: "geo-nassau-supreme", radius: 200, courtName: "Nassau County Supreme Court", lat: 40.7488, lng: -73.6393 },
  "queens county supreme court": { geofenceId: "geo-queens-supreme", radius: 200, courtName: "Queens County Supreme Court", lat: 40.7024, lng: -73.8079 },
  "kings county supreme court": { geofenceId: "geo-kings-supreme", radius: 200, courtName: "Kings County Supreme Court", lat: 40.6916, lng: -73.9907 },
  "sdny": { geofenceId: "geo-sdny", radius: 150, courtName: "Southern District of New York", lat: 40.7119, lng: -74.0008 },
  "edny brooklyn": { geofenceId: "geo-edny-bk", radius: 150, courtName: "Eastern District of New York (Brooklyn)", lat: 40.6963, lng: -73.9905 },
  "suffolk county supreme court": { geofenceId: "geo-suffolk-supreme", radius: 250, courtName: "Suffolk County Supreme Court", lat: 40.9170, lng: -72.6618 },
};

export function geocodeAddress(address: string): { lat: number; lng: number } | null {
  if (!address) return null;
  const lower = address.toLowerCase();
  for (const [key, coords] of Object.entries(KNOWN_LOCATIONS)) {
    if (lower.includes(key)) return coords;
  }
  if (lower.includes("broadway") || lower.includes("ny 10")) return { lat: 40.7580, lng: -73.9855 };
  if (lower.includes("jamaica")) return { lat: 40.7024, lng: -73.8079 };
  return null;
}

export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
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

// Geofence Integration Functions
export function getGeofenceForEvent(event: any): { geofenceId: string; radius: number; courtName: string; lat: number; lng: number } | null {
  if (event.geofenceId) {
    for (const geo of Object.values(KNOWN_GEOFENCES)) {
      if (geo.geofenceId === event.geofenceId) return geo;
    }
  }
  const location = (event.location || event.address || "").toLowerCase();
  for (const [key, geo] of Object.entries(KNOWN_GEOFENCES)) {
    if (location.includes(key)) return geo;
  }
  if (event.eventType === "court_hearing" && event.courtId) {
    return Object.values(KNOWN_GEOFENCES)[0] || null;
  }
  return null;
}

export function calculateGeofenceArrival(travelMinutes: number, geofenceBuffer: number, eventStart: Date): Date {
  return new Date(eventStart.getTime() - (travelMinutes + geofenceBuffer) * 60000);
}

export function syncGeofenceStatus(eventId: string): { status: string; lastUpdate: Date } {
  // In production, this would query the court check-in system
  return { status: "pending", lastUpdate: new Date() };
}

// Matter Calendar Sync Functions
export async function syncMatterDeadlines(userId: string, firmId: string, startDate: Date, endDate: Date) {
  try {
    const matters = await (db.matter as any).findMany({
      where: { firmId },
    });

    for (const matter of matters) {
      // Check for matter deadlines via task/deadline relations
      const deadlines = await (db as any).task?.findMany?.({
        where: { matterId: matter.id, dueDate: { gte: startDate, lte: endDate } },
      }) || [];
      for (const deadline of deadlines) {
        const existing = await db.calendarEvent.findFirst({
          where: { sourceType: "matter_deadline", sourceId: deadline.id } as any,
        });
        if (!existing) {
          await db.calendarEvent.create({
            data: {
              title: `${deadline.title || "Deadline"} - ${matter.title}`,
              startTime: deadline.dueDate, endTime: deadline.dueDate,
              eventType: "matter_deadline", sourceType: "matter_deadline",
              sourceId: deadline.id, matterId: matter.id, userId, firmId,
            } as any,
          });
        }
      }
    }
  } catch {
    // Relations may not exist yet
  }
}

export async function syncCourtFilings(userId: string, firmId: string, startDate: Date, endDate: Date) {
  try {
    const filings = await (db as any).courtFilingRule?.findMany?.({
      where: { deadlineDate: { gte: startDate, lte: endDate } },
    }) || [];
    for (const filing of filings) {
      const existing = await db.calendarEvent.findFirst({
        where: { sourceType: "court_filing", sourceId: filing.id } as any,
      });
      if (!existing) {
        await db.calendarEvent.create({
          data: {
            title: `Filing: ${filing.ruleName || filing.title || "Court Filing"}`,
            startTime: filing.deadlineDate || new Date(),
            endTime: filing.deadlineDate || new Date(),
            eventType: "court_filing", sourceType: "court_filing",
            sourceId: filing.id, userId, firmId,
          } as any,
        });
      }
    }
  } catch {
    // Tables may not exist yet
  }
}

export async function syncStatuteTrackers(userId: string, firmId: string, startDate: Date, endDate: Date) {
  try {
    const trackers = await (db as any).statuteOfLimitations?.findMany?.({
      where: { expirationDate: { gte: startDate, lte: endDate } },
    }) || [];
    for (const tracker of trackers) {
      const existing = await db.calendarEvent.findFirst({
        where: { sourceType: "statute_tracker", sourceId: tracker.id } as any,
      });
      if (!existing) {
        await db.calendarEvent.create({
          data: {
            title: `SOL: ${tracker.matterName || tracker.title || "Statute Expiration"}`,
            startTime: tracker.expirationDate, endTime: tracker.expirationDate,
            eventType: "statute_tracker", sourceType: "statute_tracker",
            sourceId: tracker.id, userId, firmId,
          } as any,
        });
      }
    }
  } catch {
    // Tables may not exist yet
  }
}

export function resolveEventLocation(event: any, prefs?: any): string {
  if (event.location) return event.location;
  if (event.address) return event.address;
  if (event.eventType === "court_hearing" || event.eventType === "court_filing") return "Court";
  if (prefs?.officeAddress) return prefs.officeAddress;
  return "Office";
}

export async function fullCalendarSync(userId: string, firmId: string, startDate: Date, endDate: Date) {
  await Promise.all([
    syncMatterDeadlines(userId, firmId, startDate, endDate),
    syncCourtFilings(userId, firmId, startDate, endDate),
    syncStatuteTrackers(userId, firmId, startDate, endDate),
  ]);
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
  hasGeofence: boolean;
  geofenceInfo: { geofenceId: string; radius: number; courtName: string; lat: number; lng: number } | null;
  geofenceArrivalTime: Date | null;
}

export function analyzeDaySchedule(
  events: any[],
  preferences: { defaultMode: string; bufferMinutes: number; alertThreshold: number; geofenceBuffer?: number; officeLatitude?: number | null; officeLongitude?: number | null }
): TravelAnalysis[] {
  const sorted = [...events].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  const results: TravelAnalysis[] = [];
  const geofenceBuffer = preferences.geofenceBuffer || 10;

  for (let i = 0; i < sorted.length - 1; i++) {
    const fromEvent = sorted[i];
    const toEvent = sorted[i + 1];
    const fromCoords = fromEvent.latitude && fromEvent.longitude
      ? { lat: fromEvent.latitude, lng: fromEvent.longitude }
      : geocodeAddress(fromEvent.location || fromEvent.address || "");
    const toCoords = toEvent.latitude && toEvent.longitude
      ? { lat: toEvent.latitude, lng: toEvent.longitude }
      : geocodeAddress(toEvent.location || toEvent.address || "");

    const geofenceInfo = getGeofenceForEvent(toEvent);
    const hasGeofence = geofenceInfo !== null;
    const extraBuffer = hasGeofence ? geofenceBuffer : 0;

    if (!fromCoords || !toCoords) {
      results.push({
        fromEvent, toEvent, travelMinutes: 0, distanceMeters: 0,
        gapMinutes: Math.round((new Date(toEvent.startTime).getTime() - new Date(fromEvent.endTime).getTime()) / 60000),
        bufferMinutes: preferences.bufferMinutes + extraBuffer, status: "ok",
        departBy: new Date(fromEvent.endTime), travelMode: preferences.defaultMode,
        summary: "Location unknown", hasGeofence, geofenceInfo, geofenceArrivalTime: null,
      });
      continue;
    }

    const travel = calculateTravelTime(fromCoords, toCoords, preferences.defaultMode);
    const gapMinutes = Math.round((new Date(toEvent.startTime).getTime() - new Date(fromEvent.endTime).getTime()) / 60000);
    const totalNeeded = travel.durationMinutes + preferences.bufferMinutes + extraBuffer;
    const status = gapMinutes >= totalNeeded ? "ok" : gapMinutes >= travel.durationMinutes ? "tight" : "conflict";
    const departBy = new Date(new Date(toEvent.startTime).getTime() - (travel.durationMinutes + preferences.bufferMinutes + extraBuffer) * 60000);
    const miles = Math.round(travel.distanceMeters / 1609.34 * 10) / 10;
    const departTime = departBy.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    const modeLabel = preferences.defaultMode === "driving" ? "drive" : preferences.defaultMode === "transit" ? "transit" : "walk";
    const summary = `${travel.durationMinutes} min ${modeLabel} · ${miles} mi · Depart by ${departTime}`;

    const geofenceArrivalTime = hasGeofence
      ? calculateGeofenceArrival(travel.durationMinutes, geofenceBuffer, new Date(toEvent.startTime))
      : null;

    results.push({
      fromEvent, toEvent, travelMinutes: travel.durationMinutes, distanceMeters: travel.distanceMeters,
      gapMinutes, bufferMinutes: preferences.bufferMinutes + extraBuffer, status, departBy,
      travelMode: preferences.defaultMode, summary, hasGeofence, geofenceInfo, geofenceArrivalTime,
    });
  }
  return results;
}

export function detectConflicts(analyses: TravelAnalysis[]): TravelAnalysis[] {
  return analyses.filter(a => a.status === "conflict");
}

export function suggestDepartureTime(travelMinutes: number, bufferMinutes: number, nextEventStart: Date, hasGeofence?: boolean, geofenceBuffer?: number): Date {
  const extra = hasGeofence && geofenceBuffer ? geofenceBuffer : 0;
  return new Date(nextEventStart.getTime() - (travelMinutes + bufferMinutes + extra) * 60000);
}

export function formatTravelSummary(analysis: TravelAnalysis): string {
  let s = analysis.summary;
  if (analysis.hasGeofence && analysis.geofenceArrivalTime) {
    const arrTime = analysis.geofenceArrivalTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    s += ` · Check-in by ${arrTime}`;
  }
  return s;
}

export function getSampleEvents(date: Date) {
  const d = (h: number, m: number) => { const dt = new Date(date); dt.setHours(h, m, 0, 0); return dt; };
  return [
    {
      id: "sample-1", title: "Smith v. Jones — Motion Hearing", description: "Motion for Summary Judgment",
      startTime: d(9, 0), endTime: d(10, 0),
      location: "Nassau County Supreme Court, 100 Supreme Court Dr, Mineola, NY",
      eventType: "court_hearing", latitude: 40.7488, longitude: -73.6393, color: "#EF4444",
      courtId: "nassau-supreme", geofenceId: "geo-nassau-supreme", checkinStatus: "pending",
      sourceType: "manual", sourceId: null, matterId: "matter-smith-jones",
      matterName: "Smith v. Jones", matterNumber: "2026-CV-1234",
    },
    {
      id: "sample-2", title: "Client Meeting — Rodriguez Estate Planning", description: "Review estate documents and trust amendments",
      startTime: d(11, 30), endTime: d(12, 30),
      location: "Office", eventType: "meeting", latitude: 40.7488, longitude: -73.6393, color: "#3B82F6",
      sourceType: "matter_deadline", sourceId: "md-rodriguez-1", matterId: "matter-rodriguez",
      matterName: "Rodriguez Estate", matterNumber: "2026-EP-0567",
      geofenceId: null, checkinStatus: null, courtId: null,
    },
    {
      id: "sample-3", title: "Deposition — Dr. Williams", description: "Expert witness deposition re: medical records",
      startTime: d(14, 0), endTime: d(15, 30),
      location: "225 Broadway, Suite 1200, New York, NY",
      eventType: "deposition", latitude: 40.7128, longitude: -74.0060, color: "#F97316",
      matterId: "matter-smith-jones", matterName: "Smith v. Jones", matterNumber: "2026-CV-1234",
      sourceType: "manual", sourceId: null, geofenceId: null, checkinStatus: null, courtId: null,
    },
    {
      id: "sample-4", title: "Filing Deadline — Smith v. Jones Response",
      description: "Response to Motion to Dismiss due by 5:00 PM",
      startTime: d(17, 0), endTime: d(17, 0),
      location: "Nassau County Supreme Court", eventType: "court_filing",
      latitude: 40.7488, longitude: -73.6393, color: "#8B5CF6",
      sourceType: "court_filing", sourceId: "cf-smith-resp",
      matterId: "matter-smith-jones", matterName: "Smith v. Jones", matterNumber: "2026-CV-1234",
      geofenceId: null, checkinStatus: null, courtId: "nassau-supreme",
    },
    {
      id: "sample-sol", title: "⚠️ SOL WARNING: Garcia PI — Expires in 12 days",
      description: "Personal injury statute of limitations expires April 3, 2026",
      startTime: d(0, 0), endTime: d(23, 59),
      location: null, eventType: "statute_tracker",
      latitude: null, longitude: null, color: "#991B1B",
      sourceType: "statute_tracker", sourceId: "sol-garcia-pi",
      matterId: "matter-garcia", matterName: "Garcia v. Metro Transit", matterNumber: "2025-PI-0891",
      geofenceId: null, checkinStatus: null, courtId: null, isAllDay: true,
    },
  ];
}
