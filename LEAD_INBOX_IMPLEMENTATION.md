# Lead Inbox + Live Chat — Implementation Spec for Claude Code

## Overview

Add a **Lead Inbox** feature to Clio AI that serves as the central hub for all incoming leads. It includes:

1. **Lead Inbox Dashboard** — Kanban board + table view with toggle, aggregating leads from all sources
2. **Live Chat Widget** — Embeddable chat widget for websites with AI-powered initial qualification, with attorney handoff
3. **Contact Form Widget** — Simple embeddable contact form (lighter than full intake forms)
4. **Manual Lead Entry** — Quick-add leads directly from the dashboard

The Lead Inbox connects to the existing `IntakeFormSubmission` model (which already has `IntakeLeadStatus`) and adds new lead sources.

## Tech Stack (existing)

- Next.js 14 (App Router) + TypeScript
- Prisma + PostgreSQL (Neon) — schema at `apps/web/prisma/schema.prisma`
- tRPC v10 — routers at `apps/web/src/server/routers/`
- Tailwind CSS + Radix UI + shadcn-style components
- NextAuth for auth
- Deployed on Vercel (Root Directory: `apps/web`)

---

## 1. Prisma Schema Additions

Add these models to `apps/web/prisma/schema.prisma`:

```prisma
// ============================================
// LEAD INBOX & LIVE CHAT
// ============================================

// Unified Lead model — all lead sources feed into this
model Lead {
  id              String          @id @default(cuid())
  
  // Contact info
  name            String
  email           String?
  phone           String?
  
  // Lead details
  source          LeadSource      @default(MANUAL)
  status          LeadStatus      @default(NEW)
  priority        LeadPriority    @default(MEDIUM)
  practiceArea    String?
  description     String?         @db.Text
  
  // Internal tracking
  notes           String?         @db.Text    // Internal notes from attorney
  assignedTo      String?                     // User ID if assigned
  
  // Source references
  intakeSubmissionId  String?     @unique     // Link to IntakeFormSubmission if from intake form
  chatSessionId       String?     @unique     // Link to ChatSession if from live chat
  contactFormId       String?                 // Reference if from contact widget
  
  // Conversion tracking
  clientId        String?                     // Link to Client if converted
  matterId        String?                     // Link to Matter if converted
  convertedAt     DateTime?
  
  // Metadata
  ipAddress       String?
  userAgent       String?
  referrer        String?
  
  // Timestamps
  lastContactedAt DateTime?
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  
  // Relations
  chatSession     ChatSession?    @relation
  activities      LeadActivity[]
  
  @@index([status])
  @@index([source])
  @@index([priority])
  @@index([createdAt])
  @@index([assignedTo])
}

enum LeadSource {
  INTAKE_FORM
  LIVE_CHAT
  CONTACT_FORM
  MANUAL
  REFERRAL
  WEBSITE
  PHONE
  OTHER
}

enum LeadStatus {
  NEW
  CONTACTED
  QUALIFYING
  QUALIFIED
  PROPOSAL_SENT
  CONVERTED
  DECLINED
  ARCHIVED
}

enum LeadPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

// Activity log for lead — tracks all interactions
model LeadActivity {
  id          String          @id @default(cuid())
  leadId      String
  lead        Lead            @relation(fields: [leadId], references: [id], onDelete: Cascade)
  
  type        LeadActivityType
  description String          @db.Text
  metadata    String?         @db.Text  // JSON for extra data
  
  createdAt   DateTime        @default(now())
  
  @@index([leadId])
  @@index([createdAt])
}

enum LeadActivityType {
  CREATED
  STATUS_CHANGED
  NOTE_ADDED
  EMAIL_SENT
  CALL_LOGGED
  CHAT_MESSAGE
  FORM_SUBMITTED
  ASSIGNED
  CONVERTED
}

// Live Chat
model ChatSession {
  id              String          @id @default(cuid())
  
  // Visitor info (collected during chat)
  visitorName     String?
  visitorEmail    String?
  visitorPhone    String?
  practiceArea    String?
  
  // Session state
  status          ChatSessionStatus @default(AI_HANDLING)
  isAiHandling    Boolean         @default(true)
  
  // AI qualification result
  aiSummary       String?         @db.Text    // AI's summary of the inquiry
  aiQualified     Boolean?                    // Did AI determine this is a qualified lead?
  
  // Lead link
  leadId          String?         @unique
  lead            Lead?           @relation(fields: [leadId], references: [id])
  
  // Messages
  messages        ChatMessage[]
  
  // Metadata
  ipAddress       String?
  userAgent       String?
  referrer        String?
  pageUrl         String?         // What page they were on when they started chat
  
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  endedAt         DateTime?
  
  @@index([status])
  @@index([createdAt])
}

enum ChatSessionStatus {
  AI_HANDLING       // AI chatbot is responding
  WAITING_FOR_AGENT // AI has handed off, waiting for attorney
  AGENT_CONNECTED   // Attorney is actively chatting
  ENDED             // Chat session ended
}

model ChatMessage {
  id              String          @id @default(cuid())
  sessionId       String
  session         ChatSession     @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  
  role            ChatRole        // VISITOR, AI, AGENT
  content         String          @db.Text
  
  createdAt       DateTime        @default(now())
  
  @@index([sessionId])
  @@index([createdAt])
}

enum ChatRole {
  VISITOR
  AI
  AGENT
}

// Chat Widget Settings (singleton)
model ChatWidgetSettings {
  id                    String    @id @default("default")
  isEnabled             Boolean   @default(false)
  
  // Branding
  widgetColor           String    @default("#3B82F6")  // Blue
  widgetPosition        String    @default("bottom-right") // bottom-right or bottom-left
  welcomeMessage        String?   @db.Text
  offlineMessage        String?   @db.Text
  
  // AI Configuration
  aiEnabled             Boolean   @default(true)
  aiSystemPrompt        String?   @db.Text  // Custom instructions for the AI chatbot
  aiModel               String    @default("claude-sonnet-4-20250514")
  
  // Practice areas for AI to qualify
  practiceAreas         String?   @db.Text  // JSON array
  
  // Auto-create lead from chat
  autoCreateLead        Boolean   @default(true)
  
  // Business hours (JSON array same format as scheduler)
  businessHours         String?   @db.Text
  showOfflineForm       Boolean   @default(true)
  
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
}

// Simple Contact Form Submissions
model ContactFormSubmission {
  id              String          @id @default(cuid())
  name            String
  email           String
  phone           String?
  practiceArea    String?
  message         String          @db.Text
  
  // Lead link
  leadId          String?
  
  // Metadata
  ipAddress       String?
  userAgent       String?
  referrer        String?
  pageUrl         String?
  
  createdAt       DateTime        @default(now())
  
  @@index([createdAt])
}
```

