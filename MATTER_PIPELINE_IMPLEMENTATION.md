Matter pipeline implementation · MDCopyMatter Pipeline — Implementation Spec for Claude Code

Overview

Add a Matter Pipeline feature to the existing Matters page. This adds a Kanban-style visual board as a toggleable view alongside the existing table, allowing attorneys to track matters through intake stages. Matters can be dragged between pipeline stages with quick actions available on each card.

Tech Stack (existing — no changes)



Next.js 14 (App Router) + TypeScript

Prisma + PostgreSQL (Neon) — schema at apps/web/prisma/schema.prisma

tRPC v10 — routers at apps/web/src/server/routers/

Tailwind CSS + Radix UI + shadcn-style components

Deployed on Vercel (Root Directory: apps/web)





1\. Prisma Schema Changes

A. Add pipeline stage field to Matter model

Add a new field pipelineStage to the existing Matter model in apps/web/prisma/schema.prisma:

prismamodel Matter {

&nbsp; id            String          @id @default(cuid())

&nbsp; clientId      String

&nbsp; client        Client          @relation(fields: \[clientId], references: \[id], onDelete: Cascade)

&nbsp; name          String

&nbsp; description   String?

&nbsp; matterNumber  String          @unique

&nbsp; status        MatterStatus    @default(OPEN)

&nbsp; pipelineStage PipelineStage   @default(NEW)        // NEW FIELD

&nbsp; practiceArea  String?

&nbsp; openDate      DateTime        @default(now())

&nbsp; closeDate     DateTime?

&nbsp; createdAt     DateTime        @default(now())

&nbsp; updatedAt     DateTime        @updatedAt

&nbsp; timeEntries   TimeEntry\[]

&nbsp; documents     Document\[]

&nbsp; events        CalendarEvent\[]

&nbsp; invoices      Invoice\[]

&nbsp; trustLedgers  TrustLedger\[]

&nbsp; tasks         Task\[]



&nbsp; @@index(\[clientId])

&nbsp; @@index(\[pipelineStage])                            // NEW INDEX

}

B. Add PipelineStage enum

Add this enum (place it near the existing MatterStatus enum):

prismaenum PipelineStage {

&nbsp; NEW

&nbsp; CONSULTATION

&nbsp; CONFLICT\_CHECK

&nbsp; RETAINER\_SENT

&nbsp; RETAINED

&nbsp; ACTIVE

}

C. Add MatterActivity model for tracking pipeline changes

prismamodel MatterActivity {

&nbsp; id          String              @id @default(cuid())

&nbsp; matterId    String

&nbsp; matter      Matter              @relation(fields: \[matterId], references: \[id], onDelete: Cascade)

&nbsp; 

&nbsp; type        MatterActivityType

&nbsp; description String              @db.Text

&nbsp; metadata    String?             @db.Text  // JSON for extra data (e.g., { from: "NEW", to: "CONSULTATION" })

&nbsp; 

&nbsp; createdAt   DateTime            @default(now())

&nbsp; 

&nbsp; @@index(\[matterId])

&nbsp; @@index(\[createdAt])

}



enum MatterActivityType {

&nbsp; STAGE\_CHANGED

&nbsp; STATUS\_CHANGED

&nbsp; NOTE\_ADDED

&nbsp; CONSULTATION\_SCHEDULED

&nbsp; RETAINER\_SENT

&nbsp; TIME\_LOGGED

&nbsp; LEAD\_CONVERTED

&nbsp; CREATED

}

Also add the activities relation to the Matter model:

prisma  activities    MatterActivity\[]

After adding, run:

bashnpx prisma db push



2\. tRPC Router Updates

A. Update apps/web/src/server/routers/matters.ts

Add these new procedures to the existing mattersRouter:



updatePipelineStage — Change a matter's pipeline stage. Creates a MatterActivity entry with type STAGE\_CHANGED and metadata recording the from/to stages. Input: { id: string, stage: PipelineStage }. Auto-update the Matter's status field based on stage:



NEW, CONSULTATION, CONFLICT\_CHECK, RETAINER\_SENT → status stays OPEN (or PENDING)

RETAINED, ACTIVE → status = OPEN

This keeps backward compatibility with the existing status system





getByPipelineStage — Get all non-closed matters grouped by pipeline stage. Returns { \[stage]: Matter\[] }. Include client name, practice area, time entry count, and document count. Exclude CLOSED matters. Support optional search filter.

getPipelineStats — Return count of matters in each pipeline stage (for column headers). Exclude CLOSED matters.

getActivities — Get activity log for a matter. Input: { matterId: string, limit?: number }. Returns activities in reverse chronological order.

logActivity — Create a MatterActivity entry manually. Input: { matterId: string, type: MatterActivityType, description: string, metadata?: string }

convertLeadToMatter — Create a matter from a Lead. Input: { leadId: string, clientId: string, name: string, practiceArea?: string }. Create the matter with pipelineStage = NEW, create a MatterActivity with type LEAD\_CONVERTED. Update the Lead's matterId and set status to CONVERTED.



