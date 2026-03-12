# Public Intake Forms — Implementation Spec for Claude Code

## Overview

Add a **Public Intake Forms** feature to the Clio AI legal practice management app. This allows the firm to create customizable intake form templates, generate persistent public URLs that can be embedded on websites or shared via email/SMS, and automatically process submissions into Clients and a Leads pipeline.

## Tech Stack (existing)

- Next.js 14 (App Router) + TypeScript
- Prisma + PostgreSQL (Neon) — schema at `apps/web/prisma/schema.prisma`
- tRPC v10 — routers at `apps/web/src/server/routers/`
- Tailwind CSS + Radix UI + shadcn-style components
- NextAuth for auth
- Deployed on Vercel

---

## 1. Prisma Schema Additions

Add these models to `apps/web/prisma/schema.prisma`:

```prisma
// ============================================
// PUBLIC INTAKE FORMS
// ============================================

model IntakeFormTemplate {
  id              String                @id @default(cuid())
  name            String                // e.g. "Family Law Intake", "General Inquiry"
  description     String?               @db.Text
  slug            String                @unique  // URL-friendly identifier for public link
  isPublic        Boolean               @default(true)
  isActive        Boolean               @default(true)
  practiceArea    String?               // e.g. "Family Law", "Trademark"
  
  // Branding
  headerText      String?               @db.Text  // Custom header shown on the form
  confirmationMsg String?               @db.Text  // Message shown after submission
  
  // Auto-actions on submission
  autoCreateClient Boolean              @default(true)
  autoCreateMatter Boolean              @default(false)
  defaultMatterStatus MatterStatus      @default(OPEN)
  notifyEmail     String?               // Email to notify on new submission (defaults to firm email)
  
  fields          IntakeFormField[]
  submissions     IntakeFormSubmission[]
  
  createdAt       DateTime              @default(now())
  updatedAt       DateTime              @updatedAt
}

model IntakeFormField {
  id              String                @id @default(cuid())
  templateId      String
  template        IntakeFormTemplate     @relation(fields: [templateId], references: [id], onDelete: Cascade)
  
  label           String                // "Full Name", "Phone Number", etc.
  fieldType       IntakeFieldType       // TEXT, TEXTAREA, EMAIL, PHONE, SELECT, MULTISELECT, CHECKBOX, DATE, FILE
  isRequired      Boolean               @default(false)
  placeholder     String?
  helpText        String?
  options         String?               @db.Text  // JSON array for SELECT/MULTISELECT: ["Option 1", "Option 2"]
  sortOrder       Int                   @default(0)
  
  // Map to Client model fields for auto-population
  clientFieldMap  String?               // "name", "email", "phone", "address", "notes" or null for custom
  
  createdAt       DateTime              @default(now())
  updatedAt       DateTime              @updatedAt
  
  @@index([templateId])
  @@index([sortOrder])
}

enum IntakeFieldType {
  TEXT
  TEXTAREA
  EMAIL
  PHONE
  SELECT
  MULTISELECT
  CHECKBOX
  DATE
  FILE
}

model IntakeFormSubmission {
  id              String                @id @default(cuid())
  templateId      String
  template        IntakeFormTemplate     @relation(fields: [templateId], references: [id], onDelete: Cascade)
  
  // Submission data stored as JSON
  data            String                @db.Text  // JSON object: { fieldId: value, ... }
  
  // Lead tracking
  status          IntakeLeadStatus      @default(NEW)
  notes           String?               @db.Text  // Internal notes from attorney
  
  // Links to created records
  clientId        String?               // If auto-created or manually linked
  matterId        String?               // If auto-created or manually linked
  
  // Contact info extracted for quick reference
  submitterName   String?
  submitterEmail  String?
  submitterPhone  String?
  
  // Metadata
  ipAddress       String?
  userAgent       String?
  referrer        String?               // Where they came from
  
  createdAt       DateTime              @default(now())
  updatedAt       DateTime              @updatedAt
  
  @@index([templateId])
  @@index([status])
  @@index([createdAt])
}

enum IntakeLeadStatus {
  NEW
  CONTACTED
  QUALIFIED
  CONVERTED      // Became a client
  DECLINED
  ARCHIVED
}
```

