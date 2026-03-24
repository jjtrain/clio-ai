# Docketing Module — Implementation Spec for Claude Code

## Overview

Add a **Docketing Module** to Clio AI that provides court deadline calculation, PACER/ECF filing monitoring, trademark/IP deadline tracking, and an AI docketing assistant chat. This integrates with three external APIs: LawToolBox (court rules deadlines), CourtDrive (PACER/ECF filings), and USPTO TSDR (trademark status/deadlines).

## Tech Stack (existing)

- Next.js 14 (App Router) + TypeScript
- Prisma + PostgreSQL (Neon) — schema at `apps/web/prisma/schema.prisma`
- tRPC v10 — routers at `apps/web/src/server/routers/`
- Tailwind CSS + Radix UI + shadcn-style components
- NextAuth for auth
- Anthropic API for AI chat (already integrated — see `src/lib/ai-chat.ts`)
- Deployed on Vercel (Root Directory: `apps/web`)

---

## 1. Prisma Schema Additions

Add these models to `apps/web/prisma/schema.prisma`:

```prisma
// ============================================
// DOCKETING MODULE
// ============================================

model Deadline {
  id              String           @id @default(cuid())
  matterId        String
  matter          Matter           @relation(fields: [matterId], references: [id], onDelete: Cascade)
  
  title           String           // e.g., "Opposition to Motion for Summary Judgment"
  description     String?          @db.Text
  dueDate         DateTime
  ruleAuthority   String?          // e.g., "CPLR 3212(a)", "FRCP 56(a)", "37 CFR 2.62(a)"
  consequenceOfMissing String?     @db.Text  // What happens if missed
  
  // Trigger info
  triggerDate     DateTime?        // The date this deadline was calculated from
  triggerType     String?          // e.g., "trial_date", "complaint_filed", "office_action_issued"
  
  // Source & tracking
  source          DeadlineSource   @default(MANUAL)
  externalId      String?          // ID from LawToolBox, CourtDrive, or USPTO
  jurisdiction    String?          // e.g., "Nassau County Supreme Court", "EDNY", "USPTO"
  methodOfService String?          // e.g., "personal", "mail", "electronic" — affects calculation
  
  // Status
  priority        DeadlinePriority @default(SCHEDULED)
  status          DeadlineStatus   @default(ACTIVE)
  
  // Calendar link
  calendarEventId String?          // ID of linked calendar event (Google Calendar, etc.)
  
  // Notes
  notes           String?          @db.Text
  
  // Audit
  createdBy       String?
  completedAt     DateTime?
  dismissedAt     DateTime?
  dismissReason   String?
  overriddenByOrderRef String?     // If a court order changed this deadline
  
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  @@index([matterId, dueDate])
  @@index([dueDate, status])
  @@index([status, priority])
}

model CourtCase {
  id              String           @id @default(cuid())
  matterId        String
  matter          Matter           @relation(fields: [matterId], references: [id], onDelete: Cascade)
  
  courtName       String           // e.g., "U.S. District Court, Eastern District of New York"
  caseNumber      String           // e.g., "1:24-cv-01234"
  caseName        String?          // e.g., "Friedland v. Friedland"
  judge           String?
  
  // Monitoring
  isMonitored     Boolean          @default(true)
  lastChecked     DateTime?
  courtDriveId    String?          // External case ID in CourtDrive
  
  // Filings
  filings         CourtFiling[]
  
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  @@unique([courtName, caseNumber])
  @@index([matterId])
  @@index([isMonitored])
}

model CourtFiling {
  id              String           @id @default(cuid())
  courtCaseId     String
  courtCase       CourtCase        @relation(fields: [courtCaseId], references: [id], onDelete: Cascade)
  
  docketEntryNum  Int?
  description     String           @db.Text
  filedDate       DateTime
  
  // Document
  documentUrl     String?          // URL to PDF (CourtDrive or PACER)
  documentStored  Boolean          @default(false)  // Whether we saved a copy locally
  storedDocumentId String?         // Link to our document storage
  
  // Deadline implications
  hasImpliedDeadline Boolean       @default(false)
  impliedDeadlineId  String?       // If we created a Deadline from this filing
  
  // Source
  externalId      String?          // CourtDrive filing ID
  isNew           Boolean          @default(true)   // Not yet reviewed by user
  
  createdAt       DateTime         @default(now())

  @@index([courtCaseId, filedDate])
  @@index([isNew])
}

model TrademarkDocket {
  id                  String       @id @default(cuid())
  matterId            String?
  matter              Matter?      @relation(fields: [matterId], references: [id], onDelete: SetNull)
  
  // Mark info
  markName            String       // e.g., "FOOT RX", "TRIBE TRAINING CLUB"
  serialNumber        String       @unique
  registrationNumber  String?
  
  // Current status from USPTO
  currentStatus       String?      // e.g., "REGISTERED", "NOTICE OF ALLOWANCE - ISSUED"
  statusDate          DateTime?
  ownerName           String?
  filingDate          DateTime?
  registrationDate    DateTime?
  
  // Next deadline
  nextDeadlineType    String?      // e.g., "Section 8", "Statement of Use", "Office Action Response"
  nextDeadlineDate    DateTime?
  
  // Monitoring
  autoMonitor         Boolean      @default(true)
  lastChecked         DateTime     @default(now())
  lastStatusChange    DateTime?
  
  // Prosecution history cache (JSON array of events)
  prosecutionHistory  Json?        // [{date, action, description}]
  
  createdAt           DateTime     @default(now())
  updatedAt           DateTime     @updatedAt

  @@index([serialNumber])
  @@index([nextDeadlineDate])
  @@index([autoMonitor])
  @@index([matterId])
}

model DocketingAuditLog {
  id              String           @id @default(cuid())
  matterId        String?
  action          String           // e.g., "DEADLINE_CALCULATED", "FILING_DETECTED", "STATUS_POLLED"
  source          String           // e.g., "LAWTOOLBOX", "COURTDRIVE", "USPTO", "MANUAL"
  inputData       Json?            // What was sent to the API
  outputData      Json?            // What came back
  userId          String?          // Who triggered it
  createdAt       DateTime         @default(now())

  @@index([matterId, createdAt])
  @@index([source, createdAt])
}

enum DeadlineSource {
  LAWTOOLBOX
  COURTDRIVE
  USPTO
  MANUAL
  DOCUMENT_PARSED
}

enum DeadlinePriority {
  CRITICAL      // Within 14 days or past due
  UPCOMING      // Within 30 days
  SCHEDULED     // More than 30 days out
}

enum DeadlineStatus {
  ACTIVE
  COMPLETED
  DISMISSED
  MISSED
  OVERRIDDEN    // Superseded by court order
}
```

