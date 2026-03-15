"use client";

import { useState, useEffect, ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { PortalContext } from "./portal-context";
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  MessageSquare,
  Receipt,
  Calendar,
  LogOut,
  Shield,
  Menu,
  X,
} from "lucide-react";

const portalNav = [
  { name: "Dashboard", href: "/portal", icon: LayoutDashboard },
  { name: "My Matters", href: "/portal/matters", icon: Briefcase },
  { name: "Documents", href: "/portal/documents", icon: FileText },
  { name: "Messages", href: "/portal/messages", icon: MessageSquare },
  { name: "Invoices", href: "/portal/invoices", icon: Receipt },
  { name: "Appointments", href: "/portal/appointments", icon: Calendar },
];

export default function PortalLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("portal_token");
    if (stored) {
      setToken(stored);
    } else if (pathname !== "/portal") {
      // If no token and not on login page, stay on portal root
    }
  }, [pathname]);

  const { data: user } = trpc.clientPortal.portalVerifyToken.useQuery(
    { token: token! },
    { enabled: !!token }
  );

  const { data: settings } = trpc.clientPortal.getSettings.useQuery();

  const logout = trpc.clientPortal.portalLogout.useMutation();

  const handleLogout = () => {
    if (token) logout.mutate({ token });
    localStorage.removeItem("portal_token");
    setToken(null);
    router.push("/portal");
  };

  // If not logged in, show login page (portal/page.tsx handles this)
  if (!token || !user) {
    return (
      <PortalContext.Provider value={{ user: null, token: null }}>
        <div className="min-h-screen bg-gray-50">
          {children}
        </div>
      </PortalContext.Provider>
    );
  }

  const primaryColor = settings?.primaryColor || "#1E40AF";

  return (
    <PortalContext.Provider value={{ user: user as any, token }}>
      <div className="min-h-screen bg-gray-50 flex">
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Sidebar */}
        <aside className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col transition-transform md:translate-x-0 md:static md:z-auto",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          {/* Logo */}
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: primaryColor }}>
                <Shield className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-sm">{settings?.firmName || "Client Portal"}</p>
                <p className="text-xs text-gray-400">Secure Portal</p>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 p-3 space-y-1">
            {portalNav.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/portal" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                    isActive
                      ? "text-white font-medium"
                      : "text-gray-600 hover:bg-gray-50"
                  )}
                  style={isActive ? { backgroundColor: primaryColor } : undefined}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User Info & Logout */}
          <div className="p-4 border-t border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium" style={{ backgroundColor: primaryColor }}>
                {user.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <p className="text-xs text-gray-400 truncate">{user.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-600 w-full px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile header */}
          <header className="md:hidden p-4 border-b border-gray-200 bg-white flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>
            <p className="font-semibold text-sm">{settings?.firmName || "Client Portal"}</p>
          </header>
          <main className="flex-1 p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </PortalContext.Provider>
  );
}