After adding, run:
```bash
cd apps/web
npx prisma db push
```

---

## 2. tRPC Routers

### A. `apps/web/src/server/routers/leads.ts` — Lead Inbox Router

Admin procedures:

- **`list`** — List all leads with filtering (status, source, priority, date range, search by name/email). Support pagination. Return with activity count
- **`getById`** — Get single lead with all activities and linked chat session
- **`create`** — Manually create a lead (Manual Entry)
- **`update`** — Update lead fields (name, email, phone, practiceArea, description, priority, assignedTo)
- **`updateStatus`** — Change lead status. Auto-create a LeadActivity entry on status change
- **`addNote`** — Add a note to a lead. Creates a LeadActivity of type NOTE_ADDED
- **`logActivity`** — Log any activity (call, email, etc.)
- **`convertToClient`** — Create a Client (and optionally Matter) from lead. Set status to CONVERTED, record convertedAt. Create LeadActivity of type CONVERTED
- **`delete`** — Soft delete (set status to ARCHIVED)
- **`getStats`** — Return counts by status (for the kanban column headers) and counts by source
- **`getRecent`** — Get the most recent N leads (for the dashboard widget)

### B. `apps/web/src/server/routers/chat.ts` — Live Chat Router

Public procedures (no auth — used by the embedded widget):

