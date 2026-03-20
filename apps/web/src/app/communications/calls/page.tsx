"use client";

import Link from "next/link";
import { useState } from "react";
import { Phone, PhoneCall, Clock, Mic, ArrowLeft } from "lucide-react";

export default function CallLogPage() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/communications" className="text-gray-400 hover:text-gray-600"><ArrowLeft className="h-5 w-5" /></Link>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Call Log</h1>
          <p className="text-gray-500 mt-1 text-sm">All call recordings and logs from Smith.ai, Ruby, PATLive, and Dialpad appear here.</p>
        </div>
      </div>

      <div className="flex gap-3">
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-md border border-gray-200 px-3 py-2 text-sm" placeholder="From" />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-md border border-gray-200 px-3 py-2 text-sm" placeholder="To" />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 border-b">
            <th className="text-left p-3 font-medium text-gray-700">Date</th>
            <th className="text-left p-3 font-medium text-gray-700">Caller</th>
            <th className="text-left p-3 font-medium text-gray-700">Recipient</th>
            <th className="text-left p-3 font-medium text-gray-700">Duration</th>
            <th className="text-left p-3 font-medium text-gray-700">Matter</th>
            <th className="text-left p-3 font-medium text-gray-700">Recording</th>
            <th className="text-left p-3 font-medium text-gray-700">Status</th>
          </tr></thead>
          <tbody>
            <tr><td colSpan={7} className="text-center py-16 text-gray-400">
              <PhoneCall className="h-10 w-10 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No calls recorded yet</p>
              <p className="text-xs mt-1">Connect a phone service integration to start logging calls automatically.</p>
            </td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
