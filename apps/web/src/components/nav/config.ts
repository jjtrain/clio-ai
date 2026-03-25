import {
  Users, Briefcase, Clock, FileText, Calendar, CalendarClock, ClipboardList,
  Inbox, LayoutDashboard, Scale, Settings, HelpCircle, Receipt,
  Landmark, CheckSquare, ShieldAlert, Shield, PenTool, BarChart3, FileBarChart,
  PieChart, TrendingUp, LineChart, ShieldCheck, Mail, Globe, Sparkles,
  BookOpen, FilePen, ScanSearch, Upload, MessageSquare,
  HeartPulse, CreditCard, Wallet, ClipboardCheck, Calculator, Plug, Gavel,
  FileQuestion, Heart, Send, SearchCode, ScanEye, Banknote, Headphones,
  Contact, Megaphone, CalendarRange, Truck, FolderOpen, Share2, Lightbulb,
  Video, Home as HomeIcon, Brain, Building2,
  DollarSign, CalendarDays, ShoppingBag, AlarmClock, Mic, Smartphone, WifiOff, ScanLine, MapPin, Phone, Target, Link2, Zap, MessageCircle,
} from "lucide-react";

export interface NavItem { label: string; href: string; icon?: any; badge?: string | number; }
export interface NavSubGroup { label: string; items: NavItem[]; }
export interface NavSection { id: string; label: string; icon: any; subGroups: NavSubGroup[]; }
export interface NavTopLink { id: string; label: string; icon: any; href: string; }
export type NavEntry = NavTopLink | NavSection;

export function isSection(entry: NavEntry): entry is NavSection { return "subGroups" in entry; }