- **`startSession`** — Create a new ChatSession. Create initial AI welcome message. If autoCreateLead is true, create a Lead with source LIVE_CHAT
- **`sendMessage`** — Accept visitor message. Store it. If `isAiHandling` is true, call the Anthropic API (claude-sonnet-4-20250514) to generate an AI response using the configured system prompt. The AI should:
  - Be helpful and professional, representing the law firm
  - Try to collect: name, email, phone, practice area, brief description of legal issue
  - Once it has enough info, summarize the inquiry and set `aiQualified` on the session
  - If the visitor asks to speak to a human, set status to WAITING_FOR_AGENT
  - Store the AI response as a ChatMessage with role AI
  - Return the AI response to the widget
- **`getSession`** — Get session with all messages (for reconnecting)
- **`getWidgetSettings`** — Get chat widget config (for the embedded widget to style itself). Only return public-safe fields (color, position, welcome message, enabled status, practice areas)
- **`endSession`** — Mark session as ENDED

Admin procedures (auth required — used in the dashboard):

- **`listSessions`** — List chat sessions with filtering (status, date). Include message count and visitor info
- **`getSessionMessages`** — Get all messages for a session
- **`sendAgentMessage`** — Send a message as the attorney. Store with role AGENT. If session was AI_HANDLING, switch to AGENT_CONNECTED. Set isAiHandling to false
- **`takeOverSession`** — Attorney takes over from AI. Set status to AGENT_CONNECTED, isAiHandling to false. Add a system message like "An attorney has joined the conversation"
- **`getSettings`** — Get full chat widget settings (admin view with all fields)
- **`updateSettings`** — Update chat widget settings

### C. `apps/web/src/server/routers/contactForm.ts` — Contact Form Widget Router

Public procedures:

- **`submit`** — Accept contact form data (name, email, phone, practiceArea, message). Create ContactFormSubmission. Auto-create a Lead with source CONTACT_FORM. Create LeadActivity of type FORM_SUBMITTED. Return success message
- **`getSettings`** — Return available practice areas (from Settings or ChatWidgetSettings)

### Register all in `_app.ts`:
```typescript
import { leadsRouter } from "./leads";
import { chatRouter } from "./chat";
import { contactFormRouter } from "./contactForm";

export const appRouter = router({
  // ... existing
  leads: leadsRouter,
  chat: chatRouter,
  contactForm: contactFormRouter,
});
```

---

## 3. Anthropic API Integration for AI Chat

Create `apps/web/src/lib/ai-chat.ts`:

```typescript
// Helper for AI chat responses
// Uses the Anthropic API with the configured system prompt
// The API key should be set as ANTHROPIC_API_KEY in environment variables

export async function generateAiChatResponse(params: {
  messages: { role: string; content: string }[];
  systemPrompt: string;
  visitorInfo: { name?: string; email?: string; phone?: string; practiceArea?: string };
}): Promise<string> {
  // Build conversation history in Anthropic format
  // System prompt should include:
  //   - Firm name and basic info (from Settings model)
  //   - Practice areas offered
  //   - Instructions to collect: name, email, phone, practice area, case description
  //   - Professional, warm tone
  //   - When to suggest human handoff
  // Call POST https://api.anthropic.com/v1/messages
  // Use model from ChatWidgetSettings (default claude-sonnet-4-20250514)
  // Return the text response
}
```

**Default AI system prompt** (stored in ChatWidgetSettings, editable by admin):

