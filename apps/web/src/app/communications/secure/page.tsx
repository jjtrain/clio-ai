"use client";

import Link from "next/link";
import { useState } from "react";
import { Mail, Lock, ArrowLeft } from "lucide-react";

export default function SecureMessagesPage() {
  const [readFilter, setReadFilter] = useState("all");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/communications" className="text-gray-400 hover:text-gray-600"><ArrowLeft className="h-5 w-5" /></Link>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Secure Messages</h1>
          <p className="text-gray-500 mt-1 text-sm">End-to-end encrypted messages between attorneys and clients.</p>
        </div>
      </div>

      <div className="flex gap-2">
        {["all", "unread", "read"].map((f) => (
          <button key={f} onClick={() => setReadFilter(f)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${readFilter === f ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 border-b">
            <th className="text-left p-3 font-medium text-gray-700">Date</th>
            <th className="text-left p-3 font-medium text-gray-700">From</th>
            <th className="text-left p-3 font-medium text-gray-700">To</th>
            <th className="text-left p-3 font-medium text-gray-700">Subject</th>
            <th className="text-left p-3 font-medium text-gray-700">Matter</th>
            <th className="text-left p-3 font-medium text-gray-700">Status</th>
            <th className="text-left p-3 font-medium text-gray-700">Encryption</th>
          </tr></thead>
          <tbody>
            <tr><td colSpan={7} className="text-center py-16 text-gray-400">
              <Lock className="h-10 w-10 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No secure messages yet</p>
              <p className="text-xs mt-1">Encrypted messages with clients will appear here once you start using secure messaging.</p>
            </td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