Also add these relation fields to the existing `Matter` model:

```prisma
// Add to existing Matter model:
  deadlines         Deadline[]
  courtCases        CourtCase[]
  trademarkDockets  TrademarkDocket[]
```

---

## 2. Environment Variables

Add to `.env` (and to Vercel environment variables):

```env
# LawToolBox (court rules deadline calculation)
LAWTOOLBOX_CLIENT_ID=
LAWTOOLBOX_CLIENT_SECRET=
LAWTOOLBOX_API_URL=https://api.lawtoolbox.com

# CourtDrive (PACER/ECF monitoring)
COURTDRIVE_API_KEY=
COURTDRIVE_API_URL=https://api.courtdrive.com

# USPTO TSDR (trademark status)
USPTO_API_KEY=
USPTO_TSDR_BASE_URL=https://tsdrapi.uspto.gov
```

**NOTE:** These APIs may not have credentials yet. Build the integration layer with these env vars but make every external API call gracefully handle missing credentials — if the env var is not set, return a clear error message like "LawToolBox integration is not configured. Add LAWTOOLBOX_CLIENT_ID and LAWTOOLBOX_CLIENT_SECRET to your environment variables." Do NOT throw or crash.

---

## 3. Service Layer

Create `apps/web/src/lib/docketing/` with these files:

### `apps/web/src/lib/docketing/types.ts`

Shared TypeScript types used across all docketing services:

```typescript
export interface CalculatedDeadline {
  title: string;
  description?: string;
  dueDate: Date;
  ruleAuthority?: string;
  triggerDate: Date;
  triggerType: string;
  consequenceOfMissing?: string;
  category?: string; // "discovery", "motions", "trial_prep", "expert"
}

export interface CourtFilingResult {
  docketEntryNum?: number;
  description: string;
  filedDate: Date;
  documentUrl?: string;
  externalId?: string;
}

export interface TrademarkStatus {
  serialNumber: string;
  registrationNumber?: string;
  markName: string;
  currentStatus: string;
  statusDate?: Date;
  ownerName?: string;
  filingDate?: Date;
  registrationDate?: Date;
  nextDeadlineType?: string;
  nextDeadlineDate?: Date;
  prosecutionHistory: Array<{
    date: string;
    action: string;
    description: string;
  }>;
}

export interface DeadlineDigest {
  critical: Array<{ deadline: any; matter: any }>;  // due within 14 days
  upcoming: Array<{ deadline: any; matter: any }>;   // due within 30 days
  thisWeek: Array<{ deadline: any; matter: any }>;
  today: Array<{ deadline: any; matter: any }>;
}
```