```
You are a friendly and professional legal intake assistant for {firmName}. Your role is to:

1. Greet visitors warmly and ask how you can help
2. Collect their basic information: full name, email address, and phone number
3. Understand what legal issue they need help with
4. Determine which practice area best fits their needs
5. Provide a brief, helpful response without giving legal advice
6. Let them know an attorney will follow up with them

Practice areas we handle: {practiceAreas}

Important rules:
- Never provide specific legal advice
- Be empathetic and professional
- If someone seems to be in crisis or danger, provide emergency resources (911)
- If you've collected enough information (name, contact info, and issue description), let the visitor know that an attorney from our firm will be in touch shortly
- If the visitor specifically asks to speak with a human, immediately hand off the conversation

Keep responses concise (2-4 sentences typically). Be warm but efficient.
```

---

## 4. Page Routes

### Admin Pages (inside authenticated layout)

#### `/leads/page.tsx` — Lead Inbox Dashboard (MAIN PAGE)

This is the centerpiece. Two views toggled by a switch:

**Header Section:**
- Title: "Lead Inbox"
- Stats bar: Count badges for each status (New: 5, Contacted: 3, Qualifying: 2, etc.)
- Action buttons: "Add Lead" (manual entry), "Settings"
- View toggle: Kanban / Table icons
- Filters: status, source, priority, date range, search box

**Kanban View:**
- Columns: NEW | CONTACTED | QUALIFYING | QUALIFIED | PROPOSAL_SENT
- Each card shows: name, source icon/badge, practice area, time ago, priority indicator
- Cards are draggable between columns (drag = status change)
- Click card → opens lead detail slide-out panel
- CONVERTED, DECLINED, ARCHIVED leads are hidden from kanban but visible in table view

**Table View:**
- Columns: Name, Email, Phone, Source, Status (badge), Priority, Practice Area, Created, Last Contact
- Sortable columns
- Row click → opens lead detail slide-out panel
- Shows all statuses including CONVERTED/DECLINED/ARCHIVED

**Lead Detail Slide-Out Panel (shared by both views):**
- Appears as a right-side panel when clicking a lead
- Shows: all lead fields, editable inline
- Status selector dropdown
- Priority selector
- Notes textarea with "Add Note" button
- Activity timeline (all LeadActivity entries in chronological order)
- If lead has a ChatSession: "View Chat" button to see the conversation
- "Convert to Client" button → creates Client record
- "Archive" button

#### `/leads/new/page.tsx` — Manual Lead Entry Form
- Simple form: name, email, phone, practice area, source (dropdown), priority, description
- Save → creates Lead + LeadActivity(CREATED)

#### `/leads/chat/page.tsx` — Live Chat Admin Panel
- Left panel: list of active/recent chat sessions (sorted by most recent message)
  - Each item shows: visitor name (or "Anonymous"), status badge, last message preview, time
  - Filter tabs: Active | Waiting | All
- Right panel: selected conversation
  - Message thread (styled like a chat — visitor messages on left, AI/agent on right, with role labels)
  - If AI_HANDLING: "Take Over" button prominently displayed
  - If WAITING_FOR_AGENT: urgent styling, "Connect" button
  - If AGENT_CONNECTED: message input box at bottom to send messages as attorney
  - Session info sidebar: visitor details, AI summary, qualification status, link to Lead

#### `/leads/settings/page.tsx` — Lead & Chat Settings
- **Chat Widget Settings:**
  - Enable/disable toggle
  - Widget color picker
  - Widget position (bottom-right / bottom-left)
  - Welcome message textarea
  - Offline message textarea
  - AI enabled toggle
  - AI system prompt textarea (with default shown as placeholder)
  - Practice areas editor
  - Business hours editor (reuse pattern from SchedulerSettings)
  - Auto-create lead toggle
- **Embed Code Section:**
  - Shows the script tag to embed the chat widget:
    ```html
    <script src="{APP_URL}/widget/chat.js" data-firm-id="default"></script>
    ```
  - Shows the iframe/script for the contact form widget:
    ```html
    <iframe src="{APP_URL}/widget/contact" width="100%" height="500" frameborder="0"></iframe>
    ```
  - Copy buttons for both

### Public/Widget Pages (NO auth, NO sidebar)