B. Update the existing matters.list procedure

Add pipelineStage filter option to the existing list input schema:

typescriptpipelineStage: z.nativeEnum(PipelineStage).optional(),

And add it to the where clause.

C. Update the existing matters.create procedure

Accept an optional pipelineStage field (default to NEW). Create a MatterActivity with type CREATED when a new matter is created.



3\. Page Changes

A. Replace apps/web/src/app/matters/page.tsx — Matters Page with Pipeline Toggle

The existing matters page gets a major upgrade. Keep ALL existing table functionality, but add a Kanban view toggle.

Header Section (updated):



Title: "Matters" (same)

Subtitle: "Manage your legal matters and cases" (same)

"New Matter" button (same)

NEW: View toggle — two icon buttons: Table icon (list view) and Kanban icon (board view)

Existing filters (search, status) persist across both views

NEW: Pipeline stage filter dropdown (only visible when in table view, since kanban IS the stage filter)



Table View (existing, enhanced):



Everything currently there stays

Add a "Pipeline Stage" column showing a colored badge for the stage

Add pipeline stage to the filter options



Kanban View (new):



6 columns: NEW | CONSULTATION | CONFLICT CHECK | RETAINER SENT | RETAINED | ACTIVE

Each column header shows: stage name + count badge

Column styling: subtle colored top border for each stage



NEW: blue

CONSULTATION: purple

CONFLICT\_CHECK: amber

RETAINER\_SENT: orange

RETAINED: emerald

ACTIVE: green







Kanban Cards:

Each card shows:



Matter name (bold, truncated)

Matter number (mono, small, gray)

Client name (small)

Practice area badge (if set)

Time ago (when created/updated)

Priority/stage indicator dot



Card Quick Actions (dropdown menu on each card, triggered by ⋯ button):



"View Details" → links to /matters/\[id]

"Schedule Consultation" → links to /calendar/new?matterId={id}\&title=Consultation: {clientName}

"Send Retainer" → for now, just changes stage to RETAINER\_SENT and logs activity. Add a // TODO: integrate with document generation comment

"Log Time" → links to /time/new?matterId={id}

"Close Matter" → sets status to CLOSED (removes from kanban)



Drag and Drop:



Use HTML5 native drag and drop (no external libraries)

Each card has draggable="true"

Each column is a drop zone with onDragOver and onDrop handlers

On drop: call matters.updatePipelineStage with the new stage

Optimistic UI update: move the card immediately, revert if API call fails

Visual feedback: column highlights when a card is dragged over it

Cards get a slight opacity/scale when being dragged



Stage Transitions (visual cues):

When dragging, show a blue border/highlight on the target column. On successful drop, briefly flash the card green. On failed drop, shake the card back to original position.

B. Update apps/web/src/app/matters/\[id]/page.tsx — Matter Detail

Add to the existing matter detail page:



A Pipeline Stage indicator/selector near the top (next to the status badge)



Shows current stage as a colored badge

Dropdown to change stage (with the same options as kanban columns)

Changing stage creates a MatterActivity





An Activity Timeline section at the bottom of the page



Shows all MatterActivity entries in reverse chronological order

Each entry: icon based on type, description, timestamp

Type icons:



STAGE\_CHANGED: ArrowRight

CONSULTATION\_SCHEDULED: Calendar

RETAINER\_SENT: FileText

TIME\_LOGGED: Clock

LEAD\_CONVERTED: UserPlus

NOTE\_ADDED: MessageSquare

CREATED: Plus











C. Update apps/web/src/app/matters/new/page.tsx — New Matter Form

Add a "Pipeline Stage" dropdown to the new matter form with the 6 stages. Default to "NEW".



4\. Lead Inbox Integration

Update the existing leads.convertToClient procedure in apps/web/src/server/routers/leads.ts:

When createMatter is true and a matter is created, set pipelineStage: "NEW" on the matter and create a MatterActivity:

typescriptif (input.createMatter) {

&nbsp; const matter = await ctx.db.matter.create({

&nbsp;   data: {

&nbsp;     clientId: client.id,

&nbsp;     name: `${lead.practiceArea || "New Matter"} - ${lead.name}`,

&nbsp;     matterNumber: `${year}-${random}`,

&nbsp;     practiceArea: lead.practiceArea,

&nbsp;     pipelineStage: "NEW",  // ADD THIS

&nbsp;   },

&nbsp; });

&nbsp; 

&nbsp; // ADD THIS: Create activity

&nbsp; await ctx.db.matterActivity.create({

&nbsp;   data: {

&nbsp;     matterId: matter.id,

&nbsp;     type: "LEAD\_CONVERTED",

&nbsp;     description: `Matter created from lead: ${lead.name}`,

&nbsp;   },

&nbsp; });

&nbsp; 

&nbsp; updateData.matterId = matter.id;

}



5\. File Summary

Files to modify:

apps/web/prisma/schema.prisma                     # Add PipelineStage enum, pipelineStage field, MatterActivity model

apps/web/src/server/routers/matters.ts             # Add pipeline procedures, update existing ones

apps/web/src/server/routers/leads.ts               # Update convertToClient to set pipelineStage

apps/web/src/app/matters/page.tsx                  # Major update: add kanban view toggle

apps/web/src/app/matters/\[id]/page.tsx             # Add pipeline stage selector + activity timeline

apps/web/src/app/matters/new/page.tsx              # Add pipeline stage dropdown

No new files needed — this feature enhances existing files.



6\. Implementation Order



Schema — Add PipelineStage enum, pipelineStage field on Matter, MatterActivity model. Run prisma db push

Matters router — Add new procedures (updatePipelineStage, getByPipelineStage, getPipelineStats, getActivities, logActivity, convertLeadToMatter). Update existing list/create procedures

Matters page — Rebuild with view toggle, keeping existing table and adding kanban. This is the biggest piece

Matter detail page — Add pipeline stage selector and activity timeline

New matter form — Add pipeline stage dropdown

Leads integration — Update convertToClient to set pipelineStage and create MatterActivity





7\. Key Implementation Notes

View State Persistence

Store the current view preference (table vs kanban) in localStorage so it persists across page loads. Default to kanban view.

Kanban Performance

Load all non-closed matters at once for the kanban (they need to be in all columns). Don't paginate the kanban — it should show all active matters. The table view can keep pagination.

Drag and Drop Implementation

Keep it simple with HTML5 native drag/drop. No need for react-beautiful-dnd or similar libraries. The pattern:

typescript// On card

<div

&nbsp; draggable

&nbsp; onDragStart={(e) => {

&nbsp;   e.dataTransfer.setData("matterId", matter.id);

&nbsp;   e.dataTransfer.effectAllowed = "move";

&nbsp; }}

&nbsp; className={cn("cursor-grab active:cursor-grabbing", isDragging \&\& "opacity-50")}

>



// On column

<div

&nbsp; onDragOver={(e) => {

&nbsp;   e.preventDefault();

&nbsp;   e.dataTransfer.dropEffect = "move";

&nbsp;   setDragOverColumn(stage);

&nbsp; }}

&nbsp; onDragLeave={() => setDragOverColumn(null)}

&nbsp; onDrop={(e) => {

&nbsp;   const matterId = e.dataTransfer.getData("matterId");

&nbsp;   handleStageDrop(matterId, stage);

&nbsp;   setDragOverColumn(null);

&nbsp; }}

&nbsp; className={cn(dragOverColumn === stage \&\& "ring-2 ring-blue-400 bg-blue-50/50")}

>

Closed Matters

CLOSED matters don't appear on the kanban board at all. They're only visible in the table view with the status filter set to "Closed". When a matter's status is set to CLOSED, it drops off the board.

Mobile Responsiveness

On mobile (< 768px), the kanban board should scroll horizontally. Each column should have a min-width of ~280px. Show a hint that users can scroll.

Stage Colors (use consistently)

typescriptconst stageConfig = {

&nbsp; NEW:            { label: "New",             color: "blue",    border: "border-t-blue-400" },

&nbsp; CONSULTATION:   { label: "Consultation",    color: "purple",  border: "border-t-purple-400" },

&nbsp; CONFLICT\_CHECK: { label: "Conflict Check",  color: "amber",   border: "border-t-amber-400" },

&nbsp; RETAINER\_SENT:  { label: "Retainer Sent",   color: "orange",  border: "border-t-orange-400" },

&nbsp; RETAINED:       { label: "Retained",        color: "emerald", border: "border-t-emerald-400" },

&nbsp; ACTIVE:         { label: "Active",          color: "green",   border: "border-t-green-400" },

};



8\. Testing Checklist

After implementation, verify:



&nbsp;Matters page loads with a view toggle (table/kanban)

&nbsp;Table view shows all existing data plus a Pipeline Stage column

&nbsp;Kanban view shows 6 columns with correct stage names and counts

&nbsp;Matters appear as cards in their correct pipeline stage column

&nbsp;Cards can be dragged between columns

&nbsp;Dropping a card updates the pipeline stage in the database

&nbsp;MatterActivity is created on every stage change

&nbsp;Card quick actions work: View Details, Schedule Consultation, Send Retainer, Log Time, Close Matter

&nbsp;"Send Retainer" changes stage to RETAINER\_SENT

&nbsp;"Close Matter" removes the card from the kanban

&nbsp;Closed matters only appear in table view

&nbsp;Matter detail page shows pipeline stage selector

&nbsp;Matter detail page shows activity timeline

&nbsp;New matter form includes pipeline stage dropdown

&nbsp;Converting a lead to matter (from Lead Inbox) sets pipelineStage to NEW

&nbsp;View preference (table/kanban) persists across page loads

&nbsp;Kanban scrolls horizontally on mobile

&nbsp;Search filter works in both views

