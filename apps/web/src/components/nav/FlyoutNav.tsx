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
  const { data: session } = useSession();
  const [openSection, setOpenSection] = useState<string | null>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const active = findActiveSection(pathname);
    if (active) setOpenSection(active);
  }, [pathname]);

  useEffect(() => { if (onMobileClose) onMobileClose(); }, [pathname]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (flyoutRef.current && !flyoutRef.current.contains(e.target as Node)) setOpenSection(null);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const toggleSection = useCallback((id: string) => setOpenSection((prev) => (prev === id ? null : id)), []);

  const activeSection = findActiveSection(pathname);
  const openSectionData = navConfig.find((e) => isSection(e) && e.id === openSection) as NavSection | undefined;

  const userName = session?.user?.name || "User";
  const userInitials = userName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "U";

  return (
    <div ref={flyoutRef} className="flex h-full">
      {/* ═══ Primary Sidebar ═══ */}
      <div className="w-[180px] flex flex-col flex-shrink-0" style={{ background: "hsl(var(--nav-bg))" }}>
        {/* Logo */}
        <div className="flex h-14 items-center px-4" style={{ borderBottom: "1px solid hsl(var(--nav-border))" }}>
          <Link href="/" className="flex items-center" onClick={() => { setOpenSection(null); onMobileClose?.(); }}>
            <img src="/managal-logo-full-dark.svg" alt="Managal" className="h-7" style={{ maxWidth: "140px" }} />
          </Link>
          {onMobileClose && <button onClick={onMobileClose} className="ml-auto lg:hidden p-1 text-white/40 hover:text-white"><X className="h-4 w-4" /></button>}
        </div>

        <nav className="flex-1 py-2 overflow-y-auto scrollbar-hide px-1.5 space-y-px">
          {navConfig.map((entry) => {
            if (!isSection(entry)) {
              const isActive = pathname === (entry as any).href;
              return (
                <Link key={entry.id} href={(entry as any).href} onClick={() => { setOpenSection(null); onMobileClose?.(); }}
                  className={cn("flex items-center gap-2.5 rounded-md px-3 py-2 text-[12px] font-normal transition-all duration-100",
                    isActive ? "text-white" : "hover:text-white/70"
                  )}
                  style={isActive ? { background: "hsl(var(--brand))", color: "white" } : { color: "hsl(var(--nav-text))" }}>
                  <entry.icon className="h-4 w-4 flex-shrink-0" style={{ opacity: isActive ? 1 : 0.6 }} />
                  <span className="truncate">{entry.label}</span>
                </Link>
              );
            }

            const isOpen = openSection === entry.id;
            const hasActive = activeSection === entry.id;

            return (
              <button key={entry.id} onClick={() => toggleSection(entry.id)}
                className={cn("flex items-center gap-2.5 rounded-md px-3 py-2 text-[12px] font-normal transition-all duration-100 w-full text-left")}
                style={{
                  background: isOpen ? "hsl(var(--nav-active))" : "transparent",
                  color: isOpen || hasActive ? "hsl(var(--nav-active-text))" : "hsl(var(--nav-text))",
                }}>
                <entry.icon className="h-4 w-4 flex-shrink-0" style={{ color: isOpen || hasActive ? "hsl(var(--brand-mid))" : undefined, opacity: isOpen || hasActive ? 1 : 0.6 }} />
                <span className="truncate flex-1">{entry.label}</span>
                <ChevronRight className={cn("h-3.5 w-3.5 flex-shrink-0 transition-transform duration-100", isOpen && "rotate-90")}
                  style={{ opacity: isOpen ? 0.8 : 0.3 }} />
              </button>
            );
          })}
        </nav>

        {/* User */}
        <div className="px-1.5 py-3" style={{ borderTop: "1px solid hsl(var(--nav-border))" }}>
          {session ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2 px-3 py-1.5">
                <div className="h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "hsl(var(--brand))" }}>
                  <span className="text-[10px] font-semibold text-white">{userInitials}</span>
                </div>
                <span className="text-xs text-white/50 truncate">{userName}</span>
              </div>
              <button onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex items-center gap-2 w-full rounded-md px-3 py-1.5 text-xs transition-all duration-100"
                style={{ color: "hsl(var(--nav-text))" }}
                onMouseEnter={(e) => e.currentTarget.style.color = "white"}
                onMouseLeave={(e) => e.currentTarget.style.color = "hsl(var(--nav-text))"}>
                <LogOut className="h-3.5 w-3.5" /><span>Sign out</span>
              </button>
            </div>
          ) : (
            <Link href="/login" className="flex items-center gap-2 rounded-md px-3 py-2 text-xs" style={{ color: "hsl(var(--nav-text))" }}>Sign in</Link>
          )}
        </div>
      </div>

      {/* ═══ Flyout Sub-Panel ═══ */}
      <div className={cn("flex-shrink-0 overflow-hidden transition-all duration-150 ease-out", openSectionData ? "w-[220px]" : "w-0")}
        style={{ background: "hsl(var(--nav-flyout))", borderRight: openSectionData ? "1px solid hsl(var(--nav-border))" : "none", boxShadow: openSectionData ? "2px 0 12px rgba(0,0,0,0.08)" : "none" }}>
        {openSectionData && (
          <div className="w-[220px] h-full flex flex-col">
            <div className="h-14 flex items-center px-4 flex-shrink-0" style={{ borderBottom: "1px solid hsl(var(--nav-border))" }}>
              <span className="text-[14px] font-medium text-white">{openSectionData.label}</span>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-hide py-1">
              {openSectionData.subGroups.map((sg, sgIdx) => (
                <div key={sg.label}>
                  <div className={cn("px-4 pb-0.5 text-[10px] font-medium uppercase tracking-[0.06em] select-none", sgIdx === 0 ? "pt-3" : "pt-5")}
                    style={{ color: "hsl(var(--nav-text))" }}>
                    {sg.label}
                  </div>
                  <div className="px-2 space-y-px">
                    {sg.items.map((item) => {
                      const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                      return (
                        <Link key={item.href} href={item.href} onClick={() => onMobileClose?.()}
                          className={cn("flex items-center gap-2 rounded-[5px] py-[6px] text-[13px] transition-all duration-100")}
                          style={{
                            paddingLeft: isActive ? "10px" : "12px",
                            paddingRight: "12px",
                            background: isActive ? "hsl(var(--nav-active))" : "transparent",
                            color: isActive ? "white" : "hsl(0 0% 100% / 0.55)",
                            borderLeft: isActive ? "2px solid hsl(var(--brand-mid))" : "2px solid transparent",
                            fontWeight: isActive ? 500 : 400,
                          }}
                          onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.color = "hsl(0 0% 100% / 0.80)"; e.currentTarget.style.background = "hsl(0 0% 100% / 0.04)"; } }}
                          onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.color = "hsl(0 0% 100% / 0.55)"; e.currentTarget.style.background = "transparent"; } }}>
                          {item.icon && <item.icon className="h-3.5 w-3.5 flex-shrink-0" style={{ opacity: isActive ? 1 : 0.5 }} />}
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