### `apps/web/src/lib/docketing/lawtoolbox.ts`

LawToolBox API client for court rules deadline calculation.

```typescript
// LawToolBox API Integration
// Docs: https://lawtoolbox.com/partners-surface-lawtoolbox-deadlines-insidetheir-products-through-api-integration/
//
// Flow:
// 1. Authenticate with OAuth (client credentials → bearer token)
// 2. List available rulesets (jurisdictions)
// 3. For a given ruleset, retrieve available trigger types
// 4. User selects trigger type + enters trigger date + method of service
// 5. API returns calculated deadlines
// 6. User selects which deadlines to save to their calendar
//
// Key concepts:
// - "Ruleset" = a jurisdiction's rules of procedure (e.g., "Nassau County Supreme Court")
// - "Trigger" = a case event that starts deadline chains (e.g., "Date Trial Commences")
// - "Repeat calculators" = for events that happen multiple times (motions, discovery sets)
// - Method of service affects deadline computation (personal vs mail vs electronic)
//
// Implementation:
// - Cache the OAuth token and refresh on expiry
// - Cache the ruleset list (changes infrequently)
// - All deadline calculations should be logged to DocketingAuditLog
// - If LAWTOOLBOX_CLIENT_ID or LAWTOOLBOX_CLIENT_SECRET is not set, all methods
//   should return { success: false, error: "LawToolBox is not configured..." }

export class LawToolBoxClient {
  private baseUrl: string;
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor() {
    this.baseUrl = process.env.LAWTOOLBOX_API_URL || 'https://api.lawtoolbox.com';
    this.clientId = process.env.LAWTOOLBOX_CLIENT_ID || '';
    this.clientSecret = process.env.LAWTOOLBOX_CLIENT_SECRET || '';
  }

  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret);
  }

  // Authenticate and get/refresh OAuth token
  async authenticate(): Promise<void> { /* implement */ }

  // Get list of available rulesets (jurisdictions)
  async getRulesets(): Promise<Array<{ id: string; name: string; jurisdiction: string }>> { /* implement */ }

  // Get trigger types for a specific ruleset
  async getTriggers(rulesetId: string): Promise<Array<{ id: string; name: string; description: string }>> { /* implement */ }

  // Calculate deadlines from a trigger date
  async calculateDeadlines(params: {
    rulesetId: string;
    triggerId: string;
    triggerDate: Date;
    methodOfService?: string;
  }): Promise<CalculatedDeadline[]> { /* implement */ }

  // Get repeat calculator options for a ruleset
  async getRepeatCalculators(rulesetId: string): Promise<Array<{ id: string; name: string; category: string }>> { /* implement */ }
}
```

### `apps/web/src/lib/docketing/courtdrive.ts`

CourtDrive API client for PACER/ECF integration.

```typescript
// CourtDrive API Integration
// Docs: https://www.courtdrive.com/ (API section)
//
// Capabilities:
// - Search federal/bankruptcy court dockets nationwide via PACER
// - Monitor cases for new ECF filings
// - Download court documents (PDFs)
// - Extract calendar dates from docket entries
// - Party name search across courts
//
// Key notes:
// - CourtDrive integrates a complete PACER gateway — no separate PACER account needed
// - PACER queries may incur fees (standard PACER pricing)
// - ECF "free-look" PDFs are captured automatically for monitored cases
// - PDFs can be synced to matter document storage
// - Calendar dates are extracted from ECF notices
//
// If COURTDRIVE_API_KEY is not set, all methods should return
// { success: false, error: "CourtDrive is not configured..." }

export class CourtDriveClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = process.env.COURTDRIVE_API_URL || 'https://api.courtdrive.com';
    this.apiKey = process.env.COURTDRIVE_API_KEY || '';
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  // Search for a case by court + case number
  async searchCase(court: string, caseNumber: string): Promise<any> { /* implement */ }

  // Search by party name across courts
  async searchByParty(partyName: string, court?: string): Promise<any[]> { /* implement */ }

  // Get docket entries for a specific case
  async getDocket(caseId: string): Promise<CourtFilingResult[]> { /* implement */ }

  // Get new filings since last check for a monitored case
  async getNewFilings(caseId: string, since: Date): Promise<CourtFilingResult[]> { /* implement */ }

  // Download a court document PDF
  async downloadDocument(documentId: string): Promise<Buffer> { /* implement */ }

  // Set up monitoring for a case
  async monitorCase(court: string, caseNumber: string): Promise<{ courtDriveId: string }> { /* implement */ }

  // Stop monitoring a case
  async unmonitorCase(courtDriveId: string): Promise<void> { /* implement */ }
}
```

