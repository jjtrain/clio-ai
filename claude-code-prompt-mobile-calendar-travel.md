# Task: Add Mobile Calendar with Travel Time to Clio AI

Add a mobile-optimized calendar day/agenda view that automatically calculates and displays travel time between appointments based on their locations. Uses Google Maps Distance Matrix API for real-time travel estimates.

## What to build (in this order):

### 1. Schema Updates

Check the existing `CalendarEvent` and `Appointment` models in `prisma/schema.prisma`. Add these fields if missing:

**On CalendarEvent:**
```prisma
  location        String?          // Address or place name
  latitude        Float?           // Geocoded lat
  longitude       Float?           // Geocoded lng
  isVirtual       Boolean          @default(false)  // Zoom/Teams/Phone — no travel needed
  virtualLink     String?          // Meeting URL
```

**On Appointment:**
```prisma
  location        String?          // Where the appointment takes place
  latitude        Float?
  longitude       Float?
  isVirtual       Boolean          @default(false)
  virtualLink     String?
```

**New model — TravelBlock:**
```prisma
model TravelBlock {
  id              String    @id @default(cuid())
  
  fromEventId     String?   // CalendarEvent or Appointment ID we're traveling FROM
  toEventId       String?   // CalendarEvent or Appointment ID we're traveling TO
  
  fromAddress     String
  toAddress       String
  
  // Travel estimates
  drivingMinutes  Int?
  drivingDistance  String?       // e.g. "12.3 mi"
  transitMinutes  Int?
  walkingMinutes  Int?
  
  // Which mode the user prefers for this block
  selectedMode    String    @default("driving")  // "driving" | "transit" | "walking"
  
  // Buffer time the user wants (e.g. 10 min for parking)
  bufferMinutes   Int       @default(10)
  
  departBy        DateTime?     // Calculated: toEvent.startTime - travelMinutes - bufferMinutes
  
  calculatedAt    DateTime  @default(now())
  
  @@index([fromEventId])
  @@index([toEventId])
}
```

Run `npx prisma db push`

### 2. Google Maps Service — `src/lib/google-maps.ts`

Create a service for geocoding and travel time calculation:

```typescript
// Uses Google Maps Platform APIs
// Needs env var: GOOGLE_MAPS_API_KEY

interface TravelEstimate {
  drivingMinutes: number | null;
  drivingDistance: string | null;
  transitMinutes: number | null;
  walkingMinutes: number | null;
}

interface GeocodedLocation {
  latitude: number;
  longitude: number;
  formattedAddress: string;
}

// Geocode an address string to lat/lng
export async function geocodeAddress(address: string): Promise<GeocodedLocation | null>
// Uses: https://maps.googleapis.com/maps/api/geocode/json?address={address}&key={key}

// Calculate travel time between two addresses
export async function calculateTravelTime(
  origin: string,
  destination: string,
  departureTime?: Date  // For traffic-aware estimates
): Promise<TravelEstimate>
// Uses: https://maps.googleapis.com/maps/api/distancematrix/json
// Request driving, transit, and walking modes in parallel (3 API calls)
// For driving: add departure_time=now or specified time for traffic estimates
// Parse response.rows[0].elements[0].duration.value (seconds) → convert to minutes
// Parse response.rows[0].elements[0].distance.text for distance string

// Calculate travel blocks for all events on a given day
export async function calculateDayTravelBlocks(
  events: Array<{ id: string; startTime: Date; endTime: Date; location: string | null; isVirtual: boolean }>,
  homeAddress: string  // Attorney's default start/end location
): Promise<TravelBlock[]>
// Logic:
// 1. Filter to only events with a physical location (skip isVirtual=true)
// 2. Sort by startTime
// 3. For each consecutive pair of located events, calculate travel time between them
// 4. For the first event of the day, calculate travel from homeAddress
// 5. For the last event, calculate travel back to homeAddress (optional, configurable)
// 6. Skip calculation if locations are the same address
// 7. Return array of TravelBlock data (not yet saved to DB)
```