After adding, run:
```bash
cd apps/web
npx prisma db push
```

---

## 2. tRPC Router — `apps/web/src/server/routers/intakeForms.ts`

Create a new router with these procedures:

### Admin procedures (used in the dashboard):
- **`listTemplates`** — List all intake form templates with submission counts
- **`getTemplate`** — Get a single template with all its fields (by ID)
- **`createTemplate`** — Create a new template with fields
- **`updateTemplate`** — Update template settings and fields
- **`deleteTemplate`** — Soft-delete (set isActive: false)
- **`listSubmissions`** — List submissions with filtering by template, status, date range. Include pagination
- **`getSubmission`** — Get a single submission with parsed data and template field labels
- **`updateSubmissionStatus`** — Update lead status (NEW → CONTACTED → QUALIFIED → CONVERTED → DECLINED)
- **`addSubmissionNote`** — Add internal notes to a submission
- **`convertToClient`** — Create a Client record from a submission, using the clientFieldMap to populate fields. Update the submission with clientId

### Public procedures (no auth, used by the public form page):
- **`getPublicForm`** — Get template by slug (only if isPublic && isActive). Returns template name, headerText, confirmationMsg, and fields (sorted by sortOrder). Do NOT expose internal IDs
- **`submitForm`** — Accept form data, validate required fields, create IntakeFormSubmission. If autoCreateClient is true, create a Client record. Extract submitterName/Email/Phone from mapped fields. Return success with confirmationMsg

### Register in `_app.ts`:
```typescript
import { intakeFormsRouter } from "./intakeForms";

export const appRouter = router({
  // ... existing routers
  intakeForms: intakeFormsRouter,
});
```

---

## 3. Page Routes

### Admin Pages (inside authenticated layout)

#### `/intake-forms/page.tsx` — Template List
- Table showing all form templates: name, practice area, status (active/inactive), submission count, created date
- "New Form" button
- Each row links to the template detail page
- Quick actions: copy public link, toggle active, delete

#### `/intake-forms/new/page.tsx` — Create Template
- Form with:
  - Template name, description, practice area (dropdown matching existing practice areas)
  - Header text, confirmation message
  - Toggle: auto-create client, auto-create matter, notify on submission
  - Notification email field
  - **Form Builder**: drag-and-drop or add/remove fields
    - Each field: label, type (dropdown), required toggle, placeholder, help text
    - For SELECT/MULTISELECT: options editor (add/remove options)
    - Client field mapping dropdown: None, Name, Email, Phone, Address, Notes
    - Sort order (drag to reorder)
  - Default fields to pre-populate for new forms:
    - Full Name (TEXT, required, mapped to "name")
    - Email Address (EMAIL, required, mapped to "email")  
    - Phone Number (PHONE, optional, mapped to "phone")
    - How can we help you? (TEXTAREA, required, mapped to "notes")

#### `/intake-forms/[id]/page.tsx` — Template Detail & Submissions
- Two tabs: **Settings** (edit the template) and **Submissions** (lead pipeline)
- Settings tab: same form as create, pre-populated
- Submissions tab:
  - Filter bar: status dropdown, date range
  - Table: submitter name, email, phone, practice area, status badge, submitted date
  - Click row → slide-out panel or detail page showing:
    - All submitted answers with field labels
    - Status selector
    - Internal notes textarea
    - "Convert to Client" button (creates Client record, links it)
    - Link to created Client/Matter if already converted
- **Public Link section** at top: shows the full public URL with copy button
  - Format: `{APP_URL}/intake/{slug}`
  - Show embed code: `<iframe src="{APP_URL}/intake/{slug}" width="100%" height="800" frameborder="0"></iframe>`
  - Show direct link for email/SMS sharing

### Public Page (NO auth, NO sidebar/header layout)