### `apps/web/src/lib/docketing/uspto-tsdr.ts`

USPTO TSDR API client for trademark status and deadlines.

```typescript
// USPTO TSDR API Integration
// Docs: https://developer.uspto.gov/api-catalog/tsdr-data-api
//
// Endpoints:
// - Status (HTML): GET https://tsdrapi.uspto.gov/ts/cd/casestatus/sn{serialNumber}/content
// - Status (XML/ST96): GET https://tsdrapi.uspto.gov/ts/cd/casestatus/sn{serialNumber}/info.json
//   (or parse the XML from the zip bundle for full structured data)
// - Mark image: GET https://tsdrapi.uspto.gov/ts/cd/rawImage/{serialNumber}
// - Bundle (all docs): GET https://tsdrapi.uspto.gov/ts/cd/casedocs/bundle.pdf?sn={serialNumber}
// - ZIP download: GET https://tsdrapi.uspto.gov/ts/cd/casedocs/sn{serialNumber}/zip-bundle-download?case=true
//
// Auth: API key appended as query param or header (register at account.uspto.gov/api-manager)
// Rate limits: 60 req/key/min general; 4 req/key/min for PDF/ZIP downloads
//
// Trademark deadline rules to implement:
// - Office action response: 3 months from issue (extendable to 6 months with fee)
// - Statement of Use after NOA: 6 months (extendable up to 36 months total)
// - Section 8 (Declaration of Use): between year 5-6 after registration, then every 10 years
// - Section 9 (Renewal): every 10 years from registration
// - Section 15 (Incontestability): after 5 consecutive years of use post-registration
// - Grace periods: 6 months after Section 8/9 deadlines with surcharge
// - TTAB answer to opposition/cancellation: 40 days from institution
//
// If USPTO_API_KEY is not set, still attempt requests (some endpoints work without key)
// but note the limitation in responses

export class UsptoTsdrClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = process.env.USPTO_TSDR_BASE_URL || 'https://tsdrapi.uspto.gov';
    this.apiKey = process.env.USPTO_API_KEY || '';
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  // Get trademark status by serial number
  async getStatusBySerial(serialNumber: string): Promise<TrademarkStatus> { /* implement */ }

  // Get trademark status by registration number
  async getStatusByRegistration(regNumber: string): Promise<TrademarkStatus> { /* implement */ }

  // Get mark image
  async getMarkImage(serialNumber: string): Promise<Buffer> { /* implement */ }

  // Calculate next maintenance deadline from registration data
  calculateMaintenanceDeadlines(registrationDate: Date, currentStatus: string): Array<{
    type: string;      // "Section 8", "Section 9", "Section 15"
    dueDate: Date;
    gracePeriodEnd: Date;
    description: string;
  }> { /* implement based on the rules in the comment above */ }

  // Calculate response deadline from an office action
  calculateOfficeActionDeadline(issueDate: Date): {
    initialDeadline: Date;      // 3 months
    extendedDeadline: Date;     // 6 months (with fee)
    description: string;
  } { /* implement */ }

  // Calculate SOU deadline from NOA date
  calculateSouDeadline(noaDate: Date): {
    initialDeadline: Date;      // 6 months
    maxExtensionDate: Date;     // 36 months total
    description: string;
  } { /* implement */ }
}
```

### `apps/web/src/lib/docketing/deadline-engine.ts`

Orchestrator that ties all three services together and handles cross-cutting concerns.