export const navConfig: NavEntry[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/" },
  { id: "search", label: "AI Search", icon: Sparkles, href: "/search" },
  { id: "next-actions", label: "Next Actions", icon: Lightbulb, href: "/next-actions" },

  // ═══ Billing & Finance ═══
  { id: "billing", label: "Billing & Finance", icon: DollarSign, subGroups: [
    { label: "Time", items: [{ label: "Time Tracking", href: "/time", icon: Clock }, { label: "Time Review", href: "/time-tracking/review", icon: Clock }] },
    { label: "Billing & Payments", items: [{ label: "Billing", href: "/billing", icon: Receipt }, { label: "Payments", href: "/payments", icon: CreditCard }, { label: "Swipe to Bill", href: "/billing/swipe", icon: Smartphone }, { label: "Quick Invoice", href: "/quick-invoice", icon: Smartphone }, { label: "Invoicing", href: "/invoicing", icon: FileText }] },
    { label: "Fee Management", items: [{ label: "Fee Structures", href: "/fee-structures", icon: Receipt }, { label: "Fee Splits", href: "/fee-splits", icon: Share2 }, { label: "Contingency Cases", href: "/contingency", icon: Scale }, { label: "Financing", href: "/financing", icon: Wallet }, { label: "Payment Plans", href: "/payment-plans", icon: CreditCard }] },
    { label: "Trust & Compliance", items: [{ label: "Trust Accounting", href: "/trust", icon: Landmark }, { label: "IOLA/Trust Compliance", href: "/trust-accounting", icon: Shield }, { label: "Collections", href: "/collections", icon: Banknote }, { label: "Approvals", href: "/approvals", icon: ClipboardCheck }, { label: "AI Billing Audit", href: "/billing-audit", icon: Shield }] },
    { label: "Accounting & Insights", items: [{ label: "Accounting", href: "/accounting", icon: Calculator }, { label: "Insights", href: "/insights", icon: LineChart }, { label: "Forecasting", href: "/forecasting", icon: LineChart }, { label: "Revenue Forecast", href: "/forecast", icon: TrendingUp }] },
  ]},

  // ═══ Cases & Clients ═══
  { id: "cases", label: "Cases & Clients", icon: Briefcase, subGroups: [
    { label: "Clients & Matters", items: [{ label: "Clients", href: "/clients", icon: Users }, { label: "Matters", href: "/matters", icon: Briefcase }, { label: "Bulk Operations", href: "/bulk-operations", icon: Briefcase }] },
    { label: "Intake & Leads", items: [{ label: "Lead Inbox", href: "/leads", icon: Inbox }, { label: "Intake Forms", href: "/intake-admin", icon: ClipboardList }, { label: "Intake Screening", href: "/screening", icon: ScanSearch }, { label: "AI Intake Chat", href: "/intake-screening", icon: MessageSquare }, { label: "CRM & Intake", href: "/crm", icon: Contact }] },
    { label: "Compliance", items: [{ label: "Conflict Check", href: "/conflicts", icon: ShieldAlert }] },
    { label: "Client Experience", items: [{ label: "Client Portal", href: "/client-portal", icon: Globe }, { label: "Status Updates", href: "/status-updates", icon: Send }, { label: "Client Pulse", href: "/pulse", icon: HeartPulse }, { label: "Portal Settings", href: "/client-portal/settings", icon: Settings }] },
    { label: "Configuration", items: [{ label: "Practice Areas", href: "/practice-areas", icon: Lightbulb }] },
  ]},

  // ═══ Calendar & Tasks ═══
  { id: "calendar", label: "Calendar & Tasks", icon: CalendarDays, subGroups: [
    { label: "Planning", items: [{ label: "Calendar", href: "/calendar", icon: Calendar }, { label: "Tasks", href: "/tasks", icon: CheckSquare }, { label: "Appointments", href: "/appointments", icon: CalendarClock }] },
    { label: "Scheduling", items: [{ label: "Scheduling", href: "/scheduling", icon: CalendarRange }, { label: "Self-Scheduling", href: "/scheduling/appointments", icon: CalendarClock }, { label: "Meetings", href: "/meetings", icon: Video }] },
    { label: "Court & Travel", items: [{ label: "Docketing", href: "/docketing", icon: Gavel }, { label: "Court Mode", href: "/court", icon: Gavel }, { label: "Court Check-In", href: "/location", icon: MapPin }, { label: "Travel Calendar", href: "/mobile-travel-calendar", icon: CalendarClock }] },
  ]},

  // ═══ Documents & Filing ═══
  { id: "documents", label: "Documents & Filing", icon: FileText, subGroups: [
    { label: "Storage & Drafting", items: [{ label: "Documents", href: "/documents", icon: FileText }, { label: "Cloud Storage", href: "/storage", icon: FolderOpen }, { label: "Document Drafting", href: "/drafting", icon: FilePen }, { label: "Doc Scanner", href: "/scanner", icon: ScanLine }] },
    { label: "Review & AI", items: [{ label: "Review & Analysis", href: "/doc-review", icon: ScanEye }, { label: "AI Review Flags", href: "/document-review-flags", icon: Shield }, { label: "Doc Assembly", href: "/document-assembly", icon: FileText }] },
    { label: "Signatures & Filing", items: [{ label: "E-Signatures", href: "/signatures", icon: PenTool }, { label: "E-Sign", href: "/e-sign", icon: PenTool }, { label: "E-Filing", href: "/efiling", icon: Upload }, { label: "Court E-Filing", href: "/efiling-hub", icon: Upload }] },
    { label: "Service & Mail", items: [{ label: "Filing & Service", href: "/filing", icon: Send }, { label: "Service & Reporters", href: "/process-serving", icon: Truck }, { label: "Mail", href: "/mail", icon: Send }] },
    { label: "Discovery", items: [{ label: "Discovery", href: "/discovery", icon: FileQuestion }, { label: "Discovery Checklists", href: "/discovery-hub", icon: ClipboardList }] },
  ]},

  // ═══ Communications (flat — no sub-groups needed, treated as single group) ═══
  { id: "communications", label: "Communications", icon: MessageSquare, subGroups: [
    { label: "Channels", items: [{ label: "Email", href: "/email", icon: Inbox }, { label: "WhatsApp", href: "/whatsapp", icon: MessageCircle }, { label: "Text Messaging", href: "/messaging", icon: MessageSquare }, { label: "Communications", href: "/communications", icon: Headphones }, { label: "Zoom", href: "/zoom", icon: Video }, { label: "Campaigns", href: "/campaigns", icon: Mail }, { label: "Website", href: "/website", icon: Globe }, { label: "Call Log", href: "/calls", icon: Phone }] },
  ]},

  // ═══ Practice Tools ═══
  { id: "practice", label: "Practice Tools", icon: Scale, subGroups: [
    { label: "Practice Areas", items: [{ label: "Family Law", href: "/family", icon: Heart }, { label: "Immigration", href: "/immigration", icon: Globe }, { label: "Conveyancing", href: "/conveyancing", icon: HomeIcon }, { label: "Injury Cases", href: "/injury", icon: HeartPulse }, { label: "PI Medical", href: "/pi-medical", icon: HeartPulse }] },
    { label: "Court & Research", items: [{ label: "Investigations", href: "/investigations", icon: SearchCode }, { label: "Docket Search", href: "/docket-search", icon: SearchCode }, { label: "Court Calendar", href: "/court/calendar", icon: Gavel }, { label: "Court Integrations", href: "/court/integrations", icon: Plug }, { label: "Courts", href: "/courts", icon: Landmark }] },
    { label: "Deadlines & Compliance", items: [{ label: "SOL Tracker", href: "/sol-tracker", icon: AlarmClock }, { label: "Deadline Calculator", href: "/deadline-calculator", icon: Calculator }, { label: "Compliance", href: "/compliance", icon: ShieldCheck }] },
    { label: "Business Development", items: [{ label: "Visuals", href: "/visuals", icon: BarChart3 }, { label: "Referrals", href: "/referrals", icon: Share2 }] },
  ]},

  // ═══ Marketing & Growth (flat) ═══
  { id: "marketing", label: "Marketing & Growth", icon: TrendingUp, subGroups: [
    { label: "Analytics & ROI", items: [{ label: "Profitability", href: "/profitability", icon: TrendingUp }, { label: "Google LSA", href: "/lsa", icon: SearchCode }, { label: "Marketing ROI", href: "/marketing", icon: TrendingUp }, { label: "Reviews", href: "/marketing/reviews", icon: Megaphone }, { label: "Analytics", href: "/analytics", icon: BarChart3 }, { label: "Realization Rate", href: "/analytics/realization", icon: TrendingUp }, { label: "Risk Monitor", href: "/risk", icon: ShieldCheck }, { label: "Referral Tracking", href: "/referral-tracking", icon: Share2 }] },
  ]},

  // ═══ AI & Research (flat) ═══
  { id: "research", label: "AI & Research", icon: Sparkles, subGroups: [
    { label: "Tools & Reports", items: [{ label: "AI Command Center", href: "/ai", icon: Brain }, { label: "AI Assistant", href: "/ai-assistant", icon: Sparkles }, { label: "Legal Research", href: "/research", icon: BookOpen }, { label: "Dashboards", href: "/dashboards", icon: PieChart }, { label: "Reports", href: "/reports", icon: FileBarChart }, { label: "Report Builder", href: "/reports/custom-builder", icon: BarChart3 }, { label: "Marketplace", href: "/marketplace", icon: ShoppingBag }, { label: "KPI Dashboards", href: "/kpi", icon: BarChart3 }, { label: "Voice Notes", href: "/voice-notes", icon: Mic }, { label: "AI Correspondence", href: "/correspondence", icon: PenTool }, { label: "Outcome Predictions", href: "/predictions", icon: Target }] },
  ]},

  // ═══ Firm Management ═══
  { id: "firm", label: "Firm Management", icon: Building2, subGroups: [
    { label: "People & Structure", items: [{ label: "Departments", href: "/departments", icon: Building2 }, { label: "HR", href: "/hr", icon: Users }, { label: "Entities", href: "/entities", icon: Building2 }] },
    { label: "Integrations & Sync", items: [{ label: "Integrations", href: "/integrations", icon: Plug }, { label: "Accounting Sync", href: "/settings/accounting", icon: Link2 }, { label: "API & Zapier", href: "/settings/api", icon: Zap }, { label: "Offline & Sync", href: "/settings/offline", icon: WifiOff }, { label: "Email Settings", href: "/settings/email", icon: Mail }] },
    { label: "Configuration", items: [{ label: "Practice Fields", href: "/settings/practice-fields", icon: Settings }, { label: "Jurisdictions", href: "/settings/jurisdictions", icon: Globe }, { label: "Settings", href: "/settings", icon: Settings }, { label: "Translations", href: "/translations", icon: Globe }, { label: "Security", href: "/security", icon: ShieldCheck }] },
    { label: "Automation & Comms", items: [{ label: "Task Cascades", href: "/settings/task-cascades", icon: CheckSquare }, { label: "Workflows", href: "/settings/workflows", icon: Settings }, { label: "Smart Reminders", href: "/smart-reminders", icon: Brain }, { label: "Daily Digest", href: "/settings/digest", icon: Mail }, { label: "Notifications", href: "/notifications", icon: Inbox }] },
    { label: "Compliance & Support", items: [{ label: "CLE Tracker", href: "/cle", icon: BookOpen }, { label: "Data Migration", href: "/migration", icon: Upload }, { label: "Help", href: "/help", icon: HelpCircle }] },
  ]},
];

/** Find which section contains the given pathname */
export function findActiveSection(pathname: string): string | null {
  for (const entry of navConfig) {
    if (!isSection(entry)) continue;
    for (const sg of entry.subGroups) {
      for (const item of sg.items) {
        if (pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))) return entry.id;
      }
    }
  }
  return null;
}
