"use client";

import { useState, useEffect, ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { PortalContext } from "./portal-context";
import { LayoutDashboard, FileText, MessageSquare, Receipt, LogOut, Menu, X } from "lucide-react";

const portalNav = [
  { name: "Overview", href: "/portal", icon: LayoutDashboard },
  { name: "Documents", href: "/portal/documents", icon: FileText },
  { name: "Messages", href: "/portal/messages", icon: MessageSquare },
  { name: "Invoices", href: "/portal/invoices", icon: Receipt },
];

export default function PortalLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("portal_token");
    if (stored) setToken(stored);
  }, [pathname]);

  const { data: user } = trpc.clientPortal.portalVerifyToken.useQuery({ token: token! }, { enabled: !!token });
  const { data: settings } = trpc.clientPortal.getSettings.useQuery();
  const logout = trpc.clientPortal.portalLogout.useMutation();

  const handleLogout = () => {
    if (token) logout.mutate({ token });
    localStorage.removeItem("portal_token");
    setToken(null);
    router.push("/portal");
  };

  if (!token || !user) {
    return (
      <PortalContext.Provider value={{ user: null, token: null }}>
        <div className="min-h-screen bg-white">{children}</div>
      </PortalContext.Provider>
    );
  }

  const firmName = settings?.firmName || "Client Portal";

  return (
    <PortalContext.Provider value={{ user: user as any, token }}>
      <div className="min-h-screen bg-white">
        {/* Top nav — clean, white, client-friendly */}
        <header className="border-b sticky top-0 z-40 bg-white">
          <div className="max-w-[680px] mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-1 -ml-1">
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              <Link href="/portal" className="flex items-center gap-2">
                {settings?.logoUrl ? (
                  <img src={settings.logoUrl} alt={firmName} className="h-6" />
                ) : (
                  <span className="text-[14px] font-medium text-foreground">{firmName}</span>
                )}
              </Link>
            </div>

            <nav className="hidden md:flex items-center gap-1">
              {portalNav.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/portal" && pathname.startsWith(item.href));
                return (
                  <Link key={item.href} href={item.href}
                    className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] transition-colors",
                      isActive ? "bg-accent text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                    )}>
                    <item.icon className="h-3.5 w-3.5" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-2">
              <span className="text-[12px] text-muted-foreground hidden sm:block">{user.name}</span>
              <button onClick={handleLogout} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors" title="Sign out">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>

          {mobileMenuOpen && (
            <div className="md:hidden border-t px-4 py-2 bg-white space-y-1">
              {portalNav.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/portal" && pathname.startsWith(item.href));
                return (
                  <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)}
                    className={cn("flex items-center gap-2 px-3 py-2 rounded-lg text-[13px]",
                      isActive ? "bg-accent text-primary font-medium" : "text-muted-foreground"
                    )}>
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          )}
        </header>

        <main className="px-4 py-6 max-w-[680px] mx-auto">{children}</main>
      </div>
    </PortalContext.Provider>
  );
}
