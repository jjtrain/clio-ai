"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MessageCircle, FileText, Briefcase, Receipt, CheckSquare, Bell, LogOut, Menu, X } from "lucide-react";
import { usePortalTheme, t } from "./PortalThemeProvider";
import { cn } from "@/lib/utils";

interface PortalLayoutProps {
  children: React.ReactNode;
  matterId?: string;
  userName?: string;
  unreadNotifications?: number;
  onLogout?: () => void;
}

export function PortalLayout({ children, matterId, userName, unreadNotifications = 0, onLogout }: PortalLayoutProps) {
  const theme = usePortalTheme();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const matterLabel = t("matter", theme);

  const navItems = [
    { label: "Home", href: "/portal", icon: Home },
    { label: "Messages", href: matterId ? `/portal/matter/${matterId}/messages` : "/portal/messages", icon: MessageCircle },
    { label: "Documents", href: matterId ? `/portal/matter/${matterId}/documents` : "/portal/documents", icon: FileText },
    { label: matterLabel === "matter" ? "My Case" : `My ${matterLabel}`, href: matterId ? `/portal/matter/${matterId}` : "/portal/matters", icon: Briefcase },
    { label: "Billing", href: matterId ? `/portal/matter/${matterId}/billing` : "/portal/invoices", icon: Receipt },
    { label: "To-Do", href: matterId ? `/portal/matter/${matterId}/checklist` : "/portal/checklist", icon: CheckSquare },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.colorBackground }}>
      {/* Header */}
      <header
        className="sticky top-0 z-50 shadow-sm"
        style={{ backgroundColor: theme.colorPrimary }}
      >
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="lg:hidden text-white p-1" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <span className="text-white font-semibold text-sm">Client Portal</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/portal/notifications" className="relative text-white/80 hover:text-white p-1">
              <Bell className="h-5 w-5" />
              {unreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center font-bold">
                  {unreadNotifications}
                </span>
              )}
            </Link>
            {userName && <span className="text-white/80 text-sm hidden sm:block">{userName}</span>}
            {onLogout && (
              <button onClick={onLogout} className="text-white/60 hover:text-white p-1">
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto flex">
        {/* Desktop Sidebar */}
        <nav className="hidden lg:block w-56 flex-shrink-0 py-6 pr-6">
          <div className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "text-white"
                      : "hover:bg-gray-100"
                  )}
                  style={isActive ? { backgroundColor: theme.colorPrimary, color: "white" } : { color: theme.colorText }}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="fixed inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
            <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-xl p-4 z-50">
              <div className="space-y-1 mt-4">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                        isActive ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-50"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 py-6 px-4 lg:px-0 min-w-0">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Tabs */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-40">
        <div className="flex items-center justify-around py-2">
          {navItems.slice(0, 5).map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href} className="flex flex-col items-center gap-0.5 px-2 py-1">
                <item.icon className="h-5 w-5" style={{ color: isActive ? theme.colorPrimary : "#9CA3AF" }} />
                <span className="text-[9px] font-medium" style={{ color: isActive ? theme.colorPrimary : "#9CA3AF" }}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
