"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  Users, Briefcase, Clock, FileText, Calendar, CalendarClock, ClipboardList,
  Inbox, LayoutDashboard, Scale, Settings, HelpCircle, LogOut, Receipt,
  Landmark, CheckSquare, X, ShieldAlert, Shield, PenTool, BarChart3, FileBarChart,
  PieChart, TrendingUp, LineChart, ShieldCheck, Mail, Globe, Sparkles,
  BookOpen, FilePen, ScanSearch, Upload, UserCircle, MessageSquare,
  HeartPulse, CreditCard, Wallet, ClipboardCheck, Calculator, Plug, Gavel,
  FileQuestion, Heart, Send, SearchCode, ScanEye, Banknote, Headphones,
  Contact, Megaphone, CalendarRange, Truck, FolderOpen, Share2, Lightbulb,
  Video, Home as HomeIcon, Brain, ChevronDown, ChevronRight, Building2,
  DollarSign, CalendarDays, ShoppingBag, AlarmClock, Mic, Smartphone, WifiOff, ScanLine, MapPin, Phone, Target, Link2, Zap, MessageCircle,
} from "lucide-react";

interface NavChild {
  label: string;
  href: string;
  icon?: any;
}

interface SubGroup {
  label: string;
  items: NavChild[];
}

interface NavGroup {
  id: string;
  label: string;
  icon: any;
  href?: string;
  children?: NavChild[];
  subGroups?: SubGroup[];
}

