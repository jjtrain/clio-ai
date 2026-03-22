import { router, publicProcedure } from "../trpc";
import { z } from "zod";
import { db } from "@/lib/db";

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const SEED_COURTHOUSES = [
  { name: "Los Angeles Superior Court - Stanley Mosk", address: "111 N Hill St", city: "Los Angeles", state: "CA", zip: "90012", latitude: 34.0544, longitude: -118.2439, courtType: "SUPERIOR" as any, parkingNotes: "Paid parking garage on N Spring St. Street parking extremely limited. Metro Red Line to Civic Center station recommended.", securityNotes: "Airport-style security screening. No phones in some courtrooms. Arrive 30 min early for lines.", localTips: JSON.stringify(["Check courtroom assignments on 2nd floor monitors", "Cafeteria on B1 level closes at 2pm", "Filing window closes at 4:30pm sharp"]) },
  { name: "San Francisco Superior Court - Civic Center", address: "400 McAllister St", city: "San Francisco", state: "CA", zip: "94102", latitude: 37.7809, longitude: -122.4177, courtType: "SUPERIOR" as any, parkingNotes: "Civic Center Garage on McAllister. Limited metered parking. BART Civic Center station is 2 blocks.", securityNotes: "Metal detectors at all entrances. No weapons, no recording devices. Clear bags recommended.", localTips: JSON.stringify(["Department assignments posted in main lobby", "Clerk's office on 1st floor for filings", "Nearby lunch options on Hayes St"]) },
  { name: "Cook County Circuit Court - Daley Center", address: "50 W Washington St", city: "Chicago", state: "IL", zip: "60602", latitude: 41.8842, longitude: -87.6324, courtType: "CIRCUIT" as any, parkingNotes: "Multiple paid garages nearby. Street parking metered. CTA Blue/Red Line to Washington station.", securityNotes: "Security screening at all entrances. Photo ID required. No recording devices.", localTips: JSON.stringify(["Call rooms listed on paper docket each morning", "Law library on 29th floor", "Jollof rice cart on Dearborn side is excellent"]) },
  { name: "New York Supreme Court - 60 Centre Street", address: "60 Centre St", city: "New York", state: "NY", zip: "10007", latitude: 40.7143, longitude: -74.0013, courtType: "SUPREME" as any, parkingNotes: "No dedicated parking. Municipal lot on Pearl St. Subway 4/5/6 to Brooklyn Bridge-City Hall.", securityNotes: "Strict security. No electronics in some parts. Expect long lines before 10am.", localTips: JSON.stringify(["Check Part assignments in lobby", "Motion support office on 1st floor", "Chinatown nearby for lunch"]) },
  { name: "Harris County Civil Courthouse", address: "201 Caroline St", city: "Houston", state: "TX", zip: "77002", latitude: 29.7589, longitude: -95.3614, courtType: "DISTRICT" as any, parkingNotes: "Jury parking garage on Lubbock St. Multiple paid lots nearby. METRORail to Preston station.", securityNotes: "Security screening required. No weapons. Business attire expected.", localTips: JSON.stringify(["E-filing required for most documents", "Clerk's office on 1st floor", "Food trucks on Caroline St at lunch"]) },
  { name: "Miami-Dade County Courthouse", address: "73 W Flagler St", city: "Miami", state: "FL", zip: "33130", latitude: 25.7753, longitude: -80.1960, courtType: "CIRCUIT" as any, parkingNotes: "Courthouse garage on NW 1st St. Metrorail to Government Center. Metered street parking.", securityNotes: "Metal detectors at main entrance. Photo ID required. No food or drinks in courtrooms.", localTips: JSON.stringify(["Case assignments on digital boards in lobby", "Notary services available on 1st floor", "Cuban coffee window across the street"]) },
  { name: "Maricopa County Superior Court", address: "201 W Jefferson St", city: "Phoenix", state: "AZ", zip: "85003", latitude: 33.4484, longitude: -112.0773, courtType: "SUPERIOR" as any, parkingNotes: "Courthouse garage on 1st Ave. Valley Metro light rail to Jefferson station. Bring water - hot walk from parking.", securityNotes: "Security at all entrances. Clear bags recommended. No electronics in jury rooms.", localTips: JSON.stringify(["Self-service center on 1st floor", "Filing deadline 5pm local time", "Shade parking on west side of garage"]) },
  { name: "King County Superior Court - Seattle", address: "516 3rd Ave", city: "Seattle", state: "WA", zip: "98104", latitude: 47.6024, longitude: -122.3310, courtType: "SUPERIOR" as any, parkingNotes: "Paid garages on 3rd Ave and James St. Link Light Rail to Pioneer Square. Bring umbrella.", securityNotes: "Security screening at 3rd Ave entrance. Photo ID required.", localTips: JSON.stringify(["Ex parte department on 3rd floor", "Law library in basement level", "Pike Place Market 10 min walk for lunch"]) },
  { name: "Philadelphia Court of Common Pleas - City Hall", address: "1 S Penn Square", city: "Philadelphia", state: "PA", zip: "19107", latitude: 39.9524, longitude: -75.1636, courtType: "COMMON_PLEAS" as any, parkingNotes: "Parking garages on Juniper St and Broad St. SEPTA Broad Street Line to City Hall. Bike racks on north side.", securityNotes: "Security at all entrances. No sharp objects. Expect delays at morning rush.", localTips: JSON.stringify(["Prothonotary office for filings on 1st floor", "Observation deck open some afternoons", "Reading Terminal Market across the street for lunch"]) },
  { name: "Denver District Court", address: "1437 Bannock St", city: "Denver", state: "CO", zip: "80202", latitude: 39.7392, longitude: -104.9903, courtType: "DISTRICT" as any, parkingNotes: "Metered street parking on Bannock and Colfax. RTD light rail to Civic Center station. Garage on Cherokee St.", securityNotes: "Standard security screening. Photo ID required. No weapons or recording devices.", localTips: JSON.stringify(["Self-help center on 1st floor", "E-filing via ICCES required", "Civic Center Park nearby for breaks"]) },
];

