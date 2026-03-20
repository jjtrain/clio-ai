"use client";

import Link from "next/link";
import { useState } from "react";
import { Users, ArrowLeft, ExternalLink } from "lucide-react";

export default function ClientPortalsPage() {
  const [provider, setProvider] = useState("all");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/communications" className="text-gray-400 hover:text-gray-600"><ArrowLeft className="h-5 w-5" /></Link>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Client Portals</h1>
          <p className="text-gray-500 mt-1 text-sm">Client portal connections and secure messaging via Case Status, Hona, and Privilege.law.</p>
        </div>
      </div>

      <div className="flex gap-2">
        {["all", "case_status", "hona", "privilege"].map((p) => (
          <button key={p} onClick={() => setProvider(p)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${provider === p ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            {p === "all" ? "All Providers" : p === "case_status" ? "Case Status" : p === "hona" ? "Hona" : "Privilege.law"}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 border-b">
            <th className="text-left p-3 font-medium text-gray-700">Client</th>
            <th className="text-left p-3 font-medium text-gray-700">Matter</th>
            <th className="text-left p-3 font-medium text-gray-700">Provider</th>
            <th className="text-left p-3 font-medium text-gray-700">Status</th>
            <th className="text-left p-3 font-medium text-gray-700">Last Activity</th>
            <th className="text-left p-3 font-medium text-gray-700">Messages</th>
          </tr></thead>
          <tbody>
            <tr><td colSpan={6} className="text-center py-16 text-gray-400">
              <Users className="h-10 w-10 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No portal connections yet</p>
              <p className="text-xs mt-1">Connect a client portal integration to enable secure client communication.</p>
            </td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
