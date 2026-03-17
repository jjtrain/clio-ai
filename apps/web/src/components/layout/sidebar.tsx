"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  Users,
  Briefcase,
  Clock,
  FileText,
  Calendar,
  CalendarClock,
  ClipboardList,
  Inbox,
  LayoutDashboard,
  Scale,
  Settings,
  HelpCircle,
  LogOut,
  Receipt,
  Landmark,
  CheckSquare,
  X,
  ShieldAlert,
  PenTool,
  BarChart3,
  FileBarChart,
  PieChart,
  TrendingUp,
  LineChart,
  ShieldCheck,
  Mail,
  Globe,
  Sparkles,
  BookOpen,
  FilePen,
  ScanSearch,
  Upload,
  UserCircle,
  MessageSquare,
  HeartPulse,
  CreditCard,
  Wallet,
  ClipboardCheck,
  Calculator,
  Plug,
  Gavel,
  FileQuestion,
  Heart,
  Send,
  SearchCode,
  ScanEye,
  Banknote,
  Headphones,
  Contact,
  Megaphone,
  CalendarRange,
  Truck,
  FolderOpen,
  Share2,
  Lightbulb,
  Video,
} from "lucide-react";

const mainNavigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Clients", href: "/clients", icon: Users },
  { name: "Matters", href: "/matters", icon: Briefcase },
  { name: "Tasks", href: "/tasks", icon: CheckSquare },
  { name: "Time Tracking", href: "/time", icon: Clock },
  { name: "Billing", href: "/billing", icon: Receipt },
  { name: "Trust Accounting", href: "/trust", icon: Landmark },
  { name: "Documents", href: "/documents", icon: FileText },
  { name: "Cloud Storage", href: "/storage", icon: FolderOpen },
  { name: "Calendar", href: "/calendar", icon: Calendar },
  { name: "Appointments", href: "/appointments", icon: CalendarClock },
  { name: "Intake Forms", href: "/intake-forms", icon: ClipboardList },
  { name: "Lead Inbox", href: "/leads", icon: Inbox },
  { name: "Conflict Check", href: "/conflicts", icon: ShieldAlert },
  { name: "E-Signatures", href: "/signatures", icon: PenTool },
  { name: "Reports", href: "/reports", icon: FileBarChart },
  { name: "Dashboards", href: "/dashboards", icon: PieChart },
  { name: "Marketing ROI", href: "/marketing", icon: TrendingUp },
  { name: "Forecasting", href: "/forecasting", icon: LineChart },
  { name: "Risk Monitor", href: "/risk", icon: ShieldCheck },
  { name: "Injury Cases", href: "/injury", icon: HeartPulse },
  { name: "PI Medical", href: "/pi-medical", icon: HeartPulse },
  { name: "Payments", href: "/payments", icon: CreditCard },
  { name: "Financing", href: "/financing", icon: Wallet },
  { name: "Collections", href: "/collections", icon: Banknote },
  { name: "Approvals", href: "/approvals", icon: ClipboardCheck },
  { name: "Accounting", href: "/accounting", icon: Calculator },
  { name: "Insights", href: "/insights", icon: LineChart },
  { name: "Integrations", href: "/integrations", icon: Plug },
  { name: "Docketing", href: "/docketing", icon: Gavel },
  { name: "Discovery", href: "/discovery", icon: FileQuestion },
  { name: "Family Law", href: "/family", icon: Heart },
  { name: "Filing & Service", href: "/filing", icon: Send },
  { name: "Service & Reporters", href: "/process-serving", icon: Truck },
  { name: "Docket Search", href: "/docket-search", icon: SearchCode },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Campaigns", href: "/campaigns", icon: Mail },
  { name: "Website", href: "/website", icon: Globe },
  { name: "AI Assistant", href: "/ai-assistant", icon: Sparkles },
  { name: "Legal Research", href: "/research", icon: BookOpen },
  { name: "Review & Analysis", href: "/doc-review", icon: ScanEye },
  { name: "Document Drafting", href: "/drafting", icon: FilePen },
  { name: "Intake Screening", href: "/screening", icon: ScanSearch },
  { name: "E-Filing", href: "/efiling", icon: Upload },
  { name: "Client Portal", href: "/client-portal", icon: UserCircle },
  { name: "Text Messaging", href: "/messaging", icon: MessageSquare },
  { name: "Communications", href: "/communications", icon: Headphones },
  { name: "Zoom", href: "/zoom", icon: Video },
  { name: "Referrals", href: "/referrals", icon: Share2 },
  { name: "CRM & Intake", href: "/crm", icon: Contact },
  { name: "Reviews", href: "/marketing/reviews", icon: Megaphone },
  { name: "Scheduling", href: "/scheduling", icon: CalendarRange },
  { name: "Time Review", href: "/time-tracking/review", icon: Clock },
];

const bottomNavigation = [
  { name: "Settings", href: "/settings", icon: Settings },
  { name: "Help", href: "/help", icon: HelpCircle },
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  const userName = session?.user?.name || "User";
  const userEmail = session?.user?.email || "";
  const userInitials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U";

  const handleLinkClick = () => {
    // Close sidebar on mobile when a link is clicked
    if (onClose) {
      onClose();
    }
  };

  return (
    <div className="flex h-full w-64 flex-col bg-slate-900">
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500">
            <Scale className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="text-lg font-semibold text-white">Clio AI</span>
            <p className="text-xs text-slate-400">Legal Practice</p>
          </div>
        </div>
        {/* Close button - only visible on mobile */}
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <div className="space-y-1">
          {mainNavigation.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={handleLinkClick}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-blue-500 text-white shadow-lg shadow-blue-500/25"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                )}
              >
                <item.icon className={cn("h-5 w-5 flex-shrink-0", isActive ? "text-white" : "text-slate-400")} />
                <span className="truncate">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Bottom Navigation */}
      <div className="px-3 py-4 border-t border-slate-800">
        <div className="space-y-1">
          {bottomNavigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={handleLinkClick}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-slate-800 text-white"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                )}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                <span className="truncate">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* User Profile */}
      <div className="px-3 py-4 border-t border-slate-800">
        {status === "loading" ? (
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="h-9 w-9 rounded-full bg-slate-700 animate-pulse flex-shrink-0"></div>
            <div className="flex-1 space-y-2 min-w-0">
              <div className="h-4 bg-slate-700 rounded animate-pulse w-20"></div>
              <div className="h-3 bg-slate-700 rounded animate-pulse w-28"></div>
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
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-all duration-200"
            >
              <LogOut className="h-5 w-5 flex-shrink-0" />
              <span className="truncate">Sign out</span>
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            onClick={handleLinkClick}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-all duration-200"
          >
            Sign in
          </Link>
        )}
      </div>
    </div>
  );
}