#### `/intake/[slug]/page.tsx` — Public Intake Form
- This page must NOT use the AppShell/Sidebar layout. Create a minimal public layout
- Clean, professional design with firm branding
- Show: form template headerText, firm name (from Settings model)
- Render all fields dynamically based on template fields
- Client-side validation for required fields and field types (email format, phone format, etc.)
- Submit button → calls `intakeForms.submitForm`
- On success: show confirmation message
- On error: show validation errors inline
- Mobile-responsive
- No authentication required

---

## 4. Sidebar Navigation Update

In `apps/web/src/components/layout/sidebar.tsx`, add to `mainNavigation` array (after "Calendar"):

```typescript
{ name: "Intake Forms", href: "/intake-forms", icon: ClipboardList },
```

Import `ClipboardList` from `lucide-react`.

---

## 5. Public Layout

Create `apps/web/src/app/intake/layout.tsx` that does NOT include the AppShell sidebar/header. This is a standalone public layout:

```typescript
// Minimal layout — no sidebar, no auth required
export default function IntakeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  );
}
```

Make sure the `/intake/[slug]` route is excluded from any auth middleware or layout wrapping that the rest of the app uses.

---

## 6. Email Notification

When a form is submitted and `notifyEmail` is set (or fall back to the firm email from Settings):
- For now, log the notification to console with all submission details (since there's no email service configured yet)
- Add a `// TODO: Send email notification` comment with the data structure ready
- Consider adding a future integration with SendGrid, Resend, or similar

---

## 7. Key Implementation Notes

### URL slug generation
When creating a template, auto-generate slug from the name (lowercase, hyphenated, deduplicated). Allow manual override. Example: "Family Law Intake" → `family-law-intake`

### Form field rendering
Create a reusable `<IntakeField>` component that renders the correct input based on `fieldType`:
- TEXT → `<Input />`
- TEXTAREA → `<Textarea />`
- EMAIL → `<Input type="email" />`
- PHONE → `<Input type="tel" />`
- SELECT → `<Select />` with options
- MULTISELECT → checkbox group
- CHECKBOX → `<Checkbox />`
- DATE → `<Input type="date" />`
- FILE → file upload (store as base64 or skip for v1)

### Client auto-creation logic
When `autoCreateClient` is true on submission:
1. Look at each field's `clientFieldMap`
2. Build a Client create payload: `{ name, email, phone, address, notes }`
3. Create the Client via Prisma
4. Store the `clientId` on the submission
5. If `autoCreateMatter` is also true, create a Matter linked to the new client

### Styling
Match the existing app's dark sidebar / white content area aesthetic. The public form page should be clean and professional — white background, subtle borders, the firm's name at the top. Use the same Tailwind classes and shadcn components already in the project.

---

## 8. File Summary

New files to create:
```
apps/web/src/server/routers/intakeForms.ts          # tRPC router
apps/web/src/app/intake-forms/page.tsx               # Admin: template list
apps/web/src/app/intake-forms/new/page.tsx           # Admin: create template
apps/web/src/app/intake-forms/[id]/page.tsx          # Admin: template detail + submissions
apps/web/src/app/intake/layout.tsx                   # Public: minimal layout (no sidebar)
apps/web/src/app/intake/[slug]/page.tsx              # Public: the intake form
```

Files to modify:
```
apps/web/prisma/schema.prisma                        # Add new models
apps/web/src/server/routers/_app.ts                  # Register intakeForms router
apps/web/src/components/layout/sidebar.tsx            # Add nav item
```

---

## 9. Testing Checklist

After implementation, verify:
- [ ] Can create a new intake form template with custom fields
- [ ] Public form renders at `/intake/{slug}` without authentication
- [ ] Form validates required fields client-side
- [ ] Submission creates an IntakeFormSubmission record
- [ ] Auto-creates Client when enabled
- [ ] Submission appears in the admin Submissions tab
- [ ] Can update lead status
- [ ] Can convert submission to client manually
- [ ] Copy public link and embed code work
- [ ] Mobile responsive on the public form
- [ ] Inactive/non-public forms show a "form not available" message
