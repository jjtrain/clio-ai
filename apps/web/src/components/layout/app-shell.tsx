"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { FlyoutNav } from "@/components/nav/FlyoutNav";
import { Header } from "./header";
import { UrgencyBanner } from "@/components/next-actions/UrgencyBanner";

const authRoutes = ["/login", "/register", "/book"];
const publicPrefixes = ["/intake/", "/widget/", "/sign/", "/site/", "/pay/", "/financing/apply/", "/pulse/respond"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthRoute = authRoutes.includes(pathname) || publicPrefixes.some(p => pathname.startsWith(p));
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar when route changes
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => { if (e.key === "Escape") setSidebarOpen(false); };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (sidebarOpen) { document.body.style.overflow = "hidden"; }
    else { document.body.style.overflow = ""; }
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

  if (isAuthRoute) return <>{children}</>;

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Desktop: Primary sidebar always visible (180px) */}
      <div className="hidden lg:flex lg:flex-shrink-0 h-full">
        <FlyoutNav />
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
          <div className="fixed inset-y-0 left-0 animate-slide-in flex">
            <FlyoutNav mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <UrgencyBanner />
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-auto">
          <div className="px-4 py-6 sm:px-6 sm:py-8 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
