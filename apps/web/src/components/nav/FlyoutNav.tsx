"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { LogOut, Scale, X, ChevronRight } from "lucide-react";
import { navConfig, isSection, findActiveSection, type NavSection } from "./config";

interface FlyoutNavProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function FlyoutNav({ mobileOpen, onMobileClose }: FlyoutNavProps) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [openSection, setOpenSection] = useState<string | null>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);

  // Auto-open section containing active route
  useEffect(() => {
    const active = findActiveSection(pathname);
    if (active) setOpenSection(active);
  }, [pathname]);

  // Close flyout on route change (mobile)
  useEffect(() => { if (onMobileClose) onMobileClose(); }, [pathname]);

  // Click outside to close flyout
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (flyoutRef.current && !flyoutRef.current.contains(e.target as Node)) {
        setOpenSection(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const toggleSection = useCallback((id: string) => {
    setOpenSection((prev) => (prev === id ? null : id));
  }, []);

  const activeSection = findActiveSection(pathname);
  const openSectionData = navConfig.find((e) => isSection(e) && e.id === openSection) as NavSection | undefined;

  const userName = session?.user?.name || "User";
  const userInitials = userName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "U";

  return (
    <div ref={flyoutRef} className="flex h-full">
      {/* ═══ Primary Sidebar ═══ */}
      <div className="w-[180px] flex flex-col bg-slate-900 flex-shrink-0">
        {/* Logo */}
        <div className="flex h-14 items-center px-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500"><Scale className="h-4 w-4 text-white" /></div>
            <span className="text-sm font-semibold text-white">Managal</span>
          </div>
          {onMobileClose && (
            <button onClick={onMobileClose} className="ml-auto lg:hidden p-1 text-slate-400 hover:text-white"><X className="h-4 w-4" /></button>
          )}
        </div>

        {/* Section list */}
        <nav className="flex-1 py-2 overflow-y-auto px-2 space-y-0.5">
          {navConfig.map((entry) => {
            if (!isSection(entry)) {
              // Top-level link
              const isActive = pathname === entry.href;
              return (
                <Link key={entry.id} href={(entry as any).href} onClick={() => { setOpenSection(null); onMobileClose?.(); }}
                  className={cn("flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-all",
                    isActive ? "bg-blue-500 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  )}>
                  <entry.icon className={cn("h-4 w-4 flex-shrink-0", isActive ? "text-white" : "text-slate-400")} />
                  <span className="truncate">{entry.label}</span>
                </Link>
              );
            }

            // Section with flyout
            const isOpen = openSection === entry.id;
            const hasActive = activeSection === entry.id;

            return (
              <button key={entry.id} onClick={() => toggleSection(entry.id)}
                className={cn("flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-all w-full text-left",
                  isOpen ? "bg-slate-800 text-white" : hasActive ? "text-white" : "text-slate-300 hover:bg-slate-800/50 hover:text-white"
                )}>
                <entry.icon className={cn("h-4 w-4 flex-shrink-0", isOpen || hasActive ? "text-blue-400" : "text-slate-400")} />
                <span className="truncate flex-1">{entry.label}</span>
                <ChevronRight className={cn("h-3.5 w-3.5 flex-shrink-0 transition-transform", isOpen ? "rotate-90 text-blue-400" : "text-slate-600")} />
              </button>
            );
          })}
        </nav>

        {/* User */}
        <div className="px-2 py-3 border-t border-slate-800">
          {session ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2 px-3 py-1.5">
                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-semibold text-white">{userInitials}</span>
                </div>
                <span className="text-xs text-slate-300 truncate">{userName}</span>
              </div>
              <button onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex items-center gap-2 w-full rounded-md px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800 hover:text-white transition-all">
                <LogOut className="h-3.5 w-3.5" /><span>Sign out</span>
              </button>
            </div>
          ) : (
            <Link href="/login" className="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-white">Sign in</Link>
          )}
        </div>
      </div>

      {/* ═══ Flyout Sub-Panel ═══ */}
      <div className={cn(
        "bg-white border-r border-slate-200 flex-shrink-0 overflow-hidden transition-all duration-150 ease-out",
        openSectionData ? "w-[220px] shadow-[2px_0_8px_rgba(0,0,0,0.06)]" : "w-0"
      )}>
        {openSectionData && (
          <div className="w-[220px] h-full flex flex-col">
            {/* Panel header */}
            <div className="h-14 flex items-center px-4 border-b border-slate-100 flex-shrink-0">
              <span className="text-sm font-medium text-slate-900">{openSectionData.label}</span>
            </div>

            {/* Sub-groups */}
            <div className="flex-1 overflow-y-auto py-1">
              {openSectionData.subGroups.map((sg, sgIdx) => (
                <div key={sg.label}>
                  {/* Sub-group label */}
                  <div className={cn("px-4 pb-0.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-slate-400 select-none", sgIdx === 0 ? "pt-2.5" : "pt-4")}>
                    {sg.label}
                  </div>

                  {/* Items */}
                  <div className="px-2 space-y-px">
                    {sg.items.map((item) => {
                      const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                      return (
                        <Link key={item.href} href={item.href} onClick={() => onMobileClose?.()}
                          className={cn("flex items-center gap-2 rounded-[5px] px-3 py-[6px] text-[13px] transition-all",
                            isActive
                              ? "bg-blue-50 text-blue-700 font-medium border-l-2 border-blue-500 pl-[10px]"
                              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-l-2 border-transparent pl-[10px]"
                          )}>
                          {item.icon && <item.icon className={cn("h-3.5 w-3.5 flex-shrink-0", isActive ? "text-blue-500" : "text-slate-400")} />}
                          <span className="truncate">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