export const locationRouter = router({
  // 1. courthouses.list
  "courthouses.list": publicProcedure
    .input(z.object({ state: z.string().optional(), city: z.string().optional(), courtType: z.string().optional(), isActive: z.boolean().optional() }).optional())
    .query(async ({ input }) => {
      const where: any = {};
      if (input?.state) where.state = input.state;
      if (input?.city) where.city = { contains: input.city, mode: "insensitive" };
      if (input?.courtType) where.courtType = input.courtType as any;
      if (input?.isActive !== undefined) where.isActive = input.isActive;
      return db.courthouseLocation.findMany({ where, orderBy: { name: "asc" } }) as any;
    }),

  // 2. courthouses.get
  "courthouses.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return db.courthouseLocation.findUnique({ where: { id: input.id } }) as any;
    }),

  // 3. courthouses.create
  "courthouses.create": publicProcedure
    .input(z.object({ name: z.string(), address: z.string(), city: z.string(), state: z.string(), zip: z.string(), latitude: z.number(), longitude: z.number(), radiusMeters: z.number().optional(), courtType: z.string().optional(), phone: z.string().optional(), parkingNotes: z.string().optional(), securityNotes: z.string().optional(), courtId: z.string().optional() }))
    .mutation(async ({ input }) => {
      return db.courthouseLocation.create({ data: { ...input, courtType: input.courtType as any } }) as any;
    }),

  // 4. courthouses.update
  "courthouses.update": publicProcedure
    .input(z.object({ id: z.string(), data: z.record(z.any()) }))
    .mutation(async ({ input }) => {
      return db.courthouseLocation.update({ where: { id: input.id }, data: input.data }) as any;
    }),

  // 5. courthouses.delete
  "courthouses.delete": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      return db.courthouseLocation.update({ where: { id: input.id }, data: { isActive: false } }) as any;
    }),

  // 6. courthouses.nearby
  "courthouses.nearby": publicProcedure
    .input(z.object({ latitude: z.number(), longitude: z.number(), radiusMeters: z.number().default(1000) }))
    .query(async ({ input }) => {
      const all = await db.courthouseLocation.findMany({ where: { isActive: true } }) as any[];
      const results = all.map((c: any) => ({ ...c, distance: haversine(input.latitude, input.longitude, c.latitude, c.longitude) }))
        .filter((c: any) => c.distance <= input.radiusMeters)
        .sort((a: any, b: any) => a.distance - b.distance);
      return results;
    }),

  // 7. courthouses.seed
  "courthouses.seed": publicProcedure
    .mutation(async () => {
      const count = await db.courthouseLocation.count();
      if (count > 0) return { seeded: 0 };
      for (const ch of SEED_COURTHOUSES) {
        await db.courthouseLocation.create({ data: ch as any });
      }
      return { seeded: SEED_COURTHOUSES.length };
    }),

  // 8. courthouses.addTip
  "courthouses.addTip": publicProcedure
    .input(z.object({ courthouseId: z.string(), tip: z.string() }))
    .mutation(async ({ input }) => {
      const ch = await db.courthouseLocation.findUnique({ where: { id: input.courthouseId } }) as any;
      const tips = ch?.localTips ? JSON.parse(ch.localTips as string) : [];
      tips.push(input.tip);
      return db.courthouseLocation.update({ where: { id: input.courthouseId }, data: { localTips: JSON.stringify(tips) } }) as any;
    }),

  // 9. courthouses.linkToCourt
  "courthouses.linkToCourt": publicProcedure
    .input(z.object({ courthouseId: z.string(), courtId: z.string() }))
    .mutation(async ({ input }) => {
      return db.courthouseLocation.update({ where: { id: input.courthouseId }, data: { courtId: input.courtId } }) as any;
    }),

  // 10. checkIn
  checkIn: publicProcedure
    .input(z.object({ courthouseId: z.string(), userId: z.string(), matterId: z.string().optional(), latitude: z.number().optional(), longitude: z.number().optional(), accuracy: z.number().optional(), autoDetected: z.boolean().optional(), deviceType: z.string().optional() }))
    .mutation(async ({ input }) => {
      const checkIn = await db.courtCheckIn.create({ data: input as any, include: { courthouse: true } }) as any;
      return checkIn;
    }),

  // 11. checkOut
  checkOut: publicProcedure
    .input(z.object({ checkInId: z.string(), outcome: z.string().optional(), quickNotes: z.string().optional() }))
    .mutation(async ({ input }) => {
      return db.courtCheckIn.update({ where: { id: input.checkInId }, data: { checkOutTime: new Date(), outcome: input.outcome as any, quickNotes: input.quickNotes } }) as any;
    }),

  // 12. addQuickNote
  addQuickNote: publicProcedure
    .input(z.object({ checkInId: z.string(), text: z.string() }))
    .mutation(async ({ input }) => {
      const ci = await db.courtCheckIn.findUnique({ where: { id: input.checkInId } }) as any;
      const notes = ci?.quickNotes ? JSON.parse(ci.quickNotes as string) : [];
      notes.push({ text: input.text, timestamp: new Date() });
      return db.courtCheckIn.update({ where: { id: input.checkInId }, data: { quickNotes: JSON.stringify(notes) } }) as any;
    }),

  // 13. getActive
  getActive: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      return db.courtCheckIn.findFirst({ where: { userId: input.userId, checkOutTime: null }, include: { courthouse: true } }) as any;
    }),

  // 14. getHistory
  getHistory: publicProcedure
    .input(z.object({ userId: z.string().optional(), courthouseId: z.string().optional(), page: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const where: any = {};
      if (input?.userId) where.userId = input.userId;
      if (input?.courthouseId) where.courthouseId = input.courthouseId;
      const skip = ((input?.page || 1) - 1) * 20;
      return db.courtCheckIn.findMany({ where, include: { courthouse: true }, orderBy: { checkInTime: "desc" }, take: 20, skip }) as any;
    }),

  // 15. getMattersForCourthouse
  getMattersForCourthouse: publicProcedure
    .input(z.object({ courthouseId: z.string() }))
    .query(async ({ input }) => {
      const ch = await db.courthouseLocation.findUnique({ where: { id: input.courthouseId } }) as any;
      if (!ch?.courtId) return [];
      const assignments = await db.matterCourtAssignment.findMany({ where: { courtId: ch.courtId } });
      const matterIds = assignments.map((a: any) => a.matterId);
      if (matterIds.length === 0) return [];
      return db.matter.findMany({ where: { id: { in: matterIds } }, include: { client: true } });
    }),

  // 16. getStatsForCourthouse
  getStatsForCourthouse: publicProcedure
    .input(z.object({ courthouseId: z.string() }))
    .query(async ({ input }) => {
      const checkIns = await db.courtCheckIn.findMany({ where: { courthouseId: input.courthouseId } }) as any[];
      const completed = checkIns.filter((c: any) => c.checkOutTime);
      const avgMs = completed.length ? completed.reduce((s: number, c: any) => s + (new Date(c.checkOutTime).getTime() - new Date(c.checkInTime).getTime()), 0) / completed.length : 0;
      return { totalCheckIns: checkIns.length, completedCheckIns: completed.length, avgDurationMinutes: Math.round(avgMs / 60000) };
    }),

  // 17. settings.get
  "settings.get": publicProcedure
    .query(async () => {
      const settings = await db.locationSettings.findFirst() as any;
      if (settings) return settings;
      return db.locationSettings.create({ data: {} }) as any;
    }),

  // 18. settings.update
  "settings.update": publicProcedure
    .input(z.object({ id: z.string().optional(), autoCheckIn: z.boolean().optional(), geofenceRadius: z.number().optional(), notificationsEnabled: z.boolean().optional() }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      const existing = await db.locationSettings.findFirst() as any;
      if (existing) return db.locationSettings.update({ where: { id: existing.id }, data }) as any;
      return db.locationSettings.create({ data }) as any;
    }),

  // 19. getMattersNearMe
  getMattersNearMe: publicProcedure
    .input(z.object({ latitude: z.number(), longitude: z.number(), radiusMeters: z.number().default(5000) }))
    .query(async ({ input }) => {
      const all = await db.courthouseLocation.findMany({ where: { isActive: true } }) as any[];
      const nearby = all.map((c: any) => ({ ...c, distance: haversine(input.latitude, input.longitude, c.latitude, c.longitude) }))
        .filter((c: any) => c.distance <= input.radiusMeters)
        .sort((a: any, b: any) => a.distance - b.distance);
      const results = [];
      for (const ch of nearby) {
        let matters: any[] = [];
        if (ch.courtId) { const assigns = await db.matterCourtAssignment.findMany({ where: { courtId: ch.courtId } }); const ids = assigns.map((a: any) => a.matterId); if (ids.length) matters = await db.matter.findMany({ where: { id: { in: ids } }, include: { client: true } }); }
        results.push({ courthouse: ch, matters, distance: ch.distance });
      }
      return results;
    }),

  // 20. reports.visitHistory
  "reports.visitHistory": publicProcedure
    .input(z.object({ userId: z.string().optional(), from: z.string().optional(), to: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const where: any = {};
      if (input?.userId) where.userId = input.userId;
      if (input?.from || input?.to) {
        where.checkInTime = {};
        if (input?.from) where.checkInTime.gte = new Date(input.from);
        if (input?.to) where.checkInTime.lte = new Date(input.to);
      }
      return db.courtCheckIn.findMany({ where, include: { courthouse: true }, orderBy: { checkInTime: "desc" } }) as any;
    }),

  // 21. reports.travelAnalysis
  "reports.travelAnalysis": publicProcedure
    .query(async () => {
      return { mostVisited: [] };
    }),

  // 22. reports.courtPresence
  "reports.courtPresence": publicProcedure
    .query(async () => {
      return db.courtCheckIn.findMany({ where: { checkOutTime: null }, include: { courthouse: true } }) as any;
    }),
});
