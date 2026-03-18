"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Users, MapPin, AlertTriangle, FileText } from "lucide-react";
import Link from "next/link";

export default function PersonsPage() {
  const [search, setSearch] = useState("");

  const { data: persons, isLoading } = trpc.investigations.persons.list.useQuery({ search: search || undefined });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Person Records</h1><p className="text-sm text-slate-500">All persons found through investigation searches</p></div>
      </div>

      <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" /><Input className="pl-9" placeholder="Search by name..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>

      {isLoading ? <Loader2 className="h-8 w-8 animate-spin mx-auto my-8 text-blue-500" /> : (
        <Card>
          <CardContent className="pt-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium text-gray-500">Name</th>
                  <th className="pb-2 font-medium text-gray-500">Location</th>
                  <th className="pb-2 font-medium text-gray-500">Age</th>
                  <th className="pb-2 font-medium text-gray-500">Matter</th>
                  <th className="pb-2 font-medium text-gray-500">Provider</th>
                  <th className="pb-2 font-medium text-gray-500 text-center">Flags</th>
                  <th className="pb-2 font-medium text-gray-500">Date</th>
                </tr>
              </thead>
              <tbody>
                {(persons || []).map((p: any) => {
                  const hasCriminal = p.criminalRecords && JSON.parse(p.criminalRecords).length > 0;
                  const hasBankruptcy = p.bankruptcies && JSON.parse(p.bankruptcies).length > 0;
                  const hasLiens = p.liensJudgments && JSON.parse(p.liensJudgments).length > 0;
                  return (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-3"><Link href={`/investigations/search/${p.searchId}`} className="font-medium text-blue-600 hover:underline">{p.fullName}</Link>{p.deceased && <span className="text-xs text-red-500 ml-1">(Deceased)</span>}</td>
                      <td className="py-3 text-gray-600">{p.currentCity ? `${p.currentCity}, ${p.currentState}` : p.currentState || "—"}</td>
                      <td className="py-3">{p.age || "—"}</td>
                      <td className="py-3 text-gray-600">{p.matter?.name || "—"}</td>
                      <td className="py-3"><span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{p.provider}</span></td>
                      <td className="py-3 text-center">
                        <div className="flex justify-center gap-1">
                          {hasCriminal && <AlertTriangle className="h-3.5 w-3.5 text-red-400" />}
                          {hasBankruptcy && <FileText className="h-3.5 w-3.5 text-amber-400" />}
                          {hasLiens && <FileText className="h-3.5 w-3.5 text-orange-400" />}
                        </div>
                      </td>
                      <td className="py-3 text-gray-500">{new Date(p.createdAt).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
                {(!persons || persons.length === 0) && <tr><td colSpan={7} className="py-8 text-center text-gray-400">No person records found.</td></tr>}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