```typescript
// Deadline Engine — orchestrates LawToolBox, CourtDrive, and USPTO TSDR
//
// This is the main entry point for all docketing operations.
// It coordinates between the three external services and the internal database.
//
// Key responsibilities:
// 1. Calculate deadlines (LawToolBox) and save to DB
// 2. Check for new court filings (CourtDrive) and flag implied deadlines
// 3. Poll trademark status (USPTO) and calculate maintenance deadlines
// 4. Provide cross-matter deadline digest for dashboard
// 5. Re-calculate priorities based on proximity to due date
// 6. Audit log every external API interaction
//
// Priority calculation:
// - CRITICAL: due within 14 days OR past due
// - UPCOMING: due within 30 days
// - SCHEDULED: more than 30 days out

import { prisma } from '@/lib/prisma';  // adjust import to match your project
import { LawToolBoxClient } from './lawtoolbox';
import { CourtDriveClient } from './courtdrive';
import { UsptoTsdrClient } from './uspto-tsdr';

export class DeadlineEngine {
  private lawToolBox: LawToolBoxClient;
  private courtDrive: CourtDriveClient;
  private uspto: UsptoTsdrClient;

  constructor() {
    this.lawToolBox = new LawToolBoxClient();
    this.courtDrive = new CourtDriveClient();
    this.uspto = new UsptoTsdrClient();
  }

  // Get integration status for dashboard display
  getIntegrationStatus(): {
    lawToolBox: { configured: boolean };
    courtDrive: { configured: boolean };
    uspto: { configured: boolean };
  } {
    return {
      lawToolBox: { configured: this.lawToolBox.isConfigured() },
      courtDrive: { configured: this.courtDrive.isConfigured() },
      uspto: { configured: this.uspto.isConfigured() },
    };
  }

  // ── Deadline Calculation (LawToolBox) ──

  async calculateAndSaveDeadlines(params: {
    matterId: string;
    rulesetId: string;
    triggerId: string;
    triggerDate: Date;
    methodOfService?: string;
    userId?: string;
  }): Promise<{ deadlines: any[]; error?: string }> {
    // 1. Call LawToolBox to calculate
    // 2. Save each deadline to Deadline table
    // 3. Log to DocketingAuditLog
    // 4. Return saved deadlines
  }

  // ── Court Filing Monitoring (CourtDrive) ──

  async checkForNewFilings(courtCaseId: string): Promise<{ newFilings: any[]; error?: string }> {
    // 1. Get CourtCase from DB
    // 2. Call CourtDrive for filings since lastChecked
    // 3. Save new CourtFiling records
    // 4. For each filing, analyze if it implies a deadline
    // 5. Update CourtCase.lastChecked
    // 6. Log to DocketingAuditLog
  }

  async analyzeFilingForDeadlines(filing: any, courtCase: any): Promise<any | null> {
    // Use pattern matching on filing description to detect deadline-triggering events:
    // - "Motion for Summary Judgment" → opposition deadline
    // - "Notice of Discovery" → response deadline
    // - "Order Setting Trial" → trial prep deadline chain
    // If detected, optionally cross-reference with LawToolBox for exact calculation
  }

  // ── Trademark Monitoring (USPTO) ──

  async refreshTrademarkStatus(trademarkDocketId: string): Promise<{ status: any; error?: string }> {
    // 1. Get TrademarkDocket from DB
    // 2. Call USPTO TSDR for current status
    // 3. Calculate maintenance deadlines
    // 4. Update TrademarkDocket record
    // 5. If status changed, create/update Deadline records
    // 6. Log to DocketingAuditLog
  }

  async pollAllMonitoredTrademarks(): Promise<{ updated: number; errors: number }> {
    // Get all TrademarkDocket where autoMonitor=true
    // Refresh each one (respect rate limits — batch with delays)
  }

  // ── Cross-Matter Dashboard ──

  async getDeadlineDigest(userId: string): Promise<DeadlineDigest> {
    // Query Deadline table for all ACTIVE deadlines
    // Filter to matters assigned to this user (or all if admin)
    // Group by priority/timeframe
    // Return structured digest
  }

  async recalculatePriorities(): Promise<{ updated: number }> {
    // For all ACTIVE deadlines:
    // - Due within 14 days or past due → CRITICAL
    // - Due within 30 days → UPCOMING
    // - Everything else → SCHEDULED
    // Update in batch
  }

  // ── Document Parsing ──

  async parseDocumentForDates(params: {
    matterId: string;
    documentText: string;
    documentType?: string; // "scheduling_order", "notice", "order"
  }): Promise<Array<{ date: Date; description: string; isDeadline: boolean }>> {
    // Use Anthropic API to extract dates from document text
    // System prompt should identify:
    // - Dates that are deadlines (things the attorney must do by)
    // - Dates that are informational (hearing dates, filing dates of other parties)
    // - Whether dates override standard procedural deadlines
  }
}
```

---

## 4. tRPC Router

Create `apps/web/src/server/routers/docketing.ts`:

Follow the same patterns as existing routers (use `protectedProcedure`, Zod validation, etc.).

