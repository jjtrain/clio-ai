"use client";

import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Users, Eye, FileText, MapPin, Phone, Mail, Briefcase, AlertTriangle, CheckCircle, Download, Sparkles } from "lucide-react";
import Link from "next/link";

const STATUS_COLORS: Record<string, string> = { PENDING: "bg-amber-100 text-amber-700", PROCESSING: "bg-blue-100 text-blue-700", COMPLETED: "bg-emerald-100 text-emerald-700", FAILED: "bg-red-100 text-red-700" };
const PROVIDER_COLORS: Record<string, string> = { TRACERS: "bg-blue-100 text-blue-700", SONAR: "bg-purple-100 text-purple-700", MEDIASCOPE: "bg-emerald-100 text-emerald-700" };

export default function SearchResultPage() {
  const { id } = useParams() as { id: string };
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const { data: search, isLoading } = trpc.investigations.searches.get.useQuery({ id });
  const { data: summary } = trpc.investigations.searches.getSummary.useQuery({ searchId: id });
  const summaryMut = trpc.investigations.searches.getSummary.useQuery({ searchId: id }, { enabled: false });
  const saveMut = trpc.investigations.searches.saveToMatter.useMutation({ onSuccess: () => { utils.investigations.searches.get.invalidate({ id }); toast({ title: "Saved to matter" }); } });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>;
  if (!search) return <p className="text-center py-12 text-gray-400">Search not found.</p>;

  const personRecords = search.personRecords || [];
  const visualMatches = search.visualAssetMatches || [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold">{search.searchSubject}</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[search.status]}`}>{search.status}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${PROVIDER_COLORS[search.provider]}`}>{search.provider}</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>{search.searchType.replace(/_/g, " ")}</span>
            <span>{search.resultCount} results</span>
            {search.matter && <Link href={`/matters/${search.matterId}`} className="text-blue-600 hover:underline">{search.matter.name}</Link>}
            <span>{new Date(search.createdAt).toLocaleString()}</span>
            {search.cost && <span>Cost: ${Number(search.cost).toFixed(2)}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          {search.matterId && !search.isSavedToMatter && <Button variant="outline" size="sm" onClick={() => saveMut.mutate({ searchId: id, matterId: search.matterId! })}><Download className="h-4 w-4 mr-1" /> Save to Matter</Button>}
        </div>
      </div>

      {/* AI Summary */}
      {(summary || search.resultSummary) && (
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-purple-500" /> AI Summary</CardTitle></CardHeader>
          <CardContent><div className="prose prose-sm max-w-none"><p className="whitespace-pre-wrap">{typeof summary === "string" ? summary : search.resultSummary}</p></div></CardContent>
        </Card>
      )}

      {/* Person Records */}
      {personRecords.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium">Person Records ({personRecords.length})</h2>
          {personRecords.map((person: any) => (
            <Card key={person.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-lg font-bold">{person.fullName}</p>
                    {person.aliases && <p className="text-xs text-gray-500">AKA: {JSON.parse(person.aliases).join(", ")}</p>}
                    <div className="flex gap-4 mt-1 text-sm text-gray-600">
                      {person.age && <span>Age: {person.age}</span>}
                      {person.dateOfBirth && <span>DOB: {new Date(person.dateOfBirth).toLocaleDateString()}</span>}
                      {person.gender && <span>{person.gender}</span>}
                      {person.deceased && <span className="text-red-600 font-medium">Deceased</span>}
                    </div>
                  </div>
                  {person.verificationScore && <span className="text-sm font-medium text-emerald-600">{Number(person.verificationScore).toFixed(0)}% verified</span>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                  {person.currentAddress && (
                    <div className="p-3 bg-gray-50 rounded-lg"><div className="flex items-center gap-2 mb-1"><MapPin className="h-4 w-4 text-gray-400" /><span className="font-medium">Current Address</span></div><p className="text-gray-600">{person.currentAddress}</p>{person.currentCity && <p className="text-gray-500">{person.currentCity}, {person.currentState} {person.currentZip}</p>}</div>
                  )}
                  {person.phones && (
                    <div className="p-3 bg-gray-50 rounded-lg"><div className="flex items-center gap-2 mb-1"><Phone className="h-4 w-4 text-gray-400" /><span className="font-medium">Phones</span></div>{JSON.parse(person.phones).slice(0, 3).map((p: any, i: number) => <p key={i} className="text-gray-600">{p.number} <span className="text-xs text-gray-400">({p.type})</span></p>)}</div>
                  )}
                  {person.emails && (
                    <div className="p-3 bg-gray-50 rounded-lg"><div className="flex items-center gap-2 mb-1"><Mail className="h-4 w-4 text-gray-400" /><span className="font-medium">Emails</span></div>{JSON.parse(person.emails).slice(0, 3).map((e: any, i: number) => <p key={i} className="text-gray-600">{e.email}</p>)}</div>
                  )}
                  {person.criminalRecords && JSON.parse(person.criminalRecords).length > 0 && (
                    <div className="p-3 bg-red-50 rounded-lg"><div className="flex items-center gap-2 mb-1"><AlertTriangle className="h-4 w-4 text-red-400" /><span className="font-medium text-red-700">Criminal Records ({JSON.parse(person.criminalRecords).length})</span></div></div>
                  )}
                  {person.bankruptcies && JSON.parse(person.bankruptcies).length > 0 && (
                    <div className="p-3 bg-amber-50 rounded-lg"><div className="flex items-center gap-2 mb-1"><FileText className="h-4 w-4 text-amber-400" /><span className="font-medium text-amber-700">Bankruptcies ({JSON.parse(person.bankruptcies).length})</span></div></div>
                  )}
                  {person.properties && JSON.parse(person.properties).length > 0 && (
                    <div className="p-3 bg-blue-50 rounded-lg"><div className="flex items-center gap-2 mb-1"><Briefcase className="h-4 w-4 text-blue-400" /><span className="font-medium text-blue-700">Properties ({JSON.parse(person.properties).length})</span></div></div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Visual Matches */}
      {visualMatches.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium">Visual Matches ({visualMatches.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {visualMatches.map((m: any) => (
              <Card key={m.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-2">
                    <div><p className="text-sm font-medium">{m.matchDomain || m.platform}</p><p className="text-xs text-gray-500">{m.matchType} · {(Number(m.similarityScore) * 100).toFixed(0)}% match</p></div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${m.status === "CONFIRMED_INFRINGEMENT" ? "bg-red-100 text-red-700" : m.status === "NEW" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-700"}`}>{m.status.replace(/_/g, " ")}</span>
                  </div>
                  <a href={m.matchUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline truncate block">{m.matchUrl}</a>
                  {m.context && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{m.context}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Raw results fallback */}
      {personRecords.length === 0 && visualMatches.length === 0 && search.results && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Raw Results</CardTitle></CardHeader>
          <CardContent><pre className="text-xs bg-gray-50 p-4 rounded overflow-auto max-h-96">{search.results}</pre></CardContent>
        </Card>
      )}
    </div>
  );
}
