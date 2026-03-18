"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Plus, MapPin, CheckCircle } from "lucide-react";
import Link from "next/link";

const TYPE_COLORS: Record<string, string> = { COURT: "bg-blue-100 text-blue-700", OPPOSING_COUNSEL: "bg-red-100 text-red-700", GOVERNMENT_AGENCY: "bg-purple-100 text-purple-700", INSURANCE_COMPANY: "bg-amber-100 text-amber-700", CLIENT: "bg-emerald-100 text-emerald-700", OTHER: "bg-gray-100 text-gray-700" };

export default function AddressBookPage() {
  const [search, setSearch] = useState("");
  const { data: addresses, isLoading } = trpc.mail["addressBook.list"].useQuery({});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Address Book</h1><p className="text-sm text-slate-500">Frequently used mailing addresses</p></div>
      </div>
      <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" /><Input className="pl-9" placeholder="Search addresses..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>

      {isLoading ? <Loader2 className="h-8 w-8 animate-spin mx-auto my-8 text-blue-500" /> : (
        <Card>
          <CardContent className="pt-6">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left"><th className="pb-2 font-medium text-gray-500">Name</th><th className="pb-2 font-medium text-gray-500">Organization</th><th className="pb-2 font-medium text-gray-500">Address</th><th className="pb-2 font-medium text-gray-500">Type</th><th className="pb-2 font-medium text-gray-500 text-center">Verified</th><th className="pb-2 font-medium text-gray-500 text-right">Mailings</th></tr></thead>
              <tbody>
                {(addresses || []).map((a: any) => (
                  <tr key={a.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2 font-medium">{a.name}</td>
                    <td className="py-2 text-gray-600">{a.organization || "—"}</td>
                    <td className="py-2 text-gray-600">{a.addressLine1}, {a.city}, {a.state} {a.zip}</td>
                    <td className="py-2"><span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[a.addressType] || ""}`}>{a.addressType.replace(/_/g, " ")}</span></td>
                    <td className="py-2 text-center">{a.isVerified ? <CheckCircle className="h-4 w-4 text-emerald-500 mx-auto" /> : "—"}</td>
                    <td className="py-2 text-right">{a.mailingCount}</td>
                  </tr>
                ))}
                {(!addresses || addresses.length === 0) && <tr><td colSpan={6} className="py-8 text-center text-gray-400">No addresses in book.</td></tr>}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
