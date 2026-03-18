"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import {
  Loader2, Search, Users, Eye, Radar, AlertTriangle, Bell,
  FileText, MapPin, Shield, ArrowRight, Briefcase,
} from "lucide-react";

const PROVIDER_COLORS: Record<string, string> = { TRACERS: "bg-blue-100 text-blue-700", SONAR: "bg-purple-100 text-purple-700", MEDIASCOPE: "bg-emerald-100 text-emerald-700" };
const STATUS_COLORS: Record<string, string> = { PENDING: "bg-amber-100 text-amber-700", PROCESSING: "bg-blue-100 text-blue-700", COMPLETED: "bg-emerald-100 text-emerald-700", PARTIAL: "bg-yellow-100 text-yellow-700", FAILED: "bg-red-100 text-red-700" };

export default function InvestigationsDashboard() {
  const { toast } = useToast();
  const [quickSearch, setQuickSearch] = useState("");

  const { data: recentSearches } = trpc.investigations.searches.list.useQuery({});
  const { data: alerts } = trpc.investigations.monitoring.alerts.list.useQuery({ isRead: false });
  const { data: matches } = trpc.investigations.matches.list.useQuery({ status: "NEW" });
  const { data: subscriptions } = trpc.investigations.monitoring.subscriptions.list.useQuery({ isActive: true });

  const searchCount = recentSearches?.length || 0;
  const personsLocated = (recentSearches || []).filter((s: any) => s.status === "COMPLETED" && s.resultCount > 0).length;
  const alertCount = (alerts || []).length;
  const matchCount = (matches || []).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Investigations</h1>
          <p className="text-sm text-slate-500">People search, asset discovery, incident identification, and visual asset protection</p>
        </div>
        <Link href="/investigations/search"><Button><Search className="h-4 w-4 mr-2" /> New Search</Button></Link>
      </div>

      {/* Quick Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input className="pl-9" placeholder="Quick search: enter a name, phone, email, or address..." value={quickSearch} onChange={(e) => setQuickSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && quickSearch) window.location.href = `/investigations/search?q=${encodeURIComponent(quickSearch)}`; }} />
            </div>
            <Link href={`/investigations/search${quickSearch ? `?q=${encodeURIComponent(quickSearch)}` : ""}`}>
              <Button>Search</Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card><CardContent className="pt-6 text-center"><Search className="h-6 w-6 mx-auto mb-1 text-blue-500" /><p className="text-2xl font-bold">{searchCount}</p><p className="text-xs text-gray-500">Recent Searches</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><Users className="h-6 w-6 mx-auto mb-1 text-green-500" /><p className="text-2xl font-bold">{personsLocated}</p><p className="text-xs text-gray-500">Persons Located</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><Bell className="h-6 w-6 mx-auto mb-1 text-amber-500" /><p className="text-2xl font-bold">{(subscriptions || []).length}</p><p className="text-xs text-gray-500">Active Monitoring</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><AlertTriangle className="h-6 w-6 mx-auto mb-1 text-red-500" /><p className="text-2xl font-bold">{alertCount}</p><p className="text-xs text-gray-500">Unresolved Alerts</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><Eye className="h-6 w-6 mx-auto mb-1 text-purple-500" /><p className="text-2xl font-bold">{matchCount}</p><p className="text-xs text-gray-500">New Visual Matches</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><Shield className="h-6 w-6 mx-auto mb-1 text-teal-500" /><p className="text-2xl font-bold">—</p><p className="text-xs text-gray-500">Credits</p></CardContent></Card>
      </div>

      {/* Three Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tracers */}
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs">Tracers</span> People & Records</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(recentSearches || []).filter((s: any) => s.provider === "TRACERS").slice(0, 4).map((s: any) => (
              <Link key={s.id} href={`/investigations/search/${s.id}`}>
                <div className="p-2 rounded hover:bg-gray-50 flex items-center justify-between">
                  <div><p className="text-sm font-medium">{s.searchSubject}</p><p className="text-xs text-gray-500">{s.searchType.replace(/_/g, " ")} · {s.resultCount} results</p></div>
                  <ArrowRight className="h-3 w-3 text-gray-300" />
                </div>
              </Link>
            ))}
            <div className="grid grid-cols-2 gap-1 pt-2">
              {[{ name: "Person Search", href: "/investigations/search?type=PERSON_LOCATE" }, { name: "Skip Trace", href: "/investigations/search?type=SKIP_TRACE" }, { name: "Asset Search", href: "/investigations/search?type=ASSET_SEARCH" }, { name: "Background", href: "/investigations/search?type=BACKGROUND_CHECK" }].map(l => (
                <Link key={l.name} href={l.href}><Button variant="outline" size="sm" className="w-full text-xs">{l.name}</Button></Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Sonar */}
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs">Sonar</span> Incidents & Leads</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(recentSearches || []).filter((s: any) => s.provider === "SONAR").slice(0, 4).map((s: any) => (
              <Link key={s.id} href={`/investigations/search/${s.id}`}>
                <div className="p-2 rounded hover:bg-gray-50 flex items-center justify-between">
                  <div><p className="text-sm font-medium">{s.searchSubject}</p><p className="text-xs text-gray-500">{s.searchType.replace(/_/g, " ")} · {s.resultCount} results</p></div>
                  <ArrowRight className="h-3 w-3 text-gray-300" />
                </div>
              </Link>
            ))}
            <Link href="/investigations/search?provider=SONAR"><Button variant="outline" size="sm" className="w-full text-xs">Search Incidents</Button></Link>
          </CardContent>
        </Card>

        {/* Mediascope */}
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-xs">Mediascope</span> Visual Assets</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(matches || []).slice(0, 4).map((m: any) => (
              <Link key={m.id} href={`/investigations/visual`}>
                <div className="p-2 rounded hover:bg-gray-50 flex items-center justify-between">
                  <div><p className="text-sm font-medium truncate">{m.matchDomain || m.platform || "Match"}</p><p className="text-xs text-gray-500">{(Number(m.similarityScore) * 100).toFixed(0)}% match · {m.matchType}</p></div>
                  <ArrowRight className="h-3 w-3 text-gray-300" />
                </div>
              </Link>
            ))}
            <Link href="/investigations/search?type=VISUAL_ASSET_SEARCH"><Button variant="outline" size="sm" className="w-full text-xs">Search by Image</Button></Link>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {alertCount > 0 && (
        <Card className="border-amber-300">
          <CardHeader><CardTitle className="text-sm text-amber-700">Monitoring Alerts ({alertCount})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(alerts || []).slice(0, 5).map((a: any) => (
              <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg border">
                <AlertTriangle className={`h-4 w-4 mt-0.5 ${a.severity === "CRITICAL" ? "text-red-500" : a.severity === "WARNING" ? "text-amber-500" : "text-blue-500"}`} />
                <div className="flex-1"><p className="text-sm font-medium">{a.title}</p><p className="text-xs text-gray-500">{a.subject} · {new Date(a.createdAt).toLocaleDateString()}</p></div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${PROVIDER_COLORS[a.provider]}`}>{a.provider}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { name: "Search", href: "/investigations/search", icon: Search },
          { name: "Person Records", href: "/investigations/persons", icon: Users },
          { name: "Visual Assets", href: "/investigations/visual", icon: Eye },
          { name: "Monitoring", href: "/investigations/monitoring", icon: Radar },
          { name: "Reports", href: "/investigations/reports", icon: FileText },
          { name: "Settings", href: "/settings/integrations", icon: Shield },
        ].map(l => (
          <Link key={l.name} href={l.href}>
            <Card className="hover:border-blue-300 transition-colors cursor-pointer">
              <CardContent className="pt-6 text-center"><l.icon className="h-6 w-6 mx-auto text-blue-500 mb-2" /><p className="text-xs font-medium">{l.name}</p></CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