### 3. Travel Time Settings — Add to existing SchedulerSettings or create new

Check if there's a settings model. Add these fields (on SchedulerSettings or a new TravelSettings model):

```prisma
  // Travel time settings
  homeAddress         String?         // Attorney's home/office address for start/end of day
  homeLatitude        Float?
  homeLongitude       Float?
  defaultTravelMode   String          @default("driving")  // "driving" | "transit" | "walking"
  defaultBufferMin    Int             @default(10)          // Extra minutes for parking/walking
  showTravelBlocks    Boolean         @default(true)
  calcReturnHome      Boolean         @default(false)       // Show travel time back home after last appt
```

### 4. tRPC Router — `src/server/routers/travel.ts`

Create a new router:

```typescript
export const travelRouter = router({

  // Calculate travel time between two addresses (on-demand)
  calculateBetween: protectedProcedure
    .input(z.object({
      origin: z.string(),
      destination: z.string(),
      departureTime: z.string().optional(),  // ISO datetime
    }))
    .mutation(async ({ input }) => {
      // Call calculateTravelTime from google-maps.ts
      // Return the TravelEstimate
    }),

  // Get all travel blocks for a specific day
  getForDay: protectedProcedure
    .input(z.object({
      date: z.string(),  // YYYY-MM-DD
    }))
    .query(async ({ ctx, input }) => {
      // 1. Get all CalendarEvents and Appointments for this date
      // 2. Merge and sort by start time
      // 3. Check if TravelBlocks already exist and are fresh (< 2 hours old)
      // 4. If stale or missing, recalculate using calculateDayTravelBlocks
      // 5. Upsert TravelBlock records
      // 6. Return events interleaved with travel blocks in chronological order
    }),

  // Recalculate travel blocks (force refresh)
  recalculate: protectedProcedure
    .input(z.object({
      date: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Delete existing TravelBlocks for this date's events
      // Recalculate fresh from Google Maps
      // Return new blocks
    }),

  // Geocode an address (used when creating/editing events)
  geocode: protectedProcedure
    .input(z.object({ address: z.string() }))
    .mutation(async ({ input }) => {
      // Call geocodeAddress
      // Return lat/lng/formattedAddress
    }),

  // Update travel settings
  updateSettings: protectedProcedure
    .input(z.object({
      homeAddress: z.string().optional(),
      defaultTravelMode: z.enum(["driving", "transit", "walking"]).optional(),
      defaultBufferMin: z.number().min(0).max(60).optional(),
      showTravelBlocks: z.boolean().optional(),
      calcReturnHome: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Update SchedulerSettings or TravelSettings
      // If homeAddress changed, geocode it and store lat/lng
    }),

  // Get travel settings
  getSettings: protectedProcedure
    .query(async ({ ctx }) => {
      // Return current travel settings
    }),
});
```

Register in `src/server/routers/_app.ts` as `travel: travelRouter`

### 5. Mobile Day View Page — `src/app/(dashboard)/calendar/day/page.tsx`

This is the primary new UI. Build a mobile-optimized daily agenda view.

**URL:** `/calendar/day?date=2026-03-22` (defaults to today if no date param)

**Header:**
- Date display: "Sun, Mar 22" with left/right arrows to navigate days
- "Today" button to jump back to current date
- Small weather indicator if available (optional, skip if complex)
- "Refresh Travel" button (recalculates all travel blocks)
- Gear icon → links to travel settings

**Timeline layout (vertical, scrollable):**
- Full-day timeline from first event minus travel to last event plus travel
- Time markers on the left edge (8 AM, 9 AM, etc.)
- Events as cards in the timeline, height proportional to duration

**Event cards:**
- Title, time range (9:00 AM – 10:00 AM), duration badge
- Location line with map pin icon — show address
- If virtual: show video icon + "Virtual" badge + meeting link button
- Matter name if linked (small tag)
- Tap to expand: shows full details, edit button, directions button