```typescript
// Procedures to implement:

// ── Deadline Management ──

// getDeadlines — List deadlines with filters
// Input: { matterId?: string, status?: DeadlineStatus, priority?: DeadlinePriority, 
//          dateFrom?: Date, dateTo?: Date, page?: number, limit?: number }
// Returns: paginated list of deadlines with matter info

// getUpcomingDeadlines — Dashboard widget data
// Input: { days: number } (default 30)
// Returns: deadlines grouped by priority with matter context

// calculateDeadlines — Trigger LawToolBox calculation
// Input: { matterId: string, jurisdiction: string, triggerType: string, 
//          triggerDate: Date, methodOfService?: string }
// Returns: array of calculated deadlines (NOT yet saved — user picks which to save)

// saveDeadlines — Save selected calculated deadlines
// Input: { matterId: string, deadlines: Array<{ title, dueDate, ruleAuthority, ... }> }
// Returns: saved deadline records

// addManualDeadline — Add a deadline manually
// Input: { matterId: string, title: string, dueDate: Date, description?: string,
//          ruleAuthority?: string, notes?: string }

// updateDeadline — Edit a deadline
// Input: { deadlineId: string, ...fields }

// completeDeadline — Mark as completed
// Input: { deadlineId: string }

// dismissDeadline — Dismiss with reason
// Input: { deadlineId: string, reason: string }

// overrideDeadline — Override due to court order
// Input: { deadlineId: string, newDate: Date, courtOrderRef: string }

// ── Court Case Monitoring ──

// searchCourtCase — Search PACER via CourtDrive
// Input: { court?: string, caseNumber?: string, partyName?: string }
// Returns: search results

// addCourtCase — Add a case to monitor
// Input: { matterId: string, courtName: string, caseNumber: string, caseName?: string }
// Creates CourtCase record and sets up CourtDrive monitoring

// getCourtCases — List monitored cases
// Input: { matterId?: string }

// getCourtFilings — Get filings for a case
// Input: { courtCaseId: string, onlyNew?: boolean }

// markFilingReviewed — Mark a filing as reviewed (isNew = false)
// Input: { filingId: string }

// checkForNewFilings — Manually trigger a filing check
// Input: { courtCaseId: string }

// removeCourtCase — Stop monitoring
// Input: { courtCaseId: string }

// ── Trademark Docket ──

// checkTrademarkStatus — Look up trademark from USPTO
// Input: { serialNumber?: string, registrationNumber?: string }
// Returns: full status + calculated deadlines (not saved yet)

// addTrademarkToMonitor — Add to monitoring
// Input: { matterId?: string, serialNumber: string, markName: string }

// getMonitoredTrademarks — List monitored trademarks
// Input: { matterId?: string }

// refreshTrademarkStatus — Re-poll USPTO
// Input: { trademarkDocketId: string }

// removeTrademarkMonitor — Stop monitoring
// Input: { trademarkDocketId: string }

// ── Integration Status ──

// getIntegrationStatus — Check which APIs are configured
// Returns: { lawToolBox: { configured: boolean }, courtDrive: { configured: boolean }, 
//           uspto: { configured: boolean } }

// ── AI Docketing Chat ──

// askDocketingQuestion — AI-powered docketing assistant
// Input: { question: string, matterId?: string, conversationHistory?: Array<{role, content}> }
// Uses the docketing system prompt (see section 6 below)
// The AI has tool-use access to the other procedures above
```

Register in `apps/web/src/server/routers/_app.ts`:
```typescript
import { docketingRouter } from "./docketing";

export const appRouter = router({
  // ... existing routers
  docketing: docketingRouter,
});
```

---

## 5. Pages & UI

### Navigation

Add to the sidebar (`apps/web/src/components/layout/sidebar.tsx`):
- Icon: `Scale` or `Calendar` from lucide-react
- Label: "Docketing"
- Path: `/docketing`

### Page Structure

```
apps/web/src/app/docketing/
├── page.tsx                    # Docketing Dashboard (main page)
├── deadlines/
│   └── page.tsx                # Full deadlines list with filters
├── court-cases/
│   └── page.tsx                # PACER/ECF monitored cases
├── trademarks/
│   └── page.tsx                # Trademark docket monitor
└── settings/
    └── page.tsx                # API key configuration & integration status
```

### `/docketing/page.tsx` — Dashboard

This is the main landing page. Layout:

**Top Section — Stats Bar:**
- 4 stat cards in a row:
  - 🔴 Critical Deadlines (due within 14 days) — count with red badge
  - 🟡 Upcoming Deadlines (due within 30 days) — count with yellow badge
  - 📄 Unreviewed Filings — count of CourtFiling where isNew=true
  - ⚖️ Monitored Trademarks — count of TrademarkDocket where autoMonitor=true

**Middle Section — Upcoming Deadlines Table:**
- Table columns: Priority (color dot), Due Date, Days Out, Deadline Title, Matter Name, Source (icon), Actions
- Sort by dueDate ascending
- "Calculate Deadlines" button → opens a dialog/sheet for LawToolBox calculation flow
- "Add Manual Deadline" button → simple form dialog
- Clicking a row expands to show: description, rule authority, consequence of missing, notes

