"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  Users, Briefcase, Clock, FileText, Calendar, CalendarClock, ClipboardList,
  Inbox, LayoutDashboard, Scale, Settings, HelpCircle, LogOut, Receipt,
  Landmark, CheckSquare, X, ShieldAlert, PenTool, BarChart3, FileBarChart,
  PieChart, TrendingUp, LineChart, ShieldCheck, Mail, Globe, Sparkles,
  BookOpen, FilePen, ScanSearch, Upload, UserCircle, MessageSquare,
  HeartPulse, CreditCard, Wallet, ClipboardCheck, Calculator, Plug, Gavel,
  FileQuestion, Heart, Send, SearchCode, ScanEye, Banknote, Headphones,
  Contact, Megaphone, CalendarRange, Truck, FolderOpen, Share2, Lightbulb,
  Video, Home as HomeIcon, Brain, ChevronDown, ChevronRight, Building2,
  DollarSign, CalendarDays, ShoppingBag, AlarmClock, Mic, Smartphone, WifiOff, ScanLine, MapPin, Phone,
} from "lucide-react";

interface NavChild {
  label: string;
  href: string;
  icon?: any;
}

interface NavGroup {
  id: string;
  label: string;
  icon: any;
  href?: string;
  children?: NavChild[];
}

const navGroups: NavGroup[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/" },
  {
    id: "cases", label: "Cases & Clients", icon: Briefcase,
    children: [
      { label: "Clients", href: "/clients", icon: Users },
      { label: "Matters", href: "/matters", icon: Briefcase },
      { label: "Lead Inbox", href: "/leads", icon: Inbox },
      { label: "Intake Forms", href: "/intake-admin", icon: ClipboardList },
      { label: "Intake Screening", href: "/screening", icon: ScanSearch },
      { label: "CRM & Intake", href: "/crm", icon: Contact },
      { label: "Conflict Check", href: "/conflicts", icon: ShieldAlert },
      { label: "Client Portal", href: "/client-portal", icon: UserCircle },
      { label: "Practice Areas", href: "/practice-areas", icon: Lightbulb },
    ],
  },
  {
    id: "calendar", label: "Calendar & Tasks", icon: CalendarDays,
    children: [
      { label: "Calendar", href: "/calendar", icon: Calendar },
      { label: "Tasks", href: "/tasks", icon: CheckSquare },
      { label: "Appointments", href: "/appointments", icon: CalendarClock },
      { label: "Scheduling", href: "/scheduling", icon: CalendarRange },
      { label: "Docketing", href: "/docketing", icon: Gavel },
      { label: "Court Mode", href: "/court", icon: Gavel },
      { label: "Court Check-In", href: "/location", icon: MapPin },
      { label: "Travel Calendar", href: "/mobile-travel-calendar", icon: CalendarClock },
    ],
  },
  {
    id: "documents", label: "Documents & Filing", icon: FileText,
    children: [
      { label: "Documents", href: "/documents", icon: FileText },
      { label: "Cloud Storage", href: "/storage", icon: FolderOpen },
      { label: "Document Drafting", href: "/drafting", icon: FilePen },
      { label: "Review & Analysis", href: "/doc-review", icon: ScanEye },
      { label: "E-Signatures", href: "/signatures", icon: PenTool },
      { label: "E-Filing", href: "/efiling", icon: Upload },
      { label: "Filing & Service", href: "/filing", icon: Send },
      { label: "Service & Reporters", href: "/process-serving", icon: Truck },
      { label: "Mail", href: "/mail", icon: Send },
      { label: "Discovery", href: "/discovery", icon: FileQuestion },
      { label: "Doc Scanner", href: "/scanner", icon: ScanLine },
      { label: "E-Sign", href: "/e-sign", icon: PenTool },
    ],
  },
  {
    id: "communications", label: "Communications", icon: MessageSquare,
    children: [
      { label: "Email", href: "/email", icon: Inbox },
      { label: "Text Messaging", href: "/messaging", icon: MessageSquare },
      { label: "Communications", href: "/communications", icon: Headphones },
      { label: "Zoom", href: "/zoom", icon: Video },
      { label: "Campaigns", href: "/campaigns", icon: Mail },
      { label: "Website", href: "/website", icon: Globe },
      { label: "Call Log", href: "/calls", icon: Phone },
    ],
  },
  {
    id: "billing", label: "Billing & Finance", icon: DollarSign,
    children: [
      { label: "Time Tracking", href: "/time", icon: Clock },
      { label: "Time Review", href: "/time-tracking/review", icon: Clock },
      { label: "Billing", href: "/billing", icon: Receipt },
      { label: "Payments", href: "/payments", icon: CreditCard },
      { label: "Financing", href: "/financing", icon: Wallet },
      { label: "Trust Accounting", href: "/trust", icon: Landmark },
      { label: "Collections", href: "/collections", icon: Banknote },
      { label: "Approvals", href: "/approvals", icon: ClipboardCheck },
      { label: "Accounting", href: "/accounting", icon: Calculator },
      { label: "Insights", href: "/insights", icon: LineChart },
      { label: "Forecasting", href: "/forecasting", icon: LineChart },
      { label: "Swipe to Bill", href: "/billing/swipe", icon: Smartphone },
    ],
  },
  {
    id: "practice", label: "Practice Tools", icon: Scale,
    children: [
      { label: "Family Law", href: "/family", icon: Heart },
      { label: "Immigration", href: "/immigration", icon: Globe },
      { label: "Conveyancing", href: "/conveyancing", icon: HomeIcon },
      { label: "Injury Cases", href: "/injury", icon: HeartPulse },
      { label: "PI Medical", href: "/pi-medical", icon: HeartPulse },
      { label: "Investigations", href: "/investigations", icon: SearchCode },
      { label: "Docket Search", href: "/docket-search", icon: SearchCode },
      { label: "Visuals", href: "/visuals", icon: BarChart3 },
      { label: "Compliance", href: "/compliance", icon: ShieldCheck },
      { label: "Referrals", href: "/referrals", icon: Share2 },
      { label: "SOL Tracker", href: "/sol-tracker", icon: AlarmClock },
      { label: "Courts", href: "/courts", icon: Landmark },
    ],
  },
  {
    id: "marketing", label: "Marketing & Growth", icon: TrendingUp,
    children: [
      { label: "Google LSA", href: "/lsa", icon: SearchCode },
      { label: "Marketing ROI", href: "/marketing", icon: TrendingUp },
      { label: "Reviews", href: "/marketing/reviews", icon: Megaphone },
      { label: "Analytics", href: "/analytics", icon: BarChart3 },
      { label: "Risk Monitor", href: "/risk", icon: ShieldCheck },
    ],
  },
  {
    id: "research", label: "AI & Research", icon: Sparkles,
    children: [
      { label: "AI Command Center", href: "/ai", icon: Brain },
      { label: "AI Assistant", href: "/ai-assistant", icon: Sparkles },
      { label: "Legal Research", href: "/research", icon: BookOpen },
      { label: "Dashboards", href: "/dashboards", icon: PieChart },
      { label: "Reports", href: "/reports", icon: FileBarChart },
      { label: "Marketplace", href: "/marketplace", icon: ShoppingBag },
      { label: "KPI Dashboards", href: "/kpi", icon: BarChart3 },
      { label: "Voice Notes", href: "/voice-notes", icon: Mic },
    ],
  },
  {
    id: "firm", label: "Firm Management", icon: Building2,
    children: [
      { label: "Departments", href: "/departments", icon: Building2 },
      { label: "HR", href: "/hr", icon: Users },
      { label: "Integrations", href: "/integrations", icon: Plug },
      { label: "Security", href: "/security", icon: ShieldCheck },
      { label: "Practice Fields", href: "/settings/practice-fields", icon: Settings },
      { label: "Jurisdictions", href: "/settings/jurisdictions", icon: Globe },
      { label: "Settings", href: "/settings", icon: Settings },
      { label: "Help", href: "/help", icon: HelpCircle },
      { label: "Offline & Sync", href: "/settings/offline", icon: WifiOff },
      { label: "Notifications", href: "/notifications", icon: Inbox },
    ],
  },
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  // Determine which groups should be expanded
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("sidebar-expanded");
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return {};
  });

  // Auto-expand the group containing the active route
  useEffect(() => {
    for (const group of navGroups) {
      if (group.children) {
        const isActive = group.children.some(
          (child) => pathname === child.href || (child.href !== "/" && pathname.startsWith(child.href))
        );
        if (isActive && !expanded[group.id]) {
          setExpanded((prev) => ({ ...prev, [group.id]: true }));
        }
      }
    }
  }, [pathname]);

  // Persist expanded state
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("sidebar-expanded", JSON.stringify(expanded));
    }
  }, [expanded]);

  const toggleGroup = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const userName = session?.user?.name || "User";
  const userEmail = session?.user?.email || "";
  const userInitials = userName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "U";

  const handleLinkClick = () => { if (onClose) onClose(); };

  return (
    <div className="flex h-full w-64 flex-col bg-slate-900">
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500">
            <Scale className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="text-lg font-semibold text-white">Managal</span>
            <p className="text-xs text-slate-400">Legal Practice Management</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors" aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <div className="space-y-0.5">
          {navGroups.map((group) => {
            // Single link (no children)
            if (group.href && !group.children) {
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

            // Group with children
            const isExpanded = expanded[group.id] ?? false;
            const hasActiveChild = group.children?.some(
              (child) => pathname === child.href || (child.href !== "/" && pathname.startsWith(child.href))
            );

            return (
              <div key={group.id}>
                <button onClick={() => toggleGroup(group.id)}
                  className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 w-full",
                    hasActiveChild ? "text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  )}>
                  <group.icon className={cn("h-5 w-5 flex-shrink-0", hasActiveChild ? "text-blue-400" : "text-slate-400")} />
                  <span className="truncate flex-1 text-left">{group.label}</span>
                  {isExpanded
                    ? <ChevronDown className="h-4 w-4 text-slate-500 flex-shrink-0" />
                    : <ChevronRight className="h-4 w-4 text-slate-500 flex-shrink-0" />}
                </button>
                {isExpanded && group.children && (
                  <div className="mt-0.5 ml-3 pl-3 border-l border-slate-800 space-y-0.5">
                    {group.children.map((child) => {
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
            <div className="flex-1 space-y-2 min-w-0">
              <div className="h-4 bg-slate-700 rounded animate-pulse w-20" />
              <div className="h-3 bg-slate-700 rounded animate-pulse w-28" />
            </div>
          </div>
        ) : session ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-semibold text-white">{userInitials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{userName}</p>
                <p className="text-xs text-slate-400 truncate">{userEmail}</p>
              </div>
            </div>
            <button onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-all duration-200">
              <LogOut className="h-5 w-5 flex-shrink-0" />
              <span className="truncate">Sign out</span>
            </button>
          </div>
        ) : (
          <Link href="/login" onClick={handleLinkClick}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-all duration-200">
            Sign in
          </Link>
        )}
      </div>
    </div>
  );
}

