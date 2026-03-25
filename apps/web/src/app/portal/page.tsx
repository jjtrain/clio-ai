"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { usePortal } from "./portal-context";
import { MatterTimeline } from "@/components/portal/Timeline";
import { Briefcase, FileText, MessageSquare, Receipt, Calendar, Loader2, Mail, ArrowRight, CheckCircle } from "lucide-react";
import Link from "next/link";

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const [loginMode, setLoginMode] = useState<"magic" | "password">("magic");

  const { data: settings } = trpc.clientPortal.getSettings.useQuery();
  const login = trpc.clientPortal.portalLogin.useMutation();

  // Handle magic link token from URL
  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      fetch(`/api/portal/magic-link?token=${token}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.valid && data.userId) {
            // Exchange for session token via portal login
            localStorage.setItem("portal_token", token);
            window.location.href = "/portal";
          } else {
            toast({ title: "Link expired", description: "Please request a new sign-in link.", variant: "destructive" });
          }
        });
    }
  }, [searchParams]);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setMagicLinkLoading(true);
    try {
      const res = await fetch("/api/portal/magic-link", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, firmName: settings?.firmName }),
      });
      const data = await res.json();
      if (data.sent) setMagicLinkSent(true);
      else toast({ title: "Error", description: data.error, variant: "destructive" });
    } catch { toast({ title: "Error", description: "Could not send link", variant: "destructive" }); }
    setMagicLinkLoading(false);
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await login.mutateAsync({ email, password });
      localStorage.setItem("portal_token", result.token);
      window.location.reload();
    } catch (err: any) {
      toast({ title: "Login Failed", description: err.message, variant: "destructive" });
    }
  };

  const primaryColor = settings?.primaryColor || "#1AA8A0";

  if (magicLinkSent) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="h-14 w-14 rounded-xl mx-auto mb-4 flex items-center justify-center bg-[#E5F6F6]">
            <Mail className="h-7 w-7 text-[#1AA8A0]" />
          </div>
          <h1 className="text-lg font-medium text-foreground">Check your email</h1>
          <p className="text-[13px] text-muted-foreground mt-2 max-w-sm mx-auto">
            We sent a sign-in link to <strong>{email}</strong>. Click the link in the email to access your portal. The link expires in 15 minutes.
          </p>
          <button onClick={() => setMagicLinkSent(false)} className="text-[12px] text-primary mt-4 hover:underline">Use a different email</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          {settings?.logoUrl ? (
            <img src={settings.logoUrl} alt={settings.firmName} className="h-10 mx-auto mb-4" />
          ) : (
            <div className="h-14 w-14 rounded-xl mx-auto mb-4 flex items-center justify-center" style={{ background: `linear-gradient(135deg, #1B3A8C, #1AA8A0)` }}>
              <span className="text-xl font-medium text-white">M</span>
            </div>
          )}
          <h1 className="text-lg font-medium text-foreground">{settings?.firmName || "Client Portal"}</h1>
          <p className="text-[13px] text-muted-foreground mt-1">Your attorney has invited you to view your case</p>
        </div>

        <div className="bg-card rounded-xl border p-6">
          {loginMode === "magic" ? (
            <form onSubmit={handleMagicLink} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[12px]">Email address</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" required />
              </div>
              <Button type="submit" className="w-full" disabled={magicLinkLoading}>
                {magicLinkLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
                Send sign-in link
              </Button>
              <button type="button" onClick={() => setLoginMode("password")} className="text-[12px] text-muted-foreground hover:text-foreground w-full text-center mt-2">
                Or sign in with password
              </button>
            </form>
          ) : (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[12px]">Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px]">Password</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={login.isPending}>
                {login.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Sign in
              </Button>
              <button type="button" onClick={() => setLoginMode("magic")} className="text-[12px] text-muted-foreground hover:text-foreground w-full text-center mt-2">
                Use magic link instead
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-[11px] text-muted-foreground/60 mt-6">
          Secure portal. Contact your attorney if you need access.
        </p>
      </div>
    </div>
  );
}

function LoginForm() {
  return <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center"><span className="text-muted-foreground">Loading...</span></div>}><LoginFormInner /></Suspense>;
}

function Dashboard() {
  const { user, token } = usePortal();
  const { data: settings } = trpc.clientPortal.getSettings.useQuery();
  const { data: matters } = trpc.clientPortal.portalGetMatters.useQuery({ token: token! }, { enabled: !!token });
  const { data: messages } = trpc.clientPortal.portalGetMessages.useQuery({ token: token! }, { enabled: !!token });
  const { data: invoices } = trpc.clientPortal.portalGetInvoices.useQuery({ token: token! }, { enabled: !!token });

  const unreadMessages = messages?.filter((m: any) => m.direction === "FIRM_TO_CLIENT" && !m.isRead)?.length || 0;
  const activeMatter = matters?.find((m: any) => m.status === "OPEN");

  // Build timeline steps from matter tasks (simplified)
  const timelineSteps = activeMatter ? [
    { label: "Case opened", status: "complete" as const, date: activeMatter.createdAt ? new Date(activeMatter.createdAt).toLocaleDateString() : undefined },
    { label: "Documents collected", status: "complete" as const },
    { label: "Under review", status: "active" as const },
    { label: "Next steps", status: "upcoming" as const },
    { label: "Resolution", status: "upcoming" as const },
  ] : [];

  const cards = [
    { title: "Your documents", count: matters?.reduce((s: number, m: any) => s + (m._count?.documents || 0), 0) || 0, icon: FileText, href: "/portal/documents", description: "View and sign documents" },
    { title: "Messages", count: messages?.length || 0, badge: unreadMessages, icon: MessageSquare, href: "/portal/messages", description: "Chat with your attorney" },
    { title: "Your invoices", count: invoices?.length || 0, icon: Receipt, href: "/portal/invoices", description: "View and pay bills" },
  ];

  return (
    <div className="max-w-[680px] mx-auto space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-lg font-medium text-foreground">Hi {user?.name?.split(" ")[0]}, here's your case</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">{settings?.firmName || "Your attorney's office"}</p>
      </div>

      {/* Matter Timeline */}
      {timelineSteps.length > 0 && (
        <div className="bg-card rounded-xl border p-5">
          <h2 className="text-[13px] font-medium text-foreground mb-4">Case progress</h2>
          <MatterTimeline steps={timelineSteps} />
        </div>
      )}

      {/* Action Cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.href} href={card.href}>
            <div className="bg-card rounded-xl border p-4 hover:bg-accent/30 transition-colors cursor-pointer group">
              <div className="flex items-center justify-between mb-2">
                <card.icon className="h-5 w-5 text-primary" />
                {card.badge ? (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground">{card.badge} new</span>
                ) : null}
              </div>
              <p className="text-[13px] font-medium text-foreground">{card.title}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{card.description}</p>
              <div className="flex items-center gap-1 mt-3 text-[11px] text-primary">
                <span>View</span>
                <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Next Step Callout */}
      {unreadMessages > 0 && (
        <div className="bg-[#E5F6F6] rounded-xl p-4 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-[#1AA8A0] flex items-center justify-center flex-shrink-0">
            <MessageSquare className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-medium text-foreground">You have {unreadMessages} new message{unreadMessages !== 1 ? "s" : ""}</p>
            <p className="text-[11px] text-muted-foreground">Your attorney sent you a message</p>
          </div>
          <Link href="/portal/messages"><Button size="sm" variant="outline" className="text-[12px]">Read</Button></Link>
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