#### `/widget/chat/page.tsx` — Embeddable Chat Widget
- This renders the chat widget UI that gets embedded on external websites
- Styled as a floating chat bubble that expands into a chat window
- Uses `chat.getWidgetSettings` to fetch branding
- On open: calls `chat.startSession`
- Message flow: visitor types → `chat.sendMessage` → display AI response → repeat
- Shows typing indicator while AI is generating
- If AI hands off: show "Connecting you with an attorney..." message
- If agent joins: show "An attorney has joined" system message
- If offline (outside business hours): show offline message + contact form fallback
- Mobile responsive
- Reads firm branding (color, position) from settings

#### `/widget/contact/page.tsx` — Embeddable Contact Form
- Simple, clean contact form: name, email, phone (optional), practice area (dropdown), message
- Submit → `contactForm.submit`
- Success state: "Thank you! We'll be in touch shortly."
- Mobile responsive
- Can be embedded as iframe

#### `/widget/chat.js` — Chat Widget Loader Script (Static File)
Create a static JS file at `public/widget/chat.js` that:
- Creates an iframe pointing to `/widget/chat`
- Injects it as a floating element on the host page
- Handles open/close toggle with a chat bubble button
- Passes any data attributes to the iframe via URL params
- Minimal footprint, no dependencies

---

## 5. Sidebar Navigation Update

In `apps/web/src/components/layout/sidebar.tsx`, add to `mainNavigation` array (after "Intake Forms"):

```typescript
{ name: "Lead Inbox", href: "/leads", icon: Inbox },
```

Import `Inbox` from `lucide-react`.

---

## 6. Public Layout Updates

In `apps/web/src/components/layout/app-shell.tsx`, add `/widget/` to the public prefixes:

```typescript
const publicPrefixes = ["/intake/", "/widget/"];
```

Also create `apps/web/src/app/widget/layout.tsx` — minimal public layout similar to the intake layout:

```typescript
export default function WidgetLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

The widget layout should have NO html/body wrapper since it renders inside an iframe. Just render children directly.

---

## 7. Bridge: Intake Form Submissions → Lead Inbox

Update the existing `intakeForms.submitForm` procedure in `apps/web/src/server/routers/intakeForms.ts`:

After creating the `IntakeFormSubmission`, also create a `Lead` record:

```typescript
// After creating submission...
const lead = await ctx.db.lead.create({
  data: {
    name: submitterName || "Unknown",
    email: submitterEmail,
    phone: submitterPhone,
    source: "INTAKE_FORM",
    status: "NEW",
    practiceArea: template.practiceArea,
    description: `Submitted via intake form: ${template.name}`,
    intakeSubmissionId: submission.id,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    referrer: input.referrer,
  },
});