const navGroups: NavGroup[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/" },
  { id: "search", label: "AI Search", icon: Sparkles, href: "/search" },
  { id: "next-actions", label: "Next Actions", icon: Lightbulb, href: "/next-actions" },

  // ═══ Cases & Clients (13 items → 5 sub-groups) ═══
  {
    id: "cases", label: "Cases & Clients", icon: Briefcase,
    subGroups: [
      { label: "Core Records", items: [
        { label: "Clients", href: "/clients", icon: Users },
        { label: "Matters", href: "/matters", icon: Briefcase },
        { label: "Bulk Operations", href: "/bulk-operations", icon: Briefcase },
      ]},
      { label: "Intake & Leads", items: [
        { label: "Lead Inbox", href: "/leads", icon: Inbox },
        { label: "Intake Forms", href: "/intake-admin", icon: ClipboardList },
        { label: "Intake Screening", href: "/screening", icon: ScanSearch },
        { label: "AI Intake Chat", href: "/intake-screening", icon: MessageSquare },
        { label: "CRM & Intake", href: "/crm", icon: Contact },
      ]},
      { label: "Compliance", items: [
        { label: "Conflict Check", href: "/conflicts", icon: ShieldAlert },
      ]},
      { label: "Client Engagement", items: [
        { label: "Client Portal", href: "/client-portal", icon: Globe },
        { label: "Status Updates", href: "/status-updates", icon: Send },
        { label: "Client Pulse", href: "/pulse", icon: HeartPulse },
        { label: "Portal Settings", href: "/client-portal/settings", icon: Settings },
      ]},
      { label: "Configuration", items: [
        { label: "Practice Areas", href: "/practice-areas", icon: Lightbulb },
      ]},
    ],
  },

  // ═══ Calendar & Tasks (10 items → 3 sub-groups) ═══
  {
    id: "calendar", label: "Calendar & Tasks", icon: CalendarDays,
    subGroups: [
      { label: "Scheduling", items: [
        { label: "Calendar", href: "/calendar", icon: Calendar },
        { label: "Appointments", href: "/appointments", icon: CalendarClock },
        { label: "Scheduling", href: "/scheduling", icon: CalendarRange },
        { label: "Self-Scheduling", href: "/scheduling/appointments", icon: CalendarClock },
        { label: "Meetings", href: "/meetings", icon: Video },
      ]},
      { label: "Tasks & Dockets", items: [
        { label: "Tasks", href: "/tasks", icon: CheckSquare },
        { label: "Docketing", href: "/docketing", icon: Gavel },
      ]},
      { label: "Court & Travel", items: [
        { label: "Court Mode", href: "/court", icon: Gavel },
        { label: "Court Check-In", href: "/location", icon: MapPin },
        { label: "Travel Calendar", href: "/mobile-travel-calendar", icon: CalendarClock },
      ]},
    ],
  },

  // ═══ Documents & Filing (16 items → 5 sub-groups) ═══
  {
    id: "documents", label: "Documents & Filing", icon: FileText,
    subGroups: [
      { label: "Document Management", items: [
        { label: "Documents", href: "/documents", icon: FileText },
        { label: "Cloud Storage", href: "/storage", icon: FolderOpen },
        { label: "Doc Scanner", href: "/scanner", icon: ScanLine },
      ]},
      { label: "Drafting & Assembly", items: [
        { label: "Document Drafting", href: "/drafting", icon: FilePen },
        { label: "Doc Assembly", href: "/document-assembly", icon: FileText },
        { label: "Review & Analysis", href: "/doc-review", icon: ScanEye },
        { label: "AI Review Flags", href: "/document-review-flags", icon: Shield },
      ]},
      { label: "Signatures", items: [
        { label: "E-Signatures", href: "/signatures", icon: PenTool },
        { label: "E-Sign", href: "/e-sign", icon: PenTool },
      ]},
      { label: "Filing & Service", items: [
        { label: "E-Filing", href: "/efiling", icon: Upload },
        { label: "Court E-Filing", href: "/efiling-hub", icon: Upload },
        { label: "Filing & Service", href: "/filing", icon: Send },
        { label: "Service & Reporters", href: "/process-serving", icon: Truck },
        { label: "Mail", href: "/mail", icon: Send },
      ]},
      { label: "Discovery", items: [
        { label: "Discovery", href: "/discovery", icon: FileQuestion },
        { label: "Discovery Checklists", href: "/discovery-hub", icon: ClipboardList },
      ]},
    ],
  },

  // ═══ Communications (≤8 items — flat, no sub-groups) ═══
  {
    id: "communications", label: "Communications", icon: MessageSquare,
    children: [
      { label: "Email", href: "/email", icon: Inbox },
      { label: "WhatsApp", href: "/whatsapp", icon: MessageCircle },
      { label: "Text Messaging", href: "/messaging", icon: MessageSquare },
      { label: "Communications", href: "/communications", icon: Headphones },
      { label: "Zoom", href: "/zoom", icon: Video },
      { label: "Campaigns", href: "/campaigns", icon: Mail },
      { label: "Website", href: "/website", icon: Globe },
      { label: "Call Log", href: "/calls", icon: Phone },
    ],
  },

  // ═══ Billing & Finance (21 items → 5 sub-groups) ═══
  {
    id: "billing", label: "Billing & Finance", icon: DollarSign,
    subGroups: [
      { label: "Time & Billing", items: [
        { label: "Time Tracking", href: "/time", icon: Clock },
        { label: "Time Review", href: "/time-tracking/review", icon: Clock },
        { label: "Billing", href: "/billing", icon: Receipt },
        { label: "Invoicing", href: "/invoicing", icon: FileText },
        { label: "Quick Invoice", href: "/quick-invoice", icon: Smartphone },
        { label: "Swipe to Bill", href: "/billing/swipe", icon: Smartphone },
      ]},
      { label: "Payments & Collections", items: [
        { label: "Payments", href: "/payments", icon: CreditCard },
        { label: "Payment Plans", href: "/payment-plans", icon: CreditCard },
        { label: "Financing", href: "/financing", icon: Wallet },
        { label: "Collections", href: "/collections", icon: Banknote },
      ]},
      { label: "Trust & Accounting", items: [
        { label: "Trust Accounting", href: "/trust", icon: Landmark },
        { label: "IOLA/Trust Compliance", href: "/trust-accounting", icon: Shield },
        { label: "Accounting", href: "/accounting", icon: Calculator },
        { label: "Approvals", href: "/approvals", icon: ClipboardCheck },
      ]},
      { label: "Fee Management", items: [
        { label: "Fee Structures", href: "/fee-structures", icon: Receipt },
        { label: "Fee Splits", href: "/fee-splits", icon: Share2 },
        { label: "Contingency Cases", href: "/contingency", icon: Scale },
      ]},
      { label: "Analytics & Audit", items: [
        { label: "AI Billing Audit", href: "/billing-audit", icon: Shield },
        { label: "Insights", href: "/insights", icon: LineChart },
        { label: "Forecasting", href: "/forecasting", icon: LineChart },
        { label: "Revenue Forecast", href: "/forecast", icon: TrendingUp },
      ]},
    ],
  },

  // ═══ Practice Tools (15 items → 4 sub-groups) ═══
  {
    id: "practice", label: "Practice Tools", icon: Scale,
    subGroups: [
      { label: "Practice Areas", items: [
        { label: "Family Law", href: "/family", icon: Heart },
        { label: "Immigration", href: "/immigration", icon: Globe },
        { label: "Conveyancing", href: "/conveyancing", icon: HomeIcon },
        { label: "Injury Cases", href: "/injury", icon: HeartPulse },
        { label: "PI Medical", href: "/pi-medical", icon: HeartPulse },
      ]},
      { label: "Court & Research", items: [
        { label: "Investigations", href: "/investigations", icon: SearchCode },
        { label: "Docket Search", href: "/docket-search", icon: SearchCode },
        { label: "Court Calendar", href: "/court/calendar", icon: Gavel },
        { label: "Court Integrations", href: "/court/integrations", icon: Plug },
        { label: "Courts", href: "/courts", icon: Landmark },
      ]},
      { label: "Deadlines & Compliance", items: [
        { label: "SOL Tracker", href: "/sol-tracker", icon: AlarmClock },
        { label: "Deadline Calculator", href: "/deadline-calculator", icon: Calculator },
        { label: "Compliance", href: "/compliance", icon: ShieldCheck },
      ]},
      { label: "Business Development", items: [
        { label: "Visuals", href: "/visuals", icon: BarChart3 },
        { label: "Referrals", href: "/referrals", icon: Share2 },
      ]},
    ],
  },

  // ═══ Marketing & Growth (≤8 items — flat) ═══
  {
    id: "marketing", label: "Marketing & Growth", icon: TrendingUp,
    children: [
      { label: "Profitability", href: "/profitability", icon: TrendingUp },
      { label: "Google LSA", href: "/lsa", icon: SearchCode },
      { label: "Marketing ROI", href: "/marketing", icon: TrendingUp },
      { label: "Reviews", href: "/marketing/reviews", icon: Megaphone },
      { label: "Analytics", href: "/analytics", icon: BarChart3 },
      { label: "Realization Rate", href: "/analytics/realization", icon: TrendingUp },
      { label: "Risk Monitor", href: "/risk", icon: ShieldCheck },
      { label: "Referral Tracking", href: "/referral-tracking", icon: Share2 },
    ],
  },

  // ═══ AI & Research (≤11 items — flat) ═══
  {
    id: "research", label: "AI & Research", icon: Sparkles,
    children: [
      { label: "AI Command Center", href: "/ai", icon: Brain },
      { label: "AI Assistant", href: "/ai-assistant", icon: Sparkles },
      { label: "Legal Research", href: "/research", icon: BookOpen },
      { label: "Dashboards", href: "/dashboards", icon: PieChart },
      { label: "Reports", href: "/reports", icon: FileBarChart },
      { label: "Report Builder", href: "/reports/custom-builder", icon: BarChart3 },
      { label: "Marketplace", href: "/marketplace", icon: ShoppingBag },
      { label: "KPI Dashboards", href: "/kpi", icon: BarChart3 },
      { label: "Voice Notes", href: "/voice-notes", icon: Mic },
      { label: "AI Correspondence", href: "/correspondence", icon: PenTool },
      { label: "Outcome Predictions", href: "/predictions", icon: Target },
    ],
  },

  // ═══ Firm Management (21 items → 5 sub-groups) ═══
  {
    id: "firm", label: "Firm Management", icon: Building2,
    subGroups: [
      { label: "People & Structure", items: [
        { label: "Departments", href: "/departments", icon: Building2 },
        { label: "HR", href: "/hr", icon: Users },
        { label: "Entities", href: "/entities", icon: Building2 },
      ]},
      { label: "Integrations & Sync", items: [
        { label: "Integrations", href: "/integrations", icon: Plug },
        { label: "Accounting Sync", href: "/settings/accounting", icon: Link2 },
        { label: "API & Zapier", href: "/settings/api", icon: Zap },
        { label: "Offline & Sync", href: "/settings/offline", icon: WifiOff },
        { label: "Email Settings", href: "/settings/email", icon: Mail },
      ]},
      { label: "Configuration", items: [
        { label: "Practice Fields", href: "/settings/practice-fields", icon: Settings },
        { label: "Jurisdictions", href: "/settings/jurisdictions", icon: Globe },
        { label: "Settings", href: "/settings", icon: Settings },
        { label: "Translations", href: "/translations", icon: Globe },
        { label: "Security", href: "/security", icon: ShieldCheck },
      ]},
      { label: "Automation & Comms", items: [
        { label: "Task Cascades", href: "/settings/task-cascades", icon: CheckSquare },
        { label: "Workflows", href: "/settings/workflows", icon: Settings },
        { label: "Smart Reminders", href: "/smart-reminders", icon: Brain },
        { label: "Daily Digest", href: "/settings/digest", icon: Mail },
        { label: "Notifications", href: "/notifications", icon: Inbox },
      ]},
      { label: "Compliance & Support", items: [
        { label: "CLE Tracker", href: "/cle", icon: BookOpen },
        { label: "Data Migration", href: "/migration", icon: Upload },
        { label: "Help", href: "/help", icon: HelpCircle },
      ]},
    ],
  },
];