**Travel blocks (between events):**
- Visually distinct from events — use a dashed border or muted background with a car/transit/walk icon
- Show: travel time (e.g. "23 min drive"), distance ("8.2 mi"), depart-by time
- Color coding:
  - Green: plenty of time (travel + buffer < gap between events)
  - Yellow: tight (travel + buffer uses > 80% of gap)
  - Red: not enough time (travel + buffer > gap — you'll be late)
- Mode selector: small toggle for driving/transit/walking — updates the display
- Tap to expand: shows all three mode options with times, "Open in Maps" button (deep links to Google Maps/Apple Maps with directions)

**"Depart by" indicators:**
- For each travel block, show a prominent "Leave by 9:37 AM" label
- Calculate: next event start time - travel minutes - buffer minutes

**Empty state:**
- If no events: "No appointments today" with link to create event or view month calendar

**Mobile optimizations:**
- Full-width cards, large touch targets (min 44px)
- Swipe left/right to change days
- Pull-to-refresh to recalculate travel times
- Bottom action bar: "Add Event" FAB (floating action button)
- Sticky header that doesn't scroll away

### 6. Month Calendar Integration

Update the existing `/calendar` month view page:
- Add a view toggle in the header: "Month" | "Day" (or "Agenda")
- Clicking any day in the month grid navigates to `/calendar/day?date=YYYY-MM-DD`
- On day cells that have events with travel conflicts (red status), show a small warning indicator

### 7. Auto-Geocode on Event Create/Edit

Update the existing calendar event creation and appointment creation flows:
- When a user enters a location/address field, auto-geocode it on blur
- Store latitude/longitude on the record
- After saving an event with a location, trigger travel block recalculation for that event's date
- Add this to existing tRPC procedures: `calendar.create`, `calendar.update`, `scheduler.createAppointment`, `scheduler.updateAppointment` (or whatever they're called — check the existing router names)

### 8. Google Maps Deep Link Utility — `src/lib/maps-links.ts`

```typescript
// Generate platform-aware map links
export function getDirectionsUrl(
  origin: { lat: number; lng: number } | string,
  destination: { lat: number; lng: number } | string,
  mode: 'driving' | 'transit' | 'walking' = 'driving'
): string {
  // Detect iOS vs Android vs desktop
  // iOS: maps://
  // Android: geo: intent or google maps URL
  // Desktop: https://www.google.com/maps/dir/
  // Include travelmode param
}
```

### 9. Settings Page — Travel Time Section

Add a "Travel Time" section to the existing settings page (wherever scheduler/calendar settings live):

- **Office/Home Address** — text input with autocomplete (if Google Places JS is available) or plain text
- **Default Travel Mode** — radio group: Driving / Transit / Walking
- **Buffer Time** — number input (minutes) — "Extra time for parking, walking to building, etc."
- **Show Travel Blocks** — toggle on/off
- **Calculate Return Home** — toggle — "Show travel time back home after last appointment"

### 10. Sidebar Navigation Update

If `/calendar/day` isn't already accessible from the sidebar, add it:
- Under the existing Calendar nav item, add a child: "Daily Agenda" → `/calendar/day`

### 11. Environment Variables

Add to `.env` / `.env.local`:
```
GOOGLE_MAPS_API_KEY=...
```

This key needs these APIs enabled in Google Cloud Console:
- Geocoding API
- Distance Matrix API
- (Optional) Places API for address autocomplete

If the project already has a Google Maps key for other features, reuse it.

## Important implementation rules:
- Use existing shadcn components from `src/components/ui/` — do not create custom equivalents
- Follow existing tRPC patterns (check `src/lib/trpc.ts`)
- Match the app's existing styling and layout wrappers
- The day view must be mobile-first — design for phone screens, scale up for desktop
- Cache travel calculations in TravelBlock records — don't re-call Google Maps on every page load. Only recalculate if blocks are > 2 hours old or user forces refresh
- Handle missing locations gracefully — if an event has no address, skip the travel block for that gap and show a subtle "No location set" note
- Handle Google Maps API errors (rate limits, invalid addresses) with toast errors, never crash the page
- All travel time calculations happen server-side in the tRPC layer, not client-side