// Create activity
await ctx.db.leadActivity.create({
  data: {
    leadId: lead.id,
    type: "FORM_SUBMITTED",
    description: `Lead created from intake form "${template.name}"`,
  },
});
```

---

## 8. Dashboard Widget

Update the main dashboard page (`apps/web/src/app/page.tsx`) to include a "Recent Leads" widget:

- Shows the 5 most recent leads with name, source badge, status badge, and time ago
- "View All" link to `/leads`
- Count of new leads as a stat card alongside existing Total Clients, Open Matters, etc.

---

## 9. Environment Variables

Add to Vercel environment variables:

```
ANTHROPIC_API_KEY=sk-ant-...   # For AI chat responses
```

The AI chat feature calls the Anthropic Messages API directly from the server-side tRPC procedure. Do NOT expose the API key to the client.

---

## 10. File Summary

New files to create:
```
apps/web/src/server/routers/leads.ts              # Lead Inbox tRPC router
apps/web/src/server/routers/chat.ts               # Live Chat tRPC router  
apps/web/src/server/routers/contactForm.ts         # Contact Form tRPC router
apps/web/src/lib/ai-chat.ts                        # Anthropic API helper for AI chat
apps/web/src/app/leads/page.tsx                    # Lead Inbox dashboard (kanban + table)
apps/web/src/app/leads/new/page.tsx                # Manual lead entry form
apps/web/src/app/leads/chat/page.tsx               # Live chat admin panel
apps/web/src/app/leads/settings/page.tsx           # Lead & chat widget settings
apps/web/src/app/widget/layout.tsx                 # Minimal widget layout
apps/web/src/app/widget/chat/page.tsx              # Embeddable chat widget UI
apps/web/src/app/widget/contact/page.tsx           # Embeddable contact form
apps/web/public/widget/chat.js                     # Chat widget loader script
```

Files to modify:
```
apps/web/prisma/schema.prisma                      # Add new models
apps/web/src/server/routers/_app.ts                # Register new routers
apps/web/src/server/routers/intakeForms.ts         # Bridge submissions to Lead model
apps/web/src/components/layout/sidebar.tsx          # Add Lead Inbox nav item
apps/web/src/components/layout/app-shell.tsx        # Add /widget/ to public prefixes
apps/web/src/app/page.tsx                          # Add Recent Leads dashboard widget
```

---

## 11. Implementation Order

Build in this order to avoid dependency issues:

1. **Schema** — Add all new Prisma models, run `prisma db push`
2. **Lead router** — Core CRUD for leads (most other features depend on this)
3. **Lead Inbox page** — Kanban + table views with the lead detail panel
4. **Contact form router + widget** — Simpler, good test of the lead creation pipeline
5. **Chat settings model + router** — Widget configuration
6. **AI chat helper** — Anthropic API integration
7. **Chat router** — Full chat session management with AI
8. **Chat widget UI** — The embeddable widget page
9. **Chat admin panel** — Attorney-side chat management
10. **Chat loader script** — The JS embed file
11. **Bridge intake forms** — Update intakeForms router to also create Leads
12. **Dashboard widget** — Recent leads on main dashboard
13. **Sidebar + layout updates** — Nav item and public route exclusions

---

## 12. Key Implementation Notes

### Kanban Drag-and-Drop
Use a simple implementation with HTML5 drag and drop (no need for external libraries). Each column is a drop zone. On drop, call `leads.updateStatus` with the new status. Optimistically update the UI.

### Chat Widget Communication
The chat widget page (`/widget/chat`) communicates with the tRPC API. Since it runs in an iframe on external sites, ensure CORS headers allow the widget origin. The widget should work via standard tRPC HTTP calls.

### AI Response Streaming (Nice to Have, Not Required for V1)
For v1, the AI response can be a simple request/response (not streamed). The typing indicator shows while waiting. If you want streaming later, switch to the Anthropic streaming API.

### Real-time Chat Updates (Nice to Have, Not Required for V1)
For v1, the admin chat panel can poll every 3-5 seconds for new messages. The visitor-side widget also polls for agent messages. True real-time via WebSockets can be added later.

### Lead Priority Auto-Assignment
When a lead is created from live chat where the AI marks it as qualified, auto-set priority to HIGH. Intake form submissions default to MEDIUM. Contact form submissions default to MEDIUM.

---

## 13. Testing Checklist

After implementation, verify:
- [ ] Can manually create a lead from the dashboard
- [ ] Lead Inbox shows kanban view with draggable cards
- [ ] Can toggle between kanban and table views
- [ ] Lead detail panel opens with full info and activity timeline
- [ ] Can change lead status and priority
- [ ] Can add notes to a lead
- [ ] Can convert a lead to a Client
- [ ] Contact form widget renders at `/widget/contact`
- [ ] Contact form submission creates a Lead
- [ ] Chat widget settings page works
- [ ] Chat widget renders at `/widget/chat`
- [ ] Chat widget starts a session and sends/receives messages
- [ ] AI chatbot responds appropriately and collects visitor info
- [ ] Attorney can take over from AI in the chat admin panel
- [ ] Intake form submissions create Lead records
- [ ] Dashboard shows recent leads widget
- [ ] Chat loader script (`/widget/chat.js`) works when embedded
- [ ] All public widget pages render without auth/sidebar
