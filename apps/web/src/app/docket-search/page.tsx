"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { Search, User, Scale, Gavel, BarChart3, Info } from "lucide-react";

export default function DocketSearchPage() {
  const { toast } = useToast();
  const [searchType, setSearchType] = useState("case");
  const [query, setQuery] = useState("");
  const [court, setCourt] = useState("");
  const [results, setResults] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);

  const searchCases = trpc.docTools["docketbird.searchCases"].useMutation({ onSuccess: (d) => setResults(d), onError: (e) => toast({ title: e.message, variant: "destructive" }) });
  const searchParty = trpc.docTools["docketbird.searchByParty"].useMutation({ onSuccess: (d) => setResults(d), onError: (e) => toast({ title: e.message, variant: "destructive" }) });
  const searchJudge = trpc.docTools["docketbird.searchByJudge"].useMutation({ onSuccess: (d) => setResults(d), onError: (e) => toast({ title: e.message, variant: "destructive" }) });
  const getAnalytics = trpc.docTools["docketbird.judgeAnalytics"].useMutation({ onSuccess: (d) => setAnalytics(d), onError: (e) => toast({ title: e.message, variant: "destructive" }) });

  const isLoading = searchCases.isLoading || searchParty.isLoading || searchJudge.isLoading;

  const doSearch = () => {
    if (!query) return;
    if (searchType === "case") searchCases.mutate({ query, court: court || undefined });
    else if (searchType === "party") searchParty.mutate({ partyName: query, court: court || undefined });
    else if (searchType === "judge") {
      searchJudge.mutate({ judgeName: query, court: court || undefined });
      if (court) getAnalytics.mutate({ judgeName: query, court });
    }
  };

  const resultData = results?.success ? (results.data?.results || results.data || []) : [];
  const hasError = results && !results.success;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Docket Search & Judicial Analytics</h1>
        <p className="text-sm text-slate-500">Search federal court dockets via Docketbird</p>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex gap-2">
            {[{ value: "case", icon: Search, label: "Case" }, { value: "party", icon: User, label: "Party" }, { value: "judge", icon: Gavel, label: "Judge" }].map((t) => (
              <Button key={t.value} variant={searchType === t.value ? "default" : "outline"} size="sm" onClick={() => setSearchType(t.value)}>
                <t.icon className="h-3 w-3 mr-1" /> {t.label}
              </Button>
            ))}
          </div>
          <div className="flex gap-3">
            <Input className="flex-1" placeholder={searchType === "case" ? "Case name or number..." : searchType === "party" ? "Party name..." : "Judge name..."} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doSearch()} />
            <Input className="w-48" placeholder="Court (optional)" value={court} onChange={(e) => setCourt(e.target.value)} />
            <Button onClick={doSearch} disabled={!query || isLoading}>{isLoading ? "Searching..." : "Search"}</Button>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {hasError && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2 text-sm text-amber-800">
          <Info className="h-4 w-4" /> {(results as any).error}
        </div>
      )}

      {/* Results */}
      {Array.isArray(resultData) && resultData.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">{resultData.length} Results</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {resultData.map((r: any, i: number) => (
                <div key={i} className="p-3 border rounded-lg hover:bg-slate-50">
                  <p className="font-medium">{r.case_name || r.name || r.title || `Result ${i + 1}`}</p>
                  <div className="flex gap-4 text-xs text-slate-500 mt-1">
                    {r.court && <span>Court: {r.court}</span>}
                    {r.case_number && <span>Case: {r.case_number}</span>}
                    {r.judge && <span>Judge: {r.judge}</span>}
                    {r.filing_date && <span>Filed: {r.filing_date}</span>}
                    {r.status && <span>Status: {r.status}</span>}
                  </div>
                  {r.parties && <p className="text-xs text-slate-400 mt-1">{r.parties}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Judge Analytics */}
      {analytics?.success && (
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Judicial Analytics</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries((analytics as any).data || {}).slice(0, 8).map(([key, val]: [string, any]) => (
                <div key={key} className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">{key.replace(/_/g, " ")}</p>
                  <p className="font-bold">{typeof val === "number" ? val.toFixed(1) : String(val)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
