# CLAUDE.md — Managal Project Context

This file is read by Claude Code at the start of every session.
It defines the full product vision, design system, and active build prompts for Managal.
Do not modify this file unless instructed. Always read it before writing any code.

---

## WHAT IS MANAGAL

Managal is a legal practice management SaaS — think Clio-tier feature depth,
Intercom-tier UX polish, Brex-tier visual design. It serves lawyers and law firms
who need to manage clients, matters, billing, documents, calendar, and compliance
in one place.

Target users: solo attorneys and small-to-mid law firms (2–50 staff)
Core jobs to be done: track billables, manage matters, communicate with clients,
stay compliant, get paid faster.

Design references:
  Visual design   → Brex (dark nav, strong typography, financial-grade trust)
  UX patterns     → Intercom (onboarding bars, task-driven flows, contextual empty states)
  Navigation      → Flyout panel sidebar (defined below)
  Component base  → Shadcn UI with Managal token overrides

---

## BRAND

Logo files located at:
  /public/managal-logo-full-dark.svg  → full wordmark, white text, dark nav
  /public/managal-logo-full.svg       → full wordmark, dark text, white bg
  /public/managal-logo-icon.svg       → M + scales mark only, collapsed nav + favicon

Brand colors:
  --brand-navy:       #1B3A8C   → active states, selected items, links
  --brand-teal:       #1AA8A0   → primary actions, buttons, progress
  --brand-charcoal:   #3D3D3D   → body text, wordmark
  --brand-teal-50:    #E5F6F6   → selected row bg, badge bg
  --brand-teal-100:   #B3E5E3   → hover states
  --brand-navy-50:    #E8EDF7   → subtle info backgrounds
  --brand-navy-100:   #C0CCE8   → nav active bg tint

Nav shell colors (always dark):
  --nav-bg:           #0A0A0F
  --nav-flyout:       #111118
  --nav-border:       rgba(255,255,255,0.06)
  --nav-text:         rgba(255,255,255,0.45)
  --nav-active-bg:    rgba(26,168,160,0.12)
  --nav-active-text:  #FFFFFF

---

## DESIGN SYSTEM RULES (apply everywhere, always)

### Never do these
- No hardcoded hex values in components — all colors via CSS custom properties
- No font-weight 600 or 700 anywhere — use 400 (regular) and 500 (medium) only
- No ALL CAPS text except 10–11px sub-labels with letter-spacing 0.04em+
- No box-shadows except modals (0 8px 32px rgba(0,0,0,0.12)) and flyout overlays
- No emoji as icons — SVG stroke icons only (Lucide, 14–16px, stroke-width 1.5)
- No gradients on UI surfaces — brand gradient only on the logo mark itself
- No generic empty states — every list/table needs a contextual message + CTA
- No form validation on submit — always validate inline on blur
- No disabling submit buttons — show inline errors instead
- Dark mode must work on every component — never hardcode colors

### Always do these
- Page backgrounds: #F7F7F8 (off-white, not pure white)
- Cards: white bg, 0.5px border, 10–12px radius, 14px 16px padding
- Transitions: 100–150ms ease only — no spring, bounce, or decorative motion
- Touch targets: minimum 44×44px on all interactive elements
- Sentence case everywhere — page titles, labels, buttons, nav items
- Active route in nav always visible — never collapsed or hidden
- Undo available for every destructive action (toast, 8s timeout)
- All form validation inline on blur with error message below the field

### Typography scale
  Page title:      17–18px / weight 500 / tracking -0.01em
  Section label:   12–13px / weight 500
  Body / table:    13px / weight 400 / line-height 1.6
  Meta / time:     11px / weight 400 / secondary color
  Sub-labels:      10–11px / weight 500 / uppercase / tracking 0.04em

### Status badge colors (always pill shape, border-radius 20px)
  Open / Active  : bg #E5F6F6,  text #0E7A75
  In Review      : bg #FAEEDA,  text #854F0B
  Closed / Done  : bg #F1EFE8,  text #5F5E5A
  Urgent / Now   : bg #FCEBEB,  text #A32D2D
  Pending        : bg #E8EDF7,  text #1B3A8C
  Draft          : bg #F1EFE8,  text #5F5E5A

---

## NAVIGATION: FLYOUT PANEL

Layout: [ Primary sidebar 180px ] [ Flyout sub-panel 220px ] [ Main content ]

