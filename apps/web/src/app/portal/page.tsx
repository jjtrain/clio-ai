"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { usePortal } from "./portal-context";
import { Shield, Briefcase, FileText, MessageSquare, Receipt, Calendar, Loader2 } from "lucide-react";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const { data: settings } = trpc.clientPortal.getSettings.useQuery();
  const login = trpc.clientPortal.portalLogin.useMutation();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await login.mutateAsync({ email, password });
      localStorage.setItem("portal_token", result.token);
      window.location.reload();
    } catch (err: any) {
      toast({ title: "Login Failed", description: err.message, variant: "destructive" });
    }
  };

  const primaryColor = settings?.primaryColor || "#1E40AF";

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="h-14 w-14 rounded-xl mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: primaryColor }}>
            <Shield className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{settings?.firmName || "Client Portal"}</h1>
          <p className="text-gray-500 mt-1">Sign in to access your account</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          {settings?.welcomeMessage && (
            <div className="mb-6 p-3 rounded-lg bg-blue-50 text-sm text-blue-700">
              {settings.welcomeMessage}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              style={{ backgroundColor: primaryColor }}
              disabled={login.isPending}
            >
              {login.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {login.isPending ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Secure client portal. Contact your attorney if you need access.
        </p>
      </div>
    </div>
  );
}

function Dashboard() {
  const { user, token } = usePortal();
  const { data: settings } = trpc.clientPortal.getSettings.useQuery();
  const { data: matters } = trpc.clientPortal.portalGetMatters.useQuery({ token: token! }, { enabled: !!token });
  const { data: messages } = trpc.clientPortal.portalGetMessages.useQuery({ token: token! }, { enabled: !!token });
  const { data: invoices } = trpc.clientPortal.portalGetInvoices.useQuery({ token: token! }, { enabled: !!token });
  const { data: appointments } = trpc.clientPortal.portalGetAppointments.useQuery({ token: token! }, { enabled: !!token });

  const unreadMessages = messages?.filter((m) => m.direction === "FIRM_TO_CLIENT" && !m.isRead)?.length || 0;
  const primaryColor = settings?.primaryColor || "#1E40AF";

  const cards = [
    { title: "Active Matters", count: matters?.filter((m) => m.status === "OPEN")?.length || 0, icon: Briefcase, href: "/portal/matters", color: "blue" },
    { title: "Documents", count: matters?.reduce((sum, m) => sum + (m._count?.documents || 0), 0) || 0, icon: FileText, href: "/portal/documents", color: "green" },
    { title: "Messages", count: messages?.length || 0, badge: unreadMessages > 0 ? `${unreadMessages} new` : undefined, icon: MessageSquare, href: "/portal/messages", color: "purple" },
    { title: "Invoices", count: invoices?.length || 0, icon: Receipt, href: "/portal/invoices", color: "amber" },
    { title: "Appointments", count: appointments?.length || 0, icon: Calendar, href: "/portal/appointments", color: "teal" },
  ];

  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    purple: "bg-purple-50 text-purple-600",
    amber: "bg-amber-50 text-amber-600",
    teal: "bg-teal-50 text-teal-600",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome, {user?.name}</h1>
        <p className="text-gray-500">Here&apos;s an overview of your account</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.href} href={card.href}>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:border-gray-200 transition-all cursor-pointer">
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg ${colorMap[card.color]}`}>
                  <card.icon className="h-5 w-5" />
                </div>
                <span className="text-sm text-gray-500">{card.title}</span>
                {card.badge && (
                  <span className="ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: primaryColor }}>
                    {card.badge}
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold">{card.count}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent Messages */}
      {settings?.allowMessaging && messages && messages.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold">Recent Messages</h2>
            <Link href="/portal/messages" className="text-sm text-blue-600 hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {messages.slice(0, 3).map((msg) => (
              <div key={msg.id} className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                    msg.direction === "FIRM_TO_CLIENT" ? "bg-purple-50 text-purple-600" : "bg-blue-50 text-blue-600"
                  }`}>
                    {msg.direction === "FIRM_TO_CLIENT" ? "From Firm" : "You"}
                  </span>
                  <span className="text-xs text-gray-400">{new Date(msg.createdAt).toLocaleDateString()}</span>
                </div>
                {msg.subject && <p className="text-sm font-medium">{msg.subject}</p>}
                <p className="text-sm text-gray-600 line-clamp-2">{msg.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PortalPage() {
  const { user } = usePortal();

  if (!user) return <LoginForm />;
  return <Dashboard />;
}