**Bottom Section — Two columns side by side:**

Left column: **Recent Court Filings**
- List of latest CourtFiling records, newest first
- Each shows: date, case name, docket #, description, "New" badge if unreviewed
- Click to view details or download document

Right column: **Trademark Status**
- Cards for each monitored trademark showing: mark name, serial #, current status, next deadline
- "Check Status" button on each to refresh from USPTO
- "Add Trademark" button to add new monitoring

**Integration Status Banner:**
- If any API is not configured, show a subtle info banner at the top:
  "Some docketing integrations are not configured. [Go to Settings](/docketing/settings) to connect LawToolBox, CourtDrive, or USPTO."

### `/docketing/deadlines/page.tsx` — Full Deadline List

- Filterable table of all deadlines across all matters
- Filters: Status (Active/Completed/Dismissed/Missed), Priority, Matter, Date Range, Source
- Bulk actions: Complete, Dismiss
- Export to CSV

### `/docketing/court-cases/page.tsx` — Court Case Monitor

- List of all CourtCase records with filing counts and last checked time
- "Add Case" button → dialog with court selector + case number input
- Click a case → expandable panel showing docket entries
- "Check Now" button to manually poll CourtDrive for new filings
- If CourtDrive not configured → show setup instructions

### `/docketing/trademarks/page.tsx` — Trademark Docket