// Helper: flatten all children from subGroups for active-route detection
function getAllChildren(group: NavGroup): NavChild[] {
  if (group.children) return group.children;
  if (group.subGroups) return group.subGroups.flatMap((sg) => sg.items);
  return [];
}

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    if (typeof window !== "undefined") {
      try { const saved = localStorage.getItem("sidebar-expanded"); if (saved) return JSON.parse(saved); } catch {}
    }
    return {};
  });

  const [subExpanded, setSubExpanded] = useState<Record<string, boolean>>(() => {
    if (typeof window !== "undefined") {
      try { const saved = localStorage.getItem("sidebar-sub-expanded"); if (saved) return JSON.parse(saved); } catch {}
    }
    return {};
  });

  // Auto-expand group containing active route
  useEffect(() => {
    for (const group of navGroups) {
      const children = getAllChildren(group);
      const isActive = children.some((child) => pathname === child.href || (child.href !== "/" && pathname.startsWith(child.href)));
      if (isActive && !expanded[group.id]) {
        setExpanded((prev) => ({ ...prev, [group.id]: true }));
      }
      // Auto-expand sub-group containing active route
      if (isActive && group.subGroups) {
        for (const sg of group.subGroups) {
          const sgKey = `${group.id}:${sg.label}`;
          const sgActive = sg.items.some((item) => pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href)));
          if (sgActive && !subExpanded[sgKey]) {
            setSubExpanded((prev) => ({ ...prev, [sgKey]: true }));
          }
        }
      }
    }
  }, [pathname]);

  useEffect(() => { if (typeof window !== "undefined") localStorage.setItem("sidebar-expanded", JSON.stringify(expanded)); }, [expanded]);
  useEffect(() => { if (typeof window !== "undefined") localStorage.setItem("sidebar-sub-expanded", JSON.stringify(subExpanded)); }, [subExpanded]);

  const toggleGroup = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleSubGroup = (key: string) => setSubExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const userName = session?.user?.name || "User";
  const userEmail = session?.user?.email || "";
  const userInitials = userName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "U";
  const handleLinkClick = () => { if (onClose) onClose(); };

  function renderNavLink(child: NavChild) {
    const isActive = pathname === child.href || (child.href !== "/" && pathname.startsWith(child.href));
    return (
      <Link key={child.href} href={child.href} onClick={handleLinkClick}
        className={cn("flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all duration-200",
          isActive ? "bg-blue-500/20 text-blue-300 font-medium" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
        )}>
        {child.icon && <child.icon className={cn("h-3.5 w-3.5 flex-shrink-0", isActive ? "text-blue-400" : "text-slate-500")} />}
        <span className="truncate">{child.label}</span>
      </Link>
    );
  }

  return (
    <div className="flex h-full w-64 flex-col bg-slate-900">
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500"><Scale className="h-5 w-5 text-white" /></div>
          <div><span className="text-lg font-semibold text-white">Managal</span><p className="text-xs text-slate-400">Legal Practice Management</p></div>
        </div>
        {onClose && <button onClick={onClose} className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors" aria-label="Close menu"><X className="h-5 w-5" /></button>}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <div className="space-y-0.5">
          {navGroups.map((group) => {
            // Single link
            if (group.href && !group.children && !group.subGroups) {
              const isActive = pathname === group.href;
              return (
                <Link key={group.id} href={group.href} onClick={handleLinkClick}
                  className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    isActive ? "bg-blue-500 text-white shadow-lg shadow-blue-500/25" : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  )}>
                  <group.icon className={cn("h-5 w-5 flex-shrink-0", isActive ? "text-white" : "text-slate-400")} />
                  <span className="truncate">{group.label}</span>
                </Link>
              );
            }

            const allChildren = getAllChildren(group);
            const isExpanded = expanded[group.id] ?? false;
            const hasActiveChild = allChildren.some((child) => pathname === child.href || (child.href !== "/" && pathname.startsWith(child.href)));

            return (
              <div key={group.id}>
                <button onClick={() => toggleGroup(group.id)}
                  className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 w-full",
                    hasActiveChild ? "text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  )}>
                  <group.icon className={cn("h-5 w-5 flex-shrink-0", hasActiveChild ? "text-blue-400" : "text-slate-400")} />
                  <span className="truncate flex-1 text-left">{group.label}</span>
                  {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-500 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-slate-500 flex-shrink-0" />}
                </button>

                {isExpanded && (
                  <div className="mt-0.5 ml-3 pl-3 border-l border-slate-800 space-y-0.5">
                    {/* Flat children (no sub-groups) */}
                    {group.children && group.children.map(renderNavLink)}

                    {/* Sub-grouped children */}
                    {group.subGroups && group.subGroups.map((sg) => {
                      const sgKey = `${group.id}:${sg.label}`;
                      const sgExpanded = subExpanded[sgKey] ?? true; // default open
                      const sgActive = sg.items.some((item) => pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href)));

                      return (
                        <div key={sgKey}>
                          <button onClick={() => toggleSubGroup(sgKey)}
                            className="flex items-center gap-1 w-full px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300 transition-colors">
                            {sgExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            <span>{sg.label}</span>
                          </button>
                          {sgExpanded && (
                            <div className="space-y-0.5">
                              {sg.items.map(renderNavLink)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      {/* User Profile */}
      <div className="px-3 py-4 border-t border-slate-800">
        {status === "loading" ? (
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="h-9 w-9 rounded-full bg-slate-700 animate-pulse flex-shrink-0" />
            <div className="flex-1 space-y-2 min-w-0"><div className="h-4 bg-slate-700 rounded animate-pulse w-20" /><div className="h-3 bg-slate-700 rounded animate-pulse w-28" /></div>
          </div>
        ) : session ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0"><span className="text-sm font-semibold text-white">{userInitials}</span></div>
              <div className="flex-1 min-w-0"><p className="text-sm font-medium text-white truncate">{userName}</p><p className="text-xs text-slate-400 truncate">{userEmail}</p></div>
            </div>
            <button onClick={() => signOut({ callbackUrl: "/login" })} className="flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-all duration-200"><LogOut className="h-5 w-5 flex-shrink-0" /><span className="truncate">Sign out</span></button>
          </div>
        ) : (
          <Link href="/login" onClick={handleLinkClick} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-all duration-200">Sign in</Link>
        )}
      </div>
    </div>
  );
}