Behavior:
- Primary sidebar always visible — section names + icons
- Clicking a section opens its flyout sub-panel to the right
- Only one flyout open at a time
- Clicking same section again collapses it
- Clicking outside (into main content) closes it
- Active route auto-opens the correct section on load
- Mobile: icon-only rail + drawer

Full nav structure with approved sub-groups:

### Cases & Clients
  Clients & Matters     → Clients, Matters, Bulk Operations
  Intake & Leads        → Lead Inbox, Intake Forms, Intake Screening, AI Intake Chat, CRM & Intake
  Compliance            → Conflict Check
  Client Experience     → Client Portal, Status Updates, Client Pulse, Portal Settings
  Configuration         → Practice Areas

### Calendar & Tasks
  Planning              → Calendar, Tasks, Appointments
  Scheduling            → Scheduling, Self-Scheduling, Meetings
  Court & Travel        → Docketing, Court Mode, Court Check-In, Travel Calendar

### Documents & Filing
  Storage & Drafting    → Documents, Cloud Storage, Document Drafting, Doc Scanner
  Review & AI           → Review & Analysis, AI Review Flags, Doc Assembly
  Signatures & Filing   → E-Signatures, E-Sign, E-Filing, Court E-Filing
  Service & Mail        → Filing & Service, Service & Reporters, Mail
  Discovery             → Discovery, Discovery Checklists

### Billing & Finance
  Time                  → Time Tracking, Time Review
  Billing & Payments    → Billing, Payments, Swipe to Bill, Quick Invoice, Invoicing
  Fee Management        → Fee Structures, Fee Splits, Contingency Cases, Financing, Payment Plans
  Trust & Compliance    → Trust Accounting, IOLA/Trust Compliance, Collections, Approvals, AI Billing Audit
  Accounting & Insights → Accounting, Insights, Forecasting, Revenue Forecast

### Practice Tools
  Practice Areas        → Family Law, Immigration, Conveyancing, Injury Cases, PI Medical
  Court & Research      → Investigations, Docket Search, Court Calendar, Court Integrations, Courts
  Deadlines & Compliance→ SOL Tracker, Deadline Calculator, Compliance
  Business Development  → Visuals, Referrals

### Firm Management
  People & Structure    → Departments, HR, Entities
  Integrations & Sync   → Integrations, Accounting Sync, API & Zapier, Offline & Sync, Email Settings
  Configuration         → Practice Fields, Jurisdictions, Settings, Translations, Security
  Automation & Comms    → Task Cascades, Workflows, Smart Reminders, Daily Digest, Notifications
  Compliance & Support  → CLE Tracker, Data Migration, Help

---

## ACTIVE BUILD PROMPTS

The following features are in active development.
Each section below is a self-contained prompt — read the relevant one before
working on that feature area.

---

### 1. MIGRATION WIZARD

Location: lib/migration/, components/MigrationWizard/, api/migration/

A 7-step wizard for importing data from Clio, PracticePanther, or MyCase.

Steps:
  1. Source selection (provider cards)
  2. Authentication (OAuth or API key)
  3. Data preview (sample records + counts)
  4. Field mapping (source → destination schema)
  5. Migration options (toggle: Contacts, Matters, Documents, Billing)
  6. Run & progress (real-time SSE stream)
  7. Summary (imported / skipped / failed + CSV export)

Providers:
  Clio            → OAuth 2.0, https://app.clio.com/api/v4
  PracticePanther → API Key, https://api.practicepanther.com/v1
  MyCase          → OAuth 2.0, https://api.mycase.com/v1

Destination schema:
  Contact  → { id, firstName, lastName, email, phone, type, createdAt }
  Matter   → { id, name, status, clientId, practiceArea, openDate, closeDate }
  Document → { id, matterId, name, fileUrl, mimeType, uploadedAt }
  Invoice  → { id, matterId, clientId, amount, status, dueDate, issuedAt }

Hard requirements:
  - All provider API calls go through backend — never expose tokens to client
  - OAuth tokens encrypted at rest (AES-256)
  - Idempotent: use sourceId + provider as unique key — no duplicates on re-run
  - Batches of 50 records
  - Dry-run mode: preview without writing to DB
  - Failed records exportable as CSV
  - Unit tests for mapper and all three provider adapters

Start with: Clio adapter with mock data + full wizard UI (static, no live API)

---

### 2. PRACTICE AREA ONBOARDING

Location: lib/onboarding/, components/Onboarding/, api/onboarding/