- Card grid or table of all TrademarkDocket records
- Each card shows: mark image (from USPTO), mark name, serial #, status, next deadline with countdown
- "Add Mark" button → dialog: enter serial number → auto-fetch from USPTO → confirm and save
- "Refresh All" button to re-poll all monitored marks
- Click a card → detail panel with full prosecution history timeline
- If USPTO API not configured → still works (some endpoints don't require key) but show note

### `/docketing/settings/page.tsx` — Integration Settings

- Three sections (one per integration): LawToolBox, CourtDrive, USPTO
- Each section shows:
  - Connection status (green check or red X)
  - Input fields for API credentials (masked, save to DB or env)
  - "Test Connection" button that pings the API
  - Brief description of what the integration provides
  - Link to the provider's signup page

---

## 6. AI Docketing System Prompt

Store this as a constant in `apps/web/src/lib/docketing/system-prompt.ts`. It is used when the user interacts with the docketing AI chat (either from the main AI chat or from a docketing-specific chat panel).

```typescript
export function getDocketingSystemPrompt(firmName: string, matterContext?: any): string {
  return `You are ${firmName}'s Docketing Assistant — a specialized AI for court deadline management, filing monitoring, and IP docket tracking inside a legal practice management platform.

## YOUR CAPABILITIES

1. **Court Deadline Calculation** — You can calculate rules-based deadlines from trigger dates using jurisdiction-specific court rules. You know federal rules (FRCP, FRE), state rules, and local rules. When a user tells you about a case event (trial date set, complaint filed, motion filed), you calculate dependent deadlines.

2. **Court Filing Monitoring** — You can check PACER/ECF for new filings on monitored federal cases. When new filings appear, you flag them and identify any implied deadlines.

3. **Trademark/IP Deadlines** — You can check USPTO TSDR for trademark status and calculate maintenance deadlines (Section 8, 9, 15), office action response deadlines, and Statement of Use deadlines.

4. **Cross-Matter Dashboard** — You can report on upcoming deadlines across all the user's matters, filtered by timeframe, priority, or practice area.

## RESPONSE RULES

- Be precise and concise — you are speaking to attorneys and paralegals
- Use proper legal terminology
- When listing deadlines, always include: (a) deadline description, (b) date, (c) rule/authority, (d) consequence of missing
- NEVER provide legal advice or strategic recommendations — you are a docketing tool, not co-counsel
- If you are uncertain about a deadline calculation, say so and recommend manual verification
- Always append this disclaimer when presenting calculated deadlines: "⚠️ Verify all deadlines against applicable court rules, local rules, and any scheduling orders in your case."

## DEADLINE PRESENTATION FORMAT

When presenting deadlines, use this format:

| # | Deadline | Date | Days Out | Authority | Priority |
|---|----------|------|----------|-----------|----------|
| 1 | [Description] | [Date] | [N days] | [Rule] | [🔴/🟡/🟢] |

🔴 = Critical (within 14 days or past due)
🟡 = Upcoming (within 30 days)
🟢 = Scheduled (30+ days)

## FILING ALERT FORMAT

**New Filing Detected**
- Matter: [Name]
- Court: [Court]
- Case No.: [Number]
- Entry #[N]: [Description]
- Filed: [Date]
- ⚠️ Implied Deadline: [If applicable]

## TRADEMARK STATUS FORMAT

**Trademark Status: [MARK NAME]**
- Serial: [Number] | Reg: [Number]
- Status: [Status]
- Owner: [Name]
- Next Deadline: [Type] — [Date] ([N] days)

## ERROR BEHAVIOR

If an API call fails, tell the user clearly:
- LawToolBox error → "I couldn't calculate deadlines for [jurisdiction]. Please verify manually."
- CourtDrive error → "I couldn't retrieve filing data. Check case number and court, or try pacer.uscourts.gov."
- USPTO error → "I couldn't retrieve trademark status. Check tsdr.uspto.gov directly."

## WHAT YOU DO NOT DO
- Provide legal advice or case strategy
- Predict case outcomes
- Draft legal documents
- Access PACER without user confirmation (costs money)
- Modify deadlines without user confirmation
- Assume jurisdiction — always confirm first
${matterContext ? `\n## CURRENT MATTER CONTEXT\n${JSON.stringify(matterContext, null, 2)}` : ''}`;
}
```

---

## 7. Cron Jobs / API Routes for Background Tasks

Create these as Next.js API routes that can be triggered by Vercel Cron:

```
apps/web/src/app/api/cron/
├── check-filings/route.ts          # Check CourtDrive for new ECF filings
├── poll-trademarks/route.ts        # Poll USPTO for trademark status changes
├── recalculate-priorities/route.ts # Update deadline priorities based on proximity
└── deadline-digest/route.ts        # Send daily deadline digest email
```

**Vercel Cron config** — add to `vercel.json`:
```json
{
  "crons": [
    { "path": "/api/cron/check-filings", "schedule": "*/15 * * * *" },
    { "path": "/api/cron/poll-trademarks", "schedule": "0 */6 * * *" },
    { "path": "/api/cron/recalculate-priorities", "schedule": "0 0 * * *" },
    { "path": "/api/cron/deadline-digest", "schedule": "0 12 * * *" }
  ]
}
```

Each cron route should:
1. Verify a CRON_SECRET header (to prevent unauthorized triggers)
2. Call the appropriate DeadlineEngine method
3. Return a JSON summary of what was processed
4. Handle errors gracefully (don't crash the cron)

---

## 8. Testing Checklist

After implementation, verify:
- [ ] Prisma schema migrates successfully (`npx prisma db push`)
- [ ] `/docketing` dashboard loads with stats, deadlines table, filings, and trademarks sections
- [ ] Can add a manual deadline and see it in the table
- [ ] Integration status correctly shows configured/not configured for each API
- [ ] `/docketing/settings` page allows entering API credentials
- [ ] Can add a trademark by serial number (if USPTO key is set, it fetches status; if not, saves with manual data)
- [ ] Can add a court case for monitoring
- [ ] The deadline priority recalculation works (CRITICAL/UPCOMING/SCHEDULED based on date proximity)
- [ ] The AI docketing chat responds intelligently about deadlines and docketing questions
- [ ] Sidebar shows "Docketing" nav item
- [ ] All pages are mobile responsive
- [ ] Graceful error states when APIs are not configured

---

## 9. File Summary

New files to create:
```
apps/web/src/lib/docketing/types.ts
apps/web/src/lib/docketing/lawtoolbox.ts
apps/web/src/lib/docketing/courtdrive.ts
apps/web/src/lib/docketing/uspto-tsdr.ts
apps/web/src/lib/docketing/deadline-engine.ts
apps/web/src/lib/docketing/system-prompt.ts
apps/web/src/server/routers/docketing.ts
apps/web/src/app/docketing/page.tsx
apps/web/src/app/docketing/deadlines/page.tsx
apps/web/src/app/docketing/court-cases/page.tsx
apps/web/src/app/docketing/trademarks/page.tsx
apps/web/src/app/docketing/settings/page.tsx
apps/web/src/app/api/cron/check-filings/route.ts
apps/web/src/app/api/cron/poll-trademarks/route.ts
apps/web/src/app/api/cron/recalculate-priorities/route.ts
apps/web/src/app/api/cron/deadline-digest/route.ts
```

Files to modify:
```
apps/web/prisma/schema.prisma              # Add new models + enums + relations on Matter
apps/web/src/server/routers/_app.ts        # Register docketing router
apps/web/src/components/layout/sidebar.tsx  # Add Docketing nav item
apps/web/vercel.json                       # Add cron jobs (create if doesn't exist)
```
