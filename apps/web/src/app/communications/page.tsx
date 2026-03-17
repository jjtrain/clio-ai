"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Phone, MessageSquare, Mail, Users, Star, Headphones, Clock, CheckCircle, AlertTriangle, Settings } from "lucide-react";

const PROVIDER_BADGES: Record<string, string> = {
  SMITH_AI: "bg-blue-100 text-blue-700", RUBY_RECEPTIONISTS: "bg-pink-100 text-pink-700",
  PATLIVE: "bg-green-100 text-green-700", DIALPAD: "bg-purple-100 text-purple-700",
  CASE_STATUS: "bg-teal-100 text-teal-700", PRIVILEGE_LAW: "bg-indigo-100 text-indigo-700",
  HONA: "bg-amber-100 text-amber-700",
};

function fmt(s: string) { return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }

export default function CommunicationsDashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const { data: stats } = trpc.communications.getDashboardStats.useQuery();
  const { data: inbox } = trpc.communications.inbox.useQuery();
  const { data: calls } = trpc.communications["calls.list"].useQuery({ limit: 10 });
  const { data: chats } = trpc.communications["chats.list"].useQuery({ limit: 10 });

  const handleMut = trpc.communications["inbox.markHandled"].useMutation({
    onSuccess: () => { utils.communications.inbox.invalidate(); utils.communications.getDashboardStats.invalidate(); toast({ title: "Handled" }); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Communications</h1><p className="text-sm text-slate-500">Unified inbox across all providers</p></div>
        <Button variant="outline" size="icon" onClick={() => router.push("/settings/integrations")}><Settings className="h-4 w-4" /></Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card><CardContent className="pt-4"><div className="flex items-center gap-2"><Phone className="h-4 w-4 text-blue-500" /><p className="text-xs text-slate-500">Calls Today</p></div><p className="text-xl font-bold">{stats?.callsToday ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center gap-2"><MessageSquare className="h-4 w-4 text-green-500" /><p className="text-xs text-slate-500">Active Chats</p></div><p className="text-xl font-bold">{stats?.activeChats ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center gap-2"><Mail className="h-4 w-4 text-purple-500" /><p className="text-xs text-slate-500">Unread Messages</p></div><p className="text-xl font-bold">{stats?.unreadMessages ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center gap-2"><Users className="h-4 w-4 text-amber-500" /><p className="text-xs text-slate-500">New Leads</p></div><p className="text-xl font-bold">{stats?.leadsToday ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center gap-2"><Star className="h-4 w-4 text-green-500" /><p className="text-xs text-slate-500">Satisfaction</p></div><p className="text-xl font-bold">{stats?.avgSatisfaction ? stats.avgSatisfaction.toFixed(1) : "—"}/5</p></CardContent></Card>
      </div>

      {/* Unified Inbox */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2">Unified Inbox <Badge variant="destructive">{(inbox || []).length}</Badge></CardTitle></CardHeader>
        <CardContent>
          {(inbox || []).length > 0 ? (
            <div className="space-y-2">
              {(inbox || []).slice(0, 15).map((item: any) => (
                <div key={`${item.type}-${item.id}`} className={`flex items-center gap-3 p-3 rounded-lg border ${item.urgent ? "border-red-300 bg-red-50" : item.actionRequired ? "border-amber-200 bg-amber-50" : "hover:bg-slate-50"}`}>
                  <div className="flex-shrink-0">
                    {item.type === "call" ? <Phone className="h-4 w-4 text-blue-500" /> : item.type === "chat" ? <MessageSquare className="h-4 w-4 text-green-500" /> : <Mail className="h-4 w-4 text-purple-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${PROVIDER_BADGES[item.provider] || "bg-gray-100"}`}>{fmt(item.provider)}</span>
                      <span className="text-sm font-medium truncate">{item.title}</span>
                      {item.urgent && <AlertTriangle className="h-3 w-3 text-red-500" />}
                    </div>
                    <p className="text-xs text-slate-500 truncate">{item.preview}</p>
                  </div>
                  <span className="text-xs text-slate-400 whitespace-nowrap">{new Date(item.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  <Button variant="ghost" size="sm" onClick={() => handleMut.mutate({ type: item.type, recordId: item.id })}>
                    <CheckCircle className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-center py-6">All caught up! No pending items.</p>
          )}
        </CardContent>
      </Card>

      {/* Recent Calls & Chats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><div className="flex items-center justify-between"><CardTitle className="text-sm">Recent Calls</CardTitle><Link href="/communications/calls"><Button variant="ghost" size="sm">View All</Button></Link></div></CardHeader>
          <CardContent>
            {(calls || []).slice(0, 8).map((c: any) => (
              <div key={c.id} className="flex items-center gap-2 py-2 border-b last:border-0 text-sm">
                <span className={`inline-flex px-1 py-0 rounded text-[10px] font-medium ${PROVIDER_BADGES[c.provider] || ""}`}>{fmt(c.provider).split(" ")[0]}</span>
                <span className="flex-1 truncate">{c.callerName || c.callerPhone || "Unknown"}</span>
                <span className="text-xs text-slate-400">{c.duration ? `${Math.round(c.duration / 60)}m` : "—"}</span>
                <Badge variant="secondary" className="text-[10px]">{c.status}</Badge>
              </div>
            ))}
            {!calls?.length && <p className="text-slate-500 text-center py-4 text-sm">No recent calls</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><div className="flex items-center justify-between"><CardTitle className="text-sm">Active Chats & Messages</CardTitle><Link href="/communications/chats"><Button variant="ghost" size="sm">View All</Button></Link></div></CardHeader>
          <CardContent>
            {(chats || []).slice(0, 8).map((c: any) => (
              <div key={c.id} className="flex items-center gap-2 py-2 border-b last:border-0 text-sm">
                <span className={`inline-flex px-1 py-0 rounded text-[10px] font-medium ${PROVIDER_BADGES[c.provider] || ""}`}>{fmt(c.provider).split(" ")[0]}</span>
                <span className="flex-1 truncate">{c.visitorName || "Visitor"}</span>
                <Badge variant="secondary" className="text-[10px]">{c.channel}</Badge>
                <Badge variant={c.status === "ACTIVE" ? "default" : "secondary"} className="text-[10px]">{c.status}</Badge>
              </div>
            ))}
            {!chats?.length && <p className="text-slate-500 text-center py-4 text-sm">No active chats</p>}
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { name: "Call Log", href: "/communications/calls", icon: Phone },
          { name: "Chat Center", href: "/communications/chats", icon: MessageSquare },
          { name: "Client Portals", href: "/communications/portals", icon: Users },
          { name: "Secure Messages", href: "/communications/secure", icon: Mail },
        ].map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="pt-4 flex items-center gap-2">
                <link.icon className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-medium">{link.name}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