A 8-step post-signup onboarding wizard that seeds the workspace based on
the user's selected practice area(s).

Supported areas:
  Family Law, Personal Injury, Criminal Defense, Estate Planning / Probate,
  Corporate / Business Law, Immigration, Real Estate, Bankruptcy

Steps:
  1. Practice area selection (card grid, multi-select)
  2. Seeding screen (animated progress)
  3. Matter templates tour
  4. Intake form preview
  5. Document template browser
  6. Billing setup review
  7. Integrations list
  8. Done (celebration + "Create first matter" CTA)

Each practice area seeds:
  - Matter templates (4–5 per area)
  - Custom intake fields (6–8 per area)
  - Document templates (3–4 per area)
  - Default billing rates + ABA codes
  - Recommended integrations (3–4 per area)
  - Sample task workflow (8-step checklist)

Hard requirements:
  - Seeding is idempotent — no duplicates on re-run
  - Onboarding state persisted server-side (survives page refresh)
  - Skippable at any step without breaking workspace state
  - Multi-area selection supported — seeded data must not conflict
  - All seeded data editable after onboarding
  - user.onboardingComplete flag set on completion

Start with: type definitions + all 8 seed config files + PracticeAreaGrid UI

---

### 3. GLOBAL UI RESTYLE

Applies to: every page and component in the app

Visual-only restyle to match Brex/Intercom aesthetic + Managal brand.
No logic, routing, or functionality changes anywhere.

Execute in this order — confirm each phase before proceeding:

  Phase 1 — Tokens & primitives
    Update CSS custom properties with brand palette
    Update Button, Input, Badge, Card base components

  Phase 2 — Layout shell
    Apply page background (#F7F7F8)
    Update topbar and breadcrumb
    Integrate with flyout nav

  Phase 3 — High-traffic pages
    Dashboard, Clients, Matters, Matter detail, Billing

  Phase 4 — Supporting pages
    Documents, Calendar, Intake forms, Conflict check, Settings

  Phase 5 — Modals, drawers, toasts

  Phase 6 — Empty states
    Every list/section needs contextual message + CTA

  Phase 7 — Final audit
    Grep for: hardcoded hex, ALL CAPS, emoji icons, weight 600/700,
    black text on colored bg, box-shadows outside modals

Page-type patterns:
  List pages     → icon + title + count | search + filters + action button | table
  Detail pages   → two-column (65/35) | inline editing | breadcrumb
  Form pages     → single column max-width 640px | section cards | blur validation
  Dashboard      → onboarding bar | metric row | recent items + activity feed
  Settings pages → left category nav | section cards | per-section save | danger zone

---

### 4. LOGO INTEGRATION

Logo files: /public/managal-logo-full-dark.svg, managal-logo-full.svg, managal-logo-icon.svg

Placements:
  Dark nav sidebar   → managal-logo-full-dark.svg, height 28px, padding 14px 16px
  Collapsed nav rail → managal-logo-icon.svg, 32×32px centered
  Login screen       → managal-logo-full.svg, height 40px, centered above form
  Favicon            → managal-logo-icon.svg in <head>

Color token migration (old purple → new teal/navy):
  #534AB7 → #1AA8A0
  #7F77DD → #1B3A8C
  #EEEDFE → #E5F6F6
  #AFA9EC → #B3E5E3

Hard requirements:
  - Never distort the logo — always scale proportionally
  - Never use CSS filters to swap light/dark variants — use correct file
  - Never place dark-bg logo on white surface or vice versa
  - Minimum clear space = height of M mark on all sides
  - Minimum rendered height: 20px

---

## GENERAL ENGINEERING RULES

- Stack-agnostic: always read the project structure before writing code
- Follow existing conventions for file naming, imports, and component structure
- Ask before introducing any new dependency
- Ask before modifying any component used in more than 10 places
- Never change routes, hrefs, or URL structure unless explicitly asked
- Never change data fetching logic, API contracts, or business logic during UI work
- All new components: TypeScript, co-located types, co-located tests
- Prefer extending existing components over creating new ones
- When in doubt: do less, ask more

---

## HOW TO START EACH SESSION

1. Read this file in full
2. Ask what the user wants to work on today
3. Identify which section above is relevant
4. Read the existing code in that area before writing anything
5. State what you plan to do and wait for confirmation on anything ambiguous
6. Work in small, reviewable increments — not large one-shot rewrites
